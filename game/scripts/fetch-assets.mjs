// Downloads the CC0 asset set into public/assets/ so the game ships with real
// textures/HDRI/models bundled (no runtime CDN dependency). Re-run any time:
//   npm run fetch-assets
// Sources: Poly Haven (CC0) + three.js example models (MIT). See CREDITS.md.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'assets');
const PH = 'https://dl.polyhaven.org/file/ph-assets';
const tex = (n, m) => `${PH}/Textures/jpg/1k/${n}/${n}_${m}_1k.jpg`;
const GH = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf';

const FILES = [
  [`${PH}/HDRIs/hdr/1k/empty_warehouse_01_1k.hdr`, 'env/warehouse_1k.hdr'],

  [tex('floor_tiles_06', 'diff'),   'tex/floor/diff.jpg'],
  [tex('floor_tiles_06', 'arm'),    'tex/floor/arm.jpg'],
  [tex('floor_tiles_06', 'nor_gl'), 'tex/floor/nor.jpg'],

  [tex('beige_wall_001', 'diff'),   'tex/wall/diff.jpg'],
  [tex('beige_wall_001', 'arm'),    'tex/wall/arm.jpg'],
  [tex('beige_wall_001', 'nor_gl'), 'tex/wall/nor.jpg'],

  [tex('wood_planks', 'diff'),   'tex/wood/diff.jpg'],
  [tex('wood_planks', 'arm'),    'tex/wood/arm.jpg'],
  [tex('wood_planks', 'nor_gl'), 'tex/wood/nor.jpg'],

  [tex('asphalt_02', 'diff'),   'tex/asphalt/diff.jpg'],
  [tex('asphalt_02', 'arm'),    'tex/asphalt/arm.jpg'],
  [tex('asphalt_02', 'nor_gl'), 'tex/asphalt/nor.jpg'],

  // casual civilian (jeans + shirt), rigged, baked walk loop — Khronos sample (CC-BY 4.0 / Cesium)
  ['https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb', 'models/shopper.glb'],
  // animation DONOR (mixamorig Idle/Walk clips, retargeted onto the Rocketbox
  // civilians at runtime — the soldier itself is never shown)
  ['https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/Soldier.glb', 'models/anims.glb'],
  // NOTE: models/people/* (Microsoft Rocketbox civilians, MIT) are fetched +
  // TGA->JPG converted by a one-time pipeline — see CREDITS.md. The converted
  // set is committed to the repo, so no re-download is needed.
];

let ok = 0, fail = 0;
for (const [url, rel] of FILES) {
  const dest = join(ROOT, rel);
  try {
    const res = await fetch(url);
    if (!res.ok) { console.error(`  x  ${res.status}  ${rel}`); fail++; continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buf);
    console.log(`  ok ${String(Math.round(buf.length / 1024)).padStart(5)} KB  ${rel}`);
    ok++;
  } catch (e) { console.error(`  x  ERR  ${rel}  ${e.message}`); fail++; }
}
console.log(`\n${ok} ok, ${fail} failed  ->  ${ROOT}`);
if (fail) process.exit(1);
