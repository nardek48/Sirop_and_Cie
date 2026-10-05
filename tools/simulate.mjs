/**
 * simulate.mjs — simulateur d'équilibrage de Sirop & Cie.
 *
 * Fait tourner les VRAIES règles du jeu (js/sim/) avec un joueur automatique
 * qui joue comme un humain assidu : il accepte les contrats, marche jusqu'au quai
 * puis chez les clients, récolte, améliore l'usine, achète maisons, véhicules,
 * livreurs, quartiers et recettes, et va chercher ses récompenses à la mairie.
 * Il note l'heure de chaque étape importante.
 *
 * Utilisation :
 *   node tools/simulate.mjs                          10 h de jeu, graine 1
 *   node tools/simulate.mjs --hours=20 --seed=7      autre durée, autre tirage
 *   node tools/simulate.mjs --runs=5                 5 parties, médiane des étapes
 *   node tools/simulate.mjs --set=houses.costGrowth=1.45 --set=levels.cook.costGrowth=1.2
 *                                                    tester un réglage sans toucher à config.js
 *   node tools/simulate.mjs --human=2                joueur plus lent (trajets ×2)
 *   node tools/simulate.mjs --csv                    écrit la courbe dans tools/sim-courbe.csv
 *   node tools/simulate.mjs --strategie=usine        tout miser sur l'usine (comptoir juste sous l'embouteillage)
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/* ---------- Arguments ---------- */
const args = Object.fromEntries(process.argv.slice(2).filter(a => !a.startsWith('--set=')).map(a => {
  const [k, v = 'true'] = a.replace(/^--/, '').split('=');
  return [k, v];
}));
const sets = process.argv.slice(2).filter(a => a.startsWith('--set=')).map(a => a.slice(6));
const HOURS = Number(args.hours || 10);
const RUNS = Number(args.runs || 1);
const HUMAN = Number(args.human || 1.5);
const STRAT = args.strategie || 'equilibre';   // equilibre | usine     // facteur « humain » : hésitations, menus, détours
let SEED = Number(args.seed || 1);

/* ---------- Hasard reproductible (le jeu utilise Math.random) ---------- */
let rngState = SEED;
Math.random = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647);

/* ---------- Modules du jeu ---------- */
const { CONFIG, typeById } = await import('../js/config.js');
const { Store } = await import('../js/core/store.js');
const { Game } = await import('../js/core/game.js');
const { Eco } = await import('../js/sim/eco.js');
const { Flavors } = await import('../js/sim/flavors.js');
const { Factory } = await import('../js/sim/factory.js');
const { Contracts } = await import('../js/sim/contracts.js');
const { Couriers } = await import('../js/sim/couriers.js');
const { Fields, Farm, Districts, RealEstate, Garage, Recipes } = await import('../js/sim/world-systems.js');
const { Quests, questsFromFile } = await import('../js/sim/quests.js');
// Les quêtes publiées (assets/quests.json) si le fichier existe, comme dans le jeu
try {
  const list = questsFromFile(readFileSync(fileURLToPath(new URL('../assets/quests.json', import.meta.url)), 'utf8'));
  if (list) Quests.base = list;
} catch (e) { /* pas de fichier : quêtes par défaut */ }
const { Sim, Prestige } = await import('../js/sim/sim.js');

// Réglages temporaires : --set=chemin.vers.valeur=nombre
for (const s of sets) {
  const [path, raw] = s.split('=');
  const keys = path.split('.'), last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], CONFIG);
  if (!(last in obj)) { console.error(`Réglage inconnu : ${path}`); process.exit(1); }
  obj[last] = isNaN(Number(raw)) ? raw : Number(raw);
}

/* ---------- Géographie (secondes de marche, depuis le quai) ---------- */
const walk = (s, a, b) => (Couriers.dist(a, b) / Eco.speed(s)) * HUMAN;
const FIELD_TRIP = { verger: 520, sureau: 2900, farm: 1100 };   // aller-retour approximatif depuis le quai (px)

