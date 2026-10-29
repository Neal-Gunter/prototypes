import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { engine } from "../assembly/engine.js";
import { getEntry, toDef } from "../assembly/catalog.js";
import { runDemo } from "../assembly/demo.js";
import AsmScene from "../assembly/ui/AsmScene.jsx";
import PartsBrowser from "../assembly/ui/PartsBrowser.jsx";

export const ASM_SIMPLIFICATIONS = [
  "碰撞形状是若干个方块（从 CAD 包围盒和几何体里提取），不是逐三角形网格；圆柱、六角螺母等按方块近似",
  "拖拽是速度控制的：拖得很快时，接触处会有不超过约 0.3 mm 的瞬时压入，松手后会被推开",
  "被推的低矮零件有时会被拖着的零件“骑”过去（被挤到上面），而不是一直被推着走",
  "螺纹不建模：拧螺丝 = 沿轴向按螺距前进 + 扭矩阈值（拧紧 / 滑丝），手感是简化的",
  "插接（排针、面包板、杜邦、USB、JST）按特征点对齐吸附，不模拟插拔力和弹片",
  "导线是一串胶囊刚体组成的绳子，没有弯曲刚度",
  "质量多为估算（碰撞盒体积 × 材料密度），标“估算”的尺寸没有查到原始资料",
  "焊接只判断“烙铁下面有穿过针脚的焊盘孔 + 按住时间”，有没有助焊剂只改变所需时间",
];
const TOOLS = [
  { k: "hand", zh: "手", tip: "左键拖动零件；右键按住 = 用手拧铜柱 / 螺母（Shift 反拧）" },
  { k: "screwdriver", zh: "螺丝刀", tip: "按住螺丝拧紧，Shift + 按住 拧松" },
  { k: "iron", zh: "烙铁", tip: "按住穿过针脚的焊盘孔焊接" },
];

