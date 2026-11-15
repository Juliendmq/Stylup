# Stylup — prototype coiffure

Application web mobile (iOS et Android, dans le navigateur) qui montre au client le rendu d'une prestation avant de la réaliser.

## Ce que fait ce prototype

- Parcours pro complet : accueil, client, prestation (coupe et/ou couleur), accord, photo, choix, aperçu, résultat, rendu retenu, note après prestation.
- Couleur appliquée sur les cheveux (hauteur de ton 1 à 10 + reflet), calculée sur l'appareil.
- Détection automatique des cheveux et du cadrage (MediaPipe) quand la page est servie depuis une vraie adresse ; sinon, détourage au doigt.
- Coupe : rendus de démonstration pour la cliente d'exemple ; le rendu génératif reste à brancher.
- 5 langues : FR, EN, IT, ES, DE.
- Les sessions restent dans le navigateur de l'appareil.

## Lancer en local

Aucune dépendance à installer : servir le dossier avec un serveur statique, par exemple

    python3 -m http.server 8080

puis ouvrir http://localhost:8080.

## Structure

- `index.html`, `styles.css` : page et thème (repris des maquettes Figma V2)
- `app.js` : écrans et parcours
- `catalog.js` : hauteurs de ton, reflets, coupes femme et homme
- `engine.js` : photo, masque cheveux, recoloration, rendus de coupe
- `i18n.js` : textes de l'interface
- `assets/` : photos de démonstration et masques précalculés

## Applications iOS et Android

Le même code est emballé en application native avec [Capacitor](https://capacitorjs.com) (dossiers `android/` et `ios/`).

- **Android** : à chaque envoi sur `main`, GitHub Actions compile un APK de test et le publie dans la version « android-test » (onglet Releases). Sur le téléphone : télécharger `Stylup.apk`, autoriser l'installation depuis cette source, installer.
- **iOS** : ouvrir `ios/App/App.xcodeproj` dans Xcode sur un Mac (`npm install && npm run sync` d'abord), choisir son équipe de signature, brancher l'iPhone et lancer. Une distribution par TestFlight demande un compte Apple Developer.

Commandes utiles :

    npm install
    npm run sync          # copie l'app web dans www/ et met à jour android/ et ios/
    npx cap open android  # ouvre Android Studio
    npx cap open ios      # ouvre Xcode
