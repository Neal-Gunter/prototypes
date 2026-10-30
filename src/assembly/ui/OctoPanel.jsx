// 右侧“八爪鱼”页：按 md 复刻的小智八爪鱼（方案 A / B），台面接线 + 固件仿真 + MCP / 串口 / “大模型”（模拟）。
import { useEffect, useRef, useState } from "react";
import { engine } from "../engine.js";
import { OctoSim, EST } from "../octopus/sim.js";
import { FAULTS, FAULTS_V10, PHASES } from "../octopus/bench.js";
import { LIPO, V10_EST, massV10 } from "../octopus/v10.js";
import { FIX_LIST, fixesAll, fixesPlus, Gait } from "../octopus/firmware.js";
import { VARIANTS } from "../octopus/bench.js";
import { buildOcto, OCTO_C, TAUT } from "../octopus/build3d.js";
import { LOCO_EST, MG90S } from "../octopus/loco.js";
import { parseNL } from "../octopus/nl.js";
import GaitEditor from "../../gait/GaitEditor.jsx";
import { preset, OCTO_NAMES, OCTO_SIDE, octoFirmwareGait, sanitizeGait, toFirmwareHeader } from "../../gait/gait.js";
import { octoRowGait, octoV14Gait } from "../../gait/octo-best.js";
import { runGait } from "../../gait/octo-measure.js";
import GaitSearch from "../../gait/GaitSearch.jsx";
import CtrlPanel from "../../gait/CtrlPanel.jsx";
import SlipPanel from "./SlipPanel.jsx";
import { OCTO_CTRL, SimImu, toCtrlHeader } from "../../gait/ctrl.js";

let detach = null;
export function octoDetach() { detach?.(); detach = null; }
export const octoSim = new OctoSim({ plan: "A", phase: 3 });

const fx = (v, d) => (typeof v === "number" && isFinite(v) ? v.toFixed(d) : "—");
// 镜头预设（cm）：机身会爬，机身相关的镜头跟着机身走
export const CAMS = [
  // v8：装好后的默认镜头——斜上方跟着机身，整只（躯干 10 cm + 触手 9 cm，约 28 cm 宽）都在画面里
  { k: "auto", zh: "默认", pos: [14, 24, 28], tgt: [0, 2, 0], body: true },
  { k: "overview", zh: "总览", pos: [2, 42, 52], tgt: [0, 0, 0] },
  { k: "top", zh: "俯视", pos: [0, 58, 0.01], tgt: [0, 0, 0], body: true },
  { k: "body", zh: "机身特写", pos: [12, 13, 16], tgt: [0, 3, 0], body: true },
  { k: "side", zh: "触手侧面", pos: [24, 4.5, 0], tgt: [0, 2, 0], body: true },
  // v9：远一点、贴着桌面的正侧面，看触手抬起 / 下压推地（跟着机身）
  { k: "walk", zh: "走路侧视", pos: [42, 2.2, -4], tgt: [0, 2.2, -4], body: true },
  { k: "near", zh: "近侧视（小机身）", pos: [24, 3.5, -3], tgt: [0, 2.6, -3], body: true },
  { k: "wires", zh: "接线台面", pos: [-12, 28, 26], tgt: [-12, 0, 2] },
];
export function setCam(k, motion) {
  const c = CAMS.find((x) => x.k === k); if (!c || !window.__asmCam) return false;
  const o = c.body ? [OCTO_C.x + (motion?.dx || 0), 0, OCTO_C.z + (motion?.dz || 0)] : [0, 0, 0];
  window.__asmCam(c.pos.map((v, i) => v + o[i]), c.tgt.map((v, i) => v + o[i]));
  return true;
}
const Btn = ({ children, on, dis, t, cls = "", submit }) => <button type={submit ? "submit" : "button"} disabled={dis} onClick={on} data-testid={t} className={`min-h-8 border border-line bg-white px-2 text-xs disabled:opacity-40 ${cls}`}>{children}</button>;

