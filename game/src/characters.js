import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

// Skinned-mesh gotcha: Box3.setFromObject measures the BIND-POSE geometry, not
// the posed skeleton — for rigs whose armature carries the scale (Mixamo-style)
// that number is garbage and NPCs come out giant/tiny. So we measure the
// skeleton's world-space bone span instead, scale, then RE-measure and correct.
const TARGET_H = 1.72;
const FACING_Y = Math.PI; // model's visual forward; flip to 0 if they moonwalk

// soft blob shadow shared by all NPCs
const blobGeo = new THREE.CircleGeometry(1, 24);
const blobMat = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false });
})();

function boneHeight(model) {
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let min = Infinity, max = -Infinity, found = false;
  model.traverse((o) => {
    if (o.isBone) { found = true; o.getWorldPosition(v); if (v.y < min) min = v.y; if (v.y > max) max = v.y; }
  });
  if (!found) { const b = new THREE.Box3().setFromObject(model); min = b.min.y; max = b.max.y; }
  return Math.max(0.01, max - min);
}

export function createShoppers(scene, manager, world) {
  const npcs = [];
  const { xs, zMin, zMax, crossZ } = world.corridors;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  new GLTFLoader(manager).load('assets/models/shopper.glb', (gltf) => {
    const src = gltf.scene;
    const clips = gltf.animations || [];
    const clip = (re) => clips.find((c) => re.test(c.name)) || clips[0];
    const idleClip = clip(/idle/i), walkClip = clip(/walk/i);

    // measure → scale → verify (bones give ~head-joint height; +6% ≈ skull top)
    const probe = cloneSkinned(src);
    let s = (TARGET_H / boneHeight(probe)) * 1.06;
    probe.scale.setScalar(s);
    const h2 = boneHeight(probe) * 1.06;
    if (h2 < 1.2 || h2 > 2.2) s *= TARGET_H / h2; // belt & suspenders
    window.__npcScale = s;

    const walkers = 6, browsers = 2;
    for (let i = 0; i < walkers + browsers; i++) {
      const model = cloneSkinned(src);
      model.scale.setScalar(s);
      // no real-time shadow (shadow maps are frozen for perf) — blob instead
      model.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; } });
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.015 / s; blob.scale.setScalar(0.42 / s);
      model.add(blob);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(idleClip), walk = mixer.clipAction(walkClip);
      idle.play(); walk.play(); walk.weight = 0; idle.weight = 1;
      idle.time = Math.random() * 2; walk.time = Math.random() * 1.2;

      const n = {
        model, mixer, idle, walk,
        x: pick(xs), z: rand(zMin + 1, zMax - 1),
        yaw: rand(-Math.PI, Math.PI), speed: rand(0.85, 1.25),
        path: [], pause: rand(0, 2), browsing: i >= walkers,
      };
      if (n.browsing) {
        // stand at a shelf face, looking at it
        const ax = pick(xs); const side = Math.random() < 0.5 ? -1 : 1;
        n.x = ax + side * 1.05; n.z = rand(-7, 3);
        n.yaw = side === 1 ? -Math.PI / 2 : Math.PI / 2;
        n.pause = Infinity;
      }
      model.position.set(n.x, 0, n.z);
      model.rotation.y = n.yaw + FACING_Y;
      scene.add(model);
      npcs.push(n);
    }
  });

  function newPath(n) {
    // 60%: another spot in this corridor; 40%: cross to a different corridor
    if (Math.random() < 0.6) {
      n.path = [{ x: n.x, z: rand(zMin + 0.8, zMax - 0.8) }];
    } else {
      const nx = pick(xs.filter((x) => x !== n.x));
      const cz = Math.abs(n.z - crossZ[0]) < Math.abs(n.z - crossZ[1]) ? crossZ[0] : crossZ[1];
      n.path = [{ x: n.x, z: cz }, { x: nx, z: cz }, { x: nx, z: rand(zMin + 0.8, zMax - 0.8) }];
    }
  }

  function update(dt) {
    for (const n of npcs) {
      n.mixer.update(dt);
      if (n.browsing) continue;
      if (n.pause > 0) {
        n.pause -= dt;
        n.walk.weight = Math.max(0, n.walk.weight - dt * 3);
        n.idle.weight = 1 - n.walk.weight;
        continue;
      }
      if (!n.path.length) { newPath(n); continue; }
      const wp = n.path[0];
      const dx = wp.x - n.x, dz = wp.z - n.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.12) {
        n.path.shift();
        if (!n.path.length && Math.random() < 0.55) n.pause = rand(1.2, 4); // stop and browse
        continue;
      }
      const step = Math.min(dist, n.speed * dt);
      n.x += (dx / dist) * step; n.z += (dz / dist) * step;
      const targetYaw = Math.atan2(dx, dz);
      let dy = targetYaw - n.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      n.yaw += THREE.MathUtils.clamp(dy, -3 * dt, 3 * dt);
      n.model.position.set(n.x, 0, n.z);
      n.model.rotation.y = n.yaw + FACING_Y;
      n.walk.weight = Math.min(1, n.walk.weight + dt * 3);
      n.idle.weight = 1 - n.walk.weight;
      n.walk.timeScale = n.speed / 1.3;
    }
  }

  return { update, npcs };
}
