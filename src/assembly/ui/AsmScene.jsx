// 装配台 3D 场景：每帧从 Rapier 读出位姿；拖拽 / 拧 / 焊都交给 engine
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { engine, BENCH } from "../engine.js";
import { PROC_BY_ID } from "../procedural.js";

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: "#b8bcc2", metalness: 0.85, roughness: 0.32 }),
  brass: new THREE.MeshStandardMaterial({ color: "#c9a24a", metalness: 0.8, roughness: 0.3 }),
  acrylic: new THREE.MeshStandardMaterial({ color: "#dfe9ee", roughness: 0.1, metalness: 0.05, transparent: true, opacity: 0.72 }),
  white: new THREE.MeshStandardMaterial({ color: "#f1efe9", roughness: 0.7 }),
  black: new THREE.MeshStandardMaterial({ color: "#26272a", roughness: 0.55 }),
  orange: new THREE.MeshStandardMaterial({ color: "#d9792b", roughness: 0.5 }),
  blue: new THREE.MeshStandardMaterial({ color: "#2f6fd6", roughness: 0.45 }),
  solder: new THREE.MeshStandardMaterial({ color: "#d8dde2", metalness: 1, roughness: 0.15 }),
  sel: new THREE.MeshBasicMaterial({ color: "#d9792b", wireframe: true }),
};
const PROC_MAT = { screw: "steel", nut: "steel", standoff: "brass", plate: "acrylic", breadboard: "white", bracket: "black", horn: "white", tentacle: "orange", dupont: "black", plug: "black", tool: "blue" };