function TopView({ snap, plan }) {
  if (!snap) return null;
  const S = 4.2, W = 220, H = 160;
  const G = octoSim.phys?.geo, mR = G?.yawR ?? 3.8, aL = G ? G.tip[0] : 9, bR = G?.plateR ?? 5;
  const tr = octoSim.trace;
  const p = snap.pose, cx = W / 2, cz = H / 2;
  const ox = p.x, oz = p.z;
  const P = (x, z) => [cx + (x - ox) * S, cz + (z - oz) * S];
  const arms = [];
  for (let a = 0; a < 8; a++) {
    const { yaw, lift } = octoSim.armPose(a);
    const th = (Gait.MountAngle(a) * Math.PI) / 180, phi = th - (yaw * Math.PI) / 180;
    const lx0 = mR * Math.cos(th), lz0 = mR * Math.sin(th), lx1 = lx0 + aL * Math.cos(phi), lz1 = lz0 + aL * Math.sin(phi);
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
      <circle cx={P(p.x, p.z)[0]} cy={P(p.x, p.z)[1]} r={bR * S} fill="#f4efe6" stroke="#444" strokeWidth="0.8" />
      <line x1={P(p.x, p.z)[0]} y1={P(p.x, p.z)[1]} x2={nose[0]} y2={nose[1]} stroke="#c33" strokeWidth="1.2" />
      {arms.map((r) => <g key={r.a}><line x1={r.s[0]} y1={r.s[1]} x2={r.e[0]} y2={r.e[1]} stroke={r.up ? "#e6a76a" : "#d06a1a"} strokeWidth={r.up ? 1.5 : 3} strokeDasharray={r.up ? "2 1.5" : ""} strokeLinecap="round" /><text x={r.e[0]} y={r.e[1]} fontSize="6" fill="#333">{r.a}</text></g>)}
      <text x="4" y="10" fontSize="7" fill="#555">俯视轨迹（每格 5 cm；红线 = 0 号触手方向 = 前）</text>
      <text x="4" y={H - 4} fontSize="7" fill="#555">位移 x {p.x.toFixed(1)} cm · z {p.z.toFixed(1)} cm · 转了 {((p.h * 180) / Math.PI).toFixed(0)}°</text>
    </svg>
  );
}