/* ---------- Le joueur automatique ---------- */
function makeBot(s) {
  return {
    busyUntil: 0,          // occupé à marcher jusque-là
    pending: [],           // livraisons en cours : { at, place }
    decide(t) {
      this.claim(s);
      this.buy(s);
      this.acceptOffers(s);
      for (const p of this.pending.filter(p => p.at <= t)) Contracts.deliverAt(s, p.place);
      this.pending = this.pending.filter(p => p.at > t);
      if (t < this.busyUntil) return;
      if (this.deliver(s, t)) return;
      this.harvest(s, t);
    },

    /** Va chercher la récompense du maire (petit détour) */
    claim(s) {
      if (s.quest.ready && Quests.claim(s)) this.busyUntil += walk(s, 'quai', 'mairie') * 2;
    },

    acceptOffers(s) {
      const net = Math.min(Eco.cookRate(s), Eco.bottleRate(s)) * 0.8;   // marge : matières, changements de parfum
      const offers = [...s.offers].sort((a, b) => b.reward / b.qty - a.reward / a.qty);
      for (const o of offers) {
        if (s.active.length >= s.slots) break;
        const canCarry = o.qty <= Eco.capacity(s) || s.couriers > 0;
        // Reste à produire, parfum par parfum, pour les contrats acceptés plus celui-ci,
        // + 25 s par changement de parfum (vidage de la cuve) + 45 s de marche
        const need = {};
        for (const c of [...s.active.filter(c => !c.loaded), o]) need[c.flavor] = (need[c.flavor] || 0) + c.qty;
        const toMake = Object.entries(need).reduce((a, [fl, q]) => a + Math.max(0, q - (s.stock[fl] || 0)), 0);
        // Chaque parfum se fait sur une seule ligne ; plusieurs parfums avancent en parallèle
        const par = Math.min(Eco.lineCount(s), Object.keys(need).length);
        const needTime = toMake / Math.max(0.05, net / Eco.lineCount(s) * par) + 25 * Object.keys(need).length + 45;
        if (canCarry && needTime < o.time * 0.85) Contracts.accept(s, o.id);
      }
      // Parfums des lignes : d'abord ceux des contrats en attente, puis les plus chers.
      // Une ligne qui fait déjà un parfum voulu le garde (comme un joueur : on évite de vider les cuves).
      const wants = [...new Set(s.active.filter(c => !c.loaded && (s.stock[c.flavor] || 0) < c.qty).map(c => c.flavor))];
      const byPrice = [...s.unlocked].sort((a, b) => Flavors.get(s, b).price - Flavors.get(s, a).price);
      const lines = Eco.lines(s), wanted = [...new Set([...wants, ...byPrice])].slice(0, lines.length);
      const free = wanted.filter(fl => !lines.some(L => L.flavor === fl));
      lines.forEach((L, i) => { if (!wanted.includes(L.flavor) && free.length) Factory.select(s, free.shift(), i); });
    },

    /** Charge au quai et part livrer (les clients visités dans l'ordre de la route) */
    deliver(s, t) {
      const ready = s.active.filter(c => Contracts.canLoad(s, c) && c.qty <= Eco.capacity(s));
      if (!ready.length) return false;
      const r = Contracts.loadAll(s);
      if (!r.n) return false;
      const places = [...new Set(Eco.carried(s).map(c => c.place))]
        .sort((a, b) => CONFIG.places[a].x - CONFIG.places[b].x);
      let at = t, from = 'quai';
      for (const pl of places) { at += walk(s, from, pl); this.pending.push({ at, place: pl }); from = pl; }
      this.busyUntil = at + walk(s, from, 'quai');
      return true;
    },

    /** Récolte tout ce qui est mûr dans un lieu, si le détour vaut le coup */
    harvest(s, t) {
      let best = null;
      for (const [g, arr] of Object.entries(s.fields)) {
        if (!Fields.open(s, g)) continue;
        const ripe = arr.map((v, i) => (v <= 0 ? i : -1)).filter(i => i >= 0);
        if (ripe.length < Math.ceil(arr.length / 2)) continue;
        const mat = CONFIG.fields[g].mat === 'auto' ? Flavors.mainFruit(s, s.flavor) : CONFIG.fields[g].mat;
        const gain = ripe.length * CONFIG.fields[g].yield * CONFIG.materials[mat].price;
        const time = (FIELD_TRIP[g] / Eco.speed(s)) * HUMAN + ripe.length * 1.5;
        if (!best || gain / time > best.rate) best = { g, ripe, time, rate: gain / time };
      }
      // Champs à cultiver : récolte à la main (×2) ; sinon ils se ramassent tout seuls
      const fr = [];
      for (let i = 0; i < s.farm.owned; i++) if (Farm.ripe(s, i)) fr.push(i);
      if (fr.length >= Math.ceil(s.farm.owned / 2)) {
        const gain = fr.reduce((a, i) => a + Farm.yieldOf(s, i) * CONFIG.materials[Farm.crop(s, i).mat].price, 0) * CONFIG.farm.handMult;
        const time = (FIELD_TRIP.farm / Eco.speed(s)) * HUMAN + fr.length * 1.5;
        if (!best || gain / time > best.rate) best = { farm: true, ripe: fr, time, rate: gain / time };
      }
      if (!best) return;
      for (const i of best.ripe) best.farm ? Farm.harvest(s, i, { x: 0, y: 0 }, 'pet') : Fields.pick(s, best.g, i, { x: 0, y: 0 }, 'pet');
      this.busyUntil = t + best.time;
    },

    /** Achats, par ordre de priorité, tant qu'il y a de quoi payer */
    buy(s) {
      for (let guard = 0; guard < 20; guard++) if (!this.buyOne(s)) break;
    },
    buyOne(s) {
      // Matières à la main tant que le réapprovisionnement automatique n'est pas acheté
      if (!s.auto.restock) {
        for (const [mat, q] of Object.entries(Flavors.needs(s, s.flavor)))
          if (q && s.mat[mat] < q * 25 && s.money >= 100 * CONFIG.materials[mat].price) { Factory.buyMaterial(s, mat, 100); return true; }
      }
      // Réserve : de quoi racheter une minute de matières au rythme actuel
      const matPerSec = Object.entries(Flavors.needs(s, s.flavor)).reduce((a, [mt, q]) => a + q * CONFIG.materials[mt].price, 0) * Eco.cookRate(s);
      const reserve = Math.max(60, matPerSec * 60);
      const m = s.money - reserve;
      const can = c => c <= m;
      if (!s.auto.restock && can(CONFIG.restock.cost + 150)) { Factory.buyRestock(s); return true; }

      // Grands objectifs dès qu'ils sont abordables
      const v = Garage.next(s);
      if (v && can(v.cost)) { Garage.buy(s); return true; }
      if (s.couriers < CONFIG.couriers.max && s.rep >= CONFIG.couriers.rep && can(Eco.courierCost(s))) { Couriers.hire(s); return true; }
      for (const [id, d] of Object.entries(CONFIG.districts))
        if (!s.districts[id] && s.rep >= d.rep && can(d.cost)) { Districts.unlock(s, id); return true; }
      // Champs : un bonus, achetés quand ils coûtent moins de la moitié de la caisse.
      // Plantés selon la matière la plus chère à racheter pour le parfum en cours.
      const fc = Farm.nextCost(s);
      if (fc != null && can(fc * 2)) {
        Farm.buy(s);
        const i = s.farm.owned - 1, need = Flavors.needs(s, s.flavor);
        const cost = Object.entries(need).reduce((a, [mt, q]) => a + q * CONFIG.materials[mt].price, 0);
        const fruitShare = 1 - need.sugar * CONFIG.materials.sugar.price / cost;
        const fruitCrop = Object.entries(CONFIG.farm.crops).find(([k, c]) => c.mat === Flavors.mainFruit(s, s.flavor) && Farm.cropOpen(s, k));
        const fruits = s.farm.crop.slice(0, i).filter(c => c !== 'canne').length;
        Farm.plant(s, i, fruitCrop && fruits / i < fruitShare ? fruitCrop[0] : 'canne');
        return true;
      }
      const nextFl = Object.entries(CONFIG.flavors).find(([k]) => !s.unlocked.includes(k));
      if (nextFl && can(nextFl[1].unlock)) { Factory.unlock(s, nextFl[0]); return true; }
      const lineCost = Factory.nextLineCost(s);
      if (lineCost != null && can(lineCost)) { Factory.buyLine(s); return true; }
      if (s.recipes.length < CONFIG.recipes.max && can(Eco.recipeCost(s))) {
        const base = Object.keys(CONFIG.flavors).filter(k => s.unlocked.includes(k)).sort((a, b) => CONFIG.flavors[b].price - CONFIG.flavors[a].price);
        for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) {
          const f = { a: base[i], b: base[j], name: `R${s.recipes.length + 1}`, color: '#f07fb0' };
          if (!Recipes.check(s, f)) { Recipes.create(s, f); return true; }
        }
      }

      // Prochain grand objectif : on économise pour lui s'il est à portée (moins de 4× la caisse)
      const goals = [
        v && v.cost, nextFl && nextFl[1].unlock, lineCost,
        s.couriers < CONFIG.couriers.max && s.rep >= CONFIG.couriers.rep && Eco.courierCost(s),
        ...Object.entries(CONFIG.districts).filter(([id]) => !s.districts[id]).map(([, d]) => d.cost),
        Eco.freePlot(s) >= 0 && Math.min(...CONFIG.houses.types.filter(ty => !s.houses.some(h => h.type === ty.id)).map(ty => Eco.nextHouseCost(s, ty))),
      ].filter(x => x && isFinite(x));
      const saving = goals.length && Math.min(...goals) < m * 4;

      // Usine : améliorer le goulot (un quart de la caisse si on économise, sinon la moitié).
      // Stratégie « usine » : tout l'argent y passe, sans économiser.
      const half = c => c <= m * (STRAT === 'usine' ? 1 : saving ? 0.25 : 0.5);
      const cook = Eco.cookRate(s), bottle = Eco.bottleRate(s), counter = Eco.counterRate(s);
      const prod = Math.min(cook, bottle);
      const lvl = k => half(Eco.lvCost(s, k)) && (Factory.upgrade(s, k), true);
      if (Eco.totalStock(s) >= Eco.wareCap(s) * 0.9 && lvl('ware')) return true;
      if (counter < prod * (STRAT === 'usine' ? 0.97 : 0.8) && lvl('counter')) return true;
      if (s.lv.tank < s.lv.cook - 2 && lvl('tank')) return true;
      if ((cook <= bottle ? lvl('cook') : lvl('bottle'))) return true;

      // Maisons en location : la plus grande abordable, si rentabilisée en moins d'une heure.
      // Terrains pleins : on revend la plus petite pour construire plus grand (comme un joueur).
      // Valeur en $/s d'un usage : loyer direct, ou ventes en plus au comptoir (si la production suit)
      const bestPrice = Math.max(...s.unlocked.map(fl => Eco.sellPrice(s, fl, CONFIG.counter.priceFactor)));
      const value = (use, amount) => use === 'rent' ? amount * Eco.mult(s)
        : use === 'shop' ? Math.min(amount, Math.max(0, prod - counter)) * bestPrice
        : use === 'orchard' ? amount * CONFIG.materials.menthe.price : 0;
      const bestUse = mult => ['rent', 'shop', 'orchard']
        .map(u => [u, value(u, CONFIG.houses.uses[u].base * mult)]).sort((a, b) => b[1] - a[1])[0];

      const types = CONFIG.houses.types.filter(ty => can(Eco.nextHouseCost(s, ty) * 1.1));
      const ty = types.at(-1);
      if (ty) {
        const [use, gain] = bestUse(ty.mult);
        const smallest = [...s.houses].sort((a, b) => typeById(a.type).mult - typeById(b.type).mult)[0];
        if (Eco.freePlot(s) < 0 && smallest && typeById(smallest.type).mult < ty.mult) RealEstate.sell(s, smallest.id);
        if (Eco.freePlot(s) >= 0 && gain > 0 && Eco.nextHouseCost(s, ty) / gain < 3600) { RealEstate.buy(s, ty.id, use); return true; }
      }
      for (const h of s.houses) {
        if (h.lvl >= CONFIG.houses.maxLevel || !half(Eco.renoCost(h))) continue;
        const gain = value(h.use, CONFIG.houses.uses[h.use].base * typeById(h.type).mult * CONFIG.houses.renoBonus);
        if (gain > 0 && Eco.renoCost(h) / gain < 2400) { RealEstate.renovate(s, h.id); return true; }
      }
      if (s.slots < CONFIG.contracts.slotMax && can(Eco.slotCost(s) * 3)) { Contracts.buySlot(s); return true; }
      return false;
    },
  };
}

