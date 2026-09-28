/**
 * tips.js — les conseils de Mémé : montrés une seule fois, au moment où ils servent
 * (entrepôt plein, première nuit, première commande ratée…). Désactivables à la mairie.
 * Parler à Mémé sur son banc donne aussi un conseil (ADVICE, à tour de rôle).
 */
import { rt } from '../core/game.js';
import { Bus } from '../core/bus.js';
import { Clock } from '../sim/clock.js';
import { Events } from '../sim/events.js';
import { UI } from '../ui/ui.js';
import { Meme } from '../world/meme.js';
import { World } from '../world/world.js';
import { Overlay } from './overlay.js';

/**
 * Conseils du « premier moment ».
 * when(s) : la situation se présente · event : déclenché par Bus.emit('tip', id)
 */
export const TIPS = [
  { id: 'questReady', when: s => s.quest.ready,
    text: 'Une mission est réussie 🎁 ! Va voir le <b>maire</b> à la mairie 🏛️ pour ta récompense.' },
  { id: 'noMat', when: () => rt.bneck === 'mat',
    text: 'Plus de sucre ou de fruits : l’usine s’arrête ! Achètes-en dans l’usine 🏭, ou va cueillir le <b>verger</b> 🌳.' },
  { id: 'wareFull', when: () => rt.bneck === 'ware',
    text: 'Ton <b>entrepôt</b> est plein 📦 ! Livre des commandes, vends au comptoir 🛎️, ou agrandis l’entrepôt dans l’usine.' },
  { id: 'night', when: s => Clock.isNight(s),
    text: 'La nuit tombe 🌙. Le comptoir vend moins… mais le <b>Café des Arts</b> ☕ paie 25 % de plus !' },
  { id: 'event', when: s => !!Events.current(s),
    text: s => {
      const e = Events.current(s);
      return `${e.icon} <b>${e.name}</b> : ${e.desc}.` + (s.event.id === 'fete' ? ' Accepte-la au bureau des Contrats 📜.' : '');
    } },
  { id: 'tooBig', event: true,
    text: s => 'Cette commande est trop lourde pour toi ! ' + (s.opened.garage
      ? 'Au <b>Garage</b> 🚲, un vélo ou une charrette porte plus de bouteilles.'
      : 'Quand le Garage 🚲 ouvrira, un vélo portera plus. En attendant, prends des commandes plus petites.') },
  { id: 'fail', when: s => s.stats.cFail > 0,
    text: 'Oh, une commande ratée : tu perds un peu d’argent et de ⭐. Avant d’accepter, regarde le <b>temps</b> ⏱ et ton stock.' },
  { id: 'open_garage', when: s => s.opened.garage,
    text: 'Le <b>Garage</b> 🚲 est ouvert ! Un vélo va plus vite et porte plus. Plus tard, des livreurs travailleront pour toi.' },
  { id: 'open_agence', when: s => s.opened.agence,
    text: 'L’<b>Agence</b> 🏡 est ouverte ! Achète une maison : en location, elle rapporte de l’argent même quand tu dors.' },
  { id: 'open_labo', when: s => s.opened.labo,
    text: 'Le <b>Labo</b> 🧪 est ouvert ! Mélange deux parfums pour inventer une recette secrète, qui se vend plus cher.' },
];

/** Conseils donnés quand on parle à Mémé sur son banc */
export const ADVICE = [
  'Dans l’usine, l’étape qui bloque est surlignée en orange : c’est elle qu’il faut améliorer 🔥.',
  'Les commandes rapportent plus que le comptoir. Garde toujours une commande en route 📜 !',
  'Le verger 🌳 est gratuit, et ton compagnon cueille aussi pour toi.',
  'Chaque ⭐ de réputation attire de nouveaux clients : le Café ☕, puis le Supermarché 🛒…',
  'Une maison en location 💶 rapporte de l’argent même quand tu ne joues pas.',
  'Le maire a toujours une mission pour toi, en haut à gauche 📜.',
  'Un parfum plus cher rapporte plus par bouteille : la Grenadine vaut le double de la Menthe !',
  'Tu peux revoir mon tutoriel à la mairie 🏛️, quand tu veux.',
];

export const Tips = {
  current: null,   // conseil affiché
  showT: 0,        // secondes avant qu'il ne disparaisse
  cool: 10,        // pas de conseil avant…
  acc: 0, adv: 0,
  pending: new Set(),

  init() { Bus.on('tip', id => this.pending.add(id)); },

  frame(dt, s) {
    if (World.mode === 'edit') return;           // pas de conseil pendant le Mode architecte
    if (this.current) {
      Overlay.low(!!UI.active);
      if ((this.showT -= dt) <= 0) this.close();
      return;
    }
    this.cool -= dt; this.acc += dt;
    if (this.acc < 1 || this.cool > 0) return;
    this.acc = 0;
    if (!s.tipsOn || UI.modalOpen()) return;
    const t = TIPS.find(t => !s.seen[t.id] && (this.pending.has(t.id) || (t.when && t.when(s))));
    if (!t) return;
    s.seen[t.id] = true;
    this.pending.delete(t.id);
    this.show(typeof t.text === 'function' ? t.text(s) : t.text);
  },

  /** Affiche un conseil dans la carte de Mémé */
  show(html, sec = 14) {
    this.current = html; this.showT = sec;
    Overlay.card({ html, tuto: false, next: 'Merci Mémé !' });
    Overlay.low(!!UI.active);
    Meme.talk('Psst ! Un conseil !', 3);
    Bus.sfx('click');
  },

  close() {
    this.current = null; this.cool = 20;
    Overlay.hide();
  },

  /** Conseil au hasard (à tour de rôle) quand on parle à Mémé */
  advice() { this.show(ADVICE[this.adv++ % ADVICE.length], 12); },
};