// v9：走路物理的读数（Rapier 刚体 + 接触摩擦）
// v13：八爪鱼的步态预设（我的补充）。左右舷按 cos(安装角) 加权，前后两条触手权重 0（和固件默认步态同一个约定）
const OCTO_PRESETS = [
  { k: "firmware", zh: "固件默认", make: octoFirmwareGait },
  { k: "row", zh: "同步划桨（v13 搜索）", make: octoRowGait },
  { k: "v14", zh: "v14 自动搜索（速度优先）", make: octoV14Gait },
  { k: "alternating", zh: "交替", make: () => preset("alternating", OCTO_NAMES, { amp: 40, freq: 0.8, weights: OCTO_SIDE }) },
  { k: "wave", zh: "波浪", make: () => preset("wave", OCTO_NAMES, { amp: 40, freq: 0.8, weights: OCTO_SIDE }) },
  { k: "tripod", zh: "三组轮换（类三足）", make: () => preset("tripod", OCTO_NAMES, { amp: 40, freq: 0.8, weights: OCTO_SIDE }) },
];
function OctoGait({ variant, plan, mu, send }) {
  const [g, setG] = useState(octoRowGait);
  const [on, setOn] = useState(false);
  const run = (x) => { octoSim.rt?.body?.SetCustomGait(sanitizeGait(x, 8)); setOn(true); send("GO"); };
  const hdr = (x) => ({ name: "octopus_gait_custom.h", text: toFirmwareHeader(sanitizeGait(x, 8), { stamp: new Date().toISOString().slice(0, 10) }) });
  const measure1 = async (o) => { const r = await runGait({ gait: sanitizeGait(g, 8), sec: o.sec || 15, mu: mu ?? 0.5, variant, plan, ...o }); try { r.lp?.world?.free(); } catch { /* 已释放 */ } return { speed: r.speed, dx: r.dx, dh: r.dh, tiltGMax: r.tiltGMax ?? r.tiltMax, tiltGAvg: r.tiltGAvg ?? r.tiltAvg }; };
  return <>
  <GaitEditor gait={g} setGait={setG} presets={OCTO_PRESETS} rateLimit={300} tid="octo-gait"
    time={on ? octoSim.rt?.body?.custom_t_ ?? null : null}
    onRun={(x) => { octoSim.rt?.body?.SetCustomGait(sanitizeGait(x, 8)); setOn(true); send("GO"); }}
    onStop={() => { send("STOP"); octoSim.rt?.body?.SetCustomGait(null); setOn(false); }}
    onMeasure={async (x, o) => {
      const r = await runGait({ gait: sanitizeGait(x, 8), sec: o.sec, mu: o.mu ?? mu, variant, plan, onProgress: o.onProgress });
      try { r.lp?.world?.free(); } catch { /* 已释放 */ }
      const { sim, lp, trace, ...rest } = r; void sim; void lp; void trace;
      window.__octoGaitLast = rest;
      return rest;
    }}
    exports={[{ k: "h", zh: "固件头文件 octopus_gait_custom.h", make: (x) => ({ name: "octopus_gait_custom.h", text: toFirmwareHeader(sanitizeGait(x, 8), { stamp: new Date().toISOString().slice(0, 10) }) }) }]}
    note={`“在台面上跑”= 相当于把导出的 octopus_gait_custom.h 编进固件再发 GO（固件孪生里调 Body.SetCustomGait），照样过防碰撞、限位 90±55°、限速 300 °/s；“停”回到固件默认步态。测量在后台另开一个同配置（${variant} · 方案 ${plan}）的台面跑，桌面 μ 用上面的滑杆（冰面对照用 0）。同步划桨是 scripts/gait-search.mjs 仿真搜出来的（我的补充，未上实机）。`} />
  <GaitSearch kind="octo" tid="octo-search" makeJob={() => ({ gait0: sanitizeGait(g, 8), variant, plan, sec: 10 })}
    onApply={(x) => setG(x)} onPreview={(x) => { setG(x); run(x); }}
    exports={[{ k: "h", zh: "导出固件头文件 .h", make: hdr }]}
    note="每次评估 = 在固件孪生（Rapier 刚体 + 舵机限速 + 防碰撞）里跑 4 s 站稳 + 10 s 步态，比实时快约 10 倍。搜出来的只在仿真里好（估算），上实机前请先低速、短时验证。" />
  <CtrlPanel tid="octo-ctrl" defaults={OCTO_CTRL} loadKind="load" defaultSlope={3}
    onLive={(c, sl) => { if (c) { octoSim.attachImu(new SimImu()); octoSim.rt?.body?.SetController(c); octoSim.phys?.setSlope(sl?.deg || 0, sl?.dir || "cross"); } else { octoSim.rt?.body?.SetController(null); octoSim.attachImu(null); octoSim.phys?.setSlope(0); } }}
    runCompare={async ({ ctrl, slope, load, onProgress }) => {
      const open = await measure1({ slope, load, onProgress: (p) => onProgress(p / 2) });
      const closed = await measure1({ slope, load, ctrl, imu: {}, onProgress: (p) => onProgress(0.5 + p / 2) });
      return { open, closed, label: `当前步态 15 s · ${slope ? `${slope.deg}° ${slope.dir}` : "平地"}${load ? " · 加负载" : ""}` };
    }}
    exports={[{ k: "h", zh: "导出 octopus_ctrl_custom.h", make: (c) => ({ name: "octopus_ctrl_custom.h", text: toCtrlHeader(c) }) }]}
    note="八爪鱼的倾斜靠底下 3 个万向球撑着、自己倾不了多少，所以这里主要调航向：IMU 测到偏航就把偏向那一侧的划桨幅度减小（只减不增，不会超限速）。横坡上万向球会往下滚，侧漂基本拦不住（简化仿真的诚实结论）；横坡上转向符号会反过来，固件按横滚角自动切换（仿真经验规则，估算）。实机需要加一块 MPU-6050（我的补充）。" />
  <SlipPanel measure={(o) => measure1(o)} onCaster={(k) => octoSim.phys?.setCaster?.(k)} />
  </>;
}
function LocoBox({ L, mu, setMu }) {
  const g = (kg) => (kg * 1000).toFixed(0);
  return (
    <fieldset className="flex flex-col gap-1" data-testid="octo-loco">
      <legend className="font-medium">走路物理（v9：机身是有重力的刚体，只靠触手和桌面的摩擦走）</legend>
      <table className="w-full font-mono text-[11px]"><tbody>
        <tr><td>速度</td><td data-testid="loco-v">{L.v.toFixed(2)} cm/s</td><td>每周期</td><td data-testid="loco-cyc">{L.perCycle == null ? "—" : `${L.perCycle.toFixed(2)} cm`}</td></tr>
        <tr><td>打滑率</td><td data-testid="loco-slip">{L.slip.toFixed(2)}</td><td>着地触手</td><td data-testid="loco-contacts">{L.contacts} / 8</td></tr>
        <tr><td>机身离桌</td><td>{L.y.toFixed(2)} cm</td><td>底板承重</td><td>{g(L.bodyLoad)} g</td></tr>
        <tr><td>总质量</td><td>{g(L.mass)} g（估算）</td><td>舵机力矩</td><td>峰值 {Math.round(L.peakTorque * 100)}% · 堵转 {L.stall.toFixed(1)} kgf·cm</td></tr>
      </tbody></table>
      <div className="flex items-end gap-0.5" data-testid="loco-legs" title="每条触手压在桌上的力">
        {L.load.map((x, i) => <div key={i} className="flex flex-1 flex-col items-center"><div className={x > 0.002 ? "w-full bg-copper" : "w-full bg-line"} style={{ height: `${Math.min(40, 4 + x * 300)}px` }} /><span className="text-[10px]">{i}:{g(x)}g</span></div>)}
      </div>
      <label className="flex items-center gap-1">桌面摩擦 μ（估算）<input type="range" min="0" max="1" step="0.05" value={mu} onChange={(e) => setMu(+e.target.value)} data-testid="loco-mu" /> <span data-testid="loco-mu-v">{mu.toFixed(2)}</span></label>
      <p className="text-ink-soft">打滑率 = 着地触手尖相对桌面滑的距离 / 相对机身划的距离（0 = 完全抓地，1 = 原地空划）。μ 拉到 0 机身就不走——位移只来自触手接触。</p>
      <details><summary className="cursor-pointer text-ink-soft">走路物理的出处和估算</summary><ul className="list-disc pl-4 text-ink-soft">{[MG90S.src, ...Object.values(LOCO_EST)].map((t, i) => <li key={i}>{t}</li>)}</ul></details>
    </fieldset>
  );
}

