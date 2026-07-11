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

// Front-of-pack art. `wrapAround` widens the canvas for cylinder labels.
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

// Shelf-edge price tag (per SKU, cached).
export function priceTagTexture(spec) {
  const key = 'tag_' + spec.id;
  if (_texCache.has(key)) return _texCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = '#fdfdf6'; x.fillRect(0, 0, 256, 96);
  x.fillStyle = '#111'; x.textAlign = 'left';
  x.font = `500 17px ${FONTS}`; x.fillText(spec.name, 12, 26);
  x.font = `800 44px ${FONTS}`; x.fillText('$' + spec.price.toFixed(2), 12, 74);
  x.fillStyle = '#c9241a'; x.fillRect(200, 0, 56, 96);
  x.fillStyle = '#fff'; x.save(); x.translate(228, 48); x.rotate(-Math.PI / 2);
  x.textAlign = 'center'; x.font = `700 15px ${FONTS}`; x.fillText('EVERYDAY', 0, 5); x.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  _texCache.set(key, t);
  return t;
}

// ============================================================ PRODUCT CATALOG
export const PRODUCTS = [
  // pantry
  { id: 'cereal_oat', brand: 'Northfield', name: 'Honey Oats', kind: 'box', price: 4.29, bg1: '#e8a020', bg2: '#c6741a', accent: '#5a2d00', tag: 'Whole Grain', section: 'pantry', weight: '450 g' },
  { id: 'cereal_flake', brand: 'Sunrise', name: 'Corn Flakes', kind: 'box', price: 3.89, bg1: '#e23b2e', bg2: '#a51f16', accent: '#ffd23b', section: 'pantry', weight: '500 g' },
  { id: 'pasta', brand: 'Bella', name: 'Penne Rigate', kind: 'box', price: 1.79, bg1: '#1d64b8', bg2: '#123f75', accent: '#ffcf33', section: 'pantry', weight: '500 g' },
  { id: 'sauce', brand: "Nonna's", name: 'Marinara', kind: 'jar', price: 3.49, bg1: '#b02318', bg2: '#7c150d', accent: '#f4e3c1', section: 'pantry', weight: '680 g' },
  { id: 'pb', brand: 'Nutty', name: 'Peanut Butter', kind: 'jar', price: 4.99, bg1: '#a5692a', bg2: '#71431a', accent: '#ffe08a', section: 'pantry', weight: '454 g' },
  { id: 'soup', brand: 'Kettle Co', name: 'Tomato Soup', kind: 'can', price: 1.49, bg1: '#d23324', bg2: '#8f1c12', accent: '#f4e3c1', section: 'pantry', weight: '400 g' },
  { id: 'beans', brand: 'Kettle Co', name: 'Baked Beans', kind: 'can', price: 1.29, bg1: '#1f7ac2', bg2: '#12507f', accent: '#ffcf33', section: 'pantry', weight: '415 g' },
  { id: 'corn', brand: 'Golden', name: 'Sweet Corn', kind: 'can', price: 0.99, bg1: '#f2b800', bg2: '#c48f00', accent: '#2e7d32', ink: '#3a2a00', section: 'pantry', weight: '340 g' },
  { id: 'ketchup', brand: 'Reddy', name: 'Tomato Ketchup', kind: 'bottle', price: 2.79, bg1: '#c8231b', bg2: '#8a1610', accent: '#fff', section: 'pantry', weight: '567 g' },

  // snacks
  { id: 'chips', brand: 'Crunch', name: 'Sea Salt Chips', kind: 'bag', price: 2.99, bg1: '#2fae6a', bg2: '#1c6f43', accent: '#fff2b0', section: 'snacks', weight: '150 g' },
  { id: 'chips_bbq', brand: 'Crunch', name: 'BBQ Chips', kind: 'bag', price: 2.99, bg1: '#c0392b', bg2: '#7c231a', accent: '#ffd23b', section: 'snacks', weight: '150 g' },
  { id: 'pretzel', brand: 'Twist', name: 'Salted Pretzels', kind: 'bag', price: 2.49, bg1: '#8a5a2b', bg2: '#5c3a1a', accent: '#ffe08a', section: 'snacks', weight: '200 g' },
  { id: 'cookies', brand: 'Oven Joy', name: 'Choco Chunk', kind: 'box', price: 3.29, bg1: '#4a2c8f', bg2: '#2e1a5e', accent: '#ffb84d', section: 'snacks', weight: '300 g' },
  { id: 'gummies', brand: 'Chewy', name: 'Gummy Bears', kind: 'bag', price: 1.99, bg1: '#e0447a', bg2: '#9e2752', accent: '#ffe9f2', section: 'snacks', weight: '180 g' },
  { id: 'cola', brand: 'Fizz', name: 'Cola Classic', kind: 'bottle', price: 1.89, bg1: '#3a2015', bg2: '#1e0f08', accent: '#e02b20', section: 'snacks', weight: '2 L' },
  { id: 'water', brand: 'Alpine', name: 'Spring Water', kind: 'bottle', price: 0.99, bg1: '#2a7fc9', bg2: '#175a96', accent: '#eaf6ff', section: 'snacks', weight: '1.5 L' },

  // household
  { id: 'tp', brand: 'CloudSoft', name: 'Bath Tissue 4pk', kind: 'boxwide', price: 5.49, bg1: '#eef3f8', bg2: '#c9d9ea', accent: '#2a6fc0', ink: '#173a63', section: 'household', weight: '4 rolls' },
  { id: 'detergent', brand: 'Wave', name: 'Laundry Power', kind: 'boxtall', price: 8.99, bg1: '#1a9e8f', bg2: '#0f6a60', accent: '#ffd23b', section: 'household', weight: '1.8 kg' },
  { id: 'tissues', brand: 'CloudSoft', name: 'Facial Tissues', kind: 'boxwide', price: 2.29, bg1: '#7fb7e0', bg2: '#4c86b3', accent: '#fff', section: 'household', weight: '120 ct' },
  { id: 'soapbar', brand: 'Pure', name: 'Soap Bars 3pk', kind: 'box', price: 3.19, bg1: '#e8e0f4', bg2: '#c3b3e4', accent: '#6a3fb5', ink: '#3c2470', section: 'household', weight: '3 × 90 g' },

  // dairy
  { id: 'milk', brand: 'Meadow', name: 'Whole Milk', kind: 'carton', price: 2.59, bg1: '#f4f7fb', bg2: '#d7e4f2', accent: '#1f6fc2', ink: '#123a63', section: 'dairy', weight: '1 L' },
  { id: 'juice', brand: 'Grove', name: 'Orange Juice', kind: 'carton', price: 3.49, bg1: '#ff9a1f', bg2: '#e0700d', accent: '#fff', ink: '#5a2d00', section: 'dairy', weight: '1 L' },
  { id: 'yogurt', brand: 'Meadow', name: 'Greek Yogurt', kind: 'cup', price: 1.19, bg1: '#f7f3ec', bg2: '#e2d7c3', accent: '#3a7d44', ink: '#2b4a31', section: 'dairy', weight: '150 g' },
  { id: 'cheese', brand: 'Dale', name: 'Cheddar Block', kind: 'box', price: 4.79, bg1: '#f2a71b', bg2: '#c07d10', accent: '#7a4a00', ink: '#402800', section: 'dairy', weight: '400 g' },

  // bakery
  { id: 'bread', brand: 'Hearth', name: 'Country Loaf', kind: 'bag', price: 2.89, bg1: '#d8a45c', bg2: '#a3743a', accent: '#5c3a1a', ink: '#3d2610', section: 'bakery', weight: '650 g' },
  { id: 'muffins', brand: 'Hearth', name: 'Blueberry Muffins', kind: 'box', price: 4.49, bg1: '#4a5fb8', bg2: '#2c3a78', accent: '#ffd23b', section: 'bakery', weight: '4 ct' },

  // frozen (inside glass-door cases)
  { id: 'pizza', brand: 'Stonefire', name: 'Margherita Pizza', kind: 'boxwide', price: 5.99, bg1: '#b02318', bg2: '#701009', accent: '#ffe08a', section: 'frozen', weight: '390 g' },
  { id: 'icecream', brand: 'Polar', name: 'Vanilla Ice Cream', kind: 'tub', price: 4.29, bg1: '#eef3f8', bg2: '#bcd2e8', accent: '#8a5a2b', ink: '#173a63', section: 'frozen', weight: '1 L' },

  // electronics
  { id: 'tv55', brand: 'Vixel', name: '55" 4K TV', kind: 'boxbig', price: 379.0, bg1: '#14181f', bg2: '#0a0d12', accent: '#35c4c4', section: 'electronics', weight: '55 in' },
  { id: 'soundbar', brand: 'Vixel', name: 'Soundbar 2.1', kind: 'boxwide', price: 89.0, bg1: '#1c2027', bg2: '#10131a', accent: '#e0a01f', section: 'electronics', weight: '80 cm' },
  { id: 'headphones', brand: 'Aural', name: 'Headphones', kind: 'box', price: 49.0, bg1: '#2a2f38', bg2: '#171b22', accent: '#d8688a', section: 'electronics', weight: 'over-ear' },
  { id: 'console', brand: 'PlayBox', name: 'Game Console', kind: 'box', price: 299.0, bg1: '#1f2f52', bg2: '#101a30', accent: '#48e07a', section: 'electronics', weight: '1 TB' },
  { id: 'router', brand: 'Linkly', name: 'WiFi Router', kind: 'box', price: 59.0, bg1: '#f2f4f6', bg2: '#c9d2da', accent: '#1f6fc2', ink: '#173a63', section: 'electronics', weight: 'AX3000' },

  // home
  { id: 'blender', brand: 'MixMate', name: 'Blender', kind: 'boxtall', price: 34.0, bg1: '#c9241a', bg2: '#8a160f', accent: '#fff', section: 'home', weight: '1.5 L' },
  { id: 'towels', brand: 'Plush', name: 'Bath Towels 2pk', kind: 'boxwide', price: 15.0, bg1: '#3a7d8c', bg2: '#245560', accent: '#f4e3c1', section: 'home', weight: '2 pk' },
  { id: 'cookset', brand: 'ChefLine', name: 'Cookware Set', kind: 'boxbig', price: 79.0, bg1: '#33383f', bg2: '#1d2126', accent: '#e0a01f', section: 'home', weight: '10 pc' },
  { id: 'lamp', brand: 'Glow', name: 'Desk Lamp', kind: 'boxtall', price: 19.0, bg1: '#f2e8d8', bg2: '#d8c9b0', accent: '#8a5a2b', ink: '#4a3a20', section: 'home', weight: 'LED' },

  // toys
  { id: 'toytruck', brand: 'ZoomCo', name: 'Monster Truck', kind: 'box', price: 24.0, bg1: '#e0a01f', bg2: '#b07708', accent: '#c9241a', ink: '#3a2a00', section: 'toys', weight: 'ages 3+' },
  { id: 'blocks', brand: 'Brixo', name: 'Building Blocks', kind: 'box', price: 29.0, bg1: '#1f6fc2', bg2: '#124a85', accent: '#ffd23b', section: 'toys', weight: '250 pc' },
  { id: 'ball', brand: 'Bounce', name: 'Play Ball', kind: 'ball', price: 4.0, bg1: '#c9241a', bg2: '#8a160f', accent: '#fff', section: 'toys', weight: '22 cm' },
  { id: 'plush', brand: 'Snuggle', name: 'Plush Bear', kind: 'box', price: 12.0, bg1: '#8a5a2b', bg2: '#5c3a1a', accent: '#f4e3c1', section: 'toys', weight: '30 cm' },

  // pharmacy
  { id: 'meds', brand: 'Relievo', name: 'Pain Relief', kind: 'box', price: 6.5, bg1: '#f2f4f6', bg2: '#d5dde5', accent: '#c9241a', ink: '#8a1610', section: 'pharmacy', weight: '24 ct' },
  { id: 'vitamins', brand: 'VitaDay', name: 'Multivitamin', kind: 'jar', price: 9.0, bg1: '#f2e8d8', bg2: '#e0cfae', accent: '#2e7d32', ink: '#1d4a22', section: 'pharmacy', weight: '90 ct' },
  { id: 'bandages', brand: 'MendFast', name: 'Bandages', kind: 'boxwide', price: 3.5, bg1: '#e8ebee', bg2: '#c5ccd3', accent: '#1f6fc2', ink: '#173a63', section: 'pharmacy', weight: '40 ct' },

  // produce (loose, on crate tables)
  { id: 'apple', brand: 'Fresh', name: 'Gala Apples', kind: 'produce', price: 0.89, bg1: '#c62d1f', bg2: '#8a1a10', accent: '#fff', section: 'produce', weight: 'per lb' },
  { id: 'orange', brand: 'Fresh', name: 'Navel Oranges', kind: 'produce', price: 0.99, bg1: '#f28c1b', bg2: '#c56a0d', accent: '#fff', section: 'produce', weight: 'per lb' },
  { id: 'banana', brand: 'Fresh', name: 'Bananas', kind: 'produce', price: 0.59, bg1: '#f2c81b', bg2: '#c69f0d', accent: '#3a2a00', section: 'produce', weight: 'per lb' },
  { id: 'lettuce', brand: 'Fresh', name: 'Iceberg Lettuce', kind: 'produce', price: 1.49, bg1: '#3a9d44', bg2: '#256b2d', accent: '#fff', section: 'produce', weight: 'each' },
];

