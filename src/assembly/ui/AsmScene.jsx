// 装配台 3D 场景：每帧从 Rapier 读出位姿；拖拽 / 拧 / 焊都交给 engine
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getModuleGeom } from "../../modellab/registry.js";
import { engine, BENCH } from "../engine.js";
import { PROC_BY_ID } from "../procedural.js";
import { elec } from "../elecStore.js";
import { elemKind, jointOf, terminalAt } from "../netlist.js";

const MAT = {
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
// v11：用户上传的模型模块（几何体在浏览器内存里，见 modellab/registry.js）
function CustomMesh({ def }) {
  const g = getModuleGeom(def.custom.key, def.custom.module);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.custom.color || "#9aa3ad", roughness: 0.6, metalness: 0.1 }), [def.custom.color]);
  if (!g) return <Boxes cols={def.colliders} mat="white" />;
  return <mesh geometry={g.geom} material={mat} castShadow receiveShadow />;
}
const _q = new THREE.Quaternion(), _p = new THREE.Vector3();
function Part({ uid, onDown }) {
  const ref = useRef();
  const glow = useRef();
  const p = engine.parts.get(uid);
  const kind = p ? elemKind(p.def) : null;
  useFrame(() => {
    if (!ref.current || !engine.parts.has(uid)) return;
    const w = engine.worldPose(uid);
    const v = engine.parts.get(uid).vis;
    if (v && v.pose) {
      ref.current.position.copy(v.pose.p);
      ref.current.quaternion.copy(v.pose.q);
    } else if (v && v.ang) {
      // 舵机带着转：绕输出轴旋转（只改画面）
      _q.setFromAxisAngle(v.axis, v.ang);
      _p.copy(w.p).sub(v.pivot).applyQuaternion(_q).add(v.pivot);
      ref.current.position.copy(_p);
      ref.current.quaternion.copy(_q).multiply(w.q);
    } else {
      ref.current.position.copy(w.p);
      ref.current.quaternion.copy(w.q);
    }
    if (glow.current) {
      const st = engine.parts.get(uid).state;
      const mA = elec.last?.leds.get(uid)?.mA || 0;
      const on = !st.burnt && mA > 0.3;
      glow.current.visible = on || !!st.burnt;
      glow.current.material.color.set(st.burnt ? "#2a1a12" : "#ff3b2f");
      glow.current.material.opacity = st.burnt ? 0.9 : Math.min(0.95, 0.25 + mA / 12);
      glow.current.scale.setScalar(on ? 1 + Math.min(1.2, mA / 15) : 1);
    }
  });
  if (!p) return null;
  const def = p.def;
  const H = (def.dims_mm?.y || 8) / 10;
  return (
    <group ref={ref} onPointerDown={(e) => onDown(e, uid)} name={uid}>
      {def.kind === "glb" ? (
        <Suspense fallback={<Boxes cols={def.colliders} mat="white" />}><Glb def={def} /></Suspense>
      ) : def.kind === "custom" ? (
        <CustomMesh def={def} />
      ) : (
        <ProcMesh def={def} />
      )}
      {(p.state.solder || []).map((q0, i) => {
        const j = jointOf(q0);
        // 合格：光亮小锥；虚焊：发灰、球状；连锡：拉长到旁边焊盘；烫坏：焦黑
        return (
          <mesh key={i} position={j.p} material={MAT[j.q === "good" ? "solder" : j.q] || MAT.solder} scale={j.q === "bridge" ? [2.2, 1, 1] : j.q === "cold" ? [1.15, 1.15, 1.15] : [1, 0.8, 1]}>
            {j.q === "good" ? <coneGeometry args={[0.07, 0.1, 12]} /> : <sphereGeometry args={[0.065, 10, 8]} />}
          </mesh>
        );
      })}
      {kind === "led" && (
        <mesh ref={glow} position={[0, H * 0.72, 0]} visible={false}>
          <sphereGeometry args={[0.3, 16, 12]} />
          <meshBasicMaterial transparent opacity={0.5} color="#ff3b2f" depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
const WIRE_COLORS = ["#d23a2f", "#1e1f22", "#e0b322", "#2f8f4e", "#2f6fd6", "#e07a2b", "#8a4fbf", "#f1efe9"];
function Cables() {
  const group = useRef();
  const mats = useMemo(() => new Map(), []);
  const matFor = (col) => { if (!mats.has(col)) mats.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 })); return mats.get(col); };
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    while (g.children.length > engine.cables.length) { const c = g.children.pop(); c.geometry.dispose(); }
    engine.cables.forEach((c, i) => {
      const pts = engine.cablePoints(c);
      if (pts.length < 2) return;
      // 粗细 = 物理绳子的半径（不会出现“线看着穿过去了、其实是画粗了”）
      const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 3, engine.cableRadius(c), 8, false);
      const n = +String(c.id).replace(/\D/g, "") || i;
      const col = c.color || (c.kind === "servo-lead" ? "#7a4a2a" : /usb/.test(c.kind) ? "#2a2b2e" : WIRE_COLORS[n % WIRE_COLORS.length]);
      if (!g.children[i]) g.add(new THREE.Mesh(geo, matFor(col)));
      else { g.children[i].geometry.dispose(); g.children[i].geometry = geo; g.children[i].material = matFor(col); }
    });
  });
  return <group ref={group} name="cables" />;
}
// 万用表表笔：红 / 黑小锥
function Probes({ probes }) {
  return ["red", "black"].map((k) => probes?.[k]?.wp ? (
    <mesh key={k} position={[probes[k].wp.x, probes[k].wp.y + 0.6, probes[k].wp.z]} rotation={[Math.PI, 0, 0]}>
      <coneGeometry args={[0.12, 1.2, 12]} />
      <meshStandardMaterial color={k === "red" ? "#d23a2f" : "#1e1f22"} />
    </mesh>
  ) : null);
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
// 测试/演示用：把相机移到某个位置看向某点（只在走查脚本里调用）
function CamHook({ controls }) {
  const { camera } = useThree();
  useEffect(() => {
    window.__asmCam = (pos, tgt) => { camera.position.set(...pos); controls.current?.target.set(...tgt); controls.current?.update(); };
    return () => { delete window.__asmCam; };
  }, [camera, controls]);
  return null;
}
function Interact({ toolRef, vis, flux, controls, onHover, onProbe }) {
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
      if (m === "press") { elec.press(st.current.pressUid, false); }
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
    } else if (tool === "hand" && elemKind(engine.parts.get(uid)?.def) === "btn") {
      // 右键按住按键 = 按下（松开就弹起）
      elec.press(uid, true);
      st.current.pressUid = uid;
      st.current.mode = "press";
    } else if (tool === "meter") {
      const t = terminalAt(engine, e.point.clone(), 0.3);
      onProbe?.(right || e.nativeEvent.shiftKey ? "black" : "red", t ? { term: t.term, wp: t.f.wp.clone() } : null);
      if (controls.current) controls.current.enabled = true;
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
      // Shift + 烙铁 = 拆焊（吸锡带/吸锡器）
      engine.holdSolder(e.point.clone(), { flux: flux.current, desolder: e.nativeEvent.shiftKey });
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
// 调试 / 导出用：把 three 场景挂到 window（只读引用，v11 用它导出内置示例的 GLB）
function SceneHook() {
  const { scene } = useThree();
  useEffect(() => { window.__asmScene = scene; return () => { if (window.__asmScene === scene) window.__asmScene = null; }; }, [scene]);
  return null;
}
export default function AsmScene({ uids, tool, debug, flux, vis, onTick, onSelect, probes, onProbe }) {
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const fluxRef = useRef(flux);
  fluxRef.current = flux;
  const controls = useRef();
  return (
    <Canvas shadows camera={{ position: [0, 30, 33], fov: 40, near: 0.1, far: 400 }} gl={{ preserveDrawingBuffer: true }} data-testid="asm-canvas">
      <SceneHook />
      <color attach="background" args={["#e9e4da"]} />
      <hemisphereLight args={["#ffffff", "#8a7a66", 0.9]} />
      <directionalLight position={[20, 40, 15]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={25} shadow-camera-bottom={-25} />
      <Bench />
      {uids.map((u) => <Part key={u} uid={u} onDown={(e, id) => { Interact.down(e, id); onSelect?.(id); }} />)}
      <Cables />
      <ToolMesh vis={vis} />
      <DebugColliders on={debug} />
      <Probes probes={probes} />
      <Interact toolRef={toolRef} vis={vis} flux={fluxRef} controls={controls} onProbe={onProbe} />
      <Loop onTick={onTick} />
      <CamHook controls={controls} />
      <OrbitControls ref={controls} makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={110} />
    </Canvas>
  );
}
