import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { shoppingCart } from './store.js';

// Realistic everyday shoppers: Microsoft Rocketbox avatars (MIT) — game-grade
// people in casual clothes — animated by RETARGETING the Soldier donor's
// idle/walk clips (mixamorig skeleton) onto Rocketbox's 3ds-Max Biped rig.
// Everything below is verified empirically at load: bone-span autoscale
// (their FBX is authored in centimetres), toe-vs-ankle facing detection, and
// a numeric pose sanity check that rejects a bad retarget instead of
// shipping pretzel people.
const TARGET_H = 1.74;
const PEOPLE = [
  'Female_Adult_01', 'Female_Adult_08', 'Female_Adult_12',
  'Male_Adult_01', 'Male_Adult_04', 'Male_Adult_08',
];

// target (Biped) -> source (mixamorig)
const BIP_TO_MIXAMO = {
  Bip01_Pelvis: 'mixamorigHips',
  Bip01_Spine: 'mixamorigSpine',
  Bip01_Spine1: 'mixamorigSpine1',
  Bip01_Spine2: 'mixamorigSpine2',
  Bip01_Neck: 'mixamorigNeck',
  Bip01_Head: 'mixamorigHead',
  Bip01_L_Clavicle: 'mixamorigLeftShoulder',
  Bip01_L_UpperArm: 'mixamorigLeftArm',
  Bip01_L_Forearm: 'mixamorigLeftForeArm',
  Bip01_L_Hand: 'mixamorigLeftHand',
  Bip01_R_Clavicle: 'mixamorigRightShoulder',
  Bip01_R_UpperArm: 'mixamorigRightArm',
  Bip01_R_Forearm: 'mixamorigRightForeArm',
  Bip01_R_Hand: 'mixamorigRightHand',
  Bip01_L_Thigh: 'mixamorigLeftUpLeg',
  Bip01_L_Calf: 'mixamorigLeftLeg',
  Bip01_L_Foot: 'mixamorigLeftFoot',
  Bip01_L_Toe0: 'mixamorigLeftToeBase',
  Bip01_R_Thigh: 'mixamorigRightUpLeg',
  Bip01_R_Calf: 'mixamorigRightLeg',
  Bip01_R_Foot: 'mixamorigRightFoot',
  Bip01_R_Toe0: 'mixamorigRightToeBase',
};

// soft blob shadow shared by all NPCs (shadow maps are frozen for perf)
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

const boneY = (root, name) => {
  const b = root.getObjectByName(name);
  if (!b) return null;
  const v = new THREE.Vector3(); b.getWorldPosition(v); return v;
};
function boneSpan(model) {
  model.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  let min = Infinity, max = -Infinity;
  model.traverse((o) => { if (o.isBone) { o.getWorldPosition(v); if (v.y < min) min = v.y; if (v.y > max) max = v.y; } });
  return { min, max, h: Math.max(0.01, max - min) };
}
function findSkinned(root) {
  let s = null; root.traverse((o) => { if (o.isSkinnedMesh && !s) s = o; }); return s;
}

// Rebuild FBX Phong materials from our converted texture sets. Material names
// end in _body / _head / _opacity and tell us which set to bind.
function dressAvatar(fbx, name, texLoader) {
  const base = `assets/models/people/${name}`;
  const tex = (file, srgb) => {
    const t = texLoader.load(`${base}/${file}`);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const mk = (part) => new THREE.MeshStandardMaterial({
    map: tex(`${part}_color.jpg`, true),
    normalMap: tex(`${part}_normal.jpg`),
    roughness: 0.74, metalness: 0,
  });
  const body = mk('body'), head = mk('head');
  const hair = new THREE.MeshStandardMaterial({
    map: tex('opacity_color.png', true),
    transparent: true, alphaTest: 0.35, side: THREE.DoubleSide,
    roughness: 0.6, metalness: 0,
  });
  fbx.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const swapped = mats.map((m) => {
      const n = (m.name || '').toLowerCase();
      if (n.includes('head')) return head;
      if (n.includes('opacity') || n.includes('hair')) return hair;
      return body;
    });
    o.material = Array.isArray(o.material) ? swapped : swapped[0];
    o.castShadow = false; o.receiveShadow = false; o.frustumCulled = false;
  });
}

