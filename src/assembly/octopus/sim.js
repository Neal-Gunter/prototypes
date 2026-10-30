// 八爪鱼台面仿真：md 固件（firmware.js）→ 模拟 I2C → PCA9685 寄存器 → 舵机（脉宽→角度，估算）→ 触手 → 桌面摩擦（估算）。
// 所有物理参数都是估算，UI 上统一标“估算”。
import { benchSpec } from "./bench.js";
import { evaluate } from "./circuit.js";
import { Runtime, Pca9685Dev, fixesAll, Gait } from "./firmware.js";
import { ARM } from "./parts.js";

export const EST = {
  pulse: "舵机脉宽 0.5–2.5 ms ↔ 0–180°（MG90S 常见标定，估算）",
  speed: "空载 0.1 s/60°@4.8 V、0.08 s/60°@6 V（MG90S 常见标称），按电压线性插值",
  current: "电流：保持 0.01 A，运动 0.12 + 0.45·(速度/最高速) A，堵转 0.7 A（估算）",
  frame: "只有 10–30 ms 周期（33–100 Hz）的 PWM 舵机才认（模拟舵机估算）",
  friction: "桌面摩擦：最小耗散的库仑摩擦模型；方案 A 机身底板贴桌，触手只分到约 15% 重量（估算）",
  gap: "相邻触手最小夹角：方案 A 12°（按触手根部宽度）；方案 B 40°（侧躺的俯仰舵机比触手宽得多）——都是估算",
};
const L_TIP = ARM.len, R_SHAFT = 3.8, GAP = 12;
// 方案 B：俯仰舵机侧躺在偏航舵盘上，内侧角离中心约 4.27 cm、切向半宽 1.55 cm → 相邻至少 2·atan(1.55/4.27) ≈ 40°（估算）
export const GAP_B = 40;
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const wrap = (d) => ((d % 360) + 540) % 360 - 180;

