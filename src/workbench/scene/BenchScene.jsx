import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { PLATE, PART_TYPES, localToWorld, partDisplayName, pinId, pinsOfType } from "../parts";
import { useBench } from "../store";
import { sim, stepServos } from "../sim";
import { textTexture } from "./labels";

// 场景和页面之间的桥：相机、射线、控制器（拖放用、测试用）
export const sceneApi = { camera: null, gl: null, controls: null };

const raycaster = new THREE.Raycaster();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function screenToPlate(clientX, clientY) {
  const { camera, gl } = sceneApi;
  if (!camera || !gl) return null;
  const r = gl.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  if (Math.abs(hit.x) > PLATE.w / 2 || Math.abs(hit.z) > PLATE.d / 2) return { ...hit, outside: true };
  return hit;
}

export function worldToScreen([x, y, z]) {
  const { camera, gl } = sceneApi;
  if (!camera || !gl) return null;
  const v = new THREE.Vector3(x, y, z).project(camera);
  const r = gl.domElement.getBoundingClientRect();
  return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height };
}

function Bridge() {
  const { camera, gl } = useThree();
  useEffect(() => {
    sceneApi.camera = camera;
    sceneApi.gl = gl;
  }, [camera, gl]);
  return null;
}

function FlatLabel({ text, position, rotation = [-Math.PI / 2, 0, 0], height = 0.22, color = "#f7f3ea", bg = null }) {
  const { tex, aspect } = useMemo(() => textTexture(text, { color, bg }), [text, color, bg]);
  return (
    <mesh position={position} rotation={rotation} raycast={() => null}>
      <planeGeometry args={[height * aspect, height]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} />
    </mesh>
  );
}

function SpriteLabel({ text, position, height = 0.6, bg = "rgba(27,24,20,0.82)" }) {
  const { tex, aspect } = useMemo(() => textTexture(text, { bg, size: 56 }), [text, bg]);
  return (
    <sprite position={position} scale={[height * aspect, height, 1]} raycast={() => null}>
      <spriteMaterial map={tex} depthTest={false} transparent />
    </sprite>
  );
}

function Plate() {
  return (
    <group>
      {/* 桌面 */}
      <mesh position={[0, -1.2, 0]} receiveShadow>
        <boxGeometry args={[46, 2, 32]} />
        <meshStandardMaterial color="#8a6a48" roughness={0.9} />
      </mesh>
      {/* 底板 */}
      <mesh position={[0, -0.15, 0]} receiveShadow>
        <boxGeometry args={[PLATE.w, 0.3, PLATE.d]} />
        <meshStandardMaterial color="#1f4a3c" roughness={0.75} />
      </mesh>
      <gridHelper args={[PLATE.w, PLATE.w, "#2f6b56", "#2f6b56"]} position={[0, 0.005, 0]} scale={[1, 1, PLATE.d / PLATE.w]} />
      <FlatLabel text="底板 30 × 20 cm（网格 1 cm）" position={[-9.5, 0.01, 9.3]} height={0.55} color="#9fd1bd" />
    </group>
  );
}

