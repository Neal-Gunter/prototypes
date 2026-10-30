// v11 模型实验室 3D 视图：每个网格按所属模块上色；高亮 / 半透明 / 隐藏 / 隔离 / 爆炸；点选模块或网格
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// 一张 ISO/IEC 7810 ID‑1 卡（银行卡）：85.60 × 53.98 × 0.76 mm，用来对照真实大小
const CARD = [8.56, 0.076, 5.398];

function Fit({ size }) {
  const { camera, controls } = useThree();
  const key = `${size.x.toFixed(2)}|${size.y.toFixed(2)}|${size.z.toFixed(2)}`;
  useEffect(() => {
    const r = Math.max(size.x, size.y, size.z, 3);
    camera.position.set(r * 1.1, r * 0.9 + size.y, r * 1.3);
    camera.near = r / 200; camera.far = r * 60; camera.updateProjectionMatrix();
    if (controls) { controls.target.set(0, size.y / 2, 0); controls.update(); }
  }, [key, controls]);
  return null;
}
function Hook({ groupRef }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const ray = new THREE.Raycaster();
    // 测试 / 键盘辅助：返回“点下去第一个命中的就是这个模块”的屏幕坐标
    window.__labScene = {
      camera, scene,
      pickPoint(modId) {
        const ms = []; groupRef.current?.traverse((o) => o.isMesh && o.visible && o.userData.mod && ms.push(o));
        const mine = ms.filter((o) => o.userData.mod === modId);
        if (!mine.length) return null;
        const rect = gl.domElement.getBoundingClientRect();
        for (const o of mine) {
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
          for (let k = 0; k < 125; k++) {
            const t = [(k % 5) / 4, (((k / 5) | 0) % 5) / 4, ((k / 25) | 0) / 4].map((v) => 0.15 + v * 0.7);
            const p = new THREE.Vector3(b.min.x + (b.max.x - b.min.x) * t[0], b.min.y + (b.max.y - b.min.y) * t[1], b.min.z + (b.max.z - b.min.z) * t[2]);
            const ndc = p.clone().project(camera);
            if (Math.abs(ndc.x) > 0.95 || Math.abs(ndc.y) > 0.95) continue;
            ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
            const hit = ray.intersectObjects(ms, false)[0];
            if (hit && hit.object.userData.mod === modId) return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height, mesh: hit.object.userData.mesh };
          }
        }
        return null;
      },
    };
    return () => { delete window.__labScene; };
  }, [camera, gl, scene]);
  return null;
}

export default function LabScene({ meshes, M, project, modOf, visible, hl, selMeshes, offsets, sizeCm, showCard, onPick, wire }) {
  const groupRef = useRef();
  // 每个网格变换到装配台坐标（cm）一次
  const geoms = useMemo(() => {
    const m = new Map();
    for (const me of meshes) { const g = me.geom.clone(); g.applyMatrix4(M); if (!g.attributes.normal) g.computeVertexNormals(); m.set(me.id, g); }
    return m;
  }, [meshes, M]);
  useEffect(() => () => geoms.forEach((g) => g.dispose()), [geoms]);
  const colorOf = useMemo(() => new Map(project.modules.map((m) => [m.id, m.color])), [project.modules]);
  const anyHl = hl.size > 0;
  const grid = Math.max(10, Math.ceil(Math.max(sizeCm.x, sizeCm.z) * 1.6 / 10) * 10);
  return (
    <Canvas shadows={false} camera={{ fov: 40, position: [20, 20, 20] }} gl={{ preserveDrawingBuffer: true, antialias: true }} onPointerMissed={(e) => e.button === 0 && onPick(null, null, e)}>
      <color attach="background" args={["#f6f4ef"]} />
      <hemisphereLight args={["#ffffff", "#8a8577", 1.4]} />
      <directionalLight position={[30, 50, 20]} intensity={1.6} />
      <gridHelper args={[grid, grid, "#b9b2a3", "#ddd7ca"]} position={[0, -0.002, 0]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}><planeGeometry args={[grid, grid]} /><meshStandardMaterial color="#ebe6da" /></mesh>
      {showCard && (
        <group position={[sizeCm.x / 2 + CARD[0] / 2 + 2, CARD[1] / 2, 0]}>
          <mesh><boxGeometry args={CARD} /><meshStandardMaterial color="#5a8fd8" transparent opacity={0.55} /></mesh>
        </group>
      )}
      <group ref={groupRef}>
        {meshes.map((me) => {
          const mod = modOf.get(me.id);
          if (!mod || !visible.has(mod)) return null;
          const off = offsets.get(mod);
          const on = !anyHl || hl.has(mod);
          const picked = selMeshes.has(me.id);
          return (
            <mesh key={me.id} geometry={geoms.get(me.id)} position={off ? [off.x, off.y, off.z] : [0, 0, 0]} userData={{ mod, mesh: me.id }}
              onClick={(e) => { if (e.delta > 5) return; e.stopPropagation(); onPick(mod, me.id, e.nativeEvent); }}>
              <meshStandardMaterial color={picked ? "#ffcf33" : colorOf.get(mod) || "#9aa3ad"} roughness={0.6} transparent={!on} opacity={on ? 1 : 0.18} depthWrite={on} emissive={anyHl && on ? "#3a2a00" : "#000000"} wireframe={wire} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
      <OrbitControls makeDefault enableDamping={false} />
      <Fit size={sizeCm} />
      <Hook groupRef={groupRef} />
    </Canvas>
  );
}
