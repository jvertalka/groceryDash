import * as THREE from 'three';
import { buildProduct } from './products.js';

// GPU-instanced product stocking. Every facing of the same SKU shares ONE
// InstancedMesh per template part (a can = 1 part, a bottle = 3), so ~2,600
// products cost ~60 draw calls instead of ~5,000. Grabbing hides an instance
// (zero-scale matrix) and the game spawns a real mesh for the fly-to-basket.
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function buildStock(scene, slots) {
  // group slots by SKU *and spatial cell* — one whole-store batch per SKU
  // defeats frustum culling (every product renders every frame); per-cell
  // batches get tight bounding spheres so off-screen aisles cull away.
  const CELL = 11.5;
  const cellOf = (x, z) => `${Math.floor((x + 23) / CELL)},${Math.floor((z + 15) / CELL)}`;
  const bySpec = new Map();
  for (const s of slots) {
    const key = s.spec.id + '|' + cellOf(s.x, s.z);
    if (!bySpec.has(key)) bySpec.set(key, { key, spec: s.spec, slots: [] });
    bySpec.get(key).slots.push(s);
  }

  const raycastTargets = [];
  const batchList = []; // every product InstancedMesh, for draw-distance culling
  const handles = new Map(); // specId -> [handle]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

  // templates are shared across cells of the same SKU
  const templateCache = new Map();
  function templateFor(spec) {
    if (templateCache.has(spec.id)) return templateCache.get(spec.id);
    const template = buildProduct(spec);
    template.updateMatrixWorld(true);
    const parts = [];
    template.traverse((o) => { if (o.isMesh) parts.push(o); });
    const bounds = new THREE.Box3().setFromObject(template);
    const entry = { parts, size: bounds.getSize(new THREE.Vector3()), centerY: (bounds.min.y + bounds.max.y) / 2 };
    templateCache.set(spec.id, entry);
    return entry;
  }

  for (const { key, spec, slots: list } of bySpec.values()) {
    const { parts, size, centerY } = templateFor(spec);

    const imeshes = parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      im.receiveShadow = false; im.castShadow = false;
      im.userData.specId = spec.id;
      im.userData.key = key;
      im.userData.grabbable = list[0].grabbable !== false;
      scene.add(im);
      if (im.userData.grabbable) raycastTargets.push(im);
      batchList.push(im);
      return im;
    });

    const hs = [];
    list.forEach((slot, i) => {
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), slot.rotY || 0);
      parts.forEach((part, pi) => {
        // world = slotTransform × partLocal (template world matrix = local here)
        _p.set(slot.x, slot.y, slot.z);
        _m.compose(_p, _q, _s).multiply(part.matrixWorld);
        imeshes[pi].setMatrixAt(i, _m);
      });
      hs.push({
        spec, index: i, hidden: false,
        x: slot.x, y: slot.y, z: slot.z, rotY: slot.rotY || 0,
        size, centerY,
        hide() {
          if (this.hidden) return; this.hidden = true;
          for (const im of imeshes) { im.setMatrixAt(i, ZERO); im.instanceMatrix.needsUpdate = true; }
        },
      });
    });
    for (const im of imeshes) { im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); }
    handles.set(key, hs);
  }

  // product draw-distance: shelving occludes anything a few aisles away, but
  // three.js has no occlusion culling — so hide product batches whose cell
  // sphere is beyond reach. Called once per frame; ~157 batches, trivial CPU.
  return {
    raycastTargets,
    cull(camPos, maxDist = 12) {
      for (const im of batchList) {
        const s = im.boundingSphere || (im.computeBoundingSphere(), im.boundingSphere);
        if (!s) continue;
        const dx = s.center.x - camPos.x, dz = s.center.z - camPos.z;
        im.visible = (dx * dx + dz * dz) < (maxDist + s.radius) * (maxDist + s.radius);
      }
    },
    // resolve a raycast hit to a stock handle
    resolve(hit) {
      const key = hit.object.userData && hit.object.userData.key;
      if (!key || hit.instanceId === undefined) return null;
      const hs = handles.get(key);
      const h = hs && hs[hit.instanceId];
      return h && !h.hidden ? h : null;
    },
    // hide (and return) visible handles inside a world-space box — used by the
    // physics layer to knock items off shelves / spill a tipped gondola
    hideInRegion(box, limit = Infinity) {
      const out = [];
      const minY = box.minY !== undefined ? box.minY : -1, maxY = box.maxY !== undefined ? box.maxY : 99;
      for (const [, hs] of handles) {
        for (const h of hs) {
          if (h.hidden) continue;
          if (h.x >= box.minX && h.x <= box.maxX && h.z >= box.minZ && h.z <= box.maxZ && h.y >= minY && h.y <= maxY) {
            h.hide(); out.push(h);
            if (out.length >= limit) return out;
          }
        }
      }
      return out;
    },
    // distinct specs that still have visible, grabbable stock
    availableSpecs() {
      const seen = new Set(), out = [];
      for (const [key, hs] of handles) {
        if (!hs.length || !hs[0].spec || seen.has(hs[0].spec.id)) continue;
        if (!hs.some((h) => !h.hidden)) continue;
        const anyGrab = raycastTargets.some((t) => t.userData.specId === hs[0].spec.id);
        if (anyGrab) { seen.add(hs[0].spec.id); out.push(hs[0].spec); }
      }
      return out;
    },
    counts: { batches: bySpec.size, instances: slots.length, raycastTargets: raycastTargets.length },
  };
}
