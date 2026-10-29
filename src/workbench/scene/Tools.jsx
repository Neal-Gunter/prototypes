import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { FEATHER_STANDOFF, PART_TYPES, localToWorld } from "../parts";
import { useBench } from "../store";
import { sim } from "../sim";
import { pinWorld } from "./geom";
import { drawLcd } from "./textures";
import { FlatLabel } from "./Models";

// 桌面上的工具。都是程序生成的模型（没有找到许可证合适、体积够小的现成模型）。
export const MAT_Y = -0.5;
const UP = new THREE.Vector3(0, 1, 0);
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const norm = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

// 手里拿着的工具对准哪里：引脚 > 桌面上的鼠标位置
function handTarget(lift = 0.5, pinLift = 0.08) {
  const st = useBench.getState();
  if (sim.hoverPin) {
    const pw = pinWorld(st.parts, sim.hoverPin);
    if (pw) return tmpV.set(pw.pos[0], pw.pos[1] + pinLift, pw.pos[2]).clone();
  }
  if (sim.hover) return new THREE.Vector3(sim.hover[0], sim.hover[1] + lift, sim.hover[2]);
  return null;
}

// 平滑地把工具（局部 +Y 是工具轴，原点是尖端）移到 tip、朝向 axis
function pose(obj, tip, axis, dt, speed = 14) {
  if (!obj) return;
  const k = 1 - Math.exp(-dt * speed);
  obj.position.lerp(tip, k);
  tmpQ.setFromUnitVectors(UP, axis);
  obj.quaternion.slerp(tmpQ, k);
}
function snap(obj, tip, axis) {
  if (!obj) return;
  obj.position.copy(tip);
  obj.quaternion.setFromUnitVectors(UP, axis);
}

// ---------------- 烙铁 + 烙铁架 + 焊锡丝 ----------------
const STAND = new THREE.Vector3(16.5, MAT_Y, -6.5);
const REST_AXIS = norm(1, 0.72, 0);
const REST_TIP = STAND.clone().add(new THREE.Vector3(-1.9, 1.15, 0));
const HAND_AXIS = norm(0.78, 0.58, -0.22);