/* ---------- Étapes suivies ---------- */
const STEPS = [
  ['Réappro auto', s => s.auto.restock],
  ['Grenadine', s => s.unlocked.includes('grenadine')],
  ['Vélo', s => s.vehicle >= 1],
  ['1re maison', s => s.houses.length >= 1],
  ['3e champ', s => s.farm.owned >= 3],
  ['8 champs', s => s.farm.owned >= CONFIG.farm.count],
  ['Citron', s => s.unlocked.includes('citron')],
  ['1re recette', s => s.recipes.length >= 1],
  ['1er livreur', s => s.couriers >= 1],
  ['Charrette', s => s.vehicle >= 2],
  ['Sureau', s => s.unlocked.includes('sureau')],
  ['Colline', s => s.districts.colline],
  ['1re villa', s => s.houses.some(h => h.type === 'villa')],
  ['Camionnette', s => s.vehicle >= 3],
  ['Violette', s => s.unlocked.includes('violette')],
  ['4 livreurs', s => s.couriers >= 4],
  ['4 recettes', s => s.recipes.length >= 4],
  ['1er domaine', s => s.houses.some(h => h.type === 'domaine')],
  ['Toutes les quêtes', s => s.quest.i >= Quests.count(s)],
  ['Ligne 2', s => Eco.lineCount(s) >= 2],
  ['Ligne 3', s => Eco.lineCount(s) >= 3],
  ['Prestige possible', s => Prestige.can(s)],
  ['TOUT FINI', s => s.quest.i >= Quests.count(s) && s.houses.some(h => h.type === 'domaine') && s.unlocked.length >= 5 + CONFIG.recipes.max
      && s.vehicle >= 3 && s.couriers >= 4 && s.districts.colline && s.farm.owned >= CONFIG.farm.count],
];

