import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Image-based lighting: a real HDRI drives scene.environment so every PBR
// material gets physically-plausible reflections + ambient bounce. We do NOT
// use it as a visible skybox (we're indoors); walls/ceiling enclose the view.
export function loadEnvironment(renderer, scene, manager) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  return new Promise((resolve, reject) => {
    new RGBELoader(manager).load(
      'assets/env/warehouse_1k.hdr',
      (hdr) => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        const rt = pmrem.fromEquirectangular(hdr);
        scene.environment = rt.texture;
        scene.environmentIntensity = 0.55; // let our own lights lead, HDRI fills
        hdr.dispose();
        pmrem.dispose();
        resolve(rt.texture);
      },
      undefined,
      reject,
    );
  });
}