const coilGeo = (() => {
  const pts = [];
  const u = REST_AXIS;
  const a = new THREE.Vector3(0, 0, 1);
  const b = new THREE.Vector3().crossVectors(u, a).normalize();
  for (let i = 0; i <= 220; i++) {
    const t = i / 220;
    const along = 0.6 + t * 3.6;
    const ang = t * Math.PI * 2 * 11;
    const r = 0.42 + t * 0.12;
    pts.push(REST_TIP.clone().add(u.clone().multiplyScalar(along)).add(a.clone().multiplyScalar(Math.cos(ang) * r)).add(b.clone().multiplyScalar(Math.sin(ang) * r)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 600, 0.035, 6, false);
})();

const brassGeo = (() => {
  const pts = [];
  for (let i = 0; i < 400; i++) {
    const t = i / 400;
    pts.push(new THREE.Vector3(Math.sin(t * 97) * 0.75 * Math.cos(t * 13), 0.35 + Math.sin(t * 61) * 0.22, Math.cos(t * 89) * 0.75 * Math.sin(t * 17 + 1)));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1200, 0.018, 4, false);
})();

function IronStand() {
  return (
    <group>
      <mesh position={[STAND.x, MAT_Y + 0.3, STAND.z]} castShadow receiveShadow>
        <cylinderGeometry args={[2.5, 2.7, 0.6, 40]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.55} metalness={0.4} />
      </mesh>
      {/* 黄铜清洁丝 */}
      <mesh position={[STAND.x + 1.0, MAT_Y + 0.6, STAND.z + 1.0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.5, 28, 1, true]} />
        <meshStandardMaterial color="#3a3c40" metalness={0.5} roughness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={brassGeo} position={[STAND.x + 1.0, MAT_Y + 0.55, STAND.z + 1.0]}>
        <meshStandardMaterial color="#c9a24a" metalness={1} roughness={0.35} />
      </mesh>
      {/* 弹簧架 */}
      <mesh geometry={coilGeo} castShadow>
        <meshStandardMaterial color="#b7bcc2" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[REST_TIP.x + 0.9, MAT_Y + 0.9, REST_TIP.z]} rotation={[0, 0, -0.35]} castShadow>
        <boxGeometry args={[0.2, 1.2, 0.5]} />
        <meshStandardMaterial color="#3a3c40" metalness={0.6} roughness={0.4} />
      </mesh>
      <FlatLabel text="烙铁架" position={[STAND.x, MAT_Y + 0.61, STAND.z - 1.8]} height={0.45} color="#c9c9c9" />
    </group>
  );
}

function IronModel({ tipMat }) {
  return (
    <group>
      {/* 尖端（镀铁层，前面一点上了锡） */}
      <mesh position={[0, 0.05, 0]} material={tipMat}>
        <sphereGeometry args={[0.025, 10, 8]} />
      </mesh>
      <mesh position={[0, 0.5, 0]} material={tipMat} castShadow>
        <cylinderGeometry args={[0.08, 0.022, 1.0, 16]} />
      </mesh>
      <mesh position={[0, 2.4, 0]} castShadow>
        <cylinderGeometry args={[0.095, 0.095, 2.8, 16]} />
        <meshStandardMaterial color="#c8ccd2" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, 3.95, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.17, 0.4, 20]} />
        <meshStandardMaterial color="#8a8f96" metalness={1} roughness={0.35} />
      </mesh>
      <mesh position={[0, 7.0, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.3, 5.6, 24]} />
        <meshStandardMaterial color="#2b2d31" roughness={0.82} />
      </mesh>
      {[4.8, 5.3, 5.8].map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.31, 0.04, 8, 24]} />
          <meshStandardMaterial color="#c6491c" roughness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 10.15, 0]}>
        <cylinderGeometry args={[0.1, 0.3, 0.7, 16]} />
        <meshStandardMaterial color="#1c1d20" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Iron() {
  const tool = useBench((s) => s.tool);
  const ironTemp = useBench((s) => s.ironTemp);
  const grp = useRef();
  const solder = useRef();
  const cord = useRef();
  const last = useRef(new THREE.Vector3(999, 0, 0));
  const tipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#7c7f84", metalness: 1, roughness: 0.3, emissive: new THREE.Color("#ff4a10") }), []);
  const inited = useRef(false);
  useEffect(() => () => cord.current?.geometry.dispose(), []);
  useFrame((_, dt) => {
    const st = useBench.getState();
    const active = ["iron", "wick", "pump"].includes(st.tool);
    const o = sim.op;
    let tip = null;
    let axis = HAND_AXIS;
    if (o) {
      tip = new THREE.Vector3(o.world[0], o.world[1] + (o.kind === "wick" ? 0.1 : 0.04), o.world[2]);
      if (o.kind === "pump") axis = norm(0.85, 0.5, 0.15);
    } else if (active) tip = handTarget(0.6, 0.18);
    if (!tip) {
      tip = REST_TIP;
      axis = REST_AXIS;
    }
    if (!inited.current) {
      snap(grp.current, tip, axis);
      inited.current = true;
    } else pose(grp.current, tip, axis, dt);
    // 烙铁头颜色：温度越高越暗红（真实 350 °C 时几乎看不出发光，这里稍微夸张一点方便看）
    const hot = Math.max(0, Math.min(1, (st.ironTemp - 260) / 190));
    tipMat.emissiveIntensity = hot * (0.5 + 0.08 * Math.sin(performance.now() / 90));
    // 焊锡丝：另一只手拿着，按住“送锡”时碰到烙铁头和焊盘之间
    if (solder.current) {
      solder.current.visible = st.tool === "iron" && !!(o || sim.hover);
      if (solder.current.visible) {
        const p = grp.current.position;
        const feed = o && st.feeding;
        const touch = new THREE.Vector3(p.x - 0.08, p.y + (feed ? -0.01 : 0.12), p.z + (feed ? 0.1 : 0.45));
        const far = touch.clone().add(norm(-0.55, 0.55, 0.62).multiplyScalar(6));
        const mid = touch.clone().lerp(far, 0.5);
        solder.current.position.copy(mid);
        solder.current.quaternion.setFromUnitVectors(UP, far.clone().sub(touch).normalize());
        solder.current.scale.set(1, touch.distanceTo(far), 1);
      }
    }
    // 电源线：从手柄尾部垂到桌面，再接到烙铁架后面
    const end = new THREE.Vector3(0, 10.5, 0).applyQuaternion(grp.current.quaternion).add(grp.current.position);
    if (end.distanceTo(last.current) > 0.05 && cord.current) {
      last.current.copy(end);
      const tail = new THREE.Vector3(STAND.x + 3.5, MAT_Y + 0.1, STAND.z - 2.5);
      const curve = new THREE.CubicBezierCurve3(
        end,
        end.clone().add(new THREE.Vector3(0, 10.5, 0).applyQuaternion(grp.current.quaternion).normalize().multiplyScalar(2.5)),
        tail.clone().add(new THREE.Vector3(0, 0, 2)),
        tail,
      );
      cord.current.geometry.dispose();
      cord.current.geometry = new THREE.TubeGeometry(curve, 40, 0.12, 8, false);
    }
  });
  void tool;
  void ironTemp;
  return (
    <group>
      <IronStand />
      <group ref={grp}>
        <IronModel tipMat={tipMat} />
      </group>
      <mesh ref={cord} raycast={() => null} castShadow>
        <bufferGeometry />
        <meshStandardMaterial color="#1f2023" roughness={0.7} />
      </mesh>
      <mesh ref={solder} visible={false} raycast={() => null}>
        <cylinderGeometry args={[0.04, 0.04, 1, 8]} />
        <meshStandardMaterial color="#c9ccd1" metalness={1} roughness={0.28} />
      </mesh>
    </group>
  );
}

