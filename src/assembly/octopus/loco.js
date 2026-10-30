// v9：八爪鱼“真的走”——机身是有重力的刚体，触手是关节连着的刚体，靠触手和桌面的接触摩擦推着机身走。
// 舵机：关节位置马达，目标 = 模拟 PCA9685 输出的舵机角（已按 datasheet 空载速度限速），力矩上限 = MG90S 堵转扭矩（datasheet）。
// 单位：cm、kg、s（重力 981 cm/s²）。凡是没出处的数都标“估算”。
import RAPIER from "@dimforge/rapier3d-compat";
import { Gait } from "./firmware.js";
import { FRAME } from "./parts.js";
import { GEO_V10, massV10, MASS_V10, SG51R } from "./v10.js";

export const MG90S = {
  src: "Tower Pro MG90S datasheet：堵转扭矩 1.8 kgf·cm @4.8 V、2.2 kgf·cm @6 V；0.10 s/60° @4.8 V、0.08 s/60° @6 V；13.4 g",
  stall: [[4.8, 1.8], [6.0, 2.2]], mass: 0.0134,
};
const G = 981; // cm/s²
// 堵转扭矩随电压线性插值（两点之间是我的估算；低于 4.8 V 按比例降，高于 6 V 不再加）
export function stallKgfCm(v) { if (!(v > 0)) return 0; if (v <= 4.8) return 1.8 * (v / 4.8); if (v >= 6) return 2.2; return 1.8 + ((v - 4.8) / 1.2) * 0.4; }
export const kgfcm = (t) => t * G; // kgf·cm → kg·cm²/s²

export const LOCO_EST = {
  mass: "机身质量按 md 采购清单“重量构成”：MG90S 13.4 g/个（datasheet）、PCA9685 15 g、线材 20 g、PLA 结构 150–250 g（md）；主控和电池按 md“开发板外置”放在桌上，不算进机身",
  mu: "触手尖 / 底板和桌面的摩擦系数：PLA 对木桌约 0.3–0.6（估算，可调）",
  servo: "舵机 = 关节位置马达：目标角来自模拟 PCA9685（空载限速），力矩上限 = 堵转扭矩（datasheet，按舵机电压插值）；刚度 = 偏差 5° 时出满扭矩（估算）",
  caster: "完善版 A 万向珠：滚动阻力等效摩擦 0.02（估算），凸出底板 0.3 cm（估算）",
  pad: "完善版 A 单向鳞片脚垫：触手尖相对桌面往机身后方滑时摩擦 0.45、往前滑时 0.15（估算），每一步按上一步的滑动方向切换",
  press: "完善版 B 支撑相下压（我的补充）：支撑相俯仰舵机往下压 press 度，把机身从底板上撑起来，触手尖才有正压力、才推得动",
  sink: "已知残差：完善版 B 支撑相触手尖球会陷进桌面约 2.2 mm（A 约 0.3 mm）。这是 Rapier 冲量关节在“4 g 触手托 449 g 机身”这种质量比下的求解器残差，改迭代数、步长、接触刚度都不变；UI 里如实显示“陷入”",
  limits: "没算：导线拉力、舵机内部回差、PLA 弯曲变形；相邻触手互碰由固件防撞处理，这里触手只和桌面碰",
};

// v15（我的补充）：机身底下 3 个支点。数字都是估算，没有实测：
export const CASTERS = {
  ball: { zh: "万向珠（原来的）", mu: () => 0.02, note: "滚动阻力等效摩擦 0.02（估算），各方向都能滚 → 横坡上整机往下滑" },
  lock: { zh: "万向珠 + 顶丝锁死", mu: () => 0.3, note: "珠子不转，变成钢珠在桌面上滑：摩擦 0.3（估算，钢 / 木）；前后左右一样大" },
  rubber: { zh: "硅胶脚垫", mu: (m) => Math.max(0.6, m), note: "硅胶对木桌：摩擦 0.6 以上（估算）；前后左右一样大" },
  wheel: { zh: "定向小轮（只沿前后滚）", roll: 0.02, side: 0.5, mu: () => 0.02, note: "前后方向滚动阻力 0.02、侧向 0.5（估算，按桌面 μ 缩放）；侧向摩擦用显式库仑冲量近似（Rapier 只有各向同性摩擦，简化）" },
};

