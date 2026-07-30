import * as THREE from 'three';
import { SFX } from './sfx.js';
import { buildProduct, byId } from './products.js';

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
  // scratch objects — the hover path runs every frame
  const _ndc = new THREE.Vector2(0, 0);
  const _flyTarget = new THREE.Vector3();
  const _flyDir = new THREE.Vector3();
  const _nearDebris = [];
  let hover = null, listDone = false, done = false, started = false, time = 0;
  let list = [], lastSec = -1;

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
    let fly;
    if (h.debris) {
      // pick the knocked-down item up off the floor — reuse its mesh
      world.physics.removeDebris(h.debris);
      fly = h.debris;
      fly.rotation.x = 0; fly.rotation.z = 0;
      scene.add(fly);
    } else {
      h.hide();
      fly = buildProduct(h.spec);
      fly.position.set(h.x, h.y, h.z);
      fly.rotation.y = h.rotY;
      scene.add(fly);
    }
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

  // ---- throwing (Q) ----------------------------------------------------------
  function tryThrow() {
    if (!hover || done || !world.physics) return;
    const h = hover; setHover(null);
    if (h.debris) world.physics.throwDebrisMesh(h.debris);
    else { h.hide(); world.physics.throwSpec(h.spec); }
  }

  // ---- talking (T) -----------------------------------------------------------
  const _fwd = new THREE.Vector3(), _toN = new THREE.Vector3();
  function facingNpc() {
    if (!world.getNpcs) return null;
    camera.getWorldDirection(_fwd);
    let best = null, bestDot = 0.86;
    for (const n of world.getNpcs()) {
      _toN.set(n.x - camera.position.x, 0, n.z - camera.position.z);
      const d = _toN.length();
      if (d > 3.2 || d < 0.2) continue;
      _toN.normalize();
      const dot = _toN.x * _fwd.x + _toN.z * _fwd.z;
      if (dot > bestDot) { bestDot = dot; best = n; }
    }
    return best;
  }
  function tryTalk() {
    const n = facingNpc();
    if (!n || !world.npcTalk) return;
    const entry = list.find((e) => e.got < e.need);
    const line = world.npcTalk.talkTo(n, {
      nextSpec: entry ? byId(entry.id) : null,
      damageCount: world.physics ? world.physics.damage.count : 0,
      playerPos: camera.position,
    });
    if (line) SFX.talk();
  }

  // ---- per-frame -----------------------------------------------------------
  function update(dt, locked) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t = Math.min(1, f.t + dt / 0.4);
      camera.getWorldDirection(_flyDir);
      _flyTarget.copy(camera.position).addScaledVector(_flyDir, 0.45);
      _flyTarget.y -= 0.32;
      f.g.position.lerpVectors(f.from, _flyTarget, f.t);
      f.g.position.y += Math.sin(f.t * Math.PI) * 0.3;
      f.g.rotation.y += dt * 7;
      f.g.scale.setScalar(1 - 0.75 * f.t);
      if (f.t >= 1) { scene.remove(f.g); flyers.splice(i, 1); }
    }
    if (!locked) { setHover(null); promptEl.style.display = 'none'; return; }
    if (!started) started = true;
    if (started && !done) time += dt;
    const secs = Math.floor(time);
    if (secs !== lastSec) { lastSec = secs; timerEl.textContent = fmt(time); }

    ray.setFromCamera(_ndc, camera);
    const hits = ray.intersectObjects(world.stock.raycastTargets, false);
    let target = hits.length ? world.stock.resolve(hits[0]) : null;
    // knocked-off items on the floor are still fair game for your list —
    // but only raycast the pieces actually near the player
    if (world.physics && world.physics.debrisMeshes.length) {
      _nearDebris.length = 0;
      for (const m of world.physics.debrisMeshes) {
        const ddx = m.position.x - camera.position.x, ddz = m.position.z - camera.position.z;
        if (ddx * ddx + ddz * ddz < 20) _nearDebris.push(m);
      }
      const dHits = _nearDebris.length ? ray.intersectObjects(_nearDebris, true) : [];
      if (dHits.length && (!hits.length || dHits[0].distance < hits[0].distance)) {
        let m = dHits[0].object;
        while (m && !m.userData.debris) m = m.parent;
        if (m) {
          target = {
            debris: m, spec: m.userData.spec, size: m.userData.size, centerY: m.userData.centerY,
            x: m.position.x, y: m.position.y, z: m.position.z, rotY: m.rotation.y,
          };
        }
      }
    }
    setHover(target);

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
      promptEl.innerHTML = `<b>${s.name}</b> · $${s.price.toFixed(2)} — <span class="key">E</span> take · <span class="key">Q</span> throw`;
    } else {
      const n = facingNpc();
      if (n) {
        promptEl.style.display = 'block';
        promptEl.innerHTML = `<span class="key">T</span> ${n.staff ? 'Ask for help' : 'Talk'}`;
      } else promptEl.style.display = 'none';
    }
  }
  function complete() {
    if (done) return;
    done = true;
    world.checkoutRing.visible = false;
    SFX.checkout();
    const total = list.reduce((a, e) => a + e.price, 0);
    const dmg = world.physics ? world.physics.damage : { total: 0, count: 0 };
    const dmgLine = dmg.count > 0
      ? `<p style="color:#e8907f">Store damages: ${dmg.count} items · $${dmg.total.toFixed(2)} 😬</p>`
      : '';
    banner(`<h2>🛒 Checked out!</h2><p>${list.length} items · $${total.toFixed(2)}</p>${dmgLine}<p class="big">${fmt(time)}</p><p class="dim">Press R for a new list</p>`);
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryGrab();
    if (e.code === 'KeyQ') tryThrow();
    if (e.code === 'KeyT') tryTalk();
    if (e.code === 'KeyR' && done) reset();
    if (e.code === 'KeyM') SFX.toggleMute();
  });

  reset();
  return { update, tryGrab, tryThrow, tryTalk, facingNpc, get list() { return list; }, get state() { return { listDone, done, time }; }, reset, complete };
}
