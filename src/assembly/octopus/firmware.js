// md 里 body_firmware_A.ino + octopus_gait.h / octopus_bus.h / octopus_body.h / octopus_mcp.cpp 的 JS 逐行移植。
// 目标是“行为一致”，包括 md 代码里的毛病（见 FIXES：修正版逐条开关）。
// 运行方式：协作式调度器，每个 FreeRTOS 任务 / Arduino loop 是一个生成器，yield 的数字 = delay 毫秒。
// 这是仿真，不是 ESP32 指令级模拟：不模拟中断、I2C 时序、双核真并发。

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const fmod = (a, b) => a % b; // 与 std::fmod 一致：符号跟被除数

// ---- 修正版逐条开关（false = md 原样）----
export const FIX_LIST = [
  { k: "rig8", zh: "RigType 改成 kSingle8（方案 A 只有 8 个舵机；md 的 .ino 写的是 kDual16）", md: "body_firmware_A.ino · setup()" },
  { k: "compile", zh: "能在 ESP32‑S3 上编译：蓝牙串口换 BLE（S3 没有经典蓝牙，BluetoothSerial 用不了）；Pca9685 补默认构造（boards_[3] 需要）", md: "body_firmware_A.ino 头部 / octopus_body.h" },
  { k: "gaitParse", zh: "GAIT 指令：toUpperCase() 之后按大写的 F= / YAW= … 匹配（原样永远匹配不上，等于没调）", md: "body_firmware_A.ino · setGait()" },
  { k: "lat", zh: "左右舷判断用 cos(安装角)（原样 sin 区分的是前后，LEFT/RIGHT 转不了弯）", md: "octopus_gait.h · Lateriality()" },
  { k: "softHome", zh: "SoftHome 真的一路一路上电（原样第一次 Tick 就把所有通道一起写出去）", md: "octopus_body.h · SoftHome() / octopus_bus.h · last_written_" },
  { k: "pulse", zh: "脉宽按 MG90S 常见 0.5–2.5 ms 标定：SetPulseRange(102, 512)（原样 150–600 = 0.73–2.93 ms，中位 1.83 ms）", md: "octopus_bus.h · Pca9685 构造参数" },
  { k: "single8", zh: "kSingle8 下 wave / pulse 改用偏航舵机（原样只写 lift，8 舵机版本挥手 / 脉冲没有动作）", md: "octopus_body.h · WriteArm()" },
  { k: "rest", zh: "Rest 交给运动任务按限速回中位、并停步态（原样在 loop 里连 Tick 20 次，瞬间跳回 90°，还和运动任务抢 bank_）", md: "octopus_body.h · ReleaseHard()" },
  { k: "home", zh: "HOME / MCP home 先停步态再 SoftHome（原样 HOME 时步态还在跑；MCP 的 home 实际调的是 Rest）", md: "body_firmware_A.ino · handleCommand() / octopus_mcp.cpp" },
  { k: "steps", zh: "MCP crawl 的 steps 生效：走够步数自动停（原样 steps 被忽略，一直走到 15 s 超时）", md: "octopus_mcp.cpp · crawl" },
  { k: "limit", zh: "每路加软件限位 90°±55°，相邻触手不打架（md 第 8 节建议 SetTrim / SetLimit，但代码里没调用）", md: "README §8 / octopus_bus.h · SetLimit()" },
];
export const fixesAll = (on) => Object.fromEntries(FIX_LIST.map((f) => [f.k, !!on]));

