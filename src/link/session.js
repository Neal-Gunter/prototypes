// v16 我的补充：一次“实物连接”会话。握手、序号、应答超时重发、心跳、掉线检测、自动重连、急停、演练模式、参考孪生和差值。
import { encode, parse, parseTel, PROTO, NAK, EVT } from "./protocol.js";
import { guard, MOTION, SAFETY } from "./safety.js";
import { RealClock } from "./clock.js";
import { OctoDevice, BOOT_MS } from "./device.js";

export const TIMING = { ackMs: 400, retries: 2, pingMs: 400, lostMs: 1200, backoff: [300, 600, 1200, 2400, 4000], maxTries: 12, telHz: 10 };

export class LinkSession {
  constructor({ transport = null, clock = new RealClock(), calib = null, dryRun = false, rateCap = SAFETY.rateCap, telHz = TIMING.telHz, autoReconnect = true } = {}) {
    Object.assign(this, { transport, clock, calib, dryRun, rateCap, telHz, autoReconnect });
    this.state = "idle"; this.seq = 0; this.pending = new Map(); this.listeners = {}; this.logs = [];
    this.estopped = false; this.info = null; this.lastRx = 0; this.rtt = null; this.lastTelN = null;
    this.stats = { tx: 0, rx: 0, badRx: 0, naks: 0, retries: 0, timeouts: 0, telRx: 0, telLost: 0, reconnects: 0, boots: 0, blocked: 0, dryFrames: 0 };
    this.hist = []; this.refHist = []; this.dry = [];
    this.timers = [];
  }
  on(ev, fn) { (this.listeners[ev] ||= []).push(fn); return () => { this.listeners[ev] = this.listeners[ev].filter((f) => f !== fn); }; }
  emit(ev, x) { for (const f of this.listeners[ev] || []) try { f(x); } catch (e) { console.error(e); } }
  log(text, level = "info") { const e = { t: this.clock.now(), text, level }; this.logs.push(e); if (this.logs.length > 300) this.logs.shift(); this.emit("log", e); }
  setState(s, why = "") { if (this.state === s) return; this.state = s; this.emit("state", { state: s, why }); }
  get ready() { return this.state === "ready"; }

  // ---- 唯一的发送口：演练模式下这里直接返回，什么都不发 ----
  _write(line) {
    if (this.dryRun) { this.stats.dryFrames++; this.dry.push(line); if (this.dry.length > 50) this.dry.shift(); return false; }
    if (!this.transport?.isOpen) return false;
    this.stats.tx++;
    return this.transport.write(line);
  }
  nextSeq() { this.seq = (this.seq % 65535) + 1; return this.seq; }

  // 参考孪生：不加噪声的同一份固件逻辑，喂“已被确认”的帧（演练模式下喂“本来要发”的帧）
  _newRef() {
    this.ref = new OctoDevice({ noise: false, imu: !this.info || !!this.info.imu });
    this.ref.advance(BOOT_MS + 10);
    this.refLast = this.clock.now(); this.refHist = [];
  }
  _refTick() {
    if (!this.ref) return;
    const now = this.clock.now(); this.ref.advance(Math.min(200, now - this.refLast)); this.refLast = now;
    this.refHist.push({ t: now, ...this.ref.snapshot() }); if (this.refHist.length > 1200) this.refHist.shift();
  }
  _refAt(t) { const h = this.refHist; for (let i = h.length - 1; i >= 0; i--) if (h[i].t <= t) return h[i]; return h[0]; }

