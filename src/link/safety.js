// v16 我的补充：主机端安全层。所有发往实物的运动指令先过这里，固件端还有一层同样的范围检查（octopus_link.h）。
import { clampPose } from "./calib.js";

export const SAFETY = {
  nominalRate: 300, // °/s：台面一直用的舵机标称速度（估算，SG90 级 4.8–5 V 约 0.1 s/60°，按 1/2 余量取）
  rateCap: 240, // 80 % 上限（v15 同一个数）
  poseMax: 55,
  goMax: { throttle: 1, steer: 1 },
};
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);

// 估算步态的最大摆动角速度：一个周期里摆 2A，最快的那段用 min(duty, 1-duty) 的时间
export function gaitPeakRate(p) {
  const A = Math.max(num(p.yaw_amp_deg), num(p.lift_amp_deg) + num(p.press_deg));
  const d = clamp(num(p.duty, 0.6), 0.3, 0.9);
  return (2 * A * num(p.freq_hz, 0.6)) / Math.min(d, 1 - d);
}

// 返回 { args, notes[] }；notes 是“被削掉了什么”的中文说明
export function guard(cmd, args, { calib, rateCap = SAFETY.rateCap } = {}) {
  const notes = [];
  const cut = (name, a, b) => { if (Math.abs(a - b) > 1e-9) notes.push(`${name} ${+a.toFixed(2)} → ${+b.toFixed(2)}`); return b; };
  if (cmd === "GO") {
    const t = cut("油门", num(args[0]), clamp(num(args[0]), 0, 1));
    const s = cut("转向", num(args[1]), clamp(num(args[1]), -1, 1));
    return { args: [t, s], notes };
  }
  if (cmd === "POSE") {
    const raw = args.map((v) => clamp(num(v), -SAFETY.poseMax, SAFETY.poseMax));
    const out = calib ? clampPose(raw, calib) : raw;
    out.forEach((v, i) => { if (Math.abs(v - num(args[i])) > 1e-9) notes.push(`舵机 ${i} ${+num(args[i]).toFixed(1)}° → ${+v.toFixed(1)}°（校准限位）`); });
    return { args: out, notes };
  }
  if (cmd === "RATE") return { args: [cut("限速", num(args[0], rateCap), clamp(num(args[0], rateCap), 30, Math.min(240, rateCap)))], notes };
  if (cmd === "GAIT") {
    const p = { freq_hz: clamp(num(args.freq_hz, 0.6), 0.1, 1.2), yaw_amp_deg: clamp(num(args.yaw_amp_deg, 30), 0, 55), lift_amp_deg: clamp(num(args.lift_amp_deg, 20), 0, 55), phase_deg: clamp(num(args.phase_deg, 90), 0, 360), duty: clamp(num(args.duty, 0.6), 0.3, 0.9), press_deg: clamp(num(args.press_deg, 0), 0, 40) };
    const peak = gaitPeakRate(p);
    if (peak > rateCap) { const f = Math.max(0.1, (p.freq_hz * rateCap) / peak); notes.push(`频率 ${p.freq_hz.toFixed(2)} → ${f.toFixed(2)} Hz（估算峰值 ${peak.toFixed(0)}°/s 超过 ${rateCap}°/s）`); p.freq_hz = Math.floor(f * 100) / 100; }
    return { args: [p.freq_hz, p.yaw_amp_deg, p.lift_amp_deg, p.phase_deg, p.duty, p.press_deg], notes, params: p };
  }
  if (cmd === "TRIM") return { args: [clamp(Math.trunc(num(args[0])), 0, 15), clamp(num(args[1]), -20, 20), clamp(num(args[2]), -55, 0), clamp(num(args[3]), 0, 55)], notes };
  return { args, notes };
}
export const MOTION = new Set(["GO", "POSE", "GAIT"]);