const fmtT = sec => sec == null ? '—' : sec < 3600 ? `${Math.floor(sec / 60)} min` : `${Math.floor(sec / 3600)} h ${String(Math.floor((sec % 3600) / 60)).padStart(2, '0')}`;
const fmtM = n => n >= 1e6 ? (n / 1e6).toFixed(1) + ' M' : n >= 1e3 ? (n / 1e3).toFixed(1) + ' K' : n.toFixed(0);

/* ---------- Comptabilité : d'où vient l'argent ? ---------- */
const { Market } = await import('../js/sim/market.js');
const src = {};
const track = (obj, fn, label) => {
  const orig = obj[fn].bind(obj);
  obj[fn] = (s, ...a) => {
    const before = s.stats.earned;
    const r = orig(s, ...a);
    const key = typeof label === 'function' ? label(s, ...a) : label;
    src[key] = (src[key] || 0) + (s.stats.earned - before);
    return r;
  };
};
track(Contracts, 'complete', (s, c) => c.special ? 'Fête du village' : 'Contrats');
track(Quests, 'claim', 'Quêtes du maire');
track(Market, 'step', 'Comptoir');
track(RealEstate, 'step', 'Loyers');
const fails = {};
const origFail = Contracts.fail.bind(Contracts);
Contracts.fail = (s, c) => { fails[c.client] = (fails[c.client] || 0) + 1; return origFail(s, c); };

