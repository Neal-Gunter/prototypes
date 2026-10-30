// 八爪鱼台面仿真：md 固件（firmware.js）→ 模拟 I2C → PCA9685 寄存器 → 舵机（脉宽→角度，估算）→ 触手 → 桌面摩擦（估算）。
// 所有物理参数都是估算，UI 上统一标“估算”。
import { benchSpec } from "./bench.js";
import { evaluate } from "./circuit.js";
import { Runtime, Pca9685Dev, fixesAll, fixesPlus, Gait } from "./firmware.js";

export const EST = {
  pulse: "舵机脉宽 0.5–2.5 ms ↔ 0–180°（MG90S 常见标定，估算）",
  speed: "空载 0.1 s/60°@4.8 V、0.08 s/60°@6 V（MG90S 常见标称），按电压线性插值",
  current: "电流：保持 0.01 A，运动 0.12 + 0.45·(速度/最高速) A，堵转 0.7 A（估算）",
  frame: "只有 10–30 ms 周期（33–100 Hz）的 PWM 舵机才认（模拟舵机估算）",
  friction: "v9 走路是物理仿真（Rapier）：机身是有重力的刚体，触手是舵机关节连着的刚体，只靠触手和桌面的接触摩擦推着走；摩擦系数、PLA 质量等是估算（见下面“走路物理”）",
  plusA: "完善版 A（我的补充）：底板下 3 个万向珠（滚动阻力系数约 0.02）、调高度让触手尖分担约 30% 重量 + 触手尖单向鳞片脚垫（向后滑 0.45、向前滑 0.15）——全部估算",
  gap: "相邻触手最小夹角：方案 A 12°（按触手根部宽度）；方案 B 13°（v8 在 3D 碰撞体上实测，见 e2e/gapB.mjs）——A 为估算",
};
const GAP = 12;
// 方案 B：v7 用 2·atan(1.55/4.27) ≈ 40° 估算（把模块当成绕躯干中心转，偏保守）。
// v8：每个模块其实绕自己的偏航轴（离中心 3.8 cm）转，在 3D 碰撞体上让相邻两模块相向转，夹角缩到 13° 才第一次接触（1 号触手碰 2 号俯仰舵机）。
export const GAP_B = 13; // v8：3D 碰撞体实测（e2e/gapB.mjs），相邻 B 模块夹角 < 13° 时俯仰舵机碰到邻臂触手
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const wrap = (d) => ((d % 360) + 540) % 360 - 180;