// ---------------- 焊锡丝卷、助焊剂笔、吸锡带、吸锡器、螺丝刀、剥线钳 ----------------
function ToolHit({ tool, children, position, rotation }) {
  const cur = useBench((s) => s.tool);
  return (
    <group
      position={position}
      rotation={rotation}
      name={`tool:${tool}`}
      visible={cur !== tool}
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().setTool(cur === tool ? "select" : tool);
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      {children}
    </group>
  );
}

function SolderSpool() {
  return (
    <group position={[16.8, MAT_Y, 1.6]}>
      {[0.1, 1.9].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[1.7, 1.7, 0.2, 36]} />
          <meshStandardMaterial color="#2c62b8" roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 1.0, 0]} castShadow>
        <cylinderGeometry args={[1.35, 1.35, 1.6, 36]} />
        <meshStandardMaterial color="#c3c6cb" metalness={1} roughness={0.38} />
      </mesh>
      <FlatLabel text="无铅焊锡丝 SAC305 · 0.8 mm · 松香芯" position={[0, 2.02, 0]} height={0.32} color="#f3f3f3" />
    </group>
  );
}

function FluxPen() {
  const cur = useBench((s) => s.tool);
  const hand = useRef();
  useFrame((_, dt) => {
    if (cur !== "flux" || !hand.current) return;
    const t = handTarget(0.3, 0.02);
    hand.current.visible = !!t;
    if (t) pose(hand.current, t, norm(-0.35, 0.85, 0.4), dt, 18);
  });
  const model = (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.12, 0.03, 0.5, 12]} />
        <meshStandardMaterial color="#f1ead6" roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.6, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.42, 6.2, 20]} />
        <meshPhysicalMaterial color="#d9a441" roughness={0.25} transmission={0.2} thickness={0.5} />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <cylinderGeometry args={[0.42, 0.2, 0.4, 20]} />
        <meshStandardMaterial color="#1f1f22" roughness={0.6} />
      </mesh>
    </group>
  );
  return (
    <>
      <ToolHit tool="flux" position={[13.5, MAT_Y + 0.42, 8.0]} rotation={[0, 0.3, Math.PI / 2]}>
        {model}
        <FlatLabel text="助焊剂笔" position={[0.6, 3.6, 0.43]} rotation={[0, 0, Math.PI / 2]} height={0.4} color="#1b1b1b" />
      </ToolHit>
      {cur === "flux" && <group ref={hand}>{model}</group>}
    </>
  );
}

