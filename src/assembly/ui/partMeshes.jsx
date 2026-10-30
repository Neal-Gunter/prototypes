// v20：零件网格（材质、程序生成零件、GLB）——单独成文件，零件库预览不用加载物理引擎
import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
// v23：凸包碰撞体（c.hull = 相对 c.c 的顶点，cm）→ 凸多面体几何；缓存在条目对象上
const _hg = new WeakMap();
export function hullGeom(c) {
  if (_hg.has(c)) return _hg.get(c);
  const P = []; for (let i = 0; i < c.hull.length; i += 3) P.push(new THREE.Vector3(c.hull[i], c.hull[i + 1], c.hull[i + 2]));
  let g = null; try { g = new ConvexGeometry(P); } catch { g = null; }
  _hg.set(c, g); return g;
}
export const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: "#b8bcc2", metalness: 0.85, roughness: 0.32 }),
  brass: new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.8, roughness: 0.3 }),
  acrylic: new THREE.MeshStandardMaterial({ color: "#dfe9ee", roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.72 }),
  white: new THREE.MeshStandardMaterial({ color: "#f1efe9", roughness: 0.7 }),
  black: new THREE.MeshStandardMaterial({ color: "#26272a", roughness: 0.55 }),
  orange: new THREE.MeshStandardMaterial({ color: "#d9792b", roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: "#2f6fd6", roughness: 0.45 }),
  solder: new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 1, roughness: 0.15 }),
  cold: new THREE.MeshStandardMaterial({ color: "#8d8f8c", metalness: 0.3, roughness: 0.9 }),
  bridge: new THREE.MeshStandardMaterial({ color: "#e8ecef", metalness: 1, roughness: 0.1, emissive: "#552200", emissiveIntensity: 0.4 }),
  burnt: new THREE.MeshStandardMaterial({ color: "#4a2f1d", roughness: 0.9 }),
  alum: new THREE.MeshStandardMaterial({ color: "#c4c8cc", metalness: 0.7, roughness: 0.45 }),
  red: new THREE.MeshStandardMaterial({ color: "#c0392b", roughness: 0.6 }),
  yellow: new THREE.MeshStandardMaterial({ color: "#e2b524", roughness: 0.6 }),
  grey: new THREE.MeshStandardMaterial({ color: "#5b6168", roughness: 0.3 }),
  green: new THREE.MeshStandardMaterial({ color: "#2f8f4e", roughness: 0.5 }),
  brown: new THREE.MeshStandardMaterial({ color: "#8a5a32", roughness: 0.6 }),
  sel: new THREE.MeshBasicMaterial({ color: "#d9792b", wireframe: true }),
};
export const PROC_MAT = { screw: "steel", nut: "steel", standoff: "brass", plate: "acrylic", breadboard: "white", bracket: "black", horn: "white", tentacle: "orange", dupont: "black", plug: "black", tool: "blue" };

