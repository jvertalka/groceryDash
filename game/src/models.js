import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// GLB model registry — the same pipeline that gave us real people: fetch real
// CC0 models once (scripts/fetch-models.mjs), preload them here before the
// store builds, and hand out clone/template access synchronously after that.
//
// manifest.json lives in public/assets/models/kit/ and maps
//   name -> { file, scale?, yUp?, rotY? }
const registry = new Map();

export async function preloadModels(manager) {
  let manifest;
  try {
    const res = await fetch('assets/models/kit/manifest.json');
    if (!res.ok) return registry; // no kit yet — everything falls back to procedural
    manifest = await res.json();
  } catch (e) {
    return registry;
  }
  const loader = new GLTFLoader(manager);
  const names = Object.keys(manifest);
  await Promise.all(names.map(async (name) => {
    const def = manifest[name];
    try {
      const gltf = await loader.loadAsync(`assets/models/kit/${def.file}`);
      const scene = gltf.scene;
      scene.updateMatrixWorld(true);
      // normalize: bake the manifest transform into a wrapper
      const wrap = new THREE.Group();
      wrap.add(scene);
      if (def.rotY) scene.rotation.y = def.rotY;
      if (def.scale) scene.scale.setScalar(def.scale);
      // ground it: base of bbox at y=0
      wrap.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(wrap);
      scene.position.y -= box.min.y;
      wrap.updateMatrixWorld(true);
      const finalBox = new THREE.Box3().setFromObject(wrap);
      registry.set(name, {
        template: wrap,
        size: finalBox.getSize(new THREE.Vector3()),
        def,
      });
    } catch (e) {
      console.warn('[models] failed to load', name, e);
    }
  }));
  return registry;
}

export const hasModel = (name) => registry.has(name);

// A fresh clone for one-off placement (props, cars).
export function cloneModel(name, { castShadow = false } = {}) {
  const entry = registry.get(name);
  if (!entry) return null;
  const c = entry.template.clone(true);
  c.traverse((o) => { if (o.isMesh) { o.castShadow = castShadow; o.receiveShadow = false; } });
  return c;
}

export function modelSize(name) {
  const entry = registry.get(name);
  return entry ? entry.size : null;
}

// Scale-to-height helper for placement code.
export function cloneModelAtHeight(name, targetH, opts) {
  const entry = registry.get(name);
  if (!entry) return null;
  const c = cloneModel(name, opts);
  const s = targetH / Math.max(0.001, entry.size.y);
  c.scale.setScalar(s);
  return c;
}
