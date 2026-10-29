import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sim } from "../sim";
import { smokeTexture } from "./textures";

// 松香烟 / 烧焦绝缘皮的黑烟：简单的粒子池（向上飘、扩散、变淡）
const N = 220;
export default function Smoke() {
  const pts = useRef();
  const data = useMemo(() => {
    const pos = new Float32Array(N * 3);
    const alpha = new Float32Array(N);
    const size = new Float32Array(N);
    const shade = new Float32Array(N);
    const life = new Float32Array(N).fill(-1);
    const vel = new Float32Array(N * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
    g.setAttribute("size", new THREE.BufferAttribute(size, 1));
    g.setAttribute("shade", new THREE.BufferAttribute(shade, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { map: { value: smokeTexture() }, scale: { value: 520 } },
      vertexShader: `attribute float alpha; attribute float size; attribute float shade; varying float vA; varying float vS;
        uniform float scale;
        void main(){ vA=alpha; vS=shade; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*scale/-mv.z; gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying float vA; varying float vS;
        void main(){ vec4 t=texture2D(map, gl_PointCoord); gl_FragColor=vec4(vec3(vS), t.a*vA); }`,
    });
    return { g, mat, pos, alpha, size, shade, life, vel, next: 0, acc: 0 };
  }, []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05);
    const d = data;
    for (const s of sim.smoke) {
      d.acc += dt * (s.rate === 2 ? 55 : 32);
      while (d.acc >= 1) {
        d.acc -= 1;
        const i = d.next;
        d.next = (d.next + 1) % N;
        d.pos[i * 3] = s.p[0] + (Math.random() - 0.5) * 0.08;
        d.pos[i * 3 + 1] = s.p[1] + 0.1;
        d.pos[i * 3 + 2] = s.p[2] + (Math.random() - 0.5) * 0.08;
        d.vel[i * 3] = (Math.random() - 0.5) * 0.25;
        d.vel[i * 3 + 1] = 0.9 + Math.random() * 0.7;
        d.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
        d.life[i] = 0;
        d.shade[i] = s.rate === 2 ? 0.15 + Math.random() * 0.1 : 0.86 + Math.random() * 0.1;
      }
    }
    for (let i = 0; i < N; i++) {
      if (d.life[i] < 0) {
        d.alpha[i] = 0;
        continue;
      }
      d.life[i] += dt;
      const L = d.life[i] / 2.4;
      if (L >= 1) {
        d.life[i] = -1;
        d.alpha[i] = 0;
        continue;
      }
      // 轻微的湍流
      d.vel[i * 3] += Math.sin(d.life[i] * 6 + i) * 0.4 * dt;
      d.vel[i * 3 + 2] += Math.cos(d.life[i] * 5 + i * 1.7) * 0.4 * dt;
      d.vel[i * 3 + 1] *= 1 - 0.4 * dt;
      for (let k = 0; k < 3; k++) d.pos[i * 3 + k] += d.vel[i * 3 + k] * dt;
      d.size[i] = 0.12 + L * 0.9;
      d.alpha[i] = (L < 0.12 ? L / 0.12 : 1 - L) * (d.shade[i] < 0.5 ? 0.5 : 0.32);
    }
    d.g.attributes.position.needsUpdate = true;
    d.g.attributes.alpha.needsUpdate = true;
    d.g.attributes.size.needsUpdate = true;
    d.g.attributes.shade.needsUpdate = true;
  });
  return <points ref={pts} geometry={data.g} material={data.mat} frustumCulled={false} raycast={() => null} renderOrder={10} />;
}
