import * as THREE from 'three';
import { buildProduct } from './products.js';
import { pickLine } from './characters.js';
import { SFX } from './sfx.js';

// Arcade physics for a fully interactive store. Not a general engine — three
// purpose-built systems that share one update:
//  - CARTS: dynamic circles with momentum; the player shoves them around,
//    they bounce off fixtures and each other, and tip over on hard crashes.
//  - DEBRIS: shelf products knocked loose become ballistic meshes (gravity,
//    floor bounce, tumble) that come to rest as floor clutter — and can still
//    be picked up for your list.
//  - GONDOLAS: shelf islands take impacts; a sprint crash tips the whole
//    aisle over (pivot at the base edge), spilling stock and permanently
//    changing the walkable space.
const PLAYER_R = 0.34;
const CART_R = 0.48;
const TIP_SPEED = 4.0;      // sprint-crash threshold for tipping an aisle
const KNOCK_SPEED = 1.6;    // walking-crash threshold for knocking items off
const DEBRIS_CAP = 100;
const DEBRIS_TTL = 28;      // resting clutter fades out after this many seconds
const SPAWNS_PER_FRAME = 9; // amortize big spills so a tip never hitches a frame

const BUMP_LINES = ['"Hey, watch it!"', '"Excuse YOU."', '"Seriously?!"', '"Ow! My cart!"', '"Careful, buddy!"'];
const CRASH_LINES = ['🛒 CRUNCH.', '🛒 That\'s coming out of your deposit.', '🛒 Cart casualty.'];

