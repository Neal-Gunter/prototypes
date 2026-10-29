import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { pinId, pinsOfType, splitPinId } from "../parts";
import { MELT, useBench } from "../store";
import { sim } from "../sim";
import { sceneApi } from "./api";

// ---------- 焊点几何（共用） ----------
// 直插焊盘上的好焊点：围着线头的小“火山”，边缘薄薄地贴住焊盘（凹形润湿角）
function filletGeo(seed = 0) {
  const pts = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(0.03 + 0.062 * Math.pow(1 - t, 2.2), t * 0.12));
  }
  pts.push(new THREE.Vector2(0.0, 0.125));
  const g = new THREE.LatheGeometry(pts, 28);
  void seed;
  return g;
}
const FILLET = filletGeo();
// 虚焊：一颗灰球“蹲”在焊盘上，边缘没贴住
const COLD = (() => {
  const g = new THREE.IcosahedronGeometry(0.075, 2);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = 1 + 0.12 * Math.sin(v.x * 90) * Math.cos(v.z * 80) + 0.06 * Math.sin(v.y * 130);
    v.multiplyScalar(n);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
})();
const SPLICE = new THREE.SphereGeometry(1, 20, 14);
const RING = new THREE.RingGeometry(0.15, 0.2, 28);
const DISC = new THREE.CircleGeometry(1, 28);

const M = {
  good: new THREE.MeshStandardMaterial({ color: "#d9dde1", metalness: 1, roughness: 0.12 }),
  cold: new THREE.MeshStandardMaterial({ color: "#8e918f", metalness: 0.55, roughness: 0.78 }),
  molten: new THREE.MeshStandardMaterial({ color: "#f2f4f6", metalness: 1, roughness: 0.04 }),
  burnt: new THREE.MeshStandardMaterial({ color: "#1a0f08", roughness: 1, transparent: true, opacity: 0.85, depthWrite: false }),
  scorch: new THREE.MeshBasicMaterial({ color: "#7a5a22", transparent: true, opacity: 0.35, depthWrite: false }),
  flux: new THREE.MeshStandardMaterial({ color: "#d79a2b", roughness: 0.1, transparent: true, opacity: 0.55, depthWrite: false }),
  copper: new THREE.MeshStandardMaterial({ color: "#c98a4b", metalness: 1, roughness: 0.35 }),
};

function JointShape({ state, vol, kind, dir, bridgeVec, mat }) {
  const s = Math.max(0.35, Math.min(1.6, vol || 0.8));
  if (kind === "lead") {
    // 对焊：锡包住两根并排的线头，沿线方向拉长
    const yaw = Math.atan2(dir[0], dir[2]);
    const col = state === "cold" ? COLD : SPLICE;
    const sc = state === "cold" ? [1.0, 0.9, 2.2].map((v) => v * (0.7 + 0.3 * s)) : [0.062 * (0.75 + 0.25 * s), 0.055 * (0.75 + 0.25 * s), 0.2];
    return (
      <mesh geometry={col} material={mat} rotation={[0, yaw, 0]} position={[-dir[0] * 0.08, 0.02, -dir[2] * 0.08]} scale={sc} castShadow />
    );
  }
  if (state === "cold")
    return <mesh geometry={COLD} material={mat} position={[0, 0.07, 0]} scale={[1, 0.85 * (0.75 + 0.25 * s), 1]} />;
  return (
    <group>
      <mesh geometry={FILLET} material={mat} scale={[0.85 + 0.15 * s, 0.55 + 0.45 * s, 0.85 + 0.15 * s]} />
      {bridgeVec && (
        <mesh material={mat} position={[bridgeVec[0] / 2, 0.05, bridgeVec[2] / 2]} rotation={[0, -Math.atan2(bridgeVec[2], bridgeVec[0]), Math.PI / 2]}>
          <capsuleGeometry args={[0.06, Math.hypot(bridgeVec[0], bridgeVec[2]) - 0.08, 4, 10]} />
        </mesh>
      )}
    </group>
  );
}

