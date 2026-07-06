import * as THREE from 'three';
import { loadPBR, METAL, PAINTED } from './materials.js';
import { PRODUCTS, buildProduct } from './products.js';

// Interior footprint (metres). Aisles run along Z; gondolas are the islands.
export const STORE = { w: 16, d: 22, h: 3.3 };

// ------------------------------------------------------------- gondola shelving
// A double-sided island: metal shelves facing +X and -X, white back panel down
// the middle, dark kick base. Stocked with runs of identical facings (planogram
// style) so it reads like a real shelf, not scattered props.
function gondola(loader, length, sections) {
  const g = new THREE.Group();
  const H = 1.9, HD = 0.44; // half-depth of each face from centre
  const shelfMetal = METAL(0xc4cace, 0.34);
  const back = PAINTED(0xf2f4f6, 0.7);
  const kick = PAINTED(0x2b3038, 0.5);

  // back panel + end caps
  const bp = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, length), back);
  bp.position.y = H / 2; bp.castShadow = bp.receiveShadow = true; g.add(bp);
  for (const z of [-length / 2, length / 2]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(HD * 2, H, 0.05), METAL(0x9aa1a8, 0.4));
    cap.position.set(0, H / 2, z); cap.castShadow = cap.receiveShadow = true; g.add(cap);
  }
  // kick base
  const kb = new THREE.Mesh(new THREE.BoxGeometry(HD * 2, 0.12, length), kick);
  kb.position.y = 0.06; kb.receiveShadow = true; g.add(kb);

  const shelfYs = [0.32, 0.72, 1.12, 1.52];
  for (const face of [1, -1]) {
    const secIdx = face === 1 ? 0 : 1 % sections.length;
    for (let si = 0; si < shelfYs.length; si++) {
      const y = shelfYs[si];
      // physical shelf slab
      const slab = new THREE.Mesh(new THREE.BoxGeometry(HD, 0.03, length), shelfMetal);
      slab.position.set(face * HD / 2, y, 0); slab.castShadow = slab.receiveShadow = true; g.add(slab);
      // price rail on the shelf lip
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, length), PAINTED(0xf7f9fb, 0.6));
      rail.position.set(face * (HD - 0.01), y + 0.04, 0); g.add(rail);
      // stock this shelf
      const secName = sections[(secIdx + si) % sections.length];
      stockShelf(g, face, HD, y + 0.015, length, secName);
    }
  }
  return g;
}

// Lay products left-to-right in runs of identical facings.
function stockShelf(parent, face, HD, y, length, section) {
  const pool = PRODUCTS.filter((p) => p.section === section);
  if (!pool.length) return;
  const margin = 0.35, usable = length - margin * 2;
  const step = 0.19;
  let z = -length / 2 + margin, pi = 0, runLeft = 0, spec = null;
  while (z < length / 2 - margin) {
    if (runLeft <= 0) { spec = pool[pi % pool.length]; pi++; runLeft = 3 + (pi % 2); }
    const item = buildProduct(spec);
    item.position.set(face * (HD - 0.02), y, z);
    item.rotation.y = face === 1 ? Math.PI / 2 : -Math.PI / 2; // face the aisle
    parent.add(item);
    runLeft--; z += step;
  }
}

// ------------------------------------------------------------- ceiling lights
function ceiling(scene) {
  const y = STORE.h;
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(STORE.w, 0.1, STORE.d),
    PAINTED(0x1c2229, 0.9),
  );
  panel.position.y = y + 0.05; scene.add(panel);

  const trofferMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4, roughness: 1 });
  const xs = [-4, 0, 4], zs = [-8, -4, 0, 4, 8];
  for (const x of xs) for (const z of zs) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.06, 0.5), trofferMat);
    t.position.set(x, y - 0.03, z); scene.add(t);
  }
  // shadow-casting spots (a subset — cheap but grounded)
  for (const x of [-4, 4]) for (const z of [-6, 0, 6]) {
    const s = new THREE.SpotLight(0xfff4e6, 60, 14, Math.PI * 0.32, 0.5, 1.4);
    s.position.set(x, y - 0.1, z);
    s.target.position.set(x, 0, z);
    s.castShadow = true;
    s.shadow.mapSize.set(1024, 1024);
    s.shadow.camera.near = 0.5; s.shadow.camera.far = 12; s.shadow.bias = -0.0005;
    scene.add(s); scene.add(s.target);
  }
  // soft ambient fills (no shadow) so nothing is pitch black
  for (const x of [-4, 0, 4]) {
    const p = new THREE.PointLight(0xffffff, 12, 16, 1.8); p.position.set(x, y - 0.3, 0); scene.add(p);
  }
}

// ------------------------------------------------------------- assemble
export function buildStore(scene, loader) {
  scene.background = new THREE.Color(0x0d1013);
  scene.fog = new THREE.Fog(0x0d1013, 16, 30);

  const { w, d, h } = STORE;

  // floor: waxed tile (clearcoat physical) — the polish sells "real store"
  const floorMat = loadPBR(loader, 'floor', [w / 2, d / 2], {
    physical: true, clearcoat: 0.65, clearcoatRoughness: 0.28, envMapIntensity: 1.0,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // walls
  const wallMat = loadPBR(loader, 'wall', [w / 3, h / 3]);
  const wallMatZ = loadPBR(loader, 'wall', [d / 3, h / 3]);
  const mkWall = (mat, W, x, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, h), mat);
    m.position.set(x, h / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m);
  };
  mkWall(wallMat, w, 0, -d / 2, 0);        // back
  mkWall(wallMat, w, 0, d / 2, Math.PI);   // front
  mkWall(wallMatZ, d, -w / 2, 0, Math.PI / 2);  // left
  mkWall(wallMatZ, d, w / 2, 0, -Math.PI / 2);  // right

  ceiling(scene);
  scene.add(new THREE.HemisphereLight(0xcfe0f0, 0x39352f, 0.35));

  // three island gondolas → two shopping aisles between them + wall aisles
  const colliders = [];
  const islandLen = 12;
  const islandX = [-4.5, 0, 4.5];
  const secGroups = [
    ['pantry', 'snacks'],
    ['snacks', 'pantry'],
    ['dairy', 'pantry'],
  ];
  islandX.forEach((x, i) => {
    const gd = gondola(loader, islandLen, secGroups[i]);
    gd.position.set(x, 0, 0); scene.add(gd);
    colliders.push({ minX: x - 0.55, maxX: x + 0.55, minZ: -islandLen / 2, maxZ: islandLen / 2 });
  });

  const bounds = { minX: -w / 2 + 0.4, maxX: w / 2 - 0.4, minZ: -d / 2 + 0.4, maxZ: d / 2 - 0.4 };
  const spawn = new THREE.Vector3(2.2, 1.65, 9);
  return { colliders, bounds, spawn };
}
