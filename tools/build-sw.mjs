/**
 * build-sw.mjs — prépare le service worker avant une publication.
 *
 *   node tools/build-sw.mjs          liste de cache + empreinte (VERSION inchangée)
 *   node tools/build-sw.mjs patch    v0.0.1 → v0.0.2   (corrections, petits ajouts)
 *   node tools/build-sw.mjs minor    v0.0.2 → v0.1.0   (nouvelle fonctionnalité)
 *   node tools/build-sw.mjs major    v0.1.0 → v1.0.0   (grande étape)
 *
 * Ce que fait le script :
 *  1. incrémente VERSION dans sw.js si demandé, et la recopie dans js/version.js
 *     (le jeu l'affiche à la mairie) ;
 *  2. ajoute une section vide pour la nouvelle version dans CHANGELOG.md ;
 *  3. régénère PRECACHE (tous les fichiers du jeu) et BUILD (empreinte du contenu).
 *
 * Le workflow GitHub Pages lance le script sans argument : il ne touche jamais au numéro.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SW = join(ROOT, 'sw.js');
const INCLUDE = ['index.html', 'manifest.webmanifest', 'favicon.ico', 'css', 'js', 'assets', 'icons'];
const SKIP = [/\.DS_Store$/, /modele-perso-guide\.png$/, /screenshot-/];

/* ---------- 1. Numéro de version ---------- */
let sw = readFileSync(SW, 'utf8');
const current = (sw.match(/const VERSION = '(v\d+\.\d+\.\d+)'/) || [])[1];
if (!current) {
  console.error("sw.js : VERSION introuvable. Format attendu : const VERSION = 'v0.0.1';");
  process.exit(1);
}

const bump = process.argv[2];
let version = current;
if (bump) {
  if (!['patch', 'minor', 'major'].includes(bump)) {
    console.error(`Argument inconnu : « ${bump} ». Utiliser patch, minor ou major.`);
    process.exit(1);
  }
  let [ma, mi, pa] = current.slice(1).split('.').map(Number);
  if (bump === 'major') { ma++; mi = 0; pa = 0; }
  else if (bump === 'minor') { mi++; pa = 0; }
  else pa++;
  version = `v${ma}.${mi}.${pa}`;
}

// Recopie pour le jeu (seule source de vérité : sw.js)
writeFileSync(join(ROOT, 'js', 'version.js'),
  `/** Version du jeu, recopiée depuis sw.js par tools/build-sw.mjs : ne pas modifier à la main. */\nexport const VERSION = '${version}';\n`);

/* ---------- 2. Journal des versions ---------- */
const logPath = join(ROOT, 'CHANGELOG.md');
if (bump && existsSync(logPath)) {
  const log = readFileSync(logPath, 'utf8');
  if (!log.includes(`## ${version}`)) {
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(logPath, log.replace(/^(# .*\n+(?:[^#].*\n+)*)/, `$1## ${version} · ${date}\n\n- \n\n`));
  }
}

/* ---------- 3. Liste de cache et empreinte ---------- */
function walk(p) {
  const abs = join(ROOT, p);
  if (statSync(abs).isDirectory()) return readdirSync(abs).sort().flatMap(n => walk(join(p, n)));
  return SKIP.some(r => r.test(p)) ? [] : [p];
}
const files = INCLUDE.flatMap(walk).map(p => p.split(sep).join('/'));
const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(ROOT, f)));
const build = hash.digest('hex').slice(0, 10);

const block = `// <build>
const VERSION = '${version}';
const BUILD = '${build}';
const PRECACHE = [
${files.map(f => `  './${f}',`).join('\n')}
];
// </build>`;
sw = sw.replace(/\/\/ <build>[\s\S]*?\/\/ <\/build>/, block);
writeFileSync(SW, sw);

console.log(`sw.js : ${bump ? `${current} → ` : ''}${version} (build ${build}), ${files.length} fichiers en cache`);
if (bump) console.log('Pense à décrire les changements dans CHANGELOG.md.');
