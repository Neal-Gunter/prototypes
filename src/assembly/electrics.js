// 装配台的“通电”层：台面上的实际接线 → 网表 → 直流求解 → 固件输入；固件输出 → 网表电源。
// 早期原型，简化仿真：固件用同一个迷你解释器在主线程按时间片跑（每帧最多约 4 ms），没通电的板子不跑程序。
import * as THREE from "three";
import { createProgram, FwError } from "../workbench/firmware/interpreter.js";
import { buildCircuit, solve, checks, servoStates, firmwareInputs, boardOf, ensureRefs, LED_BURN_MA, generateSketch, elemKind } from "./netlist.js";

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SERVO_DEG_S = 300; // 估算：微型舵机空载转速约 0.1 s/60°（这里放慢一半）

export class BenchElectrics {
  constructor(engine, { now = () => performance.now(), budgetMs = 4 } = {}) {
    this.engine = engine;
    this.now = now;
    this.budgetMs = budgetMs;
    this.fw = {}; // uid → 状态
    this.progs = {};
    this.code = {};
    this.burnT = {};
    this.servoCur = {};
    this.last = null;
    this.subs = new Set();
    this.lastT = now();
  }
  on(f) { this.subs.add(f); return () => this.subs.delete(f); }
  state(uid) {
    if (!this.fw[uid]) this.fw[uid] = { modes: {}, vals: {}, servoPins: new Set(), servoAngle: {}, servoObj: {}, serial: "", running: false, error: null, warn: null, inputs: { d: {}, a: {} }, lines: 0 };
    return this.fw[uid];
  }
  // 上传固件：编译出错直接报（行号）；板子没通电就先等着，通电时从头运行（和真实板子上电复位一样）
  upload(uid, code) {
    this.code[uid] = code;
    this.stop(uid);
    const st = this.state(uid);
    st.uploaded = true;
    st.error = null;
    try { createProgram(code, { emit() {}, now: this.now, read: () => null, adcBits: 12 }); } catch (e) { st.error = { msg: e.message, line: e instanceof FwError ? e.line : null, phase: "compile" }; st.uploaded = false; }
    return !st.error;
  }
  boot(uid) {
    const P = this.engine.parts.get(uid);
    const B = boardOf(P?.def);
    if (!B || !this.code[uid]) return;
    const old = this.fw[uid];
    this.fw[uid] = null;
    const st = this.state(uid);
    st.uploaded = true;
    st.serial = old?.serial ? old.serial + "\n— 复位 —\n" : "";
    const io = {
      emit: (ev) => this.onEvent(uid, ev),
      now: this.now,
      read: (kind, pin) => st.inputs[kind]?.[pin] ?? null,
      adcBits: B.adcBits,
    };
    try {
      this.progs[uid] = { gen: createProgram(this.code[uid], io).run(), wake: 0 };
      st.running = true;
    } catch (e) {
      st.error = { msg: e.message, line: e instanceof FwError ? e.line : null, phase: "compile" };
    }
  }
  stop(uid) {
    delete this.progs[uid];
    const st = this.fw[uid];
    if (st) { st.running = false; st.modes = {}; st.vals = {}; st.servoPins = new Set(); st.servoAngle = {}; }
  }
  onEvent(uid, ev) {
    const st = this.state(uid);
    if (ev.type === "pin") {
      if (ev.mode) st.modes[ev.pin] = ev.mode;
      if (ev.value != null) {
        st.vals[ev.pin] = ev.value;
        if (!st.modes[ev.pin]) { st.warn = `第 ${ev.line} 行：GPIO${ev.pin} 没先 pinMode(…, OUTPUT) 就 digitalWrite（真实板子上可能没输出）`; }
      }
    } else if (ev.type === "serial") {
      st.serial += ev.text + (ev.nl ? "\n" : "");
      if (st.serial.length > 4000) st.serial = st.serial.slice(-3000);
      st.lines++;
    } else if (ev.type === "attach") { st.servoPins.add(ev.pin); st.servoObj[ev.servo] = ev.pin; st.servoAngle[ev.pin] = st.servoAngle[ev.pin] ?? 90; }
    else if (ev.type === "write") { const pin = ev.pin ?? st.servoObj[ev.servo]; if (pin != null) st.servoAngle[pin] = ev.angle; }
    else if (ev.type === "detach") { st.servoPins.delete(ev.pin); }
    else if (ev.type === "warn") st.warn = ev.msg;
  }
  stepPrograms() {
    for (const [uid, pr] of Object.entries(this.progs)) {
      const st = this.fw[uid];
      if (!st?.running || st.paused) continue;
      const t0 = this.now();
      let n = 0;
      try {
        while (this.now() >= pr.wake && this.now() - t0 < this.budgetMs && n < 20000) {
          n++;
          const r = pr.gen.next();
          if (r.done) { st.running = false; st.done = true; break; }
          const v = r.value;
          if (v.delay > 0) { pr.wake = this.now() + v.delay; break; }
        }
      } catch (e) {
        st.running = false;
        st.error = { msg: e.message, line: e instanceof FwError ? e.line : null, phase: "run" };
        delete this.progs[uid];
      }
    }
  }
  // 每 ~100 ms 调一次：重建网表、求解、喂输入、判断烧坏、算舵机角度、出自检
  tick() {
    const E = this.engine;
    const t = this.now();
    const dt = Math.min(0.5, (t - this.lastT) / 1000);
    this.lastT = t;
    ensureRefs(E);
    let cir = buildCircuit(E);
    let sol = solve(cir, this.fw);
    // 上电/断电：断电的板子程序暂停并复位
    for (const b of sol.boards) {
      const st = this.fw[b.uid];
      if (!this.code[b.uid] || !st) continue;
      if (!b.powered && st.running) { this.stop(b.uid); st.paused = true; st.unpowered = true; }
      else if (b.powered && (st.unpowered || (!st.running && st.uploaded && !st.done && !st.error && !this.progs[b.uid]))) { st.unpowered = false; st.paused = false; this.boot(b.uid); }
      else if (!b.powered) st.unpowered = true;
    }
    this.stepPrograms();
    sol = solve(cir, this.fw);
    for (const b of sol.boards) if (this.fw[b.uid]?.running) this.fw[b.uid].inputs = firmwareInputs(cir, sol, b.uid);
    // LED 过流 > 0.2 s 就烧坏（真实中可能是变暗、变色或开路）
    let burnt = false;
    for (const l of sol.leds) {
      if (l.mA > LED_BURN_MA) { this.burnT[l.uid] = (this.burnT[l.uid] || 0) + dt; if (this.burnT[l.uid] > 0.2) { E.parts.get(l.uid).state.burnt = true; E.toast(`${E.parts.get(l.uid).state.ref} 电流 ${l.mA.toFixed(0)} mA，烧坏了`, "error"); burnt = true; E.history.push({ t: "burn", uid: l.uid, mA: l.mA }); } }
      else this.burnT[l.uid] = 0;
    }
    if (burnt) { cir = buildCircuit(E); sol = solve(cir, this.fw); }
    const servos = servoStates(cir, sol, this.fw);
    for (const s of servos) {
      const cur = this.servoCur[s.uid] ?? 90;
      const tgt = s.moving ? s.angle : cur;
      const step = SERVO_DEG_S * dt;
      this.servoCur[s.uid] = Math.abs(tgt - cur) <= step ? tgt : cur + Math.sign(tgt - cur) * step;
      s.cur = this.servoCur[s.uid];
      this.applyServoVisual(s.uid, s.cur);
    }
    const list = checks(cir, sol, this.fw);
    const leds = new Map(sol.leds.map((l) => [l.uid, l]));
    this.last = { cir, sol, servos, checks: list, leds, t };
    for (const f of this.subs) f(this.last);
    return this.last;
  }
  // 舵机输出轴转动：只改画面（舵盘、触手跟着转），不改刚体（简化）
  applyServoVisual(uid, deg) {
    const E = this.engine;
    const P = E.parts.get(uid);
    const shaft = (P.def.anchors || []).find((a) => a.t === "shaft");
    if (!shaft) return;
    const pivot = E.toWorld(uid, shaft.p);
    const axis = V(0, 1, 0).applyQuaternion(E.worldPose(uid).q).normalize();
    const seen = new Set([uid]);
    const q = [uid];
    while (q.length) {
      const u = q.pop();
      for (const e of E.edges) {
        if (e.why !== "press") continue;
        const o = e.a === u ? e.b : e.b === u ? e.a : null;
        if (o && !seen.has(o)) { seen.add(o); q.push(o); }
      }
    }
    seen.delete(uid);
    for (const u of seen) E.parts.get(u).vis = { pivot, axis, ang: ((deg - 90) * Math.PI) / 180 };
  }
  sketchFor(uid) { return generateSketch(this.last?.cir || buildCircuit(this.engine), uid); }
  boards() { return [...this.engine.parts.values()].filter((p) => boardOf(p.def)).map((p) => p.uid); }
  press(uid, on) { const P = this.engine.parts.get(uid); if (P && elemKind(P.def) === "btn") P.state.pressed = !!on; }
  pot(uid, pos) { const P = this.engine.parts.get(uid); if (P && elemKind(P.def) === "pot") P.state.pos = Math.max(0, Math.min(1, pos)); }
  reset() { this.progs = {}; this.fw = {}; this.code = {}; this.burnT = {}; this.servoCur = {}; this.last = null; }
}