function Esp32Model() {
  const [w, h, d] = PART_TYPES.esp32.size;
  const pins = pinsOfType("esp32");
  return (
    <group>
      <mesh position={[0, h / 2 + 0.05, 0]} castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#14324a" roughness={0.6} />
      </mesh>
      {/* 模组屏蔽罩 + 天线区 */}
      <mesh position={[2.75, 0.4, 0]} castShadow>
        <boxGeometry args={[1.3, 0.35, 1.8]} />
        <meshStandardMaterial color="#b9bcc0" metalness={0.8} roughness={0.35} />
      </mesh>
      <FlatLabel text="ESP32-S3" position={[2.75, 0.58, 0]} rotation={[-Math.PI / 2, 0, 0]} height={0.28} color="#2a2a2a" />
      <mesh position={[3.15, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.12, 1.8]} />
        <meshStandardMaterial color="#0d2233" />
      </mesh>
      {/* USB 口 */}
      <mesh position={[-3.35, 0.35, 0]}>
        <boxGeometry args={[0.5, 0.3, 0.9]} />
        <meshStandardMaterial color="#d0d3d6" metalness={0.9} roughness={0.3} />
      </mesh>
      <FlatLabel text="USB（简化：默认已连电脑）" position={[-2.0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]} height={0.22} color="#9cc3e0" />
      {pins.map((p) => (
        <FlatLabel
          key={p.name}
          text={p.label}
          position={[p.local[0], 0.26, p.row === "top" ? -0.72 : 0.72]}
          rotation={[-Math.PI / 2, 0, p.row === "top" ? -Math.PI / 2 : -Math.PI / 2]}
          height={0.21}
          color={p.role === "gpio" && p.pwm ? "#f7f3ea" : p.role === "gnd" ? "#9fb0bf" : p.role === "gpio" || p.role === "en" ? "#f0a37a" : "#ff8f7a"}
        />
      ))}
    </group>
  );
}

function ServoModel({ part }) {
  const horn = useRef();
  useFrame(() => {
    const a = sim.servoAngle[part.id] ?? 90;
    if (horn.current) horn.current.rotation.y = THREE.MathUtils.degToRad(a - 90);
  });
  const leadColors = ["#6b3f22", "#c8322a", "#e88a1a"];
  return (
    <group>
      <mesh position={[0, 1.15, 0]} castShadow>
        <boxGeometry args={[2.28, 2.3, 1.22]} />
        <meshStandardMaterial color="#2c5aa0" roughness={0.5} transparent opacity={0.92} />
      </mesh>
      <mesh position={[0, 1.65, 0]}>
        <boxGeometry args={[3.2, 0.25, 1.22]} />
        <meshStandardMaterial color="#244b86" />
      </mesh>
      <mesh position={[-0.5, 2.45, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.3, 20]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>
      <group ref={horn} position={[-0.5, 2.65, 0]}>
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[1.6, 0.12, 0.35]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.25, 0.25, 0.14, 20]} />
          <meshStandardMaterial color="#f4f1e8" />
        </mesh>
      </group>
      {/* 三根引线 + 插头 */}
      {leadColors.map((c, i) => (
        <mesh key={c} position={[1.75, 0.35, -0.45 + i * 0.45]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.06, 0.06, 1.2, 8]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <mesh position={[2.7, 0.3, 0]}>
        <boxGeometry args={[0.5, 0.45, 1.45]} />
        <meshStandardMaterial color="#1b1b1b" />
      </mesh>
      {["GND", "VCC", "SIG"].map((n, i) => (
        <FlatLabel key={n} text={n} position={[3.3, 0.02, -0.45 + i * 0.45]} height={0.2} color={leadColors[i] === "#6b3f22" ? "#e3c3a8" : leadColors[i]} />
      ))}
    </group>
  );
}

function BatteryModel() {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[5.8, 1.6, 6.0]} />
        <meshStandardMaterial color="#202020" roughness={0.8} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 1.4, -2.1 + i * 1.4]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.65, 0.65, 5.0, 20]} />
          <meshStandardMaterial color={i % 2 ? "#3a7bd5" : "#c9a227"} metalness={0.3} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[3.2, 0.25, -0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 1.0, 8]} />
        <meshStandardMaterial color="#c8322a" />
      </mesh>
      <mesh position={[3.2, 0.25, 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 1.0, 8]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      <FlatLabel text="+" position={[4.45, 0.02, -0.35]} height={0.35} color="#ff7d6e" />
      <FlatLabel text="−" position={[4.45, 0.02, 0.35]} height={0.35} color="#cfcfcf" />
    </group>
  );
}

