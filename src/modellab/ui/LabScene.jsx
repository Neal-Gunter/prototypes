// v11 模型实验室 3D 视图：每个网格按所属模块上色；高亮 / 半透明 / 隐藏 / 隔离 / 爆炸；点选模块或网格
import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { jointToBench, stepLab } from "../artic.js";

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
            const sx = rect.left + ((ndc.x + 1) / 2) * rect.width, sy = rect.top + ((1 - ndc.y) / 2) * rect.height;
            if (sx < 0 || sy < 0 || sx > innerWidth || sy > innerHeight) continue;
            if (hit && hit.object.userData.mod === modId) return { x: rect.left + ((ndc.x + 1) / 2) * rect.width, y: rect.top + ((1 - ndc.y) / 2) * rect.height, mesh: hit.object.userData.mesh, point: hit.point.toArray() };
          }
        }
        return null;
      },
    };
    return () => { delete window.__labScene; };
  }, [camera, gl, scene]);
  return null;
}

// v12：仿真开着时每帧推进物理，并把网格 / 关节标记 / 测试方块摆到刚体的位置（刚体从原点、无旋转开始，所以网格几何体不用改）
function SimSync({ lab, groupRef, markRef, blockRef }) {
  useFrame((st, dt) => {
    if (!lab) return;
    stepLab(lab, Math.min(dt, 1 / 30));
    // v13：跑步态时镜头跟着机身平移（只平移 x / z，不转）
    const root = lab.rbs?.[0];
    if (root) {
      const t = root.translation();
      if (lab.follow && lab._camLast && st.controls) { const dx = t.x - lab._camLast.x, dz = t.z - lab._camLast.z; st.camera.position.x += dx; st.camera.position.z += dz; st.controls.target.x += dx; st.controls.target.z += dz; st.controls.update(); }
      lab._camLast = { x: t.x, z: t.z };
    }
    const put = (o, rb) => { const t = rb.translation(), r = rb.rotation(); o.position.set(t.x, t.y, t.z); o.quaternion.set(r.x, r.y, r.z, r.w); };
    groupRef.current?.children.forEach((o) => { const rb = o.userData.mod && lab.modBody.get(o.userData.mod); if (rb) put(o, rb); });
    markRef.current?.children.forEach((o) => { const rb = o.userData.jparent && lab.modBody.get(o.userData.jparent); if (rb) put(o, rb); });
    blockRef.current?.children.forEach((o, i) => { const b = lab.blocks[i]; if (b) put(o, b.rb); });
  });
  useEffect(() => () => {
    groupRef.current?.children.forEach((o) => { const f = o.userData.off || [0, 0, 0]; o.position.set(f[0], f[1], f[2]); o.quaternion.identity(); });
    markRef.current?.children.forEach((o) => { o.position.set(0, 0, 0); o.quaternion.identity(); });
  }, [lab]);
  return null;
}
const JCOL = { revolute: "#d9480f", prismatic: "#1971c2", ball: "#7048e8", fixed: "#495057" };
function JointMarker({ j, M, r, sel, onClick }) {
  const b = jointToBench(j, M);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.axis);
  const L = r * 0.35;
  return (
    <group userData={{ jparent: j.parent }}>
      <group position={b.p.toArray()} quaternion={q.toArray()}>
        <mesh onClick={(e) => { e.stopPropagation(); onClick?.(j.id); }} renderOrder={10}><sphereGeometry args={[r * 0.035, 16, 12]} /><meshBasicMaterial color={sel ? "#ffcf33" : JCOL[j.type]} depthTest={false} transparent opacity={0.95} /></mesh>
        {j.type !== "fixed" && <mesh position={[0, 0, 0]} renderOrder={10}><cylinderGeometry args={[r * 0.006, r * 0.006, L * 2, 8]} /><meshBasicMaterial color={JCOL[j.type]} depthTest={false} transparent opacity={0.85} /></mesh>}
        {j.type !== "fixed" && j.type !== "ball" && <mesh position={[0, L, 0]} renderOrder={10}><coneGeometry args={[r * 0.018, r * 0.05, 12]} /><meshBasicMaterial color={JCOL[j.type]} depthTest={false} transparent opacity={0.85} /></mesh>}
      </group>
    </group>
  );
}

export default function LabScene({ meshes, M, project, modOf, visible, hl, selMeshes, offsets, sizeCm, showCard, onPick, wire, lab, joints = [], showJoints = true, selJoint, onJoint, blocks = 0, pickPts = [] }) {
  const markRef = useRef(), blockRef = useRef();
  const r = Math.max(sizeCm.x, sizeCm.y, sizeCm.z, 3);
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
  const grid0 = Math.max(10, Math.ceil(Math.max(sizeCm.x, sizeCm.z) * 1.6 / 10) * 10);
  const grid = lab && !project.sim?.fixBase ? Math.max(grid0, 160) : grid0; // 自由底座时桌面画大一点（物理地面 400 cm 宽），走出去也看得见
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
            <mesh key={me.id} geometry={geoms.get(me.id)} position={off && !lab ? [off.x, off.y, off.z] : [0, 0, 0]} userData={{ mod, mesh: me.id, off: off && !lab ? [off.x, off.y, off.z] : [0, 0, 0] }}
              onClick={(e) => { if (e.delta > 5) return; e.stopPropagation(); onPick(mod, me.id, e.nativeEvent, { point: e.point.clone(), normal: e.face ? e.face.normal.clone() : null }); }}>
              <meshStandardMaterial color={picked ? "#ffcf33" : colorOf.get(mod) || "#9aa3ad"} roughness={0.6} transparent={!on} opacity={on ? 1 : 0.18} depthWrite={on} emissive={anyHl && on ? "#3a2a00" : "#000000"} wireframe={wire} side={THREE.DoubleSide} />
            </mesh>
          );
        })}
      </group>
      <group ref={markRef}>{showJoints && joints.map((j) => <JointMarker key={j.id} j={j} M={M} r={r} sel={selJoint === j.id} onClick={onJoint} />)}</group>
      <group>{pickPts.map((p, i) => <mesh key={i} position={p} renderOrder={11}><sphereGeometry args={[r * 0.025, 12, 8]} /><meshBasicMaterial color="#e8590c" depthTest={false} /></mesh>)}</group>
      <group ref={blockRef}>{Array.from({ length: blocks }, (_, i) => <mesh key={i}><boxGeometry args={[2, 2, 2]} /><meshStandardMaterial color="#e03131" roughness={0.7} /></mesh>)}</group>
      <SimSync lab={lab} groupRef={groupRef} markRef={markRef} blockRef={blockRef} />
      <OrbitControls makeDefault enableDamping={false} />
      <Fit size={sizeCm} />
      <Hook groupRef={groupRef} />
    </Canvas>
  );
}
