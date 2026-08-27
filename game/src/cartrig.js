import * as THREE from 'three';
import { shoppingCart } from './store.js';
import { buildProduct } from './products.js';

// The player's visible cart: rides ahead of the camera with spring-lag so it
// sways into turns and lags on acceleration; grabbed items visibly pile into
// the basket. Purely visual — collision stays the player circle.
export function createCartRig(scene, camera) {
  const rig = shoppingCart();
  rig.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  scene.add(rig);

  const items = new THREE.Group();
  items.position.set(0.02, 0.62, 0); // basket interior (cart local)
  rig.add(items);
  let itemCount = 0;

  let yaw = 0, px = 0, pz = 0, bobT = 0, lurch = 0;
  const fwd = new THREE.Vector3();

  function basketWorldPos(out) {
    items.getWorldPosition(out);
    out.y += 0.1;
    return out;
  }

  function addItem(spec) {
    itemCount++;
    if (itemCount > 12) return; // basket looks full; stop stacking visuals
    const m = buildProduct(spec);
    const layer = Math.floor((itemCount - 1) / 4);
    const slot = (itemCount - 1) % 4;
    m.scale.setScalar(0.5);
    m.position.set(-0.16 + (slot % 2) * 0.3, layer * 0.11, -0.12 + Math.floor(slot / 2) * 0.26);
    m.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
    items.add(m);
  }

  function clearItems() {
    itemCount = 0;
    while (items.children.length) items.remove(items.children[0]);
  }

  function update(dt, playing, playerVel, shake) {
    rig.visible = playing;
    if (!playing) return;
    camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
    const targetYaw = Math.atan2(fwd.x, fwd.z);
    // shortest-arc yaw spring
    let dy = targetYaw - yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    yaw += dy * Math.min(1, 7.5 * dt);
    const tx = camera.position.x + Math.sin(yaw) * 0.92;
    const tz = camera.position.z + Math.cos(yaw) * 0.92;
    const k = Math.min(1, 10 * dt);
    px += (tx - px) * k; pz += (tz - pz) * k;
    const speed = Math.hypot(playerVel.x, playerVel.z);
    bobT += dt * (speed > 4 ? 13.5 : 10.5) * Math.min(1, speed);
    lurch = Math.max(0, lurch - dt * 3);
    if (shake > 0.25) lurch = Math.min(0.5, shake);
    rig.position.set(px, Math.max(0, Math.sin(bobT) * 0.012 * Math.min(1, speed)), pz);
    rig.rotation.set(0, yaw - Math.PI / 2, 0);
    rig.rotation.z = dy * 0.55 + (lurch > 0 ? Math.sin(lurch * 24) * lurch * 0.18 : 0); // lean into turns, rattle on impact
  }

  return { update, addItem, clearItems, basketWorldPos, rig };
}
