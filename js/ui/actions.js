/**
 * actions.js — intentions du joueur (clics) → systèmes de jeu.
 * Les confirmations vivent ici, jamais dans les systèmes.
 */
import { CONFIG, typeById } from '../config.js';
import { Game } from '../core/game.js';
import { Store } from '../core/store.js';
import { Fmt } from '../core/format.js';
import { Factory } from '../sim/factory.js';
import { Contracts } from '../sim/contracts.js';
import { Couriers } from '../sim/couriers.js';
import { RealEstate, Garage, Recipes, Districts } from '../sim/world-systems.js';
import { Quests } from '../sim/quests.js';
import { Sim, Prestige } from '../sim/sim.js';
import { Eco } from '../sim/eco.js';
import { Sfx } from '../audio/sfx.js';
import { PWA } from '../pwa.js';
import { World } from '../world/world.js';
import { Tuto } from '../tutorial/tutorial.js';
import { Tips } from '../tutorial/tips.js';
import { Editor } from '../editor/editor.js';
import { UI } from './ui.js';
import { Form } from './form.js';

const map = {
  // usine
  select: (s, a) => Factory.select(s, a),
  unlock: (s, a) => Factory.unlock(s, a),
  buyMat: (s, a) => { const [m, q] = a.split(','); Factory.buyMaterial(s, m, Number(q)); },
  up: (s, a) => Factory.upgrade(s, a),
  counter: s => { s.counterOn = !s.counterOn; },
  restock: s => Factory.buyRestock(s),
  // contrats
  accept: (s, a) => Contracts.accept(s, a),
  decline: (s, a) => Contracts.decline(s, a),
  slot: s => Contracts.buySlot(s),
  abandon: (s, a) => {
    const c = Contracts.find(s, a);
    if (!c) return;
    const pen = Contracts.penalty(c, true);
    UI.confirm(`Abandonner la commande de ${c.icon} ${c.client} ?<br><small>Tu perds ${Fmt.money(pen.money)} et ⭐ ${pen.rep}.${c.loaded ? ' Les bouteilles reviennent au stock.' : ''}</small>`,
      () => Contracts.abandon(Game.s, a), 'Abandonner');
  },
  // agence
  house: (s, a) => RealEstate.buy(s, a, Form.houseUse[a] || 'rent'),
  reno: (s, a) => RealEstate.renovate(s, a),
  sellHouse: (s, a) => {
    const h = RealEstate.find(s, a);
    if (h) UI.confirm(`Revendre ${typeById(h.type).name} pour ${Fmt.money(Eco.sellValue(h))} ?`, () => RealEstate.sell(Game.s, a), 'Vendre');
  },
  // garage
  vehicle: s => Garage.buy(s),
  courier: s => Couriers.hire(s),
  // labo
  laboColor: (s, a) => { Form.labo.color = a; },
  laboCreate: s => { if (Recipes.create(s, Form.labo)) Form.labo.name = ''; },
  // mairie
  shirt: (s, a) => { s.look.shirt = a; },
  pet: (s, a) => { s.look.pet = a; },
  claim: s => Quests.claim(s),
  district: (s, a) => {
    const d = CONFIG.districts[a];
    UI.confirm(`Ouvrir ${d.icon} ${d.name} pour ${Fmt.money(d.cost)} ?<br><small>${d.desc}</small>`, () => Districts.unlock(Game.s, a), 'Ouvrir');
  },
  prestige: s => {
    if (!Prestige.can(s)) return;
    UI.confirm(`Revendre l’entreprise pour ${Eco.prestigeGain(s)} étoile(s) ? Tout repart de zéro, sauf ton personnage et tes quêtes.`, () => {
      Prestige.reset(Game.s); Store.save(Game.s); UI.close(); UI.toast('Nouvelle entreprise fondée ✨', 'ok');
    }, 'Revendre');
  },
  save: s => { const ok = Store.save(s); UI.toast(ok ? 'Partie sauvegardée' : 'Sauvegarde indisponible ici', ok ? 'ok' : 'bad'); },
  reset: () => UI.confirm('Effacer définitivement la partie ?', () => {
    Store.wipe(); Game.s = Store.fresh(); Sim.seed(Game.s); UI.close(); World.resetPlayer();
    Tuto.propose();
  }, 'Effacer'),
  // Mémé Grenadine : tutoriel et conseils
  tutoNext: () => Tuto.button(),
  tutoSkip: () => Tuto.skip(),
  tutoLost: () => Tuto.lost(),
  tutoReplay: () => Tuto.start(),
  tipClose: () => Tips.close(),
  tipsToggle: s => { s.tipsOn = !s.tipsOn; },
  architect: () => Editor.start(),
  // général
  interact: () => World.interact(),
  closePanel: () => UI.close(),
  mute: () => Sfx.toggle(),
  install: () => PWA.install(),
  checkUpdate: () => PWA.check(),
  hideHelp: () => { UI.el.help.hidden = true; try { localStorage.setItem('siropcie_help', '0'); } catch (e) { /* */ } },
  questToggle: () => UI.el.quest.classList.toggle('min'),
};

export const Actions = {
  run(name, arg) {
    const fn = map[name];
    if (!fn) return;
    fn(Game.s, arg);
    UI.key = null;
    UI.render(Game.s);
  },
};