export default function AssemblyPage() {
  const [ready, setReady] = useState(false);
  const [uids, setUids] = useState([]);
  const [tool, setTool] = useState("hand");
  const [debug, setDebug] = useState(false);
  const [flux, setFlux] = useState(true);
  const [flip, setFlip] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [pen, setPen] = useState(null);
  const [demo, setDemo] = useState(null);
  const [sel, setSel] = useState(null);
  const vis = useRef({ kind: null, pos: new THREE.Vector3() });
  const stopRef = useRef(false);
  const tick = useRef(0);

  useEffect(() => {
    document.title = "装配台 · 硬件工作台";
    let off = () => {};
    engine.init().then(() => {
      off = engine.on(() => {
        setUids([...engine.parts.keys()]);
        setToasts(engine.toasts);
      });
      setUids([...engine.parts.keys()]);
      setReady(true);
      window.__asm = { engine, overlapTest: () => engine.overlapTest(), snapshot: () => engine.snapshot() };
    });
    return () => { off(); stopRef.current = true; };
  }, []);

  const onTick = useCallback(() => {
    if (++tick.current % 20) return;
    const o = engine.overlapTest();
    setPen((p) => ({ now: o.maxPenetrationMm, max: Math.max(p?.max || 0, o.maxPenetrationMm), pair: o.worstPair, n: o.contacts }));
  }, []);

  const add = async (id) => {
    const e = await getEntry(id);
    const x = (Math.random() - 0.5) * 30, z = -12 + Math.random() * 4;
    engine.addPart(toDef(e, flip && /pinheader/.test(id)), { p: new THREE.Vector3(x, 0.02, z), q: new THREE.Quaternion() });
  };
  const clear = () => {
    stopRef.current = true;
    for (const c of [...engine.cables]) engine.removeCable(c.id);
    for (const u of [...engine.parts.keys()]) if (engine.parts.has(u)) engine.removePart(u);
    setPen(null);
  };
  const play = async () => {
    clear();
    await new Promise((r) => setTimeout(r, 120));
    stopRef.current = false;
    engine.extDrive = true;
    setDemo({ text: "开始演示…", i: 0 });
    const ok = await runDemo(engine, {
      // 演示时由脚本推进物理（每帧 2 步 = 60 fps 时实时），慢机器上只是变慢，步骤结果不变
      run: async (s) => {
        let k = Math.round(s * 120);
        while (k > 0 && !stopRef.current) {
          const m = Math.min(window.__asmSpeed || 2, k);
          for (let i = 0; i < m; i++) engine.update(1 / 120);
          k -= m;
          await new Promise((r) => requestAnimationFrame(r));
        }
      },
      say: (text, i) => setDemo({ text, i }),
      stop: () => stopRef.current,
      showTool: (kind, pos) => { vis.current = { kind, pos: pos || vis.current.pos }; },
    });
    engine.extDrive = false;
    setDemo({ text: ok ? "演示完成：全部步骤走的是同一套碰撞和装配规则" : "演示已停止", done: true });
  };
  const pickTool = (k) => {
    setTool(k);
    vis.current = { kind: null, pos: vis.current.pos };
  };

  return (
    <section className="flex flex-col gap-3 px-3 py-3 lg:h-[calc(100vh-7.5rem)] lg:flex-row" data-testid="assembly">
      <aside className="flex min-h-0 flex-col gap-2 lg:w-80">
        <h1 className="text-xl font-medium">装配台 <span className="ml-1 border border-copper px-1.5 py-0.5 align-middle text-xs text-copper">早期原型，简化仿真</span></h1>
        <p className="text-xs leading-5 text-ink-soft">零件有真实尺寸（毫米），由 Rapier 刚体引擎做碰撞：零件不会互相穿过去，拖着的零件会被挡住或推开别的零件。</p>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={flip} onChange={(e) => setFlip(e.target.checked)} />排针翻面放（长针朝下，用来插面包板）</label>
        <PartsBrowser compact onAdd={add} onPick={setSel} />
        <Link to="/parts" className="text-xs underline">打开完整零件库（看尺寸、孔位、许可）</Link>
      </aside>
      <div className="relative min-h-[60vh] flex-1 border border-line bg-paper-2">
        {ready ? <AsmScene uids={uids} tool={tool} debug={debug} flux={flux} vis={vis} onTick={onTick} onSelect={setSel} /> : <p className="p-6 text-ink-soft">正在加载物理引擎…</p>}
        <div className="pointer-events-none absolute left-2 top-2 flex max-w-md flex-col gap-1" aria-live="polite" data-testid="toasts">
          {demo && <div className="bg-ink/85 px-2 py-1 text-sm text-paper-2" data-testid="demo-step">{demo.text}</div>}
          {toasts.map((t) => (
            <div key={t.id} className={`px-2 py-1 text-sm ${t.kind === "error" ? "bg-red-700 text-white" : t.kind === "warn" ? "bg-amber-200 text-ink" : t.kind === "ok" ? "bg-emerald-700 text-white" : "bg-white/90 text-ink"}`}>{t.text}</div>
          ))}
        </div>
        <div className="absolute bottom-2 left-2 bg-white/90 px-2 py-1 font-mono text-xs" data-testid="pen-readout">
          穿透检测：当前最深 {pen ? pen.now.toFixed(3) : "—"} mm · 本次最深 {pen ? pen.max.toFixed(3) : "—"} mm（阈值 0.1 mm）· 零件 {uids.length}
        </div>
      </div>
      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto text-sm lg:w-80">
        <fieldset>
          <legend className="font-medium">工具</legend>
          <div className="mt-1 flex gap-1">
            {TOOLS.map((t) => (
              <button key={t.k} type="button" onClick={() => pickTool(t.k)} aria-pressed={tool === t.k} className={`min-h-9 flex-1 border px-2 ${tool === t.k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`} data-testid={`tool-${t.k}`}>{t.zh}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-soft">{TOOLS.find((t) => t.k === tool).tip}</p>
          {tool === "iron" && <label className="mt-1 flex items-center gap-2 text-xs"><input type="checkbox" checked={flux} onChange={(e) => setFlux(e.target.checked)} />先涂助焊剂（不涂：焊得慢 2 倍多，提示可能虚焊）</label>}
        </fieldset>
        <div className="text-xs leading-5 text-ink-soft">
          <p className="font-medium text-ink">操作</p>
          <p>拖动时：滚轮或 Q / E 抬高 / 放低，R 转 90°（Shift+R 反转），按住 Shift 拖 = 用力推开挡路的零件。空白处拖动 = 转视角。</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={play} disabled={!ready || (demo && !demo.done)} className="min-h-9 border border-ink px-3 hover:bg-ink hover:text-paper-2 disabled:opacity-50" data-testid="demo-btn">自动装配演示</button>
          <button type="button" onClick={() => { stopRef.current = true; }} className="min-h-9 border border-line bg-white px-3">停止</button>
          <button type="button" onClick={clear} className="min-h-9 border border-line bg-white px-3" data-testid="clear-btn">清空桌面</button>
        </div>
        <label className="flex items-center gap-2"><input type="checkbox" checked={debug} onChange={(e) => setDebug(e.target.checked)} data-testid="debug-toggle" />显示碰撞盒（调试）</label>
        {pen?.pair && pen.now > 0.01 && <p className="text-xs text-ink-soft">最深的一对：{pen.pair.join(" ↔ ")}</p>}
        <details open className="text-xs leading-5">
          <summary className="cursor-pointer font-medium">这里简化了什么</summary>
          <ul className="mt-1 list-disc pl-4 text-ink-soft">{ASM_SIMPLIFICATIONS.map((s) => <li key={s}>{s}</li>)}</ul>
        </details>
        {sel && <p className="text-xs text-ink-soft">选中：{engine.parts.get(sel)?.def.name_zh || sel}</p>}
      </aside>
    </section>
  );
}