function WickRoll() {
  const cur = useBench((s) => s.tool);
  const hand = useRef();
  useFrame((_, dt) => {
    if (cur !== "wick" || !hand.current) return;
    const show = !sim.op;
    const t = show && handTarget(0.25, 0.06);
    hand.current.visible = !!t;
    if (t) pose(hand.current, t, norm(-0.2, 0.35, 0.9), dt, 18);
  });
  return (
    <>
      <ToolHit tool="wick" position={[17.2, MAT_Y, 8.4]}>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[1.0, 1.0, 0.7, 30]} />
          <meshStandardMaterial color="#2f8a4f" roughness={0.5} />
        </mesh>
        <mesh position={[0.9, 0.08, 0.8]} rotation={[0, -0.6, 0]}>
          <boxGeometry args={[1.6, 0.05, 0.25]} />
          <meshStandardMaterial color="#c47c43" metalness={1} roughness={0.45} />
        </mesh>
        <FlatLabel text="吸锡带" position={[0, 0.72, 0]} height={0.38} color="#f3f3f3" />
      </ToolHit>
      {cur === "wick" && (
        <group ref={hand}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[0.25, 1.8, 0.04]} />
            <meshStandardMaterial color="#c47c43" metalness={1} roughness={0.45} />
          </mesh>
        </group>
      )}
    </>
  );
}

function PumpModel({ plunger }) {
  return (
    <group>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.32, 0.07, 1.0, 16]} />
        <meshStandardMaterial color="#f2f0ea" roughness={0.4} />
      </mesh>
      <mesh position={[0, 4.4, 0]} castShadow>
        <cylinderGeometry args={[0.48, 0.48, 6.8, 24]} />
        <meshStandardMaterial color="#9aa6b2" metalness={0.9} roughness={0.3} />
      </mesh>
      <mesh position={[0, 3.0, 0.5]}>
        <boxGeometry args={[0.3, 0.5, 0.2]} />
        <meshStandardMaterial color="#d12f2f" roughness={0.5} />
      </mesh>
      <group ref={plunger}>
        <mesh position={[0, 8.8, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 2.0, 10]} />
          <meshStandardMaterial color="#d0d4d9" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position={[0, 9.8, 0]}>
          <cylinderGeometry args={[0.38, 0.38, 0.3, 20]} />
          <meshStandardMaterial color="#1f1f22" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function Pump() {
  const cur = useBench((s) => s.tool);
  const hand = useRef();
  const plunger = useRef();
  useFrame((_, dt) => {
    if (cur !== "pump" || !hand.current) return;
    const o = sim.op;
    let t;
    if (o) t = new THREE.Vector3(o.world[0] - 0.03, o.world[1] + 0.1, o.world[2] + 0.03);
    else t = handTarget(0.6, 0.25);
    hand.current.visible = !!t;
    if (t) pose(hand.current, t, norm(-0.35, 0.85, 0.35), dt, 16);
    if (plunger.current) plunger.current.position.y = o ? 0 : -1.4;
  });
  return (
    <>
      <ToolHit tool="pump" position={[4.2, MAT_Y + 0.5, 11.6]} rotation={[0, 0, Math.PI / 2]}>
        <PumpModel />
        <FlatLabel text="吸锡器" position={[0.5, 4.4, 0.5]} rotation={[0, 0, Math.PI / 2]} height={0.42} color="#1b1b1b" />
      </ToolHit>
      {cur === "pump" && (
        <group ref={hand}>
          <PumpModel plunger={plunger} />
        </group>
      )}
    </>
  );
}

