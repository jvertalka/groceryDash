import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { loadPBR, METAL, PAINTED, PLASTIC } from './materials.js';
import { bySection, priceTagTexture } from './products.js';
import { buildStock } from './stock.js';
import { hasModel, cloneModel, cloneModelAtHeight, modelSize } from './models.js';

// Interior footprint (metres). Aisles run along Z.
export const STORE = { w: 46, d: 30, h: 4.2 };
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
}, [21, 14]);
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

  // all slabs/rails of the gondola merge into 2 meshes (was 16 draws)
  const slabGeos = [], railGeos = [];
  for (const face of [1, -1]) {
    const sections = sectionsByFace[face === 1 ? 0 : 1];
    for (let si = 0; si < shelfYs.length; si++) {
      const y = shelfYs[si];
      const sg = new THREE.BoxGeometry(HD, 0.03, length);
      sg.translate(face * HD / 2, y - 0.015, 0); slabGeos.push(sg);
      const rg = new THREE.BoxGeometry(0.012, 0.055, length);
      rg.translate(face * (HD - 0.006), y - 0.03, 0); railGeos.push(rg);
      stockShelf(localSlots, tagSlots, face, HD, y, length, sections[si % sections.length], rng);
    }
  }
  const slabs = new THREE.Mesh(mergeGeometries(slabGeos), shelfMetal);
  slabs.castShadow = slabs.receiveShadow = true; g.add(slabs);
  g.add(new THREE.Mesh(mergeGeometries(railGeos), PAINTED(0xf7f9fb, 0.55)));
  return g;
}

function wallShelf(localSlots, tagSlots, length, sections, rng) {
  const g = new THREE.Group();
  const H = 2.0, D = 0.45;
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, length), new THREE.MeshStandardMaterial({ map: pegboardTex(), roughness: 0.8 }));
  bp.position.set(-D / 2, H / 2, 0); bp.receiveShadow = true; g.add(bp);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(D, 0.12, length), PAINTED(0x2b3038, 0.5));
  kb.position.y = 0.06; g.add(kb);
  const slabGeos = [], railGeos = [];
  for (let si = 0; si < shelfYs.length; si++) {
    const y = shelfYs[si];
    const sg = new THREE.BoxGeometry(D, 0.03, length);
    sg.translate(0, y - 0.015, 0); slabGeos.push(sg);
    const rg = new THREE.BoxGeometry(0.012, 0.055, length);
    rg.translate(D / 2 - 0.006, y - 0.03, 0); railGeos.push(rg);
    stockShelf(localSlots, tagSlots, 1, D / 2 + 0.16, y, length, sections[si % sections.length], rng);
  }
  const slabs = new THREE.Mesh(mergeGeometries(slabGeos), METAL(0xc4cace, 0.34));
  slabs.castShadow = slabs.receiveShadow = true; g.add(slabs);
  g.add(new THREE.Mesh(mergeGeometries(railGeos), PAINTED(0xf7f9fb, 0.55)));
  return g;
}

// ------------------------------------------------------------- freezer wall
function freezerWall(scene, slots, rng) {
  // runs along the LEFT wall (grocery side), doors facing +x into the store
  const g = new THREE.Group();
  const doors = 10, pitch = 1.15, W = 1.02, H = 2.05, D = 0.72;
  const frame = METAL(0x3a3f45, 0.4);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbfd8ea, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.1, envMapIntensity: 2.2, side: THREE.DoubleSide });
  const innerMat = PAINTED(0x1c2126, 0.85);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdcecff, emissiveIntensity: 1.6, roughness: 1 });
  const pool = bySection('frozen');
  const unitX = -(STORE.w / 2 - D - 0.02);

  // every repeated part is ONE InstancedMesh across all 10 doors
  const parts = [
    { geo: new THREE.BoxGeometry(D, H, pitch), mat: innerMat, per: [[D / 2, H / 2, 0, 0]] },
    { geo: new THREE.BoxGeometry(D - 0.2, 0.025, W - 0.12), mat: METAL(0xb9c0c7, 0.4), per: [0.5, 0.95, 1.4].map((sy) => [D / 2 - 0.04, sy, 0, 0]) },
    { geo: new THREE.BoxGeometry(0.02, 0.02, W - 0.14), mat: ledMat, per: [0.5, 0.95, 1.4].map((sy) => [0.1, sy + 0.32, 0, 0]) },
    { geo: new THREE.BoxGeometry(0.05, H, W), mat: frame, per: [[-0.02, H / 2, 0, 0]] },
    { geo: new THREE.PlaneGeometry(W - 0.14, H - 0.18), mat: glassMat, per: [[-0.05, H / 2, 0, -Math.PI / 2]] },
    { geo: new THREE.CylinderGeometry(0.016, 0.016, 0.5, 8), mat: METAL(0xd7dde3, 0.25), per: [[-0.09, H / 2, W / 2 - 0.14, 0]] },
  ];
  const mUnit = new THREE.Matrix4(), mLocal = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let glassIM = null;
  for (const part of parts) {
    const im = new THREE.InstancedMesh(part.geo, part.mat, doors * part.per.length);
    let ii = 0;
    for (let i = 0; i < doors; i++) {
      const z = -((doors - 1) * pitch) / 2 + i * pitch;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); // face +x
      mUnit.compose(p.set(unitX, 0, z), q, one);
      for (const [lx, ly, lz, lry] of part.per) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), lry);
        mLocal.compose(p.set(lx, ly, lz), q, one);
        im.setMatrixAt(ii++, new THREE.Matrix4().multiplyMatrices(mUnit, mLocal));
      }
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
    if (part.mat === glassMat) glassIM = im;
    g.add(im);
  }
  // per-door breakable glass registry for the physics layer
  const glassDoors = [];
  for (let i = 0; i < doors; i++) {
    const z = -((doors - 1) * pitch) / 2 + i * pitch;
    glassDoors.push({
      index: i, broken: false, x: unitX + 0.05, z, y: H / 2, w: W - 0.14, h: H - 0.18,
      // interior region for spilling the frozen stock when broken
      spill: { minX: unitX - D, maxX: unitX, minZ: z - pitch / 2, maxZ: z + pitch / 2 },
    });
  }
  // frozen stock slots (world coords, unchanged)
  for (let i = 0; i < doors; i++) {
    const z = -((doors - 1) * pitch) / 2 + i * pitch;
    for (const sy of [0.5, 0.95, 1.4]) for (let k = 0; k < 3; k++) {
      const spec = pool[Math.floor(rng() * pool.length)];
      slots.push({ spec, x: unitX - (D / 2 - 0.04), y: sy + 0.013, z: z - 0.3 + k * 0.3, rotY: Math.PI / 2, grabbable: false });
    }
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(D, 0.5, doors * pitch), PAINTED(0x173a63, 0.6));
  band.position.set(-(STORE.w / 2 - D / 2 - 0.02), H + 0.25, 0);
  g.add(band);
  scene.add(g);
  hangingSign(scene, bannerTex('FROZEN', '#1f5f8a'), 3.2, -(STORE.w / 2 - 1.6), 2.95, 0, Math.PI / 2);
  return {
    collider: { minX: -STORE.w / 2, maxX: -(STORE.w / 2 - D - 0.15), minZ: -(doors * pitch) / 2 - 0.1, maxZ: (doors * pitch) / 2 + 0.1 },
    glass: { im: glassIM, doors: glassDoors },
  };
}

// ------------------------------------------------------------- produce corner
function produceCorner(scene, slots, woodMat, rng) {
  const colliders = [];
  const tables = [
    { x: -20.4, z: 9.4, id: 'apple' }, { x: -17.6, z: 9.4, id: 'lemon' }, { x: -14.8, z: 9.4, id: 'avocado' },
    { x: -20.4, z: 12.0, id: 'banana', gx: 4, gz: 3, step: 0.36 }, { x: -17.6, z: 12.0, id: 'onion' }, { x: -14.8, z: 12.0, id: 'sweetpotato' },
  ];
  for (const t of tables) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.1, 1.15), woodMat);
    top.position.y = 0.82; top.castShadow = top.receiveShadow = true; g.add(top);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.72, 1.0), woodMat);
    skirt.position.y = 0.41; skirt.castShadow = true; g.add(skirt);
    // rim is a FRAME (four strips), not a slab — a slab swallows the fruit
    for (const [rw, rd, rx, rz] of [[1.74, 0.06, 0, 0.585], [1.74, 0.06, 0, -0.585], [0.06, 1.11, 0.87, 0], [0.06, 1.11, -0.87, 0]]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(rw, 0.1, rd), woodMat);
      strip.position.set(rx, 0.9, rz); g.add(strip);
    }
    const spec = bySection('produce').find((p) => p.id === t.id);
    const gx = t.gx || 6, gz = t.gz || 4, step = t.step || 0.24;
    for (let ix = 0; ix < gx; ix++) for (let iz = 0; iz < gz; iz++) {
      if (rng() < 0.12) continue;
      slots.push({
        spec,
        x: t.x - ((gx - 1) * step) / 2 + ix * step + (rng() - 0.5) * 0.04,
        y: 0.875,
        z: t.z - ((gz - 1) * step * 0.8) / 2 + iz * step * 0.8 + (rng() - 0.5) * 0.04,
        rotY: rng() * Math.PI * 2,
      });
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.23), new THREE.MeshStandardMaterial({ map: chalkTex(spec.name.split(' ').pop(), `$${spec.price.toFixed(2)} ${spec.weight}`), roughness: 0.9 }));
    sign.position.set(0, 1.06, 0.62); sign.rotation.x = -0.18; g.add(sign);
    g.position.set(t.x, 0, t.z);
    scene.add(g);
    colliders.push({ minX: t.x - 0.9, maxX: t.x + 0.9, minZ: t.z - 0.62, maxZ: t.z + 0.62 });
  }
  hangingSign(scene, bannerTex('PRODUCE', '#1d5c38'), 3.4, -17.7, 2.95, 10.7);
  return colliders;
}

