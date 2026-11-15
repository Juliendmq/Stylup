// Catalogue coiffure : hauteurs de ton, reflets, coupes femme et homme.
// Chaque libellé est donné dans les 5 langues : [fr, en, it, es, de].
export const LANGS = ['fr', 'en', 'it', 'es', 'de'];
const L = (arr, lang) => arr[Math.max(0, LANGS.indexOf(lang))] || arr[0];
export const label = (item, lang) => L(item.name, lang);
export const describe = (item, lang) => (item.desc ? L(item.desc, lang) : '');

// Hauteurs de ton 1 à 10, couleur naturelle de référence (approximation, pas un nuancier de marque).
export const TONES = [
  { id: 1, hex: '#1c1714', name: ['Noir', 'Black', 'Nero', 'Negro', 'Schwarz'] },
  { id: 2, hex: '#2b201b', name: ['Brun', 'Darkest brown', 'Bruno', 'Moreno', 'Schwarzbraun'] },
  { id: 3, hex: '#3b2a21', name: ['Châtain foncé', 'Dark brown', 'Castano scuro', 'Castaño oscuro', 'Dunkelbraun'] },
  { id: 4, hex: '#4d3526', name: ['Châtain', 'Medium brown', 'Castano', 'Castaño', 'Mittelbraun'] },
  { id: 5, hex: '#65462f', name: ['Châtain clair', 'Light brown', 'Castano chiaro', 'Castaño claro', 'Hellbraun'] },
  { id: 6, hex: '#7f5c3e', name: ['Blond foncé', 'Dark blonde', 'Biondo scuro', 'Rubio oscuro', 'Dunkelblond'] },
  { id: 7, hex: '#9c7a55', name: ['Blond', 'Medium blonde', 'Biondo', 'Rubio', 'Mittelblond'] },
  { id: 8, hex: '#b9986f', name: ['Blond clair', 'Light blonde', 'Biondo chiaro', 'Rubio claro', 'Hellblond'] },
  { id: 9, hex: '#d2b88f', name: ['Blond très clair', 'Very light blonde', 'Biondo chiarissimo', 'Rubio muy claro', 'Lichtblond'] },
  { id: 10, hex: '#e6d4b0', name: ['Platine', 'Platinum blonde', 'Biondo platino', 'Rubio platino', 'Platinblond'] },
];

// Reflets : multiplicateurs RVB + désaturation, appliqués à la couleur de la hauteur de ton.
export const REFLETS = [
  { id: 0, temp: 'neutral', k: [1, 1, 1], desat: 0, name: ['Naturel', 'Natural', 'Naturale', 'Natural', 'Natur'] },
  { id: 1, temp: 'cold', k: [0.95, 0.98, 1.05], desat: 0.45, name: ['Cendré', 'Ash', 'Cenere', 'Ceniza', 'Asch'] },
  { id: 2, temp: 'cold', k: [1.0, 0.92, 1.03], desat: 0.25, name: ['Irisé', 'Iridescent', 'Irisé', 'Irisado', 'Irisé'] },
  { id: 3, temp: 'warm', k: [1.07, 1.0, 0.8], desat: -0.1, name: ['Doré', 'Golden', 'Dorato', 'Dorado', 'Gold'] },
  { id: 4, temp: 'warm', k: [1.16, 0.9, 0.7], desat: -0.2, name: ['Cuivré', 'Copper', 'Ramato', 'Cobrizo', 'Kupfer'] },
  { id: 5, temp: 'warm', k: [1.05, 0.78, 0.78], desat: -0.05, name: ['Acajou', 'Mahogany', 'Mogano', 'Caoba', 'Mahagoni'] },
  { id: 6, temp: 'warm', k: [1.22, 0.76, 0.68], desat: -0.25, name: ['Rouge', 'Red', 'Rosso', 'Rojo', 'Rot'] },
  { id: 7, temp: 'cold', k: [0.97, 1.0, 0.86], desat: 0.35, name: ['Mat', 'Matte', 'Opaco', 'Mate', 'Matt'] },
  { id: 8, temp: 'cold', k: [0.99, 0.97, 1.02], desat: 0.5, name: ['Perlé', 'Pearl', 'Perlato', 'Perla', 'Perl'] },
];

