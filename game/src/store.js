import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { loadPBR, METAL, PAINTED, PLASTIC } from './materials.js';
import { bySection, priceTagTexture } from './products.js';
import { buildStock } from './stock.js';

// Interior footprint (metres). Aisles run along Z.
export const STORE = { w: 20, d: 26, h: 3.6 };
const FONTS = 'Arial, "Helvetica Neue", Helvetica, sans-serif';

let _rectInit = false;
function rectLight(scene, x, z, w, l, intensity, rotY = 0) {
  if (!_rectInit) { RectAreaLightUniformsLib.init(); _rectInit = true; }
  const rl = new THREE.RectAreaLight(0xfff2e2, intensity, w, l);
  rl.position.set(x, STORE.h - 0.08, z);
  rl.rotation.set(-Math.PI / 2, 0, rotY);
  scene.add(rl);
}

// ------------------------------------------------------------- canvas textures
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
const pegboardTex = () => canvasTex(256, 256, (x) => {
  x.fillStyle = '#eef0f2'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#c9cdd1';
  for (let py = 8; py < 256; py += 16) for (let px = 8; px < 256; px += 16) { x.beginPath(); x.arc(px, py, 2.2, 0, Math.PI * 2); x.fill(); }
}, [4, 3]);
const ceilingTex = () => canvasTex(512, 512, (x) => {
  x.fillStyle = '#f0f2f4'; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#cfd4d8'; x.lineWidth = 3;
  for (let i = 0; i <= 512; i += 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 512); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(512, i); x.stroke(); }
  x.fillStyle = '#dfe3e6'; x.fillRect(131, 259, 122, 122); // one vent tile
  x.strokeStyle = '#c2c7cb'; for (let vy = 270; vy < 375; vy += 14) { x.beginPath(); x.moveTo(135, vy); x.lineTo(249, vy); x.stroke(); }
}, [10, 13]);
const aisleSignTex = (num, l1, l2) => canvasTex(512, 170, (x) => {
  x.fillStyle = '#173a63'; x.fillRect(0, 0, 512, 170);
  x.fillStyle = '#ffd23b'; x.fillRect(0, 0, 118, 170);
  x.fillStyle = '#173a63'; x.textAlign = 'center'; x.font = `800 92px ${FONTS}`; x.fillText(num, 59, 118);
  x.fillStyle = '#fff'; x.textAlign = 'left';
  x.font = `700 44px ${FONTS}`; x.fillText(l1, 142, 74);
  x.font = `500 36px ${FONTS}`; x.fillStyle = '#bcd2e8'; x.fillText(l2, 142, 128);
});
const bannerTex = (text, bg = '#1d5c38') => canvasTex(1024, 160, (x) => {
  x.fillStyle = bg; x.fillRect(0, 0, 1024, 160);
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `800 96px ${FONTS}`;
  x.fillText(text, 512, 112);
});
const chalkTex = (name, price) => canvasTex(256, 140, (x) => {
  x.fillStyle = '#23272b'; x.fillRect(0, 0, 256, 140);
  x.strokeStyle = '#8a8f94'; x.lineWidth = 4; x.strokeRect(6, 6, 244, 128);
  x.fillStyle = '#f2f2ea'; x.textAlign = 'center';
  x.font = `700 30px Georgia, serif`; x.fillText(name.toUpperCase(), 128, 52);
  x.font = `800 44px Georgia, serif`; x.fillStyle = '#ffd23b'; x.fillText(price, 128, 108);
});
const laneNumTex = (n) => canvasTex(128, 128, (x) => {
  x.fillStyle = '#111418'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#35c46a'; x.textAlign = 'center'; x.font = `800 88px ${FONTS}`;
  x.fillText(n, 64, 96);
});

// double-sided readable sign (two planes back to back)
function hangingSign(scene, tex, wpx, x, y, z, rotY = 0) {
  const g = new THREE.Group();
  const h = wpx * (tex.image.height / tex.image.width);
  for (const s of [1, -1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(wpx, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
    p.position.z = s * 0.012; p.rotation.y = s === 1 ? 0 : Math.PI; g.add(p);
  }
  for (const dx of [-wpx * 0.4, wpx * 0.4]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, STORE.h - y - h / 2, 6), METAL(0x666a6e, 0.5));
    rod.position.set(dx, h / 2 + (STORE.h - y - h / 2) / 2, 0); g.add(rod);
  }
  g.position.set(x, y, z); g.rotation.y = rotY; scene.add(g);
}

// Convert fixture-local slot records to world space through the fixture's
// matrixWorld (fixtures only translate + rotate about Y, so rotY just adds).
function emitSlots(group, localSlots, slots) {
  group.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  for (const s of localSlots) {
    v.set(s.x, s.y, s.z).applyMatrix4(group.matrixWorld);
    slots.push({ spec: s.spec, x: v.x, y: v.y, z: v.z, rotY: (s.rotY || 0) + group.rotation.y, grabbable: s.grabbable !== false });
  }
}

// ------------------------------------------------------------- gondola shelving
const shelfYs = [0.28, 0.68, 1.08, 1.48];
function stockShelf(localSlots, tagSlots, face, HD, y, length, section, rng) {
  const pool = bySection(section);
  if (!pool.length) return;
  const margin = 0.4, step = 0.2;
  let z = -length / 2 + margin, pi = Math.floor(rng() * pool.length), runLeft = 0, spec = null, runStart = true;
  const rotBase = face === 1 ? Math.PI / 2 : -Math.PI / 2;
  while (z < length / 2 - margin) {
    if (runLeft <= 0) { spec = pool[pi % pool.length]; pi++; runLeft = 3 + Math.floor(rng() * 2); runStart = true; }
    if (rng() > 0.05) { // occasional gap = shopped-from shelf
      localSlots.push({ spec, x: face * (HD - 0.03), y, z: z + (rng() - 0.5) * 0.015, rotY: rotBase + (rng() - 0.5) * 0.09 });
      if (runStart) {
        tagSlots.push({ spec, x: face * (HD + 0.006), y: y - 0.045, z, rotY: rotBase });
        runStart = false;
      }
    }
    runLeft--; z += step;
  }
}

