// Ajoute un numéro de version aux fichiers chargés par l'app (styles, modules JS) pour que le navigateur
// ne garde jamais une ancienne version en cache après une mise à jour. À lancer avant chaque commit.
import { readFileSync, writeFileSync } from 'node:fs';
const v = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
const files = ['index.html', 'app.js', 'engine.js'];
for (const f of files) {
  const s = readFileSync(f, 'utf8')
    .replace(/((?:href|src)="(?:styles\.css|app\.js))(?:\?v=\w+)?"/g, `$1?v=${v}"`)
    .replace(/(from '\.\/(?:i18n|catalog|engine)\.js)(?:\?v=\w+)?'/g, `$1?v=${v}'`);
  writeFileSync(f, s);
}
console.log('version', v);
