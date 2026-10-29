import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { createPhysicsBackendSync, SEGMENTS, TENTACLES } from "../physics";
import { sim } from "../sim";
import { useBench } from "../store";

const SEG_LEN = 0.42;

function Tentacle({ index, segRefs, driven }) {
  const yaw = (index / TENTACLES) * Math.PI * 2;
  const color = driven ? "#c6612c" : "#8f8a80";
  // 嵌套的节：每一节都是上一节的子物体
  let node = null;
  for (let j = SEGMENTS - 1; j >= 0; j--) {
    const r0 = 0.22 * (1 - j / (SEGMENTS + 2));
    const r1 = 0.22 * (1 - (j + 1) / (SEGMENTS + 2));
    node = (
      <group ref={(el) => (segRefs.current[index * SEGMENTS + j] = el)} position={j === 0 ? [0, 0, 0] : [SEG_LEN, 0, 0]}>
        <mesh position={[SEG_LEN / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[r1, r0, SEG_LEN + 0.02, 12]} />
          <meshStandardMaterial color={color} roughness={0.55} />
        </mesh>
        {node}
      </group>
    );
  }
  return (
    <group rotation={[0, yaw, 0]}>
      <group position={[1.0, 0.9, 0]}>{node}</group>
    </group>
  );
}

function Robot() {
  const backend = useMemo(() => createPhysicsBackendSync(), []);
  const segRefs = useRef([]);
  const parts = useBench((s) => s.parts);
  const servoIds = parts.filter((p) => p.type === "servo").map((p) => p.id).sort();
  useFrame((_, dt) => {
    const drives = new Array(TENTACLES).fill(null);
    for (const id of servoIds) {
      const k = Number(id.replace("servo", "")) - 1;
      const a = sim.servoAngle[id];
      if (a != null) drives[k] = THREE.MathUtils.degToRad(a - 90) * 0.6;
    }
    backend.step(dt, drives);
    const { bend } = backend.getPose();
    for (let i = 0; i < segRefs.current.length; i++) {
      const g = segRefs.current[i];
      if (g) g.rotation.z = -bend[i];
    }
  });
  return (
    <group position={[0, 1.2, 0]}>
      <mesh position={[0, 1.1, 0]} scale={[1.3, 1.0, 1.3]}>
        <sphereGeometry args={[1.1, 32, 24]} />
        <meshStandardMaterial color="#b45324" roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.35, 32]} />
        <meshStandardMaterial color="#1b1814" roughness={0.6} />
      </mesh>
      {Array.from({ length: TENTACLES }, (_, i) => (
        <Tentacle key={i} index={i} segRefs={segRefs} driven={servoIds.includes(`servo${i + 1}`)} />
      ))}
    </group>
  );
}

export default function RobotScene() {
  return (
    <Canvas camera={{ position: [7.5, 5, 10], fov: 42 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
      <color attach="background" args={["#f7f3ea"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 6]} intensity={1.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.2, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshStandardMaterial color="#e2d8c5" />
      </mesh>
      <Robot />
      <OrbitControls target={[0, 0.6, 0]} enablePan={false} minDistance={6} maxDistance={25} />
    </Canvas>
  );
}