function DriverModel() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.1, 0.06, 0.022]} />
        <meshStandardMaterial color="#9da2a8" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.022, 0.06, 0.1]} />
        <meshStandardMaterial color="#9da2a8" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 3.5, 10]} />
        <meshStandardMaterial color="#c8ccd2" metalness={1} roughness={0.22} />
      </mesh>
      <mesh position={[0, 5.6, 0]} castShadow>
        <cylinderGeometry args={[0.36, 0.32, 4.4, 12]} />
        <meshStandardMaterial color="#25272b" roughness={0.6} />
      </mesh>
      <mesh position={[0, 7.95, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.3, 20]} />
        <meshStandardMaterial color="#b0b5bb" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

function Screwdriver() {
  const cur = useBench((s) => s.tool);
  const hand = useRef();
  const spin = useRef();
  useFrame((_, dt) => {
    if (cur !== "screw" || !hand.current) return;
    const o = sim.screwOp;
    const st = useBench.getState();
    let t = null;
    if (o) {
      const part = st.parts.find((p) => p.id === o.servoId);
      const h = PART_TYPES.servo.screwHoles[o.idx];
      if (part) {
        const w = localToWorld(part, h);
        t = new THREE.Vector3(w[0], h[1] + 0.02 + (1 - o.p) * 0.5 + 0.13, w[2]);
      }
    } else t = handTarget(0.9, 0.5);
    hand.current.visible = !!t;
    if (t) pose(hand.current, t, norm(0.05, 1, 0.08), dt, o ? 30 : 16);
    if (spin.current && o) spin.current.rotation.y = o.p * Math.PI * 10;
  });
  return (
    <>
      <ToolHit tool="screw" position={[-3.5, MAT_Y + 0.36, 11.6]} rotation={[0, 0, Math.PI / 2]}>
        <DriverModel />
        <FlatLabel text="十字螺丝刀 PH0" position={[0.37, 5.6, 0]} rotation={[0, 0, Math.PI / 2]} height={0.36} color="#e9e9e9" />
      </ToolHit>
      {cur === "screw" && (
        <group ref={hand}>
          <group ref={spin}>
            <DriverModel />
          </group>
        </group>
      )}
    </>
  );
}

function StripperModel() {
  return (
    <group>
      <mesh position={[0, 0.15, 1.0]} castShadow>
        <boxGeometry args={[0.9, 0.3, 2.2]} />
        <meshStandardMaterial color="#9aa0a7" metalness={1} roughness={0.35} />
      </mesh>
      {[-0.32, 0.32].map((x, i) => (
        <mesh key={x} position={[x, 0.2, -2.3]} rotation={[0, i ? -0.12 : 0.12, 0]} castShadow>
          <boxGeometry args={[0.45, 0.4, 4.6]} />
          <meshStandardMaterial color="#c63a2b" roughness={0.7} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.31, 0.3 + i * 0.4]}>
          <cylinderGeometry args={[0.05 + i * 0.012, 0.05 + i * 0.012, 0.02, 12]} />
          <meshStandardMaterial color="#2a2c30" />
        </mesh>
      ))}
    </group>
  );
}