  // ---- 带应答的请求 ----
  request(cmd, args = [], { retries = TIMING.retries, ackMs = TIMING.ackMs, dp = 2 } = {}) {
    const seq = this.nextSeq(); const line = encode(seq, cmd, args, dp);
    if (this.dryRun) { this._write(line); this.ref?.receive(line); this.emit("tx", { line, dry: true }); return Promise.resolve({ ok: true, dry: true, args: [] }); }
    return new Promise((resolve) => {
      const p = { seq, cmd, line, tries: 0, resolve, t0: this.clock.now() };
      const fire = () => {
        if (p.tries > retries) { this.pending.delete(seq); this.stats.timeouts++; resolve({ ok: false, timeout: true, cmd }); return; }
        if (p.tries > 0) this.stats.retries++;
        p.tries++; p.tSent = this.clock.now();
        if (!this._write(line)) { this.pending.delete(seq); resolve({ ok: false, offline: true, cmd }); return; }
        p.timer = this.clock.setTimeout(fire, ackMs);
      };
      this.pending.set(seq, p); this.emit("tx", { line }); fire();
    });
  }
  _rejectAll(why) { for (const p of this.pending.values()) { this.clock.clearTimeout(p.timer); p.resolve({ ok: false, offline: true, why, cmd: p.cmd }); } this.pending.clear(); }

  _onLine(line) {
    const f = parse(line);
    if (!f.ok) { this.stats.badRx++; return; }
    this.stats.rx++; this.lastRx = this.clock.now();
    if (f.cmd === "OK" || f.cmd === "NAK") {
      const p = this.pending.get(f.seq);
      if (!p) return;
      this.clock.clearTimeout(p.timer); this.pending.delete(f.seq);
      if (f.cmd === "OK") {
        this.ref?.receive(p.line);
        if (p.cmd === "PING") this.rtt = this.clock.now() - p.tSent;
        p.resolve({ ok: true, args: f.args });
      } else { this.stats.naks++; const code = f.args[0]; this.log(`板子拒绝了 ${p.cmd}：${NAK[code] || code}`, "warn"); p.resolve({ ok: false, nak: code, cmd: p.cmd }); }
      return;
    }
    if (f.cmd === "TEL") return this._onTel(parseTel(f.args));
    if (f.cmd === "EVT") { const [c, v] = f.args; this.log(`板子报告：${EVT[c] || "事件 " + c}${Number.isFinite(v) ? `（${v} V）` : ""}`, "warn"); this.emit("evt", { code: c, val: v }); return; }
    if (f.cmd === "BOOT") {
      this.stats.boots++;
      const why = f.args[1] === 9 ? "欠压复位（电池顶不住）" : f.args[1] === 1 ? "上电" : `原因码 ${f.args[1]}`;
      this.log(`板子重启了：${why}。会话要重建，动作不会自动恢复。`, "warn"); this.emit("boot", { reason: f.args[1] });
      if (this.state === "ready") this._lost("板子重启");
    }
  }
  _onTel(t) {
    if (!t) return;
    this.stats.telRx++;
    if (this.lastTelN != null) { const gap = (t.n - this.lastTelN + 65536) % 65536; if (gap > 1 && gap < 1000) this.stats.telLost += gap - 1; }
    this.lastTelN = t.n;
    const now = this.clock.now();
    const sim = this._refAt(now - (this.rtt ?? 0) / 2);
    const s = { t: now, real: t, sim };
    this.hist.push(s); if (this.hist.length > 600) this.hist.shift();
    if (t.estop && !this.estopped) { this.estopped = true; this.emit("estop", true); }
    this.emit("tel", s);
  }