const LEN_F = {
  tc: { name: ['Très court', 'Very short', 'Cortissimo', 'Muy corto', 'Sehr kurz'], desc: ['Au-dessus des oreilles', 'Above the ears', 'Sopra le orecchie', 'Por encima de las orejas', 'Über den Ohren'] },
  c: { name: ['Court', 'Short', 'Corto', 'Corto', 'Kurz'], desc: ['Au niveau du menton', 'At chin level', "All'altezza del mento", 'A la altura del mentón', 'Auf Kinnhöhe'] },
  ml: { name: ['Mi-long', 'Medium', 'Medio', 'Media melena', 'Mittellang'], desc: ['Aux épaules', 'At the shoulders', 'Alle spalle', 'A los hombros', 'Schulterlang'] },
  l: { name: ['Long', 'Long', 'Lungo', 'Largo', 'Lang'], desc: ['Aux omoplates', 'To the shoulder blades', 'Alle scapole', 'A los omóplatos', 'Bis zu den Schulterblättern'] },
  tl: { name: ['Très long', 'Very long', 'Lunghissimo', 'Muy largo', 'Sehr lang'], desc: ['Au milieu du dos', 'Mid-back', 'A metà schiena', 'A media espalda', 'Bis zur Rückenmitte'] },
};
const SHAPE_F = {
  'carre-droit': { allow: ['c', 'ml'], name: ['Carré droit', 'Blunt bob', 'Caschetto pari', 'Bob recto', 'Gerader Bob'], desc: ['Ligne nette, même longueur partout', 'Clean line, same length all round', 'Linea netta, stessa lunghezza', 'Línea limpia, mismo largo', 'Klare Linie, überall gleich lang'] },
  'carre-plongeant': { allow: ['c', 'ml'], name: ['Carré plongeant', 'A-line bob', 'Caschetto a punta', 'Bob en punta', 'A-Linien-Bob'], desc: ['Plus long devant que derrière', 'Longer at the front than the back', 'Più lungo davanti che dietro', 'Más largo delante que detrás', 'Vorne länger als hinten'] },
  lob: { allow: ['ml'], name: ['Carré long (lob)', 'Lob (long bob)', 'Long bob', 'Long bob', 'Long Bob'], desc: ['Effleure les épaules', 'Grazes the shoulders', 'Sfiora le spalle', 'Roza los hombros', 'Streift die Schultern'] },
  degrade: { allow: ['ml', 'l', 'tl'], name: ['Dégradé effilé', 'Long layers', 'Scalato sfilato', 'Degradado desfilado', 'Stufenschnitt'], desc: ['Volume et mouvement, pointes allégées', 'Volume and movement, lighter ends', 'Volume e movimento, punte alleggerite', 'Volumen y movimiento, puntas ligeras', 'Volumen und Bewegung, leichte Spitzen'] },
  shag: { allow: ['c', 'ml', 'l'], name: ['Shag', 'Shag', 'Shag', 'Shag', 'Shag'], desc: ['Dégradé marqué, effet décoiffé', 'Strong layers, tousled look', 'Scalato deciso, effetto spettinato', 'Capas marcadas, efecto despeinado', 'Starke Stufen, zerzauster Look'] },
  wolf: { allow: ['ml', 'l'], name: ['Wolf cut', 'Wolf cut', 'Wolf cut', 'Wolf cut', 'Wolf Cut'], desc: ['Volume sur le dessus, longueurs effilées', 'Volume on top, thinned lengths', 'Volume in alto, lunghezze sfilate', 'Volumen arriba, largos desfilados', 'Volumen oben, ausgedünnte Längen'] },
  pixie: { allow: ['tc'], name: ['Pixie', 'Pixie', 'Pixie', 'Pixie', 'Pixie'], desc: ['Très court, nuque dégagée', 'Very short, open neckline', 'Cortissimo, nuca scoperta', 'Muy corto, nuca despejada', 'Sehr kurz, freier Nacken'] },
};
const FRINGE_F = {
  sans: { name: ['Sans frange', 'No fringe', 'Senza frangia', 'Sin flequillo', 'Kein Pony'], desc: ['Front dégagé', 'Forehead clear', 'Fronte scoperta', 'Frente despejada', 'Freie Stirn'] },
  droite: { name: ['Droite', 'Blunt fringe', 'Dritta', 'Recto', 'Gerader Pony'], desc: ['Ligne nette au-dessus des sourcils', 'Clean line above the brows', 'Linea netta sopra le sopracciglia', 'Línea limpia sobre las cejas', 'Klare Linie über den Brauen'] },
  rideau: { name: ['Rideau', 'Curtain fringe', 'A tendina', 'Cortina', 'Curtain Bangs'], desc: ['Ouverte au milieu, encadre le visage', 'Parted in the middle, frames the face', 'Aperta al centro, incornicia il viso', 'Abierto al centro, enmarca el rostro', 'Mittig geteilt, umrahmt das Gesicht'] },
  effilee: { name: ['Effilée', 'Wispy fringe', 'Sfilata', 'Desfilado', 'Fransiger Pony'], desc: ['Légère, mèches irrégulières', 'Light, uneven strands', 'Leggera, ciocche irregolari', 'Ligero, mechones irregulares', 'Leicht, unregelmäßige Strähnen'] },
  cote: { name: ['Sur le côté', 'Side-swept', 'Laterale', 'De lado', 'Seitlicher Pony'], desc: ["Balayée d'un côté", 'Swept to one side', 'Portata di lato', 'Peinado hacia un lado', 'Zur Seite gekämmt'] },
};
const SIDES_H = {
  ciseaux: { name: ['Aux ciseaux', 'Scissor cut', 'A forbice', 'A tijera', 'Mit der Schere'], desc: ['Pas de dégradé, côtés coupés aux ciseaux', 'No fade, sides cut with scissors', 'Nessuna sfumatura, lati a forbice', 'Sin degradado, lados a tijera', 'Kein Fade, Seiten mit der Schere'] },
  taper: { name: ['Taper', 'Taper', 'Taper', 'Taper', 'Taper'], desc: ['Dégradé discret aux pattes et à la nuque', 'Subtle fade at sideburns and neckline', 'Sfumatura leggera su basette e nuca', 'Degradado suave en patillas y nuca', 'Dezenter Übergang an Koteletten und Nacken'] },
  low: { name: ['Dégradé bas', 'Low fade', 'Sfumatura bassa', 'Degradado bajo', 'Low Fade'], desc: ['Démarre juste au-dessus des oreilles', 'Starts just above the ears', 'Parte appena sopra le orecchie', 'Empieza justo encima de las orejas', 'Beginnt knapp über den Ohren'] },
  mid: { name: ['Dégradé mi-hauteur', 'Mid fade', 'Sfumatura media', 'Degradado medio', 'Mid Fade'], desc: ['Démarre au niveau des tempes', 'Starts at the temples', "Parte all'altezza delle tempie", 'Empieza a la altura de las sienes', 'Beginnt auf Schläfenhöhe'] },
  high: { name: ['Dégradé haut', 'High fade', 'Sfumatura alta', 'Degradado alto', 'High Fade'], desc: ['Démarre en haut des tempes, contraste marqué', 'Starts high on the temples, strong contrast', 'Parte in alto sulle tempie, contrasto marcato', 'Empieza alto en las sienes, contraste marcado', 'Beginnt oben an den Schläfen, starker Kontrast'] },
  skin: { name: ['Dégradé à blanc', 'Skin fade', 'Sfumatura a zero', 'Degradado a piel', 'Skin Fade'], desc: ["Rasé jusqu'à la peau en bas", 'Shaved to the skin at the bottom', 'Rasato a pelle in basso', 'Rapado a piel abajo', 'Unten bis auf die Haut rasiert'] },
};
const TOP_H = {
  tc: { name: ['Très court', 'Very short', 'Cortissimo', 'Muy corto', 'Sehr kurz'], desc: ['À la tondeuse, même longueur partout', 'Clipper cut, same length all over', 'A macchinetta, stessa lunghezza', 'A máquina, mismo largo', 'Mit der Maschine, überall gleich lang'] },
  c: { name: ['Court', 'Short', 'Corto', 'Corto', 'Kurz'], desc: ['Quelques centimètres, peu de coiffage', 'A few centimetres, little styling', 'Pochi centimetri, poco styling', 'Unos centímetros, poco peinado', 'Wenige Zentimeter, kaum Styling'] },
  m: { name: ['Moyen', 'Medium', 'Medio', 'Medio', 'Mittel'], desc: ['Assez long pour se coiffer en volume', 'Long enough to style with volume', 'Abbastanza lungo per dare volume', 'Suficiente para peinar con volumen', 'Lang genug für Volumen'] },
  l: { name: ['Long', 'Long', 'Lungo', 'Largo', 'Lang'], desc: ['Couvre le front, effet mi-long', 'Covers the forehead, mid-length look', 'Copre la fronte, effetto medio', 'Cubre la frente, efecto media melena', 'Bedeckt die Stirn, mittellanger Look'] },
};
const STYLE_H = {
  crop: { allow: ['tc', 'c'], name: ['Crop texturé', 'Textured crop', 'Crop texturizzato', 'Crop texturizado', 'Texturierter Crop'], desc: ['Frange courte, texture sur le dessus', 'Short fringe, texture on top', 'Frangia corta, texture in alto', 'Flequillo corto, textura arriba', 'Kurzer Pony, Textur oben'] },
  crew: { allow: ['tc', 'c'], name: ['Crew cut', 'Crew cut', 'Crew cut', 'Crew cut', 'Crew Cut'], desc: ['Un peu plus long devant, net et court', 'A bit longer at the front, neat and short', "Un po' più lungo davanti, corto e ordinato", 'Algo más largo delante, corto y limpio', 'Vorne etwas länger, kurz und ordentlich'] },
  side: { allow: ['c', 'm'], name: ['Raie sur le côté', 'Side part', 'Riga laterale', 'Raya al lado', 'Seitenscheitel'], desc: ['Classique, raie marquée', 'Classic, defined parting', 'Classico, riga definita', 'Clásico, raya marcada', 'Klassisch, klarer Scheitel'] },
  quiff: { allow: ['c', 'm'], name: ['Quiff court', 'Short quiff', 'Ciuffo corto', 'Tupé corto', 'Kurze Tolle'], desc: ["Petit volume relevé vers l'avant", 'Small lift towards the front', 'Piccolo volume sollevato in avanti', 'Pequeño volumen hacia delante', 'Kleines Volumen nach vorn'] },
  buzz: { allow: ['tc'], name: ['Buzz cut', 'Buzz cut', 'Buzz cut', 'Buzz cut', 'Buzz Cut'], desc: ['Même longueur partout, à la tondeuse', 'Same length all over, clipper cut', 'Stessa lunghezza ovunque, a macchinetta', 'Mismo largo, a máquina', 'Überall gleich lang, mit der Maschine'] },
  pomp: { allow: ['m', 'l'], name: ['Pompadour', 'Pompadour', 'Pompadour', 'Pompadour', 'Pompadour'], desc: ['Volume relevé et plaqué en arrière', 'Lifted volume, swept back', "Volume sollevato all'indietro", 'Volumen elevado hacia atrás', 'Hochgestelltes Volumen nach hinten'] },
  slick: { allow: ['m', 'l'], name: ['Slick back', 'Slick back', 'Slick back', 'Slick back', 'Slick Back'], desc: ['Coiffé en arrière, effet net', 'Combed back, sleek finish', "Pettinato all'indietro, effetto pulito", 'Peinado hacia atrás, efecto pulido', 'Nach hinten gekämmt, glatter Look'] },
};
const withIds = o => Object.entries(o).map(([id, v]) => ({ id, ...v }));

