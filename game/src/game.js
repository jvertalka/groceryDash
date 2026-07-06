import * as THREE from 'three';
import { SFX } from './sfx.js';
import { buildProduct } from './products.js';

// Interaction layer over the instanced stock: aim → glow highlight + prompt →
// E hides the instance and flies a real mesh into your basket; shopping list
// HUD; checkout zone completes the run.
const REACH = 2.7;

export function createGame(scene, camera, world) {
  const listEl = document.getElementById('list');
  const timerEl = document.getElementById('timer');
  const promptEl = document.getElementById('prompt');
  const bannerEl = document.getElementById('banner');

  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const flyers = [];
  let hover = null, listDone = false, done = false, started = false, time = 0;
  let list = [];

  // hover glow: one shared translucent box, fitted to the aimed product
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  glow.visible = false; scene.add(glow);

  // ---- shopping list -------------------------------------------------------
  function genList() {
    const specs = world.stock.availableSpecs();
    const picks = [];
    while (picks.length < 6 && specs.length) {
      const i = Math.floor(Math.random() * specs.length);
      picks.push(specs.splice(i, 1)[0]);
    }
    return picks.map((s) => ({ id: s.id, name: s.name, price: s.price, got: 0, need: 1 }));
  }
  function renderList() {
    const rows = list.map((e) => {
      const ok = e.got >= e.need;
      return `<div class="row${ok ? ' ok' : ''}"><span class="chk">${ok ? '✓' : '○'}</span>${e.name}<span class="pr">$${e.price.toFixed(2)}</span></div>`;
    }).join('');
    listEl.innerHTML = `<h3>SHOPPING LIST</h3>${rows}<div class="foot">${list.filter((e) => e.got >= e.need).length}/${list.length} · then CHECKOUT</div>`;
  }
  function reset() {
    list = genList(); listDone = false; done = false; time = 0; started = false;
    world.checkoutRing.visible = false;
    bannerEl.style.display = 'none';
    renderList();
  }

  // ---- grabbing ------------------------------------------------------------
  function setHover(h) {
    hover = h;
    if (!h) { glow.visible = false; return; }
    glow.visible = true;
    glow.scale.set(h.size.x + 0.05, h.size.y + 0.05, h.size.z + 0.05);
    glow.position.set(h.x, h.y + h.centerY, h.z);
    glow.rotation.y = h.rotY;
  }
  function tryGrab() {
    if (!hover || done) return;
    const h = hover; setHover(null);
    h.hide();
    // spawn a real mesh where the instance was; it flies into the basket
    const fly = buildProduct(h.spec);
    fly.position.set(h.x, h.y, h.z);
    fly.rotation.y = h.rotY;
    scene.add(fly);
    flyers.push({ g: fly, t: 0, from: new THREE.Vector3(h.x, h.y, h.z) });
    SFX.grab();
    const entry = list.find((e) => e.id === h.spec.id && e.got < e.need);
    if (entry) {
      entry.got++;
      SFX.tick();
      renderList();
      if (!listDone && list.every((e) => e.got >= e.need)) {
        listDone = true;
        world.checkoutRing.visible = true;
        SFX.listDone();
        banner('✓ List complete — head to CHECKOUT', 1600);
      }
    }
  }
  function banner(html, hideAfter) {
    bannerEl.innerHTML = html;
    bannerEl.style.display = 'block';
    if (hideAfter) setTimeout(() => { if (!done) bannerEl.style.display = 'none'; }, hideAfter);
  }

  // ---- per-frame -----------------------------------------------------------
  function update(dt, locked) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t = Math.min(1, f.t + dt / 0.4);
      const target = camera.position.clone()
        .add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.45))
        .add(new THREE.Vector3(0, -0.32, 0));
      f.g.position.lerpVectors(f.from, target, f.t);
      f.g.position.y += Math.sin(f.t * Math.PI) * 0.3;
      f.g.rotation.y += dt * 7;
      f.g.scale.setScalar(1 - 0.75 * f.t);
      if (f.t >= 1) { scene.remove(f.g); flyers.splice(i, 1); }
    }
    if (!locked) { setHover(null); promptEl.style.display = 'none'; return; }
    if (!started) started = true;
    if (started && !done) time += dt;
    timerEl.textContent = fmt(time);

    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = ray.intersectObjects(world.stock.raycastTargets, false);
    setHover(hits.length ? world.stock.resolve(hits[0]) : null);

    const nearCheckout = camera.position.distanceTo(world.checkout) < 2.2;
    if (done) {
      promptEl.style.display = 'none';
    } else if (nearCheckout) {
      promptEl.style.display = 'block';
      if (listDone) { complete(); }
      else promptEl.textContent = `Finish your list first — ${list.filter((e) => e.got >= e.need).length}/${list.length}`;
    } else if (hover) {
      const s = hover.spec;
      promptEl.style.display = 'block';
      promptEl.innerHTML = `<b>${s.name}</b> · $${s.price.toFixed(2)} — <span class="key">E</span> take`;
    } else {
      promptEl.style.display = 'none';
    }
  }
  function complete() {
    if (done) return;
    done = true;
    world.checkoutRing.visible = false;
    SFX.checkout();
    const total = list.reduce((a, e) => a + e.price, 0);
    banner(`<h2>🛒 Checked out!</h2><p>${list.length} items · $${total.toFixed(2)}</p><p class="big">${fmt(time)}</p><p class="dim">Press R for a new list</p>`);
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryGrab();
    if (e.code === 'KeyR' && done) reset();
    if (e.code === 'KeyM') SFX.toggleMute();
  });

  reset();
  return { update, tryGrab, get list() { return list; }, get state() { return { listDone, done, time }; }, reset, complete };
}