function gondola(localSlots, tagSlots, length, sectionsByFace, rng) {
  const g = new THREE.Group();
  const H = 1.85, HD = 0.42;
  const shelfMetal = METAL(0xc4cace, 0.34);
  const peg = new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.8 });
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.06, H, length), peg);
  bp.position.y = H / 2; bp.castShadow = bp.receiveShadow = true; g.add(bp);
  for (const z of [-length / 2, length / 2]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(HD * 2, H, 0.05), METAL(0x9aa1a8, 0.4));
    cap.position.set(0, H / 2, z); cap.castShadow = true; g.add(cap);
  }
  const kb = new THREE.Mesh(new THREE.BoxGeometry(HD * 2 + 0.04, 0.12, length), PAINTED(0x2b3038, 0.5));
  kb.position.y = 0.06; kb.receiveShadow = true; g.add(kb);
  const hdr = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, length), PAINTED(0xf2f4f6, 0.6));
  hdr.position.y = H + 0.08; g.add(hdr);

  for (const face of [1, -1]) {
    const sections = sectionsByFace[face === 1 ? 0 : 1];
    for (let si = 0; si < shelfYs.length; si++) {
      const y = shelfYs[si];
      const slab = new THREE.Mesh(new THREE.BoxGeometry(HD, 0.03, length), shelfMetal);
      slab.position.set(face * HD / 2, y - 0.015, 0); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, length), PAINTED(0xf7f9fb, 0.55));
      rail.position.set(face * (HD - 0.006), y - 0.03, 0); g.add(rail);
      stockShelf(localSlots, tagSlots, face, HD, y, length, sections[si % sections.length], rng);
    }
  }
  return g;
}

function wallShelf(localSlots, tagSlots, length, sections, rng) {
  const g = new THREE.Group();
  const H = 2.0, D = 0.45;
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, length), new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.8 }));
  bp.position.set(-D / 2, H / 2, 0); bp.receiveShadow = true; g.add(bp);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(D, 0.12, length), PAINTED(0x2b3038, 0.5));
  kb.position.y = 0.06; g.add(kb);
  for (let si = 0; si < shelfYs.length; si++) {
    const y = shelfYs[si];
    const slab = new THREE.Mesh(new THREE.BoxGeometry(D, 0.03, length), METAL(0xc4cace, 0.34));
    slab.position.set(0, y - 0.015, 0); slab.castShadow = slab.receiveShadow = true; g.add(slab);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, length), PAINTED(0xf7f9fb, 0.55));
    rail.position.set(D / 2 - 0.006, y - 0.03, 0); g.add(rail);
    stockShelf(localSlots, tagSlots, 1, D / 2 + 0.16, y, length, sections[si % sections.length], rng);
  }
  return g;
}

// ------------------------------------------------------------- freezer wall
function freezerWall(scene, slots, rng) {
  const g = new THREE.Group();
  const doors = 10, pitch = 1.15, W = 1.02, H = 2.05, D = 0.72;
  const frame = METAL(0x3a3f45, 0.4);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd8ea, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, envMapIntensity: 2.2, side: THREE.DoubleSide });
  const innerMat = PAINTED(0x1c2126, 0.85);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdcecff, emissiveIntensity: 2.6, roughness: 1 });
  const pool = bySection('frozen');
  const unitX = STORE.w / 2 - D - 0.02;

  for (let i = 0; i < doors; i++) {
    const z = -((doors - 1) * pitch) / 2 + i * pitch;
    const u = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(D, H, pitch), innerMat);
    box.position.set(D / 2, H / 2, 0); u.add(box);
    for (const sy of [0.5, 0.95, 1.4]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(D - 0.2, 0.025, W - 0.12), METAL(0xb9c0c7, 0.4));
      sh.position.set(D / 2 - 0.04, sy, 0); u.add(sh);
      for (let k = 0; k < 3; k++) {
        const spec = pool[Math.floor(rng() * pool.length)];
        slots.push({ spec, x: unitX + D / 2 - 0.04, y: sy + 0.013, z: z - 0.3 + k * 0.3, rotY: -Math.PI / 2, grabbable: false });
      }
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, W - 0.14), ledMat);
      led.position.set(0.1, sy + 0.32, 0); u.add(led);
    }
    const fr = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, W), frame);
    fr.position.set(-0.02, H / 2, 0); u.add(fr);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.14, H - 0.18), glassMat);
    glass.position.set(-0.05, H / 2, 0); glass.rotation.y = -Math.PI / 2; u.add(glass);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), METAL(0xd7dde3, 0.25));
    handle.position.set(-0.09, H / 2, W / 2 - 0.14); u.add(handle);
    u.position.set(unitX, 0, z);
    g.add(u);
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(D, 0.5, doors * pitch), PAINTED(0x173a63, 0.6));
  band.position.set(STORE.w / 2 - D / 2 - 0.02, H + 0.25, 0);
  g.add(band);
  scene.add(g);
  hangingSign(scene, bannerTex('FROZEN', '#1f5f8a'), 3.2, STORE.w / 2 - 1.6, 2.85, 0, Math.PI / 2);
  return { minX: STORE.w / 2 - D - 0.15, maxX: STORE.w / 2, minZ: -(doors * pitch) / 2 - 0.1, maxZ: (doors * pitch) / 2 + 0.1 };
}

// ------------------------------------------------------------- produce corner
function produceCorner(scene, slots, woodMat, rng) {
  const colliders = [];
  const tables = [
    { x: -6.6, z: 7.2, id: 'apple' }, { x: -3.9, z: 7.2, id: 'orange' },
    { x: -6.6, z: 9.6, id: 'banana' }, { x: -3.9, z: 9.6, id: 'lettuce' },
  ];
  for (const t of tables) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.15), woodMat);
    top.position.y = 0.82; top.castShadow = top.receiveShadow = true; g.add(top);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 1.0), woodMat);
    skirt.position.y = 0.41; skirt.castShadow = true; g.add(skirt);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.09, 1.19), woodMat);
    rim.position.y = 0.9; g.add(rim);
    const spec = bySection('produce').find((p) => p.id === t.id);
    for (let ix = 0; ix < 7; ix++) for (let iz = 0; iz < 5; iz++) {
      if (rng() < 0.12) continue;
      slots.push({
        spec,
        x: t.x - 0.68 + ix * 0.22 + (rng() - 0.5) * 0.05,
        y: 0.87,
        z: t.z - 0.4 + iz * 0.2 + (rng() - 0.5) * 0.05,
        rotY: rng() * Math.PI * 2,
      });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.23), new THREE.MeshStandardMaterial({ map: chalkTex(spec.name.split(' ').pop(), `$${spec.price.toFixed(2)} ${spec.weight}`), roughness: 0.9 }));
    sign.position.set(0, 1.06, 0.62); sign.rotation.x = -0.18; g.add(sign);
    g.position.set(t.x, 0, t.z);
    scene.add(g);
    colliders.push({ minX: t.x - 0.9, maxX: t.x + 0.9, minZ: t.z - 0.62, maxZ: t.z + 0.62 });
  }
  hangingSign(scene, bannerTex('PRODUCE', '#1d5c38'), 3.4, -5.2, 2.85, 8.4);
  return colliders;
}

