// Fetch + optimize the CC0 model kit (same pipeline as the Rocketbox people):
//   - Kenney Car Kit GLBs (CC0) via GitHub mirror — used as-is (already tiny)
//   - Poly Haven photoscan models (CC0) — multi-file glTF; we download the
//     .gltf, resolve its buffer/image URIs against the CDN, rewrite to local
//     paths, then gltf-transform: pack to .glb, simplify heavy scans, resize
//     textures. Output: public/assets/models/kit/<name>.glb + manifest.json
// Run: node scripts/fetch-models.mjs
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'public', 'assets', 'models', 'kit');
const TMP = join(root, 'scripts', '.model-tmp');
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const KENNEY = 'https://raw.githubusercontent.com/Arslan12216775/kenney_car-kit/master/Models/GLB%20format';
const PH = 'https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k';

// name -> source. kenney: direct glb. ph: multi-file gltf + simplify ratio.
const MODELS = {
  car_sedan: { glb: `${KENNEY}/sedan.glb` },
  car_suv: { glb: `${KENNEY}/suv.glb` },
  car_suvlux: { glb: `${KENNEY}/suv-luxury.glb` },
  car_van: { glb: `${KENNEY}/van.glb` },
  car_hatch: { glb: `${KENNEY}/hatchback-sports.glb` },
  car_sedansport: { glb: `${KENNEY}/sedan-sports.glb` },
  car_delivery: { glb: `${KENNEY}/delivery.glb` },
  car_taxi: { glb: `${KENNEY}/taxi.glb` },

  prod_apple: { ph: 'food_apple_01', ratio: 0.22 },
  prod_lemon: { ph: 'lemon', ratio: 0.3 },
  prod_avocado: { ph: 'food_avocado_01', ratio: 0.22 },
  prod_banana: { ph: 'bananas', ratio: 0.1 },
  prod_onion: { ph: 'yellow_onion', ratio: 0.28 },
  prod_sweetpotato: { ph: 'sweet_potato', ratio: 0.6 },
  prod_tins: { ph: 'russian_food_cans_01', ratio: 1 },
  prod_croissant: { ph: 'croissant', ratio: 1 },

  prop_register: { ph: 'CashRegister_01', ratio: 0.5 },
  prop_plant: { ph: 'potted_plant_04', ratio: 0.7 },
  prop_box: { ph: 'cardboard_box_01', ratio: 0.25 },
  prop_crate: { ph: 'plastic_crate_01', ratio: 0.2 },
  prop_wineshelf: { ph: 'wooden_display_shelves_01', ratio: 1 },
  prop_wine: { ph: 'wine_bottles_01', ratio: 0.5 },
};

async function fetchBin(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function fetchPH(slug, dir) {
  // Poly Haven's files API maps every component of the glTF (bin, textures)
  // from its RELATIVE path to its real CDN URL — exactly what we need.
  const api = JSON.parse((await fetchBin(`https://api.polyhaven.com/files/${slug}`)).toString('utf8'));
  const res = api.gltf && (api.gltf['1k'] || api.gltf[Object.keys(api.gltf)[0]]);
  const entry = res && res.gltf; // { url, include: { relPath: { url } } }
  if (!entry || !entry.url) throw new Error('no gltf entry in files API');
  mkdirSync(dir, { recursive: true });
  const gltfPath = join(dir, `${slug}.gltf`);
  writeFileSync(gltfPath, await fetchBin(entry.url));
  for (const [rel, meta] of Object.entries(entry.include || {})) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, await fetchBin(meta.url));
  }
  return gltfPath;
}

function run(cmd) { execSync(cmd, { stdio: 'pipe', cwd: root }); }

let ok = 0, fail = 0;
const manifest = existsSync(join(OUT, 'manifest.json'))
  ? JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8')) : {};

for (const [name, def] of Object.entries(MODELS)) {
  const outFile = join(OUT, `${name}.glb`);
  try {
    if (existsSync(outFile)) { console.log(`  skip  ${name} (exists)`); manifest[name] = { file: `${name}.glb` }; ok++; continue; }
    if (def.glb) {
      writeFileSync(outFile, await fetchBin(def.glb));
    } else {
      const dir = join(TMP, name);
      const gltfPath = await fetchPH(def.ph, dir);
      const packed = join(dir, 'packed.glb');
      run(`npx --yes @gltf-transform/cli copy "${gltfPath}" "${packed}"`);
      if (def.ratio < 1) {
        const simp = join(dir, 'simp.glb');
        run(`npx --yes @gltf-transform/cli simplify "${packed}" "${simp}" --ratio ${def.ratio} --error 0.01`);
        run(`npx --yes @gltf-transform/cli resize "${simp}" "${outFile}" --width 1024 --height 1024`);
      } else {
        run(`npx --yes @gltf-transform/cli resize "${packed}" "${outFile}" --width 1024 --height 1024`);
      }
      rmSync(dir, { recursive: true, force: true });
    }
    manifest[name] = { file: `${name}.glb` };
    const kb = Math.round(readFileSync(outFile).length / 1024);
    console.log(`  ok    ${name}  ${kb} KB`);
    ok++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${String(e.message).slice(0, 120)}`);
    fail++;
  }
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`\n${ok} ok, ${fail} failed -> ${OUT}`);