export function bodyMassKg(plan, variant) {
  if (variant === "v10") { // v10：全部板载（v10.js 质量表，页面数字 + 估算）；触手 PLA 12 g / 8、尖球分 30%
    const total = massV10(), arm = (MASS_V10.find((r) => r.k.startsWith("PLA 触手")).g / 1000) / 8;
    return { total, torso: total - 8 * arm, arm, link: 0 };
  }
  // md 采购清单：PLA 150–250 g。方案 A 没有俯仰支架，取下限 150 g；方案 B 取中间 200 g（估算）
  const servoOnBody = 8 * MG90S.mass, pca = 0.015, wire = 0.02;
  const pla = plan === "B" ? 0.2 : 0.15, armPla = plan === "B" ? 8 * 0.004 : 8 * 0.005, bracket = plan === "B" ? 8 * 0.002 : 0;
  const pitch = plan === "B" ? 8 * MG90S.mass : 0;
  const casters = plan === "A" && variant === "plus" ? 3 * 0.003 : 0; // 估算
  const frame = pla - armPla - bracket;
  return { total: servoOnBody + pca + wire + pla + pitch + casters, torso: servoOnBody + pca + wire + frame + casters, arm: armPla / 8, link: (bracket + pitch) / 8 };
}


// A 触手的弯曲柔度（估算）：完善版按“压下 3° 正好分担 tipShare”反算刚度；原样 A 没有预压，取同量级刚度
const FLEX_DEG = 3, FLEX_K0 = 2000;
const ARM_I = 0.5; // kg·cm²（估算）：MG90S 转子惯量 × 减速比² 的量级
const GRP_GROUND = 0x0001, GRP_ROBOT = 0x0002;
const groups = (member, filter) => (member << 16) | filter;

