// 右侧“八爪鱼”页：按 md 复刻的小智八爪鱼（方案 A / B），台面接线 + 固件仿真 + MCP / 串口 / “大模型”（模拟）。
import { useEffect, useRef, useState } from "react";
import { engine } from "../engine.js";
import { OctoSim, EST } from "../octopus/sim.js";
import { FAULTS, PHASES } from "../octopus/bench.js";
import { FIX_LIST, fixesAll, Gait } from "../octopus/firmware.js";
import { buildOcto } from "../octopus/build3d.js";
import { parseNL } from "../octopus/nl.js";

let detach = null;
export function octoDetach() { detach?.(); detach = null; }
export const octoSim = new OctoSim({ plan: "A", phase: 3 });

const fx = (v, d) => (typeof v === "number" && isFinite(v) ? v.toFixed(d) : "—");
const Btn = ({ children, on, dis, t, cls = "", submit }) => <button type={submit ? "submit" : "button"} disabled={dis} onClick={on} data-testid={t} className={`min-h-8 border border-line bg-white px-2 text-xs disabled:opacity-40 ${cls}`}>{children}</button>;

function TopView({ snap, plan }) {
  if (!snap) return null;
  const S = 4.2, W = 220, H = 160;
  const tr = octoSim.trace;
  const p = snap.pose, cx = W / 2, cz = H / 2;
  const ox = p.x, oz = p.z;
  const P = (x, z) => [cx + (x - ox) * S, cz + (z - oz) * S];
  const arms = [];
  for (let a = 0; a < 8; a++) {
    const { yaw, lift } = octoSim.armPose(a);
    const th = (Gait.MountAngle(a) * Math.PI) / 180, phi = th - (yaw * Math.PI) / 180;
    const lx0 = 3.8 * Math.cos(th), lz0 = 3.8 * Math.sin(th), lx1 = lx0 + 9 * Math.cos(phi), lz1 = lz0 + 9 * Math.sin(phi);
    const rot = (x, z) => [p.x + x * Math.cos(p.h) - z * Math.sin(p.h), p.z + x * Math.sin(p.h) + z * Math.cos(p.h)];
    arms.push({ a, s: P(...rot(lx0, lz0)), e: P(...rot(lx1, lz1)), up: plan === "B" && lift > 5 });
  }
  const pts = tr.map((q) => P(q.x, q.z).join(",")).join(" ");
  const nose = P(p.x + 6 * Math.sin(p.h), p.z - 6 * Math.cos(p.h));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid="octo-topview">
      <defs><pattern id="g" width={S * 5} height={S * 5} patternUnits="userSpaceOnUse" x={(cx - ox * S) % (S * 5)} y={(cz - oz * S) % (S * 5)}><path d={`M ${S * 5} 0 L 0 0 0 ${S * 5}`} fill="none" stroke="#e7e2d8" strokeWidth="0.6" /></pattern></defs>
      <rect width={W} height={H} fill="url(#g)" />
      <polyline points={pts} fill="none" stroke="#b06a2c" strokeWidth="1" />
      <circle cx={P(p.x, p.z)[0]} cy={P(p.x, p.z)[1]} r={5 * S} fill="#f4efe6" stroke="#444" strokeWidth="0.8" />
      <line x1={P(p.x, p.z)[0]} y1={P(p.x, p.z)[1]} x2={nose[0]} y2={nose[1]} stroke="#c33" strokeWidth="1.2" />
      {arms.map((r) => <g key={r.a}><line x1={r.s[0]} y1={r.s[1]} x2={r.e[0]} y2={r.e[1]} stroke={r.up ? "#e6a76a" : "#d06a1a"} strokeWidth={r.up ? 1.5 : 3} strokeDasharray={r.up ? "2 1.5" : ""} strokeLinecap="round" /><text x={r.e[0]} y={r.e[1]} fontSize="6" fill="#333">{r.a}</text></g>)}
      <text x="4" y="10" fontSize="7" fill="#555">俯视轨迹（每格 5 cm；红线 = 0 号触手方向 = 前）</text>
      <text x="4" y={H - 4} fontSize="7" fill="#555">位移 x {p.x.toFixed(1)} cm · z {p.z.toFixed(1)} cm · 转了 {((p.h * 180) / Math.PI).toFixed(0)}°</text>
    </svg>
  );
}

