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
