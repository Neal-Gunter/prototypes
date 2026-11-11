// 装配台 3D 场景：每帧从 Rapier 读出位姿；拖拽 / 拧 / 焊都交给 engine
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getModuleGeom } from "../../modellab/registry.js";
import { engine, BENCH } from "../engine.js";
import { PROC_BY_ID } from "../procedural.js";
import { elec } from "../elecStore.js";
import { elemKind, jointOf, terminalAt } from "../netlist.js";
import { pinLabel } from "../physpins.js";
import { WIRE, WIRE_COLORS, bench, benchSide, themeVars, remapWire } from "../../ui/palette.js";
import { useTheme } from "../../theme.js";

import { MAT, PROC_MAT, Boxes, ProcMesh, Glb } from "./partMeshes.jsx";
import PartHighlight from "./PartHighlight.jsx";
import { partTipText } from "./partTip.js";
import { useReducedMotion } from "../../ui/reducedMotion.js";
import { getLang } from "../../i18n.js";
export { ProcMesh, Glb };
// v11：用户上传的模型模块（几何体在浏览器内存里，见 modellab/registry.js）
function CustomMesh({ def }) {
  const g = getModuleGeom(def.custom.key, def.custom.module);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: def.custom.color || "#9aa3ad", roughness: 0.6, metalness: 0.1 }), [def.custom.color]);
  if (!g) return <Boxes cols={def.colliders} mat="white" />;
  return <mesh geometry={g.geom} material={mat} castShadow receiveShadow />;
}
const _q = new THREE.Quaternion(), _p = new THREE.Vector3();
// v22：零件上离指针最近的“有名字的物理引脚”（通孔 / 排针 / 贴片焊盘 / 腿）
export function pinAt(uid, wp, r = 0.25) {
  const P = engine.parts.get(uid); if (!P?.def.physPins) return null;
  let best = null;
  for (const f of engine.worldFeatures(P.body)) {
    if (f.uid !== uid) continue;
    const k = f.t === "pinhole" ? `p${f.i}` : f.t === "pad" ? `s${f.i}` : f.t === "land" ? `t${f.i}` : f.t === "pin-up" || f.t === "leg" ? `l${f.i}` : null;
    if (!k || !P.def.physPins[k]) continue;
    const d = Math.hypot(f.wp.x - wp.x, f.wp.z - wp.z);
    if (d < r && (!best || d < best.d)) best = { d, k, f };
  }
  return best;
}
const pinState = { key: null, set: null, marker: null };
function hoverPin(e, uid) {
  const b = pinAt(uid, e.point);
  const key = b ? uid + "|" + b.k : null;
  if (pinState.marker) { pinState.marker.visible = !!b; if (b) pinState.marker.position.copy(b.f.wp); }
  if (key === pinState.key && !b) return;
  pinState.key = key;
  if (!b) return pinState.set?.(null);
  const P = engine.parts.get(uid); const L = pinLabel(P.def, b.k);
  pinState.set?.({ x: e.nativeEvent.clientX, y: e.nativeEvent.clientY, uid, key: b.k, ref: P.state.ref || "", ...L, note: P.def.physInfo?.pitch?.note || "" });
}
function PinMarker() {
  const m = useRef();
  useEffect(() => { pinState.marker = m.current; return () => { pinState.marker = null; }; }, []);
  return <mesh ref={m} visible={false} renderOrder={10}><sphereGeometry args={[0.09, 12, 8]} /><meshBasicMaterial color="#ffd400" depthTest={false} transparent opacity={0.9} /></mesh>;
}
// 测试 / 导览用：某个零件某个引脚在屏幕上的位置
function PinHook() {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const rc = new THREE.Raycaster();
    const toScreen = (w) => { const v = w.clone().project(camera); const r = gl.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, ndc: v }; };
    // 指针放在这个屏幕点时，射线是否先打到该零件、并且 pinAt 选中的正是这个引脚
    const hits = (uid, k, sp) => {
      rc.setFromCamera({ x: sp.ndc.x, y: sp.ndc.y }, camera);
      const h = rc.intersectObjects(scene.children, true).find((i) => i.object.visible && !(i.object.material?.depthTest === false));
      if (!h) return false; let o = h.object; while (o && o.name !== uid) o = o.parent; if (!o) return false;
      return pinAt(uid, h.point)?.k === k;
    };
    window.__pinScreen = (uid, k) => {
      const P = engine.parts.get(uid); if (!P) return null;
      const f = engine.worldFeatures(P.body).find((f) => f.uid === uid && ((f.t === "pinhole" && "p" + f.i === k) || (f.t === "pad" && "s" + f.i === k) || (f.t === "land" && "t" + f.i === k) || ((f.t === "pin-up" || f.t === "leg") && "l" + f.i === k)));
      if (!f) return null;
      const cands = [f.wp.clone()];
      if (f.t === "pad") { // 贴片焊盘在底面：从上面悬停 → 投到零件顶面，并往零件中心收一点（邮票孔焊盘在边缘）
        const q = engine.worldPose(uid).q, qi = new THREE.Quaternion().copy(q).invert();
        const all = engine.worldFeatures(P.body).filter((g) => g.uid === uid && g.t === "pad").map((g) => g.wp.clone().applyQuaternion(qi));
        const lo = all.reduce((a, v) => a.min(v), all[0].clone()), hi = all.reduce((a, v) => a.max(v), all[0].clone());
        const c = lo.clone().add(hi).multiplyScalar(0.5), hx = (hi.x - lo.x) / 2 || 1, hz = (hi.z - lo.z) / 2 || 1;
        const l = f.wp.clone().applyQuaternion(qi), ox = (l.x - c.x) / hx, oz = (l.z - c.z) / hz;
        const n = (Math.abs(ox) >= Math.abs(oz) ? new THREE.Vector3(-Math.sign(ox), 0, 0) : new THREE.Vector3(0, 0, -Math.sign(oz))).applyQuaternion(q);
        const top = (P.def.dims_mm?.y || 3) / 10 - 0.02;
        for (const dy of [top, top / 2, 0.02]) for (const dn of [0.1, 0.18, 0.05, 0]) cands.push(f.wp.clone().add(new THREE.Vector3(0, dy, 0)).add(n.clone().multiplyScalar(dn)));
      }
      if (f.t === "land") { // 转接板焊盘：中间被芯片脚 / 焊点盖住 → 往外侧（远离板中心）找露出来的那一截
        const c = engine.worldPose(uid).p, d = f.wp.clone().sub(c).setY(0); const ax = Math.abs(d.x) >= Math.abs(d.z) ? new THREE.Vector3(Math.sign(d.x), 0, 0) : new THREE.Vector3(0, 0, Math.sign(d.z));
        for (const dn of [0.04, 0.07, 0.1, 0.02]) cands.push(f.wp.clone().add(ax.clone().multiplyScalar(dn)).add(new THREE.Vector3(0, 0.005, 0)));
      }
      const sps = cands.map(toScreen);
      const good = sps.find((sp) => hits(uid, k, sp)) || sps[f.t === "pad" || f.t === "land" ? 1 : 0];
      return { x: good.x, y: good.y, checked: sps.some((sp) => hits(uid, k, sp)) };
    };
    return () => { delete window.__pinScreen; };
  }, [camera, gl, scene]);
  return null;
}
function Part({ uid, onDown, hl, onHover, reduced }) {
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
  const leave = () => {
    if (def.physPins) { pinState.key = null; pinState.set?.(null); if (pinState.marker) pinState.marker.visible = false; }
    onHover?.(null, uid);
  };
  return (
    <group ref={ref} onPointerDown={(e) => onDown(e, uid)} onPointerOver={(e) => { e.stopPropagation(); onHover?.(uid); }} onPointerMove={def.physPins ? (e) => hoverPin(e, uid) : undefined} onPointerOut={leave} name={uid}>
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
          <mesh key={i} position={j.p} material={MAT[j.q === "good" ? "solder" : j.q] || MAT.solder} scale={(j.q === "bridge" ? [2.2, 1, 1] : j.q === "cold" ? [1.15, 1.15, 1.15] : [1, 0.8, 1]).map((v) => v * (j.s || 1))}>
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
      {hl ? <PartHighlight def={def} mode={hl} reduced={reduced} /> : null}
    </group>
  );
}
function Cables() {
  const group = useRef();
  const mats = useMemo(() => new Map(), []);
  const matFor = (col) => { if (!mats.has(col)) mats.set(col, new THREE.MeshStandardMaterial({ color: col, roughness: 0.78, metalness: 0.02 })); return mats.get(col); };
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
      const col = remapWire(c.color) || (c.kind === "servo-lead" ? WIRE.brown : /usb/.test(c.kind) ? WIRE.black : WIRE_COLORS[n % WIRE_COLORS.length]);
      if (!g.children[i]) { const m = new THREE.Mesh(geo, matFor(col)); m.castShadow = true; m.receiveShadow = true; g.add(m); }
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
      <meshStandardMaterial color={k === "red" ? WIRE.red : WIRE.black} roughness={0.55} />
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
function mulberry32(a) {
  return () => {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeBenchMaps() {
  const size = 512, rnd = mulberry32(0xb41c41);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = bench;
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    const a = 0.03 + rnd() * 0.05;
    g.fillStyle = `rgba(40,24,10,${a})`;
    g.fillRect(0, y, size, 1);
    if (y % 7 === 0) {
      g.fillStyle = `rgba(210,180,140,${0.02 + rnd() * 0.04})`;
      g.fillRect(0, y, size, 1);
    }
  }
  // 切割垫细格，颜色压暗，不抢零件
  g.strokeStyle = "rgba(27,24,20,0.16)";
  g.lineWidth = 1;
  const step = size / 8;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(size, i * step); g.stroke();
  }
  g.strokeStyle = "rgba(27,24,20,0.28)";
  g.lineWidth = 1.25;
  const major = size / 2;
  for (let i = 0; i <= 2; i++) {
    g.beginPath(); g.moveTo(i * major, 0); g.lineTo(i * major, size); g.stroke();
    g.beginPath(); g.moveTo(0, i * major); g.lineTo(size, i * major); g.stroke();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4);
  return map;
}
function Bench() {
  const map = useMemo(() => makeBenchMaps(), []);
  return (
    <group>
      <mesh position={[0, -1.6, 0]} receiveShadow>
        <boxGeometry args={[BENCH.w + 0.4, 3.2, BENCH.d + 0.4]} />
        <meshStandardMaterial color={benchSide} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[BENCH.w + 0.4, BENCH.d + 0.4]} />
        <meshStandardMaterial map={map} roughness={0.86} metalness={0} />
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
    } else if (tool === "iron" || tool === "desolder") {
      engine.tool.kind = "iron";
      vis.current = { kind: "iron", pos: e.point.clone().add(new THREE.Vector3(0, 0.05, 0)) };
      // Shift + 烙铁 = 拆焊（吸锡带/吸锡器）；v24：“拆焊”工具直接拆
      engine.holdSolder(e.point.clone(), { flux: flux.current, desolder: tool === "desolder" || e.nativeEvent.shiftKey });
      st.current.mode = "op";
    }
    onHover?.(uid);
  };
  return null;
}
function perfStats(a) {
  if (!a?.length) return { n: 0, mean: 0, median: 0, p95: 0 };
  const s = [...a].sort((x, y) => x - y), n = s.length;
  const mean = s.reduce((p, c) => p + c, 0) / n;
  return { n, mean: +mean.toFixed(3), median: +s[Math.floor(n / 2)].toFixed(3), p95: +s[Math.min(n - 1, Math.floor(n * 0.95))].toFixed(3) };
}
function ensurePerf() {
  if (typeof window === "undefined") return null;
  if (window.__asmPerf) return window.__asmPerf;
  const pf = { on: false, step: [], raf: [], lastRaf: null };
  pf.start = () => { pf.on = true; pf.step = []; pf.raf = []; pf.lastRaf = null; };
  pf.stop = () => { pf.on = false; return { step: perfStats(pf.step), raf: perfStats(pf.raf) }; };
  window.__asmPerf = pf;
  return pf;
}
function Loop({ onTick }) {
  useFrame((_, dt) => {
    const t0 = performance.now();
    if (!engine.extDrive) engine.update(Math.min(dt, 1 / 30));
    onTick?.();
    const step = performance.now() - t0;
    const pf = typeof window !== "undefined" ? window.__asmPerf : null;
    if (pf?.on) {
      const now = performance.now();
      pf.step.push(step);
      if (pf.lastRaf != null) pf.raf.push(now - pf.lastRaf);
      pf.lastRaf = now;
      if (pf.step.length > 240) { pf.step.shift(); if (pf.raf.length) pf.raf.shift(); }
    }
  });
  return null;
}
function TipHook({ hover, sel, box }) {
  const { camera, gl } = useThree();
  useFrame(() => {
    const el = box.current;
    if (!el) return;
    const uid = hover || sel;
    if (!uid || !engine.parts.has(uid)) {
      el.hidden = true;
      el.setAttribute("data-on", "0");
      el.removeAttribute("data-uid");
      return;
    }
    const P = engine.parts.get(uid);
    const w = engine.worldPose(uid);
    const y = (P.def.dims_mm?.y || 8) / 10;
    const v = new THREE.Vector3(w.p.x, w.p.y + y, w.p.z).project(camera);
    const r = gl.domElement.getBoundingClientRect();
    const x = r.left + (v.x + 1) / 2 * r.width;
    const sy = r.top + (1 - v.y) / 2 * r.height;
    const tip = partTipText(P.def, getLang());
    el.hidden = false;
    el.setAttribute("data-on", "1");
    el.setAttribute("data-uid", uid);
    el.setAttribute("data-mode", hover === uid ? "hover" : "focus");
    el.style.left = `${Math.round(x + 12)}px`;
    el.style.top = `${Math.round(sy - 8)}px`;
    const n = el.querySelector("[data-tip-name]");
    const sp = el.querySelector("[data-tip-spec]");
    if (n) n.textContent = tip.name;
    if (sp) { sp.textContent = tip.spec; sp.hidden = !tip.spec; }
  });
  return null;
}
// 调试 / 导出用：把 three 场景挂到 window（只读引用，v11 用它导出内置示例的 GLB）
function SceneHook() {
  const { scene } = useThree();
  useEffect(() => { window.__asmScene = scene; return () => { if (window.__asmScene === scene) window.__asmScene = null; }; }, [scene]);
  return null;
}
export default function AsmScene({ uids, tool, debug, flux, vis, onTick, onSelect, probes, onProbe, onPin, sel }) {
  pinState.set = onPin;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const fluxRef = useRef(flux);
  fluxRef.current = flux;
  const controls = useRef();
  const tipBox = useRef(null);
  const [hover, setHover] = useState(null);
  const reduced = useReducedMotion();
  const onHover = (u, from) => setHover((h) => (u == null && from && h !== from ? h : u));
  const [, , theme] = useTheme();
  const C = themeVars(theme);
  const dark = theme === "dark";
  useEffect(() => {
    ensurePerf();
    const apply = () => {
      const a = window.__asm || (window.__asm = {});
      a.hover = (u) => setHover(u || null);
      a.getHighlight = () => ({ hover, sel: sel || null, reduced: !!reduced, parts: engine.parts.size });
    };
    apply();
    const a = window.__asm || (window.__asm = {});
    a.themeBg = C.paper;
    a.theme = theme;
    return () => {
      if (window.__asm?.hover) window.__asm.hover = null;
      if (window.__asm?.getHighlight) window.__asm.getHighlight = null;
    };
  }, [hover, sel, reduced, theme, C.paper]);
  return (
    <div className="relative h-full min-h-[60vh] w-full" data-testid="asm-canvas-wrap">
      <Canvas shadows camera={{ position: [0, 30, 33], fov: 40, near: 0.1, far: 400 }} gl={{ preserveDrawingBuffer: true }} data-testid="asm-canvas">
        <SceneHook />
        <color attach="background" args={[C.paper]} />
        <hemisphereLight args={dark ? ["#c8bfb0", "#3a3228", 0.42] : ["#f4efe6", "#6e5a45", 0.72]} />
        <directionalLight position={[20, 40, 15]} intensity={dark ? 0.9 : 1.35} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-35} shadow-camera-right={35} shadow-camera-top={25} shadow-camera-bottom={-25} />
        <directionalLight position={[-16, 18, -12]} intensity={dark ? 0.18 : 0.28} />
        <Bench />
        <ContactShadows position={[0, 0.02, 0]} opacity={dark ? 0.5 : 0.28} scale={80} blur={2.2} far={10} color={dark ? "#000000" : "#1b1814"} />
        {uids.map((u) => <Part key={u} uid={u} hl={u === hover ? "hover" : u === sel ? "focus" : null} onHover={onHover} reduced={reduced} onDown={(e, id) => { Interact.down(e, id); onSelect?.(id); }} />)}
        <Cables />
        <ToolMesh vis={vis} />
        <DebugColliders on={debug} />
        <Probes probes={probes} />
        <PinMarker />
        <PinHook />
        <Interact toolRef={toolRef} vis={vis} flux={fluxRef} controls={controls} onProbe={onProbe} />
        <Loop onTick={onTick} />
        <TipHook hover={hover} sel={sel} box={tipBox} />
        <CamHook controls={controls} />
        <OrbitControls ref={controls} makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.1} minDistance={8} maxDistance={110} />
      </Canvas>
      <div ref={tipBox} hidden data-on="0" data-testid="asm-part-tip" data-reduced={reduced ? "1" : "0"} className="pointer-events-none fixed z-50 max-w-xs border border-copper bg-paper-2/95 px-2 py-1 text-xs text-ink shadow" role="status">
        <div data-tip-name className="font-semibold text-ink" />
        <div data-tip-spec className="text-ink-soft" />
      </div>
    </div>
  );
}
