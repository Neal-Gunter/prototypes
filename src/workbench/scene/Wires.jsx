import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useBench } from "../store";
import { pinWorld } from "./geom";

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const INS_R = 0.05; // 24 AWG 硅胶线外径约 1 mm
const CU_R = 0.024;

// 一个线头：返回 绝缘皮结束点、离开方向、裸铜线段
function endGeom(parts, wire, e) {
  const pw = pinWorld(parts, wire[e]);
  if (!pw) return null;
  const strip = wire.strip?.[e] || "ok";
  const bare = strip !== "none";
  const P = V(pw.pos);
  const D = V(pw.dir).normalize();
  if (wire.loose === e) {
    // 拆下来的线头：翘在焊盘上方
    const out = pw.meta.kind === "tht" ? new THREE.Vector3(0.25, 0.9, 0.3) : D.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.7, 0));
    const tip = P.clone().add(out);
    return { ins: tip.clone().add(new THREE.Vector3(0, 0.25, 0)), dir: new THREE.Vector3(0, 1, 0), cu: bare ? [tip, tip.clone().add(new THREE.Vector3(0, 0.25, 0))] : null, loose: true };
  }
  if (pw.meta.kind === "tht") {
    // 线头竖着插进排针孔，裸铜从孔里伸到上面 2.5 mm
    const bottom = P.clone().add(new THREE.Vector3(0, -0.2, 0));
    const ins = P.clone().add(new THREE.Vector3(0, bare ? 0.25 : 0.03, 0));
    return { ins, dir: D, cu: bare ? [bottom, ins] : null };
  }
  // 和舵机/电池线头对焊：导线并排压在镀锡线头上，从末端继续往外走
  const side = new THREE.Vector3(-D.z, 0, D.x).multiplyScalar(0.045);
  const back = P.clone().add(D.clone().multiplyScalar(-0.22)).add(side).add(new THREE.Vector3(0, 0.03, 0));
  const ins = P.clone().add(D.clone().multiplyScalar(bare ? 0.06 : -0.18)).add(side).add(new THREE.Vector3(0, 0.03, 0));
  return { ins, dir: D, cu: bare ? [back, ins] : null };
}

export function Wire({ wire, parts }) {
  const tool = useBench((s) => s.tool);
  const [hot, setHot] = useState(false);
  const g = useMemo(() => {
    const A = endGeom(parts, wire, "a");
    const B = endGeom(parts, wire, "b");
    if (!A || !B) return null;
    const dist = A.ins.distanceTo(B.ins);
    const k = Math.min(3.2, 0.5 + dist * 0.28);
    const c1 = A.ins.clone().add(A.dir.clone().multiplyScalar(k)).add(new THREE.Vector3(0, A.dir.y > 0.5 ? 0 : 0.6, 0));
    const c2 = B.ins.clone().add(B.dir.clone().multiplyScalar(k)).add(new THREE.Vector3(0, B.dir.y > 0.5 ? 0 : 0.6, 0));
    const curve = new THREE.CubicBezierCurve3(A.ins, c1, c2, B.ins);
    const tube = new THREE.TubeGeometry(curve, 64, INS_R, 10, false);
    const cus = [A.cu, B.cu].filter(Boolean).map(([p, q]) => new THREE.TubeGeometry(new THREE.LineCurve3(p, q), 1, CU_R, 8, false));
    return { tube, cus, caps: [A.ins, B.ins] };
  }, [wire, parts]);
  useEffect(
    () => () => {
      g?.tube.dispose();
      g?.cus.forEach((c) => c.dispose());
    },
    [g],
  );
  if (!g) return null;
  const nick = wire.strip && Object.values(wire.strip).includes("nick");
  return (
    <group>
      <mesh
        geometry={g.tube}
        name={`wire:${wire.id}`}
        castShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          if (tool === "strip" || tool === "select") setHot(true);
        }}
        onPointerOut={() => setHot(false)}
        onClick={(e) => {
          const s = useBench.getState();
          if (s.tool !== "strip") return;
          e.stopPropagation();
          s.stripWire(wire.id);
        }}
        onDoubleClick={(e) => {
          if (useBench.getState().tool !== "select") return;
          e.stopPropagation();
          useBench.getState().removeWire(wire.id);
        }}
      >
        <meshStandardMaterial color={wire.color} roughness={0.42} emissive={hot ? "#ffb070" : "#000"} emissiveIntensity={hot ? 0.35 : 0} />
      </mesh>
      {g.caps.map((p, i) => (
        <mesh key={i} position={p} raycast={() => null}>
          <sphereGeometry args={[INS_R, 10, 8]} />
          <meshStandardMaterial color={wire.color} roughness={0.42} />
        </mesh>
      ))}
      {g.cus.map((c, i) => (
        <mesh key={`c${i}`} geometry={c} raycast={() => null}>
          <meshStandardMaterial color={nick ? "#b77a45" : "#cf8f55"} metalness={1} roughness={0.32} />
        </mesh>
      ))}
    </group>
  );
}
