import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { partDisplayName, pinsOfType } from "../parts";
import { mountedMap, useBench } from "../store";
import { pushPlot, sim, stepServos } from "../sim";
import { textTexture } from "./labels";
import { sceneApi } from "./api";
import { BatteryModel, FeatherModel, ServoModel } from "./Models";
import { LiveJoint, Pin } from "./Joints";
import { Wire } from "./Wires";
import { DeskTools } from "./Tools";
import Desk from "./Desk";
import Smoke from "./Smoke";
import { pinWorld } from "./geom";

export { sceneApi, screenToPlate, worldToScreen } from "./api";

function Bridge() {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    sceneApi.camera = camera;
    sceneApi.gl = gl;
    sceneApi.scene = scene;
  }, [camera, gl, scene]);
  return null;
}

function SpriteLabel({ text, position, height = 0.55, bg = "rgba(27,24,20,0.78)" }) {
  const { tex, aspect } = useMemo(() => textTexture(text, { bg, size: 56 }), [text, bg]);
  const ref = useRef();
  const wp = useMemo(() => new THREE.Vector3(), []);
  // 镜头凑近时标签淡出，不挡住要看的焊点
  useFrame(({ camera }) => {
    const s = ref.current;
    if (!s) return;
    s.getWorldPosition(wp);
    const d = camera.position.distanceTo(wp);
    const o = THREE.MathUtils.clamp((d - 10) / 8, 0, 1);
    s.material.opacity = o;
    s.visible = o > 0.02;
  });
  return (
    <sprite ref={ref} position={position} scale={[height * aspect, height, 1]} raycast={() => null}>
      <spriteMaterial map={tex} depthTest={false} transparent toneMapped={false} />
    </sprite>
  );
}

const SEL = { esp32: [[5.8, 2.8], [0, 0]], servo: [[1.9, 7.8], [0, 1.9]], battery: [[9.6, 7.4], [0.9, 0]] };

function Part({ part }) {
  const selected = useBench((s) => s.selectedPart === part.id);
  const showLabels = useBench((s) => s.showLabels !== false);
  const pins = pinsOfType(part.type);
  const name = partDisplayName(part);
  const labelY = part.type === "servo" ? 4.2 : part.type === "battery" ? 3.0 : 1.6;
  const [size, off] = SEL[part.type];
  return (
    <group position={[part.x, 0, part.z]} rotation={[0, part.rot || 0, 0]}>
      <group
        name={`part:${part.id}`}
        onPointerDown={(e) => {
          const st = useBench.getState();
          if (st.tool !== "select") return;
          e.stopPropagation();
          st.selectPart(part.id);
          if (sceneApi.controls) sceneApi.controls.enabled = false;
          st.setDragging({ id: part.id, dx: e.point.x - part.x, dz: e.point.z - part.z });
        }}
      >
        {part.type === "esp32" && <FeatherModel />}
        {part.type === "servo" && <ServoModel part={part} />}
        {part.type === "battery" && <BatteryModel />}
      </group>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[off[0], 0.006, off[1]]} raycast={() => null}>
          <planeGeometry args={size} />
          <meshBasicMaterial color="#ffb37a" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      )}
      {showLabels && <SpriteLabel text={name} position={[0, labelY, 0]} />}
      {pins.map((p) => (
        <Pin key={p.name} part={part} pin={p} />
      ))}
    </group>
  );
}

