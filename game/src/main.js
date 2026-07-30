import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import { loadEnvironment } from './env.js';
import { preloadModels } from './models.js';
import { buildStore, STORE } from './store.js';
import { createShoppers } from './characters.js';
import { createGame } from './game.js';
import { createPhysics } from './physics.js';
import { SFX } from './sfx.js';

const boot = document.getElementById('boot');
const bootbar = document.getElementById('bootbar');
const bootmsg = document.getElementById('bootmsg');
const crosshair = document.getElementById('crosshair');
const hint = document.getElementById('hint');

try {
  // ---------------------------------------------------------------- renderer
  const app = document.getElementById('app');
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, (innerWidth / innerHeight) || 16 / 9, 0.1, 100);

  // ---------------------------------------------------------------- loading UI
  const manager = new THREE.LoadingManager();
  manager.onProgress = (_u, loaded, total) => { bootbar.style.width = `${Math.round((loaded / total) * 100)}%`; };
  manager.onLoad = () => {
    // pay the shader-compile storm HERE, behind the boot screen, instead of
    // freezing the first rendered frame for many seconds on integrated GPUs
    bootmsg.textContent = 'Preparing shaders…';
    requestAnimationFrame(() => {
      try { renderer.compile(scene, camera); } catch (e) {}
      bootmsg.textContent = 'Ready';
      boot.style.opacity = '0';
      setTimeout(() => (boot.style.display = 'none'), 650);
      hint.style.opacity = '1';
      setTimeout(() => (hint.style.opacity = '0'), 6000);
    });
  };
  const texLoader = new THREE.TextureLoader(manager);

  // ---------------------------------------------------------------- world
  bootmsg.textContent = 'Lighting…';
  loadEnvironment(renderer, scene, manager).catch((e) => (window.__err = 'env: ' + e));

  bootmsg.textContent = 'Loading models…';
  await preloadModels(manager); // real CC0 models (cars/produce/props); no-op without a kit
  bootmsg.textContent = 'Building store…';
  const world = buildStore(scene, texLoader);
  camera.position.copy(world.spawn);
  camera.lookAt(0, 1.5, 0);

  const shoppers = createShoppers(scene, manager, world);
  world.getNpcs = () => shoppers.npcs;
  world.npcTalk = { say: shoppers.say, talkTo: shoppers.talkTo };
  const game = createGame(scene, camera, world);
  const physics = createPhysics({ scene, world, camera });
  world.physics = physics;

  // ---------------------------------------------------------------- post
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 2, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, innerWidth, innerHeight);
  gtao.blendIntensity = 0.85;
  try { gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1, thickness: 1, scale: 1, samples: 8, screenSpaceRadius: false }); } catch (e) {}
  gtao.enabled = false; // lite tier by default; autoQuality upgrades on fast GPUs
  composer.addPass(gtao);
  // threshold .96 means only true emitters (troffers, LEDs, screens) bloom —
  // ordinary bright surfaces stay clean
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.16, 0.5, 0.96);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------------------------------------------------------------- controls
  // Pointer lock when the browser allows it; otherwise (sandboxed iframes,
  // embedded previews) fall back to drag-to-look so the game ALWAYS plays.
  const controls = new PointerLockControls(camera, renderer.domElement);
  scene.add(controls.getObject());
  let playing = false, fallbackLook = false;
  camera.rotation.reorder('YXZ');

  function enableFallback() {
    if (fallbackLook || controls.isLocked) return;
    fallbackLook = true; playing = true;
    SFX.start();
    crosshair.style.display = 'block';
    hint.textContent = 'Drag to look · WASD move · E take item · M mute';
    hint.style.opacity = '1';
    setTimeout(() => (hint.style.opacity = '0'), 5000);
  }
  document.addEventListener('pointerlockerror', enableFallback);
  addEventListener('click', () => {
    if (boot.style.display !== 'none' || playing) return;
    try { controls.lock(); } catch { enableFallback(); }
    // some embeds swallow the request without firing pointerlockerror
    setTimeout(() => { if (!controls.isLocked && !fallbackLook) enableFallback(); }, 350);
  });
  controls.addEventListener('lock', () => { playing = true; SFX.start(); crosshair.style.display = 'block'; hint.style.opacity = '0'; });
  controls.addEventListener('unlock', () => { if (!fallbackLook) playing = false; crosshair.style.display = 'none'; });

  // drag-to-look (fallback mode only)
  let dragging = false, lastX = 0, lastY = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => { if (fallbackLook) { dragging = true; lastX = e.clientX; lastY = e.clientY; } });
  addEventListener('pointerup', () => (dragging = false));
  addEventListener('pointermove', (e) => {
    if (!fallbackLook || !dragging) return;
    camera.rotation.y -= (e.clientX - lastX) * 0.0042;
    camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - (e.clientY - lastY) * 0.0042, -1.45, 1.45);
    camera.rotation.z = 0;
    lastX = e.clientX; lastY = e.clientY;
  });

  const keys = {};
  addEventListener('keydown', (e) => (keys[e.code] = true));
  addEventListener('keyup', (e) => (keys[e.code] = false));

  const R = 0.34, SPEED_WALK = 3.1, SPEED_RUN = 4.9;
  const hitC = (x, z) => world.colliders.find((c) => x > c.minX - R && x < c.maxX + R && z > c.minZ - R && z < c.maxZ + R);
  let bob = 0;
  const playerVel = new THREE.Vector3();
  const _dir = new THREE.Vector3(), _right = new THREE.Vector3();
  function move(dt) {
    const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    const s = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const moving = (f || s) && playing;
    const SPEED = (keys.ShiftLeft || keys.ShiftRight) ? SPEED_RUN : SPEED_WALK;
    if (moving) {
      camera.getWorldDirection(_dir); _dir.y = 0; _dir.normalize();
      _right.crossVectors(_dir, camera.up).normalize();
      const vx = _dir.x * f + _right.x * s, vz = _dir.z * f + _right.z * s;
      const len = Math.hypot(vx, vz) || 1;
      const dx = vx / len, dz = vz / len;
      playerVel.set(dx * SPEED, 0, dz * SPEED);
      const p = camera.position;
      const nx = p.x + dx * SPEED * dt, nz = p.z + dz * SPEED * dt;
      const b = world.bounds;
      const stuck = !!hitC(p.x, p.z); // if ever wedged inside a collider, let them walk out
      const cX = hitC(nx, p.z);
      if (nx > b.minX && nx < b.maxX && (stuck || !cX)) p.x = nx;
      else if (cX) physics.onPlayerBlocked(cX, SPEED, dx, dz);
      const cZ = hitC(p.x, nz);
      if (nz > b.minZ && nz < b.maxZ && (stuck || !cZ)) p.z = nz;
      else if (cZ) physics.onPlayerBlocked(cZ, SPEED, dx, dz);
      bob += dt * (SPEED > 4 ? 13.5 : 10.5);
    } else {
      playerVel.multiplyScalar(Math.max(0, 1 - 6 * dt));
    }
    camera.position.y = 1.65 + (moving ? Math.sin(bob) * (SPEED > 4 ? 0.045 : 0.03) : 0)
      + (physics.shake > 0 ? (Math.random() - 0.5) * physics.shake * 0.12 : 0);
  }

  // ---------------------------------------------------------------- loop
  // Progressive quality: START in the lite tier (no GTAO, no rect-area wash
  // lights, half the shadow spots) so weak GPUs are smooth from frame one,
  // then UPGRADE if the GPU proves fast. Starting heavy and degrading later
  // meant integrated GPUs chugged through the first several seconds.
  let frames = 0, acc = 0, tier = 'lite';
  {
    let si = 0;
    scene.traverse((o) => {
      if (o.isRectAreaLight) o.visible = false;
      if (o.isSpotLight && si++ % 2 === 1) o.castShadow = false;
    });
  }
  function applyHigh() {
    tier = 'high';
    gtao.enabled = true;
    scene.traverse((o) => {
      if (o.isRectAreaLight) o.visible = true;
      if (o.isSpotLight) { o.castShadow = true; o.shadow.needsUpdate = true; }
    });
  }
  function autoQuality(dt) {
    if (frames === 3) {
      // store geometry is static — render each shadow map once, then freeze it
      scene.traverse((o) => { if (o.isSpotLight) { o.shadow.needsUpdate = true; o.shadow.autoUpdate = false; } });
    }
    if (tier === 'lite') {
      if (frames > 20 && frames <= 80) acc += dt;
      if (frames === 80) {
        const avg = acc / 60;
        if (avg < 0.02) applyHigh(); // headroom for the pretty passes
        else if (avg > 0.055) { renderer.setPixelRatio(1); composer.setSize(innerWidth, innerHeight); tier = 'panic'; }
        else tier = 'lite-locked';
        window.__tier = tier;
      }
    }
    frames++;
  }
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    autoQuality(dt);
    move(dt);
    physics.update(dt, camera.position, playerVel);
    world.update(dt, camera);
    shoppers.update(dt, camera);
    game.update(dt, playing);
    composer.render();
  }
  animate();

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    gtao.setSize(innerWidth, innerHeight);
  });

  // debug / verification hooks
  Object.assign(window, {
    __scene: scene, __camera: camera, __renderer: renderer, __composer: composer,
    __controls: controls, __world: world, __STORE: STORE, __game: game,
    __stock: world.stock, __npcs: shoppers.npcs, __npcUpdate: shoppers.update, __ready: true,
    __move: move, __setPlaying: (v) => (playing = v), __isPlaying: () => playing, __isFallback: () => fallbackLook,
    __physics: physics, __keys: keys, __playerVel: playerVel,
  });
} catch (e) {
  window.__err = (e && e.stack) || String(e);
  bootmsg && (bootmsg.textContent = 'Error — see console');
  const pre = document.createElement('pre');
  pre.style.cssText = 'position:fixed;inset:0;margin:0;padding:16px;color:#f77;background:#111;font:12px monospace;white-space:pre-wrap;z-index:99;overflow:auto';
  pre.textContent = window.__err;
  document.body.appendChild(pre);
}
