// v15（我的补充）：横坡侧滑补偿对比。在后台另开同配置台面、同一步态，各跑 10 s，比 4 种“支点 + 控制”组合的侧漂 / 速度。
// 全部是简化仿真（Rapier 刚体 + 估算摩擦）；路径保持用的是仿真真值横向位置，实机需要外部定位（光流 / 地标），见 README。
import { useState } from "react";
import { OCTO_CTRL, OCTO_CTRL_WHEEL, OCTO_CTRL_WHEEL_IMU } from "../../gait/ctrl.js";
import { CASTERS } from "../octopus/loco.js";
export const SLIP_ROWS = [
  { k: "ball-open", zh: "万向珠 · 开环（v14 硬件）", caster: null, ctrl: null },
  { k: "ball-ctrl", zh: "万向珠 · v14 航向闭环", caster: null, ctrl: OCTO_CTRL },
  { k: "wheel-open", zh: "定向小轮 · 开环", caster: "wheel", ctrl: null },
  { k: "wheel-imu", zh: "定向小轮 · 航向闭环（只要 IMU）", caster: "wheel", ctrl: OCTO_CTRL_WHEEL_IMU },
  { k: "wheel-path", zh: "定向小轮 · 航向 + 路径保持 PI（要外部定位）", caster: "wheel", ctrl: OCTO_CTRL_WHEEL },
];
const CZH = { ball: "万向珠（v14）", wheel: "定向小轮（v15 推荐）", lock: "万向珠锁死（对照）", rubber: "硅胶脚垫（对照）" };
const f = (x, n = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(n));
export default function SlipPanel({ measure, onCaster, tid = "octo-slip" }) {
  const [deg, setDeg] = useState(3), [dir, setDir] = useState("cross"), [live, setLive] = useState("ball");
  const [rows, setRows] = useState(null), [busy, setBusy] = useState(null);
  async function run() {
    const out = []; setRows([]);
    for (let i = 0; i < SLIP_ROWS.length; i++) {
      const R = SLIP_ROWS[i]; setBusy(`${i + 1}/${SLIP_ROWS.length} ${R.zh}`);
      const r = await measure({ sec: 10, slope: { deg, dir }, caster: R.caster, ctrl: R.ctrl });
      out.push({ k: R.k, zh: R.zh, ...r }); setRows([...out]);
    }
    setBusy(null); window.__octoSlip = out;
  }
  return (
    <fieldset className="flex flex-col gap-1" data-testid={tid}>
      <legend className="font-medium">横坡侧滑补偿（v15，我的补充 · 简化仿真）</legend>
      <div className="flex flex-wrap items-center gap-1">
        <label>台面支点<select value={live} data-testid={`${tid}-caster`} className="ml-0.5 border border-line bg-white" onChange={(e) => { setLive(e.target.value); onCaster?.(e.target.value); }}>{Object.keys(CASTERS).map((k) => <option key={k} value={k}>{CZH[k] || k}</option>)}</select></label>
        <label>坡度<input type="number" min={0} max={6} step={0.5} value={deg} onChange={(e) => setDeg(+e.target.value)} className="ml-0.5 w-12 border border-line" data-testid={`${tid}-deg`} />°</label>
        <label><select value={dir} onChange={(e) => setDir(e.target.value)} className="border border-line bg-white" data-testid={`${tid}-dir`}><option value="cross">横坡（往右下）</option><option value="crossL">横坡（往左下）</option></select></label>
        <button type="button" disabled={!!busy} onClick={run} data-testid={`${tid}-run`} className="rounded border border-copper px-1.5 disabled:opacity-40">跑 5 组对比（各 10 s）</button>
        {busy && <span data-testid={`${tid}-busy`}>正在跑 {busy}…</span>}
      </div>
      {rows?.length > 0 && <table className="w-full font-mono text-[11px]" data-testid={`${tid}-table`}><thead><tr className="text-ink-soft"><th className="text-left">组合</th><th className="text-right">侧漂 cm</th><th className="text-right">航向 °</th><th className="text-right">速度 cm/s</th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.k} data-testid={`${tid}-row-${r.k}`}><td>{r.zh}</td><td className="text-right">{f(r.dx)}</td><td className="text-right">{f(r.dh, 1)}</td><td className="text-right">{f(r.speed, 3)}</td></tr>)}
      </tbody></table>}
      <p className="text-ink-soft">万向珠往哪都能滚，横坡上整机顺坡往下溜，改控制拦不住（v15 实测：开环 / 航向 / 路径保持 / 蟹行都还漂 30 cm 以上）。换成只沿前后滚的定向小轮（尺寸和摩擦全部估算）后侧向有了摩擦，再加路径保持 PI 能压到几厘米，代价是速度降约 15–35 %（看步态）。锁死万向珠或硅胶脚垫前后也一起拦住，八爪鱼直接走不动（仿真 0 cm/s），只当对照。台面支点下拉框会立刻改 3D 台面里的支点摩擦。</p>
    </fieldset>
  );
}