export const bySection = (s) => PRODUCTS.filter((p) => p.section === s);
export const byId = (id) => PRODUCTS.find((p) => p.id === id);

// ============================================================ GEOMETRY CACHE
const _geoCache = new Map();
function geo(key, make) {
  if (!_geoCache.has(key)) _geoCache.set(key, make());
  return _geoCache.get(key);
}

// Pillowed bag geometry: bulge front/back faces outward like a chip bag.
function bagGeometry(w, h, d) {
  return geo(`bag${w}x${h}`, () => {
    const g = new THREE.BoxGeometry(w, h, d, 6, 6, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const bulge = Math.cos((x / w) * Math.PI) * Math.cos((y / h) * Math.PI) * 0.55 + 1;
      p.setZ(i, z * bulge);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ============================================================ MESH FACTORIES
// Products do NOT cast shadows (GTAO grounds them) — keeps the shadow pass
// cheap enough for thousands of facings under multiple shadow-casting lights.
// Materials are CACHED per (spec, role): products are built repeatedly at
// runtime (debris, flyers), and fresh MeshStandardMaterials per build meant
// unbounded shader/material churn. Cached materials are never mutated.
const _matCache = new Map();
const cmat = (key, make) => {
  if (!_matCache.has(key)) _matCache.set(key, make());
  return _matCache.get(key);
};
const mat = (o) => new THREE.MeshStandardMaterial(o);
const sideMat = (spec) => cmat(spec.id + ':side', () => mat({ color: new THREE.Color(spec.bg2), roughness: 0.85 }));

function boxProduct(spec, w, h, d) {
  const face = cmat(spec.id + ':face', () => mat({ map: labelTexture(spec), roughness: 0.82 }));
  const side = sideMat(spec);
  return new THREE.Mesh(geo(`box${w}x${h}x${d}`, () => new THREE.BoxGeometry(w, h, d)), [side, side, side, side, face, face]);
}
function canProduct(spec, r, h) {
  const label = cmat(spec.id + ':label', () => mat({ map: labelTexture(spec, true), roughness: 0.35, metalness: 0.5 }));
  const metal = cmat('_canmetal', () => mat({ color: 0xd7dde3, roughness: 0.3, metalness: 0.95 }));
  return new THREE.Mesh(geo(`can${r}x${h}`, () => new THREE.CylinderGeometry(r, r, h, 20, 1)), [label, metal, metal]);
}
function jarProduct(spec, r, h) {
  const g = new THREE.Group();
  const label = cmat(spec.id + ':label', () => mat({ map: labelTexture(spec, true), roughness: 0.25, envMapIntensity: 1.4 }));
  const body = new THREE.Mesh(geo(`jar${r}x${h}`, () => new THREE.CylinderGeometry(r, r * 0.96, h, 20, 1)), label);
  body.position.y = h / 2; g.add(body);
  const lid = new THREE.Mesh(geo(`jarlid${r}`, () => new THREE.CylinderGeometry(r * 0.82, r * 0.82, h * 0.16, 20)), cmat('_jarlid', () => mat({ color: 0xcfa348, metalness: 0.85, roughness: 0.35 })));
  lid.position.y = h + h * 0.08; g.add(lid);
  return g;
}
function bottleProduct(spec, r, h) {
  const g = new THREE.Group();
  const label = cmat(spec.id + ':label', () => mat({ map: labelTexture(spec, true), roughness: 0.2, envMapIntensity: 1.5 }));
  const body = new THREE.Mesh(geo(`bot${r}x${h}`, () => new THREE.CylinderGeometry(r, r, h * 0.62, 18)), label);
  body.position.y = h * 0.31; g.add(body);
  const shoulder = new THREE.Mesh(geo(`botsh${r}`, () => new THREE.CylinderGeometry(r * 0.4, r, h * 0.2, 18)), cmat(spec.id + ':shoulder', () => mat({ color: new THREE.Color(spec.bg1), roughness: 0.15, envMapIntensity: 1.5 })));
  shoulder.position.y = h * 0.72; g.add(shoulder);
  const cap = new THREE.Mesh(geo(`botcap${r}`, () => new THREE.CylinderGeometry(r * 0.34, r * 0.34, h * 0.14, 14)), cmat(spec.id + ':cap', () => mat({ color: new THREE.Color(spec.accent), roughness: 0.4 })));
  cap.position.y = h * 0.89; g.add(cap);
  return g;
}
function bagProduct(spec, w, h, d) {
  const front = cmat(spec.id + ':face', () => mat({ map: labelTexture(spec), roughness: 0.22, metalness: 0.15, envMapIntensity: 1.35 }));
  const back = cmat(spec.id + ':bagback', () => mat({ color: new THREE.Color(spec.bg2), roughness: 0.22, metalness: 0.15 }));
  return new THREE.Mesh(bagGeometry(w, h, d), [back, back, back, back, front, back]);
}
function cartonProduct(spec, w, h, d) {
  const face = cmat(spec.id + ':cartonface', () => mat({ map: labelTexture(spec), roughness: 0.5 }));
  const side = sideMat(spec);
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo(`cart${w}x${h}`, () => new THREE.BoxGeometry(w, h * 0.78, d)), [side, side, side, side, face, face]);
  body.position.y = h * 0.39; g.add(body);
  const top = new THREE.Mesh(geo(`carttop${w}x${h}`, () => new THREE.BoxGeometry(w, h * 0.22, d * 0.4)), side);
  top.position.y = h * 0.89; g.add(top);
  return g;
}
function cupProduct(spec, r, h) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo(`cup${r}x${h}`, () => new THREE.CylinderGeometry(r * 0.82, r, h, 18)), cmat(spec.id + ':label', () => mat({ map: labelTexture(spec, true), roughness: 0.4 })));
  body.position.y = h / 2; g.add(body);
  const foil = new THREE.Mesh(geo(`cupfoil${r}`, () => new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.006, 18)), cmat('_cupfoil', () => mat({ color: 0xd9dee4, metalness: 0.9, roughness: 0.25 })));
  foil.position.y = h + 0.003; g.add(foil);
  return g;
}
function tubProduct(spec, r, h) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo(`tub${r}x${h}`, () => new THREE.CylinderGeometry(r, r * 0.88, h, 20)), cmat(spec.id + ':label', () => mat({ map: labelTexture(spec, true), roughness: 0.45 })));
  body.position.y = h / 2; g.add(body);
  const lid = new THREE.Mesh(geo(`tublid${r}`, () => new THREE.CylinderGeometry(r * 1.04, r * 1.04, h * 0.14, 20)), cmat(spec.id + ':lid', () => mat({ color: new THREE.Color(spec.accent), roughness: 0.5 })));
  lid.position.y = h + h * 0.07; g.add(lid);
  return g;
}
// loose produce
function fruit(spec) {
  const g = new THREE.Group();
  if (spec.id === 'banana') {
    const m = new THREE.Mesh(geo('banana', () => new THREE.TorusGeometry(0.075, 0.02, 8, 14, Math.PI * 0.9)), cmat('_banana', () => mat({ color: 0xf2c81b, roughness: 0.55 })));
    m.rotation.z = Math.PI * 0.55; m.position.y = 0.045; g.add(m);
  } else if (spec.id === 'lettuce') {
    const m = new THREE.Mesh(geo('lettuce', () => new THREE.SphereGeometry(0.075, 14, 10)), cmat('_lettuce', () => mat({ color: 0x69b04b, roughness: 0.9 })));
    m.scale.y = 0.85; m.position.y = 0.064; g.add(m);
  } else {
    const col = spec.id === 'apple' ? 0xc62d1f : 0xf28c1b;
    const m = new THREE.Mesh(geo('fruit', () => new THREE.SphereGeometry(0.052, 14, 10)), cmat(spec.id + ':fruit', () => mat({ color: col, roughness: 0.45, envMapIntensity: 1.2 })));
    m.scale.y = 0.94; m.position.y = 0.049; g.add(m);
    if (spec.id === 'apple') {
      const stem = new THREE.Mesh(geo('stem', () => new THREE.CylinderGeometry(0.004, 0.006, 0.03, 6)), cmat('_stem', () => mat({ color: 0x5c3a1a, roughness: 0.9 })));
      stem.position.y = 0.1; g.add(stem);
    }
  }
  return g;
}

