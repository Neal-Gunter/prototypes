// v29（我的补充）：拆解模式的交互爆炸图 —— 复用零件库 3D 预览的 ProcMesh / Glb；滑块控制拆开程度。
// 模块位置是示意（估算），不是实测装配尺寸。早期原型，简化仿真。
import { Component, Suspense, useEffect, useState } from "react";
import { pub } from "../lib/base.js";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { getEntry, toDef } from "../assembly/catalog.js";
import { ProcMesh, Glb } from "../assembly/ui/partMeshes.jsx";

// 模型加载失败（比如网络问题）时退回一个示意方块，不让整页崩掉
class Fallback extends Component {
  constructor(p) { super(p); this.state = { bad: false }; }
  static getDerivedStateFromError() { return { bad: true }; }
  componentDidCatch() {}
  render() {
    if (!this.state.bad) return this.props.children;
    const d = this.props.dims || { x: 10, y: 10, z: 10 };
    return <mesh position={[0, d.y / 20, 0]}><boxGeometry args={[d.x / 10, d.y / 10, d.z / 10]} /><meshStandardMaterial color="#9aa3ad" wireframe /></mesh>;
  }
}
function Module({ m, def, k, label, hi, onHover }) {
  const p = m.ex.p.map((v, i) => v + m.ex.d[i] * k);
  const H = (def.dims_mm?.y || 10) / 10;
  return (
    <group position={p} rotation={[m.ex.rx || 0, m.ex.ry || 0, 0]} onPointerOver={(e) => { e.stopPropagation(); onHover(m.key); }} onPointerOut={() => onHover(null)}>
      <group position={[0, -H / 2, 0]} scale={hi ? 1.04 : 1}><Fallback dims={def.dims_mm}><Suspense fallback={null}>{def.kind === "glb" ? <Glb def={def} /> : <ProcMesh def={def} />}</Suspense></Fallback></group>
      {k > 0.35 && <Html position={[0, H / 2 + 0.3, 0]} center zIndexRange={[20, 0]}><span className={`pointer-events-none select-none whitespace-nowrap rounded px-1 text-[10px] ${hi ? "bg-ink text-paper" : "bg-white/85 text-ink"}`} data-testid="td-ex-label">{label}</span></Html>}
    </group>
  );
}
export default function TeardownExplode({ device, L }) {
  const [defs, setDefs] = useState({});
  const [k, setK] = useState(0.6);
  const [hov, setHov] = useState(null);
  const mods = device.modules.filter((m) => m.ex && !m.suggest);
  useEffect(() => {
    let live = true;
    Promise.all(mods.map(async (m) => { try { const d = toDef(await getEntry(m.part)); return [m.key, d.glb ? { ...d, glb: pub(d.glb) } : d]; } catch { return [m.key, null]; } }))
      .then((r) => { if (live) setDefs(Object.fromEntries(r.filter((x) => x[1]))); });
    return () => { live = false; };
  }, [device.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = Object.keys(defs).length;
  useEffect(() => { window.__tdExplode = { device: device.id, k, loaded: n, total: mods.length }; }, [device.id, k, n, mods.length]);
  return (
    <div data-testid="td-explode">
      <div className="aspect-[4/3] w-full border border-line bg-paper-2" data-testid="td-explode-canvas">
        <Canvas shadows camera={{ position: [7, 6, 9], fov: 40 }} dpr={[1, 2]}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[6, 10, 6]} intensity={1.2} castShadow />
          <Suspense fallback={null}>
            {mods.map((m) => defs[m.key] ? <Module key={m.key} m={m} def={defs[m.key]} k={k * 1.6} label={L(m.t)} hi={hov === m.key} onHover={setHov} /> : null)}
          </Suspense>
          <OrbitControls makeDefault enableDamping />
        </Canvas>
      </div>
      <label className="mt-2 flex items-center gap-2 text-sm">
        <span className="shrink-0">{L({ zh: "拆开程度", en: "Explode" })}</span>
        <input type="range" min="0" max="1" step="0.01" value={k} onChange={(e) => setK(+e.target.value)} className="w-full" data-testid="td-explode-slider" aria-label={L({ zh: "拆开程度", en: "Explode amount" })} />
        <span className="w-10 text-right font-mono text-xs">{Math.round(k * 100)}%</span>
      </label>
      <p className="mt-1 text-xs text-ink-soft" data-testid="td-explode-note">{L({ zh: `拖动旋转、滚轮缩放。${n}/${mods.length} 个模块已加载；位置和近似件形状都是示意（估算）。`, en: `Drag to rotate, scroll to zoom. ${n}/${mods.length} modules loaded. Positions and approximate parts are illustrative (estimates).` })}</p>
    </div>
  );
}