/* ---------- Une partie ---------- */
function runOnce(seed) {
  rngState = seed;
  const s = Store.fresh();
  Game.s = s;
  Sim.seed(s);
  const bot = makeBot(s);
  const hit = {}, curve = [];
  for (let t = 0; t < HOURS * 3600; t++) {
    Sim.step(s, 1);
    bot.decide(t);
    for (const [name, test] of STEPS) if (hit[name] == null && test(s)) hit[name] = t;
    if (t % 300 === 0) curve.push({ min: t / 60, money: s.money, earned: s.stats.earned, rep: s.rep, quest: s.quest.i, houses: s.houses.length });
  }
  return { hit, curve, s };
}

/* ---------- Rapport ---------- */
const runs = Array.from({ length: RUNS }, (_, i) => runOnce(SEED + i * 101));
const median = arr => { const v = arr.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };

console.log(`\nSirop & Cie · simulation de ${HOURS} h · ${RUNS} partie(s) · stratégie ${STRAT} · joueur ×${HUMAN}${sets.length ? ' · réglages : ' + sets.join(', ') : ''}\n`);
console.log('Étape'.padEnd(20) + 'Atteinte à');
console.log('-'.repeat(34));
for (const [name] of STEPS) {
  const times = runs.map(r => r.hit[name]);
  const m = median(times), missed = times.filter(x => x == null).length;
  console.log(name.padEnd(20) + fmtT(m) + (missed && missed < RUNS ? `  (pas atteinte dans ${missed} partie(s))` : ''));
}
const last = runs[0].s;
console.log(`\nFin de la 1re partie : ${fmtM(last.money)} $ en caisse, ${fmtM(last.stats.earned)} $ gagnés, ⭐ ${last.rep}, ${last.houses.length} maisons, ${last.stats.cDone} commandes livrées (${last.stats.cFail} ratées).`);