// ------------------------------------------------------------- checkout lanes
function checkoutLanes(scene) {
  const colliders = [];
  const beltMat = new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.28, metalness: 0.2, envMapIntensity: 1.4 });
  const counterMat = PAINTED(0xd8dde2, 0.55);
  // each repeated lane part merges across all 6 lanes (30 draws -> 5)
  const geos = { counter: [], belt: [], bag: [], reader: [], pole: [] };
  const lampMeshes = [];
  for (let i = 0; i < 6; i++) {
    const x = -10.5 + i * 1.9, z = 10.6;
    const cg = new THREE.BoxGeometry(0.72, 0.92, 2.6); cg.translate(x, 0.46, z); geos.counter.push(cg);
    const bg = new THREE.BoxGeometry(0.5, 0.04, 1.7); bg.translate(x, 0.94, z - 0.2); geos.belt.push(bg);
    const gg = new THREE.BoxGeometry(0.72, 0.06, 0.7); gg.translate(x, 0.95, z + 1.0); geos.bag.push(gg);
    const rg = new THREE.BoxGeometry(0.12, 0.18, 0.1); rg.rotateZ(-0.25); rg.translate(x + 0.45, 1.06, z + 0.5); geos.reader.push(rg);
    const pg = new THREE.CylinderGeometry(0.025, 0.025, 1.5, 10); pg.translate(x, 1.65, z + 1.15); geos.pole.push(pg);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), new THREE.MeshStandardMaterial({ map: laneNumTex(String(i + 1)), emissive: 0x8affb0, emissiveIntensity: 0.2, emissiveMap: laneNumTex(String(i + 1)), roughness: 0.6 }));
    lamp.position.set(x, 2.45, z + 1.15); lampMeshes.push(lamp);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 1.35, maxZ: z + 1.35 });
  }
  const counters = new THREE.Mesh(mergeGeometries(geos.counter), counterMat);
  counters.castShadow = counters.receiveShadow = true; scene.add(counters);
  scene.add(new THREE.Mesh(mergeGeometries(geos.belt), beltMat));
  scene.add(new THREE.Mesh(mergeGeometries(geos.bag), METAL(0xb9c0c7, 0.3)));
  scene.add(new THREE.Mesh(mergeGeometries(geos.reader), PLASTIC(0x22262a, 0.4)));
  scene.add(new THREE.Mesh(mergeGeometries(geos.pole), METAL(0x9aa1a8, 0.4)));
  for (const l of lampMeshes) scene.add(l);
  // photoscanned cash registers on the two staffed lanes
  if (hasModel('prop_register')) {
    for (const lx of [-10.5, -8.6]) {
      const reg = cloneModelAtHeight('prop_register', 0.34, { castShadow: true });
      reg.position.set(lx, 0.92, 10.05);
      reg.rotation.y = -Math.PI / 2; // screen toward the cashier
      scene.add(reg);
    }
  }
  hangingSign(scene, bannerTex('CHECKOUT', '#8a5a12'), 3.4, -5.75, 2.95, 10.6);
  return { colliders, point: new THREE.Vector3(-7.65, 0, 11.1) };
}