// ------------------------------------------------------------- checkout lanes
function checkoutLanes(scene) {
  const colliders = [];
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.28, metalness: 0.2, envMapIntensity: 1.4 });
  const counterMat = PAINTED(0xd8dde2, 0.55);
  for (let i = 0; i < 3; i++) {
    const x = 3.0 + i * 1.9;
    const g = new THREE.Group();
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.92, 2.6), counterMat);
    counter.position.y = 0.46; counter.castShadow = counter.receiveShadow = true; g.add(counter);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 1.7), beltMat);
    belt.position.set(0, 0.94, -0.2); g.add(belt);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.06, 0.7), METAL(0xb9c0c7, 0.3));
    bag.position.set(0, 0.95, 1.0); g.add(bag);
    const reader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.1), PLASTIC(0x22262a, 0.4));
    reader.position.set(0.45, 1.06, 0.5); reader.rotation.z = -0.25; g.add(reader);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 10), METAL(0x9aa1a8, 0.4));
    pole.position.set(0, 1.65, 1.15); g.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), new THREE.MeshStandardMaterial({ map: laneNumTex(String(i + 1)), emissive: 0x8affb0, emissiveIntensity: 0.35, emissiveMap: laneNumTex(String(i + 1)), roughness: 0.6 }));
    lamp.position.set(0, 2.45, 1.15); g.add(lamp);
    g.position.set(x, 0, 8.6);
    scene.add(g);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: 8.6 - 1.35, maxZ: 8.6 + 1.35 });
  }
  hangingSign(scene, bannerTex('CHECKOUT', '#8a5a12'), 3.4, 4.9, 2.85, 8.6);
  return { colliders, point: new THREE.Vector3(3.95, 0, 9.1) };
}

// ------------------------------------------------------------- carts & baskets
function cartGridTex() {
  return canvasTex(128, 128, (x) => {
    x.clearRect(0, 0, 128, 128);
    x.strokeStyle = '#c9ced4'; x.lineWidth = 5;
    for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  });
}
export function shoppingCart() {
  const g = new THREE.Group();
  const grid = cartGridTex();
  const gridMat = new THREE.MeshStandardMaterial({ map: grid, transparent: true, alphaTest: 0.3, metalness: 0.9, roughness: 0.35, side: THREE.DoubleSide });
  const basket = new THREE.Group();
  const wD = 0.56, wH = 0.38, wL = 0.85;
  const faces = [
    [wL, wH, 0, wH / 2, wD / 2, 0], [wL, wH, 0, wH / 2, -wD / 2, 0],
    [wD, wH, -wL / 2, wH / 2, 0, Math.PI / 2], [wD, wH, wL / 2, wH / 2, 0, Math.PI / 2],
    [wL, wD, 0, 0, 0, 0],
  ];
  for (const [fw, fh, px, py, pz, ry] of faces) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), gridMat);
    p.position.set(px, py, pz); p.rotation.y = ry;
    if (fh === wD) { p.rotation.x = -Math.PI / 2; p.position.y = 0.01; }
    basket.add(p);
  }
  basket.position.y = 0.52; basket.rotation.x = -0.06; g.add(basket);
  const frame = METAL(0xb9c0c7, 0.3);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, wD + 0.1, 8), frame);
  handle.rotation.x = Math.PI / 2; handle.position.set(-wL / 2 - 0.12, 1.0, 0); g.add(handle);
  for (const s of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 8), frame);
    bar.position.set(-wL / 2 - 0.06, 0.74, s * wD / 2); bar.rotation.z = 0.35; g.add(bar);
  }
  for (const dx of [-wL / 2 + 0.1, wL / 2 - 0.1]) for (const dz of [-wD / 2 + 0.06, wD / 2 - 0.06]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.035, 12), PLASTIC(0x25282c, 0.5));
    w.rotation.x = Math.PI / 2; w.position.set(dx, 0.05, dz); g.add(w);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function cartsAndBaskets(scene) {
  const colliders = [];
  const rail = METAL(0x8f969c, 0.45);
  for (const dz of [-0.55, 0.55]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 8), rail);
    r.rotation.z = Math.PI / 2; r.position.set(-1.3, 0.55, 11.4 + dz); scene.add(r);
  }
  const c1 = shoppingCart(); c1.position.set(-1.9, 0, 11.4); c1.rotation.y = Math.PI / 2; scene.add(c1);
  const c2 = shoppingCart(); c2.position.set(-0.9, 0, 11.4); c2.rotation.y = Math.PI / 2; scene.add(c2);
  const c3 = shoppingCart(); c3.position.set(-4.4, 0, 1.8); c3.rotation.y = 2.3; scene.add(c3);
  colliders.push({ minX: -2.6, maxX: -0.3, minZ: 10.8, maxZ: 12.0 });
  colliders.push({ minX: -4.9, maxX: -3.9, minZ: 1.3, maxZ: 2.3 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), PLASTIC(0xc9241a, 0.45));
    b.position.set(1.4 + (i % 2) * 0.02, 0.11 + i * 0.09, 11.6);
    b.rotation.y = (i % 2) * 0.08; b.castShadow = true; scene.add(b);
  }
  colliders.push({ minX: 1.1, maxX: 1.7, minZ: 11.3, maxZ: 11.9 });
  return colliders;
}

// ------------------------------------------------------------- entrance
function entrance(scene) {
  const doors = [];
  const gap = 3.4, z = STORE.d / 2;
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4de, transparent: true, opacity: 0.1, roughness: 0.06, metalness: 0.1, envMapIntensity: 0.7, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const d = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(gap / 2 - 0.08, 2.3), glassMat);
    glass.position.y = 1.18; d.add(glass);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(gap / 2, 0.08, 0.06), METAL(0x3a3f45, 0.4));
    fr.position.y = 2.36; d.add(fr);
    const fb = fr.clone(); fb.position.y = 0.04; d.add(fb);
    d.position.set(s * gap / 4, 0, z - 0.06);
    scene.add(d);
    doors.push({ g: d, closedX: s * gap / 4, openX: s * (gap / 4 + gap / 2), t: 0 });
  }
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.0),
    new THREE.MeshStandardMaterial({ map: bannerTex('GROCERY DASH MARKET', '#173a63'), emissive: 0x2a5a92, emissiveIntensity: 0.25, roughness: 0.6 }),
  );
  sign.position.set(0, 2.95, z - 0.12); sign.rotation.y = Math.PI; scene.add(sign);
  return doors;
}