export default function OctoPanel({ ready, busy, clear, run, setDemo, onExport }) {
  const [plan, setPlan] = useState("A");
  const [phase, setPhase] = useState(3);
  const [fault, setFault] = useState("none");
  const [mode, setMode] = useState("ino");
  const [F, setF] = useState(fixesAll(true));
  const [snap, setSnap] = useState(null);
  const [built, setBuilt] = useState(false);
  const [line, setLine] = useState("");
  const [say, setSay] = useState("往前爬五步");
  const [nlOut, setNlOut] = useState(null);
  const [wave, setWave] = useState(0);
  const [gait, setGait] = useState({ freq: 6, amplitude: 38, phase: 45 });
  const handle = useRef(null);

  useEffect(() => {
    const id = setInterval(() => { if (built) setSnap(octoSim.snapshot()); }, 150);
    return () => clearInterval(id);
  }, [built]);

  const [building, setBuilding] = useState(false);
  const lock = useRef(false);
  async function build(o = {}) {
    if (lock.current) return null; // 正在装：不重复进
    lock.current = true; setBuilding(true);
    try { return await build1(o); } finally { lock.current = false; setBuilding(false); }
  }
  async function build1(o = {}) {
    const cfg = { plan, phase, fault, mode, F, ...o };
    setPlan(cfg.plan); setPhase(cfg.phase); setFault(cfg.fault); setMode(cfg.mode); setF(cfg.F);
    octoDetach();
    clear();
    await new Promise((r) => setTimeout(r, 120));
    octoSim.set({ plan: cfg.plan, phase: cfg.phase, fault: cfg.fault, mode: cfg.mode, F: cfg.F });
    const title = `小智八爪鱼 方案${cfg.plan}`;
    setDemo({ text: `${title}…`, i: 0 });
    engine.extDrive = true;
    const h = await buildOcto(engine, octoSim, { run, say: (t) => setDemo({ text: `${title}：${t}` }) });
    engine.extDrive = false;
    handle.current = h;
    const off = engine.onTick((dt) => { octoSim.step(dt); });
    let raf = 0;
    const loop = () => { h.apply(); raf = requestAnimationFrame(loop); };
    loop();
    detach = () => { off(); cancelAnimationFrame(raf); };
    setBuilt(true);
    setSnap(octoSim.snapshot());
    setDemo({ text: `${title}：装好了（${engine.parts.size} 个零件，${engine.cables.length} 根线；${PHASES.find((p) => p.k === cfg.phase).zh}）`, done: true });
    window.__octoBuilt = { plan: cfg.plan, phase: cfg.phase, fault: cfg.fault, parts: engine.parts.size, cables: engine.cables.length };
    return window.__octoBuilt;
  }
  useEffect(() => { window.__octo = { build, sim: octoSim, nl: (t) => talk(t) }; });

  const send = (s) => { octoSim.send(s); setSnap(octoSim.snapshot()); };
  const mcp = (tool, args) => { const r = octoSim.mcp(tool, args); setSnap(octoSim.snapshot()); return r; };
  function talk(text) {
    const r = parseNL(text);
    const out = { zh: r.zh, calls: r.calls, serial: r.serial, res: [] };
    if (mode === "mcp") for (const c of r.calls) out.res.push(mcp(c.tool, c.args));
    else if (r.serial) send(r.serial);
    setNlOut(out);
    return out;
  }
  const isB = plan === "B";
  const errs = snap?.checks.filter((c) => c.level === "err" && !c.ok) || [];
  const warns = snap?.checks.filter((c) => c.level === "warn" && !c.ok) || [];
  const R = snap?.rails;
  const ph = PHASES.find((p) => p.k === phase);
  const noBody = phase === 0;
  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="octo-panel">
      <p className="leading-5 text-ink-soft">照你给的 md（octopus-ai）复刻：零件、接线、供电、固件都按文档；文档没写的标“文档未写”，数字是推出来的标“估算”。语音、大模型、WiFi / 蓝牙都是<b className="text-ink">模拟</b>。</p>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">预设</legend>
        <Btn t="octo-preset-A" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none" })} cls="text-left">小智八爪鱼 方案A（8 个 MG90S，只摆不抬）</Btn>
        <Btn t="octo-preset-B" dis={!ready || busy || building} on={() => build({ plan: "B", phase: 3, fault: "none" })} cls="text-left">小智八爪鱼 方案B（16 个 MG90S，每条摆 + 抬）</Btn>
        <label className="mt-1">按 md 的阶段装：
          <select value={phase} onChange={(e) => setPhase(+e.target.value)} className="ml-1 w-full border border-line bg-white" data-testid="octo-phase">{PHASES.map((p) => <option key={p.k} value={p.k}>{p.zh}</option>)}</select>
        </label>
        <p className="text-ink-soft">{ph.md}{ph.textOnly ? "（这一阶段只有文字说明，台面按阶段 4 摆）" : ""}</p>
        <label>故障 / 维修场景：
          <select value={fault} onChange={(e) => setFault(e.target.value)} className="ml-1 w-full border border-line bg-white" data-testid="octo-fault">{FAULTS.map((f) => <option key={f.k} value={f.k}>{f.zh}</option>)}</select>
        </label>
        {FAULTS.find((f) => f.k === fault)?.md && <p className="text-ink-soft">出处：{FAULTS.find((f) => f.k === fault).md}</p>}
        <div className="flex gap-2">
          <label><input type="radio" checked={mode === "ino"} onChange={() => (built ? build({ mode: "ino" }) : setMode("ino"))} data-testid="octo-mode-ino" /> 蓝牙串口固件（body_firmware_A.ino）</label>
          <label><input type="radio" checked={mode === "mcp"} onChange={() => (built ? build({ mode: "mcp" }) : setMode("mcp"))} data-testid="octo-mode-mcp" /> 小智 MCP（模拟）</label>
        </div>
        <details>
          <summary className="cursor-pointer">固件修正（{Object.values(F).filter(Boolean).length}/{FIX_LIST.length} 项打开；全关 = md 原样）</summary>
          <div className="mt-1 flex gap-1"><Btn on={() => setF(fixesAll(true))} t="octo-fix-all">全部修正</Btn><Btn on={() => setF(fixesAll(false))} t="octo-fix-none">全部原样（md 代码）</Btn></div>
          {FIX_LIST.map((f) => <label key={f.k} className="mt-1 flex gap-1 leading-4"><input type="checkbox" checked={!!F[f.k]} onChange={(e) => setF({ ...F, [f.k]: e.target.checked })} /><span>{f.zh}<span className="text-ink-soft">（{f.md}）</span></span></label>)}
        </details>
        <Btn t="octo-build" dis={!ready || busy || building} on={() => build()} cls="border-ink">按上面的设置重新装（方案{plan}）</Btn>
      </fieldset>
      {built && snap && <>
        <fieldset data-testid="octo-power">
          <legend className="font-medium">通电状态</legend>
          <p className={snap.espOn ? "text-emerald-700" : "text-red-700"}>ESP32：{snap.espOn ? `运行中（启动 ${snap.boots} 次）` : "没在运行"}{snap.halted ? ` · 固件停在：${snap.halted}` : ""}</p>
          <table className="mt-1 w-full font-mono text-[11px]"><tbody>
            <tr><td>电池</td><td>{fx(R.vbat, 2)} V</td><td>舵机 V+</td><td>{fx(R.vservo, 2)} V</td></tr>
            <tr><td>ESP32 5V</td><td>{fx(R.espIn, 2)} V</td><td>3V3</td><td>{fx(R.v33, 2)} V</td></tr>
            <tr><td>舵机电流</td><td>{fx(snap.avgI, 2)} A</td><td>峰值</td><td>{fx(snap.peakI, 2)} A</td></tr>
            <tr><td>PWM</td><td>{fx(snap.freq, 0)} Hz</td><td>共地</td><td>{R.gndCommon ? "有" : "没有"}</td></tr>
          </tbody></table>
          <p className="text-ink-soft">电流、电压是估算模型（{EST.current}）</p>
          <ul className="mt-1 flex flex-col gap-0.5" data-testid="octo-checks">
            {[...errs, ...warns, ...snap.checks.filter((c) => c.ok)].slice(0, 14).map((c, i) => <li key={i} className={c.ok ? "text-emerald-700" : c.level === "err" ? "text-red-700" : "text-amber-700"}>{c.ok ? "✓" : c.level === "err" ? "✗" : "!"} {c.zh} <span className="text-ink-soft">（{c.md}）</span></li>)}
          </ul>
        </fieldset>
        {!noBody && <fieldset className="flex flex-col gap-1" data-testid="octo-controls">
          <legend className="font-medium">{mode === "mcp" ? "MCP 工具 self.octopus.*（模拟小智调用）" : "蓝牙串口指令（模拟，md 的 .ino）"}</legend>
          {mode === "mcp" ? <div className="flex flex-wrap gap-1">
            <Btn t="mcp-crawl" on={() => mcp("self.octopus.action", { action: "crawl", steps: 3, direction: 0 })}>爬 3 步</Btn>
            <Btn t="mcp-left" on={() => mcp("self.octopus.action", { action: "crawl", steps: 3, direction: -100 })}>左转</Btn>
            <Btn t="mcp-right" on={() => mcp("self.octopus.action", { action: "crawl", steps: 3, direction: 100 })}>右转</Btn>
            <Btn t="mcp-wave" on={() => mcp("self.octopus.action", { action: "wave", arm: wave })}>挥 {wave} 号</Btn>
            <Btn t="mcp-pulse" on={() => mcp("self.octopus.action", { action: "pulse", steps: 2 })}>收缩 2 次</Btn>
            <Btn t="mcp-home" on={() => mcp("self.octopus.action", { action: "home" })}>回中</Btn>
            <Btn t="mcp-rest" on={() => mcp("self.octopus.action", { action: "rest" })}>放松</Btn>
          </div> : <div className="flex flex-wrap gap-1">
            {["GO", "LEFT", "RIGHT", "STOP", "HOME"].map((c) => <Btn key={c} t={`ser-${c}`} on={() => send(c)}>{c}</Btn>)}
            <Btn t="ser-WAVE" on={() => send(`WAVE ${wave}`)}>WAVE {wave}</Btn><Btn t="ser-PULSE" on={() => send("PULSE 2")}>PULSE 2</Btn>
          </div>}
          <label>挥手用哪条：<input type="range" min="0" max="7" value={wave} onChange={(e) => setWave(+e.target.value)} /> {wave} 号</label>
          <div className="grid grid-cols-[4rem_1fr_2.5rem] items-center gap-x-1">
            <span>频率</span><input type="range" min="2" max="20" value={gait.freq} onChange={(e) => setGait({ ...gait, freq: +e.target.value })} /><span>{(gait.freq / 10).toFixed(1)} Hz</span>
            <span>摆幅</span><input type="range" min="0" max="60" value={gait.amplitude} onChange={(e) => setGait({ ...gait, amplitude: +e.target.value })} /><span>{gait.amplitude}°</span>
            <span>相位差</span><input type="range" min="0" max="180" value={gait.phase} onChange={(e) => setGait({ ...gait, phase: +e.target.value })} /><span>{gait.phase}°</span>
          </div>
          <Btn t="octo-gait" on={() => mode === "mcp" ? mcp("self.octopus.set_gait", gait) : send(`GAIT f=${gait.freq / 10} yaw=${gait.amplitude} phase=${gait.phase}`)}>{mode === "mcp" ? "set_gait" : "发送 GAIT"}（md 建议 0.6 Hz / 38° / 45°）</Btn>
          {mode === "ino" && <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (line.trim()) send(line); setLine(""); }}>
            <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="串口一行，例如 GAIT F=0.8 YAW=30" className="min-w-0 flex-1 border border-line px-1 font-mono" data-testid="octo-serial" /><Btn submit t="octo-serial-send">发送</Btn>
          </form>}
          <form className="mt-1 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); talk(say); }}>
            <span>对它说一句（<b>模拟</b>：真实小智是 语音 → 云端识别 + 大模型 → MCP；这里用关键词规则代替）</span>
            <div className="flex gap-1"><input value={say} onChange={(e) => setSay(e.target.value)} className="min-w-0 flex-1 border border-line px-1" data-testid="octo-nl" /><Btn submit t="octo-nl-send">说</Btn></div>
            {nlOut && <p className="font-mono text-[11px]" data-testid="octo-nl-out">“大模型”（模拟）→ {nlOut.zh}{mode === "mcp" ? nlOut.calls.map((c, i) => <span key={i}><br />{c.tool} {JSON.stringify(c.args)} → {nlOut.res[i]}</span>) : nlOut.serial ? <><br />串口 → {nlOut.serial}</> : null}</p>}
          </form>
        </fieldset>}
        {!noBody && <TopView snap={snap} plan={plan} />}
        {!noBody && <details open>
          <summary className="cursor-pointer font-medium">通道监视（PCA9685 → 舵机）</summary>
          <table className="mt-1 w-full font-mono text-[10px]" data-testid="octo-channels"><thead><tr className="text-ink-soft"><th>通道</th><th>舵机</th><th>脉宽 µs</th><th>指令°</th><th>实际°</th><th>A</th><th /></tr></thead><tbody>
            {snap.servos.map((s) => <tr key={s.role} className={s.buzz || s.collide ? "text-red-700" : ""}><td>{s.ch}</td><td>{s.role}{s.type === "360" ? "(360°)" : ""}</td><td>{s.us ? s.us.toFixed(0) : "—"}</td><td>{s.cmd == null ? "—" : s.cmd.toFixed(0)}</td><td>{s.ang.toFixed(0)}</td><td>{s.I.toFixed(2)}</td><td>{s.collide ? "碰" : s.buzz ? "响" : ""}</td></tr>)}
          </tbody></table>
        </details>}
        {snap.log.length > 0 && <pre className="max-h-32 overflow-auto border border-line bg-white p-1 text-[10px]" data-testid="octo-log">{snap.log.slice(-14).join("\n")}</pre>}
        {snap.events.length > 0 && <ul className="text-[11px] text-ink-soft">{snap.events.slice(-5).map((e, i) => <li key={i}>{e.t}s {e.zh}</li>)}</ul>}
        <p className="text-ink-soft">{EST.friction}。{isB ? EST.gap : ""}</p>
      </>}
      <Btn t="octo-guide" dis={!built} on={onExport} cls="border-copper">生成八爪鱼装配指南（md 原文 .ino、引脚表、对照现实、出处表、价格）</Btn>
    </div>
  );
}
