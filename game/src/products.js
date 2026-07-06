import * as THREE from 'three';

// ============================================================ PACKAGING ART
// Products read as real because of printed labels. We *design* them on a canvas
// — color blocking, brand wordmark, a product-shot window, barcode, weight —
// then wrap them as sRGB textures. Fake brands, real graphic-design language.
const FONTS = 'Arial, "Helvetica Neue", Helvetica, sans-serif';
const _texCache = new Map();

function rr(x, X, Y, w, h, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}

function barcode(x, X, Y, w, h) {
  x.fillStyle = '#fff'; x.fillRect(X - 6, Y - 5, w + 12, h + 20);
  x.fillStyle = '#111';
  const widths = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 2, 3, 1, 2, 4, 1, 3, 1, 2, 2, 1];
  let cx = X;
  for (let i = 0; cx < X + w; i++) { const bw = widths[i % widths.length]; if (i % 2 === 0) x.fillRect(cx, Y, bw, h); cx += bw + 1; }
  x.fillStyle = '#111'; x.textAlign = 'left'; x.font = `10px ${FONTS}`;
  x.fillText('7 03041 20399 5', X, Y + h + 13);
}

function wrap(x, text, cx, y, maxW, lh) {
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line);
  const s = y - (lines.length - 1) * lh * 0.5;
  lines.forEach((l, i) => x.fillText(l, cx, s + i * lh));
}

// Front-of-pack art. `wrapAround` widens the canvas for cylinder (can) labels.
function labelTexture(spec, wrapAround = false) {
  const key = spec.id + (wrapAround ? '_w' : '');
  if (_texCache.has(key)) return _texCache.get(key);
  const W = wrapAround ? 1024 : 512;
  const H = wrapAround ? 420 : (spec.kind === 'bag' ? 512 : 640);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const { brand, name, bg1, bg2, ink = '#fff', accent = '#ffcc33', tag = '' } = spec;

  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, bg1); g.addColorStop(1, bg2);
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = accent; x.fillRect(0, 0, W, 14); x.fillRect(0, H - 14, W, 14);

  x.textAlign = 'center'; x.fillStyle = ink;
  x.font = `700 ${W * (wrapAround ? 0.055 : 0.11)}px ${FONTS}`;
  x.fillText(brand.toUpperCase(), W / 2, H * 0.15);
  x.strokeStyle = accent; x.lineWidth = 4;
  x.beginPath(); x.moveTo(W * 0.22, H * 0.185); x.lineTo(W * 0.78, H * 0.185); x.stroke();

  const py = H * 0.24, ph = H * 0.4;
  x.fillStyle = 'rgba(255,255,255,0.15)'; rr(x, W * 0.13, py, W * 0.74, ph, 22); x.fill();
  x.fillStyle = accent;
  for (let i = 0; i < 3; i++) { x.globalAlpha = 0.85; x.beginPath(); x.arc(W * (0.31 + i * 0.19), py + ph * 0.5, ph * 0.15, 0, Math.PI * 2); x.fill(); }
  x.globalAlpha = 1;

  x.fillStyle = ink; x.font = `800 ${W * (wrapAround ? 0.07 : 0.13)}px ${FONTS}`;
  wrap(x, name.toUpperCase(), W / 2, H * 0.75, W * 0.86, H * 0.11);
  if (tag) { x.font = `500 ${W * 0.045}px ${FONTS}`; x.fillStyle = accent; x.fillText(tag, W / 2, H * 0.85); }

  barcode(x, W * 0.1, H * 0.9, W * 0.4, H * 0.045);
  x.fillStyle = ink; x.textAlign = 'right'; x.font = `700 ${W * 0.055}px ${FONTS}`;
  x.fillText(spec.weight || '500 g', W * 0.9, H * 0.94);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  _texCache.set(key, t);
  return t;
}