// ------------------------------------------------------------- exterior
// A night parking lot outside the storefront glass: asphalt, striped stalls,
// parked cars, lamp posts with fake light pools, distant lit buildings and a
// gradient sky dome. No real lights added — emissive + additive decals only.
const skyTex = () => canvasTex(64, 512, (x) => {
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04060c'); g.addColorStop(0.55, '#0a1222'); g.addColorStop(1, '#1a2438');
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
});
const buildingTex = () => canvasTex(512, 256, (x) => {
  x.fillStyle = '#0b0e14'; x.fillRect(0, 0, 512, 256);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 16; c++) {
    if (Math.sin(r * 37 + c * 91) > 0.45) { x.fillStyle = ['#ffd98a', '#bcd6ff', '#ffe9c9'][(r + c) % 3]; x.globalAlpha = 0.75; x.fillRect(18 + c * 30, 26 + r * 42, 14, 20); }
  }
  x.globalAlpha = 1;
});
function car(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.75, envMapIntensity: 1.4, fog: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 4.1), paint); body.position.y = 0.42; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.1), new THREE.MeshStandardMaterial({ color: 0x11151c, roughness: 0.12, metalness: 0.4, envMapIntensity: 1.6, fog: false }));
  cabin.position.set(0, 0.9, -0.2); g.add(cabin);
  const wheelG = new THREE.CylinderGeometry(0.31, 0.31, 0.22, 14);
  const wheelM = new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.85, fog: false });
  for (const dz of [-1.35, 1.35]) for (const dx of [-0.82, 0.82]) {
    const w = new THREE.Mesh(wheelG, wheelM); w.rotation.z = Math.PI / 2; w.position.set(dx, 0.31, dz); g.add(w);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.09, 0.04), new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2a1a, emissiveIntensity: 0.7, fog: false }));
  tail.position.set(0, 0.62, 2.06); g.add(tail);
  return g;
}
function exterior(scene) {
  const zFront = STORE.d / 2;
  // sky dome + ground
  const dome = new THREE.Mesh(new THREE.SphereGeometry(85, 24, 12), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }));
  dome.position.set(0, 0, zFront); scene.add(dome);
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), new THREE.MeshStandardMaterial({ color: 0x191c21, roughness: 0.95, fog: false }));
  lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.02, zFront + 45); scene.add(lot);
  const walk = new THREE.Mesh(new THREE.BoxGeometry(46, 0.09, 3.2), new THREE.MeshStandardMaterial({ color: 0x8d939a, roughness: 0.9, fog: false }));
  walk.position.set(0, 0.045 - 0.02, zFront + 1.7); scene.add(walk);
  // parking stripes + cars
  const stripeG = new THREE.PlaneGeometry(0.14, 4.6);
  const stripeM = new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: 0.5, fog: false });
  const stripes = new THREE.InstancedMesh(stripeG, stripeM, 12);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 12; i++) {
    m4.makeRotationX(-Math.PI / 2);
    m4.setPosition(-14 + i * 2.6, 0.001, zFront + 7.8);
    stripes.setMatrixAt(i, m4);
  }
  stripes.instanceMatrix.needsUpdate = true; scene.add(stripes);
  const carColors = [0x8a1f1f, 0x1f3f6e, 0xb9bcc0, 0x24282d, 0x4a5a4a];
  [[-12.7, 0.15], [-7.5, -0.1], [-2.3, 0.05], [5.5, -0.12], [10.7, 0.08]].forEach(([cx, jitter], i) => {
    const c = car(carColors[i % carColors.length]);
    c.position.set(cx, 0, zFront + 7.8 + (i % 2 ? 0.3 : -0.2));
    c.rotation.y = jitter + (i % 2 ? Math.PI : 0);
    scene.add(c);
  });
  // lamp posts with fake light pools
  for (const lx of [-9, 8]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.6, 8), new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.6, metalness: 0.8, fog: false }));
    pole.position.set(lx, 2.8, zFront + 6.2); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.36), new THREE.MeshStandardMaterial({ color: 0x30343a, emissive: 0xffd9a0, emissiveIntensity: 2.4, fog: false }));
    head.position.set(lx, 5.55, zFront + 6.5); scene.add(head);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), new THREE.MeshBasicMaterial({ color: 0xffdCA0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.0, zFront + 6.5); scene.add(pool);
  }
  // distant strip-mall silhouettes with lit windows
  for (const [bx, bz, bw, bh] of [[-30, 34, 26, 9], [16, 40, 30, 7], [40, 26, 18, 11]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 10), new THREE.MeshBasicMaterial({ map: buildingTex(), fog: false }));
    b.position.set(bx, bh / 2, zFront + bz); scene.add(b);
  }
}

// ------------------------------------------------------------- lighting
function lighting(scene) {
  const y = STORE.h;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(STORE.w, STORE.d), new THREE.MeshStandardMaterial({ map: ceilingTex(), roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = y; scene.add(ceil);

  // instanced troffers: all fixtures in ONE draw call
  const corridorXs = [-8, -4, 0, 4, 8];
  const zs = []; for (let z = -10.5; z <= 11; z += 2.8) zs.push(z);
  const trofferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3.0, roughness: 1 });
  const troffers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.05, 2.1), trofferMat, corridorXs.length * zs.length);
  const m = new THREE.Matrix4();
  let ti = 0;
  for (const x of corridorXs) for (const z of zs) { m.makeTranslation(x, y - 0.03, z); troffers.setMatrixAt(ti++, m); }
  troffers.instanceMatrix.needsUpdate = true;
  scene.add(troffers);

  for (const x of [-8, 0, 8]) rectLight(scene, x, 0, 0.6, 19, 5.2);
  rectLight(scene, 0, 9.4, 0.6, 15, 4.0, Math.PI / 2);
  for (const [sx, sz] of [[-4, -6], [4, 0], [-5, 8], [5, 8], [0, -10]]) {
    const s = new THREE.SpotLight(0xfff4e6, 45, 16, Math.PI * 0.34, 0.55, 1.5);
    s.position.set(sx, y - 0.12, sz);
    s.target.position.set(sx, 0, sz);
    s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024);
    s.shadow.camera.near = 0.5; s.shadow.camera.far = 13; s.shadow.bias = -0.0005;
    scene.add(s, s.target);
  }
  scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x39352f, 0.3));
}

// ------------------------------------------------------------- set dressing
const saleTagTex = (line1, line2, bg = '#ffd23b', ink = '#b3160c') => canvasTex(192, 110, (x) => {
  x.fillStyle = bg; x.fillRect(0, 0, 192, 110);
  x.strokeStyle = ink; x.lineWidth = 5; x.strokeRect(4, 4, 184, 102);
  x.fillStyle = ink; x.textAlign = 'center';
  x.font = `800 44px ${FONTS}`; x.fillText(line1, 96, 50);
  x.font = `700 26px ${FONTS}`; x.fillText(line2, 96, 88);
});
const cardboardMat = () => new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
  x.fillStyle = '#b08d5a'; x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#8f6f42'; x.lineWidth = 3;
  x.strokeRect(6, 6, 116, 116); x.beginPath(); x.moveTo(6, 64); x.lineTo(122, 64); x.stroke();
}), roughness: 0.9 });

