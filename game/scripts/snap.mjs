#!/usr/bin/env node
// snap.mjs — LOOK at the game.
//
// Launches the installed Chrome headless on the machine's real GPU, drives the
// running dev server over the DevTools protocol and writes true rendered frames
// plus a stats report. No dependencies: Node 22+ ships fetch and WebSocket.
//
//   npm run dev            (in one terminal)
//   npm run shots          (in another)   -> game/.shots/<timestamp>/*.jpg + report.json
//
//   node scripts/snap.mjs --out .shots/before --only aisle,checkout --perf
//
// Why this exists: for most of this project every "visual" check was numeric
// (pixel grids, draw counts). Numbers said the store was fine while it rendered
// blown out to white with every shopper's arms in the air. Nothing about how the
// game looks is verified until a frame from this script has been looked at.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf('--' + name); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : dflt; };
const flag = (name) => args.includes('--' + name);

const URL_ = opt('url', 'http://localhost:5173/');
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const OUT = resolve(opt('out', join('.shots', stamp)));
const [W, H] = opt('size', '1920x1080').split('x').map(Number);
const ONLY = opt('only', '').split(',').map((s) => s.trim()).filter(Boolean);
const MODE = opt('mode', 'zen');
const TIER = opt('tier', ''); // '', 'lite' or 'high' — pin the quality tier for the whole run
const PERF = flag('perf');

// fixed camera stations: [name, eye, lookAt]
const VIEWS = [
  ['entrance', [0.6, 1.65, 13.2], [-5, 1.3, 0]],
  ['aisle', [-16, 1.65, 4.5], [-16, 1.2, -8]],
  ['shelf_closeup', [-16.85, 1.45, -2.0], [-17.7, 1.05, -2.7]],
  ['produce', [-17.6, 1.65, 7.3], [-17.6, 0.8, 10.4]],
  ['checkout', [-5.5, 1.65, 13.6], [-9.6, 1.0, 10.4]],
  ['freezer', [-19.3, 1.65, 1.6], [-22.3, 1.2, -1.6]],
  ['electronics', [10, 1.65, -9.3], [11, 1.8, -14.6]],
  ['apparel', [8.5, 1.65, 9.2], [8.5, 1.0, 3.5]],
  ['back_wall', [-4, 1.65, -6], [-12, 1.4, -13.5]],
  ['lot_from_door', [0, 1.65, 14.2], [0, 1.3, 30]],
  ['storefront_from_lot', [-3, 1.7, 27.5], [0, 2.0, 15]],
  ['car_closeup', [-4.6, 1.5, 19.6], [-7.5, 0.7, 22.9]],
];
// stations that follow a live NPC: [name, picker expression, distance, yaw offset from the NPC's facing]
const TRACKED = [
  ['npc_cashier', '__npcs.find((n) => n.staff)', 2.4, 0.5],
  ['npc_walker_front', '__npcs.find((n) => !n.staff && !n.browsing && !n.cart)', 3.0, 0.25],
  ['npc_walker_side', '__npcs.find((n) => !n.staff && !n.browsing && !n.cart)', 3.0, Math.PI / 2],
  ['npc_cart_pusher', '__npcs.find((n) => n.cart)', 3.6, 0.35],
];

const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean).find((p) => existsSync(p));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { url: URL_, size: [W, H], startedAt: new Date().toISOString(), views: [] };
let chrome = null, ws = null;
const profile = join(OUT, '.chrome-profile');

