// v10 紧凑无线版（我的补充）：全部板载、电池供电、手机当“大脑”（BLE）。只用能从数据手册 / 零件库量出尺寸的零件。
// 每个数字都写出处；没有出处的标“估算”。
import { FRAME_V10, ARM_V10, SG51R_GEO } from "./parts.js";

// —— 已核对的数据（Adafruit 商品页 / 数据手册，2026-10 打开核对）——
export const SG51R = {
  src: "Adafruit 2201 SG51R 页面：4.8 V 堵转 0.6 kgf·cm、0.1 s/60°、5 g；脉宽 0.75–2.25 ms 对应全行程（≈ 180°）",
  stallAt48: 0.6, speed48: 600, mass: 0.005, us0: 750, us1: 2250,
};
// 高于 4.8 V 页面没给数：不外推，按 0.6 kgf·cm 封顶（保守）；低于 4.8 V 按比例降（估算）
export function sg51rStall(v) { if (!(v > 0)) return 0; return v >= 4.8 ? 0.6 : 0.6 * (v / 4.8); }
export const BOOST = {
  src: "Adafruit 4654 MiniBoost（TPS61023）页面：输出 5.2 V；最大输出 800 mA@3 V、1100 mA@3.5 V、1400 mA@4 V；3.7 V 输入时 ≤ 500 mA 效率 88%、1 A 78%；EN 拉低 = 输出真断开；1.0 g",
  vout: 5.2, limit: [[2.0, 0.3], [2.5, 0.5], [3.0, 0.8], [3.5, 1.1], [4.0, 1.4]], mass: 0.001,
};
export const boostLimitA = (vin) => { const L = BOOST.limit; if (vin <= L[0][0]) return vin >= 1.8 ? L[0][1] : 0; for (let i = 1; i < L.length; i++) if (vin <= L[i][0]) { const [x0, y0] = L[i - 1], [x1, y1] = L[i]; return y0 + ((vin - x0) / (x1 - x0)) * (y1 - y0); } return L.at(-1)[1]; };
export const boostEff = (iout) => (iout <= 0.5 ? 0.88 : iout >= 1 ? 0.78 : 0.88 - ((iout - 0.5) / 0.5) * 0.1);
export const LIPO = { src: "Adafruit 258 页面：3.7 V 1200 mAh、约 4.5 Wh、23 g、34 × 62 × 5 mm；保护板 3.0 V 左右切断；线材按 2 A 设计", mah: 1200, wh: 4.44, mass: 0.023, cut: 3.0 };
export const QTPY = { src: "Adafruit 5426 QT Py ESP32‑S3（无 PSRAM，8 MB Flash）：1.2 g；背面 BAT 焊盘 3–6 V；3.3 V 稳压最大 600 mA", mass: 0.0012 };
export const CHARGER = { src: "Adafruit 4410 Micro‑Lipo USB‑C：充电电流 100 / 500 mA 可选（板上跳线）；重量页面没写", mass: 0.002, massEst: true };
export const SWITCH = { src: "Adafruit 805 拨动开关：0.07 g；页面没写额定电流 → 只让它过小电流（QT Py + 两个 EN），舵机大电流不经过它", mass: 0.00007 };

// QT Py 引脚 → GPIO（Adafruit QT Py ESP32‑S3 引脚图）。S3 的 LEDC 有 8 个通道：8 个舵机正好用满
export const SERVO_PINS = [
  { pad: "A0", gpio: 18 }, { pad: "A1", gpio: 17 }, { pad: "A2", gpio: 9 }, { pad: "SDA", gpio: 7 },
  { pad: "SCL", gpio: 6 }, { pad: "TX", gpio: 5 }, { pad: "RX", gpio: 16 }, { pad: "SCK", gpio: 36 },
];
export const BATT_PIN = { pad: "A3", gpio: 8, ratio: 2, cut: 3.55, resume: 3.75, src: "100k / 100k 分压 → A3（GPIO8，ADC1_CH7）：4.2 V → 2.1 V（< 2.9 V 校准量程，乐鑫文档）。3.55 V 停运动、3.75 V 恢复是估算阈值：保护板 3.0 V 才切断，但 BAT 焊盘二极管 + 3.3 V LDO 让 QT Py 在电芯带载约 3.4 V 以下就会掉电复位（仿真里会反复重启），所以要提前停" };

// 质量表（g）。V = 页面数字，E = 估算
export const MASS_V10 = [
  { k: "SG51R × 8", g: 8 * 5, src: "V" }, { k: "1200 mAh LiPo", g: 23, src: "V" }, { k: "QT Py ESP32‑S3", g: 1.2, src: "V" }, { k: "MiniBoost × 2", g: 2, src: "V" },
  { k: "拨动开关", g: 0.07, src: "V" }, { k: "USB‑C 充电板", g: 2, src: "E" }, { k: "分压板 + 2 颗电容", g: 1.5, src: "E" }, { k: "导线", g: 4, src: "E" },
  { k: "万向珠 × 3", g: 9, src: "E" }, { k: "PLA 骨架", g: 22, src: "E" }, { k: "PLA 触手 × 8", g: 12, src: "E" },
];
// v14 闭环选配（不计入上面的基准质量；鲁棒性测试的 ±质量覆盖这 1.8 g）
export const IMU_V10 = { k: "MPU‑6050（Adafruit 3886，选配）", g: 1.8, src: "V", note: "Adafruit 3886 产品页 1.8 g；接 QT Py STEMMA QT 口（Wire1）" };
export const massV10 = () => MASS_V10.reduce((s, r) => s + r.g, 0) / 1000;

// 物理几何（cm）：和 parts.js 的 CAD / 程序零件一致
export const GEO_V10 = {
  plateR: FRAME_V10.R, plateT: FRAME_V10.t, yawR: FRAME_V10.yawR, yawH: FRAME_V10.t + SG51R_GEO.shaftTop,
  tip: ARM_V10.tip, seg: ARM_V10.seg, segR: 0.15, horn: [0.5, 0.15, 0.25], hornAt: 0.5, armI: 0.15, comY: 2.0, rg: 4.0,
  stall: sg51rStall, servoMass: SG51R.mass,
};
export const V10_EST = {
  current: "SG51R 电流页面没写：把 MG90S 的估算模型按堵转扭矩比 0.6 / 1.8 = 1/3 缩小——保持 0.0033 A、运动 0.04 + 0.15·(速度/最高速) A、堵转 0.23 A（估算）",
  qtpy: "QT Py + BLE 平均 0.08 A @3.7 V（估算；WiFi 发射峰值更高）",
  armI: "SG51R 转子反射惯量 0.15 kg·cm²（MG90S 估算值 0.5 按体积缩小，估算）",
  gap: "相邻触手：在 v10 触手的 2D 轮廓上扫遍 ±55°，夹角 < −35° 才碰（scripts/octo-test.mjs 里复算），软件限位 ±55° 内碰不到",
};