function Stripper() {
  const cur = useBench((s) => s.tool);
  const hand = useRef();
  useFrame((_, dt) => {
    if (cur !== "strip" || !hand.current) return;
    const t = sim.hover ? new THREE.Vector3(sim.hover[0], sim.hover[1] + 0.6, sim.hover[2]) : null;
    hand.current.visible = !!t;
    if (t) {
      const k = 1 - Math.exp(-dt * 16);
      hand.current.position.lerp(t, k);
    }
  });
  return (
    <>
      <ToolHit tool="strip" position={[-11, MAT_Y, 10.8]} rotation={[0, Math.PI / 2, 0]}>
        <StripperModel />
        <FlatLabel text="剥线钳 20–30 AWG" position={[0, 0.42, -2.3]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} height={0.36} color="#fff" />
      </ToolHit>
      {cur === "strip" && (
        <group ref={hand} rotation={[0.5, 0.5, 0]}>
          <group position={[0, 0, -1.6]}>
            <StripperModel />
          </group>
        </group>
      )}
    </>
  );
}

// ---------------- 万用表 + 表笔 ----------------
const METER = new THREE.Vector3(-16.4, MAT_Y, -1.5);
const METER_TOP = MAT_Y + 2.4;
const JACK = { red: new THREE.Vector3(METER.x + 1.4, METER_TOP + 0.05, METER.z + 5.4), black: new THREE.Vector3(METER.x - 1.4, METER_TOP + 0.05, METER.z + 5.4) };
const DIAL = { off: 0, dcv: -0.8, cont: 0.8 };

function Probe({ color }) {
  const g = useRef();
  const cable = useRef();
  const last = useRef(new THREE.Vector3(999, 0, 0));
  const axis = color === "red" ? norm(0.32, 0.88, 0.36) : norm(-0.4, 0.86, 0.32);
  const restTip = new THREE.Vector3(METER.x + (color === "red" ? 3.2 : 2.3), MAT_Y + 0.25, METER.z + 9.0);
  const restAxis = norm(0.05, 0.02, -1);
  const inited = useRef(false);
  useEffect(() => () => cable.current?.geometry.dispose(), []);
  useFrame((_, dt) => {
    const st = useBench.getState();
    const m = st.meter;
    let tip = null;
    let ax = axis;
    const placed = m[color];
    if (placed) {
      const pw = pinWorld(st.parts, placed);
      if (pw) tip = new THREE.Vector3(pw.pos[0] + (color === "red" ? 0.02 : -0.02), pw.pos[1] + 0.02, pw.pos[2]);
    } else if (st.tool === "meter" && m.next === color) tip = handTarget(0.6, 0.06);
    if (!tip) {
      tip = restTip;
      ax = restAxis;
    }
    if (!inited.current) {
      snap(g.current, tip, ax);
      inited.current = true;
    } else pose(g.current, tip, ax, dt, 16);
    const end = new THREE.Vector3(0, 5.2, 0).applyQuaternion(g.current.quaternion).add(g.current.position);
    if (end.distanceTo(last.current) > 0.04 && cable.current) {
      last.current.copy(end);
      const j = JACK[color];
      const sag = new THREE.Vector3((end.x + j.x) / 2, MAT_Y + 0.15, (end.z + j.z) / 2 + 2.5);
      const curve = new THREE.CatmullRomCurve3([j, j.clone().add(new THREE.Vector3(0, 0.8, 0.6)), sag, end.clone().add(new THREE.Vector3(0, 0.6, 0)), end]);
      cable.current.geometry.dispose();
      cable.current.geometry = new THREE.TubeGeometry(curve, 60, 0.09, 8, false);
    }
  });
  const c = color === "red" ? "#c8261e" : "#1b1b1d";
  return (
    <>
      <group ref={g}>
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.035, 0.012, 0.9, 10]} />
          <meshStandardMaterial color="#d4d8dd" metalness={1} roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.14, 0.08, 0.6, 14]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.55, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.12, 20]} />
          <meshStandardMaterial color={c} roughness={0.5} />
        </mesh>
        <mesh position={[0, 3.4, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.18, 3.6, 16]} />
          <meshStandardMaterial color={c} roughness={0.45} />
        </mesh>
      </group>
      <mesh ref={cable} raycast={() => null} castShadow>
        <bufferGeometry />
        <meshStandardMaterial color={c} roughness={0.5} />
      </mesh>
    </>
  );
}

