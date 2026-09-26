/**
 * bus.js — petit bus d'événements. Les systèmes de simulation n'importent
 * jamais l'UI ni le monde : ils émettent, la présentation écoute.
 *
 * Événements : 'toast' (msg, type) · 'float' (texte, lieu|{x,y}, couleur) · 'sfx' (nom)
 */
import { rt } from './game.js';

const handlers = {};

export const Bus = {
  on(ev, fn) { (handlers[ev] ||= []).push(fn); },
  emit(ev, ...args) {
    if (rt.silent) return;
    for (const fn of handlers[ev] || []) fn(...args);
  },
  toast(msg, type = '') {
    this.emit('toast', msg, type);
    if (type === 'bad') this.emit('sfx', 'error');
  },
  float(text, where, color) { this.emit('float', text, where, color); },
  sfx(name) { this.emit('sfx', name); },
};