let rapierReady = null;
export class LocoPhys {
  // 浏览器和 node 都能用：先 init Rapier（只做一次），再建
  static async create(sim, opts) { await (rapierReady ||= RAPIER.init()); return new LocoPhys(RAPIER, sim, opts); }
  // R = 已 init 的 RAPIER；sim = OctoSim；c = 机身中心在世界里的位置（cm，y = 桌面）
  constructor(R, sim, { c = [0, 0, 0], mu = 0.5, dt = 1 / 240, tanOff = 1.52, pad = [0.15, 0.45], massScale = 1, trimDeg = null, slope = null, caster = null } = {}) {
    // v15（我的补充）：caster = 机身底下 3 个支点的类型（见 CASTERS）；null = 原来的万向珠
    this.casterKind = CASTERS[caster] ? caster : "ball";
    // v14（我的补充）：鲁棒性测试用 —— massScale = 机身质量倍数；trimDeg[a] = 第 a 条触手偏航舵机的装配零位误差（°）；slope = {deg, dir} 斜坡
    this.massScale = massScale; this.trim = trimDeg;
    this.tanOff = tanOff; // B 俯仰舵机轴的切向偏置（CAD：+1.52 cm，八条同一侧）
    this.pad = pad; /* v13：单向脚垫 [逆向, 顺向] 摩擦（估算，灵敏度测试用） */ this.R = R; this.sim = sim; this.c = c; this.mu = mu; this.dt = dt;
    const B = sim.bench; this.plan = B.plan; this.variant = B.variant; this.hw = B.plusHw || {};
    this.plusB = this.plan === "B" && this.variant === "plus";
    this.world = new R.World({ x: 0, y: -G, z: 0 });
    this.world.lengthUnit = 100; this.world.timestep = dt; this.world.numSolverIterations = 10; this.world.numInternalPgsIterations = 4; // 舵机链质量比大（机身 ≈ 30× 触手），迭代少了马达推不动（实测）
    const gb = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.ground = this.world.createCollider(R.ColliderDesc.cuboid(300, 1, 300).setTranslation(c[0], -1, c[2]).setFriction(1).setFrictionCombineRule(R.CoefficientCombineRule.Min).setCollisionGroups(groups(GRP_GROUND, GRP_ROBOT)), gb);
    { const m0 = bodyMassKg(this.plan, this.variant); this.m = { ...m0, torso: m0.torso * massScale, total: m0.total + m0.torso * (massScale - 1) }; }
    this.loads = [];
    // 几何：v9 = md 方案 A/B（FRAME、MG90S）；v10 = 紧凑无线版（GEO_V10，和 3D 装配同一份 CAD 尺寸）
    this.geo = this.variant === "v10" ? GEO_V10 : { plateR: FRAME.R, plateT: FRAME.t, yawR: 3.8, yawH: FRAME.t + 3.07, tip: [8.75, -3.2], seg: [[1.0, 0.15], [7.3, -2.5]], segR: 0.18, horn: [0.6, 0.2, 0.3], hornAt: 0.6, armI: ARM_I, comY: 2, rg: 5, stall: stallKgfCm, servoMass: MG90S.mass };
    this.build();
    if (slope) this.setSlope(slope.deg, slope.dir);
    this.reset();
  }
  // v14：斜坡 = 把重力方向倾斜 deg 度（和把桌面倾斜 deg 度在物理上等价，我的补充）。
  // dir = 下坡方向（机身起始坐标系）："cross" = 往右（+x，横坡）、"down" = 往前（−z，下坡）、"up" = 往后（+z，上坡）
  setSlope(deg = 0, dir = "cross") {
    const a = ((+deg || 0) * Math.PI) / 180, d = dir === "down" ? [0, -1] : dir === "up" ? [0, 1] : dir === "crossL" ? [-1, 0] : [1, 0];
    this.slope = { deg: +deg || 0, dir };
    this.world.gravity = { x: G * Math.sin(a) * d[0], y: -G * Math.cos(a), z: G * Math.sin(a) * d[1] };
  }
  // v14：在机身上突然加一个负载（g 克，放在机身坐标 x 右 / z 后 cm、高 y cm 处）。直接固定在机身上（不模拟掉落弹跳，我的补充）
  addLoad({ g = 30, x = 3, z = 0, y = null } = {}) {
    const R = this.R, yy = y ?? this.geo.yawH + 0.5;
    const col = this.world.createCollider(R.ColliderDesc.cuboid(0.8, 0.5, 0.8).setTranslation(x, yy, z).setMass(g / 1000).setCollisionGroups(groups(GRP_ROBOT, 0)), this.body);
    this.loads.push({ col, g, x, y: yy, z }); this.m.total += g / 1000;
    return col;
  }
  // v14：IMU 真值（传感器装在机身中心，X = 机身前方、Y = 左、Z = 上，MPU6050 的右手系，安装方向是我的补充）。
  // acc = 比力（a − g）/ 981，单位 g；gyro = 角速度 °/s。加速度用机身质心速度的差分（忽略传感器离质心的偏移）
  imuTruth() {
    const q = this.body.rotation(), g = this.world.gravity, a = this.aW || { x: -g.x, y: -g.y, z: -g.z };
    const f = rotInv(q, [a.x / G, a.y / G, a.z / G]);
    const w = this.body.angvel(), wl = rotInv(q, [w.x, w.y, w.z]), k = 180 / Math.PI;
    return { acc: [-f[2], -f[0], f[1]], gyro: [-wl[2] * k, -wl[0] * k, wl[1] * k] };
  }
  build() {
    const R = this.R, W = this.world, [cx, , cz] = this.c, m = this.m, GE = this.geo;
    const cg = groups(GRP_ROBOT, GRP_GROUND);
    // 机身：底板 Φ10 cm；质量集中在 8 个舵机 + 上层板（质心约 2 cm 高，估算）
    const lift0 = this.hw.casters ? 0.3 : 0;
    const body = W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(cx, lift0, cz).setAdditionalMassProperties(m.torso, { x: 0, y: GE.comY, z: 0 }, { x: m.torso * (3 * GE.rg ** 2 + 25) / 12, y: m.torso * GE.rg ** 2 / 2, z: m.torso * (3 * GE.rg ** 2 + 25) / 12 }, { w: 1, x: 0, y: 0, z: 0 }).setCanSleep(false));
    this.plate = W.createCollider(R.ColliderDesc.cylinder(GE.plateT / 2, GE.plateR).setTranslation(0, GE.plateT / 2, 0).setDensity(0).setFriction(this.mu).setCollisionGroups(cg), body);
    this.casters = [];
    if (this.hw.casters) for (let k = 0; k < 3; k++) { const a = (k * 2 * Math.PI) / 3 + Math.PI / 2, cr = this.variant === "v10" ? 2.0 : 2.5; this.casters.push(W.createCollider(R.ColliderDesc.ball(0.4).setTranslation(cr * Math.cos(a), 0.1, cr * Math.sin(a)).setDensity(0).setFriction(CASTERS[this.casterKind].mu(this.mu)).setFrictionCombineRule(R.CoefficientCombineRule.Min).setCollisionGroups(cg), body)); }
    this.body = body;
    const T = GE.stall(6);
    this.legs = [];
    for (let a = 0; a < 8; a++) {
      const th = (Gait.MountAngle(a) * Math.PI) / 180, dir = [Math.cos(th), 0, Math.sin(th)], tan = [-Math.sin(th), 0, Math.cos(th)];
      const yawP = [dir[0] * GE.yawR, GE.yawH + lift0, dir[2] * GE.yawR]; // 偏航舵机输出轴（与 3D 装配一致）
      const leg = { a, th, dir, tan, yawP };
      const q = quatY(-th); // 径向坐标系 → 世界：局部 x = 径向、局部 z = 切向
      // 连杆刚体都用“不转”的姿态建，碰撞体自己带旋转：这样关节角 0 = 装配姿态，马达目标 = 舵机角 − 90°
      const L = (x, y) => { const r = rotVec(q, [x, y, 0]); return { x: r[0], y: r[1], z: r[2] }; };
      // 每个连杆加一点转动惯量 = 舵机减速箱的反射惯量（估算 ARM_I），也让求解器收敛（质量比太悬殊时马达推不动）
      const mk = (P) => W.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(cx + P[0], P[1], cz + P[2]).setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, { x: GE.armI, y: GE.armI, z: GE.armI }, { w: 1, x: 0, y: 0, z: 0 }).setCanSleep(false));
      const tipBall = (rb, tip) => { leg.tipLocal = L(tip[0], tip[1] - 0.15); return W.createCollider(R.ColliderDesc.ball(0.15).setTranslation(...v3(L(tip[0], tip[1]))).setMass(m.arm * 0.3).setFriction(this.mu).setCollisionGroups(cg), rb); };
      if (this.plan === "B") {
        // 偏航连杆 = 支架 + 侧躺的俯仰舵机；俯仰轴在径向 5.92、切向 +1.52、高 4.22 cm（与 build3d 一致）
        const pitchP = [dir[0] * 5.92 + tan[0] * this.tanOff, 4.22 + lift0, dir[2] * 5.92 + tan[2] * this.tanOff];
        const link = mk(yawP);
        W.createCollider(R.ColliderDesc.cuboid(1.2, 0.6, 0.6).setTranslation(...v3(L(1.1, 0.6))).setRotation(q).setMass(m.link).setCollisionGroups(groups(GRP_ROBOT, 0)), link);
        const arm = mk(pitchP);
        // 触手 B：从俯仰轴往外 6.75 cm、往下 3.95 cm 到尖球心（与 p-octo-arm-b 一致）；下段胶囊体也能碰桌面
        leg.tipCol = tipBall(arm, [6.75, -3.95]);
        leg.segCol = capsuleBetween(R, W, arm, q, [1.0, -0.4], [5.6, -3.3], 0.18, m.arm * 0.7, this.mu, cg);
        const jy = W.createImpulseJoint(R.JointData.revolute({ x: yawP[0], y: yawP[1] - lift0, z: yawP[2] }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), body, link, true);
        const d = [pitchP[0] - yawP[0], pitchP[1] - yawP[1], pitchP[2] - yawP[2]];
        const jp = W.createImpulseJoint(R.JointData.revolute({ x: d[0], y: d[1], z: d[2] }, { x: 0, y: 0, z: 0 }, { x: tan[0], y: 0, z: tan[2] }), link, arm, true);
        leg.joints = [{ j: jy, slot: 0, sign: 1, axis: [0, 1, 0], parent: body, child: link }, { j: jp, slot: 1, sign: 1, axis: tan, parent: link, child: arm }];
        leg.links = [link, arm]; leg.arm = arm;
      } else {
        // 方案 A 只有偏航（1 自由度）。触手根部再加一个“被动弹性”俯仰：代表 6 节 PLA 触手的弯曲柔度（估算），没有舵机
        const horn = mk(yawP);
        W.createCollider(R.ColliderDesc.cuboid(...GE.horn).setTranslation(...v3(L(GE.hornAt, 0))).setRotation(q).setMass(m.arm * 0.3).setCollisionGroups(groups(GRP_ROBOT, 0)), horn);
        const arm = mk(yawP);
        // 触手 A：6 节，从轴往外 8.75 cm、往下 3.2 cm 到尖球心（与 p-octo-arm 一致）
        leg.tipCol = tipBall(arm, GE.tip);
        leg.segCol = capsuleBetween(R, W, arm, q, GE.seg[0], GE.seg[1], GE.segR, m.arm * 0.4, this.mu, cg);
        const jy = W.createImpulseJoint(R.JointData.revolute({ x: yawP[0], y: yawP[1] - lift0, z: yawP[2] }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), body, horn, true);
        const jf = W.createImpulseJoint(R.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: tan[0], y: 0, z: tan[2] }), horn, arm, true);
        leg.joints = [{ j: jy, slot: 0, sign: 1, axis: [0, 1, 0], parent: body, child: horn }];
        leg.flex = { j: jf, axis: tan, parent: horn, child: arm };
        leg.links = [horn, arm]; leg.arm = arm;
        // 完善版 A：触手尖要压在桌上分担 tipShare 的重量（v7 的设计，我的补充）。按柔度算出需要的“预弯”角：
        // 先把尖放到桌面（万向珠把机身抬高了 lift0），再多压 FLEX_DEG
        const share = this.hw.tipShare || 0;
        const lever = GE.tip[0], gapDeg = (Math.atan2(lift0 + 0.02, lever) * 180) / Math.PI;
        const Mneed = (share * m.total) / 8 * lever * G; // 每条腿需要的力矩 kg·cm²/s²
        leg.flexK = Mneed > 0 ? Mneed / ((FLEX_DEG * Math.PI) / 180) : FLEX_K0;
        leg.flexTgt = share > 0 ? -((gapDeg + FLEX_DEG) * Math.PI) / 180 : 0;
        jf.configureMotorModel(R.MotorModel.ForceBased);
        jf.configureMotorPosition(leg.flexTgt, leg.flexK, leg.flexK * 0.05);
        jf.setMotorMaxForce(1e9);
      }
      for (const J of leg.joints) { J.j.configureMotorModel(R.MotorModel.ForceBased); J.T = T; }
      this.legs.push(leg);
    }
    this.servoOf = (a, slot) => this.sim.servos.find((s) => s.arm === a && s.slot === slot);
    this.rest = this.poses();
    const p0 = this.body.translation();
    this.org = { x: p0.x, z: p0.z }; this.hLast = this.heading(); this.hAcc = 0;
    this.home = { x: p0.x, z: p0.z }; this.wraps = 0;
    this.reach = Math.max(4, ...this.legs.map((L) => { const t = worldPoint(L.arm, L.tipLocal); return Math.hypot(t.x - p0.x, t.z - p0.z); }));
  }
  // v14（我的补充）：3D 台面只有 BENCH 那么大（物理地面是 6 m 的大平面）。整机（触手尖算进去）快出台边时，
  // 把所有刚体一起平移回起点（朝向、速度、关节角都不变，相当于把它拎回来放下）；测速 / 轨迹 / 前进距离照常累计，不会因为搬回而清零。
  keepOnBench(W, D, cx = 0, cz = 0) {
    const p = this.body.translation(), r = this.reach + 1;
    if (Math.abs(p.x - cx) < W / 2 - r && Math.abs(p.z - cz) < D / 2 - r) return false;
    const dx = this.home.x - p.x, dz = this.home.z - p.z;
    this.world.forEachRigidBody((rb) => { if (!rb.isDynamic()) return; const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); });
    this.org.x += dx; this.org.z += dz;
    if (this.start) { this.start.x += dx; this.start.z += dz; }
    this.wraps++;
    return true;
  }
  // 给 OctoSim / 俯视轨迹用的平面位姿（相对建好时的位置；h 不回绕，右转为正，和 v8 的 sim.pose 一样）
  pose2d() { const p = this.body.translation(); return { x: p.x - this.org.x, z: p.z - this.org.z, h: this.hAcc }; }
  reset() {
    const p = this.body.translation();
    this.start = { x: p.x, z: p.z, h: this.heading(), hAcc: this.hAcc || 0 };
    this.acc = 0; this.t = 0; this.pen = 0; this.slipD = 0; this.strokeD = 0; this.cycles = []; this.lastPhase = null; this.cycStart = null;
    this.gm = { n: 0, minMargin: Infinity, sumMargin: 0, nMargin: 0, outside: 0, maxTilt: 0, sumTilt: 0, energy: 0, sumContacts: 0, sumAll: 0, lastAng: new Map(), margin: null }; // v13 步态测量
    this.meas = { v: 0, slip: 0, contacts: 0, load: Array(8).fill(0), torque: Array(8).fill(0), bodyLoad: 0, maxTorquePct: 0, peakTorque: 0, lag: 0, y: 0, tilt: 0 };
  }
  setMu(mu) {
    this.mu = mu;
    this.plate.setFriction(mu);
    for (const L of this.legs) { L.tipCol.setFriction(mu); L.segCol.setFriction(mu); }
  }
  heading() { const q = this.body.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y); return Math.atan2(fz, fx); } // 机身 +x 轴在 xz 平面的方向；绕 +y 左转为负
  poses() { const out = { body: pose(this.body) }; for (const L of this.legs) out[L.a] = L.links.map(pose); return out; }
  // 把关节目标设成当前舵机角；dtSim 是 OctoSim 这一步走过的时间
  step(dtSim) {
    this.acc += dtSim;
    const vs = this.sim.res?.rails?.vservo ?? 6;
    const T = kgfcm(this.geo.stall(vs));
    while (this.acc >= this.dt) { this.acc -= this.dt; this.sub(T); }
  }
  sub(T) {
    const R = this.R, dt = this.dt;
    let maxPct = 0, lag = 0;
    for (const L of this.legs) for (const J of L.joints) {
      const s = this.servoOf(L.a, J.slot);
      const powered = s && s.cmd != null;
      const tgt = s ? (((s.ang - 90 + (J.slot === 0 && this.trim ? this.trim[L.a] || 0 : 0)) * Math.PI) / 180) * J.sign : 0;
      // 刚度：偏差 5° 出满扭矩（估算）；阻尼按关节等效惯量算到接近临界（估算）
      const k = powered ? T / ((5 * Math.PI) / 180) : 0, c = powered ? 0.08 * k : T * 0.02;
      J.j.configureMotorPosition(tgt, k, c); J.k = k;
      J.j.setMotorMaxForce?.(powered ? T : T * 0.05); // 没信号的舵机只有齿轮阻力（估算 5%）
      J.tgt = tgt;
    }
    // 单向脚垫：按上一步触手尖相对桌面的滑动方向切换摩擦（往机身后方滑 = 高摩擦）
    if (this.hw.pads) {
      for (const L of this.legs) {
        const tp = worldPoint(L.arm, L.tipLocal), vt = L.arm.velocityAtPoint(tp);
        const bz = rotVec(this.body.rotation(), [0, 0, 1]);
        const along = vt.x * bz[0] + vt.z * bz[2];
        const sp = Math.hypot(vt.x, vt.z), mu = this.pad[0] + (this.pad[1] - this.pad[0]) * 0.5 * (1 + Math.tanh((4 * along) / Math.max(0.05, sp)));
        L.tipCol.setFriction(mu * (this.mu / 0.5)); L.segCol.setFriction(mu * (this.mu / 0.5));
      }
    }
    // v15：定向轮（只沿机身前后滚）：Rapier 的摩擦是各向同性的，所以轮子本身按滚动阻力 0.02 设，
    // 侧向另外加一个“显式库仑摩擦”冲量：J = −min(μ侧·N·dt, m_eff·|v侧|)·sign(v侧)，N 用上一子步的接触冲量（简化，我的补充）
    if (this.casterKind === "wheel" && this.casters.length) {
      const C = CASTERS.wheel, bq0 = this.body.rotation(), bz = rotVec(bq0, [0, 0, 1]), lx = bz[2], lz = -bz[0], mEff = this.body.mass() / 3, muS = C.side * Math.min(1, this.mu / 0.5);
      this.casterN ||= this.casters.map(() => 0);
      this.casters.forEach((col, k) => {
        const Nimp = this.casterN[k]; if (!(Nimp > 0)) return;
        const t = col.translation(), vt = this.body.velocityAtPoint(t), vl = vt.x * lx + vt.z * lz;
        const J = -Math.sign(vl) * Math.min(muS * Nimp, mEff * Math.abs(vl));
        this.body.applyImpulseAtPoint({ x: J * lx, y: 0, z: J * lz }, t, true);
      });
    }
    const v0 = this.body.linvel();
    this.world.step();
    this.t += dt;
    if (this.casterKind === "wheel") this.casterN = this.casters.map((col) => { let n = 0; this.world.contactPair(this.ground, col, (man) => { for (let i = 0; i < man.numContacts(); i++) n += man.contactImpulse(i); }); return n; });
    { const v1 = this.body.linvel(), g = this.world.gravity; this.aW = { x: (v1.x - v0.x) / dt - g.x, y: (v1.y - v0.y) / dt - g.y, z: (v1.z - v0.z) / dt - g.z }; } // v14：比力（世界系，cm/s²）
    { const h = this.heading(); let d = h - this.hLast; d = ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; this.hAcc += d; this.hLast = h; }
    // —— 测量 ——
    let contacts = 0, slip = 0, stroke = 0; const load = [], torque = [];
    const bq = this.body.rotation();
    for (const L of this.legs) {
      let n = 0;
      for (const col of [L.tipCol, L.segCol]) this.world.contactPair(this.ground, col, (man) => { for (let i = 0; i < man.numContacts(); i++) n += man.contactImpulse(i); });
      const N = n / dt; load.push(N / G); // kgf
      if (N > 0.002 * G) {
        contacts++;
        const tp = worldPoint(L.arm, L.tipLocal), vt = L.arm.velocityAtPoint(tp), vb = this.body.velocityAtPoint(tp);
        slip += Math.hypot(vt.x, vt.z) * dt; stroke += Math.hypot(vt.x - vb.x, vt.z - vb.z) * dt;
      }
      { const tb = worldPoint(L.arm, L.tipLocal); this.pen = Math.max(this.pen || 0, -tb.y); }
      let tq = 0;
      for (const J of L.joints) { const ang = jointAngle(J), e = Math.abs(ang - J.tgt); lag = Math.max(lag, e); tq = Math.max(tq, Math.min(1, (J.k * e) / Math.max(1e-9, T))); }
      torque.push(tq); maxPct = Math.max(maxPct, tq);
    }
    let nb = 0; for (const col of [this.plate, ...this.casters]) this.world.contactPair(this.ground, col, (man) => { for (let i = 0; i < man.numContacts(); i++) nb += man.contactImpulse(i); });
    this.slipD += slip; this.strokeD += stroke;
    this.gaitMetrics(T, dt, contacts);
    const p = this.body.translation();
    const fwd = this.fwd();
    // 周期：按固件步态相位回绕计
    const ph = this.sim.rt?.body?.gait_?.phase_;
    const running = this.sim.rt?.body?.mode_ === "gait";
    if (running && ph != null) {
      if (this.lastPhase != null && ph < this.lastPhase - 180) {
        if (this.cycStart) this.cycles.push({ fwd: fwd - this.cycStart.fwd, slip: (this.slipD - this.cycStart.slip) / Math.max(1e-6, this.strokeD - this.cycStart.stroke), t: this.t - this.cycStart.t });
        this.cycStart = { fwd, slip: this.slipD, stroke: this.strokeD, t: this.t };
      }
      this.lastPhase = ph;
    } else { this.lastPhase = null; this.cycStart = null; }
    const lv = this.body.linvel();
    const m = this.meas; const a = Math.min(1, dt / 0.5);
    const bzv = rotVec(bq, [0, 0, -1]);
    m.v += (lv.x * bzv[0] + lv.z * bzv[2] - m.v) * a; // 沿机身前方的速度（平滑 0.5 s）
    m.slip = this.strokeD > 0.05 ? this.slipD / this.strokeD : 0;
    m.contacts = contacts; m.load = load; m.bodyLoad = nb / dt / G; m.lag = (lag * 180) / Math.PI; m.y = p.y; m.tilt = tiltDeg(bq); m.pen = Math.max(this.pen || 0, -p.y + (this.casters.length ? 0.3 - 0.3 : 0));
    m.torque = torque; m.peakTorque = Math.max(m.peakTorque || 0, maxPct); m.maxTorquePct = maxPct;
  }
  // v13（我的补充）：步态测量 —— 支撑多边形裕度（整机质心投影到所有触地点凸包的有符号距离，cm，正 = 在里面）、
  // 机身倾角、着地触手数、关节机械功 ∑|τ·ω|·dt（估算：τ 用位置环 k·误差 夹在堵转扭矩，非电功）
  gaitMetrics(T, dt, contacts) {
    const g = this.gm; if (!g) return;
    g.n++; g.sumContacts += contacts;
    let e = 0;
    for (const L of this.legs) for (const J of L.joints) {
      const a = jointAngle(J), last = g.lastAng.get(J); g.lastAng.set(J, a);
      if (last == null) continue;
      const tau = Math.min(T, (J.k || 0) * Math.abs(a - J.tgt)), w = Math.abs(a - last) / dt;
      e += tau * w * dt;
    }
    g.energy += e; // kg·cm²/s² ×1e-4 = J
    const tl = tiltDeg(this.body.rotation()); g.maxTilt = Math.max(g.maxTilt, tl); g.sumTilt += tl;
    if (g.n % 4) return; // 凸包每 4 个子步算一次（60 Hz）
    const pts = [];
    for (const col of [this.plate, ...this.casters, ...this.legs.flatMap((L) => [L.tipCol, L.segCol])]) this.world.contactPair(this.ground, col, (man) => {
      for (let i = 0; i < man.numSolverContacts(); i++) { const q = man.solverContactPoint(i); pts.push([q.x, q.z]); }
    });
    let M = 0, cx = 0, cz = 0;
    for (const b of [this.body, ...this.legs.flatMap((L) => L.links)]) { const m = b.mass(), c = b.worldCom(); M += m; cx += m * c.x; cz += m * c.z; }
    cx /= M; cz /= M;
    const mg = supportMargin(pts, [cx, cz]);
    g.margin = mg;
    if (mg == null) return;
    g.minMargin = Math.min(g.minMargin, mg); g.sumMargin += mg; g.nMargin++; if (mg < 0) g.outside++;
  }
  gaitReport() {
    const g = this.gm, s = this.snapshot(), t = Math.max(1e-6, s.t);
    return { t: s.t, fwd: s.fwd, speed: s.fwd / t, dx: s.dx, drift: s.dx, dh: s.dh, slip: s.slip, contactsAvg: g.n ? g.sumContacts / g.n : 0, tiltMax: g.maxTilt, tiltAvg: g.n ? g.sumTilt / g.n : 0,
      marginMin: Number.isFinite(g.minMargin) ? g.minMargin : null, marginAvg: g.nMargin ? g.sumMargin / g.nMargin : null, outsideFrac: g.nMargin ? g.outside / g.nMargin : null,
      energyJ: g.energy * 1e-4, powerW: (g.energy * 1e-4) / t, costOfTransport: s.fwd > 0.05 ? (g.energy * 1e-4) / (this.m.total * 9.81 * (s.fwd / 100)) : null, peakTorque: s.peakTorque, pen: s.pen, y: s.y, mu: s.mu, mass: s.mass };
  }
  // 从起点沿起始前方（−z）走了多远
  fwd() { const p = this.body.translation(); return -(p.z - this.start.z); }
  snapshot() {
    const p = this.body.translation();
    const cyc = this.cycles.slice(-5);
    const perCycle = cyc.length ? cyc.reduce((s, c) => s + c.fwd, 0) / cyc.length : null;
    return { t: this.t, dx: p.x - this.start.x, dz: p.z - this.start.z, fwd: this.fwd(), dh: ((this.hAcc - this.start.hAcc) * 180) / Math.PI, y: p.y, ...this.meas, load: [...this.meas.load], torque: [...(this.meas.torque || [])], perCycle, cycles: this.cycles.length, mu: this.mu, mass: this.m.total, stall: this.geo.stall(this.sim.res?.rails?.vservo ?? 6), servoSrc: this.variant === "v10" ? SG51R.src : MG90S.src };
  }
}
function capsuleBetween(R, W, rb, qr, p0, p1, r, mass, mu, cg) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], L = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
  // 胶囊默认沿局部 y：先转到径向 x、在径向竖直面里转 ang，再整体转到这条触手的方向
  const q = mulQ(qr, mulQ(quatZ(ang), quatZ(-Math.PI / 2)));
  const c = rotVec(qr, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0]);
  return W.createCollider(R.ColliderDesc.capsule(L / 2 - r, r).setTranslation(c[0], c[1], c[2]).setRotation(q).setMass(mass).setFriction(mu).setCollisionGroups(cg), rb);
}
const v3 = (p) => [p.x, p.y, p.z];
const quatY = (a) => ({ w: Math.cos(a / 2), x: 0, y: Math.sin(a / 2), z: 0 });
const quatZ = (a) => ({ w: Math.cos(a / 2), x: 0, y: 0, z: Math.sin(a / 2) });
function mulQ(a, b) { return { w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z, x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w }; }
function rotVec(q, v) { const [x, y, z] = v, { w, x: qx, y: qy, z: qz } = q; const ix = w * x + qy * z - qz * y, iy = w * y + qz * x - qx * z, iz = w * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z; return [ix * w + iw * -qx + iy * -qz - iz * -qy, iy * w + iw * -qy + iz * -qx - ix * -qz, iz * w + iw * -qz + ix * -qy - iy * -qx]; }
function rotInv(q, v) { return rotVec({ w: q.w, x: -q.x, y: -q.y, z: -q.z }, v); }
function worldPoint(rb, l) { const t = rb.translation(), r = rotVec(rb.rotation(), [l.x, l.y, l.z]); return { x: t.x + r[0], y: t.y + r[1], z: t.z + r[2] }; }
function pose(rb) { const t = rb.translation(), q = rb.rotation(); return { p: [t.x, t.y, t.z], q: [q.x, q.y, q.z, q.w] }; }
function tiltDeg(q) { const u = rotVec(q, [0, 1, 0]); return (Math.acos(Math.max(-1, Math.min(1, u[1]))) * 180) / Math.PI; }
// 关节实际角：子连杆相对父连杆绕关节轴的转角（建的时候两边都不转，所以相对旋转就是关节角）
// 2D 凸包（单调链）+ 点到凸包边界的有符号距离（里面为正）；点数 < 3 返回 null
export function convexHull(P) {
  const p = P.map((q) => [+q[0].toFixed(4), +q[1].toFixed(4)]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function supportMargin(P, c) {
  const h = convexHull(P); if (h.length < 3) return null;
  let inside = true, d = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length], ex = b[0] - a[0], ez = b[1] - a[1], L = Math.hypot(ex, ez) || 1e-9;
    const sd = (ex * (c[1] - a[1]) - ez * (c[0] - a[0])) / L; // 逆时针凸包：左侧（里面）为正
    if (sd < 0) inside = false;
    const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * ex + (c[1] - a[1]) * ez) / (L * L)));
    d = Math.min(d, Math.hypot(c[0] - a[0] - t * ex, c[1] - a[1] - t * ez));
  }
  return inside ? d : -d;
}
export function jointAngle(J) {
  const qp = J.parent.rotation(), qc = J.child.rotation();
  const rel = mulQ({ w: qp.w, x: -qp.x, y: -qp.y, z: -qp.z }, qc);
  const s = rel.x * J.axis[0] + rel.y * J.axis[1] + rel.z * J.axis[2];
  return 2 * Math.atan2(s, rel.w);
}