export function Multimeter() {
  const mode = useBench((s) => s.meter.mode);
  const lcd = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 220;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, t };
  }, []);
  const key = useRef("");
  const dial = useRef();
  useFrame((_, dt) => {
    const m = useBench.getState().meter;
    const r = m.reading;
    const jitter = r?.floating ? (Math.random() * 0.9).toFixed(2) : null;
    const text = m.mode === "off" ? "" : !r || r.kind === "none" ? (m.mode === "cont" ? "OL" : "0.00") : jitter ?? r.text;
    const unit = m.mode === "cont" ? "Ω" : m.mode === "dcv" ? "V⎓" : "";
    const k = `${m.mode}|${text}|${unit}|${r?.beep}`;
    if (k !== key.current && (!r?.floating || Math.random() < 0.15 || k.split("|")[0] !== key.current.split("|")[0])) {
      key.current = k;
      drawLcd(lcd.c, { text, unit, mode: m.mode === "cont" ? "通断 •))" : m.mode === "dcv" ? "直流电压 DC V" : "", beep: !!r?.beep, off: m.mode === "off" });
      lcd.t.needsUpdate = true;
    }
    if (dial.current) dial.current.rotation.y += (DIAL[m.mode] - dial.current.rotation.y) * (1 - Math.exp(-dt * 12));
  });
  const order = ["off", "dcv", "cont"];
  return (
    <group>
      <group
        name="tool:meter"
        onClick={(e) => {
          e.stopPropagation();
          const st = useBench.getState();
          st.setTool(st.tool === "meter" ? "select" : "meter");
        }}
      >
        <RoundedBox args={[7.8, 2.4, 14.2]} radius={0.6} smoothness={4} position={[METER.x, MAT_Y + 1.2, METER.z]} castShadow receiveShadow>
          <meshStandardMaterial color="#e3b21c" roughness={0.7} />
        </RoundedBox>
        <mesh position={[METER.x, METER_TOP + 0.01, METER.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[6.4, 12.6]} />
          <meshStandardMaterial color="#2b2e33" roughness={0.6} />
        </mesh>
        <mesh position={[METER.x, METER_TOP + 0.02, METER.z - 4.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[5.4, 2.32]} />
          <meshBasicMaterial map={lcd.t} toneMapped={false} />
        </mesh>
        <FlatLabel text="数字万用表（简化）" position={[METER.x, METER_TOP + 0.02, METER.z - 2.5]} height={0.42} color="#d9d9d9" />
        {[5.4].map((z) =>
          ["black", "red"].map((c, i) => (
            <group key={c} position={[METER.x + (i ? 1.4 : -1.4), METER_TOP, METER.z + z]}>
              <mesh>
                <cylinderGeometry args={[0.38, 0.38, 0.1, 20]} />
                <meshStandardMaterial color={c === "red" ? "#b81f17" : "#111"} />
              </mesh>
            </group>
          )),
        )}
        <FlatLabel text="COM" position={[METER.x - 1.4, METER_TOP + 0.02, METER.z + 6.15]} height={0.32} color="#e6e6e6" />
        <FlatLabel text="VΩ" position={[METER.x + 1.4, METER_TOP + 0.02, METER.z + 6.15]} height={0.32} color="#ff7b70" />
      </group>
      {/* 旋钮：点一下换档 */}
      <group
        position={[METER.x, METER_TOP, METER.z + 1.2]}
        name="meter:dial"
        onClick={(e) => {
          e.stopPropagation();
          const st = useBench.getState();
          st.setMeterMode(order[(order.indexOf(st.meter.mode) + 1) % order.length]);
        }}
      >
        <mesh position={[0, 0.15, 0]} castShadow>
          <cylinderGeometry args={[1.7, 1.75, 0.3, 40]} />
          <meshStandardMaterial color="#1b1c1f" roughness={0.5} />
        </mesh>
        <group ref={dial} position={[0, 0.32, 0]}>
          <mesh>
            <boxGeometry args={[0.55, 0.32, 3.2]} />
            <meshStandardMaterial color="#2c2e33" roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.17, -1.35]}>
            <boxGeometry args={[0.12, 0.02, 0.5]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        <FlatLabel text="OFF" position={[0, 0.02, -2.15]} height={0.34} color={mode === "off" ? "#ffd75a" : "#cfcfcf"} />
        <FlatLabel text="V⎓" position={[-1.55, 0.02, -1.6]} height={0.4} color={mode === "dcv" ? "#ffd75a" : "#cfcfcf"} />
        <FlatLabel text="•))" position={[1.55, 0.02, -1.6]} height={0.4} color={mode === "cont" ? "#ffd75a" : "#cfcfcf"} />
      </group>
      <Probe color="red" />
      <Probe color="black" />
    </group>
  );
}

