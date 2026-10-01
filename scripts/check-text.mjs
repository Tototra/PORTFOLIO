// Vérifie les règles d'écriture du site : pas de tiret long (— ou –) et pas d'emoji.
// Lancer : npm run lint:text  (la CI le lance aussi avant chaque déploiement)

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src', 'index.html'];
const DASH = /[–—]/;
const EMOJI = /\p{Extended_Pictographic}/u;
// Flèches et symboles typographiques autorisés (ils ne sont pas des emoji dans le rendu)
const ALLOWED = /[←-⇿©™]/g;

function* files(path) {
  if (statSync(path).isDirectory()) {
    for (const f of readdirSync(path)) yield* files(join(path, f));
  } else if (/\.(ts|html|css)$/.test(path)) {
    yield path;
  }
}

let problems = 0;
for (const root of ROOTS) {
  for (const file of files(root)) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      const clean = line.replace(ALLOWED, '');
      if (DASH.test(clean)) {
        problems++;
        console.log(`${file}:${i + 1}  tiret long : ${line.trim().slice(0, 90)}`);
      }
      if (EMOJI.test(clean)) {
        problems++;
        console.log(`${file}:${i + 1}  emoji : ${line.trim().slice(0, 90)}`);
      }
    });
  }
}

if (problems) {
  console.log(`\n${problems} problème(s). Remplacer les tirets longs par une virgule, deux-points ou des parenthèses.`);
  process.exit(1);
}
console.log('Texte OK : aucun tiret long, aucun emoji.');