// endcap displays: cut-case cardboard trays stacked at each gondola end, with
// products (added to the instanced stock, so they're even grabbable) + SALE sign
function endcaps(scene, slots, colliders, rng) {
  const card = cardboardMat();
  const trayGeo = new THREE.BoxGeometry(0.78, 0.16, 0.5);
  const spots = [];
  for (const x of [-6, -2, 2, 6]) for (const s of [1, -1]) spots.push([x, -2 + s * (14 / 2 + 0.42)]);
  const sections = ['snacks', 'pantry', 'household', 'dairy'];
  const trays = new THREE.InstancedMesh(trayGeo, card, spots.length * 3);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const one = new THREE.Vector3(1, 1, 1); const p = new THREE.Vector3();
  let ti = 0;
  spots.forEach(([ex, ez], i) => {
    const pool = bySection(sections[i % sections.length]);
    for (let layer = 0; layer < 3; layer++) {
      const y = 0.16 * layer;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (rng() - 0.5) * 0.06);
      m4.compose(p.set(ex, y + 0.08, ez), q, one);
      trays.setMatrixAt(ti++, m4);
      const spec = pool[Math.floor(rng() * pool.length)];
      for (let k = 0; k < 3; k++) {
        if (layer === 2 && rng() < 0.3) continue; // partly-shopped top layer
        slots.push({ spec, x: ex - 0.24 + k * 0.24, y: y + 0.16, z: ez + (rng() - 0.5) * 0.08, rotY: (rng() - 0.5) * 0.4 });
      }
    }
    // yellow SALE blade sign above
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.25), new THREE.MeshStandardMaterial({ map: saleTagTex('SALE!', 'this week'), roughness: 0.75, side: THREE.DoubleSide }));
    sign.position.set(ex, 1.35, ez + (ez > -2 ? 0.29 : -0.29));
    scene.add(sign);
    colliders.push({ minX: ex - 0.45, maxX: ex + 0.45, minZ: ez - 0.3, maxZ: ez + 0.3 });
  });
  trays.instanceMatrix.needsUpdate = true; trays.computeBoundingSphere(); scene.add(trays);
}

// shrink-wrapped pallet stacks (water / soda cases) parked in dead corners
function palletStacks(scene, colliders, rng) {
  const woodM = new THREE.MeshStandardMaterial({ color: 0x9a7c50, roughness: 0.9 });
  const spots = [[8.5, -11.4, 0x2a6fc0, 0.2], [-8.6, 6.7, 0xc9241a, -0.15], [1.6, 6.9, 0x2a6fc0, 0.5]];
  for (const [px, pz, tint, rot] of spots) {
    const g = new THREE.Group();
    const pallet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.13, 1.1), woodM);
    pallet.position.y = 0.065; pallet.castShadow = true; g.add(pallet);
    const caseM = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.24, metalness: 0.05, envMapIntensity: 1.6, transparent: true, opacity: 0.94 });
    for (let layer = 0; layer < 3; layer++) for (let ix = 0; ix < 2; ix++) for (let iz = 0; iz < 2; iz++) {
      if (layer === 2 && rng() < 0.4) continue;
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.26, 0.5), caseM);
      c.position.set(-0.26 + ix * 0.52, 0.26 + layer * 0.27, -0.26 + iz * 0.52);
      c.rotation.y = (rng() - 0.5) * 0.05; c.castShadow = layer === 0; g.add(c);
    }
    g.position.set(px, 0, pz); g.rotation.y = rot;
    scene.add(g);
    colliders.push({ minX: px - 0.68, maxX: px + 0.68, minZ: pz - 0.68, maxZ: pz + 0.68 });
  }
}

// checkout extras: belt divider bars, candy impulse racks, bag stands,
// magazine rack, one closed lane
function checkoutExtras(scene, slots, rng) {
  const white = PAINTED(0xf2f4f6, 0.5);
  for (let i = 0; i < 3; i++) {
    const x = 3.0 + i * 1.9;
    for (const dz of [-0.7, 0.15]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.05), white);
      bar.position.set(x, 0.98, 8.6 + dz - 0.2); bar.rotation.y = (rng() - 0.5) * 0.2; scene.add(bar);
    }
    // candy strip on the lane side (small instanced product row)
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.2), PAINTED(0x9aa1a8, 0.5));
    rack.position.set(x + 0.42, 0.55, 8.2); scene.add(rack);
    const candy = bySection('snacks').filter((s) => s.kind === 'bag' || s.kind === 'box');
    for (const sy of [0.42, 0.62, 0.82]) for (let k = 0; k < 4; k++) {
      const spec = candy[Math.floor(rng() * candy.length)];
      slots.push({ spec, x: x + 0.5, y: sy - 0.12, z: 7.75 + k * 0.28, rotY: Math.PI / 2, grabbable: true });
    }
    // bag stand at the bagging end
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.06), METAL(0x8f969c, 0.4));
    stand.position.set(x, 1.2, 9.85); scene.add(stand);
    const bags = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.05), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, transparent: true, opacity: 0.9 }));
    bags.position.set(x, 1.12, 9.82); scene.add(bags);
  }
  // lane 3 closed: red lamp + chain sign
  const lamp3 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
    x.fillStyle = '#111418'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#d8362a'; x.textAlign = 'center'; x.font = `800 78px ${FONTS}`; x.fillText('✕', 64, 92);
  }), emissive: 0xd8362a, emissiveIntensity: 0.3, roughness: 0.6 }));
  lamp3.position.set(6.8, 2.45, 9.75); scene.add(lamp3);
  const closed = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshStandardMaterial({ map: saleTagTex('LANE', 'CLOSED', '#d8dde2', '#333'), roughness: 0.7, side: THREE.DoubleSide }));
  closed.position.set(6.8, 1.0, 9.9); scene.add(closed);
  // magazine rack by lane 1
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.8), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x) => {
    x.fillStyle = '#22262b'; x.fillRect(0, 0, 256, 256);
    const cols = ['#c9241a', '#1f6fc2', '#2e8b57', '#e0a01f', '#7a3fb5', '#d8688a'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      x.fillStyle = cols[(r * 4 + c) % 6]; x.fillRect(10 + c * 62, 10 + r * 84, 52, 72);
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(14 + c * 62, 16 + r * 84, 44, 12);
    }
  }), roughness: 0.7 }));
  mag.position.set(2.55, 0.95, 8.2); scene.add(mag);
}

