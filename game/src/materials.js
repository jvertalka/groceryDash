import * as THREE from 'three';

// Load a Poly Haven-style PBR set (diff / arm / nor) from a folder under
// assets/tex/. ARM packs Ambient-occlusion (R), Roughness (G), Metalness (B) —
// which is exactly how three reads roughnessMap(.g)/metalnessMap(.b). We skip
// aoMap here because screen-space GTAO handles occlusion in the composer.
export function loadPBR(loader, folder, repeat = [1, 1], extra = {}) {
  const { physical, ...matProps } = extra;
  const base = `assets/tex/${folder}`;
  const diff = loader.load(`${base}/diff.jpg`);
  const arm = loader.load(`${base}/arm.jpg`);
  const nor = loader.load(`${base}/nor.jpg`);
  diff.colorSpace = THREE.SRGBColorSpace;
  for (const t of [diff, arm, nor]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 8;
  }
  const Ctor = physical ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
  return new Ctor({
    map: diff,
    normalMap: nor,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness: 1,
    metalness: 1,
    envMapIntensity: 1,
    ...matProps,
  });
}

// Shared, cheap materials for structural metal (shelving, cart, trim). Metal
// reads as metal purely from the HDRI reflection — no texture needed.
export const METAL = (color = 0xb9c0c7, roughness = 0.38) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.95, roughness, envMapIntensity: 1.1 });

export const PAINTED = (color, roughness = 0.6) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness });

export const PLASTIC = (color, roughness = 0.25) =>
  new THREE.MeshStandardMaterial({ color, metalness: 0.0, roughness, envMapIntensity: 1.2 });
