// v14（我的补充）：闭环倾斜 / 航向反馈。浏览器、node、Worker、固件 JS 孪生共用；C++ 版见 octopus_ctrl.h（同一套式子）。
// 1) SimImu：把 IMU 真值加上噪声和延迟（估算，量级参考 MPU-6050 datasheet：陀螺噪声 0.005 °/s/√Hz、加速度 400 µg/√Hz，
//    这里按 100 Hz 采样、带宽约 44 Hz 折成 rms 并放大到更保守的 0.1 °/s、0.004 g；不模拟零偏，固件上电做 1 s 陀螺校准）
// 2) Attitude：互补滤波（α = 0.98）得横滚 / 俯仰；陀螺 Z 积分得航向
// 3) TiltCtrl：PD。航向 → 左右两侧摆幅差（差速转向）；倾斜 → 每个关节的偏置
import { mulberry32, gaussFn } from "./rng.js";
export const IMU_EST = {
  noise: "噪声（估算）：陀螺 0.1 °/s rms、加速度 0.004 g rms；MPU-6050 datasheet 的噪声密度折算后更小，这里取保守值",
  delay: "延迟（估算）：20 ms（I²C 读 14 字节 + DLPF 44 Hz 的群延迟量级）；八爪鱼台面另有 5 ms 子步",
  bias: "不模拟陀螺零偏和温漂：固件上电静止 1 s 求平均当零偏（octopus_imu.h），残余零偏会让航向慢慢漂",
  mount: "安装：IMU 平放在机身中心，X = 机身前方、Y = 左、Z = 上（我的补充）",
};
export const DEFAULT_IMU = { gyroNoise: 0.1, accNoise: 0.004, delay: 0.02, rate: 100, seed: 7 };
export const DEFAULT_CTRL = { kpH: 0.04, kdH: 0.004, kpT: 0, kdT: 0, uMax: 0.5, offMax: 15, turnSign: 1, alpha: 0.98, adapt: false, flipT: 1.0, flipDeg: 2, slopeFlipDeg: 0, crab: 0, kPath: 0, kiPath: 0, pathMax: 30 };
// 八爪鱼的默认（我的补充）：横坡换号打开（见 TiltCtrl 注释）；倾斜项默认关（八爪鱼趴在万向珠上，倾角本来就很小）
// v14：adapt 打开——坡道换号规则是用同步划桨标定的，换成 v14 搜索步态时符号会反；自适应翻号兜底（见 v14-test）
export const OCTO_CTRL = { ...DEFAULT_CTRL, slopeFlipDeg: 1.5, adapt: true };
// 通用模型（四足等）的默认：先只开倾斜（航向的转向符号因模型而异，要先点“标定转向符号”）
export const LAB_CTRL = { ...DEFAULT_CTRL, kpH: 0, kdH: 0, kpT: 0.5, kdT: 0.02 };