// produce upgrades: warm pendant shades under the existing front spots,
// hanging scale, banana boxes, wood-look floor patch
function produceExtras(scene) {
  for (const [px, pz] of [[-5, 8], [5, 8]]) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d4a33, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.set(px, STORE.h - 0.42, pz); scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2dd, emissive: 0xffdCA0, emissiveIntensity: 3 }));
    bulb.position.set(px, STORE.h - 0.5, pz); scene.add(bulb);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 6), METAL(0x22262a, 0.7));
    cord.position.set(px, STORE.h - 0.16, pz); scene.add(cord);
  }
  // hanging produce scale
  const scale = new THREE.Group();
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.07, 18), METAL(0xc23b2e, 0.45));
  bowl.position.y = -0.62; scale.add(bowl);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 16), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
    x.fillStyle = '#f4f6f2'; x.beginPath(); x.arc(64, 64, 60, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#333'; x.lineWidth = 3;
    for (let a = 0; a < 12; a++) { const r1 = 46, r2 = 56, th = a / 12 * Math.PI * 2; x.beginPath(); x.moveTo(64 + r1 * Math.cos(th), 64 + r1 * Math.sin(th)); x.lineTo(64 + r2 * Math.cos(th), 64 + r2 * Math.sin(th)); x.stroke(); }
    x.strokeStyle = '#c9241a'; x.lineWidth = 4; x.beginPath(); x.moveTo(64, 64); x.lineTo(96, 40); x.stroke();
  }), roughness: 0.5 }));
  dial.rotation.x = Math.PI / 2; dial.position.y = -0.3; scale.add(dial);
  for (const a of [0, 2.1, 4.2]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), METAL(0x8f969c, 0.4));
    chain.position.set(Math.cos(a) * 0.14, -0.47, Math.sin(a) * 0.14); chain.rotation.x = 0.18 * Math.sin(a); scale.add(chain);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), METAL(0x22262a, 0.7));
  rod.position.y = 0.05; scale.add(rod);
  scale.position.set(-5.25, STORE.h - 0.35, 8.4); scene.add(scale);
  // banana boxes under a table + wood floor patch
  const card = cardboardMat();
  for (const [bx, bz, r] of [[-5.6, 8.4, 0.3], [-4.9, 8.45, -0.2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), card);
    b.position.set(bx, 0.15, bz); b.rotation.y = r; b.castShadow = true; scene.add(b);
  }
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 6.4), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85, transparent: true, opacity: 0.28, depthWrite: false }));
  patch.rotation.x = -Math.PI / 2; patch.position.set(-5.25, 0.006, 8.4); scene.add(patch);
}