// ------------------------------------------------------------- carts & baskets
function cartGridTex() {
  return canvasTex(128, 128, (x) => {
    x.clearRect(0, 0, 128, 128);
    x.strokeStyle = '#c9ced4'; x.lineWidth = 5;
    for (let i = 0; i <= 128; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
  });
}
// Real wire cart: a tapered lattice basket built from ~90 actual bars, merged
// once into a single chrome geometry (so every cart costs ~4 draws). The
// taper (narrow low front, wide high back) is what makes a cart read "cart".
let _cartGeo = null;
function buildCartGeometry() {
  const bars = [];
  const bar = (x1, y1, z1, x2, y2, z2, r = 0.008) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(r * 2, len, r * 2);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.applyQuaternion(q);
    g.translate(a.x, a.y, a.z);
    bars.push(g);
  };
  // basket footprint: back (handle end, x-) is wider/taller than front (x+)
  const bkW = 0.30, bkY = 1.0;   // back half-width / rim height
  const ftW = 0.24, ftY = 0.88;  // front half-width / rim height
  const bBotW = 0.22, fBotW = 0.18, botY = 0.55; // floor
  const xB = -0.42, xF = 0.46;
  const lerp = (a, b, t) => a + (b - a) * t;
  // rim + floor perimeter rails (thicker)
  bar(xB, bkY, -bkW, xF, ftY, -ftW, 0.011); bar(xB, bkY, bkW, xF, ftY, ftW, 0.011);
  bar(xF, ftY, -ftW, xF, ftY, ftW, 0.011);  bar(xB, bkY, -bkW, xB, bkY, bkW, 0.011);
  bar(xB, botY, -bBotW, xF, botY, -fBotW); bar(xB, botY, bBotW, xF, botY, fBotW);
  bar(xF, botY, -fBotW, xF, botY, fBotW);  bar(xB, botY, -bBotW, xB, botY, bBotW);
  // side lattices: verticals + one mid horizontal each side
  for (let i = 0; i <= 8; i++) {
    const t = i / 8, x = lerp(xB, xF, t);
    for (const s of [-1, 1]) bar(x, botY, s * lerp(bBotW, fBotW, t), x, lerp(bkY, ftY, t), s * lerp(bkW, ftW, t));
  }
  for (const s of [-1, 1]) bar(xB, (bkY + botY) / 2, s * (bkW + bBotW) / 2, xF, (ftY + botY) / 2, s * (ftW + fBotW) / 2);
  // front + back walls
  for (let i = 0; i <= 5; i++) {
    const tf = i / 5;
    bar(xF, botY, lerp(-fBotW, fBotW, tf), xF, ftY, lerp(-ftW, ftW, tf));
    bar(xB, botY, lerp(-bBotW, bBotW, tf), xB, bkY, lerp(-bkW, bkW, tf));
  }
  bar(xF, (ftY + botY) / 2, -((ftW + fBotW) / 2), xF, (ftY + botY) / 2, (ftW + fBotW) / 2);
  // basket floor grid
  for (let i = 0; i <= 4; i++) {
    const t = i / 4;
    bar(xB, botY, lerp(-bBotW, bBotW, t), xF, botY, lerp(-fBotW, fBotW, t));
  }
  for (let i = 1; i <= 3; i++) {
    const t = i / 4, x = lerp(xB, xF, t);
    bar(x, botY, -lerp(bBotW, fBotW, t), x, botY, lerp(bBotW, fBotW, t));
  }
  // chassis: handle uprights, U-frame down to the wheels, lower tray
  bar(xB - 0.02, bkY, -bkW, xB - 0.1, 1.06, -bkW, 0.012); bar(xB - 0.02, bkY, bkW, xB - 0.1, 1.06, bkW, 0.012);
  bar(xB - 0.06, 0.12, -bkW + 0.04, xB - 0.02, bkY, -bkW, 0.012); bar(xB - 0.06, 0.12, bkW - 0.04, xB - 0.02, bkY, bkW, 0.012);
  bar(xF - 0.02, 0.12, -ftW, xF - 0.06, botY, -ftW, 0.012); bar(xF - 0.02, 0.12, ftW, xF - 0.06, botY, ftW, 0.012);
  bar(xB - 0.06, 0.12, -bkW + 0.04, xF - 0.02, 0.12, -ftW, 0.012); bar(xB - 0.06, 0.12, bkW - 0.04, xF - 0.02, 0.12, ftW, 0.012);
  bar(xB - 0.06, 0.12, -bkW + 0.04, xB - 0.06, 0.12, bkW - 0.04, 0.012);
  // merge → one geometry
  const merged = mergeGeometries(bars, false);
  bars.forEach((b) => b.dispose());
  return merged;
}
export function shoppingCart() {
  if (!_cartGeo) _cartGeo = buildCartGeometry();
  const g = new THREE.Group();
  const chrome = new THREE.Mesh(_cartGeo, METAL(0xc4cad0, 0.28));
  chrome.castShadow = true; g.add(chrome);
  // red plastic handle grip + child-seat flap
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.64, 10), PLASTIC(0xb3261a, 0.45));
  grip.rotation.x = Math.PI / 2; grip.position.set(-0.53, 1.065, 0); g.add(grip);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.5), PLASTIC(0xb3261a, 0.5));
  flap.position.set(-0.38, 0.82, 0); flap.rotation.z = 0.24; g.add(flap);
  // four caster wheels
  const wheelG = new THREE.CylinderGeometry(0.055, 0.055, 0.032, 12);
  const wheelM = PLASTIC(0x25282c, 0.5);
  for (const [dx, dz] of [[-0.42, -0.26], [-0.42, 0.26], [0.36, -0.2], [0.36, 0.2]]) {
    const w = new THREE.Mesh(wheelG, wheelM);
    w.rotation.x = Math.PI / 2; w.position.set(dx, 0.055, dz);
    g.add(w);
  }
  return g;
}
function cartsAndBaskets(scene) {
  const colliders = [];
  const rail = METAL(0x8f969c, 0.45);
  for (const dz of [-0.55, 0.55]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.6, 8), rail);
    r.rotation.z = Math.PI / 2; r.position.set(-2.4, 0.55, 13.9 + dz); scene.add(r);
  }
  // carts are DYNAMIC (physics layer) — only the corral rails collide, thin,
  // so shoved carts can escape out the open ends
  const c1 = shoppingCart(); c1.position.set(-2.9, 0, 13.9); c1.rotation.y = Math.PI / 2; scene.add(c1);
  const c2 = shoppingCart(); c2.position.set(-1.9, 0, 13.9); c2.rotation.y = Math.PI / 2; scene.add(c2);
  const c3 = shoppingCart(); c3.position.set(-1.2, 0, -3.2); c3.rotation.y = 2.3; scene.add(c3);
  const carts = [c1, c2, c3];
  colliders.push({ minX: -3.7, maxX: -1.1, minZ: 13.28, maxZ: 13.42 });
  colliders.push({ minX: -3.7, maxX: -1.1, minZ: 14.38, maxZ: 14.52 });
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), PLASTIC(0xc9241a, 0.45));
    b.position.set(1.5 + (i % 2) * 0.02, 0.11 + i * 0.09, 14.2);
    b.rotation.y = (i % 2) * 0.08; b.castShadow = true; scene.add(b);
  }
  colliders.push({ minX: 1.2, maxX: 1.8, minZ: 13.9, maxZ: 14.5 });
  return { colliders, carts };
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
    new THREE.MeshStandardMaterial({ map: bannerTex('GROCERY DASH SUPERCENTER', '#173a63'), emissive: 0x2a5a92, emissiveIntensity: 0.15, roughness: 0.6 }),
  );
  sign.position.set(0, 3.5, z - 0.12); sign.rotation.y = Math.PI; scene.add(sign);
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
// Shaped cars: the body is a side-profile Shape extruded across the car's
// width with a beveled edge, so hood/windshield/roof/trunk read correctly in
// silhouette — three profiles (sedan / SUV / hatchback) for lot variety.
const CAR_PROFILES = {
  sedan: [[-2.1, 0.3], [-2.08, 0.62], [-1.5, 0.68], [-0.85, 0.72], [-0.42, 1.24], [0.68, 1.22], [1.25, 0.78], [1.95, 0.7], [2.1, 0.62], [2.1, 0.32]],
  suv: [[-2.15, 0.32], [-2.12, 0.72], [-1.45, 0.8], [-0.95, 0.84], [-0.6, 1.5], [1.55, 1.46], [1.95, 0.9], [2.15, 0.8], [2.15, 0.34]],
  hatch: [[-1.8, 0.3], [-1.78, 0.6], [-1.2, 0.66], [-0.62, 0.7], [-0.2, 1.3], [1.0, 1.28], [1.55, 0.62], [1.8, 0.56], [1.8, 0.32]],
};
function carBodyGeo(kind, width) {
  const pts = CAR_PROFILES[kind];
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.09, bevelSegments: 3, steps: 1 });
  g.translate(0, -0.02, -width / 2);
  return g;
}
const _carGeoCache = {};
function car(color, kind = 'sedan') {
  const g = new THREE.Group();
  const key = kind;
  if (!_carGeoCache[key]) {
    _carGeoCache[key] = { body: carBodyGeo(kind, 1.62), glass: carBodyGeo(kind, 1.46) };
  }
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.72, envMapIntensity: 1.5, fog: false });
  const body = new THREE.Mesh(_carGeoCache[key].body, paint);
  body.rotation.y = Math.PI / 2; g.add(body);
  // dark glass cabin: a narrower copy of the upper body, peeking through
  const glassM = new THREE.MeshStandardMaterial({ color: 0x0c1016, roughness: 0.1, metalness: 0.4, envMapIntensity: 1.7, fog: false });
  const glass = new THREE.Mesh(_carGeoCache[key].glass, glassM);
  glass.rotation.y = Math.PI / 2; glass.scale.set(1, 1.015, 0.94); g.add(glass);
  // wheel positions recorded; the actual wheel/hub/arch meshes are built once
  // as fleet-wide InstancedMeshes in exterior() (saves ~90 draws)
  const wl = kind === 'hatch' ? 1.1 : 1.35;
  g.userData.wheelLocals = [];
  for (const dz of [-wl, wl]) for (const dx of [-0.78, 0.78]) g.userData.wheelLocals.push([dx, dz]);
  // lights + plate
  const len = CAR_PROFILES[kind][0][0] * -1;
  const headM = new THREE.MeshStandardMaterial({ color: 0xd8dee6, emissive: 0xbfd4e6, emissiveIntensity: 0.25, roughness: 0.2, fog: false });
  for (const dx of [-0.52, 0.52]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), headM);
    hl.position.set(dx, 0.62, -len - 0.02); g.add(hl);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.09, 0.05), new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2a1a, emissiveIntensity: 0.65, fog: false }));
  tail.position.set(0, 0.66, len * (kind === 'hatch' ? 0.99 : 1.0) + 0.02); g.add(tail);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.5, fog: false }));
  plate.position.set(0, 0.42, len + 0.055); g.add(plate);
  // side mirrors
  const mirM = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.6, fog: false });
  for (const s of [-1, 1]) {
    const mir = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.1), mirM);
    mir.position.set(s * 0.88, 0.95, -0.55); g.add(mir);
  }
  return g;
}
function exterior(scene, loader) {
  const zFront = STORE.d / 2;
  // sky dome + asphalt ground
  const dome = new THREE.Mesh(new THREE.SphereGeometry(85, 24, 12), new THREE.MeshBasicMaterial({ map: skyTex(), side: THREE.BackSide, fog: false }));
  dome.position.set(0, 0, zFront); scene.add(dome);
  // rained-earlier wet look: low roughness + strong env pickup = light streaks
  const lotMat = loadPBR(loader, 'asphalt', [26, 17], { fog: false, roughness: 0.5, envMapIntensity: 1.0 });
  const lot = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), lotMat);
  lot.rotation.x = -Math.PI / 2; lot.position.set(0, -0.02, zFront + 45); scene.add(lot);
  // sidewalk + curb face
  const walk = new THREE.Mesh(new THREE.BoxGeometry(46, 0.12, 3.2), new THREE.MeshStandardMaterial({ color: 0x8d939a, roughness: 0.9, fog: false }));
  walk.position.set(0, 0.04, zFront + 1.7); scene.add(walk);
  const curb = new THREE.Mesh(new THREE.BoxGeometry(46, 0.14, 0.12), new THREE.MeshStandardMaterial({ color: 0xa8aeb4, roughness: 0.8, fog: false }));
  curb.position.set(0, 0.05, zFront + 3.36); scene.add(curb);
  // crosswalk from the doors to the lot
  {
    const cwG = new THREE.PlaneGeometry(0.5, 3.4);
    const cwM = new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: 0.42, fog: false });
    const cw = new THREE.InstancedMesh(cwG, cwM, 5);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 5; i++) {
      m.makeRotationX(-Math.PI / 2);
      m.setPosition(-1.6 + i * 0.8, 0.002, zFront + 5.2);
      cw.setMatrixAt(i, m);
    }
    cw.instanceMatrix.needsUpdate = true; scene.add(cw);
  }
  // parking stripes + concrete wheel stops
  const stripeG = new THREE.PlaneGeometry(0.14, 4.6);
  const stripeM = new THREE.MeshBasicMaterial({ color: 0xd8dce0, transparent: true, opacity: 0.5, fog: false });
  const stripes = new THREE.InstancedMesh(stripeG, stripeM, 18);
  const bumpG = new THREE.BoxGeometry(1.55, 0.14, 0.22);
  const bumpM = new THREE.MeshStandardMaterial({ color: 0xb8b46e, roughness: 0.85, fog: false });
  const bumps = new THREE.InstancedMesh(bumpG, bumpM, 17);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 18; i++) {
    m4.makeRotationX(-Math.PI / 2);
    m4.setPosition(-22 + i * 2.6, 0.001, zFront + 7.8);
    stripes.setMatrixAt(i, m4);
    if (i < 17) {
      m4.identity(); m4.setPosition(-22 + i * 2.6 + 1.3, 0.07, zFront + 5.9);
      bumps.setMatrixAt(i, m4);
    }
  }
  stripes.instanceMatrix.needsUpdate = true; scene.add(stripes);
  bumps.instanceMatrix.needsUpdate = true; scene.add(bumps);
  // oil stains
  const stainTex = canvasTex(256, 256, (x) => {
    x.clearRect(0, 0, 256, 256);
    for (const [cx, cy, r, a] of [[128, 128, 80, 0.5], [95, 150, 46, 0.4], [170, 100, 34, 0.35]]) {
      const g = x.createRadialGradient(cx, cy, 4, cx, cy, r);
      g.addColorStop(0, `rgba(8,8,10,${a})`); g.addColorStop(1, 'rgba(8,8,10,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  });
  [[-9.2, 8.6, 1.7], [3.0, 9.4, 2.2], [-1.4, 12.5, 1.4]].forEach(([sx, sz, ss], i) => {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(ss, ss), new THREE.MeshBasicMaterial({ map: stainTex, transparent: true, depthWrite: false, fog: false }));
    st.rotation.x = -Math.PI / 2; st.rotation.z = i * 1.7;
    st.position.set(sx, 0.004, zFront + sz); scene.add(st);
  });
  // parked cars — mixed body styles
  const fleet = [
    [-20.7, 0.1, 0xd8dadd, 'suv'], [-15.5, -0.08, 0x6b2233, 'sedan'], [-12.7, 0.15, 0x8a1f1f, 'suv'],
    [-7.5, -0.1, 0x1f3f6e, 'sedan'], [-2.3, 0.05, 0xb9bcc0, 'hatch'],
    [5.5, -0.12, 0x24282d, 'sedan'], [10.7, 0.08, 0x4a5a4a, 'suv'], [15.9, -0.05, 0x2e5648, 'hatch'],
  ];
  if (hasModel('car_sedan')) {
    // real cars: Kenney Car Kit (CC0). Length axis auto-detected from the
    // bbox so we never guess which way the models face.
    const kitCars = ['car_sedan', 'car_suv', 'car_hatch', 'car_van', 'car_sedansport', 'car_suvlux', 'car_taxi', 'car_delivery'];
    for (let i = 0; i < fleet.length; i++) {
      const [cx, jitter] = fleet[i];
      const name = kitCars[i % kitCars.length];
      const size = modelSize(name);
      const c = cloneModel(name, { castShadow: true });
      const longest = Math.max(size.x, size.z);
      c.scale.setScalar((name === 'car_van' || name === 'car_delivery' ? 4.7 : 4.25) / longest);
      c.traverse((o) => { if (o.isMesh && o.material && o.material.fog !== false) { o.material = o.material.clone(); o.material.fog = false; } });
      const alignFix = size.x > size.z ? Math.PI / 2 : 0; // length along the stall depth
      c.position.set(cx, 0, zFront + 7.9 + (i % 2 ? 0.3 : -0.2));
      c.rotation.y = alignFix + jitter + (i % 2 ? Math.PI : 0);
      scene.add(c);
    }
  } else {
    // fallback: procedural extruded cars + fleet-wide instanced wheels
    const wheelXf = [], hubXf = [], archXf = [];
    for (let i = 0; i < fleet.length; i++) {
      const [cx, jitter, color, kind] = fleet[i];
      const c = car(color, kind);
      c.position.set(cx, 0, zFront + 7.9 + (i % 2 ? 0.3 : -0.2));
      c.rotation.y = jitter + (i % 2 ? Math.PI : 0);
      scene.add(c);
      c.updateMatrixWorld(true);
      for (const [dx, dz] of c.userData.wheelLocals) {
        const lw = new THREE.Matrix4().makeRotationZ(Math.PI / 2); lw.setPosition(dx, 0.31, dz);
        wheelXf.push(new THREE.Matrix4().multiplyMatrices(c.matrixWorld, lw));
        const lh = new THREE.Matrix4().makeRotationZ(Math.PI / 2); lh.setPosition(dx * 1.01, 0.31, dz);
        hubXf.push(new THREE.Matrix4().multiplyMatrices(c.matrixWorld, lh));
        const la = new THREE.Matrix4().makeRotationY(Math.PI / 2); la.setPosition(dx * 1.06, 0.31, dz);
        archXf.push(new THREE.Matrix4().multiplyMatrices(c.matrixWorld, la));
      }
    }
    const wheelSets = [
      [new THREE.CylinderGeometry(0.31, 0.31, 0.24, 16), new THREE.MeshStandardMaterial({ color: 0x0c0e11, roughness: 0.85, fog: false }), wheelXf],
      [new THREE.CylinderGeometry(0.14, 0.14, 0.26, 12), new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.3, metalness: 0.9, fog: false }), hubXf],
      [new THREE.TorusGeometry(0.36, 0.055, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.9, fog: false }), archXf],
    ];
    for (const [geo, mat, xfs] of wheelSets) {
      const im = new THREE.InstancedMesh(geo, mat, xfs.length);
      xfs.forEach((m, i) => im.setMatrixAt(i, m));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      scene.add(im);
    }
  }
  // red bollards guarding the storefront
  for (const bx of [-4.6, -2.5, 2.5, 4.6]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.85, 12), new THREE.MeshStandardMaterial({ color: 0xb3261a, roughness: 0.45, fog: false }));
    b.position.set(bx, 0.42, zFront + 3.7); scene.add(b);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb3261a, roughness: 0.45, fog: false }));
    cap.position.set(bx, 0.85, zFront + 3.7); scene.add(cap);
  }
  // outdoor cart-return corral with roof + abandoned carts
  {
    const g = new THREE.Group();
    const postM = new THREE.MeshStandardMaterial({ color: 0x5c636a, metalness: 0.85, roughness: 0.4, fog: false });
    for (const [px, pz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 10), postM);
      p.position.set(px, 1.1, pz); g.add(p);
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.07, 2.8), new THREE.MeshStandardMaterial({ color: 0x9c2a20, roughness: 0.5, fog: false }));
    roof.position.y = 2.25; roof.rotation.z = 0.05; g.add(roof);
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.9, 8), postM);
      rail.rotation.z = Math.PI / 2; rail.rotation.y = 0; rail.position.set(0, 0.5, s * 1.0);
      rail.rotation.set(Math.PI / 2, 0, Math.PI / 2); g.add(rail);
    }
    const c1 = shoppingCart(); c1.rotation.y = Math.PI / 2 + 0.12; c1.position.set(-0.6, 0, 0.1); g.add(c1);
    const c2 = shoppingCart(); c2.rotation.y = Math.PI / 2 - 0.07; c2.position.set(0.5, 0, -0.15); g.add(c2);
    g.traverse((o) => { if (o.isMesh && o.material && o.material.fog !== false) { o.material = o.material.clone(); o.material.fog = false; } });
    g.position.set(20.4, 0, zFront + 6.4);
    scene.add(g);
  }
  // lamp posts: fake light pools + volumetric-style cones + one flickerer
  const flicker = [];
  [-17, -3, 12].forEach((lx, li) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 5.6, 8), new THREE.MeshStandardMaterial({ color: 0x2f3338, roughness: 0.6, metalness: 0.8, fog: false }));
    pole.position.set(lx, 2.8, zFront + 6.2); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.36), new THREE.MeshStandardMaterial({ color: 0x30343a, emissive: 0xffd9a0, emissiveIntensity: 2.4, fog: false }));
    head.position.set(lx, 5.55, zFront + 6.5); scene.add(head);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.0, 24), new THREE.MeshBasicMaterial({ color: 0xffdCA0, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(lx, 0.0, zFront + 6.5); scene.add(pool);
    // soft light cone from head to ground (classic volumetric fake)
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 2.6, 5.4, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe0b0, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    cone.position.set(lx, 2.75, zFront + 6.5); scene.add(cone);
    if (li === 1) flicker.push({ head, pool, cone, t: 1, on: true }); // middle lamp is dying
  });
  // warm light spill from the storefront onto the sidewalk
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), new THREE.MeshBasicMaterial({
    map: canvasTex(128, 64, (x) => {
      const g = x.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, 'rgba(255,228,180,0.5)'); g.addColorStop(1, 'rgba(255,228,180,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 64);
    }),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.5,
  }));
  spill.rotation.x = -Math.PI / 2; spill.rotation.z = Math.PI;
  spill.position.set(0, 0.004, zFront + 2.3); scene.add(spill);
  // stars
  {
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.15 + Math.random() * 0.75;
      const r = 82;
      pos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      pos[i * 3 + 1] = Math.sin(e) * r;
      pos[i * 3 + 2] = zFront + Math.sin(a) * Math.cos(e) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcdd8e8, size: 0.22, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false }));
    scene.add(stars);
  }
  // distant strip-mall silhouettes with lit windows
  for (const [bx, bz, bw, bh] of [[-30, 34, 26, 9], [16, 40, 30, 7], [40, 26, 18, 11]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 10), new THREE.MeshBasicMaterial({ map: buildingTex(), fog: false }));
    b.position.set(bx, bh / 2, zFront + bz); scene.add(b);
  }
  return { flicker };
}

