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

  [`${GH}/Soldier.glb`, 'models/shopper.glb'],
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