function Boxes({ cols, mat }) {
  return cols.map((c, i) => (
    <mesh key={i} position={c.c} material={MAT[mat] || MAT.white} castShadow receiveShadow>
      <boxGeometry args={[c.h[0] * 2, c.h[1] * 2, c.h[2] * 2]} />
    </mesh>
  ));
}
// 紧固件画成圆柱 / 六角（碰撞仍用方块，见“简化”）
function ProcMesh({ def }) {
  const p = def.proc || {};
  const mm = (v) => v / 10;
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
function Glb({ def }) {
  const { scene } = useGLTF(def.glb);
  const obj = useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return o;
  }, [scene]);
  const H = def.dims_mm.y / 10;
  return def.flip ? <group position={[0, H, 0]} rotation={[Math.PI, 0, 0]}><primitive object={obj} /></group> : <primitive object={obj} />;
}
function Part({ uid, onDown }) {
  const ref = useRef();
  const p = engine.parts.get(uid);
  useFrame(() => {
    if (!ref.current || !engine.parts.has(uid)) return;
    const w = engine.worldPose(uid);
    ref.current.position.copy(w.p);
    ref.current.quaternion.copy(w.q);
  });
  if (!p) return null;
  const def = p.def;
  return (
    <group ref={ref} onPointerDown={(e) => onDown(e, uid)} name={uid}>
      {def.kind === "glb" ? (
        <Suspense fallback={<Boxes cols={def.colliders} mat="white" />}><Glb def={def} /></Suspense>
      ) : (
        <ProcMesh def={def} />
      )}
      {(p.state.solder || []).map((q, i) => (
        <mesh key={i} position={q} material={MAT.solder}><sphereGeometry args={[0.06, 10, 8]} /></mesh>
      ))}
    </group>
  );
}
function Cables() {
  const group = useRef();
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#1e1f22", roughness: 0.6 }), []);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    while (g.children.length > engine.cables.length) { const c = g.children.pop(); c.geometry.dispose(); }
    engine.cables.forEach((c, i) => {
      const pts = engine.cablePoints(c);
      if (pts.length < 2) return;
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, 0.18, 8, false);
      if (!g.children[i]) g.add(new THREE.Mesh(geo, mat));
      else { g.children[i].geometry.dispose(); g.children[i].geometry = geo; }
    });
  });
  return <group ref={group} />;
}
function DebugColliders({ on }) {
  const ref = useRef();
  const geo = useMemo(() => new THREE.BufferGeometry(), []);
  useFrame(() => {
    if (!on || !ref.current) return;
    const { vertices, colors } = engine.debugLines();
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  });
  if (!on) return null;
  return (
    <lineSegments ref={ref} geometry={geo} renderOrder={10}>
      <lineBasicMaterial vertexColors transparent depthTest={false} />
    </lineSegments>
  );
}
function ToolMesh({ vis }) {
  const ref = useRef();
  useFrame(() => {
    const v = vis.current;
    if (!ref.current) return;
    ref.current.visible = !!v.kind;
    if (v.kind) ref.current.position.copy(v.pos);
    for (const c of ref.current.children) c.visible = c.name === v.kind;
  });
  return (
    <group ref={ref}>
      {["screwdriver", "iron"].map((k) => (
        <group key={k} name={k}><Boxes cols={PROC_BY_ID[`p-tool-${k}`].colliders} mat={k === "iron" ? "black" : "blue"} /></group>
      ))}
      <group name="hand" />
    </group>
  );
}
function Bench() {
  return (
    <group>
      <mesh position={[0, -1.6, 0]} receiveShadow>
        <boxGeometry args={[BENCH.w + 0.4, 3.2, BENCH.d + 0.4]} />
        <meshStandardMaterial color="#9a7652" roughness={0.85} />
      </mesh>
    </group>
  );
}
// 鼠标交互：拖拽 / 拧 / 焊
function Interact({ toolRef, vis, flux, controls, onHover }) {
  const { camera, gl, raycaster, pointer } = useThree();
  const st = useRef({ mode: null, btn: 0, shift: false });
  useEffect(() => {
    const el = gl.domElement;
    const ray = () => { raycaster.setFromCamera(pointer, camera); return raycaster.ray.clone(); };
    const move = (e) => {
      st.current.shift = e.shiftKey;
      if (st.current.mode === "drag") engine.setDragRay(ray(), e.shiftKey);
    };
    const up = () => {
      const m = st.current.mode;
      st.current.mode = null;
      if (m === "drag") engine.endDrag();
      if (m === "op") { engine.releaseOps(); if (toolRef.current !== "hand") vis.current.kind = null; }
      if (controls.current) controls.current.enabled = true;
    };
    const wheel = (e) => { if (st.current.mode === "drag") { e.preventDefault(); engine.dragLift(-Math.sign(e.deltaY) * 0.3); } };
    const key = (e) => {
      if (!engine.drag) return;
      if (e.key === "r" || e.key === "R") engine.dragRotate(e.shiftKey ? -Math.PI / 2 : Math.PI / 2);
      if (e.key === "q" || e.key === "Q" || e.key === "PageUp") engine.dragLift(0.3);
      if (e.key === "e" || e.key === "E" || e.key === "PageDown") engine.dragLift(-0.3);
    };
    const ctx = (e) => e.preventDefault();
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("contextmenu", ctx);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("contextmenu", ctx);
      window.removeEventListener("keydown", key);
    };
  }, [camera, gl, raycaster, pointer, toolRef, vis, controls]);
  Interact.down = (e, uid) => {
    e.stopPropagation();
    const tool = toolRef.current;
    const right = e.nativeEvent.button === 2;
    if (controls.current) controls.current.enabled = false;
    if (tool === "hand" && !right) {
      engine.beginDrag(uid, e.point.clone());
      st.current.mode = engine.drag ? "drag" : null;
    } else if (tool === "hand" || tool === "screwdriver") {
      engine.tool.kind = tool;
      const p = engine.parts.get(uid);
      const ok = p?.state.screw ? engine.holdScrew(uid, e.nativeEvent.shiftKey ? -1 : 1) : p?.state.press ? engine.holdPress(uid) : null;
      if (!ok) engine.toast(p?.state.screw ? "现在拧不动" : "这个零件不需要拧：先把螺丝 / 螺母 / 铜柱放到孔上", "info");
      if (tool === "screwdriver") vis.current = { kind: "screwdriver", pos: engine.worldPose(uid).p.clone().add(new THREE.Vector3(0, 1.4, 0)) };
      st.current.mode = "op";
    } else if (tool === "iron") {
      engine.tool.kind = "iron";
      vis.current = { kind: "iron", pos: e.point.clone().add(new THREE.Vector3(0, 0.05, 0)) };
      engine.holdSolder(e.point.clone(), { flux: flux.current });
      st.current.mode = "op";
    }
    onHover?.(uid);
  };
  return null;
}
function Loop({ onTick }) {
  useFrame((_, dt) => { if (!engine.extDrive) engine.update(Math.min(dt, 1 / 30)); onTick?.(); });
  return null;
}
export default function AsmScene({ uids, tool, debug, flux, vis, onTick, onSelect }) {
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const fluxRef = useRef(flux);
  fluxRef.current = flux;
  const controls = useRef();
  return (
    <Canvas shadows camera={{ position: [0, 30, 33], fov: 40, near: 0.1, far: 400 }} gl={{ preserveDrawingBuffer: true }} data-testid="asm-canvas">
      <color attach="background" args={["#e9e4da"]} />
      <hemisphereLight args={["#ffffff", "#8a7a66", 0.9]} />
      <directionalLight position={[20, 40, 15]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={25} shadow-camera-bottom={-25} />
      <Bench />
      {uids.map((u) => <Part key={u} uid={u} onDown={(e, id) => { Interact.down(e, id); onSelect?.(id); }} />)}
      <Cables />
      <ToolMesh vis={vis} />
      <DebugColliders on={debug} />
      <Interact toolRef={toolRef} vis={vis} flux={fluxRef} controls={controls} />
      <Loop onTick={onTick} />
      <OrbitControls ref={controls} makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={110} />
    </Canvas>
  );
}