// ------------------------------------------------------------- baked light
// Runtime "bake": a floor lightmap painted from the real fixture positions —
// bright pools under every troffer run, warm washes at produce/checkout,
// darkness under fixtures and along the walls. Costs nothing per frame and
// reads as global illumination, which is the core of the AAA interior look.
function bakeFloorLightmap(floorMat) {
  const W = 1024, H = Math.round(1024 * STORE.d / STORE.w);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const u = (wx) => (wx + STORE.w / 2) / STORE.w * W;
  const v = (wz) => (wz + STORE.d / 2) / STORE.d * H;
  const sx = W / STORE.w, sz = H / STORE.d;
  // dim ambient base
  x.fillStyle = '#5e5e60'; x.fillRect(0, 0, W, H);
  // troffer corridor runs: soft bright bands along each corridor x
  for (const cx of [-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20]) {
    const g = x.createLinearGradient(u(cx) - 2.1 * sx, 0, u(cx) + 2.1 * sx, 0);
    g.addColorStop(0, 'rgba(255,250,238,0)');
    g.addColorStop(0.5, 'rgba(255,250,238,0.55)');
    g.addColorStop(1, 'rgba(255,250,238,0)');
    x.fillStyle = g;
    x.fillRect(u(cx) - 2.1 * sx, v(-13.5), 4.2 * sx, (13.5 + 13.8) * sz);
  }
  // warm pools under the feature spots (produce, checkout, pharmacy, alley)
  for (const [px, pz, r, a] of [[-17.7, 10.7, 5, 0.5], [-8.6, 10.6, 5, 0.42], [18.5, 10, 4.5, 0.4], [0, -6, 5, 0.35], [10, -7, 5, 0.35], [8.5, 4, 5, 0.35]]) {
    const g = x.createRadialGradient(u(px), v(pz), 2, u(px), v(pz), r * sx);
    g.addColorStop(0, `rgba(255,240,214,${a})`);
    g.addColorStop(1, 'rgba(255,240,214,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(u(px), v(pz), r * sx, 0, Math.PI * 2); x.fill();
  }
  // darkness under the fixtures (gondolas, freezer, back shelf, checkout row)
  x.fillStyle = 'rgba(20,20,24,0.42)';
  for (const gx of [-18, -14, -10, -6]) x.fillRect(u(gx - 0.6), v(-11.2), 1.2 * sx, 16.4 * sz);
  x.fillRect(u(-23), v(-5.9), 0.95 * sx, 11.8 * sz);            // freezer
  x.fillRect(u(-21.2), v(-14.8), 16.4 * sx, 0.8 * sz);          // back shelf
  x.fillRect(u(3.9), v(-8.1), 12.2 * sx, 1.2 * sz);             // merch island 1
  x.fillRect(u(3.9), v(-4.1), 12.2 * sx, 1.2 * sz);             // merch island 2
  x.fillRect(u(18.9), v(-7.2), 1.2 * sx, 10.4 * sz);            // toys island
  x.fillRect(u(-11.3), v(9.2), 10.7 * sx, 2.8 * sz);            // checkout row
  // perimeter falloff
  const edge = x.createLinearGradient(0, 0, 0, 8 * sz);
  edge.addColorStop(0, 'rgba(16,16,20,0.5)'); edge.addColorStop(1, 'rgba(16,16,20,0)');
  x.fillStyle = edge; x.fillRect(0, 0, W, 8 * sz);
  const edge2 = x.createLinearGradient(0, H, 0, H - 8 * sz);
  edge2.addColorStop(0, 'rgba(16,16,20,0.5)'); edge2.addColorStop(1, 'rgba(16,16,20,0)');
  x.fillStyle = edge2; x.fillRect(0, H - 8 * sz, W, 8 * sz);
  // soft blur pass for bake-like smoothness
  x.filter = 'blur(6px)'; x.drawImage(c, 0, 0); x.filter = 'none';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = true;
  floorMat.lightMap = tex;
  floorMat.lightMapIntensity = 1.15;
  floorMat.needsUpdate = true;
}

// ------------------------------------------------------------- lighting
function lighting(scene) {
  const y = STORE.h;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(STORE.w, STORE.d), new THREE.MeshStandardMaterial({ map: ceilingTex(), roughness: 0.95 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = y; scene.add(ceil);

  // instanced troffers: all fixtures in ONE draw call
  const corridorXs = [-20, -16, -12, -8, -4, 0, 4, 8, 12, 16, 20];
  const zs = []; for (let z = -12.6; z <= 13.2; z += 2.86) zs.push(z);
  // emissive kept moderate — high values here were the "everything glows" bug
  const trofferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.1, roughness: 1 });
  const troffers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.05, 2.1), trofferMat, corridorXs.length * zs.length);
  // fake floor reflections: an additive smear under every troffer sells a
  // freshly waxed supermarket floor for the cost of one more instanced draw
  const streaks = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(0.5, 3.1),
    new THREE.MeshBasicMaterial({ color: 0xfff3dd, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending, depthWrite: false }),
    corridorXs.length * zs.length,
  );
  const m = new THREE.Matrix4();
  let ti = 0;
  for (const x of corridorXs) for (const z of zs) {
    m.makeTranslation(x, y - 0.03, z); troffers.setMatrixAt(ti, m);
    m.makeRotationX(-Math.PI / 2); m.setPosition(x, 0.012, z); streaks.setMatrixAt(ti, m);
    ti++;
  }
  troffers.instanceMatrix.needsUpdate = true;
  streaks.instanceMatrix.needsUpdate = true; streaks.computeBoundingSphere();
  scene.add(troffers, streaks);

  for (const x of [-16, -8, 8, 16]) rectLight(scene, x, 0, 0.6, 27, 3.2);
  rectLight(scene, 0, 12.2, 0.6, 42, 2.4, Math.PI / 2);
  for (const [sx, sz] of [[-16, -6], [-8, -2], [-17.7, 10.7], [-8.6, 10.6], [0, -6], [10, -7], [8.5, 4], [18.5, 10]]) {
    const s = new THREE.SpotLight(0xfff4e6, 38, 17, Math.PI * 0.34, 0.55, 1.5);
    s.position.set(sx, y - 0.12, sz);
    s.target.position.set(sx, 0, sz);
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048); // maps are frozen after first render — crispness is free

    s.shadow.camera.near = 0.5; s.shadow.camera.far = 14; s.shadow.bias = -0.0005;
    scene.add(s, s.target);
  }
  // darker ambient floor = real contrast; the troffers/spots carve pools out
  // of it instead of everything sitting at the same mid-bright level
  scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x262421, 0.21));
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
function endcaps(scene, slots, colliders, rng, cullables) {
  const card = cardboardMat();
  const trayGeo = new THREE.BoxGeometry(0.78, 0.16, 0.5);
  const spots = [];
  for (const x of [-18, -14, -10, -6]) for (const s of [1, -1]) spots.push([x, -3 + s * (16 / 2 + 0.42)]);
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
    sign.position.set(ex, 1.35, ez + (ez > -3 ? 0.29 : -0.29));
    scene.add(sign);
    colliders.push({ minX: ex - 0.45, maxX: ex + 0.45, minZ: ez - 0.3, maxZ: ez + 0.3 });
  });
  trays.instanceMatrix.needsUpdate = true; trays.computeBoundingSphere(); scene.add(trays);
  if (cullables) cullables.push(trays);
}

