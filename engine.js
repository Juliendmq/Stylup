// Moteur d'image : chargement des photos, masque cheveux, recoloration, rendus de coupe.
import { colorOf } from './catalog.js?v=202611151420';

export const DEMO = {
  photo: 'assets/demo-original.jpg',
  mask: 'assets/demo-original-mask.png',
  // Rendus de coupe préparés pour la cliente de démonstration (images du fichier Figma).
  cuts: {
    'carre-plongeant': { photo: 'assets/demo-carre-plongeant.jpg', mask: 'assets/demo-carre-plongeant-mask.png' },
    pixie: { photo: 'assets/demo-pixie.jpg', mask: 'assets/demo-pixie-mask.png' },
  },
};

const loadImg = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image ' + src)); i.src = src; });

export function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// Photo choisie par l'utilisateur → canvas réduit (côté max 1024), orientation EXIF respectée.
export async function photoFromFile(file, max = 1024) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { const url = URL.createObjectURL(file); bmp = await loadImg(url); }
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = canvasOf(Math.round(bmp.width * k), Math.round(bmp.height * k));
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}
export async function canvasFromUrl(src) { const i = await loadImg(src); const c = canvasOf(i.naturalWidth, i.naturalHeight); c.getContext('2d').drawImage(i, 0, 0); return c; }

// Masque : canvas en niveaux de gris (blanc = cheveux), même taille que la photo.
export async function maskFromUrl(src, w, h) { const i = await loadImg(src); const c = canvasOf(w, h); c.getContext('2d').drawImage(i, 0, 0, w, h); return c; }

// ---------- détection automatique (fonctionne une fois l'app hébergée sur une vraie adresse) ----------
const VISION = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1';
const MODELS = {
  hair: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/latest/hair_segmenter.tflite',
  face: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite',
};
let visionP = null;
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error('timeout')), ms))]);
function vision() {
  if (!visionP) visionP = withTimeout((async () => {
    const lib = await import(/* @vite-ignore */ VISION + '/vision_bundle.mjs');
    const fs = await lib.FilesetResolver.forVisionTasks(VISION + '/wasm');
    const hair = await lib.ImageSegmenter.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELS.hair }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    const face = await lib.FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODELS.face }, runningMode: 'IMAGE' });
    return { hair, face };
  })(), 20000).catch(e => { console.warn('Détection automatique indisponible :', e.message); return null; });
  return visionP;
}
export async function autoAvailable() { return !!(await vision()); }

// Vérifie le cadrage : un seul visage, assez grand, à peu près centré. null = vérification impossible.
export async function checkFraming(photo) {
  const v = await vision(); if (!v) return null;
  const r = v.face.detect(photo); const d = r.detections || [];
  if (d.length !== 1) return { ok: false };
  const b = d[0].boundingBox; const cx = (b.originX + b.width / 2) / photo.width;
  return { ok: b.width / photo.width > 0.18 && cx > 0.25 && cx < 0.75 };
}
export async function autoHairMask(photo) {
  const v = await vision(); if (!v) return null;
  const r = v.hair.segment(photo); const m = r.confidenceMasks[r.confidenceMasks.length - 1];
  const f = m.getAsFloat32Array(); const c = canvasOf(m.width, m.height); const ctx = c.getContext('2d'); const d = ctx.createImageData(m.width, m.height);
  for (let i = 0; i < f.length; i++) { const v8 = Math.round(Math.max(0, Math.min(1, f[i])) * 255); d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v8; d.data[i * 4 + 3] = 255; }
  ctx.putImageData(d, 0, 0); r.confidenceMasks.forEach(x => x.close && x.close());
  const out = canvasOf(photo.width, photo.height); const o = out.getContext('2d'); o.filter = 'blur(1px)'; o.drawImage(c, 0, 0, out.width, out.height);
  return out;
}

// ---------- recoloration ----------
const toLin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const LUT = new Float32Array(256); for (let i = 0; i < 256; i++) LUT[i] = toLin(i);
const toSrgb = v => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);

// Applique la couleur (hauteur de ton + reflet) sur les zones du masque, en gardant les ombres et la texture.
export function recolor(photo, mask, toneId, refletId, intensity = 0.92) {
  const w = photo.width, h = photo.height;
  const out = canvasOf(w, h); const ctx = out.getContext('2d'); ctx.drawImage(photo, 0, 0);
  const img = ctx.getImageData(0, 0, w, h), px = img.data;
  const m = mask.getContext('2d').getImageData(0, 0, w, h).data;
  let sum = 0, cnt = 0;
  for (let i = 0; i < px.length; i += 4) { const a = m[i] / 255; if (a > 0.5) { sum += 0.2126 * LUT[px[i]] + 0.7152 * LUT[px[i + 1]] + 0.0722 * LUT[px[i + 2]]; cnt++; } }
  if (!cnt) return out;
  const mean = sum / cnt;
  const T = colorOf(toneId, refletId).map(toLin);
  const LT = 0.2126 * T[0] + 0.7152 * T[1] + 0.0722 * T[2];
  // plus la cible est claire par rapport à la base, plus on adoucit le contraste (cheveux éclaircis)
  const gamma = LT > mean ? 0.75 : 1;
  for (let i = 0; i < px.length; i += 4) {
    const a = (m[i] / 255) * intensity; if (a < 0.01) continue;
    const r = LUT[px[i]], g = LUT[px[i + 1]], b = LUT[px[i + 2]];
    let s = (0.2126 * r + 0.7152 * g + 0.0722 * b) / mean; s = Math.max(0.12, Math.min(2.6, Math.pow(s, gamma)));
    // chroma réduite dans les reflets de lumière, comme sur un vrai cheveu
    const Lo = LT * s, cf = 0.82 / (1 + 0.9 * Math.max(0, s - 1));
    for (let c = 0; c < 3; c++) {
      const orig = c === 0 ? r : c === 1 ? g : b;
      let v = Lo + (T[c] * s - Lo) * cf; v = Math.max(0, Math.min(1, v)) * 0.85 + orig * 0.15;
      px[i + c] = toSrgb(orig + (v - orig) * a);
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function thumb(canvas, max = 200, q = 0.75) {
  const k = Math.min(1, max / Math.max(canvas.width, canvas.height)); const c = canvasOf(Math.round(canvas.width * k), Math.round(canvas.height * k));
  c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q);
}
