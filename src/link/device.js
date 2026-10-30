// v16 我的补充：OCTL/1 设备端的 JS 孪生 = octopus_link.h（Link::Dispatch / Tick）+ firmware.js 的 Runtime / OctopusBody（v10 紧凑版，8 路）。
// 两个用途：① 模拟设备（加噪声、时钟漂移、欠压复位等故障，给测试和“无硬件演示”用）；② 参考孪生（不加噪声，台面里“仿真值”那一列）。
// 电池和 IMU 是简化模型（估算），不是实测：普通舵机也没有位置反馈，遥测角是固件的指令角（限速之后）。
import { Runtime, fixesPlus } from "../assembly/octopus/firmware.js";
import { encode, parse, validate, fmtNum, PROTO, E } from "./protocol.js";
import { rng } from "./clock.js";

const V10_PINS = [18, 17, 9, 7, 6, 5, 16, 36];
export const RESET = { power: 1, brownout: 9 }; // esp_reset_reason()：ESP_RST_POWERON = 1，ESP_RST_BROWNOUT = 9
export const BOOT_MS = 1250; // SoftHomeBlocking 8 × 150 ms + 启动（估算）

export class OctoDevice {
  constructor({ noise = false, seed = 7, imu = true, batt0 = 4.05, slope = { roll: 0, pitch: 0 }, drift = 0 } = {}) {
    this.noise = noise; this.rand = rng(seed); this.imu = imu; this.slope = slope; this.drift = drift;
    this.batt0 = batt0; this.used = 0; // 已放掉的电（V，估算）
    this.onLine = null; this.boots = 0; this.sent = []; this.extraSag = 0; this.sagMs = 0;
    this.boot(RESET.power);
  }
  gauss() { const u = this.rand() || 1e-9, v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  boot(reason) {
    this.boots++; this.reason = reason; this.up = 0; this.acc ??= 0;
    this.rt = new Runtime({ F: fixesPlus(), mode: "ino", plan: "A", board: "v10", servoPins: V10_PINS, ledcWrite: () => 0, i2cWrite: () => 0, adcMv: () => (this.vbat / 2) * 1000 });
    this.rt.servoRate = 300;
    this.vbat = this.batt0 - this.used; this.prevA = new Array(8).fill(0);
    this.session = false; this.estop = false; this.telHz = 0; this.telN = 0; this.lastRx = 0; this.lastTel = 0; this.bad = 0; this.lowPrev = false;
    this.roll = this.slope.roll; this.pitch = this.slope.pitch; this.ready = false;
    this.rt.boot();
  }
  get channels() { return 8; }
  body() { return this.rt.body; }
  angles() { const b = this.body(); return Array.from({ length: 8 }, (_, i) => b.Angle(i)); }
  out(seq, cmd, args = "") {
    const line = encode(seq, cmd, typeof args === "string" ? (args ? [args] : []) : args, 2);
    this.sent.push(line); if (this.sent.length > 50) this.sent.shift();
    this.onLine?.(line);
  }
  // 一行（不含 '\n'）从主机到达
  receive(line) {
    if (!this.ready) return; // 还在启动：串口没开始读（丢）
    if (line[0] !== "@") { this.rt.send(line); return; }
    const f = parse(line);
    if (!f.ok) { this.bad++; this.out(0, "NAK", [f.err === E.CRC ? 2 : f.err === E.LEN ? 3 : f.err === E.ARGS ? 4 : 1]); return; }
    this.lastRx = this.up; this.session = true; this.rt.lastCmdMs = this.rt.millis();
    this.dispatch(f);
  }
  dispatch({ seq: s, cmd: c, args: a }) {
    const b = this.body(), n = a.length, nak = (k) => this.out(s, "NAK", [k]), ok = (x = []) => this.out(s, "OK", x);
    const In = (v, lo, hi) => !Number.isNaN(v) && v >= lo && v <= hi;
    if (c === "HELLO") { if (n !== 1) return nak(4); if (a[0] !== PROTO.version) return nak(8); return ok([PROTO.version, 10, 8, 8, Math.trunc(b.bank_.max_rate_), this.imu ? 1 : 0]); }
    if (c === "PING") return ok([Math.floor(this.up)]);
    if (c === "TEL") { if (n !== 1) return nak(4); if (!In(a[0], 0, 20)) return nak(6); this.telHz = Math.trunc(a[0]); return ok(); }
    if (c === "STOP") { this.estop = false; b.Rest(); return ok(); }
    if (c === "ESTOP") { this.estop = true; b.RelaxNow(); return ok(); }
    if (c === "RATE") { if (n !== 1) return nak(4); if (!In(a[0], 30, 240)) return nak(6); b.bank_.SetMaxRate(Math.min(240, Math.max(30, a[0]))); return ok(); }
    if (c === "TRIM") { if (n !== 4) return nak(4); if (!In(a[0], 0, 7) || !In(a[1], -20, 20) || !In(a[2], -55, 0) || !In(a[3], 0, 55)) return nak(6); b.ApplyTrim(Math.trunc(a[0]), a[1], a[2], a[3]); return ok(); }
    if (c !== "GO" && c !== "POSE" && c !== "GAIT") return nak(5);
    if (this.estop) return nak(9);
    if (c === "GAIT") {
      if (n !== 6) return nak(4);
      const v = validate("GAIT", a); if (v) return nak(v);
      const p = b.GaitParamsSnapshot(); Object.assign(p, { freq_hz: a[0], yaw_amp_deg: a[1], lift_amp_deg: a[2], phase_deg: a[3], duty: a[4], press_deg: a[5] }); b.SetGaitParams(p); return ok();
    }
    if (this.rt.lowBatt) return nak(7);
    if (c === "GO") { if (n !== 2) return nak(4); if (!In(a[0], 0, 1) || !In(a[1], -1, 1)) return nak(6); b.SetVelocity(a[0], a[1]); return ok(); }
    if (n !== 8) return nak(4);
    for (const v of a) if (!In(v, -55, 55)) return nak(6);
    b.SetPose(a); return ok();
  }
  // 欠压故障：电压瞬间再掉 sag 伏，持续 ms（低于 3.0 V → 复位，估算）
  brownout(sag = 1.1, ms = 250) { this.extraSag = sag; this.sagMs = ms; }
  current() { // 估算：板子 + BLE 0.1 A；每路保持 0.03 A + 运动 0.25 A ×（角速度 / 300 °/s）
    const b = this.body(); if (b.relaxed_) return 0.1;
    const a = this.angles(); let i = 0.1;
    for (let k = 0; k < 8; k++) { i += 0.03 + 0.25 * Math.min(1, Math.abs(a[k] - this.prevA[k]) / 0.01 / 300); }
    this.prevA = a; return i;
  }
  advance(ms) {
    this.acc += ms * (1 + this.drift);
    while (this.acc >= 10) { this.acc -= 10; this.tick10(); }
  }
  tick10() {
    this.up += 10;
    this.rt.step(10);
    if (!this.ready && this.up >= BOOT_MS) { this.ready = true; this.out(0, "BOOT", [1, this.reason]); }
    const I = this.current();
    this.used += I * 1e-6 * 2.4; // 估算：约 0.5 V / 30 min @ 2 A（500 mAh 单节）
    let v = this.batt0 - this.used - 0.15 * I;
    if (this.sagMs > 0) { v -= this.extraSag; this.sagMs -= 10; }
    if (this.noise) v += 0.008 * this.gauss();
    this.vbat = v;
    if (v < 3.0) { this.boot(RESET.brownout); return; }
    // IMU（合成，估算）：坡度 + 步态晃动 + 噪声，0.2 低通（和 octopus_body.h Step 同）
    const b = this.body();
    const walking = b.mode_ === "gait", f = b.gait_.Params().freq_hz || 0.6, t = this.up / 1000;
    const r = this.slope.roll + (walking ? 1.6 * Math.sin(2 * Math.PI * f * t) : 0) + (this.noise ? 0.25 * this.gauss() : 0);
    const p = this.slope.pitch + (walking ? 0.9 * Math.cos(2 * Math.PI * 2 * f * t) : 0) + (this.noise ? 0.25 * this.gauss() : 0);
    this.roll += 0.2 * (r - this.roll); this.pitch += 0.2 * (p - this.pitch);
    if (!this.ready) return;
    // octopus_link.h Tick
    if (this.session && this.up - this.lastRx > PROTO.watchdogMs) { this.session = false; this.telHz = 0; if (!this.estop) b.Rest(); this.out(0, "EVT", [1]); }
    if (this.rt.lowBatt && !this.lowPrev) this.out(0, "EVT", [3, this.vbat]);
    this.lowPrev = this.rt.lowBatt;
    if (this.telHz > 0 && this.up - this.lastTel >= Math.floor(1000 / this.telHz)) { this.lastTel = this.up; this.sendTel(); }
  }
  telArgs() {
    const b = this.body();
    const flags = (b.relaxed_ ? 1 : 0) | (this.rt.lowBatt ? 2 : 0) | (this.imu ? 4 : 0) | (this.estop ? 8 : 0);
    const r1 = (v) => fmtNum(v, 1);
    return [String(this.telN), String(Math.floor(this.up)), fmtNum(this.rt.vbat ?? this.vbat, 2), this.imu ? r1(this.roll) : "-", this.imu ? r1(this.pitch) : "-", String(b.ModeCode()), String(flags), ...this.angles().map(r1)];
  }
  sendTel() { const a = this.telArgs(); this.telN = (this.telN + 1) & 0xffff; this.out(0, "TEL", a); }
  // 主机侧“仿真值”直接读（不经过帧）
  snapshot() { const b = this.body(); return { up: this.up, vbat: this.rt.vbat ?? this.vbat, roll: this.imu ? this.roll : NaN, pitch: this.imu ? this.pitch : NaN, mode: b.ModeCode(), relaxed: !!b.relaxed_, a: this.angles() }; }
}