export class OctoSim {
  constructor(o = {}) { this.o = { plan: "A", phase: 3, fault: "none", mode: "ino", F: fixesAll(false), seed: 7, tipShare: 0.15, ...o }; this.rebuild(); }
  set(o) { Object.assign(this.o, o); this.rebuild(); }
  rebuild() {
    const o = this.o;
    this.bench = benchSpec(o);
    this.r = rng(o.seed);
    this.dev = new Pca9685Dev(0x40);
    this.t = 0; this.servoI = 0; this.peakI = 0; this.events = []; this.pose = { x: 0, z: 0, h: 0 }; this.trace = [{ x: 0, z: 0, h: 0, t: 0 }];
    this.servos = this.bench.servos.map((s) => ({ ...s, chN: +s.ch.slice(2), ang: 72 + this.r() * 36, w: 0, cmd: null, us: 0, I: 0, stall: false, buzz: false, collide: false }));
    this.res = evaluate(this.bench, { servoI: 0, micSpkCm: o.micSpkCm });
    this.espOn = false; this.offFor = 1e9; this.boots = 0; this.scenarioDone = false;
    this.rt = this.bench.phase === 0 ? null : new Runtime({ F: o.F, mode: o.mode, plan: o.plan, skipPrescale: o.fault === "pwm200", i2cWrite: (addr, reg, data) => this.i2c(addr, reg, data) });
    this.step(0.001);
  }
  i2c(addr, reg, data) {
    if (addr !== 0x40) return 2; // 只有一块，地址 0x40
    const R = this.res.rails;
    if (!R.pcaLogic || !R.i2cWired) return 2;
    this.dev.write(reg, data, this.rt.now);
    return 0;
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
    if (B.robot) this.locomote(dt);
    if (this.t - (this.trace.at(-1)?.t || 0) > 0.05) { this.trace.push({ ...this.pose, t: this.t }); if (this.trace.length > 3000) this.trace.shift(); }
  }
  yawServos() { return this.servos.filter((s) => s.slot === 0 && s.arm != null).sort((a, b) => a.arm - b.arm); }
  liftOf(arm) { const s = this.servos.find((x) => x.arm === arm && x.slot === 1); return s ? s.ang - 90 : 0; }
  stanceArm(arm) { return this.liftOf(arm) <= 5; }
  armPose(arm) { const y = this.servos.find((x) => x.arm === arm && x.slot === 0); return { yaw: y ? y.ang - 90 : 0, lift: this.liftOf(arm) }; }
  locomote(dt) {
    const o = this.o, ys = this.yawServos();
    if (ys.length < 8) return;
    const cont = [];
    for (const s of ys) {
      const th = (Gait.MountAngle(s.arm) * Math.PI) / 180, phi = th - ((s.ang - 90) * Math.PI) / 180, dphi = -(s.w * Math.PI) / 180;
      const p = [R_SHAFT * Math.cos(th) + L_TIP * Math.cos(phi), R_SHAFT * Math.sin(th) + L_TIP * Math.sin(phi)];
      const v = [-L_TIP * Math.sin(phi) * dphi, L_TIP * Math.cos(phi) * dphi];
      const lifted = o.plan === "B" && !this.stanceArm(s.arm);
      if (!lifted) cont.push({ p, v });
    }
    let Nb, Nt;
    if (o.plan === "B" && cont.length >= 3) { Nb = 0; Nt = 1 / cont.length; } else { const sh = o.plan === "B" ? 0.5 : o.tipShare; Nb = 1 - sh; Nt = cont.length ? sh / cont.length : 0; }
    const mu = 0.45, mub = 0.3, rho = 2.5, eps = 0.05;
    let V = [0, 0], om = 0;
    for (let it = 0; it < 16; it++) {
      // 加权最小二乘（IRLS）近似最小耗散
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
      const add = (w, row, rhs) => { for (let i = 0; i < 3; i++) { b[i] += w * row[i] * rhs; for (let j = 0; j < 3; j++) A[i][j] += w * row[i] * row[j]; } };
      for (const c of cont) {
        const sx = V[0] - om * c.p[1] + c.v[0], sz = V[1] + om * c.p[0] + c.v[1];
        const w = (mu * Nt) / Math.max(eps, Math.hypot(sx, sz));
        add(w, [1, 0, -c.p[1]], -c.v[0]); add(w, [0, 1, c.p[0]], -c.v[1]);
      }
      const wb = (mub * Nb) / Math.max(eps, Math.hypot(V[0], V[1])), wr = (mub * Nb * rho) / Math.max(eps / 10, Math.abs(om) * rho);
      add(wb, [1, 0, 0], 0); add(wb, [0, 1, 0], 0); add(wr * rho, [0, 0, 1], 0);
      for (let i = 0; i < 3; i++) A[i][i] += 1e-9;
      const x = solve3(A, b); V = [x[0], x[1]]; om = x[2];
    }
    const h = this.pose.h, ch = Math.cos(h), sh2 = Math.sin(h);
    this.pose.x += (V[0] * ch - V[1] * sh2) * dt; this.pose.z += (V[0] * sh2 + V[1] * ch) * dt; this.pose.h += om * dt;
    this.vel = { vx: V[0], vz: V[1], om };
  }
  snapshot() {
    const R = this.res.rails;
    return {
      t: this.t, espOn: this.espOn, boots: this.boots, halted: this.rt?.halted || null, rails: R, checks: this.res.checks, warn: this.res.warn,
      servos: this.servos.map((s) => ({ role: s.role, ch: s.ch, arm: s.arm, slot: s.slot, us: s.us, ang: s.ang, cmd: s.cmd, I: s.I, stall: s.stall, buzz: s.buzz, collide: s.collide, type: s.type })),
      servoI: this.servoI, avgI: this.avgI || 0, peakI: this.peakI, peakInst: this.peakInst || 0, vel: this.vel, freq: this.dev.freq, pose: { ...this.pose }, log: this.rt ? this.rt.out.slice(-40) : [], events: this.events.slice(-20), mode: this.rt?.body.mode_, gait: this.rt?.body.GaitParamsSnapshot?.(),
    };
  }
}
function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < 3; c++) {
    let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < 3; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k < 4; k++) M[r][k] -= f * M[c][k]; }
  }
  return [M[0][3] / (M[0][0] || 1e-12), M[1][3] / (M[1][1] || 1e-12), M[2][3] / (M[2][2] || 1e-12)];
}
export { wrap };