  // ---- 连接 / 握手 ----
  async connect() {
    if (this.state === "ready" || this.state === "connecting") return true;
    this.setState("connecting"); this._newRef();
    this._startTimers();
    if (this.dryRun) { this.info = { version: 1, fw: 0, channels: 8, imu: 1, dry: true }; this.log("演练模式：不打开任何串口 / 蓝牙，指令只喂给仿真孪生。"); this.setState("ready"); return true; }
    try {
      this.transport.onLine = (l) => this._onLine(l);
      this.transport.onClose = (why) => this._lost(why);
      if (!this.transport.isOpen) await this.transport.open();
    } catch (e) { this.log(`打不开：${e?.message || e}`, "error"); this.setState("idle", "open failed"); this._stopTimers(); return false; }
    const ok = await this._handshake();
    if (!ok && this.state === "connecting") { this.setState("idle", "handshake failed"); this._stopTimers(); }
    return ok;
  }
  async _handshake() {
    this.lastRx = this.clock.now(); this.lastTelN = null;
    let r = null;
    for (let i = 0; i < 3 && !(r && r.ok); i++) r = await this.request("HELLO", [PROTO.version], { retries: 1, ackMs: 500 });
    if (!r?.ok) { this.log(r?.nak === 8 ? "协议版本不一致：请把固件升级到 v16（OCTL/1）。" : "握手失败：板子没回 HELLO（是不是 v16 固件？波特率 115200？）", "error"); return false; }
    const [ver, fw, rig, ch, rate, imu] = r.args;
    this.info = { version: ver, fw, rig, channels: ch, rate, imu };
    this._newRef();
    // 安全默认：先停（或保持急停）、再限速、再开遥测
    await this.request(this.estopped ? "ESTOP" : "STOP");
    await this.request("RATE", [Math.min(240, this.rateCap)]);
    await this.request("TEL", [this.telHz]);
    this.log(`已连接：${fw === 10 ? "v10 紧凑版" : fw === 20 ? "完善版" : "固件 " + fw}，${ch} 路舵机，${imu ? "有" : "没有"} IMU，协议 OCTL/${ver}。`);
    this.setState("ready");
    return true;
  }
  _startTimers() {
    this._stopTimers();
    this.timers.push(this.clock.every(10, () => this._refTick()));
    // 演练模式：心跳只喂孪生（不记成“本来要发的帧”，免得刷屏），否则孪生的看门狗会停下
    if (this.dryRun) { this.timers.push(this.clock.every(TIMING.pingMs, () => this.ref?.receive(encode(this.nextSeq(), "PING", [])))); return; }
    this.timers.push(this.clock.every(TIMING.pingMs, () => { if (this.state === "ready") this.request("PING", [], { retries: 0 }); }));
    this.timers.push(this.clock.every(100, () => { if (this.state === "ready" && this.clock.now() - this.lastRx > TIMING.lostMs) this._lost(`${TIMING.lostMs} ms 没收到任何东西`); }));
  }
  _stopTimers() { for (const id of this.timers) this.clock.cancel(id); this.timers = []; this.clock.clearTimeout(this.rcTimer); }

  _lost(why) {
    if (this.state === "lost" || this.state === "reconnecting" || this.state === "closed" || this.state === "idle") return;
    this._rejectAll(why);
    this.setState("lost", why);
    this.log(`连接断了（${why}）。板子收不到心跳会在 1.5 s 内自己停下（固件看门狗）。`, "warn");
    this.emit("lost", why);
    if (this.autoReconnect) { this.tries = 0; this._scheduleReconnect(); }
  }
  _scheduleReconnect() {
    if (this.tries >= TIMING.maxTries) { this.log("重连放弃了，请检查线 / 电源后手动再连。", "error"); this.setState("idle", "gave up"); this._stopTimers(); return; }
    const wait = TIMING.backoff[Math.min(this.tries, TIMING.backoff.length - 1)];
    this.tries++; this.setState("reconnecting");
    this.rcTimer = this.clock.setTimeout(async () => {
      if (this.state !== "reconnecting") return;
      try { if (!this.transport.isOpen) await this.transport.open(); } catch { return this._scheduleReconnect(); }
      const ok = await this._handshake();
      if (ok) { this.stats.reconnects++; this.log("已重连。没有自动恢复动作——要走再点一次“开始”。"); }
      else if (this.state === "reconnecting" || this.state === "connecting") this._scheduleReconnect();
    }, wait);
  }
  async disconnect() {
    if (this.state === "ready" && !this.dryRun) await this.request("STOP", [], { retries: 1 });
    this.setState("closed"); this._stopTimers(); this._rejectAll("closed");
    try { await this.transport?.close(); } catch { /* */ }
    this.log("已断开。");
    this.setState("idle");
  }

