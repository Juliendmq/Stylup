// Copie l'application web (à la racine du dépôt, servie aussi par GitHub Pages) dans www/ pour Capacitor.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const files = ['index.html', 'styles.css', 'app.js', 'i18n.js', 'catalog.js', 'engine.js', 'logo.js', 'manifest.webmanifest', 'icons', 'assets'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const f of files) cpSync(f, 'www/' + f, { recursive: true });
console.log('www/ prêt');