// shrink-wrapped pallet stacks (water / soda cases) parked in dead corners
function palletStacks(scene, colliders, rng) {
  const woodM = new THREE.MeshStandardMaterial({ color: 0x9a7c50, roughness: 0.9 });
  const spots = [[-21.3, -14.0, 0x2a6fc0, 0.2], [21.3, -14.0, 0xc9241a, -0.15], [-1.5, -6, 0x2a6fc0, 0.5], [2.7, 9.9, 0xc9241a, 0.25]];
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
  for (let i = 0; i < 6; i++) {
    const x = -10.5 + i * 1.9;
    for (const dz of [-0.7, 0.15]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.035, 0.05), white);
      bar.position.set(x, 0.98, 10.6 + dz - 0.2); bar.rotation.y = (rng() - 0.5) * 0.2; scene.add(bar);
    }
    // candy strip on the lane side (small instanced product row)
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.2), PAINTED(0x9aa1a8, 0.5));
    rack.position.set(x + 0.42, 0.55, 10.2); scene.add(rack);
    const candy = bySection('snacks').filter((s) => s.kind === 'bag' || s.kind === 'box');
    for (const sy of [0.42, 0.62, 0.82]) for (let k = 0; k < 4; k++) {
      const spec = candy[Math.floor(rng() * candy.length)];
      slots.push({ spec, x: x + 0.5, y: sy - 0.12, z: 9.75 + k * 0.28, rotY: Math.PI / 2, grabbable: true });
    }
    // bag stand at the bagging end
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.06), METAL(0x8f969c, 0.4));
    stand.position.set(x, 1.2, 11.85); scene.add(stand);
    const bags = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.05), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.4, transparent: true, opacity: 0.9 }));
    bags.position.set(x, 1.12, 11.82); scene.add(bags);
  }
  // last lane closed: red lamp + sign
  const lamp3 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.06), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
    x.fillStyle = '#111418'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#d8362a'; x.textAlign = 'center'; x.font = `800 78px ${FONTS}`; x.fillText('✕', 64, 92);
  }), emissive: 0xd8362a, emissiveIntensity: 0.2, roughness: 0.6 }));
  lamp3.position.set(-1, 2.45, 11.75); scene.add(lamp3);
  const closed = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshStandardMaterial({ map: saleTagTex('LANE', 'CLOSED', '#d8dde2', '#333'), roughness: 0.7, side: THREE.DoubleSide }));
  closed.position.set(-1, 1.0, 11.9); scene.add(closed);
  // magazine rack by lane 1
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.8), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x) => {
    x.fillStyle = '#22262b'; x.fillRect(0, 0, 256, 256);
    const cols = ['#c9241a', '#1f6fc2', '#2e8b57', '#e0a01f', '#7a3fb5', '#d8688a'];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      x.fillStyle = cols[(r * 4 + c) % 6]; x.fillRect(10 + c * 62, 10 + r * 84, 52, 72);
      x.fillStyle = 'rgba(255,255,255,.85)'; x.fillRect(14 + c * 62, 16 + r * 84, 44, 12);
    }
  }), roughness: 0.7 }));
  mag.position.set(-12.05, 0.95, 10.2); scene.add(mag);
}