async function main() {
  if (!CHROME) throw new Error('Chrome not found — set CHROME_PATH to a Chrome or Edge executable');
  try { await fetch(URL_); } catch { throw new Error(`nothing is serving ${URL_} — start the game first with "npm run dev"`); }
  mkdirSync(OUT, { recursive: true });

  const port = 9400 + Math.floor(Math.random() * 500);
  chrome = spawn(CHROME, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${W},${H}`, '--enable-gpu', '--ignore-gpu-blocklist', '--force-device-scale-factor=1',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', 'about:blank',
  ], { stdio: 'ignore' });

  let targets = null;
  for (let i = 0; i < 80 && !targets; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(250); }
  }
  if (!targets) throw new Error('Chrome DevTools endpoint never came up');
  ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools socket error')); });
  let id = 0; const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (!m.id || !pending.has(m.id)) return;
    const { res, rej } = pending.get(m.id); pending.delete(m.id);
    m.error ? rej(new Error(m.error.message)) : res(m.result);
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const js = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page exception: ' + JSON.stringify(r.exceptionDetails).slice(0, 900));
    return r.result.value;
  };
  const until = async (expr, ms, what) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) { if (await js(`!!(${expr})`)) return Date.now() - t0; await sleep(400); }
    throw new Error('timed out waiting for ' + what);
  };
  const save = (name, dataUrl) => writeFileSync(join(OUT, name + '.jpg'), Buffer.from(dataUrl.split(',')[1], 'base64'));

  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const t0 = Date.now();
  await send('Page.navigate', { url: URL_ });
  await sleep(1500);
  await until('window.__ready || window.__err', 180000, 'the game to boot');
  const bootErr = await js('window.__err ? String(window.__err).slice(0, 600) : null');
  if (bootErr) throw new Error('the game failed to boot: ' + bootErr);
  await until('window.__npcs && window.__npcs.length >= 13', 180000, 'the NPC cast');
  report.loadMs = Date.now() - t0;

  report.gpu = await js(`(() => { const gl = __renderer.getContext(); const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })()`);
  report.lights = await js(`(() => { const n = {}; __scene.traverse((o) => { if (o.isLight) n[o.type] = (n[o.type] || 0) + 1; }); return n; })()`);
  report.retargetLog = await js('window.__retargetLog || null');

  // into a run with no timer, DOM overlays hidden, quality pinned so every frame is full resolution
  await js(`(() => {
    __game.startRun(${JSON.stringify(MODE)}); __setPlaying(true);
    for (const id of ['title', 'pause', 'results', 'boot', 'hint']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    if (window.__pinQuality) window.__pinQuality({ res: 1${TIER ? `, tier: ${JSON.stringify(TIER)}` : ''} });
    window.__snap = {
      view(p, l) { __camera.position.set(p[0], p[1], p[2]); __camera.lookAt(l[0], l[1], l[2]); __camera.updateMatrixWorld(true); },
      shot() { __composer.render(); return __renderer.domElement.toDataURL('image/jpeg', 0.92); },
      stats() {
        __renderer.info.autoReset = false; __renderer.info.reset(); __composer.render();
        const r = { draws: __renderer.info.render.calls, tris: __renderer.info.render.triangles };
        __renderer.info.autoReset = true; return r;
      },
      // true frame cost: synchronous renders closed by a 1px readback, so the GPU work is included (rAF deltas are vsync-quantised)
      cost(n) {
        const gl = __renderer.getContext(), px = new Uint8Array(4), runs = [];
        for (let i = 0; i < 3; i++) __composer.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        for (let k = 0; k < 3; k++) {
          const t = performance.now();
          for (let i = 0; i < n; i++) __composer.render();
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
          runs.push((performance.now() - t) / n);
        }
        return +Math.min(...runs).toFixed(2);
      },
    };
    return true;
  })()`);
  await sleep(2500);
  report.quality = await js('({ tier: window.__tier || null, pinned: !!window.__pinQuality })');

  const wanted = (name) => !ONLY.length || ONLY.includes(name);
  for (const [name, p, l] of VIEWS) {
    if (!wanted(name)) continue;
    await js(`__snap.view(${JSON.stringify(p)}, ${JSON.stringify(l)})`);
    await sleep(1500); // the game loop keeps running: culling, NPCs and the cart rig settle on the new position
    await js(`__snap.view(${JSON.stringify(p)}, ${JSON.stringify(l)})`);
    const v = { name, ...(await js('__snap.stats()')) };
    if (PERF) { v.ms = await js('__snap.cost(12)'); v.fps = Math.round(1000 / v.ms); }
    save(name, await js(`(() => { __snap.view(${JSON.stringify(p)}, ${JSON.stringify(l)}); return __snap.shot(); })()`));
    report.views.push(v);
    console.log(name.padEnd(22), String(v.draws).padStart(5), 'draws', String(v.tris).padStart(9), 'tris', PERF ? `${String(v.ms).padStart(7)} ms ${String(v.fps).padStart(4)} fps` : '');
  }
  for (const [name, pick, dist, off] of TRACKED) {
    if (!wanted(name)) continue;
    const aim = `(() => { const n = ${pick}; if (!n) return false; const a = n.yaw + ${off};
      __snap.view([n.x + Math.sin(a) * ${dist}, 1.55, n.z + Math.cos(a) * ${dist}], [n.x, 1.0, n.z]); return true; })()`;
    if (!(await js(aim))) { console.log(name.padEnd(22), 'no such NPC'); continue; }
    await sleep(900);
    save(name, await js(`(() => { ${aim}; return __snap.shot(); })()`));
    report.views.push({ name });
    console.log(name.padEnd(22), 'ok');
  }
}

let failed = null;
try { await main(); } catch (e) { failed = String((e && e.message) || e); report.error = failed; }
try { ws && ws.close(); } catch {}
try { chrome && chrome.kill(); } catch {}
await sleep(700);
try { rmSync(profile, { recursive: true, force: true }); } catch {}
if (existsSync(OUT)) writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(failed ? `FAILED: ${failed}` : `\n${report.views.length} frames -> ${OUT}\nGPU: ${report.gpu}`);
process.exit(failed ? 1 : 0);
