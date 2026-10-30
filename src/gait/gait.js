// v13 步态编辑器的数学层（我的补充）：每个关节一条周期曲线
//   值(t) = offset + amp · wave(frac(t·freq + phase/360), duty)
// wave：sine = cos(2πp)（p=0 时 +1，和固件三角波同相位起点）、tri = 固件 octopus_gait.h 的三角波（duty 内从 +1 降到 −1，其余时间回来）、
//       square（duty 内 +1，其余 −1）、saw（1 → −1 线性，然后跳回）。
// 同一套公式在 C++ 里是 octopus_gait_custom.h（toFirmwareHeader 生成），scripts/gait-test.mjs 用 g++ 把两边逐点对一遍。
export const WAVES = { sine: "正弦", tri: "三角（固件默认）", square: "方波", saw: "锯齿" };
export const frac = (x) => x - Math.floor(x);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export function wave(kind, p, duty = 0.5) {
  const d = clamp(duty, 0.05, 0.95);
  if (kind === "sine") return Math.cos(2 * Math.PI * p);
  if (kind === "square") return p < d ? 1 : -1;
  if (kind === "saw") return 1 - 2 * p;
  return p < d ? 1 - 2 * (p / d) : -1 + 2 * ((p - d) / (1 - d));
}
export const jointValue = (J, t) => (+J.offset || 0) + (+J.amp || 0) * wave(J.wave, frac(t * (+J.freq || 0) + (+J.phase || 0) / 360), J.duty);
export const gaitValues = (g, t) => g.joints.map((J) => jointValue(J, t));
// 一个周期（取最慢关节的周期）
export const gaitPeriod = (g) => 1 / Math.max(1e-3, Math.min(...g.joints.map((J) => +J.freq || 1e9)));
// 预览曲线：SVG path，x 轴 0..T，y 轴 ±range
export function curvePath(J, w, h, T = 2, range = 60, n = 120) {
  let d = "";
  for (let i = 0; i <= n; i++) { const t = (T * i) / n, v = jointValue(J, t); d += `${i ? "L" : "M"}${((w * i) / n).toFixed(1)},${(h / 2 - (v / range) * (h / 2)).toFixed(1)}`; }
  return d;
}
// 最大角速度（°/s），给“舵机跟不跟得上”的提示
export function maxRate(J) {
  let m = 0; const f = +J.freq || 0, n = 400;
  for (let i = 0; i < n; i++) { const t0 = i / n / Math.max(f, 1e-6), t1 = (i + 1) / n / Math.max(f, 1e-6); m = Math.max(m, Math.abs(jointValue(J, t1) - jointValue(J, t0)) / (t1 - t0)); }
  return J.wave === "square" || J.wave === "saw" ? Infinity : m;
}
export const newJoint = (name, o = {}) => ({ name, amp: 20, phase: 0, offset: 0, freq: 0.6, wave: "sine", duty: 0.5, ...o });
// 预设（我的补充）。weights：每个关节的摆幅系数（八爪鱼 = cos(安装角)，左右舷反向，前后两条 0）
export const PRESETS = { alternating: "交替（两组相差 180°）", wave: "波浪（相位依次错开）", tripod: "三组轮换（类三足，相差 120°）", firmware: "固件默认（v10 方案 A）" };
export function preset(kind, names, { amp = 30, freq = 0.6, wave: wv = "tri", duty = 0.6, weights = null } = {}) {
  const n = names.length, w = (i) => (weights ? weights[i] : 1);
  const ph = (i) => (kind === "alternating" ? (i % 2) * 180 : kind === "tripod" ? (i % 3) * 120 : kind === "firmware" ? 45 * i : (360 / n) * i);
  return { name: PRESETS[kind] || kind, joints: names.map((nm, i) => newJoint(nm, { amp: +(amp * w(i)).toFixed(4), phase: ph(i) % 360, freq, wave: wv, duty })) };
}
// —— 八爪鱼 ——
export const OCTO_MOUNT = (a) => -90 + 45 * a; // octopus_gait.h MountAngle
export const OCTO_SIDE = Array.from({ length: 8 }, (_, a) => +Math.cos((OCTO_MOUNT(a) * Math.PI) / 180).toFixed(6));
export const OCTO_NAMES = Array.from({ length: 8 }, (_, a) => `触手 ${a}（${["正前", "右前", "右", "右后", "正后", "左后", "左", "左前"][a]}）`);
// 和固件默认步态（plusGait("A")：0.6 Hz、30°、相位 45°、duty 0.6、镜像 cos(安装角)）完全相同的自定义步态
export const octoFirmwareGait = () => ({ ...preset("firmware", OCTO_NAMES, { amp: 30, freq: 0.6, wave: "tri", duty: 0.6, weights: OCTO_SIDE }), name: "固件默认（v10 方案 A）" });
export function sanitizeGait(g, n) {
  const J = Array.isArray(g?.joints) ? g.joints : [];
  return { name: String(g?.name || "自定义步态").slice(0, 40), joints: Array.from({ length: n }, (_, i) => { const q = J[i] || {}; return { name: String(q.name || `关节 ${i + 1}`).slice(0, 40), amp: clamp(+q.amp || 0, -90, 90), phase: ((+q.phase || 0) % 360 + 360) % 360, offset: clamp(+q.offset || 0, -90, 90), freq: clamp(+q.freq || 0.6, 0.05, 3), wave: WAVES[q.wave] ? q.wave : "sine", duty: clamp(+q.duty || 0.5, 0.05, 0.95) }; }) };
}
// —— 固件导出：生成 octopus_gait_custom.h（C++17 constexpr 数组，和上面 jointValue 同一个公式） ——
const WAVE_ID = { sine: 0, tri: 1, square: 2, saw: 3 };
export function toFirmwareHeader(g, { source = "台面步态编辑器", stamp = "" } = {}) {
  const J = g.joints.slice(0, 8), f = (x) => `${(+x).toFixed(4)}f`;
  const arr = (k, fmt = f) => `{${J.map((q) => fmt(q[k])).join(", ")}}`;
  return `#pragma once
// 自动生成：${source}${stamp ? " · " + stamp : ""}。步态：${String(g.name).replace(/\n/g, " ")}
// 公式（和网页 src/gait/gait.js 同一个）：yaw(t) = offset + amp · wave(frac(t·freq + phase/360), duty)，单位 °，相对中位 90°。
// 放进 octopus_plus/ 目录即可：octopus_body.h 用 __has_include 检测到它就定义 OCTO_GAIT_CUSTOM，GO 时用这张表代替默认步态。
// 之后照样经过 AntiCollide、软件限位 90±55°、SetMaxRate 300 °/s。LEFT / RIGHT 按左右舷把一侧摆幅缩小（同默认步态的差速转弯）。
#define OCTO_GAIT_CUSTOM 1
#include <cmath>
namespace octo { namespace custom_gait {
// 波形：0 正弦 1 三角 2 方波 3 锯齿
static constexpr int   kWave[8]   = {${J.map((q) => WAVE_ID[q.wave] ?? 0).join(", ")}};
static constexpr float kAmp[8]    = ${arr("amp")};
static constexpr float kPhase[8]  = ${arr("phase")};
static constexpr float kOffset[8] = ${arr("offset")};
static constexpr float kFreq[8]   = ${arr("freq")};
static constexpr float kDuty[8]   = ${arr("duty")};
inline float Wave(int kind, float p, float duty) {
    const float d = duty < 0.05f ? 0.05f : (duty > 0.95f ? 0.95f : duty);
    if (kind == 0) return std::cos(2.0f * static_cast<float>(M_PI) * p);
    if (kind == 2) return p < d ? 1.0f : -1.0f;
    if (kind == 3) return 1.0f - 2.0f * p;
    return p < d ? 1.0f - 2.0f * (p / d) : -1.0f + 2.0f * ((p - d) / (1.0f - d));
}
// t = 步态开始后的秒数；amp_scale = 油门 × 转向缩放
inline float Yaw(int arm, float t, float amp_scale) {
    float x = t * kFreq[arm] + kPhase[arm] / 360.0f;
    float p = x - std::floor(x);
    return kOffset[arm] + kAmp[arm] * amp_scale * Wave(kWave[arm], p, kDuty[arm]);
}
}}  // namespace octo::custom_gait
`;
}