// ---------------- USB‑C 线 ----------------
export function UsbCable() {
  const usb = useBench((s) => s.usb);
  const parts = useBench((s) => s.parts);
  const esp = parts.find((p) => p.type === "esp32");
  const geo = useMemo(() => {
    const y = FEATHER_STANDOFF + 0.32;
    let plug;
    let dir;
    if (usb && esp) {
      plug = new THREE.Vector3(...localToWorld(esp, [-3.15, y, 0]));
      const d = localToWorld({ x: 0, z: 0, rot: esp.rot || 0 }, [-1, 0, 0]);
      dir = new THREE.Vector3(d[0], 0, d[2]);
    } else {
      plug = new THREE.Vector3(-12.6, MAT_Y + 0.28, 9.2);
      dir = new THREE.Vector3(-1, 0, 0.2).normalize();
    }
    const start = plug.clone().add(dir.clone().multiplyScalar(0.55));
    const tail = new THREE.Vector3(-21.5, MAT_Y + 0.15, 10.5);
    const curve = new THREE.CubicBezierCurve3(start, start.clone().add(dir.clone().multiplyScalar(3)), tail.clone().add(new THREE.Vector3(4, 0, -1)), tail);
    return { plug, dir, tube: new THREE.TubeGeometry(curve, 50, 0.16, 10, false) };
  }, [usb, esp]);
  useEffect(() => () => geo.tube.dispose(), [geo]);
  const yaw = Math.atan2(-geo.dir.z, geo.dir.x);
  return (
    <group
      name="usb"
      onClick={(e) => {
        e.stopPropagation();
        useBench.getState().toggleUsb();
      }}
      onPointerOver={() => (document.body.style.cursor = "pointer")}
      onPointerOut={() => (document.body.style.cursor = "")}
    >
      <group name="usb:plug" position={geo.plug} rotation={[0, yaw, 0]}>
        <RoundedBox args={[1.0, 0.55, 0.8]} radius={0.12} smoothness={3} castShadow>
          <meshStandardMaterial color="#e9e9ea" roughness={0.45} />
        </RoundedBox>
        <mesh position={[-0.62, 0, 0]}>
          <boxGeometry args={[0.3, 0.25, 0.85]} />
          <meshStandardMaterial color="#c8ccd2" metalness={1} roughness={0.25} />
        </mesh>
      </group>
      <mesh geometry={geo.tube} castShadow>
        <meshStandardMaterial color="#efefef" roughness={0.5} />
      </mesh>
    </group>
  );
}

export function DeskTools() {
  return (
    <group>
      <Iron />
      <SolderSpool />
      <FluxPen />
      <WickRoll />
      <Pump />
      <Screwdriver />
      <Stripper />
      <Multimeter />
      <UsbCable />
    </group>
  );
}