function Pin({ part, pin }) {
  const id = pinId(part.id, pin.name);
  const pending = useBench((s) => s.pendingPin === id);
  const joint = useBench((s) => s.joints[id]);
  const wired = useBench((s) => s.wires.some((w) => w.a === id || w.b === id));
  const soldering = useBench((s) => s.solder?.pin === id);
  const hint = useBench((s) => s.hintPins?.includes(id));
  const tool = useBench((s) => s.tool);
  const blob = useRef();
  useFrame(({ clock }) => {
    if (!blob.current) return;
    if (soldering) {
      const pr = useBench.getState().solderProgress;
      blob.current.scale.setScalar(0.4 + pr * 0.8);
    } else blob.current.scale.setScalar(1);
  });
  const isPin = part.type === "esp32";
  return (
    <group position={pin.local}>
      {/* 可见引脚 */}
      <mesh position={[0, isPin ? -0.08 : -0.12, 0]}>
        <boxGeometry args={isPin ? [0.14, 0.3, 0.14] : [0.12, 0.2, 0.12]} />
        <meshStandardMaterial color={pending ? "#ff9b54" : "#d4af37"} metalness={0.9} roughness={0.25} emissive={pending ? "#ff6a00" : "#000"} emissiveIntensity={pending ? 0.8 : 0} />
      </mesh>
      {/* 焊点 */}
      {(wired || soldering) && (joint || soldering) && (
        <mesh ref={blob} position={[0, 0.02, 0]}>
          {joint === "cold" && !soldering ? <dodecahedronGeometry args={[0.15, 0]} /> : <sphereGeometry args={[0.13, 16, 12]} />}
          <meshStandardMaterial
            color={soldering ? "#ffcf8a" : joint === "good" ? "#e8eaec" : "#7d7d78"}
            metalness={joint === "good" && !soldering ? 1 : 0.2}
            roughness={joint === "good" && !soldering ? 0.12 : 0.9}
            emissive={soldering ? "#ff7a1a" : "#000"}
            emissiveIntensity={soldering ? 0.9 : 0}
          />
        </mesh>
      )}
      {(hint || pending) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} raycast={() => null}>
          <ringGeometry args={[0.2, 0.3, 24]} />
          <meshBasicMaterial color={pending ? "#ff9b54" : "#5dff9e"} transparent opacity={0.9} />
        </mesh>
      )}
      {/* 加大的点击区域 */}
      <mesh
        name={`pin:${id}`}
        onClick={(e) => {
          e.stopPropagation();
          useBench.getState().clickPin(id);
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (useBench.getState().tool === "iron") {
            if (sceneApi.controls) sceneApi.controls.enabled = false;
            useBench.getState().startSolder(id);
          }
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = tool === "select" ? "default" : "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <sphereGeometry args={[0.2, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Part({ part }) {
  const selected = useBench((s) => s.selectedPart === part.id);
  const tool = useBench((s) => s.tool);
  const pins = pinsOfType(part.type);
  const name = partDisplayName(part);
  const labelY = part.type === "servo" ? 3.4 : part.type === "battery" ? 2.6 : 1.3;
  return (
    <group position={[part.x, 0, part.z]} rotation={[0, part.rot || 0, 0]}>
      <group
        onPointerDown={(e) => {
          if (tool !== "select") return;
          e.stopPropagation();
          const st = useBench.getState();
          st.selectPart(part.id);
          if (sceneApi.controls) sceneApi.controls.enabled = false;
          st.setDragging({ id: part.id, dx: e.point.x - part.x, dz: e.point.z - part.z });
        }}
      >
        {part.type === "esp32" && <Esp32Model />}
        {part.type === "servo" && <ServoModel part={part} />}
        {part.type === "battery" && <BatteryModel />}
      </group>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[part.type === "servo" ? 0.8 : 0.3, 0.02, 0]} raycast={() => null}>
          <planeGeometry args={part.type === "esp32" ? [7.6, 3.8] : part.type === "servo" ? [5, 2] : [6.6, 6.6]} />
          <meshBasicMaterial color="#ffb37a" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <SpriteLabel text={name} position={[0, labelY, 0]} />
      {pins.map((p) => (
        <Pin key={p.name} part={part} pin={p} />
      ))}
    </group>
  );
}