export default function OctoPanel({ ready, busy, clear, run, setDemo, onExport }) {
  const [plan, setPlan] = useState("A");
  const [variant, setVariant] = useState("md");
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
  const [mu, setMuS] = useState(0.5);
  const setMu = (v) => { setMuS(v); octoSim.o.mu = v; octoSim.phys?.setMu(v); };
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
    const cfg = { plan, phase, fault, mode, variant, F, ...o };
    if (o.variant && !o.F) cfg.F = o.variant === "plus" || o.variant === "v10" ? fixesPlus() : fixesAll(true);
    setVariant(cfg.variant); setPlan(cfg.plan); setPhase(cfg.phase); setFault(cfg.fault); setMode(cfg.mode); setF(cfg.F);
    octoDetach();
    clear();
    await new Promise((r) => setTimeout(r, 120));
    octoSim.set({ plan: cfg.plan, phase: cfg.phase, fault: cfg.fault, mode: cfg.mode, variant: cfg.variant, F: cfg.F });
    const title = cfg.variant === "v10" ? "小智八爪鱼 v10 紧凑无线版（我的补充）" : `小智八爪鱼 方案${cfg.plan}${cfg.variant === "plus" ? " · 完善版（我的补充）" : ""}`;
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
    setTimeout(() => setCam(o.cam || "auto", h.motion), 50);
    if (o.go) setTimeout(() => { octoSim.send("GO"); setSnap(octoSim.snapshot()); }, 1500);
    window.__octoBuilt = { variant: cfg.variant, plan: cfg.plan, phase: cfg.phase, fault: cfg.fault, parts: engine.parts.size, cables: engine.cables.length };
    return window.__octoBuilt;
  }
  useEffect(() => { window.__octo = { build, sim: octoSim, nl: (t) => talk(t), cam: (k) => setCam(k, handle.current?.motion), motion: () => ({ ...(handle.current?.motion || {}) }) }; });

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
  const B3 = !!octoSim.bench.robot;
  return (
    <div className="flex flex-col gap-3 text-xs" data-testid="octo-panel">
      <p className="rounded bg-amber-50 px-1 text-amber-800">早期原型，简化仿真</p>
      <p className="leading-5 text-ink-soft">照你给的 md（octopus-ai）复刻：零件、接线、供电、固件都按文档；文档没写的标“文档未写”，数字是推出来的标“估算”。语音、大模型、WiFi / 蓝牙都是<b className="text-ink">模拟</b>。</p>
      <fieldset className="flex flex-col gap-1 border border-copper p-2" data-testid="octo-quick">
        <legend className="font-medium text-copper">一键开始</legend>
        <span className="text-ink-soft">装好完善版（我的补充）→ 通电 → 自动发 GO 往前爬；镜头跟着机身。想停就点下面的 STOP。</span>
        <div className="grid grid-cols-2 gap-1">
          <Btn t="octo-quickstart" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none", variant: "plus", mode: "ino", go: true })} cls="border-copper bg-copper/10 py-2 font-medium">▶ 方案A 完善版<br /><span className="font-normal text-ink-soft">8 舵机，直行 + 转弯</span></Btn>
          <Btn t="octo-quickstart-B" dis={!ready || busy || building} on={() => build({ plan: "B", phase: 3, fault: "none", variant: "plus", mode: "ino", go: true })} cls="border-copper bg-copper/10 py-2 font-medium">▶ 方案B 完善版<br /><span className="font-normal text-ink-soft">16 舵机，摆 + 抬</span></Btn>
        </div>
        <Btn t="octo-quickstart-v10" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none", variant: "v10", mode: "ino", go: true, cam: "body" })} cls="border-copper bg-copper/10 py-2 font-medium">▶ v10 紧凑无线版（我的补充）<span className="font-normal text-ink-soft"> · 电池在身上，不插电，手机 BLE 遥控</span></Btn>
        {building && <p className="text-ink-soft" data-testid="octo-building">正在装配（16 舵机版约 10–20 秒）…</p>}
      </fieldset>
      <fieldset className="flex flex-col gap-1">
        <legend className="font-medium">预设</legend>
        <span className="text-ink-soft">md 原样（照文档，固件修正可开关）</span>
        <Btn t="octo-preset-A" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none", variant: "md" })} cls="text-left">小智八爪鱼 方案A（8 个 MG90S，只摆不抬）</Btn>
        <Btn t="octo-preset-B" dis={!ready || busy || building} on={() => build({ plan: "B", phase: 3, fault: "none", variant: "md" })} cls="text-left">小智八爪鱼 方案B（16 个 MG90S，每条摆 + 抬）</Btn>
        <span className="mt-1 text-copper">完善版（我的补充）：md 问题清单里的每一条都改了，改动见指南的“完善版改动表”</span>
        <Btn t="octo-preset-A-plus" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none", variant: "plus" })} cls="border-copper text-left">方案A · 完善版（我的补充：3S 电池、镜像步态、万向球脚，能直行和转弯）</Btn>
        <Btn t="octo-preset-B-plus" dis={!ready || busy || building} on={() => build({ plan: "B", phase: 3, fault: "none", variant: "plus" })} cls="border-copper text-left">方案B · 完善版（我的补充：防撞、交替步态 + 支撑相下压、原地转圈）</Btn>
        <span className="mt-1 text-copper">v10 紧凑无线版（我的补充）：电池、主控、升压全在机身上，没有墙插和 USB 线</span>
        <Btn t="octo-preset-v10" dis={!ready || busy || building} on={() => build({ plan: "A", phase: 3, fault: "none", variant: "v10", cam: "body" })} cls="border-copper text-left">v10 紧凑无线版（1S 1200 mAh LiPo + QT Py ESP32‑S3 + 8 个 SG51R，约 {Math.round(massV10() * 1000)} g，估算）</Btn>
        {variant === "v10" && <p className="text-copper" data-testid="octo-variant-tip-v10">{VARIANTS.find((v) => v.k === "v10")?.tip}</p>}
        {variant === "plus" && <p className="text-copper" data-testid="octo-variant-tip">{VARIANTS.find((v) => v.k === "plus")?.tip}</p>}
        <details data-testid="octo-adv">
        <summary className="cursor-pointer text-ink-soft">高级设置：阶段 / 故障场景 / 固件模式 / 固件修正开关</summary>
        <div className="mt-1 flex flex-col gap-1">
        <label className="mt-1">按 md 的阶段装：
          <select value={phase} onChange={(e) => setPhase(+e.target.value)} className="ml-1 w-full border border-line bg-white" data-testid="octo-phase">{PHASES.map((p) => <option key={p.k} value={p.k}>{p.zh}</option>)}</select>
        </label>
        <p className="text-ink-soft">{ph.md}{ph.textOnly ? "（这一阶段只有文字说明，台面按阶段 4 摆）" : ""}</p>
        <label>故障 / 维修场景：
          <select value={fault} onChange={(e) => setFault(e.target.value)} className="ml-1 w-full border border-line bg-white" data-testid="octo-fault">{(variant === "v10" ? FAULTS_V10 : FAULTS).map((f) => <option key={f.k} value={f.k}>{f.zh}</option>)}</select>
        </label>
        {(variant === "v10" ? FAULTS_V10 : FAULTS).find((f) => f.k === fault)?.md && <p className="text-ink-soft">出处：{(variant === "v10" ? FAULTS_V10 : FAULTS).find((f) => f.k === fault).md}</p>}
        <div className="flex gap-2">
          <label><input type="radio" checked={mode === "ino"} onChange={() => (built ? build({ mode: "ino" }) : setMode("ino"))} data-testid="octo-mode-ino" /> 蓝牙串口固件（body_firmware_A.ino）</label>
          <label><input type="radio" checked={mode === "mcp"} onChange={() => (built ? build({ mode: "mcp" }) : setMode("mcp"))} data-testid="octo-mode-mcp" /> 小智 MCP（模拟）</label>
        </div>
        <details>
          <summary className="cursor-pointer">固件修正（{Object.values(F).filter(Boolean).length}/{FIX_LIST.length} 项打开；全关 = md 原样）</summary>
          <div className="mt-1 flex flex-wrap gap-1"><Btn on={() => setF(fixesAll(true))} t="octo-fix-all">全部修正（md 的 bug）</Btn><Btn on={() => setF(fixesPlus())} t="octo-fix-plus">再加上我的补充</Btn><Btn on={() => setF(fixesAll(false))} t="octo-fix-none">全部原样（md 代码）</Btn></div>
          {FIX_LIST.map((f) => <label key={f.k} className={`mt-1 flex gap-1 leading-4 ${f.plus ? "text-copper" : ""}`}><input type="checkbox" checked={!!F[f.k]} onChange={(e) => setF({ ...F, [f.k]: e.target.checked })} /><span>{f.zh}<span className="text-ink-soft">（{f.md}）</span></span></label>)}
        </details>
        </div>
        </details>
        <Btn t="octo-build" dis={!ready || busy || building} on={() => build()} cls="border-ink">按上面的设置重新装（{variant === "v10" ? "v10 紧凑无线版" : `方案${plan}${variant === "plus" ? " · 完善版" : ""}`}）</Btn>
      </fieldset>
      {built && snap && <>
        <fieldset data-testid="octo-power">
          <legend className="font-medium">通电状态</legend>
          {variant === "v10" && <p className="text-emerald-800" data-testid="octo-v10-onboard">电源：1S {LIPO.mah} mAh LiPo 装在机身上（没有墙插、没有 USB 线；USB‑C 只在充电时插）。{snap.pBatAvg ? `平均耗电 ${snap.pBatAvg.toFixed(2)} W → 满电约 ${(LIPO.wh / snap.pBatAvg).toFixed(1)} h（估算，按现在这段动作的平均功率）` : ""}</p>}
          <p className={snap.espOn ? "text-emerald-700" : "text-red-700"}>{variant === "v10" ? "QT Py ESP32‑S3" : "ESP32"}：{snap.espOn ? `运行中（启动 ${snap.boots} 次）` : "没在运行"}{snap.halted ? ` · 固件停在：${snap.halted}` : ""}</p>
          <table className="mt-1 w-full font-mono text-[11px]"><tbody>
            <tr><td>电池</td><td>{fx(R.vbat, 2)} V</td><td>舵机 V+</td><td>{fx(R.vservo, 2)} V</td></tr>
            <tr><td>{variant === "v10" ? "QT Py BAT" : "ESP32 5V"}</td><td>{fx(R.espIn, 2)} V</td><td>3V3</td><td>{fx(R.v33, 2)} V</td></tr>
            <tr><td>舵机电流</td><td>{fx(snap.avgI, 2)} A</td><td>峰值</td><td>{fx(snap.peakI, 2)} A</td></tr>
            <tr><td>PWM</td><td>{fx(snap.freq, 0)} Hz</td><td>共地</td><td>{R.gndCommon ? "有" : "没有"}</td></tr>
          </tbody></table>
          <p className="text-ink-soft">电流、电压是估算模型（{variant === "v10" ? `${V10_EST.current}；${V10_EST.qtpy}` : EST.current}）</p>
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
          <details data-testid="octo-adv-gait">
          <summary className="cursor-pointer text-ink-soft">高级：挥手触手 / 步态参数 / 串口一行</summary>
          <div className="mt-1 flex flex-col gap-1">
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
          </div>
          </details>
          <form className="mt-1 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); talk(say); }}>
            <span>对它说一句（<b>模拟</b>：真实小智是 语音 → 云端识别 + 大模型 → MCP；这里用关键词规则代替）</span>
            <div className="flex gap-1"><input value={say} onChange={(e) => setSay(e.target.value)} className="min-w-0 flex-1 border border-line px-1" data-testid="octo-nl" /><Btn submit t="octo-nl-send">说</Btn></div>
            {nlOut && <p className="font-mono text-[11px]" data-testid="octo-nl-out">“大模型”（模拟）→ {nlOut.zh}{mode === "mcp" ? nlOut.calls.map((c, i) => <span key={i}><br />{c.tool} {JSON.stringify(c.args)} → {nlOut.res[i]}</span>) : nlOut.serial ? <><br />串口 → {nlOut.serial}</> : null}</p>}
          </form>
        </fieldset>}
        {!noBody && <TopView snap={snap} plan={plan} />}
        {built && <div className="flex flex-wrap items-center gap-1" data-testid="octo-cams"><span>镜头：</span>{CAMS.map((c) => <Btn key={c.k} t={`cam-${c.k}`} on={() => setCam(c.k, handle.current?.motion)}>{c.zh}</Btn>)}</div>}
        {built && B3 && snap.loco && <LocoBox L={snap.loco} mu={mu} setMu={setMu} />}
        {built && B3 && snap.loco && <OctoGait variant={variant} plan={plan} mu={mu} send={send} />}
        {built && B3 && (handle.current?.motion?.taut || 0) >= TAUT && <p className="text-amber-700" data-testid="octo-tether">实物里导线会在这附近拉紧（{handle.current.motion.tautCable}：两端直线距离已到线长的 {Math.round(handle.current.motion.taut * 100)}%）；v9 仿真不让导线拽机身，机身照样按触手摩擦走。</p>}
        {!noBody && <details data-testid="octo-adv-ch">
          <summary className="cursor-pointer font-medium">{variant === "v10" ? "通道监视（QT Py LEDC GPIO → 舵机）" : "通道监视（PCA9685 → 舵机）"}</summary>
          <table className="mt-1 w-full font-mono text-[10px]" data-testid="octo-channels"><thead><tr className="text-ink-soft"><th>通道</th><th>舵机</th><th>脉宽 µs</th><th>指令°</th><th>实际°</th><th>A</th><th /></tr></thead><tbody>
            {snap.servos.map((s) => <tr key={s.role} className={s.buzz || s.collide ? "text-red-700" : ""}><td>{s.ch}</td><td>{s.role}{s.type === "360" ? "(360°)" : ""}</td><td>{s.us ? s.us.toFixed(0) : "—"}</td><td>{s.cmd == null ? "—" : s.cmd.toFixed(0)}</td><td>{s.ang.toFixed(0)}</td><td>{s.I.toFixed(2)}</td><td>{s.collide ? "碰" : s.buzz ? "响" : ""}</td></tr>)}
          </tbody></table>
        </details>}
        {snap.log.length > 0 && <pre className="max-h-32 overflow-auto border border-line bg-white p-1 text-[10px]" data-testid="octo-log">{snap.log.slice(-14).join("\n")}</pre>}
        {snap.events.length > 0 && <ul className="text-[11px] text-ink-soft">{snap.events.slice(-5).map((e, i) => <li key={i}>{e.t}s {e.zh}</li>)}</ul>}
        <p className="text-ink-soft">{EST.friction}。{variant === "v10" ? V10_EST.gap : isB ? EST.gap : ""}</p>
      </>}
      <Btn t="octo-guide" dis={!built} on={onExport} cls="border-copper">生成八爪鱼装配指南（md 原文 .ino、引脚表、对照现实、出处表、价格）</Btn>
    </div>
  );
}