export class OctoSim {
  constructor(o = {}) { this.o = { plan: "A", phase: 3, fault: "none", mode: "ino", variant: "md", seed: 7, tipShare: 0.15, ...o }; if (!this.o.F) this.o.F = this.o.variant === "plus" ? fixesPlus() : fixesAll(false); this.rebuild(); }
  set(o) { Object.assign(this.o, o); this.rebuild(); }
  rebuild() {
    const o = this.o;
    this.bench = benchSpec(o);
    this.r = rng(o.seed);
    this.dev = new Pca9685Dev(0x40);
    this.t = 0; this.servoI = 0; this.peakI = 0; this.events = []; this.phys = null; this.pose = { x: 0, z: 0, h: 0 }; this.trace = [{ x: 0, z: 0, h: 0, t: 0 }];
    this.servos = this.bench.servos.map((s) => ({ ...s, chN: +s.ch.slice(2), ang: 72 + this.r() * 36, w: 0, cmd: null, us: 0, I: 0, stall: false, buzz: false, collide: false }));
    this.res = evaluate(this.bench, { servoI: 0, micSpkCm: o.micSpkCm });
    this.espOn = false; this.offFor = 1e9; this.boots = 0; this.scenarioDone = false;
    this.rt = this.bench.phase === 0 ? null : new Runtime({ F: o.F, mode: o.mode, plan: o.plan, skipPrescale: o.fault === "pwm200", i2cWrite: (addr, reg, data) => this.i2c(addr, reg, data), adcMv: (gpio) => this.adcMv(gpio) });
    this.step(0.001);
  }
  i2c(addr, reg, data) {
    if (addr !== 0x40) return 2; // 只有一块，地址 0x40
    const R = this.res.rails;
    if (!R.pcaLogic || !R.i2cWired) return 2;
    this.dev.write(reg, data, this.rt.now);
    return 0;
  }
  // 模拟 analogReadMilliVolts：只有接了分压（DIV.OUT → GPIO10）才有读数
  adcMv(gpio) {
    const R = this.res.rails;
    if (gpio !== 10 || !R.battSense || !R.espOn) return 0;
    return Math.min(2900, ((R.vbat * 22) / 122) * 1000 + (this.r() - 0.5) * 20);
  }
  ev(t) { this.events.push({ t: +this.t.toFixed(2), zh: t }); if (this.events.length > 60) this.events.shift(); }
  send(line) { if (this.rt && this.espOn) this.rt.send(line); else this.ev("ESP32 没在运行，指令没发出去"); }
  mcp(tool, args) { if (this.o.mode !== "mcp") return "当前是蓝牙串口 .ino 模式"; if (!this.rt || !this.espOn) return "ESP32 没在运行"; const r = this.rt.mcp(tool, args); this.ev(`MCP ${tool} ${JSON.stringify(args)} → ${r}`); return r; }
  step(dt) {
    const sub = 0.005; let n = Math.max(1, Math.round(dt / sub));
    while (n--) this.sub(sub);
  }
  sub(dt) {
    this.t += dt;
    const o = this.o, B = this.bench;
    this.res = evaluate(B, { servoI: this.servoI, micSpkCm: o.micSpkCm });
    const R = this.res.rails;
    // ESP32 上电 / 掉电复位
    if (this.rt) {
      if (R.espOn && !this.espOn && this.offFor > 0.3) { this.espOn = true; this.boots++; this.dev.reset(); this.rt.now = this.t * 1000; this.rt.boot(); if (this.boots > 1) this.ev(`ESP32 重新启动（第 ${this.boots} 次）`); this.scenarioDone = false; }
      else if (!R.espOn && this.espOn) { this.espOn = false; this.offFor = 0; this.ev(`ESP32 5V 掉到 ${R.espIn.toFixed(2)} V → 欠压复位`); if (!R.vpFromU1) this.dev.reset(); }
      if (!this.espOn) this.offFor += dt;
      if (this.espOn) {
        this.rt.step(dt * 1000);
        if (!this.scenarioDone && this.rt.body.running_) {
          this.scenarioDone = true;
          if (o.fault === "mech") { const p = this.rt.body.GaitParamsSnapshot(); p.yaw_amp_deg = 60; this.rt.body.SetGaitParams(p); this.rt.body.SetVelocity(1, 1); this.ev("场景：步态 yaw 被改成 60°，并且右转"); }
          if (o.fault === "phase0") { const p = this.rt.body.GaitParamsSnapshot(); p.phase_deg = 0; this.rt.body.SetGaitParams(p); this.rt.body.SetVelocity(1, 0); this.ev("场景：phase = 0，八条触手同相"); }
        }
      }
    } else this.espOn = R.espOn;
    // 舵机
    const period = 1e6 / this.dev.freq, vs = R.vservo;
    const frameOk = period >= 10000 && period <= 30000;
    const wmax = vs < 3.5 ? 0 : 600 + (Math.min(vs, 6.5) - 4.8) * 125;
    let I = 0;
    for (const s of this.servos) {
      const c = R.pcaLogic || R.vpFromU1 ? this.dev.channel(s.chN) : { us: 0 };
      s.us = c.us; s.stall = false; s.buzz = false;
      const valid = frameOk && c.us >= 400 && c.us <= 2700 && wmax > 0;
      s.cmd = valid ? ((c.us - 500) / 2000) * 180 : null;
      let w = 0;
      if (s.type === "360") {
        if (valid && Math.abs(c.us - 1500) > 20) w = Math.max(-1, Math.min(1, (c.us - 1500) / 500)) * 780 * (wmax / 750);
        s.ang += w * dt;
      } else if (s.cmd != null) {
        const tgt = Math.max(-3, Math.min(183, s.cmd));
        const e = tgt - s.ang, stepMax = wmax * dt;
        const d = Math.abs(e) <= stepMax ? e : Math.sign(e) * stepMax;
        s.ang += d; w = d / dt;
        if ((s.cmd > 183.5 || s.cmd < -3.5) && Math.abs(e) < 0.5) { s.stall = true; s.buzz = true; }
      }
      s.w = w;
    }
    // 相邻触手不穿模：夹角小于 GAP 时两边顶住（堵转）
    const yaws = this.yawServos();
    for (const s of yaws) s.collide = false;
    if (yaws.length === 8) for (let a = 0; a < 8; a++) {
      const s1 = yaws[a], s2 = yaws[(a + 1) % 8];
      const gap = 45 - (s2.ang - 90) + (s1.ang - 90); // φ = θ − yaw
      const G = this.bench.plan === "B" && this.bench.robot ? GAP_B : GAP;
      if (gap < G) { const fix = (G - gap) / 2; s1.ang += fix; s2.ang -= fix; s1.stall = s2.stall = true; s1.collide = s2.collide = true; s1.buzz = s2.buzz = true; }
    }
    for (const s of this.servos) {
      s.I = s.stall ? 0.7 * Math.min(1, vs / 6) : wmax > 0 ? 0.01 + (Math.abs(s.w) > 1 ? 0.12 + 0.45 * Math.min(1, Math.abs(s.w) / wmax) : 0) : 0;
      if (o.plan === "B" && s.slot === 1 && this.stanceArm(s.arm)) s.I += 0.15;
      I += s.I;
    }
    this.servoI = I; this.avgI = (this.avgI || 0) + (I - (this.avgI || 0)) * Math.min(1, dt / 0.2); this.peakI = Math.max(this.peakI, this.avgI); this.peakInst = Math.max(this.peakInst || 0, I);
    if (B.robot && this.phys) { this.phys.step(dt); this.pose = this.phys.pose2d(); const m = this.phys.meas; this.vel = { v: m.v, slip: m.slip }; }
    if (this.t - (this.trace.at(-1)?.t || 0) > 0.05) { this.trace.push({ ...this.pose, t: this.t }); if (this.trace.length > 3000) this.trace.shift(); }
  }
  yawServos() { return this.servos.filter((s) => s.slot === 0 && s.arm != null).sort((a, b) => a.arm - b.arm); }
  liftOf(arm) { const s = this.servos.find((x) => x.arm === arm && x.slot === 1); return s ? s.ang - 90 : 0; }
  stanceArm(arm) { return this.liftOf(arm) <= 5; }
  armPose(arm) { const y = this.servos.find((x) => x.arm === arm && x.slot === 0); return { yaw: y ? y.ang - 90 : 0, lift: this.liftOf(arm) }; }
  // v9：机身位移只来自物理（loco.js：有重力的刚体 + 触手和桌面的接触摩擦）。没接物理就不动——不再用运动学“算”位移。
  attachPhys(lp) { this.phys = lp; this.pose = lp ? lp.pose2d() : { x: 0, z: 0, h: 0 }; this.trace = [{ ...this.pose, t: this.t }]; }
  snapshot() {
    const R = this.res.rails;
    return {
      t: this.t, espOn: this.espOn, boots: this.boots, halted: this.rt?.halted || null, rails: R, checks: this.res.checks, warn: this.res.warn,
      servos: this.servos.map((s) => ({ role: s.role, ch: s.ch, arm: s.arm, slot: s.slot, us: s.us, ang: s.ang, cmd: s.cmd, I: s.I, stall: s.stall, buzz: s.buzz, collide: s.collide, type: s.type })),
      servoI: this.servoI, avgI: this.avgI || 0, peakI: this.peakI, peakInst: this.peakInst || 0, vel: this.vel, freq: this.dev.freq, pose: { ...this.pose }, loco: this.phys ? this.phys.snapshot() : null, log: this.rt ? this.rt.out.slice(-40) : [], events: this.events.slice(-20), mode: this.rt?.body.mode_, gait: this.rt?.body.GaitParamsSnapshot?.(),
    };
  }
}
export { wrap };
