import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Load one rigged GLB and populate the store with animated shoppers. The model
// is auto-scaled to ~1.75 m regardless of its source units, and each instance
// plays a baked clip (idle/walk), so they read as people, not capsules.
export function loadShoppers(scene, manager, placements) {
  const mixers = [];
  new GLTFLoader(manager).load('assets/models/shopper.glb', (gltf) => {
    const src = gltf.scene;
    const box = new THREE.Box3().setFromObject(src);
    const srcH = box.max.y - box.min.y || 1;
    const scale = 1.75 / srcH;
    const clips = gltf.animations || [];
    const pick = (re) => clips.find((c) => re.test(c.name)) || clips[0];
    const idle = pick(/idle/i), walk = pick(/walk|run/i);

    placements.forEach((p, i) => {
      const model = cloneSkinned(src);
      model.scale.setScalar(scale);
      model.position.set(p.x, 0, p.z);
      model.rotation.y = p.rot ?? 0;
      model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      scene.add(model);
      if (clips.length) {
        const mixer = new THREE.AnimationMixer(model);
        const act = mixer.clipAction((p.moving ? walk : idle) || clips[0]);
        act.time = Math.random() * 2; // desync
        act.play();
        mixers.push(mixer);
      }
    });
  });
  return { update: (dt) => { for (const m of mixers) m.update(dt); } };
}