// produce upgrades: warm pendant shades under the existing front spots,
// hanging scale, banana boxes, wood-look floor patch
function produceExtras(scene) {
  for (const [px, pz] of [[-17.7, 10.7], [-15.4, 9.6]]) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.3, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0x1d4a33, roughness: 0.55, metalness: 0.3, side: THREE.DoubleSide }));
    shade.position.set(px, STORE.h - 0.42, pz); scene.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfff2dd, emissive: 0xffdCA0, emissiveIntensity: 2.1 }));
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
  scale.position.set(-16.5, STORE.h - 0.35, 10.7); scene.add(scale);
  // banana boxes under a table + wood floor patch
  const card = cardboardMat();
  for (const [bx, bz, r] of [[-18.2, 10.7, 0.3], [-17.5, 10.75, -0.2]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.3, 0.4), card);
    b.position.set(bx, 0.15, bz); b.rotation.y = r; b.castShadow = true; scene.add(b);
  }
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 6.0), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85, transparent: true, opacity: 0.28, depthWrite: false }));
  patch.rotation.x = -Math.PI / 2; patch.position.set(-17.7, 0.006, 10.7); scene.add(patch);
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
  mural('Fresh Produce', 'picked daily', '#1d5c38', 6.5, -17, 3.55, STORE.d / 2 - 0.16, Math.PI);
  mural('The Bakery', 'baked this morning', '#8a5a2b', 6.5, -13, 3.35, -STORE.d / 2 + 0.12, 0);
  mural('Home & Living', 'quality for less', '#4a5568', 6.5, 12, 3.55, STORE.d / 2 - 0.16, Math.PI);
  // EXIT sign over doors
  const exit = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.26, 0.08), new THREE.MeshStandardMaterial({ map: canvasTex(256, 112, (x) => {
    x.fillStyle = '#101418'; x.fillRect(0, 0, 256, 112);
    x.fillStyle = '#48e07a'; x.textAlign = 'center'; x.font = `800 74px ${FONTS}`; x.fillText('EXIT', 128, 82);
  }), emissive: 0x35c46a, emissiveIntensity: 0.38, roughness: 0.6 }));
  exit.position.set(0, 2.72, STORE.d / 2 - 0.22); scene.add(exit);
  // wall clock (back wall)
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.34, 28), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (x) => {
    x.fillStyle = '#f4f6f8'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
    x.strokeStyle = '#22262b'; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 6; x.beginPath(); x.moveTo(128, 128); x.lineTo(128, 52); x.stroke();
    x.beginPath(); x.moveTo(128, 128); x.lineTo(184, 148); x.stroke();
  }), roughness: 0.6 }));
  clock.position.set(0, 3.45, -STORE.d / 2 + 0.1); scene.add(clock);
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
  door.position.set(-22.2, 1.15, -STORE.d / 2 + 0.09); scene.add(door);
  const wc = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.24), new THREE.MeshStandardMaterial({ map: canvasTex(340, 96, (x) => {
    x.fillStyle = '#173a63'; x.fillRect(0, 0, 340, 96);
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = `700 44px ${FONTS}`; x.fillText('RESTROOMS →', 170, 64);
  }), roughness: 0.7 }));
  wc.position.set(-22.2, 2.6, -STORE.d / 2 + 0.09); scene.add(wc);
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
  cone.position.set(-20.8, 0, 2.5); scene.add(cone); // off the NPC walk line
  colliders.push({ minX: -21.0, maxX: -20.6, minZ: 2.3, maxZ: 2.7 });
  // trash bin by the entrance
  const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.72, 16), PLASTIC(0x2e4a3a, 0.6));
  bin.position.set(3.1, 0.36, 14.5); bin.castShadow = true; scene.add(bin);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 16), PLASTIC(0x223a2c, 0.5));
  lid.position.set(3.1, 0.75, 14.5); scene.add(lid);
  colliders.push({ minX: 2.8, maxX: 3.4, minZ: 14.2, maxZ: 14.8 });
  // gumball machines
  for (const [gx, tint] of [[-4.5, 0xc9241a], [-5.05, 0x1f6fc2]]) {
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
    g.position.set(gx, 0, 14.55); scene.add(g);
  }
  colliders.push({ minX: -5.3, maxX: -4.2, minZ: 14.25, maxZ: 14.85 });
  // welcome mat inside the doors
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.5), new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (x) => {
    x.fillStyle = '#3a3f45'; x.fillRect(0, 0, 512, 256);
    x.strokeStyle = '#22262b'; x.lineWidth = 14; x.strokeRect(10, 10, 492, 236);
    x.fillStyle = '#b9c0c7'; x.textAlign = 'center'; x.font = `800 72px ${FONTS}`;
    x.fillText('WELCOME', 256, 152);
  }), roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.008, 13.7); scene.add(mat);
}

// ------------------------------------------------------------- departments
// electronics: a glowing TV wall along the back + demo shelf of boxed sets
function tvWall(scene, slots, colliders, rng) {
  const z = -STORE.d / 2 + 0.35;
  const back = new THREE.Mesh(new THREE.BoxGeometry(17, 3.0, 0.16), PAINTED(0x14171c, 0.7));
  back.position.set(12, 1.7, z); scene.add(back);
  // three "demo reel" screen looks, cycled across the sets
  const screens = [
    canvasTex(384, 216, (x) => { const g = x.createLinearGradient(0, 0, 384, 216); g.addColorStop(0, '#0a3d62'); g.addColorStop(0.5, '#38ada9'); g.addColorStop(1, '#82ccdd'); x.fillStyle = g; x.fillRect(0, 0, 384, 216); x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.arc(120, 108, 40, 0, Math.PI * 2); x.fill(); }),
    canvasTex(384, 216, (x) => { const g = x.createLinearGradient(0, 216, 384, 0); g.addColorStop(0, '#6a1b4d'); g.addColorStop(0.6, '#e55039'); g.addColorStop(1, '#fad390'); x.fillStyle = g; x.fillRect(0, 0, 384, 216); x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 5; i++) x.fillRect(30 + i * 70, 140, 40, 60); }),
    canvasTex(384, 216, (x) => { x.fillStyle = '#091220'; x.fillRect(0, 0, 384, 216); x.fillStyle = '#48e07a'; x.font = '700 44px Arial'; x.textAlign = 'center'; x.fillText('4K ULTRA', 192, 96); x.fillStyle = '#bcd6ff'; x.font = '500 26px Arial'; x.fillText('VIXEL VISION', 192, 150); }),
  ];
  const tvRegistry = [];
  for (let i = 0; i < 8; i++) {
    const tv = new THREE.Group();
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.72, 0.05), PLASTIC(0x0a0c10, 0.3));
    tv.add(bezel);
    // per-TV material clone so a single screen can crack independently
    const scrMat = new THREE.MeshStandardMaterial({ map: screens[i % 3], emissive: 0xffffff, emissiveMap: screens[i % 3], emissiveIntensity: 0.9, roughness: 0.4 });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.16, 0.64), scrMat);
    scr.position.z = 0.03; tv.add(scr);
    tv.position.set(4.9 + i * 2.05, 1.95, z + 0.12);
    scene.add(tv);
    tvRegistry.push({ mesh: scr, mat: scrMat, x: 4.9 + i * 2.05, y: 1.95, z: z + 0.12, broken: false, price: 379 });
  }
  // boxed TVs + gear on a low platform beneath
  const plat = new THREE.Mesh(new THREE.BoxGeometry(16.5, 0.32, 1.0), PAINTED(0x2b3038, 0.6));
  plat.position.set(12, 0.16, z + 0.75); plat.receiveShadow = true; scene.add(plat);
  const pool = bySection('electronics');
  for (let k = 0; k < 14; k++) {
    const spec = pool[Math.floor(rng() * pool.length)];
    slots.push({ spec, x: 4.6 + k * 1.15, y: 0.32, z: z + 0.75, rotY: (rng() - 0.5) * 0.15 });
  }
  colliders.push({ minX: 3.4, maxX: 20.6, minZ: -STORE.d / 2, maxZ: z + 1.35 });
  hangingSign(scene, bannerTex('ELECTRONICS', '#173a63'), 4.2, 12, 3.1, -11.6);
  return tvRegistry;
}

// apparel: circular racks of hanging shirts + tables of folded stacks
function shirtTex(color) {
  return canvasTex(128, 160, (x) => {
    x.clearRect(0, 0, 128, 160);
    x.fillStyle = color;
    x.beginPath(); // simple tee silhouette
    x.moveTo(24, 34); x.lineTo(50, 20); x.quadraticCurveTo(64, 30, 78, 20); x.lineTo(104, 34);
    x.lineTo(96, 62); x.lineTo(84, 56); x.lineTo(84, 148); x.lineTo(44, 148); x.lineTo(44, 56); x.lineTo(32, 62);
    x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 3; x.stroke();
    x.strokeStyle = '#8a8f94'; x.lineWidth = 4; // hanger hook
    x.beginPath(); x.moveTo(64, 22); x.quadraticCurveTo(64, 6, 74, 6); x.stroke();
  });
}
function apparel(scene, colliders, rng) {
  const SHIRT_COLORS = ['#c9241a', '#1f6fc2', '#2e8b57', '#e8e4da', '#22262b', '#e0a01f', '#7a3fb5', '#d8688a'];
  const racks = [[5.5, 2.5], [8.5, 2.5], [11.5, 2.5], [5.5, 5.8], [8.5, 5.8], [11.5, 5.8]];
  // shirts are ONE InstancedMesh per color (8 draws) instead of 66 unique
  // materials — a big draw-call and shader-compile win
  const byColor = new Map();
  for (let r = 0; r < racks.length; r++) {
    const [rx, rz] = racks[r];
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 10), METAL(0xb9c0c7, 0.3));
    pole.position.y = 0.75; g.add(pole);
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.02, 8, 28), METAL(0xb9c0c7, 0.3));
    rail.rotation.x = Math.PI / 2; rail.position.y = 1.42; g.add(rail);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 14), PAINTED(0x2b3038, 0.5));
    foot.position.y = 0.025; g.add(foot);
    const baseCol = r % SHIRT_COLORS.length;
    for (let s = 0; s < 11; s++) {
      const a = (s / 11) * Math.PI * 2;
      const color = SHIRT_COLORS[(baseCol + (s % 3)) % SHIRT_COLORS.length];
      if (!byColor.has(color)) byColor.set(color, []);
      byColor.get(color).push({
        x: rx + Math.cos(a) * 0.55, y: 1.12, z: rz + Math.sin(a) * 0.55,
        rotY: -a + Math.PI / 2 + (rng() - 0.5) * 0.2,
      });
    }
    g.position.set(rx, 0, rz);
    scene.add(g);
    colliders.push({ minX: rx - 0.75, maxX: rx + 0.75, minZ: rz - 0.75, maxZ: rz + 0.75 });
  }
  {
    const shirtGeo = new THREE.PlaneGeometry(0.42, 0.52);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (const [color, list] of byColor) {
      const im = new THREE.InstancedMesh(
        shirtGeo,
        new THREE.MeshStandardMaterial({ map: shirtTex(color), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.85 }),
        list.length,
      );
      list.forEach((t, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.rotY);
        im.setMatrixAt(i, m4.compose(p.set(t.x, t.y, t.z), q, one));
      });
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      scene.add(im);
    }
  }
  // folded-stack tables (stacks are one instanced draw with per-instance color)
  const tables = [[14.6, 2.5], [14.6, 5.8]];
  const stackG = new THREE.BoxGeometry(0.3, 0.07, 0.24);
  const stacks = new THREE.InstancedMesh(stackG, new THREE.MeshStandardMaterial({ roughness: 0.9 }), tables.length * 24);
  const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  let si = 0;
  for (const [tx, tz] of tables) {
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.78, 1.0), PAINTED(0xe8e4da, 0.6));
    table.position.set(tx, 0.39, tz); table.castShadow = table.receiveShadow = true; scene.add(table);
    for (let gx2 = 0; gx2 < 4; gx2++) for (let gz2 = 0; gz2 < 3; gz2++) for (let h2 = 0; h2 < 2; h2++) {
      m4.makeRotationY((rng() - 0.5) * 0.15);
      m4.setPosition(tx - 0.52 + gx2 * 0.35, 0.82 + h2 * 0.075, tz - 0.3 + gz2 * 0.3);
      stacks.setMatrixAt(si, m4);
      col.set(SHIRT_COLORS[Math.floor(rng() * SHIRT_COLORS.length)]);
      stacks.setColorAt(si, col);
      si++;
    }
    colliders.push({ minX: tx - 0.85, maxX: tx + 0.85, minZ: tz - 0.6, maxZ: tz + 0.6 });
  }
  stacks.instanceMatrix.needsUpdate = true;
  if (stacks.instanceColor) stacks.instanceColor.needsUpdate = true;
  stacks.computeBoundingSphere(); scene.add(stacks);
  hangingSign(scene, bannerTex('APPAREL', '#6a3fb5'), 3.6, 9.5, 3.1, 4.2);
}

