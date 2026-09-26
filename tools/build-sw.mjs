/**
 * build-sw.mjs — met à jour la liste des fichiers à mettre en cache et la
 * version du service worker. À lancer avant chaque publication :
 *
 *   node tools/build-sw.mjs
 *
 * La version est une empreinte du contenu : si aucun fichier n'a changé,
 * elle reste identique et les joueurs ne voient pas de mise à jour.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INCLUDE = ['index.html', 'manifest.webmanifest', 'favicon.ico', 'css', 'js', 'assets', 'icons'];
const SKIP = [/\.DS_Store$/, /modele-perso-guide\.png$/, /screenshot-/];

function walk(p) {
  const abs = join(ROOT, p);
  if (statSync(abs).isDirectory()) return readdirSync(abs).sort().flatMap(n => walk(join(p, n)));
  return SKIP.some(r => r.test(p)) ? [] : [p];
}

const files = INCLUDE.flatMap(walk).map(p => p.split(sep).join('/'));
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(ROOT, f)));
const version = hash.digest('hex').slice(0, 10);

const block = `// <build>
const VERSION = '${version}';
const PRECACHE = [
  './',
${files.map(f => `  './${f}',`).join('\n')}
];
// </build>`;

const swPath = join(ROOT, 'sw.js');
const sw = readFileSync(swPath, 'utf8').replace(/\/\/ <build>[\s\S]*?\/\/ <\/build>/, block);
writeFileSync(swPath, sw);
console.log(`sw.js : version ${version}, ${files.length} fichiers en cache`);