// ============================================================ PRODUCT CATALOG
// [id, brand, name, kind, bg1, bg2, accent, ink?, tag?, section]
export const PRODUCTS = [
  { id: 'cereal_oat', brand: 'Northfield', name: 'Honey Oats', kind: 'box', bg1: '#e8a020', bg2: '#c6741a', accent: '#5a2d00', ink: '#fff', tag: 'Whole Grain', section: 'pantry', weight: '450 g' },
  { id: 'cereal_flake', brand: 'Sunrise', name: 'Corn Flakes', kind: 'box', bg1: '#e23b2e', bg2: '#a51f16', accent: '#ffd23b', section: 'pantry', weight: '500 g' },
  { id: 'cracker', brand: 'Harvest', name: 'Sea Salt Crackers', kind: 'box', bg1: '#3a7d44', bg2: '#245230', accent: '#ffe08a', section: 'pantry', weight: '250 g' },
  { id: 'pasta', brand: 'Bella', name: 'Penne Rigate', kind: 'box', bg1: '#1d64b8', bg2: '#123f75', accent: '#ffcf33', section: 'pantry', weight: '500 g' },

  { id: 'soup', brand: 'Kettle Co', name: 'Tomato Soup', kind: 'can', bg1: '#d23324', bg2: '#8f1c12', accent: '#f4e3c1', section: 'pantry', weight: '400 g' },
  { id: 'beans', brand: 'Kettle Co', name: 'Baked Beans', kind: 'can', bg1: '#1f7ac2', bg2: '#12507f', accent: '#ffcf33', section: 'pantry', weight: '415 g' },
  { id: 'corn', brand: 'Golden', name: 'Sweet Corn', kind: 'can', bg1: '#f2b800', bg2: '#c48f00', accent: '#2e7d32', ink: '#3a2a00', section: 'pantry', weight: '340 g' },

  { id: 'chips', brand: 'Crunch', name: 'Sea Salt Chips', kind: 'bag', bg1: '#2fae6a', bg2: '#1c6f43', accent: '#fff2b0', section: 'snacks', weight: '150 g' },
  { id: 'chips_bbq', brand: 'Crunch', name: 'BBQ Chips', kind: 'bag', bg1: '#c0392b', bg2: '#7c231a', accent: '#ffd23b', section: 'snacks', weight: '150 g' },
  { id: 'pretzel', brand: 'Twist', name: 'Salted Pretzels', kind: 'bag', bg1: '#8a5a2b', bg2: '#5c3a1a', accent: '#ffe08a', section: 'snacks', weight: '200 g' },

  { id: 'milk', brand: 'Meadow', name: 'Whole Milk', kind: 'carton', bg1: '#f4f7fb', bg2: '#d7e4f2', accent: '#1f6fc2', ink: '#123a63', section: 'dairy', weight: '1 L' },
  { id: 'juice', brand: 'Grove', name: 'Orange Juice', kind: 'carton', bg1: '#ff9a1f', bg2: '#e0700d', accent: '#fff', ink: '#5a2d00', section: 'dairy', weight: '1 L' },
];

// ============================================================ MESH FACTORIES
function boxProduct(spec, w, h, d) {
  const face = new THREE.MeshStandardMaterial({ map: labelTexture(spec), roughness: 0.82, metalness: 0 });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.bg2), roughness: 0.85, metalness: 0 });
  // BoxGeometry material order: +x,-x,+y,-y,+z,-z  → label on front(+z) & back(-z)
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, face]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function canProduct(spec, r, h) {
  const label = new THREE.MeshStandardMaterial({ map: labelTexture(spec, true), roughness: 0.35, metalness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xd7dde3, roughness: 0.3, metalness: 0.95 });
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1), [label, metal, metal]);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function bagProduct(spec, w, h, d) {
  const mat = new THREE.MeshStandardMaterial({ map: labelTexture(spec), roughness: 0.22, metalness: 0.15, envMapIntensity: 1.3 });
  const back = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.bg2), roughness: 0.22, metalness: 0.15 });
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  // pillow the bag: pull front/back faces out a touch
  const m = new THREE.Mesh(g, [back, back, back, back, mat, back]);
  m.scale.set(1, 1, 1); m.castShadow = m.receiveShadow = true;
  return m;
}

function cartonProduct(spec, w, h, d) {
  const face = new THREE.MeshStandardMaterial({ map: labelTexture(spec), roughness: 0.5, metalness: 0 });
  const side = new THREE.MeshStandardMaterial({ color: new THREE.Color(spec.bg2), roughness: 0.55, metalness: 0 });
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.78, d), [side, side, side, side, face, face]);
  body.position.y = h * 0.39; body.castShadow = body.receiveShadow = true; g.add(body);
  // gable top
  const topH = h * 0.22;
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, topH, d), side);
  top.position.y = h * 0.78 + topH * 0.5; top.scale.z = 0.4; top.castShadow = true; g.add(top);
  return g;
}

// Build one product mesh (already sized for a shelf). Returns a Group/Mesh whose
// origin sits on the shelf surface (y=0 at its base).
export function buildProduct(spec) {
  let obj, half;
  switch (spec.kind) {
    case 'can': { const h = 0.15, r = 0.045; obj = canProduct(spec, r, h); obj.position.y = h / 2; half = h; break; }
    case 'bag': { const w = 0.16, h = 0.22, d = 0.06; obj = bagProduct(spec, w, h, d); obj.position.y = h / 2; half = h; break; }
    case 'carton': { const w = 0.09, h = 0.24, d = 0.09; obj = cartonProduct(spec, w, h, d); half = h; break; }
    default: { const w = 0.15, h = 0.24, d = 0.07; obj = boxProduct(spec, w, h, d); obj.position.y = h / 2; half = h; break; }
  }
  const g = new THREE.Group(); g.add(obj); g.userData = { spec, height: half };
  return g;
}