// Build one product (origin at its base). userData carries the spec for interaction.
export function buildProduct(spec) {
  let obj;
  switch (spec.kind) {
    case 'can': obj = canProduct(spec, 0.045, 0.15); obj.position.y = 0.075; break;
    case 'jar': obj = jarProduct(spec, 0.05, 0.16); break;
    case 'bottle': obj = bottleProduct(spec, 0.05, 0.3); break;
    case 'bag': obj = bagProduct(spec, 0.16, 0.22, 0.055); obj.position.y = 0.11; break;
    case 'carton': obj = cartonProduct(spec, 0.09, 0.24, 0.09); break;
    case 'cup': obj = cupProduct(spec, 0.045, 0.09); break;
    case 'tub': obj = tubProduct(spec, 0.07, 0.13); break;
    case 'produce': obj = fruit(spec); break;
    case 'boxwide': obj = boxProduct(spec, 0.24, 0.16, 0.1); obj.position.y = 0.08; break;
    case 'boxtall': obj = boxProduct(spec, 0.17, 0.3, 0.09); obj.position.y = 0.15; break;
    case 'boxbig': obj = boxProduct(spec, 0.62, 0.42, 0.14); obj.position.y = 0.21; break;
    case 'ball': {
      obj = new THREE.Mesh(geo('playball', () => new THREE.SphereGeometry(0.115, 16, 12)), cmat(spec.id + ':ball', () => mat({ color: new THREE.Color(spec.bg1), roughness: 0.35, envMapIntensity: 1.3 })));
      obj.position.y = 0.115;
      break;
    }
    default: obj = boxProduct(spec, 0.15, 0.24, 0.07); obj.position.y = 0.12; break;
  }
  const g = new THREE.Group();
  g.add(obj);
  g.userData.spec = spec;
  return g;
}
