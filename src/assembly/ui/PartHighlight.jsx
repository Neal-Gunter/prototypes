// 零件悬停 / 焦点描边：背面膨胀壳 + 边线。自有材质，不改 MAT，不参与射线/物理。
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { highlightBox } from "./partTip.js";

const noRay = () => {};
const COL = { hover: "#2F4E70", focus: "#1868B0" };

export default function PartHighlight({ def, mode, reduced }) {
  const box = useMemo(() => highlightBox(def), [def]);
  const shell = useMemo(() => new THREE.MeshBasicMaterial({
    color: COL[mode] || COL.hover, transparent: true, opacity: mode === "focus" ? 0.22 : 0.16, depthWrite: false, side: THREE.BackSide,
  }), [mode]);
  const line = useMemo(() => new THREE.LineBasicMaterial({
    color: COL[mode] || COL.hover, transparent: true, opacity: 0.95, depthTest: true,
  }), [mode]);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(box.s[0], box.s[1], box.s[2])), [box]);
  const t = useRef(0);
  useFrame((_, dt) => {
    if (reduced || mode !== "focus") return;
    t.current += dt;
    shell.opacity = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(t.current * 3.2));
  });
  useEffect(() => () => { shell.dispose(); line.dispose(); edges.dispose(); }, [shell, line, edges]);
  if (!mode) return null;
  return (
    <group position={box.c} userData={{ hl: mode }} raycast={noRay}>
      <mesh raycast={noRay} renderOrder={8}>
        <boxGeometry args={box.s} />
        <primitive object={shell} attach="material" />
      </mesh>
      <lineSegments geometry={edges} raycast={noRay} renderOrder={9}>
        <primitive object={line} attach="material" />
      </lineSegments>
    </group>
  );
}