// toys: a colorful island + the classic wire ball bin
function toysDept(scene, slots, colliders, rng) {
  const bin = new THREE.Group();
  const gridMat = new THREE.MeshStandardMaterial({ map: cartGridTex(), transparent: true, alphaTest: 0.3, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide });
  for (const [fw, px, pz, ry] of [[1.2, 0, 0.6, 0], [1.2, 0, -0.6, 0], [1.2, 0.6, 0, Math.PI / 2], [1.2, -0.6, 0, Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(fw, 0.85), gridMat);
    p.position.set(px, 0.425, pz); p.rotation.y = ry; bin.add(p);
  }
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.105, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.35, envMapIntensity: 1.2 }), 26);
  const m4 = new THREE.Matrix4(); const col = new THREE.Color();
  const BALL_COLS = ['#c9241a', '#1f6fc2', '#2e8b57', '#e0a01f', '#7a3fb5', '#e8e4da'];
  for (let i = 0; i < 26; i++) {
    m4.makeTranslation((rng() - 0.5) * 0.9, 0.62 + (rng() - 0.5) * 0.22, (rng() - 0.5) * 0.9);
    balls.setMatrixAt(i, m4);
    col.set(BALL_COLS[i % BALL_COLS.length]); balls.setColorAt(i, col);
  }
  balls.instanceMatrix.needsUpdate = true;
  if (balls.instanceColor) balls.instanceColor.needsUpdate = true;
  bin.add(balls);
  bin.position.set(17.2, 0, 6.0);
  scene.add(bin);
  colliders.push({ minX: 16.5, maxX: 17.9, minZ: 5.3, maxZ: 6.7 });
  hangingSign(scene, bannerTex('TOYS', '#c9241a'), 2.8, 19.5, 3.1, -2, Math.PI / 2);
}

// pharmacy: white counter + green cross, tucked in the front-right corner
function pharmacy(scene, colliders) {
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.05, 0.9), PAINTED(0xf2f4f6, 0.5));
  counter.position.set(18.5, 0.525, 10.4); counter.castShadow = counter.receiveShadow = true; scene.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 1.0), PAINTED(0xd8dde2, 0.4));
  top.position.set(18.5, 1.07, 10.4); scene.add(top);
  colliders.push({ minX: 16.8, maxX: 20.2, minZ: 9.95, maxZ: 10.85 });
  const cross = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (x) => {
    x.fillStyle = '#0c3d24'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#35c46a'; x.fillRect(48, 16, 32, 96); x.fillRect(16, 48, 96, 32);
  }), emissive: 0x35c46a, emissiveIntensity: 0.45, roughness: 0.6 }));
  cross.position.set(18.5, 2.7, 12.3); cross.rotation.y = Math.PI; scene.add(cross);
  hangingSign(scene, bannerTex('PHARMACY', '#0c5c38'), 3.2, 18.5, 3.1, 9.6);
}

// department floor zones: carpet-tone decals under apparel + electronics
function floorZones(scene) {
  const zone = (x, z, w2, d2, color) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w2, d2), new THREE.MeshStandardMaterial({ color, roughness: 0.97, transparent: true, opacity: 0.85, depthWrite: false }));
    p.rotation.x = -Math.PI / 2; p.position.set(x, 0.004, z); scene.add(p);
  };
  zone(10.2, 4.2, 13.6, 6.8, 0x4a4640); // apparel: warm gray carpet
  zone(12, -8.5, 18, 10.4, 0x3c4048);   // electronics: cool dark carpet
}

// Fake contact AO: dark gradient strips on the floor along every large
// fixture's base. Grounding is the single biggest "rendered vs real" tell,
// and this buys it for one instanced draw call.
function contactAO(scene, colliders) {
  // symmetric soft band centered on the fixture edge — orientation-proof
  const tex = canvasTex(64, 32, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.40)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 32);
  });
  const geo = new THREE.PlaneGeometry(1, 0.34);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const strips = [];
  for (const c of colliders) {
    const w = c.maxX - c.minX, d2 = c.maxZ - c.minZ;
    if (Math.max(w, d2) < 1.6) continue; // only substantial fixtures
    strips.push([ (c.minX + c.maxX) / 2, c.maxZ, w, 0 ]);          // +z side
    strips.push([ (c.minX + c.maxX) / 2, c.minZ, w, Math.PI ]);    // -z side
    strips.push([ c.maxX, (c.minZ + c.maxZ) / 2, d2, -Math.PI / 2 ]);
    strips.push([ c.minX, (c.minZ + c.maxZ) / 2, d2, Math.PI / 2 ]);
  }
  const im = new THREE.InstancedMesh(geo, mat, strips.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  strips.forEach(([x, z, len, rotY], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY).multiply(flat);
    m.compose(p.set(x, 0.006, z), q, s.set(len, 1, 1));
    im.setMatrixAt(i, m);
  });
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.renderOrder = 2;
  scene.add(im);
}

// photoscanned props from the model kit (all optional — no kit, no props)
function kitProps(scene, colliders) {
  // wine nook: wooden display shelf + bottle collection on a plinth (back-left)
  if (hasModel('prop_wineshelf')) {
    const shelf = cloneModel('prop_wineshelf', { castShadow: true });
    shelf.position.set(-21.9, 0, -11.2);
    shelf.rotation.y = Math.PI / 2;
    scene.add(shelf);
    colliders.push({ minX: -22.6, maxX: -21.2, minZ: -12.1, maxZ: -10.3 });
  }
  if (hasModel('prop_wine')) {
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.6), PAINTED(0x22262b, 0.5));
    plinth.position.set(-21.7, 0.25, -9.2); plinth.castShadow = true; scene.add(plinth);
    const wine = cloneModelAtHeight('prop_wine', 0.36, { castShadow: true });
    wine.position.set(-21.7, 0.5, -9.2);
    scene.add(wine);
    colliders.push({ minX: -22.2, maxX: -21.2, minZ: -9.55, maxZ: -8.85 });
  }
  // greenery at the entrance + pharmacy
  if (hasModel('prop_plant')) {
    for (const [px, pz] of [[-5.9, 13.6], [5.9, 13.6], [20.9, 13.0]]) {
      const p = cloneModelAtHeight('prop_plant', 0.55, { castShadow: true });
      p.position.set(px, 0, pz);
      scene.add(p);
    }
  }
  // restock clutter: cardboard boxes + produce crates
  if (hasModel('prop_box')) {
    for (const [bx, bz, r] of [[-20.6, -14.1, 0.4], [-19.9, -14.15, -0.2], [20.4, -13.6, 0.9]]) {
      const b = cloneModelAtHeight('prop_box', 0.42, { castShadow: true });
      b.position.set(bx, 0, bz); b.rotation.y = r;
      scene.add(b);
    }
  }
  if (hasModel('prop_crate')) {
    const c1 = cloneModelAtHeight('prop_crate', 0.3, { castShadow: true });
    c1.position.set(-21.6, 0, 8.2); scene.add(c1);
    const c2 = cloneModelAtHeight('prop_crate', 0.3);
    c2.position.set(-21.6, 0.3, 8.24); c2.rotation.y = 0.16; scene.add(c2);
    colliders.push({ minX: -22.1, maxX: -21.1, minZ: 7.7, maxZ: 8.7 });
  }
}

// yellow deal tags sprinkled along shelf rails
function saleTags(scene, rng, cullables) {
  const texts = [saleTagTex('2 FOR', '$5.00'), saleTagTex('SAVE', '$1.00'), saleTagTex('NEW!', 'try me', '#c9241a', '#fff')];
  const geo = new THREE.PlaneGeometry(0.1, 0.058);
  for (let t = 0; t < texts.length; t++) {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: texts[t], roughness: 0.7 }), 18);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 18; i++) {
      const island = [-18, -14, -10, -6][Math.floor(rng() * 4)];
      const face = rng() < 0.5 ? 1 : -1;
      const y = shelfYs[Math.floor(rng() * shelfYs.length)] - 0.045;
      const z = -3 + (rng() - 0.5) * 14;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), face === 1 ? Math.PI / 2 : -Math.PI / 2);
      m4.compose(p.set(island + face * 0.436, y - 0.028, z), q, one);
      im.setMatrixAt(i, m4);
    }
    im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); scene.add(im);
    if (cullables) cullables.push(im);
  }
}