// ---------------- octopus_gait.h ----------------
export const kArmCount = 8;
export const defaultGait = () => ({ freq_hz: 0.6, yaw_amp_deg: 38, lift_amp_deg: 20, phase_deg: 45, duty: 0.65 });
export class Gait {
  constructor(F) { this.F = F; this.params_ = defaultGait(); this.phase_ = 0; this.steer_ = 0; this.throttle_ = 1; }
  SetParams(p) { this.params_ = { ...p }; }
  Params() { return this.params_; }
  Tick(dt) {
    this.phase_ += dt * this.params_.freq_hz * 360;
    while (this.phase_ >= 360) this.phase_ -= 360;
    while (this.phase_ < 0) this.phase_ += 360;
  }
  Reset() { this.phase_ = 0; }
  SetSteer(s) { this.steer_ = clamp(s, -1, 1); }
  SetThrottle(t) { this.throttle_ = clamp(t, 0, 1); }
  Phase01(arm) { const p = fmod(this.phase_ + this.params_.phase_deg * arm, 360) / 360; return p < 0 ? p + 1 : p; }
  Yaw(arm) {
    const p = this.Phase01(arm), d = clamp(this.params_.duty, 0.05, 0.95);
    const tri = p < d ? 1 - 2 * (p / d) : -1 + 2 * ((p - d) / (1 - d));
    return tri * this.params_.yaw_amp_deg * this.Gain(arm) * this.throttle_;
  }
  Lift(arm) {
    const p = this.Phase01(arm), d = clamp(this.params_.duty, 0.05, 0.95);
    if (p < d) return 0;
    return Math.sin(((p - d) / (1 - d)) * Math.PI) * this.params_.lift_amp_deg;
  }
  IsPowerStroke(arm) { return this.Phase01(arm) < this.params_.duty; }
  static MountAngle(arm) { return -90 + arm * 45; }
  Lateriality(arm) { const a = (Gait.MountAngle(arm) * Math.PI) / 180; return this.F.lat ? Math.cos(a) : Math.sin(a); }
  Gain(arm) { return 1 + this.steer_ * this.Lateriality(arm) * 0.85; }
}

// ---------------- octopus_bus.h ----------------
export class Pca9685 {
  constructor(addr, pmin = 150, pmax = 600) { this.addr_ = addr; this.pulse_min_ = pmin; this.pulse_max_ = pmax; this.write_ = null; }
  SetPulseRange(lo, hi) { this.pulse_min_ = lo; this.pulse_max_ = hi; }
  AngleToPulse(deg) { const d = clamp(deg, 0, 180); return Math.trunc(this.pulse_min_ + (this.pulse_max_ - this.pulse_min_) * (d / 180)) & 0xffff; }
  Init(ctx, write, freq = 50, skipPrescale = false) {
    this.write_ = write;
    if (!write) return false;
    if (!this.Write(0x00, [0x80])) return false;
    if (!this.Write(0x00, [0x30])) return false;
    let prescale = Math.trunc(25000000 / (4096 * freq) + 0.5);
    prescale = clamp(prescale, 3, 255);
    if (!skipPrescale && !this.Write(0xfe, [prescale - 1])) return false;
    if (!this.Write(0x00, [0x20])) return false;
    if (!this.Write(0x01, [0x04])) return false;
    return true;
  }
  SetRaw(ch, on, off) { return this.Write(0x06 + 4 * ch, [on & 0xff, on >> 8, off & 0xff, off >> 8]); }
  SetAngle(ch, deg) { return this.SetRaw(ch, 0, this.AngleToPulse(deg)); }
  Write(reg, data) { return this.write_(this.addr_, reg, data) === 0; }
}
export class ServoBank {
  constructor() { this.boards_ = null; this.board_count_ = 0; this.channels_ = 0; this.max_rate_ = 360; const z = () => new Array(48).fill(0); this.trim_ = z(); this.lo_ = z(); this.hi_ = z(); this.target_ = z(); this.present_ = z(); this.last_written_ = z(); /* 全局对象零初始化 */ }
  Bind(boards, n) { this.boards_ = boards; this.board_count_ = n; }
  Begin(channels, home = 90) { this.channels_ = channels; for (let i = 0; i < 48; i++) { this.target_[i] = home; this.present_[i] = home; this.trim_[i] = 0; this.lo_[i] = 0; this.hi_[i] = 180; } return true; }
  SetTrim(ch, d) { if (this.Valid(ch)) this.trim_[ch] = d; }
  SetLimit(ch, lo, hi) { if (!this.Valid(ch)) return; this.lo_[ch] = lo; this.hi_[ch] = hi; }
  SetTarget(ch, deg) { if (!this.Valid(ch)) return; let v = deg + this.trim_[ch]; v = clamp(v, this.lo_[ch], this.hi_[ch]); this.target_[ch] = v; }
  SetMaxRate(r) { this.max_rate_ = r; }
  Tick(dt) {
    if (!this.boards_) return;
    const step = this.max_rate_ * dt;
    for (let i = 0; i < this.channels_; i++) {
      const d = this.target_[i] - this.present_[i];
      if (Math.abs(d) <= step) this.present_[i] = this.target_[i];
      else this.present_[i] += d > 0 ? step : -step;
      if (Math.abs(this.present_[i] - this.last_written_[i]) >= 0.35) { this.WriteChannel(i, this.present_[i]); this.last_written_[i] = this.present_[i]; }
    }
  }
  ReleaseAll() { for (let i = 0; i < this.channels_; i++) this.target_[i] = 90 + this.trim_[i]; }
  Present(ch) { return this.Valid(ch) ? this.present_[ch] : 0; }
  Valid(ch) { return ch >= 0 && ch < this.channels_; }
  WriteChannel(ch, deg) { const b = Math.floor(ch / 16), c = ch % 16; if (b >= this.board_count_) return; this.boards_[b].SetAngle(c, deg); }
}