export class SimImu {
  constructor(o = {}) { this.o = { ...DEFAULT_IMU, ...o }; this.g = gaussFn(mulberry32(this.o.seed)); this.buf = []; this.tLast = -1e9; }
  // 每个物理子步都喂真值（t 秒）；按采样率存一帧、加噪声
  feed(t, truth) {
    if (t - this.tLast < 1 / this.o.rate - 1e-9) return;
    this.tLast = t; const n = this.g, o = this.o;
    this.buf.push({ t, acc: truth.acc.map((v) => v + n() * o.accNoise), gyro: truth.gyro.map((v) => v + n() * o.gyroNoise) });
    while (this.buf.length > 2 && this.buf[1].t <= t - o.delay - 0.05) this.buf.shift();
  }
  // 读 t 时刻“已经到达”的最新一帧（延迟 delay 秒）
  read(t) { let s = null; for (const b of this.buf) if (b.t <= t - this.o.delay + 1e-9) s = b; return s || this.buf[0] || null; }
}
export class Attitude {
  constructor(alpha = 0.98) { this.alpha = alpha; this.roll = 0; this.pitch = 0; this.yaw = 0; this.init = false; this.rate = [0, 0, 0]; }
  update(s, dt) {
    if (!s) return this;
    const [ax, ay, az] = s.acc, [gx, gy, gz] = s.gyro, k = Math.PI / 180;
    const rA = Math.atan2(ay, az), pA = Math.atan2(-ax, Math.hypot(ay, az));
    if (!this.init) { this.roll = rA; this.pitch = pA; this.init = true; }
    else { this.roll = this.alpha * (this.roll + gx * k * dt) + (1 - this.alpha) * rA; this.pitch = this.alpha * (this.pitch + gy * k * dt) + (1 - this.alpha) * pA; }
    this.yaw += gz * k * dt; this.rate = [gx * k, gy * k, gz * k];
    return this;
  }
  // 世界“上”方向在传感器系里的单位向量（小角度）
  up() { const r = this.roll, p = this.pitch; return [-Math.sin(p), Math.sin(r) * Math.cos(p), Math.cos(r) * Math.cos(p)]; }
}
// PD：u = 航向修正（正 = 想往左转，范围 ±uMax）；tilt = {ux, uy}：传感器系里“上”方向的水平分量（≈ 倾斜方向，rad）和它的变化率
export class TiltCtrl {
  constructor(o = {}) { this.o = { ...DEFAULT_CTRL, ...o }; this.att = new Attitude(this.o.alpha); this.yaw0 = null; this.prevUp = null; this.sign = 1; this.flips = 0; this.satT = null; }
  step(sample, dt) {
    const a = this.att.update(sample, dt), o = this.o;
    if (this.yaw0 == null && a.init) this.yaw0 = a.yaw;
    // v15（我的补充）：航向设定值不再固定是起步航向——
    //  crab：横坡“蟹行”前馈：设定值 = 起步航向 + crab × 横滚（°/°）。只用 IMU，固件能做
    //  kPath / kiPath：路径保持（PI）：设定值再加 kPath·横向偏移(cm，右为正 → 设定值往左) + kiPath·∫横向偏移，夹在 ±pathMax°。横向偏移要外部测（光流 / 摄像头 / UWB），
    //  仿真里用真值（简化）；固件留了 SetLateral() 口（octopus_ctrl.h）
    let sp = 0;
    if (o.crab) sp += o.crab * a.roll;
    if ((o.kPath || o.kiPath) && this.lateral != null) { this.iLat = (this.iLat || 0) + this.lateral * dt; sp += clamp(o.kPath * this.lateral + o.kiPath * this.iLat, -o.pathMax, o.pathMax) * Math.PI / 180; }
    this.sp = sp;
    const eH = (this.yaw0 ?? 0) + sp - a.yaw; // rad；机身右转了 → yaw 变小 → eH > 0 → 往左修
    let u = clamp((o.kpH * eH * 180) / Math.PI - (o.kdH * a.rate[2] * 180) / Math.PI, -o.uMax, o.uMax) * this.sign;
    // 自适应转向符号（我的补充）：仿真里发现“差速缩摆幅往哪边转”在平地和横坡上相反（横坡上机身在万向珠上往下滑，触手推力的力臂变了）。
    // 规则：控制量顶到上限超过 flipT 秒、航向误差反而又变大了 flipDeg 度 → 认为符号反了，翻过来。
    // 坡道换号（我的补充，仿真经验规则 估算）：机身横滚（IMU 估计，横坡）> slopeFlipDeg 时转向符号取反——见 ctrl-test 的数据。
    const tiltNow = Math.abs((a.roll * 180) / Math.PI); // 只看横滚（横坡）；顺坡 / 逆坡（俯仰）不换号
    if (o.slopeFlipDeg > 0) { this.slopeMode = this.slopeMode ? tiltNow > o.slopeFlipDeg * 0.6 : tiltNow > o.slopeFlipDeg; if (this.slopeMode) u = -u; }
    const eD = Math.abs((eH * 180) / Math.PI);
    if (o.adapt && Math.abs(u) >= 0.95 * o.uMax) { if (this.satT == null) { this.satT = 0; this.satE = eD; } this.satT += dt; if (this.satT > o.flipT && eD > this.satE + o.flipDeg) { this.sign = -this.sign; this.flips++; this.satT = null; u = -u; } }
    else this.satT = null;
    const up = a.up(), dUp = this.prevUp ? [(up[0] - this.prevUp[0]) / dt, (up[1] - this.prevUp[1]) / dt] : [0, 0]; this.prevUp = up;
    return { u, slopeMode: !!this.slopeMode, sign: this.sign, flips: this.flips, eHdeg: (eH * 180) / Math.PI, roll: (a.roll * 180) / Math.PI, pitch: (a.pitch * 180) / Math.PI, up, dUp };
  }
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// —— 八爪鱼：把控制量变成每条触手的“摆幅倍数”和“偏置”（固件 JS 孪生 / C++ 同式） ——
// 航向：想往左转（u > 0）就把左舷摆幅 × (1 − |u|)，想往右转就把右舷缩小（turnSign 翻转约定）；正前 / 正后不变；只减不增
// 倾斜：偏航偏置 = kpT · (触手切向 · 下坡方向) · 倾角 + kdT · 变化率，夹在 ±offMax（让触手往低处张开，扩大低侧的支撑面）
export function octoCorrections(out, o, mountDeg) {
  const sc = [], off = [];
  // 传感器系 → 机身平面：X 前、Y 左。下坡方向 = −up 的水平分量
  const dx = -out.up[0], dy = -out.up[1], ddx = -out.dUp[0], ddy = -out.dUp[1];
  for (let a = 0; a < 8; a++) {
    const th = (mountDeg(a) * Math.PI) / 180, c = Math.cos(th), sg = c > 1e-3 ? 1 : c < -1e-3 ? -1 : 0;
    sc.push(clamp(1 + Math.min(0, o.turnSign * out.u * sg), 0, 1)); // 只减不增：不超过原摆幅（不撞限速 / 限位）
    // 安装角 θ：0° = 机身右（+x），−90° = 正前；偏航 +1° 让触手尖沿切向 (−sinθ, cosθ)（x 右、z 后）移动。机身平面：前 = −z、左 = −x
    const tx = -Math.sin(th), tz = Math.cos(th); // 世界 x 右、z 后
    const tF = -tz, tL = -tx; // 换到 前 / 左
    const k = (180 / Math.PI) * (o.kpT * (tF * dx + tL * dy) + o.kdT * (tF * ddx + tL * ddy));
    off.push(clamp(k, -o.offMax, o.offMax));
  }
  return { sc, off };
}

// —— 通用模型（上传的带关节模型）：每个关节的“影响系数” ——
// infl = 关节转 1 rad，下游子树质心升高多少（cm）；r = 下游子树质心相对整机质心的水平位置（机身系：x 右、z 后）
// 倾斜修正 Δθ = kpT · h · infl / (infl² + ε²)，h = 该处相对机身中心的高度差（≈ r · 上方向水平分量），ε = 0.3·max|infl|（Tikhonov，我的补充）
// 航向修正：和八爪鱼一样“只减不增”——想往左转就把左侧（x < 0）关节摆幅缩小，反之缩右侧
export function articCorrections(out, o, geo) {
  const up = out.up, dUp = out.dUp; // 传感器系 X 前、Y 左 → 机身系 x 右 = −Y，z 后 = −X
  const ux = -up[1], uz = -up[0], dux = -dUp[1], duz = -dUp[0];
  const eps = 0.3 * Math.max(1e-6, ...geo.map((q) => Math.abs(q.infl)));
  return geo.map((q) => {
    const h = q.r[0] * ux + q.r[1] * uz, dh = q.r[0] * dux + q.r[1] * duz;
    const g = q.infl / (q.infl * q.infl + eps * eps);
    const offDeg = q.revolute ? clamp(((o.kpT * h + o.kdT * dh) * g * 180) / Math.PI, -o.offMax, o.offMax) : 0;
    return { jid: q.jid, scale: Math.abs(q.r[0]) > 0.3 ? clamp(1 + Math.min(0, o.turnSign * out.u * Math.sign(q.r[0])), 0, 1) : 1, off: offDeg };
  });
}

// C++ 导出：octopus_ctrl_custom.h（只有增益和 IMU 参数；算法在 octopus_ctrl.h）
export function toCtrlHeader(c, { source = "台面闭环面板" } = {}) {
  const o = { ...OCTO_CTRL, ...c }, f = (x) => `${(+x).toFixed(5)}f`;
  return `#pragma once
// 自动生成：${source}。闭环倾斜 / 航向反馈的增益（我的补充，仿真整定，未上实机）
// 放进 octopus_plus/ 目录：octopus_body.h 用 __has_include 检测到它就定义 OCTO_CTRL_CUSTOM，打开 IMU（MPU-6050，Wire1 SDA 41 / SCL 40 = QT Py 的 STEMMA QT 口）
// 和 octopus_ctrl.h 里的 PD 控制器。读不到 IMU（WHO_AM_I ≠ 0x68）就自动退回开环。
#define OCTO_CTRL_CUSTOM 1
namespace octo { namespace ctrl_cfg {
static constexpr float kKpH = ${f(o.kpH)};     // 航向 P：每 1° 航向误差 → 摆幅差
static constexpr float kKdH = ${f(o.kdH)};     // 航向 D：每 1 °/s 角速度
static constexpr float kKpT = ${f(o.kpT)};     // 倾斜 P：rad 偏置 / rad 倾角
static constexpr float kKdT = ${f(o.kdT)};     // 倾斜 D
static constexpr float kUMax = ${f(o.uMax)};   // 摆幅差上限
static constexpr float kOffMax = ${f(o.offMax)}; // 偏置上限（°）
static constexpr float kTurnSign = ${f(o.turnSign)}; // 仿真标定的转向符号
static constexpr float kAlpha = ${f(o.alpha)};  // 互补滤波系数
static constexpr float kSlopeFlipDeg = ${f(o.slopeFlipDeg)}; // 横滚超过这个角度（横坡）转向符号取反（仿真经验规则，0 = 关）
static constexpr bool kAdapt = ${o.adapt ? "true" : "false"};     // 自适应转向符号（控制量饱和且误差变大 → 翻号）
static constexpr float kFlipT = ${f(o.flipT)};   // 饱和多少秒才判断
static constexpr float kFlipDeg = ${f(o.flipDeg)}; // 误差又变大多少度才翻
}}  // namespace octo::ctrl_cfg
`;
}