const total = Object.values(src).reduce((a, b) => a + b, 0) || 1;
console.log(`\nD'où vient l'argent (toutes parties) : ` + Object.entries(src).sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `${k} ${Math.round((v / total) * 100)} %`).join(' · '));
if (Object.keys(fails).length) console.log('Commandes ratées : ' + Object.entries(fails).map(([k, v]) => `${k} ${v}`).join(' · '));

console.log('\nCourbe (1re partie)');
console.log('Temps'.padEnd(10) + 'Gagné'.padStart(10) + 'Réput.'.padStart(8) + 'Quête'.padStart(7) + 'Maisons'.padStart(9));
for (const p of runs[0].curve.filter((p, i) => p.min <= 60 ? p.min % 10 === 0 : p.min % 60 === 0))
  console.log(fmtT(p.min * 60).padEnd(10) + fmtM(p.earned).padStart(10) + String(p.rep).padStart(8) + String(p.quest).padStart(7) + String(p.houses).padStart(9));

if (args.csv) {
  const out = fileURLToPath(new URL('./sim-courbe.csv', import.meta.url));
  writeFileSync(out, 'minute;argent;gagne;reputation;quete;maisons\n' + runs[0].curve.map(p => [p.min, p.money.toFixed(0), p.earned.toFixed(0), p.rep, p.quest, p.houses].join(';')).join('\n'));
  console.log(`\nCourbe écrite dans ${out}`);
}