export function Boxes({ cols, mat }) {
  return cols.map((c, i) => {
    const g = c.hull ? hullGeom(c) : null;
    return g ? <mesh key={i} position={c.c} geometry={g} material={MAT[mat] || MAT.white} castShadow receiveShadow /> : (
      <mesh key={i} position={c.c} material={MAT[mat] || MAT.white} castShadow receiveShadow>
        <boxGeometry args={[c.h[0] * 2, c.h[1] * 2, c.h[2] * 2]} />
      </mesh>
    );
  });
}
// 紧固件画成圆柱 / 六角（碰撞仍用方块，见“简化”）
export function ProcMesh({ def }) {
  const p = def.proc || {};
  const mm = (v) => v / 10;
  if (p.type === "prims") {
    return (
      <group>
        {p.prims.map((q, i) => q.k === "cyl" ? (
          <mesh key={i} position={q.c} rotation={q.ax === "x" ? [0, 0, Math.PI / 2] : q.ax === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0]} material={MAT[q.m] || MAT.white} castShadow receiveShadow><cylinderGeometry args={[q.r, q.r2 ?? q.r, q.h, q.seg || 24]} /></mesh>
        ) : q.k === "tube" ? (
          // v20：空心圆柱（轴承、垫片、带轮孔）：矩形截面绕轴旋转
          <mesh key={i} position={q.c} rotation={q.ax === "x" ? [0, 0, Math.PI / 2] : q.ax === "z" ? [Math.PI / 2, 0, 0] : [0, 0, 0]} material={MAT[q.m] || MAT.white} castShadow receiveShadow>
            <latheGeometry args={[[[q.ri, -q.h / 2], [q.r, -q.h / 2], [q.r, q.h / 2], [q.ri, q.h / 2], [q.ri, -q.h / 2]].map(([x, y]) => new THREE.Vector2(x, y)), q.seg || 32]} />
          </mesh>
        ) : (
          <mesh key={i} position={q.c} material={MAT[q.m] || MAT.white} castShadow receiveShadow><boxGeometry args={[q.h[0] * 2, q.h[1] * 2, q.h[2] * 2]} /></mesh>
        ))}
      </group>
    );
  }
  if (p.type === "washer") {
    const R = mm(p.d2) / 2, r = mm(p.d1) / 2, h = mm(p.h);
    return <mesh material={MAT.steel} position={[0, h / 2, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[(R + r) / 2, Math.max(h / 2, (R - r) / 2 * 0.5), 6, 24]} /></mesh>;
  }
  if (p.type === "screw" && p.head === "cap") {
    const L = mm(p.len), k = mm(p.k), r = mm(p.dk) / 2, d = mm(parseFloat(p.size.slice(1))), sh = mm(p.s) / 2 / Math.cos(Math.PI / 6);
    return (
      <group>
        <mesh material={MAT.black} position={[0, L / 2, 0]} castShadow><cylinderGeometry args={[d / 2, d / 2, L, 12]} /></mesh>
        <mesh material={MAT.black} position={[0, L + k / 2, 0]} castShadow><cylinderGeometry args={[r, r, k, 24]} /></mesh>
        <mesh material={MAT.grey} position={[0, L + k + 0.001, 0]}><cylinderGeometry args={[sh, sh, 0.002, 6]} /></mesh>
      </group>
    );
  }
  if (p.type === "screw") {
    const L = mm(p.len), k = mm(p.k), r = mm(p.dk) / 2, d = mm(p.size === "ST1.5" ? 1.5 : parseFloat(p.size.slice(1)));
    return (
      <group>
        <mesh material={MAT.steel} position={[0, L / 2, 0]} castShadow><cylinderGeometry args={[d / 2, d / 2, L, 12]} /></mesh>
        <mesh material={MAT.steel} position={[0, L + k / 2, 0]} castShadow><cylinderGeometry args={[r * 0.92, r, k, 20]} /></mesh>
      </group>
    );
  }
  if (p.type === "nut") {
    const R = mm(p.s) / 2 / Math.cos(Math.PI / 6), m = mm(p.m);
    return <mesh material={MAT.steel} position={[0, m / 2, 0]} castShadow><cylinderGeometry args={[R, R, m, 6]} /></mesh>;
  }
  if (p.type === "standoff") {
    const R = mm(p.s) / 2 / Math.cos(Math.PI / 6), L = mm(p.len), S = mm(p.stud), d = mm(p.d);
    return (
      <group>
        <mesh material={MAT.brass} position={[0, S + L / 2, 0]} castShadow><cylinderGeometry args={[R, R, L, 6]} /></mesh>
        <mesh material={MAT.brass} position={[0, S / 2, 0]} castShadow><cylinderGeometry args={[d / 2, d / 2, S, 10]} /></mesh>
      </group>
    );
  }
  return <Boxes cols={def.colliders} mat={PROC_MAT[p.type] || "white"} />;
}
export function Glb({ def }) {
  const { scene } = useGLTF(def.glb);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return o;
  }, [scene]);
  const H = def.dims_mm.y / 10;
  return def.flip ? <group position={[0, H, 0]} rotation={[Math.PI, 0, 0]}><primitive object={obj} /></group> : <primitive object={obj} />;
}