// ------------------------------------------------------------- price tags
// One InstancedMesh per SKU (tags share geometry; texture differs per SKU).
function buildTags(scene, tagSlots, cullables) {
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
    if (cullables) cullables.push(im);
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
  const floorMat = loadPBR(loader, 'floor', [w / 2, d / 2], { roughness: 0.42, envMapIntensity: 1.5 });
  const floorGeo = new THREE.PlaneGeometry(w, d);
  floorGeo.setAttribute('uv1', floorGeo.attributes.uv.clone()); // ao/light maps read TEXCOORD1
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  bakeFloorLightmap(floorMat);

  const wallMat = loadPBR(loader, 'wall', [w / 3, h / 3]);
  const wallMatZ = loadPBR(loader, 'wall', [d / 3, h / 3]);
  const mkWall = (mat, W, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, h), mat);
    m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  };
  mkWall(wallMat, w, 0, -d / 2, 0);
  mkWall(wallMatZ, d, -w / 2, 0, Math.PI / 2);
  mkWall(wallMatZ, d, w / 2, 0, -Math.PI / 2);
  // brand accent band around the walls — reads as designed interior, not warehouse
  {
    const bandM = PAINTED(0x1d5c38, 0.55);
    const mkBand = (W, x, z, ry) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.42, 0.04), bandM);
      b.position.set(x, 2.52, z); b.rotation.y = ry; scene.add(b);
    };
    mkBand(w, 0, -d / 2 + 0.05, 0);
    mkBand(d, -w / 2 + 0.05, 0, Math.PI / 2);
    mkBand(d, w / 2 - 0.05, 0, -Math.PI / 2);
    mkBand(w, 0, d / 2 - 0.07, Math.PI);
  }
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
      const nMull = Math.max(4, Math.round(segW / 2.1));
      for (let i = 0; i <= nMull; i++) {
        const mx = x0 + (s > 0 ? 1 : -1) * (segW / nMull) * i;
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

  // GROCERY half (west): four island gondolas, aisles along Z
  const islandLen = 16, islandZ = -3;
  const faces = [
    [['pantry', 'pantry', 'snacks', 'pantry'], ['snacks', 'pantry', 'pantry', 'snacks']],
    [['snacks', 'snacks', 'pantry', 'snacks'], ['pantry', 'snacks', 'snacks', 'pantry']],
    [['dairy', 'dairy', 'dairy', 'dairy'], ['pantry', 'pantry', 'snacks', 'pantry']],
    [['household', 'household', 'household', 'household'], ['dairy', 'dairy', 'dairy', 'dairy']],
  ];
  const physGondolas = []; // tippable islands for the physics layer
  const groceryXs = [-18, -14, -10, -6];
  groceryXs.forEach((x, i) => {
    const local = [], localTags = [];
    const gd = gondola(local, localTags, islandLen, faces[i], rng);
    gd.position.set(x, 0, islandZ); scene.add(gd);
    emitSlots(gd, local, slots); emitSlots(gd, localTags, tagSlots);
    const col = { minX: x - 0.52, maxX: x + 0.52, minZ: islandZ - islandLen / 2 - 0.1, maxZ: islandZ + islandLen / 2 + 0.1 };
    colliders.push(col);
    physGondolas.push({ group: gd, collider: col, axis: 'z', cx: x, cz: islandZ, len: islandLen, label: String(i + 1) });
  });
  const signs = [['1', 'Frozen · Breakfast', 'Cereal'], ['2', 'Snacks · Candy', 'Soda · Water'], ['3', 'Pasta · Sauce', 'Canned Goods'], ['4', 'Dairy · Eggs', 'Household'], ['5', 'Household', 'Paper Goods']];
  [-20, -16, -12, -8, -4].forEach((x, i) => hangingSign(scene, aisleSignTex(...signs[i]), 1.7, x, 3.0, -3));

  // back wall shelf (bakery) on the grocery side
  {
    const local = [], localTags = [];
    const backShelf = wallShelf(local, localTags, 16, ['bakery', 'bakery', 'snacks', 'pantry'], rng);
    backShelf.position.set(-13, 0, -d / 2 + 0.28); backShelf.rotation.y = -Math.PI / 2; scene.add(backShelf);
    emitSlots(backShelf, local, slots); emitSlots(backShelf, localTags, tagSlots);
    colliders.push({ minX: -21.2, maxX: -4.8, minZ: -d / 2, maxZ: -d / 2 + 0.6 });
  }

  const freezer = freezerWall(scene, slots, rng); // left wall
  colliders.push(freezer.collider);
  const woodMat = loadPBR(loader, 'wood', [2, 1.4]);
  colliders.push(...produceCorner(scene, slots, woodMat, rng));
  const co = checkoutLanes(scene);
  colliders.push(...co.colliders);
  const cb = cartsAndBaskets(scene);
  colliders.push(...cb.colliders);
  const doors = entrance(scene);

  // GENERAL MERCHANDISE half (east): electronics, apparel, toys, pharmacy
  floorZones(scene);
  const tvs = tvWall(scene, slots, colliders, rng);
  // two merch gondolas running ALONG X (cross-grain, breaks the boxy grid)
  const merchIslands = [
    { x: 10, z: -7.5, sections: [['electronics', 'electronics', 'home', 'electronics'], ['home', 'home', 'electronics', 'home']] },
    { x: 10, z: -3.5, sections: [['home', 'toys', 'home', 'toys'], ['toys', 'toys', 'home', 'toys']] },
  ];
  merchIslands.forEach((mi, i) => {
    const local = [], localTags = [];
    const gd = gondola(local, localTags, 12, mi.sections, rng);
    gd.position.set(mi.x, 0, mi.z); gd.rotation.y = Math.PI / 2; scene.add(gd);
    emitSlots(gd, local, slots); emitSlots(gd, localTags, tagSlots);
    const col = { minX: mi.x - 6.1, maxX: mi.x + 6.1, minZ: mi.z - 0.52, maxZ: mi.z + 0.52 };
    colliders.push(col);
    physGondolas.push({ group: gd, collider: col, axis: 'x', cx: mi.x, cz: mi.z, len: 12, label: String(6 + i) });
  });
  // toys tall island along the right edge
  {
    const local = [], localTags = [];
    const gd = gondola(local, localTags, 10, [['toys', 'toys', 'toys', 'toys'], ['pharmacy', 'home', 'pharmacy', 'home']], rng);
    gd.position.set(19.5, 0, -2); scene.add(gd);
    emitSlots(gd, local, slots); emitSlots(gd, localTags, tagSlots);
    const col = { minX: 19.5 - 0.52, maxX: 19.5 + 0.52, minZ: -2 - 5.1, maxZ: -2 + 5.1 };
    colliders.push(col);
    physGondolas.push({ group: gd, collider: col, axis: 'z', cx: 19.5, cz: -2, len: 10, label: '8' });
  }
  apparel(scene, colliders, rng);
  toysDept(scene, slots, colliders, rng);
  pharmacy(scene, colliders);
  kitProps(scene, colliders);

  // set dressing (endcaps + checkout racks add product slots — before buildStock)
  const cullables = []; // extra whole-store batches for distance culling
  const ext = exterior(scene, loader);
  endcaps(scene, slots, colliders, rng, cullables);
  palletStacks(scene, colliders, rng);
  checkoutExtras(scene, slots, rng);
  produceExtras(scene);
  wallDressing(scene);
  floorProps(scene, colliders);
  saleTags(scene, rng, cullables);

  contactAO(scene, colliders);

  // instantiate all products + price tags
  const stock = buildStock(scene, slots);
  buildTags(scene, tagSlots, cullables);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 40), new THREE.MeshStandardMaterial({ color: 0x35c46a, emissive: 0x35c46a, emissiveIntensity: 1.0, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(co.point.x, 0.02, co.point.z);
  ring.visible = false; scene.add(ring);

  const bounds = { minX: -w / 2 + 0.45, maxX: w / 2 - 0.45, minZ: -d / 2 + 0.45, maxZ: d / 2 - 0.5 };
  // NPC walk graph: grocery aisles + center action alley + far-right lane
  const corridors = {
    xs: [-20, -16, -12, -8, -4, 0, 18],
    browseXs: [-16, -12, -8, -4],
    zMin: -12.4, zMax: 7.6, crossZ: [8.2, -13.0],
  };

  let t = 0;
  // staff at their posts: two cashiers, grocery stocker, pharmacist, electronics
  const staffSpots = [
    { x: -10.5 - 0.75, z: 10.35, yaw: Math.PI / 2 },
    { x: -8.6 - 0.75, z: 10.35, yaw: Math.PI / 2 },
    { x: -14.95, z: -6.2, yaw: Math.PI / 2 },
    { x: 18.5, z: 11.3, yaw: Math.PI },
    { x: 10, z: -12.0, yaw: Math.PI },
  ];

  return {
    colliders, bounds, stock, corridors, staffSpots, cullables,
    physicsMeta: { gondolas: physGondolas, carts: cb.carts, freezerGlass: freezer.glass, freezerCollider: freezer.collider, tvs },
    checkout: co.point, checkoutRing: ring,
    spawn: new THREE.Vector3(0.6, 1.65, 13.2),

    update(dt, camera) {
      t += dt;
      for (const door of doors) {
        const near = Math.hypot(camera.position.x - 0, camera.position.z - STORE.d / 2) < 4.2;
        door.t = THREE.MathUtils.clamp(door.t + (near ? dt : -dt) * 1.6, 0, 1);
        const e = door.t * door.t * (3 - 2 * door.t);
        door.g.position.x = THREE.MathUtils.lerp(door.closedX, door.openX, e);
      }
      if (ring.visible) { const s = 1 + Math.sin(t * 4) * 0.08; ring.scale.setScalar(s); }
      // the dying parking-lot lamp: mostly on, with nervous dropouts
      for (const f of ext.flicker) {
        f.t -= dt;
        if (f.t <= 0) {
          f.on = f.on === false ? true : Math.random() > 0.08;
          f.t = f.on ? 0.4 + Math.random() * 2.2 : 0.05 + Math.random() * 0.18;
          const k = f.on ? 1 : 0.12;
          f.head.material.emissiveIntensity = 2.4 * k;
          f.pool.material.opacity = 0.2 * k;
          f.cone.material.opacity = 0.05 * k;
        }
      }
    },
  };
}
