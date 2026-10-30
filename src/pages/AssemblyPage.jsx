import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import * as THREE from "three";
import { engine } from "../assembly/engine.js";
import { getEntry, toDef } from "../assembly/catalog.js";
import { runDemo } from "../assembly/demo.js";
import AsmScene from "../assembly/ui/AsmScene.jsx";
import PartsBrowser from "../assembly/ui/PartsBrowser.jsx";
import ElecPanel from "../assembly/ui/ElecPanel.jsx";
import { elec } from "../assembly/elecStore.js";
import { PRESETS, buildFromList, parseList } from "../assembly/builder.js";
import { makeGuide } from "../assembly/guide.js";
import OctoPanel, { octoDetach, octoSim } from "../assembly/ui/OctoPanel.jsx";
import { octoGuide } from "../assembly/octopus/spec.js";

export const ASM_SIMPLIFICATIONS = [
  "碰撞形状是若干个方块（从 CAD 包围盒和几何体里提取），不是逐三角形网格；圆柱、六角螺母等按方块近似",
  "拖拽是速度控制的：拖得很快时，接触处会有不超过约 0.3 mm 的瞬时压入，松手后会被推开",
  "被推的低矮零件有时会被拖着的零件“骑”过去（被挤到上面），而不是一直被推着走",
  "螺纹不建模：拧螺丝 = 沿轴向按螺距前进 + 扭矩阈值（拧紧 / 滑丝），手感是简化的",
  "插接（排针、面包板、杜邦、USB、JST）按特征点对齐吸附，不模拟插拔力和弹片",
  "导线是一串胶囊刚体组成的绳子，没有弯曲刚度",
  "质量多为估算（碰撞盒体积 × 材料密度），标“估算”的尺寸没有查到原始资料",
  "焊接只判断“烙铁下面有穿过针脚的焊盘孔 + 按住时间”，有没有助焊剂只改变所需时间；焊点质量（合格 / 虚焊 / 连锡 / 烫坏）由按住时间、助焊剂和邻近焊盘决定，是规则判断，不是热仿真",
  "通电：台面上真实的插接和焊点 → 网表 → 直流电阻网络求解（LED 用分段线性模型，舵机按 PWM 信号直接给角度），不模拟瞬态、电容、芯片内部",
  "固件由 JS 迷你解释器运行（Arduino 风格子集），不是真实 RP2040 / ESP32 仿真；舵机转动只改画面，不推动刚体",
  "八爪鱼：md 的 C++ 固件逐行移植成 JS（协程代替 FreeRTOS 任务），I2C 写到寄存器级的 PCA9685 替身；语音、大模型、WiFi / 蓝牙都是模拟",
  "八爪鱼：电压 / 电流 / 掉电复位是估算模型；桌面爬行用二维库仑摩擦估算，3D 机身不跟着走（位移看俯视轨迹）；预设整只装好，触手之间用夹角判断碰撞",
];
const TOOLS = [
  { k: "hand", zh: "手", tip: "左键拖动零件；右键按住 = 用手拧铜柱 / 螺母（Shift 反拧）" },
  { k: "screwdriver", zh: "螺丝刀", tip: "按住螺丝拧紧，Shift + 按住 拧松" },
  { k: "iron", zh: "烙铁", tip: "按住穿过针脚的焊盘孔焊接；Shift + 按住 = 拆焊（吸掉焊锡）" },
  { k: "meter", zh: "表笔", tip: "左键 = 红表笔，右键或 Shift+左键 = 黑表笔；读数在“通电”页" },
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
  const [tab, setTab] = useState("tools");
  const [probes, setProbes] = useState({});
  const [listText, setListText] = useState(PRESETS.electrics.text);
  const [listErr, setListErr] = useState([]);
  const [params] = useSearchParams();
  const nav = useNavigate();
  const lastList = useRef(null);
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
      window.__asm = { engine, overlapTest: () => engine.overlapTest(), snapshot: () => engine.snapshot(), build: (t) => buildList(t), addAt: async (id, x, z, y = 0.02) => engine.addPart(toDef(await getEntry(id)), { p: new THREE.Vector3(x, y, z), q: new THREE.Quaternion() }) };
      const sc = params.get("scene");
      if (sc && PRESETS[sc]) { setTab("elec"); buildList(PRESETS[sc].text, PRESETS[sc].zh); }
      if (sc === "octo") setTab("octo");
      if (sc === "octoA" || sc === "octoB") { setTab("octo"); setTimeout(() => window.__octo?.build({ plan: sc.slice(4), phase: 3, fault: "none" }), 300); }
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
    octoDetach();
    stopRef.current = true;
    for (const c of [...engine.cables]) engine.removeCable(c.id);
    for (const u of [...engine.parts.keys()]) if (engine.parts.has(u)) engine.removePart(u);
    elec.reset();
    lastList.current = null;
    setProbes({});
    setPen(null);
  };
  // 物理由脚本推进（每帧 2 步 = 60 fps 时实时），慢机器上只是变慢，结果不变
  const driveRun = async (s) => {
    let k = Math.round(s * 120);
    while (k > 0 && !stopRef.current) {
      const m = Math.min(window.__asmSpeed || 2, k);
      for (let i = 0; i < m; i++) engine.update(1 / 120);
      k -= m;
      await new Promise((r) => requestAnimationFrame(r));
    }
  };
  // 按文字清单装配：和自动演示同一套插接 / 焊接 / 碰撞规则
  async function buildList(text, title = "按清单装配") {
    const pe = parseList(text).errors;
    setListErr(pe);
    if (pe.length) return { fails: pe };
    clear();
    await new Promise((r) => setTimeout(r, 120));
    stopRef.current = false;
    engine.extDrive = true;
    setDemo({ text: `${title}…`, i: 0 });
    const fast = async (s) => { if (window.__asmSpeed) return driveRun(s); let k = Math.round(s * 120); while (k-- > 0) engine.update(1 / 120); await new Promise((r) => requestAnimationFrame(r)); };
    const r = await buildFromList(engine, text, { run: fast, say: (t) => setDemo({ text: `${title}：${t}` }), stop: () => stopRef.current });
    engine.extDrive = false;
    lastList.current = { steps: r.steps, title, text };
    setListErr(r.fails);
    setDemo({ text: r.fails.length ? `${title}：完成，有 ${r.fails.length} 个问题（见右侧）` : `${title}：完成（${engine.parts.size} 个零件，${engine.cables.length} 根线）`, done: true });
    window.__asmBuilt = { fails: r.fails, parts: engine.parts.size, cables: engine.cables.length };
    return r;
  }
  const play = async () => {
    clear();
    await new Promise((r) => setTimeout(r, 120));
    stopRef.current = false;
    engine.extDrive = true;
    setDemo({ text: "开始演示…", i: 0 });
    const ok = await runDemo(engine, {
      // 演示时由脚本推进物理（每帧 2 步 = 60 fps 时实时），慢机器上只是变慢，步骤结果不变
      run: driveRun,
      say: (text, i) => setDemo({ text, i }),
      stop: () => stopRef.current,
      showTool: (kind, pos) => { vis.current = { kind, pos: pos || vis.current.pos }; },
    });
    engine.extDrive = false;
    setDemo({ text: ok ? "演示完成：全部步骤走的是同一套碰撞和装配规则" : "演示已停止", done: true });
  };
  // 把桌面上实际装好的样子导出成照着做的指南（存到本机浏览器，不上传）
  const exportGuide = () => {
    const L = lastList.current;
    const b = elec.boards()[0];
    const sketch = b ? elec.code[b] || elec.sketchFor(b) : "";
    const g = makeGuide(engine, { steps: L?.steps || [], title: L?.title || "我桌面上的电路", listText: L?.text || "", sketch, fw: elec.fw });
    localStorage.setItem("asm-guide", JSON.stringify(g));
    nav("/assembly/guide?src=bench");
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
        {ready ? <AsmScene uids={uids} tool={tool} debug={debug} flux={flux} vis={vis} onTick={onTick} onSelect={setSel} probes={probes} onProbe={(k, t) => setProbes((p) => ({ ...p, [k]: t }))} /> : <p className="p-6 text-ink-soft">正在加载物理引擎…</p>}
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
        <div className="flex gap-1" role="tablist">
          {[["tools", "工具与装配"], ["elec", "通电"], ["octo", "八爪鱼"]].map(([k, zh]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`min-h-9 flex-1 border ${tab === k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`} data-testid={`tab-${k}`}>{zh}</button>
          ))}
        </div>
        <div className={tab === "octo" ? "" : "hidden"}><OctoPanel ready={ready} busy={!!(demo && !demo.done)} clear={clear} run={async (s) => { stopRef.current = false; if (window.__asmSpeed) return driveRun(s); let k = Math.round(s * 120); while (k-- > 0) engine.update(1 / 120); await new Promise((r) => requestAnimationFrame(r)); }} setDemo={setDemo} onExport={() => { localStorage.setItem("octo-guide", JSON.stringify(octoGuide(octoSim, engine))); nav("/assembly/octopus-guide?src=bench"); }} /></div>
        <fieldset className={tab === "octo" ? "hidden" : ""}>
          <legend className="font-medium">练习电路（自动装配到桌面上）</legend>
          <div className="mt-1 flex flex-col gap-1">
            {Object.entries(PRESETS).map(([k, p]) => (
              <button key={k} type="button" disabled={!ready || (demo && !demo.done)} onClick={() => { setTab("elec"); buildList(p.text, p.zh.split("：")[0]); }} className="min-h-9 border border-line bg-white px-2 text-left text-xs disabled:opacity-50" data-testid={`preset-${k}`}>{p.zh}</button>
            ))}
          </div>
          <details className="mt-1 text-xs">
            <summary className="cursor-pointer">导入清单（粘贴文字清单，照着装配）</summary>
            <textarea value={listText} onChange={(e) => setListText(e.target.value)} rows={8} spellCheck={false} className="mt-1 w-full border border-line bg-white p-1 font-mono text-[11px] leading-4" data-testid="list-text" />
            <button type="button" disabled={!ready || (demo && !demo.done)} onClick={() => buildList(listText)} className="min-h-8 border border-ink px-2 disabled:opacity-50" data-testid="list-build">照清单装配</button>
            <p className="mt-1 text-ink-soft">每行一件：面包板 / 板子 / 零件 / 跳线 / 导线 / 舵机 / USB，“#”后是注释。<Link to="/assembly/guide" className="underline">看装配指南格式</Link></p>
          </details>
          <button type="button" disabled={!ready || !uids.length} onClick={exportGuide} className="mt-1 min-h-9 w-full border border-copper bg-white px-2 text-xs disabled:opacity-50" data-testid="guide-btn">生成装配指南（物料清单、接线表、步骤、.ino，可打印）</button>
          {listErr.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs text-red-700" data-testid="list-errors">{listErr.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>}
        </fieldset>
        <div className={tab === "elec" ? "" : "hidden"}><ElecPanel probes={probes} setProbes={setProbes} tool={tool} setTool={pickTool} /></div>
        <div className={tab === "tools" ? "flex flex-col gap-3" : "hidden"}>
        <fieldset>
          <legend className="font-medium">工具</legend>
          <div className="mt-1 flex gap-1">
            {TOOLS.map((t) => (
              <button key={t.k} type="button" onClick={() => pickTool(t.k)} title={t.tip} aria-pressed={tool === t.k} className={`min-h-9 flex-1 border px-2 ${tool === t.k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`} data-testid={`tool-${t.k}`}>{t.zh}</button>
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
        </div>
      </aside>
    </section>
  );
}
