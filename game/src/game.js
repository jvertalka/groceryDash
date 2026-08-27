import * as THREE from 'three';
import { SFX } from './sfx.js';
import { buildProduct, byId } from './products.js';
import { MODES, gradeFor } from './modes.js';
import { getSave, save as persist, bumpStat, recordBest, unlock } from './save.js';

// Interaction layer over the instanced stock: aim → glow highlight + prompt →
// E hides the instance and flies a real mesh into your basket; shopping list
// HUD; checkout zone completes the run.
const REACH = 2.7;

export function createGame(scene, camera, world) {
  const listEl = document.getElementById('list');
  const timerEl = document.getElementById('timer');
  const promptEl = document.getElementById('prompt');
  const bannerEl = document.getElementById('banner');

  const scoreEl = document.getElementById('score');
  const popEl = document.getElementById('scorepop');
  const ray = new THREE.Raycaster();
  ray.far = REACH;
  const flyers = [];
  // run state
  let mode = MODES.run;
  let runState = 'idle'; // idle | running | over
  let score = 0, listsDone = 0, popT = 0;
  let styleStats = { sprintGrabs: 0, debrisGrabs: 0, talks: 0 };
  let onRunEnd = null; // menu callback
  const _basket = new THREE.Vector3();

  function pop(text, bad = false) {
    popEl.textContent = text;
    popEl.className = bad ? 'bad' : '';
    popEl.style.opacity = '1';
    popEl.style.transform = 'translateX(-50%) translateY(0)';
    requestAnimationFrame(() => { popEl.style.transform = 'translateX(-50%) translateY(-34px)'; });
    popT = 0.8;
  }
  function addScore(n, label, bad = false) {
    if (mode.zen) return;
    score += n;
    if (label) pop(`${n >= 0 ? '+' : ''}${n} ${label}`, bad);
  }
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
  function genList(len) {
    const specs = world.stock.availableSpecs();
    const picks = [];
    while (picks.length < len && specs.length) {
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
    const len = mode.listLen + (mode.listGrow ? listsDone * mode.listGrow : 0);
    list = len > 0 ? genList(len) : [];
    listDone = len === 0 ? false : false;
    done = false; started = false;
    world.checkoutRing.visible = false;
    bannerEl.style.display = 'none';
    listEl.style.display = len > 0 ? 'block' : 'none';
    renderList();
  }

  // ---- run lifecycle ---------------------------------------------------------
  function startRun(modeId) {
    mode = MODES[modeId] || MODES.run;
    runState = 'running';
    score = 0; listsDone = 0;
    styleStats = { sprintGrabs: 0, debrisGrabs: 0, talks: 0 };
    time = mode.timer === 'down' ? mode.startTime : 0;
    lastSec = -1;
    if (world.physics) world.physics.resetRun();
    if (world.cartRig) world.cartRig.clearItems();
    reset();
    scoreEl.style.display = mode.zen ? 'none' : 'block';
    scoreEl.querySelector('.mode').textContent = mode.name.toUpperCase();
    scoreEl.querySelector('.pts').textContent = '0';
    timerEl.style.display = mode.timer === 'none' ? 'none' : 'block';
    bumpStat('runs'); persist();
    ach('first_run');
  }

  function endRun(reason) {
    if (runState !== 'running') return;
    runState = 'over';
    world.checkoutRing.visible = false;
    const dmg = world.physics ? world.physics.damage : { total: 0, count: 0 };
    const ev = world.physics ? world.physics.runEvents : { tips: 0, glass: 0, tvs: 0 };
    if (mode.chaosScore) {
      score = Math.round(dmg.count * 30 + dmg.total * 3 + ev.tips * 600 + ev.glass * 120 + ev.tvs * 250);
    } else if (mode.billing) {
      score = Math.max(0, Math.round(score - dmg.total * 2));
    }
    const elapsed = mode.timer === 'down' ? mode.startTime - time : time;
    const grade = gradeFor(mode.id, score);
    bumpStat('damageTotal', dmg.total);
    bumpStat('aislesTipped', ev.tips); bumpStat('glassBroken', ev.glass); bumpStat('tvsBroken', ev.tvs);
    const isBest = recordBest(mode.id, score, elapsed, grade);
    // run-scoped achievements
    if (mode.id !== 'zen') {
      if (dmg.count === 0 && listsDone > 0) ach('clean_run');
      if (mode.id === 'run' && reason === 'checkout' && elapsed < 60) ach('speed_demon');
      if (ev.tips >= 1) ach('demolition');
      if (ev.tips >= 3) ach('rampage');
      if (ev.glass >= 3) ach('glazier');
      if (ev.tvs >= 1) ach('tv_critic');
      if ((ev.hits || 0) >= 3) ach('big_thrower');
      if (mode.id === 'endless' && listsDone >= 5) ach('marathon');
    }
    SFX.checkout();
    if (onRunEnd) onRunEnd({
      mode, score, grade, isBest, reason,
      time: elapsed, lists: listsDone, damage: dmg, events: ev, style: styleStats,
    });
  }

  function ach(id) {
    if (unlock(id)) {
      const NAMES = {
        first_run: 'Clocking In', clean_run: 'Not a Scratch', speed_demon: 'Speed Demon',
        rampage: 'Rampage', marathon: 'Marathon Shift', demolition: 'Demolition Aisle',
        glazier: 'De-Glazed', tv_critic: 'Harsh Critic', people_person: 'People Person',
        cleanup_crew: 'Cleanup Crew', big_thrower: 'Aim Like You Mean It',
      };
      setTimeout(() => { if (world.physics) world.physics.toast(`🏆 Achievement: ${NAMES[id] || id}`); SFX.listDone(); }, 400);
    }
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
    if (!hover || done || runState !== 'running') return;
    const h = hover; setHover(null);
    const wasDebris = !!h.debris;
    let fly;
    if (wasDebris) {
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
    flyers.push({ g: fly, t: 0, from: new THREE.Vector3(h.x, h.y, h.z), spec: h.spec });
    SFX.grab();
    bumpStat('itemsGrabbed');
    const entry = list.find((e) => e.id === h.spec.id && e.got < e.need);
    const sprinting = world.playerSpeed && world.playerSpeed() > 4;
    if (entry) {
      entry.got++;
      addScore(Math.round(20 + h.spec.price), entry.name);
      SFX.tick();
      renderList();
    } else {
      addScore(5, null);
    }
    if (sprinting) { styleStats.sprintGrabs++; addScore(40, 'SPRINT GRAB'); }
    if (wasDebris) {
      styleStats.debrisGrabs++; bumpStat('debrisGrabbed');
      addScore(30, 'CLEANUP CREW');
      if (styleStats.debrisGrabs >= 5) ach('cleanup_crew');
    }
    if (entry && !listDone && list.length && list.every((e) => e.got >= e.need)) {
      listDone = true;
      world.checkoutRing.visible = true;
      SFX.listDone();
      banner('✓ List complete — head to CHECKOUT', 1600);
    }
  }
  function banner(html, hideAfter) {
    bannerEl.innerHTML = html;
    bannerEl.style.display = 'block';
    if (hideAfter) setTimeout(() => { if (!done) bannerEl.style.display = 'none'; }, hideAfter);
  }

  // ---- throwing (Q) ----------------------------------------------------------
  function tryThrow() {
    if (!hover || done || !world.physics || runState !== 'running') return;
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
    if (line) {
      SFX.talk();
      styleStats.talks++; bumpStat('npcTalks');
      if (styleStats.talks >= 5) ach('people_person');
    }
  }

  // ---- per-frame -----------------------------------------------------------
  function update(dt, locked) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i];
      f.t = Math.min(1, f.t + dt / 0.4);
      if (world.cartRig) world.cartRig.basketWorldPos(_flyTarget);
      else {
        camera.getWorldDirection(_flyDir);
        _flyTarget.copy(camera.position).addScaledVector(_flyDir, 0.45);
        _flyTarget.y -= 0.32;
      }
      f.g.position.lerpVectors(f.from, _flyTarget, f.t);
      f.g.position.y += Math.sin(f.t * Math.PI) * 0.35;
      f.g.rotation.y += dt * 7;
      f.g.scale.setScalar(1 - 0.6 * f.t);
      if (f.t >= 1) {
        scene.remove(f.g);
        if (world.cartRig && f.spec) world.cartRig.addItem(f.spec);
        flyers.splice(i, 1);
      }
    }
    if (!locked || runState !== 'running') { setHover(null); promptEl.style.display = 'none'; return; }
    if (!started) started = true;
    if (popT > 0) { popT -= dt; if (popT <= 0) popEl.style.opacity = '0'; }
    // timer: up, down (fail at zero), or none
    if (started && !done) {
      if (mode.timer === 'up') time += dt;
      else if (mode.timer === 'down') {
        time -= dt;
        if (time <= 0) { time = 0; timerEl.textContent = '0:00'; endRun('time'); return; }
      }
    }
    const secs = Math.floor(time);
    if (secs !== lastSec) {
      lastSec = secs;
      timerEl.textContent = fmt(time);
      timerEl.style.color = mode.timer === 'down' && time < 15 ? '#e8907f' : '';
      if (!mode.zen) {
        const dmg = world.physics ? world.physics.damage : { total: 0, count: 0 };
        const ev = world.physics ? world.physics.runEvents : { tips: 0, glass: 0, tvs: 0, hits: 0 };
        const live = mode.chaosScore
          ? Math.round(dmg.count * 30 + dmg.total * 3 + ev.tips * 600 + ev.glass * 120 + ev.tvs * 250)
          : score;
        scoreEl.querySelector('.pts').textContent = String(live);
        // physics-driven achievements checked on the cheap 1Hz tick
        if (ev.tips >= 1) ach('demolition');
        if (ev.glass >= 3) ach('glazier');
        if (ev.tvs >= 1) ach('tv_critic');
        if ((ev.hits || 0) >= 3) ach('big_thrower');
      }
    }

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

    const nearCheckout = list.length > 0 && camera.position.distanceTo(world.checkout) < 2.2;
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
    if (done || runState !== 'running') return;
    listsDone++;
    bumpStat('listsCompleted'); persist();
    world.checkoutRing.visible = false;
    // list value + time bonus
    const total = list.reduce((a, e) => a + e.price, 0);
    const timeBonus = mode.timer === 'down' ? Math.round(time * 4) : Math.max(0, Math.round(600 - time * 4));
    addScore(150 + Math.round(total), 'LIST BANKED');
    if (!mode.zen && timeBonus > 0) addScore(timeBonus, 'TIME BONUS');
    if (mode.refillList) {
      // endless/zen: extend the clock, hand over a bigger list, keep going
      if (mode.timeBonusPerList) {
        time += mode.timeBonusPerList;
        banner(`✓ List ${listsDone} banked · +${mode.timeBonusPerList}s`, 1400);
      } else {
        banner('✓ Nice haul. Fresh list.', 1400);
      }
      SFX.checkout();
      if (world.cartRig) world.cartRig.clearItems();
      const keepDone = listsDone;
      reset();
      listsDone = keepDone;
      return;
    }
    done = true;
    endRun('checkout');
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') tryGrab();
    if (e.code === 'KeyQ') tryThrow();
    if (e.code === 'KeyT') tryTalk();
    if (e.code === 'KeyM') SFX.toggleMute();
  });

  return {
    update, tryGrab, tryThrow, tryTalk, facingNpc, startRun, endRun,
    set onRunEnd(fn) { onRunEnd = fn; },
    get list() { return list; },
    get mode() { return mode; },
    get state() { return { listDone, done, time, runState, score, listsDone }; },
    reset, complete,
  };
}