// ---------- 一个引脚：点击区 + 焊点 + 提示环 ----------
export function Pin({ part, pin }) {
  const id = pinId(part.id, pin.name);
  const joint = useBench((s) => s.joints[id]);
  const pending = useBench((s) => s.pendingPin === id || (s.pendingMove && pendingEnd(s) === id));
  const hint = useBench((s) => s.hintPins?.includes(id));
  const live = useBench((s) => s.op?.pin === id);
  const tool = useBench((s) => s.tool);
  const hover = useRef();
  const ring = useRef();
  useFrame(({ clock }) => {
    if (hover.current) hover.current.visible = sim.hoverPin === id && tool !== "select";
    if (ring.current) ring.current.material.opacity = 0.55 + 0.4 * Math.sin(clock.elapsedTime * 5);
  });
  const st = joint?.state || "none";
  const isTht = pin.kind === "tht";
  const dir = pin.kind === "lead" ? (part.type === "servo" ? [0, 0, 1] : [1, 0, 0]) : [0, 1, 0];
  let bridgeVec = null;
  if (st === "bridge" && joint.bridgeTo && joint.bridgeTo > id) {
    const [, n] = splitPinId(joint.bridgeTo);
    const other = pinOf(part, n);
    if (other) bridgeVec = [other.local[0] - pin.local[0], 0, other.local[2] - pin.local[2]];
  }
  const hasSolder = !live && (joint?.vol || 0) > 0.05 && st !== "burnt";
  const yLift = isTht ? 0 : 0;
  const r = isTht ? 0.11 : 0.15;
  return (
    <group position={pin.local}>
      {hasSolder && (
        <group position={[0, yLift, 0]}>
          <JointShape state={st} vol={joint.vol} kind={pin.kind} dir={dir} bridgeVec={bridgeVec} mat={st === "cold" ? M.cold : M.good} />
        </group>
      )}
      {st === "burnt" && (
        <group>
          <mesh geometry={DISC} material={M.burnt} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} scale={0.2} />
          {/* 翘起来的铜箔 */}
          <mesh material={M.copper} position={[0.06, 0.04, 0]} rotation={[0, 0, 0.5]}>
            <torusGeometry args={[0.075, 0.015, 6, 20, Math.PI * 1.4]} />
          </mesh>
        </group>
      )}
      {joint?.damage > 2.5 && st !== "burnt" && (
        <mesh geometry={DISC} material={M.scorch} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} scale={0.17} />
      )}
      {joint?.flux && <mesh geometry={DISC} material={M.flux} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} scale={0.13} />}
      {(hint || pending) && (
        <mesh ref={ring} geometry={RING} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} raycast={() => null}>
          <meshBasicMaterial color={pending ? "#ff9b54" : "#5dff9e"} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={hover} geometry={RING} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} scale={0.75} visible={false} raycast={() => null}>
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* 点击区（比焊盘略大，方便点中 2.54 mm 间距的排针孔） */}
      <mesh
        name={`pin:${id}`}
        position={[0, 0.03, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          const s = useBench.getState();
          if (["iron", "wick", "pump"].includes(s.tool)) {
            if (sceneApi.controls) sceneApi.controls.enabled = false;
            s.startOp(id);
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          const s = useBench.getState();
          if (!["iron", "wick", "pump"].includes(s.tool)) s.clickPin(id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          sim.hoverPin = id;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (sim.hoverPin === id) sim.hoverPin = null;
          document.body.style.cursor = "";
        }}
      >
        <sphereGeometry args={[r, 10, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

function pendingEnd(s) {
  const w = s.wires.find((x) => x.id === s.pendingMove.wireId);
  return w ? w[s.pendingMove.end] : null;
}

function pinOf(part, name) {
  return pinsOfType(part.type).find((p) => p.name === name);
}

// ---------- 正在焊的焊点：每帧跟着 sim.op 变 ----------
export function LiveJoint() {
  const g = useRef();
  const fil = useRef();
  const wick = useRef();
  useFrame(({ clock }) => {
    const o = sim.op;
    if (!g.current) return;
    if (!o) {
      g.current.visible = false;
      return;
    }
    g.current.visible = true;
    g.current.position.set(o.world[0], o.world[1], o.world[2]);
    const molten = o.T >= MELT;
    const v = Math.max(0, o.vol);
    const s = Math.min(1.7, v);
    if (fil.current) {
      fil.current.visible = v > 0.05;
      const wob = molten ? 1 + 0.03 * Math.sin(clock.elapsedTime * 22) : 1;
      if (o.meta.kind === "tht") {
        fil.current.geometry = molten ? FILLET : COLD;
        fil.current.position.y = molten ? 0 : 0.07;
        fil.current.scale.set((0.6 + 0.3 * s) * wob, 0.3 + 0.55 * s, (0.6 + 0.3 * s) * wob);
      } else {
        fil.current.geometry = SPLICE;
        fil.current.position.y = 0.02;
        fil.current.scale.set(0.05 + 0.02 * s, 0.045 + 0.018 * s, 0.12 + 0.1 * s);
      }
      fil.current.material = molten ? M.molten : M.cold;
    }
    if (wick.current) wick.current.visible = o.kind === "wick";
  });
  return (
    <group ref={g} visible={false}>
      <mesh ref={fil} geometry={FILLET} material={M.molten} raycast={() => null} />
      <mesh ref={wick} position={[0.55, 0.045, 0.2]} rotation={[0, -0.35, 0]} raycast={() => null} castShadow>
        <boxGeometry args={[1.5, 0.04, 0.25]} />
        <meshStandardMaterial color="#c47c43" metalness={1} roughness={0.45} />
      </mesh>
    </group>
  );
}

export { M as JOINT_MATS };