// wall dressing: department murals, EXIT sign, clock, cameras, staff door
function wallDressing(scene) {
  const mural = (text, sub, bg, w2, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w2, w2 * 0.22), new THREE.MeshStandardMaterial({ map: canvasTex(1024, 226, (c) => {
      c.fillStyle = bg; c.fillRect(0, 0, 1024, 226);
      c.fillStyle = 'rgba(255,255,255,.12)';
      for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(90 + i * 145, 190, 46, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = `italic 800 104px Georgia, serif`; c.fillText(text, 512, 118);
      c.font = `600 40px ${FONTS}`; c.fillStyle = 'rgba(255,255,255,.75)'; c.fillText(sub, 512, 182);
    }), roughness: 0.85 }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  mural('Fresh Produce', 'picked daily', '#1d5c38', 6.5, -5.2, 3.05, STORE.d / 2 - 0.16, Math.PI);
  mural('The Bakery', 'baked this morning', '#8a5a2b', 6.5, -4, 2.9, -STORE.d / 2 + 0.12, 0);
  mural('Everyday Essentials', 'aisle 4', '#4a5568', 6.5, 4, 2.9, -STORE.d / 2 + 0.12, 0);
  // EXIT sign over doors
  const exit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.08), new THREE.MeshStandardMaterial({ map: canvasTex(256, 112, (x) => {
    x.fillStyle = '#101418'; x.fillRect(0, 0, 256, 112);
    x.fillStyle = '#48e07a'; x.textAlign = 'center'; x.font = `800 74px ${FONTS}`; x.fillText('EXIT', 128, 82);
  }), emissive: 0x35c46a, emissiveIntensity: 0.55, roughness: 0.6 }));
  exit.position.set(0, 2.62, STORE.d / 2 - 0.22); scene.add(exit);
  // wall clock (back wall)
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x) => {
    x.fillStyle = '#f4f6f8'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#22262b'; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 52); x.stroke();
    x.beginPath(); x.moveTo(128, 128); x.lineTo(184, 148); x.stroke();
  }), roughness: 0.6 }));
  clock.position.set(0, 2.95, -STORE.d / 2 + 0.1); scene.add(clock);
  // security cameras (front corners)
  for (const s of [-1, 1]) {
    const cam = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), METAL(0x22262a, 0.6));
    arm.rotation.z = s * 0.7; arm.position.y = 0.1; cam.add(arm);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.1), PLASTIC(0xe8ebee, 0.35));
    body.position.set(-s * 0.12, -0.04, 0); body.rotation.y = s * 0.6; body.rotation.z = -0.18; cam.add(body);
    cam.position.set(s * (STORE.w / 2 - 0.35), STORE.h - 0.35, STORE.d / 2 - 0.4);
    scene.add(cam);
  }
  // staff double-door + restroom sign (back-left corner)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.3), new THREE.MeshStandardMaterial({ map: canvasTex(380, 460, (x) => {
    x.fillStyle = '#9aa1a8'; x.fillRect(0, 0, 380, 460);
    x.strokeStyle = '#7c838a'; x.lineWidth = 6; x.strokeRect(4, 4, 372, 452);
    x.beginPath(); x.moveTo(190, 0); x.lineTo(190, 460); x.stroke();
    x.fillStyle = '#2c3238';
    for (const cx of [95, 285]) { x.beginPath(); x.ellipse(cx, 150, 34, 52, 0, 0, Math.PI * 2); x.fill(); }
    x.fillStyle = '#c4cace'; x.fillRect(20, 380, 340, 56); // kick plates
    x.fillStyle = '#333'; x.textAlign = 'center'; x.font = `700 30px ${FONTS}`;
    x.fillText('EMPLOYEES ONLY', 190, 62);
  }), roughness: 0.7 }));
  door.position.set(-9, 1.15, -STORE.d / 2 + 0.09); scene.add(door);
  const wc = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.24), new THREE.MeshStandardMaterial({ map: canvasTex(340, 96, (x) => {
    x.fillStyle = '#173a63'; x.fillRect(0, 0, 340, 96);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 44px ${FONTS}`; x.fillText('RESTROOMS →', 170, 64);
  }), roughness: 0.7 }));
  wc.position.set(-9, 2.5, -STORE.d / 2 + 0.09); scene.add(wc);
}

// floor props: wet-floor cone, bins, gumball machines, welcome mat
function floorProps(scene, colliders) {
  // wet floor cone near the freezers
  const cone = new THREE.Group();
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 14), new THREE.MeshStandardMaterial({ color: 0xf2c81b, roughness: 0.5 }));
  c1.position.y = 0.27; cone.add(c1);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.34), new THREE.MeshStandardMaterial({ color: 0xd9b214, roughness: 0.55 }));
  base.position.y = 0.02; cone.add(base);
  const band = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xf6f7f2, roughness: 0.5 }));
  band.position.y = 0.33; cone.add(band);
  cone.position.set(7.35, 0, -3.4); scene.add(cone); // off the NPC walk line
  colliders.push({ minX: 7.15, maxX: 7.55, minZ: -3.6, maxZ: -3.2 });
  // trash bin by the entrance
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.72, 16), PLASTIC(0x2e4a3a, 0.6));
  bin.position.set(2.4, 0.36, 12.1); bin.castShadow = true; scene.add(bin);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 16), PLASTIC(0x223a2c, 0.5));
  lid.position.set(2.4, 0.75, 12.1); scene.add(lid);
  colliders.push({ minX: 2.1, maxX: 2.7, minZ: 11.8, maxZ: 12.4 });
  // gumball machines
  for (const [gx, tint] of [[-2.9, 0xc9241a], [-3.45, 0x1f6fc2]]) {
    const g = new THREE.Group();
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.62, 14), PLASTIC(tint, 0.35));
    foot.position.y = 0.31; g.add(foot);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
      x.fillStyle = '#eef2f5'; x.fillRect(0, 0, 128, 128);
      const cols = ['#c9241a', '#1f6fc2', '#2e8b57', '#e0a01f', '#7a3fb5'];
      for (let i = 0; i < 40; i++) { x.fillStyle = cols[i % 5]; x.beginPath(); x.arc(10 + (i * 37) % 108, 60 + (i * 23) % 60, 8, 0, Math.PI * 2); x.fill(); }
    }), roughness: 0.15, envMapIntensity: 1.6 }));
    globe.position.y = 0.76; g.add(globe);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.08, 12), PLASTIC(tint, 0.35));
    cap.position.y = 0.96; g.add(cap);
    g.position.set(gx, 0, 12.2); scene.add(g);
  }
  colliders.push({ minX: -3.7, maxX: -2.6, minZ: 11.9, maxZ: 12.5 });
  // welcome mat inside the doors
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (x) => {
    x.fillStyle = '#3a3f45'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#22262b'; x.lineWidth = 14; x.strokeRect(10, 10, 492, 236);
    x.fillStyle = '#b9c0c7'; x.textAlign = 'center'; x.font = `800 72px ${FONTS}`;
    x.fillText('WELCOME', 256, 152);
  }), roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.008, 11.9); scene.add(mat);
}

// yellow deal tags sprinkled along shelf rails
function saleTags(scene, rng) {
  const texts = [saleTagTex('2 FOR', '$5.00'), saleTagTex('SAVE', '$1.00'), saleTagTex('NEW!', 'try me', '#c9241a', '#fff')];
  const geo = new THREE.PlaneGeometry(0.1, 0.058);
  for (let t = 0; t < texts.length; t++) {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: texts[t], roughness: 0.7 }), 18);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 18; i++) {
      const island = [-6, -2, 2, 6][Math.floor(rng() * 4)];
      const face = rng() < 0.5 ? 1 : -1;
      const y = shelfYs[Math.floor(rng() * shelfYs.length)] - 0.045;
      const z = -2 + (rng() - 0.5) * 12;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face === 1 ? Math.PI / 2 : -Math.PI / 2);
      m4.compose(p.set(island + face * 0.436, y - 0.028, z), q, one);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); scene.add(im);
  }
}

// ------------------------------------------------------------- price tags
// One InstancedMesh per SKU (tags share geometry; texture differs per SKU).
function buildTags(scene, tagSlots) {
  const geo = new THREE.PlaneGeometry(0.09, 0.034);
  const bySpec = new Map();
  for (const t of tagSlots) {
    if (!bySpec.has(t.spec.id)) bySpec.set(t.spec.id, { spec: t.spec, list: [] });
    bySpec.get(t.spec.id).list.push(t);
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  for (const { spec, list } of bySpec.values()) {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: priceTagTexture(spec), roughness: 0.6 }), list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotY);
      p.set(t.x, t.y, t.z);
      im.setMatrixAt(i, m.compose(p, q, sc));
    });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    scene.add(im);
  }
}

// ------------------------------------------------------------- assemble
export function buildStore(scene, loader) {
  scene.background = new THREE.Color(0x0d1013);
  scene.fog = new THREE.Fog(0x11151a, 24, 46);
  let seed = 1337;
  const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

  const { w, d, h } = STORE;
  const slots = [];      // instanced product placements (world space)
  const tagSlots = [];   // instanced price tags (world space)
  const colliders = [];

  // waxed look via low roughness + boosted env reflection (clearcoat is too
  // costly per-pixel on integrated GPUs for a floor this large)
  const floorMat = loadPBR(loader, 'floor', [w / 2, d / 2], { roughness: 0.55, envMapIntensity: 1.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  const wallMat = loadPBR(loader, 'wall', [w / 3, h / 3]);
  const wallMatZ = loadPBR(loader, 'wall', [d / 3, h / 3]);
  const mkWall = (mat, W, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, h), mat);
    m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  };
  mkWall(wallMat, w, 0, -d / 2, 0);
  mkWall(wallMatZ, d, -w / 2, 0, Math.PI / 2);
  mkWall(wallMatZ, d, w / 2, 0, -Math.PI / 2);
  // storefront: glass panels with mullions flanking the door gap, so the
  // parking lot reads through from inside
  {
    const gap = 3.4;
    const glassM = new THREE.MeshStandardMaterial({ color: 0xa9c9e0, transparent: true, opacity: 0.06, roughness: 0.08, metalness: 0.1, envMapIntensity: 0.45, side: THREE.DoubleSide });
    const mullion = METAL(0x2e3338, 0.5);
    for (const s of [-1, 1]) {
      const x0 = s * (gap / 2), x1 = s * (w / 2); // door edge -> corner
      const segW = Math.abs(x1 - x0);
      const cx = (x0 + x1) / 2;
      // knee wall + header band + glass between
      const knee = new THREE.Mesh(new THREE.BoxGeometry(segW, 0.85, 0.14), PAINTED(0x585f66, 0.6));
      knee.position.set(cx, 0.425, d / 2 - 0.02); knee.receiveShadow = true; scene.add(knee);
      const header = new THREE.Mesh(new THREE.BoxGeometry(segW, h - 2.75, 0.14), wallMat);
      header.position.set(cx, 2.75 + (h - 2.75) / 2, d / 2 - 0.02); scene.add(header);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(segW, 1.9), glassM);
      glass.position.set(cx, 1.8, d / 2 - 0.02); glass.rotation.y = Math.PI; scene.add(glass);
      for (let i = 0; i <= 4; i++) {
        const mx = x0 + (s > 0 ? 1 : -1) * (segW / 4) * i;
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.9, 0.12), mullion);
        mull.position.set(mx, 1.8, d / 2 - 0.02); scene.add(mull);
      }
      // window posters (facing inward)
      const posters = [['WEEKLY SALE', '#c9241a'], ['FRESH DAILY', '#1d5c38']];
      const [txt, bg] = posters[s > 0 ? 0 : 1];
      const poster = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.1), new THREE.MeshStandardMaterial({ map: canvasTex(384, 288, (x) => {
        x.fillStyle = bg; x.fillRect(0, 0, 384, 288);
        x.fillStyle = '#fff'; x.textAlign = 'center';
        x.font = `800 52px ${FONTS}`;
        const words = txt.split(' ');
        x.fillText(words[0], 192, 120); x.fillText(words[1] || '', 192, 186);
        x.fillStyle = '#ffd23b'; x.font = `700 30px ${FONTS}`; x.fillText('★ ★ ★', 192, 246);
      }), roughness: 0.8 }));
      poster.position.set(cx + s * 1.6, 1.75, d / 2 - 0.1); poster.rotation.y = Math.PI; scene.add(poster);
    }
  }

  lighting(scene);

  // four island gondolas
  const islandLen = 14, islandZ = -2;
  const faces = [
    [['pantry', 'pantry', 'snacks', 'pantry'], ['snacks', 'pantry', 'pantry', 'snacks']],
    [['snacks', 'snacks', 'pantry', 'snacks'], ['pantry', 'snacks', 'snacks', 'pantry']],
    [['dairy', 'dairy', 'dairy', 'dairy'], ['pantry', 'pantry', 'snacks', 'pantry']],
    [['household', 'household', 'household', 'household'], ['dairy', 'dairy', 'dairy', 'dairy']],
  ];
  [-6, -2, 2, 6].forEach((x, i) => {
    const local = [], localTags = [];
    const gd = gondola(local, localTags, islandLen, faces[i], rng);
    gd.position.set(x, 0, islandZ); scene.add(gd);
    emitSlots(gd, local, slots); emitSlots(gd, localTags, tagSlots);
    colliders.push({ minX: x - 0.52, maxX: x + 0.52, minZ: islandZ - islandLen / 2 - 0.1, maxZ: islandZ + islandLen / 2 + 0.1 });
  });
  const signs = [['1', 'Cereal · Breakfast', 'Canned Goods'], ['2', 'Snacks · Candy', 'Soda · Water'], ['3', 'Pasta · Sauce', 'Dairy · Eggs'], ['4', 'Household', 'Paper Goods']];
  [-8, -4, 0, 4].forEach((x, i) => hangingSign(scene, aisleSignTex(...signs[i]), 1.7, x + 2, 2.75, -2));

  // wall shelving
  {
    const local = [], localTags = [];
    const backShelf = wallShelf(local, localTags, 16, ['bakery', 'bakery', 'snacks', 'pantry'], rng);
    backShelf.position.set(0, 0, -d / 2 + 0.28); backShelf.rotation.y = -Math.PI / 2; scene.add(backShelf);
    emitSlots(backShelf, local, slots); emitSlots(backShelf, localTags, tagSlots);
    colliders.push({ minX: -8.2, maxX: 8.2, minZ: -d / 2, maxZ: -d / 2 + 0.6 });
  }
  {
    const local = [], localTags = [];
    const leftShelf = wallShelf(local, localTags, 14, ['household', 'pantry', 'household', 'snacks'], rng);
    leftShelf.position.set(-w / 2 + 0.28, 0, -2); scene.add(leftShelf);
    emitSlots(leftShelf, local, slots); emitSlots(leftShelf, localTags, tagSlots);
    colliders.push({ minX: -w / 2, maxX: -w / 2 + 0.6, minZ: -9.2, maxZ: 5.2 });
  }

  colliders.push(freezerWall(scene, slots, rng));
  const woodMat = loadPBR(loader, 'wood', [2, 1.4]);
  colliders.push(...produceCorner(scene, slots, woodMat, rng));
  const co = checkoutLanes(scene);
  colliders.push(...co.colliders);
  colliders.push(...cartsAndBaskets(scene));
  const doors = entrance(scene);

  // set dressing (endcaps + checkout racks add product slots — before buildStock)
  exterior(scene);
  endcaps(scene, slots, colliders, rng);
  palletStacks(scene, colliders, rng);
  checkoutExtras(scene, slots, rng);
  produceExtras(scene);
  wallDressing(scene);
  floorProps(scene, colliders);
  saleTags(scene, rng);

  // instantiate all products + price tags
  const stock = buildStock(scene, slots);
  buildTags(scene, tagSlots);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), new THREE.MeshStandardMaterial({ color: 0x35c46a, emissive: 0x35c46a, emissiveIntensity: 1.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(co.point.x, 0.02, co.point.z);
  ring.visible = false; scene.add(ring);

  const bounds = { minX: -w / 2 + 0.45, maxX: w / 2 - 0.45, minZ: -d / 2 + 0.45, maxZ: d / 2 - 0.5 };
  const corridors = { xs: [-8, -4, 0, 4, 8], zMin: -9.8, zMax: 5.4, crossZ: [6.3, -10.6] };

  let t = 0;
  // staff stand behind the registers of the two open lanes + one restocks
  const staffSpots = [
    { x: 3.0 - 0.75, z: 8.35, yaw: Math.PI / 2 },
    { x: 4.9 - 0.75, z: 8.35, yaw: Math.PI / 2 },
    { x: -6.95, z: -6.2, yaw: Math.PI / 2 }, // facing aisle-1 shelves, restocking
  ];

  return {
    colliders, bounds, stock, corridors, staffSpots,
    checkout: co.point, checkoutRing: ring,
    spawn: new THREE.Vector3(0, 1.65, 10.2), // clear of the cart-corral collider

    update(dt, camera) {
      t += dt;
      for (const door of doors) {
        const near = Math.hypot(camera.position.x - 0, camera.position.z - STORE.d / 2) < 4.2;
        door.t = THREE.MathUtils.clamp(door.t + (near ? dt : -dt) * 1.6, 0, 1);
        const e = door.t * door.t * (3 - 2 * door.t);
        door.g.position.x = THREE.MathUtils.lerp(door.closedX, door.openX, e);
      }
      if (ring.visible) { const s = 1 + Math.sin(t * 4) * 0.08; ring.scale.setScalar(s); }
    },
  };
}