export function createPhysics({ scene, world, camera }) {
  // toast line (separate from the game banner)
  const toastEl = document.createElement('div');
  toastEl.id = 'toast';
  document.body.appendChild(toastEl);
  let toastT = 0;
  function toast(msg) { toastEl.textContent = msg; toastEl.style.opacity = '1'; toastT = 2.6; }

  let shake = 0;
  const addShake = (v) => (shake = Math.min(1, shake + v));

  // ---- dynamic carts --------------------------------------------------------
  const carts = (world.physicsMeta.carts || []).map((mesh) => ({
    mesh, x: mesh.position.x, z: mesh.position.z,
    yaw: mesh.rotation.y, vx: 0, vz: 0, tipped: false, tipT: 0,
  }));

  // ---- gondolas -------------------------------------------------------------
  const gondolas = (world.physicsMeta.gondolas || []).map((g) => ({
    ...g, tipped: false, tipT: 0, tipSign: 1, pivot: null, knockCd: 0,
  }));

  // ---- debris ---------------------------------------------------------------
  const debris = [];
  const debrisMeshList = []; // stable array — rebuilt in place, no per-frame allocs
  const spawnQueue = [];     // pending spawns, drained a few per frame
  let damageTotal = 0, damageCount = 0;
  const runEvents = { tips: 0, glass: 0, tvs: 0, hits: 0 }; // per-run counters for scoring/achievements
  function syncDebrisList() {
    debrisMeshList.length = 0;
    for (const d of debris) debrisMeshList.push(d.mesh);
  }
  function spawnDebrisNow(spec, x, y, z, rotY, vx, vy, vz) {
    const mesh = buildProduct(spec);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    // measure once for the hover highlight box
    const bb = new THREE.Box3().setFromObject(mesh);
    mesh.userData.debris = true;
    mesh.userData.size = bb.getSize(new THREE.Vector3());
    mesh.userData.centerY = (bb.min.y + bb.max.y) / 2 - y;
    scene.add(mesh);
    debris.push({
      mesh, spec,
      v: new THREE.Vector3(vx, vy, vz),
      w: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6),
      resting: false, age: 0, fade: 0,
    });
    // cap: drop the oldest resting piece, else the oldest piece outright
    if (debris.length > DEBRIS_CAP) {
      let idx = debris.findIndex((d) => d.resting);
      if (idx < 0) idx = 0;
      scene.remove(debris[idx].mesh);
      debris.splice(idx, 1);
    }
    syncDebrisList();
  }
  function spawnDebris(spec, x, y, z, rotY, vx, vy, vz) {
    damageTotal += spec.price * 0.4; damageCount++;
    spawnQueue.push([spec, x, y, z, rotY, vx, vy, vz]);
  }

  function knockItems(box, count, dirX, dirZ, oomph) {
    const hidden = world.stock.hideInRegion(box, count);
    for (const h of hidden) {
      spawnDebris(
        h.spec, h.x, h.y, h.z, h.rotY,
        dirX * (0.6 + Math.random() * oomph) + (Math.random() - 0.5) * 0.8,
        0.5 + Math.random() * 1.2,
        dirZ * (0.6 + Math.random() * oomph) + (Math.random() - 0.5) * 0.8,
      );
    }
    if (hidden.length) SFX.clatter();
    return hidden.length;
  }

  // ---- gondola tipping ------------------------------------------------------
  function tipGondola(g, sign) {
    if (g.tipped) return;
    g.tipped = true; g.tipSign = sign;
    // spill: fling a capped burst of its stock, silently hide the rest
    const box = g.axis === 'z'
      ? { minX: g.cx - 0.6, maxX: g.cx + 0.6, minZ: g.cz - g.len / 2 - 0.2, maxZ: g.cz + g.len / 2 + 0.2 }
      : { minX: g.cx - g.len / 2 - 0.2, maxX: g.cx + g.len / 2 + 0.2, minZ: g.cz - 0.6, maxZ: g.cz + 0.6 };
    const hidden = world.stock.hideInRegion(box, 9999);
    const fling = hidden.slice(0, 56);
    for (const h of fling) {
      const vy = 0.6 + h.y * 1.4 + Math.random();
      const push = 1.2 + h.y * 1.8 + Math.random() * 1.5;
      spawnDebris(
        h.spec, h.x, h.y, h.z, h.rotY,
        g.axis === 'z' ? sign * push : (Math.random() - 0.5) * 1.2,
        vy,
        g.axis === 'x' ? sign * push : (Math.random() - 0.5) * 1.2,
      );
    }
    // pivot at the base edge on the fall side
    const pivot = new THREE.Object3D();
    if (g.axis === 'z') pivot.position.set(g.cx + sign * 0.46, 0, g.cz);
    else pivot.position.set(g.cx, 0, g.cz + sign * 0.46);
    scene.add(pivot);
    pivot.attach(g.group);
    g.pivot = pivot;
    // walkable space: the collider becomes the fallen footprint
    const H = 1.9;
    if (g.axis === 'z') {
      g.collider.minX = sign > 0 ? g.cx + 0.42 : g.cx - 0.42 - H;
      g.collider.maxX = sign > 0 ? g.cx + 0.42 + H : g.cx - 0.42;
    } else {
      g.collider.minZ = sign > 0 ? g.cz + 0.42 : g.cz - 0.42 - H;
      g.collider.maxZ = sign > 0 ? g.cz + 0.42 + H : g.cz - 0.42;
    }
    addShake(0.9);
    SFX.crash();
    runEvents.tips++;
    toast(`📢 CLEANUP ON AISLE ${g.label || ''} — ALL OF IT.`);
  }

  // ---- player impact routing ------------------------------------------------
  let crashCd = 0;
  function onPlayerBlocked(collider, speed, dx, dz) {
    if (crashCd > 0) return;
    // crashing into the freezer wall breaks the nearest door's glass
    if (glass && collider === world.physicsMeta.freezerCollider && speed >= KNOCK_SPEED) {
      const door = nearestUnbrokenDoor(camera.position.z);
      if (door) { crashCd = 0.5; breakGlass(door, 1, 0); return; }
    }
    const g = gondolas.find((gg) => gg.collider === collider && !gg.tipped);
    if (g) {
      crashCd = 0.45;
      const sign = g.axis === 'z' ? (dx >= 0 ? 1 : -1) : (dz >= 0 ? 1 : -1);
      if (speed >= TIP_SPEED) { tipGondola(g, sign); return; }
      if (speed >= KNOCK_SPEED) {
        // knock a few items loose near the impact point
        const px = camera.position.x + dx * 0.9, pz = camera.position.z + dz * 0.9;
        const n = knockItems(
          { minX: px - 0.7, maxX: px + 0.7, minZ: pz - 0.7, maxZ: pz + 0.7, minY: 0.15, maxY: 1.8 },
          1 + Math.floor(speed), dx, dz, speed * 0.5,
        );
        addShake(0.3);
        SFX.thud();
        if (n && Math.random() < 0.4) toast('Whoops — that\'s going on your bill.');
        return;
      }
    }
    if (speed >= KNOCK_SPEED) { crashCd = 0.5; addShake(0.18); SFX.thud(); }
  }

  // ---- helpers --------------------------------------------------------------
  function circleVsColliders(x, z, r) {
    for (const c of world.colliders) {
      const cx2 = Math.max(c.minX, Math.min(x, c.maxX));
      const cz2 = Math.max(c.minZ, Math.min(z, c.maxZ));
      const ddx = x - cx2, ddz = z - cz2;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        const d = Math.sqrt(d2) || 0.001;
        return { nx: ddx / d, nz: ddz / d, depth: r - d, c };
      }
    }
    return null;
  }

  // ---- breakable freezer glass ----------------------------------------------
  const glass = world.physicsMeta.freezerGlass || null;
  const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);
  const shardGeo = new THREE.PlaneGeometry(0.07, 0.1);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xcfe6f2, transparent: true, opacity: 0.75, roughness: 0.08, metalness: 0.3, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false });
  const shardIM = new THREE.InstancedMesh(shardGeo, shardMat, 160);
  shardIM.count = 0; shardIM.frustumCulled = false; scene.add(shardIM);
  const shards = []; // {p:Vector3, v:Vector3, rx, rz, wr, life}
  const _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _se = new THREE.Euler(), _sv = new THREE.Vector3(1, 1, 1);
  function burstShards(x, y, z, dirX, dirZ, n = 16) {
    for (let i = 0; i < n; i++) {
      shards.push({
        p: new THREE.Vector3(x, y + (Math.random() - 0.5) * 1.2, z + (Math.random() - 0.5) * 0.6),
        v: new THREE.Vector3(dirX * (0.5 + Math.random() * 2.2) + (Math.random() - 0.5), 0.5 + Math.random() * 1.5, dirZ * (0.5 + Math.random() * 2.2) + (Math.random() - 0.5) * 1.4),
        rx: Math.random() * Math.PI, rz: Math.random() * Math.PI,
        wr: (Math.random() - 0.5) * 14, life: 2.2 + Math.random(),
      });
    }
  }
  function breakGlass(door, dirX = 1, dirZ = 0) {
    if (!glass || door.broken) return;
    door.broken = true;
    glass.im.setMatrixAt(door.index, ZERO_M);
    glass.im.instanceMatrix.needsUpdate = true;
    burstShards(door.x, door.y, door.z, dirX, dirZ);
    // the frozen goods tumble out through the broken door — free to grab
    const freed = world.stock.hideInRegion(door.spill, 9);
    for (const h of freed) {
      spawnDebrisNow(h.spec, h.x, h.y, h.z, h.rotY,
        0.9 + Math.random() * 1.2, 0.4 + Math.random() * 0.6, (Math.random() - 0.5) * 0.8);
    }
    damageTotal += 25; damageCount++;
    runEvents.glass++;
    addShake(0.4);
    SFX.glass();
    toast('🥶 You break it, you bought it — door glass +$25.00');
  }
  function nearestUnbrokenDoor(z) {
    if (!glass) return null;
    let best = null, bd = 1e9;
    for (const d of glass.doors) {
      if (d.broken) continue;
      const dd = Math.abs(d.z - z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return bd < 1.2 ? best : null;
  }

  // ---- crackable TV screens ---------------------------------------------------
  let _crackedTex = null;
  function crackedTexture() {
    if (_crackedTex) return _crackedTex;
    const c = document.createElement('canvas'); c.width = 384; c.height = 216;
    const x = c.getContext('2d');
    x.fillStyle = '#0a0d11'; x.fillRect(0, 0, 384, 216);
    x.strokeStyle = 'rgba(220,235,245,0.85)'; x.lineWidth = 2;
    const cx = 150 + Math.random() * 80, cy = 90 + Math.random() * 40;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
      x.beginPath(); x.moveTo(cx, cy);
      let px = cx, py = cy;
      for (let s = 0; s < 4; s++) {
        px += Math.cos(a + (Math.random() - 0.5) * 0.6) * (18 + Math.random() * 30);
        py += Math.sin(a + (Math.random() - 0.5) * 0.6) * (14 + Math.random() * 22);
        x.lineTo(px, py);
      }
      x.stroke();
    }
    x.strokeStyle = 'rgba(150,170,185,0.4)';
    for (let r = 14; r < 60; r += 16) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.stroke(); }
    _crackedTex = new THREE.CanvasTexture(c);
    _crackedTex.colorSpace = THREE.SRGBColorSpace;
    return _crackedTex;
  }
  function crackTV(tv) {
    if (tv.broken) return;
    tv.broken = true;
    const t = crackedTexture();
    tv.mat.map = t; tv.mat.emissiveMap = t; tv.mat.emissiveIntensity = 0.12;
    tv.mat.needsUpdate = true;
    const fee = tv.price * 0.4;
    damageTotal += fee; damageCount++;
    runEvents.tvs++;
    addShake(0.3);
    SFX.glass();
    toast(`📺 That was a display model! +$${fee.toFixed(2)}`);
  }

  // ---- thrown projectiles -----------------------------------------------------
  const projectiles = [];
  function launch(mesh, spec, from, dir, speed) {
    mesh.position.copy(from);
    scene.add(mesh);
    projectiles.push({
      mesh, spec, t: 0,
      // modest up-boost: aimed throws fly true at close range, lobs still arc
      v: new THREE.Vector3(dir.x * speed, dir.y * speed + 0.8, dir.z * speed),
      w: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10),
    });
    SFX.whoosh();
  }
  const _dir = new THREE.Vector3();
  function throwSpec(spec, bill = true) {
    camera.getWorldDirection(_dir);
    const from = camera.position.clone().addScaledVector(_dir, 0.45);
    from.y -= 0.12;
    launch(buildProduct(spec), spec, from, _dir, 11.5);
    if (bill) { damageTotal += spec.price * 0.4; damageCount++; }
  }
  function throwDebrisMesh(mesh) {
    const spec = mesh.userData.spec;
    const i = debris.findIndex((d) => d.mesh === mesh);
    if (i >= 0) { debris.splice(i, 1); syncDebrisList(); }
    scene.remove(mesh);
    mesh.scale.setScalar(1); mesh.rotation.set(0, mesh.rotation.y, 0);
    camera.getWorldDirection(_dir);
    const from = camera.position.clone().addScaledVector(_dir, 0.45);
    from.y -= 0.12;
    launch(mesh, spec, from, _dir, 11.5); // already billed when it was knocked
  }
  function adoptAsDebris(p, damp) {
    debris.push({
      mesh: p.mesh, spec: p.spec,
      v: p.v.clone().multiplyScalar(damp),
      w: p.w.clone().multiplyScalar(0.4),
      resting: false, age: 0, fade: 0,
    });
    if (debris.length > DEBRIS_CAP) {
      let idx = debris.findIndex((d) => d.resting);
      if (idx < 0) idx = 0;
      scene.remove(debris[idx].mesh); debris.splice(idx, 1);
    }
    syncDebrisList();
  }

  // ---- per-frame ------------------------------------------------------------
  const _settleBox = new THREE.Box3();
  function update(dt, playerPos, playerVel) {
    if (crashCd > 0) crashCd -= dt;
    if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.style.opacity = '0'; }
    if (shake > 0) shake = Math.max(0, shake - dt * 1.6);

    // carts
    for (const cart of carts) {
      if (cart.tipped) {
        if (cart.tipT < 1) {
          cart.tipT = Math.min(1, cart.tipT + dt * 3);
          const e = cart.tipT * cart.tipT;
          cart.mesh.rotation.z = cart.tipSign * 1.42 * e;
          cart.mesh.position.y = 0.25 * e;
        }
        continue;
      }
      // player shove
      const pdx = cart.x - playerPos.x, pdz = cart.z - playerPos.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < PLAYER_R + CART_R && pd > 0.001) {
        const nx = pdx / pd, nz = pdz / pd;
        const rel = playerVel.x * nx + playerVel.z * nz;
        if (rel > 0) { cart.vx += nx * rel * 1.15; cart.vz += nz * rel * 1.15; }
        // separate
        const need = PLAYER_R + CART_R - pd;
        cart.x += nx * need; cart.z += nz * need;
        if (rel > 2.4) { addShake(0.15); SFX.thud(); }
      }
      // cart-cart
      for (const other of carts) {
        if (other === cart || other.tipped) continue;
        const ox = other.x - cart.x, oz = other.z - cart.z;
        const od = Math.hypot(ox, oz);
        if (od < CART_R * 2 && od > 0.001) {
          const nx = ox / od, nz = oz / od;
          const rel = (cart.vx - other.vx) * nx + (cart.vz - other.vz) * nz;
          if (rel > 0) {
            other.vx += nx * rel * 0.7; other.vz += nz * rel * 0.7;
            cart.vx -= nx * rel * 0.7; cart.vz -= nz * rel * 0.7;
            if (rel > 1.5) SFX.clatter();
          }
          const need = (CART_R * 2 - od) / 2;
          other.x += nx * need; other.z += nz * need;
          cart.x -= nx * need; cart.z -= nz * need;
        }
      }
      // integrate + friction
      const sp = Math.hypot(cart.vx, cart.vz);
      if (sp > 0.01) {
        cart.x += cart.vx * dt; cart.z += cart.vz * dt;
        const f = Math.min(1, 2.2 * dt);
        cart.vx -= cart.vx * f; cart.vz -= cart.vz * f;
        // world collision: bounce, hard crashes tip the cart over
        const hit = circleVsColliders(cart.x, cart.z, CART_R);
        if (hit) {
          cart.x += hit.nx * hit.depth; cart.z += hit.nz * hit.depth;
          const vn = cart.vx * hit.nx + cart.vz * hit.nz;
          if (vn < 0) {
            cart.vx -= (1 + 0.4) * vn * hit.nx;
            cart.vz -= (1 + 0.4) * vn * hit.nz;
            // a fast cart into the freezer wall breaks the nearest door
            if (glass && hit.c === world.physicsMeta.freezerCollider && -vn > 2.0) {
              const door = nearestUnbrokenDoor(cart.z);
              if (door) breakGlass(door, 1, 0);
            }
            if (-vn > 2.6) {
              cart.tipped = true; cart.tipSign = Math.random() < 0.5 ? 1 : -1;
              addShake(0.35); SFX.crash();
              toast(CRASH_LINES[Math.floor(Math.random() * CRASH_LINES.length)]);
            } else if (-vn > 1.0) SFX.thud();
          }
        }
        // a rolling cart bowls into shoppers
        if (sp > 0.8) {
          for (const n of (world.getNpcs ? world.getNpcs() : [])) {
            if (n.shoveCd > 0) continue;
            const ndx = n.x - cart.x, ndz = n.z - cart.z;
            const nd = Math.hypot(ndx, ndz);
            if (nd < CART_R + 0.32 && nd > 0.001) {
              n.shove = { vx: cart.vx * 0.8, vz: cart.vz * 0.8, t: 0.6 };
              n.shoveCd = 1.3;
              if (!n.staff) n.pause = Math.max(n.pause === Infinity ? 0 : n.pause, 1.0);
              cart.vx *= 0.55; cart.vz *= 0.55;
              SFX.thud();
              if (world.npcTalk) world.npcTalk.say(n, pickLine('hit'));
            }
          }
        }
        // bounds
        const b = world.bounds;
        if (cart.x < b.minX + CART_R) { cart.x = b.minX + CART_R; cart.vx = Math.abs(cart.vx) * 0.4; }
        if (cart.x > b.maxX - CART_R) { cart.x = b.maxX - CART_R; cart.vx = -Math.abs(cart.vx) * 0.4; }
        if (cart.z < b.minZ + CART_R) { cart.z = b.minZ + CART_R; cart.vz = Math.abs(cart.vz) * 0.4; }
        if (cart.z > b.maxZ - CART_R) { cart.z = b.maxZ - CART_R; cart.vz = -Math.abs(cart.vz) * 0.4; }
        // roll steer: face the motion a little
        cart.yaw += ((Math.atan2(cart.vx, cart.vz) - Math.PI / 2 - cart.yaw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 2) * Math.min(1, sp);
      }
      cart.mesh.position.set(cart.x, cart.mesh.position.y, cart.z);
      cart.mesh.rotation.y = cart.yaw;
    }

    // gondola tip animation
    for (const g of gondolas) {
      if (!g.tipped || g.tipT >= 1) continue;
      g.tipT = Math.min(1, g.tipT + dt / 0.85);
      const t = g.tipT;
      // accelerating fall with a little settle bounce at the end
      const fall = t < 0.82 ? (t / 0.82) * (t / 0.82) : 1 + Math.sin((t - 0.82) / 0.18 * Math.PI) * 0.045 * (1 - t);
      const ang = -g.tipSign * (Math.PI / 2 - 0.06) * fall;
      if (g.axis === 'z') g.pivot.rotation.z = ang;
      else g.pivot.rotation.x = -ang;
      if (g.tipT >= 1) SFX.thud();
    }

    // drain queued spawns a few per frame (big spills would hitch otherwise)
    for (let i = 0; i < SPAWNS_PER_FRAME && spawnQueue.length; i++) spawnDebrisNow(...spawnQueue.shift());

    // thrown projectiles: fly, spin, and connect with whatever's in the way
    for (let pi = projectiles.length - 1; pi >= 0; pi--) {
      const p = projectiles[pi];
      p.t += dt;
      p.v.y -= 8.5 * dt;
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.w.x * dt; p.mesh.rotation.y += p.w.y * dt; p.mesh.rotation.z += p.w.z * dt;
      const pos = p.mesh.position;
      let done = false;
      // vs NPCs
      for (const n of (world.getNpcs ? world.getNpcs() : [])) {
        const nd = Math.hypot(n.x - pos.x, n.z - pos.z);
        if (nd < 0.42 && pos.y > 0.2 && pos.y < 1.9) {
          n.shove = { vx: p.v.x * 0.3, vz: p.v.z * 0.3, t: 0.6 };
          n.shoveCd = 0.8;
          if (!n.staff) n.pause = Math.max(n.pause === Infinity ? 0 : n.pause, 1.2);
          if (world.npcTalk) world.npcTalk.say(n, pickLine('hit'));
          SFX.thud(); addShake(0.12);
          runEvents.hits++;
          toast('🎯 Direct hit!');
          adoptAsDebris(p, 0.2); done = true; break;
        }
      }
      // vs freezer glass
      if (!done && glass) {
        for (const door of glass.doors) {
          if (door.broken) continue;
          if (pos.x < door.x + 0.14 && pos.x > door.x - 0.3 && Math.abs(pos.z - door.z) < door.w / 2 && pos.y > 0.5 && pos.y < 2.0) {
            breakGlass(door, p.v.x > 0 ? -1 : 1, 0);
            adoptAsDebris(p, 0.15); done = true; break;
          }
        }
      }
      // vs TV screens
      if (!done && world.physicsMeta.tvs) {
        for (const tv of world.physicsMeta.tvs) {
          if (tv.broken) continue;
          if (Math.abs(pos.x - tv.x) < 0.62 && Math.abs(pos.y - tv.y) < 0.45 && pos.z < tv.z + 0.25 && pos.z > tv.z - 0.45) {
            crackTV(tv);
            adoptAsDebris(p, 0.1); done = true; break;
          }
        }
      }
      // vs fixtures / bounds / floor / timeout — colliders are 2D footprints,
      // so only stop throws flying at fixture height (clears low platforms)
      if (!done) {
        const hit = pos.y < 1.75 ? circleVsColliders(pos.x, pos.z, 0.12) : null;
        const b = world.bounds;
        const oob = pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ;
        if (hit || oob) {
          if (hit) { pos.x += hit.nx * hit.depth; pos.z += hit.nz * hit.depth; }
          else { pos.x = Math.max(b.minX, Math.min(b.maxX, pos.x)); pos.z = Math.max(b.minZ, Math.min(b.maxZ, pos.z)); }
          SFX.thud();
          adoptAsDebris(p, 0.25); done = true;
        } else if (pos.y <= 0.04 || p.t > 4) {
          adoptAsDebris(p, 0.4); done = true;
        }
      }
      if (done) projectiles.splice(pi, 1);
    }

    // glass shards: fall, tumble, expire
    if (shards.length) {
      let si = 0;
      for (let i = shards.length - 1; i >= 0; i--) {
        const s = shards[i];
        s.life -= dt;
        if (s.life <= 0 || s.p.y < 0.01) { shards.splice(i, 1); continue; }
        s.v.y -= 9.8 * dt;
        s.p.addScaledVector(s.v, dt);
        s.rx += s.wr * dt; s.rz += s.wr * 0.7 * dt;
      }
      for (const s of shards) {
        _se.set(s.rx, 0, s.rz);
        _sq.setFromEuler(_se);
        _sm.compose(s.p, _sq, _sv);
        shardIM.setMatrixAt(si++, _sm);
      }
      shardIM.count = si;
      shardIM.instanceMatrix.needsUpdate = true;
    } else if (shardIM.count) shardIM.count = 0;

    // debris ballistics + resting-clutter cleanup fade
    let removedAny = false;
    for (let di = debris.length - 1; di >= 0; di--) {
      const d = debris[di];
      if (d.resting) {
        d.age += dt;
        if (d.age > DEBRIS_TTL) {
          d.fade += dt;
          const s = Math.max(0.001, 1 - d.fade / 0.8);
          d.mesh.scale.setScalar(s);
          if (d.fade >= 0.8) { scene.remove(d.mesh); debris.splice(di, 1); removedAny = true; }
        }
        continue;
      }
      d.age += dt;
      d.v.y -= 9.8 * dt;
      d.mesh.position.x += d.v.x * dt;
      d.mesh.position.y += d.v.y * dt;
      d.mesh.position.z += d.v.z * dt;
      d.mesh.rotation.x += d.w.x * dt;
      d.mesh.rotation.y += d.w.y * dt;
      d.mesh.rotation.z += d.w.z * dt;
      if (d.mesh.position.y <= 0) {
        d.mesh.position.y = 0;
        if (Math.abs(d.v.y) > 1.2) SFX.tick();
        d.v.y = -d.v.y * 0.28;
        d.v.x *= 0.55; d.v.z *= 0.55;
        d.w.multiplyScalar(0.5);
        if (Math.abs(d.v.y) < 0.55) {
          d.resting = true; d.age = 0;
          d.v.set(0, 0, 0);
          // settle flat-ish: keep yaw, zero the tumble so it lies naturally
          d.mesh.rotation.x = Math.round(d.mesh.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
          d.mesh.rotation.z = Math.round(d.mesh.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
          // seat the VISUAL body on the floor — a rotated product's origin is
          // offset from its bbox, which otherwise leaves it half-buried
          d.mesh.position.y = 0.01;
          d.mesh.updateMatrixWorld(true);
          _settleBox.setFromObject(d.mesh);
          if (isFinite(_settleBox.min.y)) d.mesh.position.y += 0.005 - _settleBox.min.y;
        }
      }
    }
    if (removedAny) syncDebrisList();

    // NPC bumping
    for (const n of (world.getNpcs ? world.getNpcs() : [])) {
      if (n.shoveCd > 0) { n.shoveCd -= dt; continue; }
      const dx2 = n.x - playerPos.x, dz2 = n.z - playerPos.z;
      const d2 = Math.hypot(dx2, dz2);
      if (d2 < 0.66 && d2 > 0.001) {
        const nx = dx2 / d2, nz = dz2 / d2;
        const rel = playerVel.x * nx + playerVel.z * nz;
        if (rel > 0.6) {
          n.shove = { vx: nx * Math.min(rel, 4) * 1.1, vz: nz * Math.min(rel, 4) * 1.1, t: 0.55 };
          n.shoveCd = 1.3;
          if (!n.browsing || n.speed > 0) n.pause = Math.max(n.pause === Infinity ? 0 : n.pause, 1.0);
          addShake(0.22); SFX.thud();
          toast(BUMP_LINES[Math.floor(Math.random() * BUMP_LINES.length)]);
        }
      }
    }
  }

  return {
    update, onPlayerBlocked, toast, throwSpec, throwDebrisMesh, breakGlass, crackTV,
    get shake() { return shake; },
    get damage() { return { total: damageTotal, count: damageCount }; },
    get runEvents() { return runEvents; },
    resetRun() { damageTotal = 0; damageCount = 0; runEvents.tips = 0; runEvents.glass = 0; runEvents.tvs = 0; runEvents.hits = 0; },
    get projectileCount() { return projectiles.length; },
    debrisMeshes: debrisMeshList, // stable reference, mutated in place
    removeDebris(mesh) {
      const i = debris.findIndex((d) => d.mesh === mesh);
      if (i >= 0) { scene.remove(mesh); debris.splice(i, 1); syncDebrisList(); return true; }
      return false;
    },
  };
}