  // ---- 指令 ----
  async send(cmd, args) {
    if (MOTION.has(cmd) && this.estopped) { this.stats.blocked++; this.log(`急停锁定中，${cmd} 没发。先点“解除急停”。`, "warn"); return { ok: false, blocked: "estop" }; }
    if (!this.ready) { this.stats.blocked++; return { ok: false, blocked: "offline" }; }
    const g = guard(cmd, args, { calib: this.calib, rateCap: this.rateCap });
    if (g.notes.length) this.log(`安全层削减：${g.notes.join("；")}`, "warn");
    const r = await this.request(cmd, g.args);
    return { ...r, notes: g.notes, args: g.args };
  }
  go(throttle, steer) { return this.send("GO", [throttle, steer]); }
  stop() { return this.send("STOP", []); }
  pose(deg) { return this.send("POSE", deg); }
  gait(params) { return this.send("GAIT", params); }
  rate(v) { return this.send("RATE", [v]); }
  trim(ch, c, lo, hi) { return this.send("TRIM", [ch, c, lo, hi]); }
  // 急停：本地立刻锁死 + 连发 3 帧（不等应答）；之后只有“解除急停”（发 STOP）能解锁
  estop() {
    this.estopped = true; this.emit("estop", true);
    let sent = 0;
    for (let i = 0; i < 3; i++) { const line = encode(this.nextSeq(), "ESTOP", []); if (this._write(line)) sent++; if (i === 0) this.ref?.receive(line); }
    this.log(this.dryRun ? "急停（演练：没有发出去）" : sent ? `急停已发出 ×${sent}：舵机立刻断电。` : "急停：线路不通，帧没发出去；板子会因收不到心跳在 1.5 s 内自己停下。", "error");
    return sent;
  }
  async clearEstop() {
    if (!this.estopped) return { ok: true };
    if (this.dryRun) { this.ref?.receive(encode(this.nextSeq(), "STOP", [])); this.estopped = false; this.emit("estop", false); return { ok: true }; }
    if (!this.ready) return { ok: false, blocked: "offline" };
    const r = await this.request("STOP", []);
    if (r.ok) { this.estopped = false; this.emit("estop", false); this.log("急停已解除（板子处于停止状态）。"); }
    return r;
  }

  // ---- 差值（仿真 vs 实物）----
  diff(windowMs = 2000) {
    const now = this.clock.now(); const xs = this.hist.filter((h) => now - h.t <= windowMs);
    const ch = this.info?.channels || 8;
    const per = Array.from({ length: ch }, () => ({ sq: 0, n: 0, max: 0 }));
    let dv = 0, dr = 0, dp = 0, n = 0, nr = 0;
    for (const h of xs) {
      if (!h.sim) continue;
      for (let i = 0; i < ch; i++) { const e = (h.real.a[i] ?? NaN) - (h.sim.a[i] ?? NaN); if (Number.isFinite(e)) { per[i].sq += e * e; per[i].n++; per[i].max = Math.max(per[i].max, Math.abs(e)); } }
      dv += Math.abs(h.real.vbat - h.sim.vbat); n++;
      if (Number.isFinite(h.real.roll) && Number.isFinite(h.sim.roll)) { dr += Math.abs(h.real.roll - h.sim.roll); dp += Math.abs(h.real.pitch - h.sim.pitch); nr++; }
    }
    const rms = per.map((p) => (p.n ? Math.sqrt(p.sq / p.n) : NaN));
    const tot = this.stats.telRx + this.stats.telLost;
    return { samples: xs.length, rms, max: per.map((p) => p.max), rmsAll: rms.length ? Math.sqrt(rms.reduce((a, b) => a + (Number.isFinite(b) ? b * b : 0), 0) / rms.length) : NaN, maxAll: Math.max(0, ...per.map((p) => p.max)), vbat: n ? dv / n : NaN, roll: nr ? dr / nr : NaN, pitch: nr ? dp / nr : NaN, rtt: this.rtt, telLoss: tot ? this.stats.telLost / tot : 0 };
  }
  destroy() { this._stopTimers(); this._rejectAll("destroy"); }
}
