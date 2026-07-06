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
function shoppingCart() {
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
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fc4de, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, envMapIntensity: 2, side: THREE.DoubleSide });
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
  const gap = 3.4, seg = (w - gap) / 2;
  mkWall(wallMat, seg, -(gap / 2 + seg / 2), d / 2, Math.PI);
  mkWall(wallMat, seg, gap / 2 + seg / 2, d / 2, Math.PI);

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

  // instantiate all products + price tags
  const stock = buildStock(scene, slots);
  buildTags(scene, tagSlots);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), new THREE.MeshStandardMaterial({ color: 0x35c46a, emissive: 0x35c46a, emissiveIntensity: 1.4, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(co.point.x, 0.02, co.point.z);
  ring.visible = false; scene.add(ring);

  const bounds = { minX: -w / 2 + 0.45, maxX: w / 2 - 0.45, minZ: -d / 2 + 0.45, maxZ: d / 2 - 0.5 };
  const corridors = { xs: [-8, -4, 0, 4, 8], zMin: -9.8, zMax: 5.4, crossZ: [6.3, -10.6] };

  let t = 0;
  return {
    colliders, bounds, stock, corridors,
    checkout: co.point, checkoutRing: ring,
    spawn: new THREE.Vector3(0, 1.65, 11.6),
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
