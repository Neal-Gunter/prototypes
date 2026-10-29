import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { PART_TYPES, FEATHER_STANDOFF } from "../parts";
import { useBench } from "../store";
import { sim } from "../sim";
import { featherBoardTexture, featherMetalRough } from "./textures";
import { textTexture } from "./labels";
import { sceneApi } from "./api";

// 零件 3D 模型：外形来自 Adafruit CAD Parts（MIT），细节（舵盘、线缆、支架、螺丝）是程序补上的
for (const t of Object.values(PART_TYPES)) useGLTF.preload(t.model, false, true);

function useCloned(url, patch) {
  const { scene } = useGLTF(url, false, true);
  return useMemo(() => {
    const o = scene.clone(true);
    o.traverse((m) => {
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.material = m.material.clone();
      patch?.(m);
    });
    return o;
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function FlatLabel({ text, position, rotation = [-Math.PI / 2, 0, 0], height = 0.22, color = "#f7f3ea", bg = null, opacity = 1 }) {
  const { tex, aspect } = useMemo(() => textTexture(text, { color, bg }), [text, color, bg]);
  return (
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

// ---------------- Feather ESP32‑S3 ----------------
const MOUNT_HOLES = [
  [2.54, 2.54],
  [48.26, 2.54],
  [2.54, 20.32],
  [48.26, 20.32],
].map(([x, y]) => [(x - 25.4) / 10, -(y - 11.43) / 10]);

export function FeatherModel() {
  const led = useRef([]);
  const obj = useCloned(PART_TYPES.esp32.model, (m) => {
    const n = m.material.name;
    if (n === "mask") {
      m.material.map = featherBoardTexture();
      m.material.metalnessMap = featherMetalRough();
      m.material.roughnessMap = featherMetalRough();
      m.material.color.set("#ffffff");
      m.material.metalness = 1;
      m.material.roughness = 1;
    }
    if (n === "ledGreen") led.current.push(m.material);
    if (n === "shield" || n === "silver") {
      m.material.metalness = 1;
      m.material.roughness = 0.28;
    }
    if (n === "gold") {
      m.material.metalness = 1;
      m.material.roughness = 0.3;
    }
  });
  const red = useRef();
  useFrame(() => {
    const usb = useBench.getState().usb;
    for (const mt of led.current) {
      mt.emissive.set(usb ? "#3dff6a" : "#000000");
      mt.emissiveIntensity = usb ? 2.2 : 0;
    }
    if (red.current) red.current.visible = !!sim.ledOn && usb;
  });
  const nylon = (
    <meshStandardMaterial color="#efeadf" roughness={0.55} />
  );
  return (
    <group>
      <primitive object={obj} position={[0, FEATHER_STANDOFF, 0]} />
      {MOUNT_HOLES.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          {/* 5 mm 尼龙铜柱 + 螺丝头 */}
          <mesh position={[0, FEATHER_STANDOFF / 2, 0]} castShadow>
            <cylinderGeometry args={[0.16, 0.16, FEATHER_STANDOFF, 6]} />
            {nylon}
          </mesh>
          <mesh position={[0, FEATHER_STANDOFF + 0.157 + 0.05, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.19, 0.1, 18]} />
            {nylon}
          </mesh>
        </group>
      ))}
      {/* 13 号脚上的红色 LED */}
      <mesh ref={red} position={[-2.39, FEATHER_STANDOFF + 0.18, 0.6]} visible={false} raycast={() => null}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshBasicMaterial color="#ff2a1a" toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------- 舵机 ----------------
const SERVO = PART_TYPES.servo;
const LEAD_X = [-0.26, 0, 0.26];
const LEAD_COL = ["#5a3a22", "#c8322a", "#e88a1a"];

function hornShape() {
  // 单臂舵盘：圆头 + 渐窄的臂
  const s = new THREE.Shape();
  const r0 = 0.36;
  const r1 = 0.16;
  const L = 1.55;
  s.absarc(0, 0, r0, Math.PI / 2, (Math.PI * 3) / 2, false);
  s.lineTo(L, -r1);
  s.absarc(L, 0, r1, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(0, r0);
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Path();
    h.absarc(0.55 + i * 0.19, 0, 0.045, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  return s;
}
const HORN_GEO = new THREE.ExtrudeGeometry(hornShape(), { depth: 0.13, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
HORN_GEO.rotateX(-Math.PI / 2);

function leadCurve(i) {
  const x = LEAD_X[i];
  return new THREE.CatmullRomCurve3([
    new THREE.Vector3(x * 0.35, 0.22, 1.1),
    new THREE.Vector3(x * 0.4, 0.2, 1.7),
    new THREE.Vector3(x * 0.7, 0.08, 2.6),
    new THREE.Vector3(x, 0.1, 3.4),
  ]);
}
const LEAD_GEOS = [0, 1, 2].map((i) => new THREE.TubeGeometry(leadCurve(i), 24, 0.045, 8, false));

export function ScrewModel({ servoId, idx, hole }) {
  const g = useRef();
  useFrame(() => {
    const o = sim.screwOp;
    const p = o && o.servoId === servoId && o.idx === idx ? o.p : useBench.getState().screws[servoId]?.[idx] ?? 0;
    if (!g.current) return;
    g.current.position.y = hole[1] + 0.02 + (1 - p) * 0.5;
    g.current.rotation.y = p * Math.PI * 10;
  });
  return (
    <group position={[hole[0], 0, hole[2]]}>
      <group ref={g}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.17, 0.12, 20]} />
          <meshStandardMaterial color="#b8bcc2" metalness={1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.045]} />
          <meshStandardMaterial color="#2a2c30" />
        </mesh>
        <mesh position={[0, 0.125, 0]}>
          <boxGeometry args={[0.045, 0.03, 0.24]} />
          <meshStandardMaterial color="#2a2c30" />
        </mesh>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.08, 0.06, 0.6, 10]} />
          <meshStandardMaterial color="#a9adb3" metalness={1} roughness={0.35} />
        </mesh>
      </group>
      {/* 螺丝刀的点击区 */}
      <mesh
        name={`screw:${servoId}:${idx}`}
        position={[0, hole[1] + 0.2, 0]}
        onPointerDown={(e) => {
          const st = useBench.getState();
          if (st.tool !== "screw") return;
          e.stopPropagation();
          if (sceneApi.controls) sceneApi.controls.enabled = false;
          st.startScrew(servoId, idx);
        }}
      >
        <cylinderGeometry args={[0.32, 0.32, 0.5, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function ServoModel({ part }) {
  const obj = useCloned(SERVO.model, (m) => {
    if (m.material.name === "servoBody") {
      m.material.color.set("#2457a8");
      m.material.roughness = 0.42;
      m.material.transparent = true;
      m.material.opacity = 0.93;
    }
    if (m.material.name === "brass") {
      m.material.metalness = 1;
      m.material.roughness = 0.3;
    }
  });
  const horn = useRef();
  const body = useRef();
  useFrame(({ clock }) => {
    const a = sim.servoAngle[part.id] ?? 90;
    if (horn.current) horn.current.rotation.y = THREE.MathUtils.degToRad(a - 90);
    if (body.current) {
      const s = sim.shake[part.id] || 0;
      const t = clock.elapsedTime;
      body.current.position.x = s * Math.sin(t * 47) * 0.05;
      body.current.rotation.y = s * Math.sin(t * 31) * 0.05;
    }
  });
  const [sx, sy, sz] = SERVO.shaft;
  return (
    <group>
      {/* 3D 打印支架：两根立柱托住耳朵，螺丝拧进立柱 */}
      {[1.36, -1.34].map((z) => (
        <mesh key={z} position={[0, 0.94, z]} castShadow receiveShadow>
          <boxGeometry args={[1.32, 1.88, 0.5]} />
          <meshStandardMaterial color="#d8d3c8" roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.1, 3.3]} />
        <meshStandardMaterial color="#d8d3c8" roughness={0.78} />
      </mesh>
      <group ref={body}>
        <primitive object={obj} />
        <mesh position={[sx, sy + 0.04, sz]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.08, 16]} />
          <meshStandardMaterial color="#e9e6dc" roughness={0.45} />
        </mesh>
        <group ref={horn} position={[sx, sy + 0.08, sz]}>
          <mesh geometry={HORN_GEO} castShadow>
            <meshStandardMaterial color="#f3f0e6" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.17, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.06, 12]} />
            <meshStandardMaterial color="#9a9ea4" metalness={1} roughness={0.3} />
          </mesh>
        </group>
        {/* 舵机线：棕 / 红 / 橙，插头已剪掉，线头剥皮镀锡 */}
        {LEAD_GEOS.map((g, i) => (
          <mesh key={i} geometry={g} castShadow>
            <meshStandardMaterial color={LEAD_COL[i]} roughness={0.55} />
          </mesh>
        ))}
        {LEAD_X.map((x, i) => (
          <mesh key={`t${i}`} position={[x, 0.1, 3.55]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.024, 0.026, 0.32, 8]} />
            <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.35} />
          </mesh>
        ))}
      </group>
      {SERVO.screwHoles.map((h, i) => (
        <ScrewModel key={i} servoId={part.id} idx={i} hole={h} />
      ))}
    </group>
  );
}

// ---------------- 电池盒 ----------------
const BAT_LEADS = [
  [-0.28, "#c8322a"],
  [0.28, "#222222"],
].map(([z, c]) => ({
  c,
  z,
  geo: new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([new THREE.Vector3(3.2, 0.45, z * 0.6), new THREE.Vector3(3.6, 0.2, z), new THREE.Vector3(4.2, 0.1, z)]),
    16,
    0.05,
    8,
    false,
  ),
}));

export function BatteryModel() {
  const obj = useCloned(PART_TYPES.battery.model, (m) => {
    m.material.color.set("#1d1d1f");
    m.material.roughness = 0.62;
  });
  return (
    <group>
      <primitive object={obj} />
      {BAT_LEADS.map((l) => (
        <group key={l.z}>
          <mesh geometry={l.geo} castShadow>
            <meshStandardMaterial color={l.c} roughness={0.5} />
          </mesh>
          <mesh position={[4.37, 0.1, l.z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.026, 0.028, 0.32, 8]} />
            <meshStandardMaterial color="#c9ccd0" metalness={1} roughness={0.35} />
          </mesh>
        </group>
      ))}
      <FlatLabel text="4 × AA  1.5 V" position={[0, 2.245, -1.2]} height={0.5} color="#d9d6cf" opacity={0.75} />
      <FlatLabel text="+" position={[4.0, 0.012, -0.62]} height={0.35} color="#ff8c7c" />
      <FlatLabel text="−" position={[4.0, 0.012, 0.64]} height={0.35} color="#d6d6d6" />
    </group>
  );
}
