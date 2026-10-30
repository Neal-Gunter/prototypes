// v16 我的补充：舵机校准（每路中位偏移 / 下限 / 上限，单位 °，相对 90° 中位）。存浏览器 localStorage，导出 octopus_trim_custom.h。
export const CALIB_KEY = "octo.calib.v1";
export const LIM = { center: 20, span: 55 };

export function defaultCalib(channels = 8) {
  return { version: 1, channels, servos: Array.from({ length: channels }, () => ({ center: 0, min: -55, max: 55 })) };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;
// 把任意输入收进安全范围（中位 ±20，下限 −55..0，上限 0..55）
export function sanitizeCalib(c, channels = 8) {
  const d = defaultCalib(channels);
  const src = c && Array.isArray(c.servos) ? c.servos : [];
  d.servos = d.servos.map((s, i) => {
    const x = src[i] || {};
    const num = (v, f) => (typeof v === "number" && Number.isFinite(v) ? v : f);
    return { center: r1(clamp(num(x.center, 0), -LIM.center, LIM.center)), min: r1(clamp(num(x.min, -55), -LIM.span, 0)), max: r1(clamp(num(x.max, 55), 0, LIM.span)) };
  });
  return d;
}

export function loadCalib(storage, channels = 8) {
  try { const t = storage?.getItem(CALIB_KEY); return t ? sanitizeCalib(JSON.parse(t), channels) : defaultCalib(channels); }
  catch { return defaultCalib(channels); }
}
export function saveCalib(storage, c) { try { storage?.setItem(CALIB_KEY, JSON.stringify(c)); return true; } catch { return false; } }

// 逻辑角（相对校准中位）→ 夹到这一路的限位
export function clampPose(deg, calib) {
  return deg.map((d, i) => { const s = calib.servos[i] || { min: -55, max: 55 }; return clamp(d, s.min, s.max); });
}

const f = (v) => { const s = r1(v).toFixed(1); return (s === "-0.0" ? "0.0" : s) + "f"; };
export function toTrimHeader(calib, { source = "台面「实物连接 · 校准」" } = {}) {
  const c = sanitizeCalib(calib, calib?.channels || 8);
  const row = (k) => c.servos.map((s) => f(s[k])).join(", ");
  return `#pragma once
// v16 我的补充：舵机校准表，由 ${source} 导出。放进 octopus_plus 文件夹一起编译，固件 Init() 自动套用。
// 中位偏移（°，±20）：舵机摆臂装歪时把“90°”挪到真正的正中；下限 / 上限（°，相对校准中位，最多 ±55）。
// 早期原型：数值来自你在台面里手动校准，没有自动测量。
#define OCTO_TRIM_CUSTOM 1
namespace octo { namespace trim_custom {
constexpr int kChannels = ${c.channels};
constexpr float kCenter[${c.channels}] = {${row("center")}};
constexpr float kMin[${c.channels}] = {${row("min")}};
constexpr float kMax[${c.channels}] = {${row("max")}};
} }
`;
}

// 校准向导文字（我的补充）
export const WIZARD = [
  { title: "1 · 断开触手", text: "先把触手从舵机摆臂上拆下来（或者把机器人架空），只留舵机。打开「演练」以外的模式前，确认电池电量 > 3.7 V（v10）。" },
  { title: "2 · 回中位", text: "点「全部回中位」：每路发 POSE 0。看摆臂是否正对前方；不正就用「中位 −/+」按 0.5° 微调，直到正中。" },
  { title: "3 · 找下限", text: "选一路，按「下限 −」慢慢往一侧转（每次 2°，限速 ≤ 240 °/s），听到舵机吃力 / 摆臂碰到外壳就退回 5°，记为下限。" },
  { title: "4 · 找上限", text: "同样往另一侧找上限。八路都做完后点「保存」（存在本浏览器 localStorage，不上传）。" },
  { title: "5 · 写进固件", text: "点「导出 octopus_trim_custom.h」，放进 octopus_plus 文件夹重新编译烧录；或者连着板子点「发到板子」（TRIM 指令，断电后失效）。" },
];
