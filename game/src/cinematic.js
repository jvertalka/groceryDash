import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// The "AAA look" is mostly grade, not geometry: filmic contrast with crushed
// blacks, teal shadows / warm highlights, saturation lift, vignette, animated
// film grain and a whisper of chromatic aberration at the edges. One cheap
// fullscreen pass, cheap enough for the lite tier — this single pass moves the
// image from "3D demo" to "game still".
export function makeCinematicPass() {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uStrength: { value: 1.0 },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uStrength;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec2 centered = vUv - 0.5;
        float r2 = dot(centered, centered);

        // chromatic aberration: R/B pull apart toward the frame edges
        vec2 caOff = centered * r2 * 0.0035 * uStrength;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv + caOff).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv - caOff).b;

        // filmic S-curve: crush blacks, pop mids
        vec3 curved = col * col * (3.0 - 2.0 * col);
        col = mix(col, curved, 0.38 * uStrength);

        // split-tone: teal into shadows, warmth into highlights
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float shadow = 1.0 - smoothstep(0.0, 0.45, luma);
        float high = smoothstep(0.55, 1.0, luma);
        col = mix(col, col * vec3(0.86, 1.02, 1.12), shadow * 0.16 * uStrength);
        col = mix(col, col * vec3(1.08, 1.02, 0.90), high * 0.12 * uStrength);

        // saturation lift
        col = mix(vec3(luma), col, 1.0 + 0.14 * uStrength);

        // vignette
        float vig = 1.0 - smoothstep(0.32, 1.05, r2 * 2.2) * 0.34 * uStrength;
        col *= vig;

        // animated film grain, stronger in the darks
        float g = (hash(vUv * (601.0 + fract(uTime) * 7.0)) - 0.5) * 0.045 * (1.0 - luma) * uStrength;
        col += g;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return pass;
}