// ---------------- octopus_body.h ----------------
export const RIG = { kSingle8: "kSingle8", kDual16: "kDual16" };
const ChannelsFor = (rig) => (rig === "kDual16" ? 16 : 8);
const ChannelOf = (rig, arm, slot) => (rig === "kDual16" ? arm * 2 + slot : arm);
export class OctopusBody {
  constructor(rt) { this.rt = rt; this.F = rt.F; this.rig_ = "kDual16"; this.channels_ = 16; this.boards_ = []; this.bank_ = new ServoBank(); this.gait_ = new Gait(rt.F); this.mode_ = "idle"; this.running_ = false; this.wave_arm_ = 0; this.wave_timer_ = 0; this.pulse_left_ = 0; this.pulse_period_ = 0.6; this.pulse_timer_ = 0; this.crawlCycles = null; }
  Init(rig, write) {
    this.rig_ = rig; this.channels_ = ChannelsFor(rig);
    const n = Math.ceil(this.channels_ / 16);
    for (let i = 0; i < n; i++) {
      this.boards_[i] = new Pca9685(0x40 + i);
      if (this.F.pulse) this.boards_[i].SetPulseRange(102, 512);
      if (!this.boards_[i].Init(null, write, 50, this.rt.skipPrescale)) { this.rt.log(`E OctopusBody: PCA9685 #${i} (0x${(0x40 + i).toString(16).toUpperCase()}) 初始化失败`); return false; }
      this.rt.log(`I OctopusBody: PCA9685 #${i} (0x${(0x40 + i).toString(16).toUpperCase()}) 就绪`);
    }
    this.bank_.Bind(this.boards_, n);
    this.bank_.Begin(this.channels_, 90);
    this.bank_.SetMaxRate(300);
    if (this.F.limit) for (let c = 0; c < this.channels_; c++) this.bank_.SetLimit(c, 35, 145);
    if (this.F.softHome) for (let c = 0; c < 48; c++) this.bank_.last_written_[c] = NaN;
    return true;
  }
  *SoftHome() {
    if (this.F.softHome && this.running_) {
      // 修正版、运动任务已在跑：一路一路改目标，交给限速去走
      for (let i = 0; i < this.channels_; i++) { this.bank_.SetTarget(i, 90); yield 150; }
      return;
    }
    if (this.F.softHome) {
      // 修正版：一路一路写出去，每路之间 150 ms，让上一路先到位（舵机上电位置未知，只能这样错开）
      for (let i = 0; i < this.channels_; i++) {
        this.bank_.SetTarget(i, 90); this.bank_.present_[i] = this.bank_.target_[i];
        this.bank_.WriteChannel(i, this.bank_.present_[i]); this.bank_.last_written_[i] = this.bank_.present_[i];
        yield 150;
      }
      return;
    }
    for (let i = 0; i < this.channels_; i++) {
      this.bank_.SetTarget(i, 90);
      for (let k = 0; k < 3; k++) { this.bank_.Tick(0.02); yield 16; }
    }
  }
  Start() { if (this.running_) return; this.running_ = true; this.rt.spawn("octo_motion", this.TaskLoop()); }
  *TaskLoop() { while (this.running_) { this.Step(0.02); yield 20; } }
  SetVelocity(t, s) { this.gait_.SetThrottle(t); this.gait_.SetSteer(s); this.mode_ = "gait"; }
  SetGaitParams(p) { this.gait_.SetParams(p); }
  GaitParamsSnapshot() { return { ...this.gait_.Params() }; }
  Rest() { this.mode_ = "idle"; this.crawlCycles = null; this.ReleaseHard(); }
  WaveOnce(arm) { this.mode_ = "idle"; this.wave_arm_ = arm % kArmCount; this.wave_timer_ = 0; this.mode_ = "wave"; }
  Pulse(times, period = 0.6) { this.mode_ = "pulse"; this.pulse_left_ = times; this.pulse_period_ = period; this.pulse_timer_ = 0; }
  Step(dt) {
    if (this.mode_ === "gait") this.StepGait(dt);
    else if (this.mode_ === "wave") this.StepWave(dt);
    else if (this.mode_ === "pulse") this.StepPulse(dt);
    else this.StepIdle(dt);
    this.bank_.Tick(dt);
  }
  ReleaseHard() {
    this.bank_.ReleaseAll();
    if (this.F.rest) return; // 修正版：交给运动任务按限速走
    for (let i = 0; i < 20; i++) this.bank_.Tick(0.02); // 原样：同一时刻连 Tick 20 次（不等待）
  }
  WriteArm(arm, yaw, lift) {
    arm %= kArmCount;
    if (this.rig_ === "kSingle8") this.bank_.SetTarget(ChannelOf(this.rig_, arm, 0), 90 + yaw);
    else { this.bank_.SetTarget(ChannelOf(this.rig_, arm, 0), 90 + yaw); this.bank_.SetTarget(ChannelOf(this.rig_, arm, 1), 90 + lift); }
  }
  StepGait(dt) {
    const before = this.gait_.phase_;
    this.gait_.Tick(dt);
    if (this.crawlCycles != null && this.gait_.phase_ < before) { if (--this.crawlCycles <= 0) { this.crawlCycles = null; this.mode_ = "idle"; this.bank_.ReleaseAll(); return; } }
    for (let a = 0; a < kArmCount; a++) this.WriteArm(a, this.gait_.Yaw(a), this.gait_.Lift(a));
  }
  StepWave(dt) {
    this.gait_.Reset();
    this.wave_timer_ += dt;
    const dur = 1.2;
    if (this.wave_timer_ >= dur) { this.mode_ = "idle"; return; }
    const k = this.wave_timer_ / dur, env = Math.sin(k * Math.PI);
    const yawWave = this.F.single8 && this.rig_ === "kSingle8";
    for (let a = 0; a < kArmCount; a++) {
      if (yawWave) this.WriteArm(a, a === this.wave_arm_ ? env * 40 * Math.sin(k * 6 * Math.PI) : 0, 0);
      else this.WriteArm(a, 0, a === this.wave_arm_ ? env * 45 : 0);
    }
  }
  StepPulse(dt) {
    this.pulse_timer_ += dt;
    if (this.pulse_timer_ >= this.pulse_period_) { this.pulse_timer_ = 0; if (--this.pulse_left_ <= 0) { this.mode_ = "idle"; return; } }
    const k = this.pulse_timer_ / this.pulse_period_, curl = Math.sin(k * Math.PI) * 40;
    const yawPulse = this.F.single8 && this.rig_ === "kSingle8";
    for (let a = 0; a < kArmCount; a++) this.WriteArm(a, yawPulse ? (a % 2 ? 1 : -1) * curl * 0.6 : 0, yawPulse ? 0 : curl);
  }
  StepIdle() { this.gait_.Reset(); for (let a = 0; a < kArmCount; a++) this.WriteArm(a, 0, 0); }
}

