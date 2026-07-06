import * as THREE from 'three';
import { buildProduct } from './products.js';

// GPU-instanced product stocking. Every facing of the same SKU shares ONE
// InstancedMesh per template part (a can = 1 part, a bottle = 3), so ~2,600
// products cost ~60 draw calls instead of ~5,000. Grabbing hides an instance
// (zero-scale matrix) and the game spawns a real mesh for the fly-to-basket.
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

export function buildStock(scene, slots) {
  // group slots by SKU
  const bySpec = new Map();
  for (const s of slots) {
    if (!bySpec.has(s.spec.id)) bySpec.set(s.spec.id, { spec: s.spec, slots: [] });
    bySpec.get(s.spec.id).slots.push(s);
  }

  const raycastTargets = [];
  const handles = new Map(); // specId -> [handle]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

  for (const { spec, slots: list } of bySpec.values()) {
    // template: build one product, harvest its meshes as instanced parts
    const template = buildProduct(spec);
    template.updateMatrixWorld(true);
    const parts = [];
    template.traverse((o) => { if (o.isMesh) parts.push(o); });
    const bounds = new THREE.Box3().setFromObject(template);
    const size = bounds.getSize(new THREE.Vector3());
    const centerY = (bounds.min.y + bounds.max.y) / 2;

    const imeshes = parts.map((part) => {
      const im = new THREE.InstancedMesh(part.geometry, part.material, list.length);
      im.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      im.receiveShadow = false; im.castShadow = false;
      im.userData.specId = spec.id;
      im.userData.grabbable = list[0].grabbable !== false;
      scene.add(im);
      if (im.userData.grabbable) raycastTargets.push(im);
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
    handles.set(spec.id, hs);
  }

  return {
    raycastTargets,
    // resolve a raycast hit to a stock handle
    resolve(hit) {
      const id = hit.object.userData && hit.object.userData.specId;
      if (!id || hit.instanceId === undefined) return null;
      const h = handles.get(id)[hit.instanceId];
      return h && !h.hidden ? h : null;
    },
    // distinct specs that still have visible, grabbable stock
    availableSpecs() {
      const out = [];
      for (const [, hs] of handles) if (hs.length && hs[0].spec && hs.some((h) => !h.hidden)) {
        const anyGrab = raycastTargets.some((t) => t.userData.specId === hs[0].spec.id);
        if (anyGrab) out.push(hs[0].spec);
      }
      return out;
    },
    counts: { skus: bySpec.size, instances: slots.length, drawCalls: raycastTargets.length },
  };
}