// Un « jeu » de coupe = 3 critères. dependsOn : le critère dont dépend la compatibilité.
export const CUT_SETS = {
  f: [
    { key: 'length', icon: 'len', options: withIds(LEN_F) },
    { key: 'shape', icon: 'cut', options: withIds(SHAPE_F), dependsOn: 'length', required: true },
    { key: 'fringe', icon: 'fr', options: withIds(FRINGE_F), optional: true },
  ],
  h: [
    { key: 'sides', icon: 'clip', options: withIds(SIDES_H) },
    { key: 'top', icon: 'len', options: withIds(TOP_H) },
    { key: 'style', icon: 'comb', options: withIds(STYLE_H), dependsOn: 'top', required: true },
  ],
};
CUT_SETS.f[0].required = true;
CUT_SETS.h[0].required = true;
CUT_SETS.h[1].required = true;

export const isAllowed = (field, option, cut) => {
  if (!field.dependsOn || !option.allow) return true;
  const v = cut[field.dependsOn];
  return !v || option.allow.includes(v);
};
export const findOpt = (set, key, id) => CUT_SETS[set].find(f => f.key === key).options.find(o => o.id === id);

// ---------- couleurs ----------
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export function colorOf(toneId, refletId = 0) {
  const base = hex2rgb(TONES.find(t => t.id === toneId).hex);
  const r = REFLETS.find(x => x.id === refletId) || REFLETS[0];
  let c = base.map((v, i) => v * r.k[i]);
  const g = (c[0] + c[1] + c[2]) / 3;
  c = c.map(v => v + (g - v) * r.desat);
  // garde la clarté de la hauteur de ton (un reflet ne change pas la hauteur)
  const lum = x => 0.2126 * x[0] + 0.7152 * x[1] + 0.0722 * x[2];
  const s = lum(base) / Math.max(1, lum(c));
  return c.map(v => Math.max(0, Math.min(255, v * (r.temp === 'warm' ? s * 1.03 : r.temp === 'cold' ? s * 0.98 : s))));
}
// Dégradé « mèche » pour les pastilles.
export function lockGradient(rgb) {
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
  const hi = mix(rgb, [255, 248, 230], 0.18), lo = mix(rgb, [12, 8, 5], 0.26);
  return `linear-gradient(180deg, ${rgb2hex(hi)} 0%, ${rgb2hex(rgb)} 45%, ${rgb2hex(lo)} 100%)`;
}

// Coupes ajoutées par le salon : rangées dans le champ principal de chaque jeu (forme pour femme, style pour homme).
export const CUSTOM_FIELD = { f: 'shape', h: 'style' };
export function applyCustomCuts(cuts) {
  for (const set of ['f', 'h']) {
    const field = CUT_SETS[set].find(x => x.key === CUSTOM_FIELD[set]);
    field.options = field.options.filter(o => !o.custom).concat((cuts && cuts[set] || []).map(c => ({
      id: c.id, custom: true, name: Array(5).fill(c.name), desc: c.desc ? Array(5).fill(c.desc) : null,
    })));
  }
}
// Code coloriste d'une couleur : hauteur.reflet, ex. 7.4
export const colorCode = (tone, r1 = 0) => `${tone}.${r1 ?? 0}`;