// ---------------- 运行时（调度器 + Arduino 外设替身） ----------------
export class Runtime {
  constructor({ F, i2cWrite, log, skipPrescale = false, mode = "ino", plan = "A" }) {
    this.F = F; this.i2cWrite = i2cWrite; this.logFn = log || (() => {}); this.skipPrescale = skipPrescale; this.mode = mode; this.plan = plan;
    this.now = 0; this.tasks = []; this.lines = []; this.out = []; this.body = new OctopusBody(this); this.lastCmdMs = 0; this.halted = null; this.boots = 0;
  }
  log(t) { this.out.push(`[${(this.now / 1000).toFixed(2)}s] ${t}`); if (this.out.length > 200) this.out.shift(); this.logFn(t); }
  millis() { return Math.floor(this.now); }
  spawn(name, gen) { this.tasks.push({ name, gen, wake: this.now }); }
  boot() {
    this.tasks = []; this.body = new OctopusBody(this); this.boots++; this.halted = null;
    this.spawn(this.mode === "mcp" ? "xiaozhi_main" : "loopTask", this.mode === "mcp" ? this.mcpMain() : this.inoMain());
  }
  // body_firmware_A.ino：setup() + loop()
  *inoMain() {
    this.log("ESP-ROM: boot（模拟）");
    const rig = this.plan === "B" ? RIG.kDual16 : this.F.rig8 ? RIG.kSingle8 : RIG.kDual16;
    if (!this.body.Init(rig, this.i2cWrite)) {
      this.log("PCA9685 初始化失败！检查 SDA/SCL 接线、供电、I2C 地址");
      this.halted = "PCA9685 初始化失败，程序停在 while(1)";
      while (true) yield 1000;
    }
    yield* this.body.SoftHome();
    this.body.Start();
    this.log(this.F.compile ? "BLE 串口已广播：OctoBrain（模拟）" : "SerialBT.begin(\"OctoBrain\")（原样在 S3 上编译不过；这里假设已改好，按模拟串口继续）");
    this.log("Octopus body ready. BT name = OctoBrain");
    this.lastCmdMs = this.millis();
    while (true) {
      while (this.lines.length) yield* this.handleCommand(this.lines.shift());
      if (this.millis() - this.lastCmdMs > 15000) { this.body.Rest(); this.lastCmdMs = this.millis(); this.log("15 s 没有指令 → 自动 Rest"); }
      yield 10;
    }
  }
  // 小智固件里调 RegisterOctopusTools(body)：板子初始化做了什么 md 没写。这里按 .ino 的顺序 Init → SoftHome → Start（文档未写，照 .ino 推）
  *mcpMain() {
    const rig = this.plan === "B" || !this.F.rig8 ? RIG.kDual16 : RIG.kSingle8;
    if (!this.body.Init(this.plan === "B" ? RIG.kDual16 : rig, this.i2cWrite)) { this.log("PCA9685 初始化失败"); this.halted = "PCA9685 初始化失败"; while (true) yield 1000; }
    yield* this.body.SoftHome();
    this.body.Start();
    this.log("小智固件（模拟）：已注册 self.octopus.action / self.octopus.set_gait");
    this.mcpReady = true;
    while (true) yield 50;
  }
  send(line) { this.lines.push(line); }
  *handleCommand(s0) {
    let s = s0.trim().toUpperCase();
    this.lastCmdMs = this.millis();
    this.log("> " + s);
    const b = this.body;
    if (s === "STOP" || s === "REST") { b.Rest(); return; }
    if (s === "GO" || s === "WALK" || s === "FWD") { b.SetVelocity(1, 0); return; }
    if (s === "LEFT" || s === "TURNL") { b.SetVelocity(1, -1); return; }
    if (s === "RIGHT" || s === "TURNR") { b.SetVelocity(1, 1); return; }
    if (s.startsWith("WAVE")) { let a = parseInt(s.substring(4).trim(), 10) || 0; if (a < 0 || a > 7) a = 0; b.WaveOnce(a); return; }
    if (s.startsWith("PULSE")) { let n = parseInt(s.substring(5).trim(), 10) || 0; if (n < 1) n = 1; b.Pulse(n); return; }
    if (s.startsWith("HOME")) { if (this.F.home) b.mode_ = "idle"; yield* b.SoftHome(); return; }
    if (s.startsWith("GAIT")) { this.setGait(s); return; }
    this.log("? unknown: " + s);
  }
  setGait(s) {
    const p = this.body.GaitParamsSnapshot();
    const keys = this.F.gaitParse ? ["F=", "YAW=", "LIFT=", "PHASE=", "DUTY="] : ["f=", "yaw=", "lift=", "phase=", "duty="];
    let i = 0, hit = 0;
    while (i < s.length) {
      const sp = s.indexOf(" ", i);
      const tok = sp === -1 ? s.substring(i) : s.substring(i, sp);
      const num = (n) => parseFloat(tok.substring(n)) || 0;
      if (tok.startsWith(keys[0])) { p.freq_hz = num(2); hit++; }
      else if (tok.startsWith(keys[1])) { p.yaw_amp_deg = num(4); hit++; }
      else if (tok.startsWith(keys[2])) { p.lift_amp_deg = num(5); hit++; }
      else if (tok.startsWith(keys[3])) { p.phase_deg = num(6); hit++; }
      else if (tok.startsWith(keys[4])) { p.duty = num(5); hit++; }
      i = sp === -1 ? s.length : sp + 1;
    }
    this.body.SetGaitParams(p);
    this.log("gait updated" + (hit ? "" : "（注意：一个参数都没匹配上，参数没变）"));
    return hit;
  }
  // octopus_mcp.cpp 的两个工具
  mcp(tool, args = {}) {
    const b = this.body;
    if (!this.running()) return "body not ready";
    if (tool === "self.octopus.set_gait") {
      const p = b.GaitParamsSnapshot();
      const freq = clamp(args.freq ?? 6, 2, 20), amp = clamp(args.amplitude ?? 38, 0, 60), ph = clamp(args.phase ?? 45, 0, 180);
      p.freq_hz = freq / 10; p.yaw_amp_deg = amp; p.phase_deg = ph;
      b.SetGaitParams(p);
      return "步态已更新";
    }
    if (tool !== "self.octopus.action") return "未知工具: " + tool;
    const action = args.action ?? "crawl";
    const steps = clamp(args.steps ?? 3, 1, 100), dir = clamp(args.direction ?? 0, -100, 100), speed = clamp(args.speed ?? 1000, 300, 3000), arm = clamp(args.arm ?? 0, 0, 7);
    const hz = 1000 / (speed > 0 ? speed : 1000);
    if (action === "crawl") { const p = b.GaitParamsSnapshot(); p.freq_hz = hz; b.SetGaitParams(p); b.SetVelocity(1, (dir / 100) * 0.6); if (this.F.steps) b.crawlCycles = steps; return "开始爬行"; }
    if (action === "wave") { b.WaveOnce(arm); return "挥手"; }
    if (action === "pulse") { b.Pulse(steps); return "脉冲收缩"; }
    if (action === "rest") { b.Rest(); return "已放松"; }
    if (action === "home") { if (this.F.home) { b.mode_ = "idle"; b.crawlCycles = null; this.spawn("home", b.SoftHome()); } else b.Rest(); return "已回中位"; }
    return "未知动作: " + action;
  }
  running() { return this.body.running_; }
  step(dtMs) {
    this.now += dtMs;
    for (const t of this.tasks) {
      let guard = 0;
      while (!t.done && t.wake <= this.now && guard++ < 400) {
        const r = t.gen.next();
        if (r.done) { t.done = true; break; }
        t.wake += Math.max(0.001, r.value || 0);
      }
    }
    this.tasks = this.tasks.filter((t) => !t.done);
  }
}