function Wire({ wire, parts }) {
  const geo = useMemo(() => {
    const find = (id) => {
      const [pid, n] = [id.slice(0, id.indexOf(".")), id.slice(id.indexOf(".") + 1)];
      const part = parts.find((p) => p.id === pid);
      const meta = part && pinsOfType(part.type).find((x) => x.name === n);
      return part && meta ? localToWorld(part, meta.local) : null;
    };
    const a = find(wire.a);
    const b = find(wire.b);
    if (!a || !b) return null;
    const A = new THREE.Vector3(a[0], a[1] + 0.05, a[2]);
    const B = new THREE.Vector3(b[0], b[1] + 0.05, b[2]);
    const dist = A.distanceTo(B);
    const lift = Math.min(4, 0.8 + dist * 0.22);
    const c1 = A.clone().lerp(B, 0.25).add(new THREE.Vector3(0, lift, 0));
    const c2 = A.clone().lerp(B, 0.75).add(new THREE.Vector3(0, lift, 0));
    const curve = new THREE.CubicBezierCurve3(A, c1, c2, B);
    return new THREE.TubeGeometry(curve, 40, 0.07, 8, false);
  }, [wire, parts]);
  useEffect(() => () => geo?.dispose(), [geo]);
  if (!geo) return null;
  return (
    <mesh
      geometry={geo}
      name={`wire:${wire.id}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        useBench.getState().removeWire(wire.id);
      }}
    >
      <meshStandardMaterial color={wire.color} roughness={0.5} />
    </mesh>
  );
}

function SolderingIron() {
  const solder = useBench((s) => s.solder);
  const parts = useBench((s) => s.parts);
  const tool = useBench((s) => s.tool);
  const ref = useRef();
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.25 + Math.sin(clock.elapsedTime * 30) * 0.01;
  });
  if (tool !== "iron" || !solder) return null;
  const [pid, n] = [solder.pin.slice(0, solder.pin.indexOf(".")), solder.pin.slice(solder.pin.indexOf(".") + 1)];
  const part = parts.find((p) => p.id === pid);
  const meta = part && pinsOfType(part.type).find((x) => x.name === n);
  if (!meta) return null;
  const [x, y, z] = localToWorld(part, meta.local);
  return (
    <group position={[x, y, z]}>
      <group ref={ref} rotation={[0, 0, -0.6]}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.02, 0.09, 1.4, 12]} />
          <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.2} emissive="#ff5a00" emissiveIntensity={0.25} />
        </mesh>
        <mesh position={[0, 2.4, 0]}>
          <cylinderGeometry args={[0.22, 0.2, 2.2, 16]} />
          <meshStandardMaterial color="#c6491c" />
        </mesh>
      </group>
    </group>
  );
}

function SimTicker() {
  useFrame((_, dt) => {
    const st = useBench.getState();
    st.tickSolder();
    if (stepServos(Math.min(dt, 0.05), st.parts)) st.markMoved();
  });
  return null;
}

export default function BenchScene() {
  const parts = useBench((s) => s.parts);
  const wires = useBench((s) => s.wires);
  const controlsRef = useRef();
  useEffect(() => {
    sceneApi.controls = controlsRef.current;
  });
  return (
    <Canvas
      camera={{ position: [0, 23, 18.5], fov: 40 }}
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      onPointerMissed={() => useBench.getState().selectPart(null)}
    >
      <color attach="background" args={["#e7dfd0"]} />
      <Bridge />
      <SimTicker />
      <ambientLight intensity={0.75} />
      <directionalLight position={[8, 20, 10]} intensity={1.6} />
      <directionalLight position={[-10, 8, -6]} intensity={0.5} />
      <Plate />
      {parts.map((p) => (
        <Part key={p.id} part={p} />
      ))}
      {wires.map((w) => (
        <Wire key={w.id} wire={w} parts={parts} />
      ))}
      <SolderingIron />
      <OrbitControls ref={controlsRef} target={[0, 0, 0]} maxPolarAngle={1.35} minDistance={6} maxDistance={55} makeDefault />
    </Canvas>
  );
}