// 相机：预设视角 + 平滑飞过去
function CameraRig() {
  const { camera } = useThree();
  const tw = useRef(null);
  useEffect(() => {
    sceneApi.flyTo = (pos, target, dur = 0.7) => {
      const c = sceneApi.controls;
      tw.current = {
        p0: camera.position.clone(),
        t0: c ? c.target.clone() : new THREE.Vector3(),
        p1: new THREE.Vector3(...pos),
        t1: new THREE.Vector3(...target),
        k: 0,
        dur,
      };
    };
    sceneApi.preset = (name) => {
      const st = useBench.getState();
      const find = (t) => st.parts.find((p) => p.type === t);
      const e = find("esp32");
      const s = find("servo");
      let P = null;
      if (name === "overview") P = [[0, 27, 29], [0, 0, 2]];
      else if (name === "top") P = [[0, 32, 0.01], [0, 0, 0]];
      else if (name === "board" && e) P = [[e.x - 0.2, 6.5, e.z + 5.5], [e.x, 0.6, e.z]];
      else if (name === "servo" && s) P = [[s.x + 3.5, 7, s.z + 6.5], [s.x, 1.2, s.z + 1]];
      else if (name === "joint" && st.lastPin) {
        const pw = pinWorld(st.parts, st.lastPin);
        if (pw) P = [[pw.pos[0] + 0.6, pw.pos[1] + 3.2, pw.pos[2] + 2.8], pw.pos];
      } else if (name === "meter") P = [[-12, 12, 12], [-15, 0, 0]];
      if (!P) {
        st.say(name === "joint" ? "先点一个焊盘，再用“对准焊点”" : "台面上还没有这个零件", "warn");
        return;
      }
      sceneApi.flyTo(P[0], P[1]);
    };
  }, [camera]);
  useFrame((_, dt) => {
    const t = tw.current;
    if (!t) return;
    t.k = Math.min(1, t.k + dt / t.dur);
    const e = t.k < 0.5 ? 4 * t.k ** 3 : 1 - (-2 * t.k + 2) ** 3 / 2;
    camera.position.lerpVectors(t.p0, t.p1, e);
    const c = sceneApi.controls;
    if (c) {
      c.target.lerpVectors(t.t0, t.t1, e);
      c.update();
    } else camera.lookAt(t.t1);
    if (t.k >= 1) tw.current = null;
  });
  return null;
}

function SimTicker() {
  const acc = useRef({ plot: 0, meas: 0 });
  useFrame((_, rawDt) => {
    // 帧率低时分成小步推进，保证物理时间和真实时间一致
    const dt = Math.min(rawDt, 0.25);
    const st = useBench.getState();
    const mounted = mountedMap(st.parts, st.screws);
    let moved = false;
    for (let left = dt; left > 1e-6; left -= 0.05) {
      const h = Math.min(0.05, left);
      st.tickOp(h);
      st.tickScrew(h);
      if (stepServos(h, st.parts, mounted)) moved = true;
    }
    if (moved) st.markMoved();
    const a = acc.current;
    a.plot += dt;
    if (a.plot > 0.05 && st.fw.status === "running") {
      a.plot = 0;
      const v = {};
      for (const p of st.parts) if (p.type === "servo") v[partDisplayName(p)] = Math.round(sim.servoAngle[p.id] ?? 90);
      for (const [g, deg] of Object.entries(sim.pinCmd)) v[`GPIO${g} 指令`] = deg;
      pushPlot(v);
    }
    a.meas += dt;
    if (a.meas > 0.3 && st.meter.red && st.meter.black && st.meter.mode === "dcv") {
      a.meas = 0;
      st.remeasure();
    }
  });
  return null;
}

function Scene() {
  const parts = useBench((s) => s.parts);
  const wires = useBench((s) => s.wires);
  return (
    <group
      onPointerMove={(e) => {
        sim.hover = [e.point.x, e.point.y, e.point.z];
      }}
    >
      <Desk />
      <DeskTools />
      {parts.map((p) => (
        <Part key={p.id} part={p} />
      ))}
      {wires.map((w) => (
        <Wire key={w.id} wire={w} parts={parts} />
      ))}
      <LiveJoint />
      <Smoke />
    </group>
  );
}

export default function BenchScene() {
  const controlsRef = useRef();
  useEffect(() => {
    sceneApi.controls = controlsRef.current;
  });
  return (
    <Canvas
      shadows
      camera={{ position: [0, 27, 29], fov: 38, near: 0.1, far: 300 }}
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
      onPointerMissed={() => useBench.getState().selectPart(null)}
    >
      <color attach="background" args={["#1d1b19"]} />
      <fog attach="fog" args={["#1d1b19", 60, 120]} />
      <Bridge />
      <SimTicker />
      <CameraRig />
      <Suspense fallback={null}>
        <Scene />
      </Suspense>
      <OrbitControls ref={controlsRef} target={[0, 0, 2]} maxPolarAngle={1.42} minDistance={2.5} maxDistance={60} enableDamping dampingFactor={0.12} makeDefault />
    </Canvas>
  );
}
