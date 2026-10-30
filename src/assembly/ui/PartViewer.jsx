// v20：零件 3D 预览 + 尺寸标尺叠加（单位 cm 场景，标注按 mm）。早期原型，简化仿真。
import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html, Line } from "@react-three/drei";
import { getEntry, toDef } from "../catalog.js";
import { ProcMesh, Glb } from "./partMeshes.jsx";

function tickStep(mm) { return mm <= 12 ? 1 : mm <= 60 ? 5 : mm <= 250 ? 10 : 50; }
function Axis({ from, dir, len, label, side }) {
  // drei Html 在 Canvas 首帧和其它 Html 同时挂载时偶尔丢第一个标签（v20 走查发现“长”不显示）：挂载后下一拍再放标签
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 30); return () => clearTimeout(t); }, []);
  // len 单位 cm；每 tickStep mm 一个刻度
  const mm = len * 10, st = tickStep(mm);
  const pts = [from, from.map((v, i) => v + dir[i] * len)];
  const ticks = [];
  for (let t = 0; t <= mm + 1e-6; t += st) {
    const p = from.map((v, i) => v + dir[i] * t / 10);
    const big = Math.round(t) % (st * 5) === 0;
    const q = p.map((v, i) => v + side[i] * (big ? 0.25 : 0.12) * Math.max(0.4, len / 6));
    ticks.push(<Line key={t} points={[p, q]} color="#b45309" lineWidth={1} />);
  }
  const mid = from.map((v, i) => v + dir[i] * len / 2 + side[i] * 0.5 * Math.max(0.5, len / 5));
  return (
    <group>
      <Line points={pts} color="#b45309" lineWidth={2} />
      {ticks}
      {on && <Html position={mid} center zIndexRange={[20, 0]}><span className="pointer-events-none select-none whitespace-nowrap rounded bg-white/90 px-1 text-[11px] text-amber-800" data-testid="ruler-label">{label}</span></Html>}
    </group>
  );
}
function Ruler({ d }) {
  const X = d.x / 10, Y = d.y / 10, Z = d.z / 10;
  const o = [-X / 2, 0, Z / 2 + 0.15];
  return (
    <group>
      <Axis from={o} dir={[1, 0, 0]} len={X} side={[0, 0, 1]} label={`长 ${d.x} mm`} />
      <Axis from={[X / 2 + 0.15, 0, Z / 2]} dir={[0, 0, -1]} len={Z} side={[1, 0, 0]} label={`宽 ${d.z} mm`} />
      <Axis from={[-X / 2 - 0.15, 0, Z / 2]} dir={[0, 1, 0]} len={Y} side={[-1, 0, 0]} label={`高 ${d.y} mm`} />
    </group>
  );
}
export default function PartViewer({ id }) {
  const [def, setDef] = useState(null);
  const [ruler, setRuler] = useState(true);
  useEffect(() => { setDef(null); if (id) getEntry(id).then((e) => setDef(e ? toDef(e) : null)).catch(() => setDef(null)); }, [id]);
  const d = def?.dims_mm;
  const cam = useMemo(() => { const m = d ? Math.max(d.x, d.y, d.z) / 10 : 5; return [m * 1.9, m * 1.5, m * 2.4]; }, [d]);
  if (!def) return <div className="flex aspect-square w-full items-center justify-center border border-line bg-paper-2 text-xs text-ink-soft">加载模型…</div>;
  return (
    <div className="relative" data-testid="part-viewer">
      <div className="aspect-square w-full border border-line bg-white">
        <Canvas key={id} camera={{ position: cam, fov: 35, near: 0.01, far: 500 }} dpr={[1, 1.5]} frameloop="demand">
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 6]} intensity={1.4} />
          <Suspense fallback={null}>
            {def.kind === "glb" ? <Glb def={def} /> : <ProcMesh def={def} />}
          </Suspense>
          {ruler && <Ruler d={d} />}
          <gridHelper args={[Math.ceil(Math.max(d.x, d.z) / 10) * 2 + 2, (Math.ceil(Math.max(d.x, d.z) / 10) * 2 + 2), "#cbd5e1", "#e2e8f0"]} />
          <OrbitControls makeDefault target={[0, d.y / 20, 0]} />
        </Canvas>
      </div>
      <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
        <span>网格 1 格 = 10 mm；刻度 {tickStep(Math.max(d.x, d.y, d.z))} mm</span>
        <button type="button" onClick={() => setRuler((r) => !r)} aria-pressed={ruler} className="border border-line px-2 py-0.5" data-testid="ruler-toggle">{ruler ? "隐藏标尺" : "显示标尺"}</button>
      </div>
    </div>
  );
}