// ---------------------------------------------------------------- retarget
// three's SkeletonUtils.retarget copies SOURCE bone world-POSITIONS onto the
// target, which destroys cross-proportion rigs (metre donor vs centimetre
// Biped). This is the classic rotation-delta retarget instead: target keeps
// its own bone lengths; each mapped bone gets the source bone's world-space
// rotation DELTA from rest applied on top of its own rest pose. Hip bob is
// transferred as a scaled position track.
// Snapshot every bone's local TRS under root; returns a restore().
// NOTE: never use skeleton.pose() on a scaled rig — it writes bone WORLD
// matrices straight from bind data (native units), which bakes an inverse of
// the root scale into the root bone. That one bit us hard.
function snapshotBones(root) {
  const saved = [];
  root.traverse((o) => { if (o.isBone) saved.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  return () => {
    for (const [b, p, q, s] of saved) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(s); }
    root.updateMatrixWorld(true);
  };
}

function bakeRetarget(donorRoot, donorSkin, tgtRoot, tgtSkin, clip, names, fps = 30) {
  const srcBones = {}, tgtBones = {};
  donorRoot.traverse((o) => { if (o.isBone) srcBones[o.name] = o; });
  tgtRoot.traverse((o) => { if (o.isBone) tgtBones[o.name] = o; });

  // rest pose = the loaded bind state (FBX and glTF both load in bind)
  const restoreDonor = snapshotBones(donorRoot);
  const restoreTgt = snapshotBones(tgtRoot);
  donorRoot.updateMatrixWorld(true);
  tgtRoot.updateMatrixWorld(true);
  const srcRestQ = {}, tgtRestQ = {}, tgtRestPos = {};
  for (const [tName, sName] of Object.entries(names)) {
    const s = srcBones[sName], t = tgtBones[tName];
    if (!s || !t) continue;
    srcRestQ[sName] = s.getWorldQuaternion(new THREE.Quaternion());
    tgtRestQ[tName] = t.getWorldQuaternion(new THREE.Quaternion());
    tgtRestPos[tName] = t.position.clone();
  }

  // A-pose -> T-pose corrective: the donor rests in a T, Rocketbox rests with
  // arms ~40° down. Rotate each arm chain's REST so the shoulder->hand line is
  // horizontal, making rest-relative deltas line up between the rigs.
  for (const side of ['L', 'R']) {
    const sh = tgtBones[`Bip01_${side}_UpperArm`], ha = tgtBones[`Bip01_${side}_Hand`];
    if (!sh || !ha) continue;
    const a = sh.getWorldPosition(new THREE.Vector3()), b = ha.getWorldPosition(new THREE.Vector3());
    const dir = b.clone().sub(a).normalize();
    const flat = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    if (!flat.lengthSq()) continue;
    const qFix = new THREE.Quaternion().setFromUnitVectors(dir, flat);
    for (const seg of ['UpperArm', 'Forearm', 'Hand']) {
      const key = `Bip01_${side}_${seg}`;
      if (tgtRestQ[key]) tgtRestQ[key] = qFix.clone().multiply(tgtRestQ[key]);
    }
  }
  const hipT = 'Bip01_Pelvis', hipS = names[hipT];
  const srcHipRestY = srcBones[hipS] ? srcBones[hipS].getWorldPosition(new THREE.Vector3()).y : 1;
  const tgtHipRestLocal = tgtRestPos[hipT] ? tgtRestPos[hipT].clone() : new THREE.Vector3();
  const hipScale = Math.abs(tgtHipRestLocal.length() / Math.max(0.001, srcHipRestY));

  // mapped bones parent-first so world quats compose correctly during bake
  const depth = (b) => { let d = 0, p = b.parent; while (p) { d++; p = p.parent; } return d; };
  const order = Object.keys(names).filter((n) => tgtBones[n] && srcBones[names[n]])
    .sort((a, b) => depth(tgtBones[a]) - depth(tgtBones[b]));

  const mixer = new THREE.AnimationMixer(donorRoot);
  const action = mixer.clipAction(clip); action.play();
  const frames = Math.max(2, Math.round(clip.duration * fps));
  const dt = clip.duration / (frames - 1);
  const times = new Float32Array(frames);
  const quatData = {}; order.forEach((n) => (quatData[n] = new Float32Array(frames * 4)));
  const hipPos = new Float32Array(frames * 3);

  const dq = new THREE.Quaternion(), wq = new THREE.Quaternion(), pq = new THREE.Quaternion(), inv = new THREE.Quaternion();
  for (let f = 0; f < frames; f++) {
    mixer.setTime(f * dt);
    donorRoot.updateMatrixWorld(true);
    times[f] = f * dt;
    for (const tName of order) {
      const sName = names[tName];
      const t = tgtBones[tName];
      // delta = srcWorldNow * inv(srcWorldRest); tgtWorldNew = delta * tgtWorldRest
      srcBones[sName].getWorldQuaternion(wq);
      inv.copy(srcRestQ[sName]).invert();
      dq.copy(wq).multiply(inv).multiply(tgtRestQ[tName]);
      // to local: inv(parentWorldNow) * tgtWorldNew
      t.parent.getWorldQuaternion(pq).invert();
      t.quaternion.copy(pq).multiply(dq);
      t.updateMatrixWorld(true);
      const o = f * 4;
      const arr = quatData[tName];
      // keep quaternion hemisphere continuous for clean interpolation
      if (f > 0 && (arr[o - 4] * t.quaternion.x + arr[o - 3] * t.quaternion.y + arr[o - 2] * t.quaternion.z + arr[o - 1] * t.quaternion.w) < 0) {
        arr[o] = -t.quaternion.x; arr[o + 1] = -t.quaternion.y; arr[o + 2] = -t.quaternion.z; arr[o + 3] = -t.quaternion.w;
      } else {
        arr[o] = t.quaternion.x; arr[o + 1] = t.quaternion.y; arr[o + 2] = t.quaternion.z; arr[o + 3] = t.quaternion.w;
      }
    }
    // hip bob: rest local position plus the source hip's world-space delta, scaled
    if (srcBones[hipS] && tgtBones[hipT]) {
      const sy = srcBones[hipS].getWorldPosition(new THREE.Vector3()).y;
      const bob = (sy - srcHipRestY) * hipScale;
      const o = f * 3;
      hipPos[o] = tgtHipRestLocal.x; hipPos[o + 1] = tgtHipRestLocal.y + bob; hipPos[o + 2] = tgtHipRestLocal.z;
    }
  }
  action.stop(); mixer.uncacheClip(clip);
  restoreDonor(); restoreTgt(); // back to bind, scale untouched

  const tracks = order.map((n) => new THREE.QuaternionKeyframeTrack(tgtBones[n].name + '.quaternion', times, quatData[n]));
  if (tgtBones[hipT]) tracks.push(new THREE.VectorKeyframeTrack(tgtBones[hipT].name + '.position', times, hipPos));
  return new THREE.AnimationClip(clip.name + '_retgt', clip.duration, tracks);
}

// Sanity-check a retargeted clip: play 0.4s and make sure the skeleton still
// looks like a standing human (head up, feet near floor, nothing exploded).
function retargetIsSane(avatar, mixer, action) {
  const restore = snapshotBones(avatar);
  action.reset(); action.play();
  mixer.update(0.4);
  avatar.updateMatrixWorld(true);
  const span = boneSpan(avatar);
  const head = boneY(avatar, 'Bip01_Head');
  action.stop(); mixer.update(0);
  restore();
  if (!head) return false;
  return span.h > 1.15 && span.h < 2.3 && span.min > -0.45 && span.min < 0.5 && head.y > 1.25 && head.y < 2.1;
}

export function createShoppers(scene, manager, world) {
  const npcs = [];
  const { xs, zMin, zMax, crossZ } = world.corridors;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const texLoader = new THREE.TextureLoader(manager);
  window.__retargetLog = [];

  (async () => {
    // 1) animation donor (mixamorig skeleton + Idle/Walk clips)
    const donor = await new GLTFLoader(manager).loadAsync('assets/models/anims.glb');
    const donorSkin = findSkinned(donor.scene);
    const dClip = (re) => donor.animations.find((c) => re.test(c.name)) || donor.animations[0];
    const walkSrc = dClip(/walk/i), idleSrc = dClip(/idle/i);

    // 2) load + dress + retarget each avatar
    const fbxLoader = new FBXLoader(manager);
    const cast = [];
    for (const name of PEOPLE) {
      try {
        const fbx = await fbxLoader.loadAsync(`assets/models/people/${name}/model.fbx`);
        dressAvatar(fbx, name, texLoader);
        // centimetres -> metres, normalised to human height
        const s = TARGET_H / boneSpan(fbx).h;
        fbx.scale.setScalar(s);
        // facing: toes sit in front of the ankles
        fbx.updateMatrixWorld(true);
        const toe = boneY(fbx, 'Bip01_L_Toe0'), foot = boneY(fbx, 'Bip01_L_Foot');
        const facing = toe && foot && toe.z < foot.z ? Math.PI : 0;

        const skinned = findSkinned(fbx);
        let walkClip = null, idleClip = null;
        try {
          walkClip = bakeRetarget(donor.scene, donorSkin, fbx, skinned, walkSrc, BIP_TO_MIXAMO);
          idleClip = bakeRetarget(donor.scene, donorSkin, fbx, skinned, idleSrc, BIP_TO_MIXAMO);
          const mixer = new THREE.AnimationMixer(fbx);
          const act = mixer.clipAction(walkClip);
          if (!retargetIsSane(fbx, mixer, act)) {
            window.__retargetLog.push(name + ': bake failed sanity');
            walkClip = null;
          } else {
            window.__retargetLog.push(name + ': ok');
          }
          mixer.stopAllAction();
        } catch (e) {
          window.__retargetLog.push(name + ': bake error ' + e.message);
          walkClip = null;
        }
        if (!walkClip) continue; // skip avatars that won't animate sanely
        cast.push({ name, fbx, walkClip, idleClip, facing });
      } catch (e) {
        window.__retargetLog.push(name + ': load error ' + e.message);
      }
    }
    window.__cast = cast.map((c) => c.name);
    if (!cast.length) { window.__retargetLog.push('CAST EMPTY — no shoppers'); return; }

    // 3) populate: 6 walkers (2 pushing carts) + 2 browsers, cycling the cast
    const spawnPerson = (src) => {
      const model = cloneSkinned(src.fbx);
      model.scale.multiplyScalar(rand(0.96, 1.04));
      const blob = new THREE.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.scale.setScalar(0.42 / model.scale.x); blob.position.y = 0.02 / model.scale.x;
      model.add(blob);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(src.idleClip), walk = mixer.clipAction(src.walkClip);
      idle.play(); walk.play(); walk.weight = 0; idle.weight = 1;
      idle.time = Math.random() * 2; walk.time = Math.random() * 1.2;
      return { model, mixer, idle, walk };
    };
    const count = 8;
    for (let i = 0; i < count; i++) {
      const src = cast[i % cast.length];
      const p = spawnPerson(src);
      const browsing = i >= count - 2;
      const n = {
        ...p, oneClip: false, facing: src.facing,
        x: pick(xs), z: rand(zMin + 1, zMax - 1),
        yaw: rand(-Math.PI, Math.PI), speed: rand(0.8, 1.2),
        path: [], pause: rand(0, 2), browsing,
      };
      if (browsing) {
        const ax = pick(xs); const side = Math.random() < 0.5 ? -1 : 1;
        n.x = ax + side * 1.05; n.z = rand(-7, 3);
        n.yaw = side === 1 ? -Math.PI / 2 : Math.PI / 2;
        n.pause = Infinity;
        // basket set down beside them while they browse
        const basket = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.3), new THREE.MeshStandardMaterial({ color: 0xc9241a, roughness: 0.45 }));
        basket.position.set(n.x + Math.sin(n.yaw + Math.PI / 2) * 0.5, 0.11, n.z + Math.cos(n.yaw + Math.PI / 2) * 0.5);
        basket.castShadow = true; scene.add(basket);
      } else if (i === 1 || i === 4) {
        // this shopper pushes a cart — updated to track them each frame
        n.cart = shoppingCart();
        scene.add(n.cart);
      }
      n.model.position.set(n.x, 0, n.z);
      n.model.rotation.y = n.yaw + n.facing;
      scene.add(n.model);
      npcs.push(n);
    }
    // 4) staff standing at their posts (registers, restocking)
    for (let i = 0; i < (world.staffSpots || []).length; i++) {
      const spot = world.staffSpots[i];
      const src = cast[(i + 3) % cast.length];
      const p = spawnPerson(src);
      const n = { ...p, oneClip: false, facing: src.facing, x: spot.x, z: spot.z, yaw: spot.yaw, speed: 0, path: [], pause: Infinity, browsing: true };
      n.model.position.set(spot.x, 0, spot.z);
      n.model.rotation.y = spot.yaw + src.facing;
      scene.add(n.model);
      npcs.push(n);
    }
  })().catch((e) => { window.__retargetLog.push('FATAL: ' + (e && e.message)); });

  function newPath(n) {
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
        if (!n.path.length && Math.random() < 0.55) n.pause = rand(1.2, 4);
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
      n.model.rotation.y = n.yaw + n.facing;
      n.walk.weight = Math.min(1, n.walk.weight + dt * 3);
      n.idle.weight = 1 - n.walk.weight;
      n.walk.timeScale = n.speed / 1.3;
    }
    // pushed carts trail their shopper
    for (const n of npcs) {
      if (!n.cart) continue;
      n.cart.position.set(n.x + Math.sin(n.yaw) * 0.78, 0, n.z + Math.cos(n.yaw) * 0.78);
      n.cart.rotation.y = n.yaw - Math.PI / 2; // handle toward the shopper
    }
  }

  return { update, npcs };
}