// ---------------- PCA9685 芯片替身（寄存器级） ----------------
export class Pca9685Dev {
  constructor(addr = 0x40) { this.addr = addr; this.reset(); }
  reset() { this.regs = new Uint8Array(256); this.regs[0] = 0x11; this.regs[1] = 0x04; this.regs[0xfe] = 0x1e; this.writes = 0; this.lastWriteMs = new Array(16).fill(-1); }
  write(reg, data, nowMs = 0) {
    let r = reg;
    for (const v of data) {
      if (r === 0xfe) { if (this.regs[0] & 0x10) this.regs[0xfe] = Math.max(3, v); } // 只有 SLEEP 时能写预分频（数据手册 7.3.5）
      else if (r === 0x00) this.regs[0] = v & 0x7f; // RESTART 位写 1 后自清
      else this.regs[r] = v;
      if (r >= 6 && r < 70) this.lastWriteMs[Math.floor((r - 6) / 4)] = nowMs;
      if (this.regs[0] & 0x20) r = (r + 1) & 0xff; // AI 自动递增
    }
    this.writes++;
    return 0;
  }
  get sleeping() { return !!(this.regs[0] & 0x10); }
  get freq() { return 25e6 / (4096 * (this.regs[0xfe] + 1)); }
  channel(ch) {
    const b = 6 + 4 * ch, R = this.regs;
    const on = R[b] | ((R[b + 1] & 0x0f) << 8), off = R[b + 2] | ((R[b + 3] & 0x0f) << 8);
    const fullOn = R[b + 1] & 0x10, fullOff = R[b + 3] & 0x10;
    if (this.sleeping || fullOff) return { us: 0, ticks: 0, on, off };
    const period = 1e6 / this.freq;
    if (fullOn) return { us: period, ticks: 4096, on, off };
    const ticks = (off - on + 4096) % 4096;
    return { us: (ticks / 4096) * period, ticks, on, off };
  }
}
