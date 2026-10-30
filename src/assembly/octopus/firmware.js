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
  // —— 完善版（我的补充）：md 没写清楚 / 写错、需要改硬件或改设计的部分 ——
  { k: "gait2", plus: true, zh: "我的补充 · 镜像步态：左右两舷反向扫（cos(安装角) 加权），直行时转矩抵消；A 靠单向脚垫、差速转弯；B 默认 phase 180 交替步态 + 支撑相下压 20°（v9 物理实测：v8 的 phase 0 触手尖只悬空 1.2 mm、走 0 cm），原地转时八条同向扫", md: "octopus_gait.h · Yaw()（md 的 CPG 八条同向扫，台面里 B 原地转、A 只蹭）" },
  { k: "antiCollide", plus: true, zh: "我的补充 · 邻臂防撞软限位：每帧检查相邻两条的夹角，小于机械间隙（A 12°、B 16°；B 为 v8 在 3D 碰撞体上实测 13° + 余量）+3° 余量就两边各退一半", md: "md 无（README §8 只说“相邻触手打架”）" },
  { k: "speed", plus: true, zh: "我的补充 · MCP speed 夹到 ≥ 834 ms/周期（≤ 1.2 Hz，md 自己写的舵机跟得上的上限）", md: "octopus_mcp.cpp · hz = 1000 / speed" },
  { k: "batt", plus: true, zh: "我的补充 · 电池检测改到 GPIO10（ADC1_CH9，避开麦克风 WS 的 GPIO4 和采购清单第二批 I2C 的 GPIO1/2），100k/22k 分压，3S 低于 9.6 V 停运动、回到 10.2 V 才恢复（估算阈值）", md: "body_firmware_A.ino BATTERY_PIN 4 / 无线架构 §6" },
  { k: "relax", plus: true, zh: "我的补充 · Rest 回到中位 1 s 后把 PWM 设成 FULL OFF（舵机不再出力、不再耗电），下次动作前重新写出", md: "octopus_body.h · Rest()（原样舵机一直出力）" },
  { k: "pcaWake", plus: true, zh: "我的补充 · PCA9685 退出 SLEEP 后等 500 µs 再写 RESTART（NXP 数据手册：振荡器最长 500 µs 稳定）。仿真不模拟时序，只在固件里改", md: "octopus_bus.h · Pca9685::Init()" },
];
export const fixesAll = (on) => Object.fromEntries(FIX_LIST.map((f) => [f.k, !!on && !f.plus]));
export const fixesPlus = () => Object.fromEntries(FIX_LIST.map((f) => [f.k, true]));
// 完善版默认步态（我的补充，估算，台面里调出来的）：A 沿用 md 的环形波；B 改成交替步态 + 支撑相下压（v9）
// v9（我的补充）：B 改成两组交替（phase 180 → 偶数号一组、奇数号一组）、duty 0.55（两组各有 10% 时间同时着地），支撑相俯仰下压 press 20°。
// 物理仿真实测：v8 的 B（phase 0、支撑相 lift = 0）触手尖离桌 1.2 mm，机身整个压在底板上，触手推不动（0 cm/周期）。
export const plusGait = (plan) => (plan === "B" ? { freq_hz: 0.6, yaw_amp_deg: 20, lift_amp_deg: 25, phase_deg: 180, duty: 0.55, press_deg: 20 } : { freq_hz: 0.6, yaw_amp_deg: 30, lift_amp_deg: 20, phase_deg: 45, duty: 0.6 });
export const MIN_GAP = { A: 12, B: 16, v10: -30 }; // v10：2D 触手轮廓扫描 −35° 才碰（v10.js V10_EST.gap），+5° 余量 = −30（等于软件限位内不需要防撞） // 相邻触手机械间隙（°）。B：v8 在 3D 碰撞体上实测相邻模块 13° 才接触，+3° 余量 = 16（v7 估算 40 过于保守）

// v10（我的补充）：QT Py ESP32‑S3 没有 PCA9685，8 个舵机直接用 LEDC（50 Hz、14 位）。
// 给 ServoBank 一个和 Pca9685 同样接口的“板子”，这样 octopus_body / gait 不用改。
// 脉宽按 SG51R 页面：0.75–2.25 ms 对应全行程。
export class LedcBoard {
  constructor(pins, us0 = 750, us1 = 2250) { this.pins = pins; this.us0 = us0; this.us1 = us1; this.write_ = null; }
  Init(ctx, rt) { this.rt = rt; for (const p of this.pins) if (!rt.ledcAttach(p, 50, 14)) return false; return true; }
  Duty(us) { return Math.round((us / 20000) * 16383); }
  SetAngle(ch, deg) { const d = clamp(deg, 0, 180); return this.rt.ledcWrite(this.pins[ch], this.Duty(this.us0 + ((this.us1 - this.us0) * d) / 180)); }
  SetRaw(ch, on, off) { return this.rt.ledcWrite(this.pins[ch], off & 0x1000 ? 0 : this.Duty(((off - on) / 4096) * 20000)); }
}

// ---------------- octopus_gait.h ----------------
export const kArmCount = 8;
export const defaultGait = () => ({ freq_hz: 0.6, yaw_amp_deg: 38, lift_amp_deg: 20, phase_deg: 45, duty: 0.65 });
export class Gait {
  constructor(F) { this.F = F; this.params_ = defaultGait(); this.phase_ = 0; this.steer_ = 0; this.throttle_ = 1; this.spinTurn = false; }
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
    if (this.F.gait2) return tri * this.params_.yaw_amp_deg * this.Sweep(arm) * this.throttle_;
    return tri * this.params_.yaw_amp_deg * this.Gain(arm) * this.throttle_;
  }
  // 我的补充：左右舷镜像扫动。直行时左右两边反向扫（推力左右抵消转矩、合成向前）。
  // 转弯：B（能抬腿）按 steer 把八条往同一个方向扫 = 原地转；A（只有偏航）一侧减小摆幅 = 差速转弯。结果夹在 [-1, 1]，摆幅不会超过设定值。
  Sweep(arm) {
    const c = Math.cos((Gait.MountAngle(arm) * Math.PI) / 180), s = this.steer_;
    if (this.spinTurn) return clamp((1 - Math.abs(s)) * c - s, -1, 1);
    return clamp(c * (1 - s * Math.sign(c)), -1, 1);
  }
  Lift(arm) {
    const p = this.Phase01(arm), d = clamp(this.params_.duty, 0.05, 0.95);
    const pr = this.params_.press_deg || 0; // 我的补充（v9）：支撑相往下压 pr 度把机身撑起来；md 原样没有这个参数 = 0
    if (p < d) return -pr;
    return -pr + Math.sin(((p - d) / (1 - d)) * Math.PI) * (this.params_.lift_amp_deg + pr);
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
    if (this.rt.board === "v10") {
      this.boards_[0] = new LedcBoard(this.rt.servoPins);
      if (!this.boards_[0].Init(null, this.rt)) { this.rt.log("E OctopusBody: ledcAttach 失败"); return false; }
      this.rt.log(`I OctopusBody: LEDC 8 路就绪（GPIO ${this.rt.servoPins.join(" ")}，50 Hz / 14 位）`);
    } else for (let i = 0; i < n; i++) {
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
    this.gait_.spinTurn = rig === "kDual16";
    if (this.F.gait2) this.gait_.SetParams(plusGait(this.rt.plan));
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
  // 我的补充：Rest 到位 1 s 后 FULL OFF（LEDn_OFF_H bit4）；任何新动作前把 last_written_ 置成 NaN （1e9）让它重新写出
  Relax(dt) {
    if (!this.F.relax) return;
    if (this.mode_ !== "idle" || this.wantRelax !== true) { this.idleT = 0; if (this.relaxed_ && this.mode_ !== "idle") { this.relaxed_ = false; for (let c = 0; c < 48; c++) this.bank_.last_written_[c] = 1e9; } return; }
    let still = true; for (let i = 0; i < this.channels_; i++) if (Math.abs(this.bank_.present_[i] - this.bank_.target_[i]) > 0.01) still = false;
    this.idleT = still ? (this.idleT || 0) + dt : 0;
    if (this.idleT >= 1 && !this.relaxed_) { this.relaxed_ = true; for (let i = 0; i < this.channels_; i++) this.boards_[Math.floor(i / 16)].SetRaw(i % 16, 0, 0x1000); this.rt.log("Rest：PWM 全部 FULL OFF（舵机放松，我的补充）"); }
  }
  SetVelocity(t, s) { this.gait_.SetThrottle(t); this.gait_.SetSteer(s); this.mode_ = "gait"; this.wantRelax = false; }
  SetGaitParams(p) { this.gait_.SetParams(p); }
  GaitParamsSnapshot() { return { ...this.gait_.Params() }; }
  Rest() { this.mode_ = "idle"; this.crawlCycles = null; this.wantRelax = true; this.ReleaseHard(); }
  WaveOnce(arm) { this.mode_ = "idle"; this.wave_arm_ = arm % kArmCount; this.wave_timer_ = 0; this.mode_ = "wave"; }
  Pulse(times, period = 0.6) { this.mode_ = "pulse"; this.pulse_left_ = times; this.pulse_period_ = period; this.pulse_timer_ = 0; }
  Step(dt) {
    if (this.mode_ === "gait") this.StepGait(dt);
    else if (this.mode_ === "wave") this.StepWave(dt);
    else if (this.mode_ === "pulse") this.StepPulse(dt);
    else this.StepIdle(dt);
    if (this.mode_ !== "idle") this.wantRelax = false;
    this.Relax(dt);
    if (this.relaxed_) return; // 放松状态不再写 PWM
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
    const yaw = Array.from({ length: kArmCount }, (_, a) => this.gait_.Yaw(a));
    if (this.F.antiCollide) AntiCollide(yaw, this.rt.board === "v10" ? MIN_GAP.v10 : MIN_GAP[this.rt.plan] + 3);
    for (let a = 0; a < kArmCount; a++) this.WriteArm(a, yaw[a], this.gait_.Lift(a));
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

// 我的补充：相邻两条触手的夹角 = 45° − yaw[i+1] + yaw[i]（同一个约定见 sim.js），小于 gmin 就两边各退一半；迭代几轮收敛
export function AntiCollide(yaw, gmin) {
  for (let it = 0; it < 40; it++) for (let a = 0; a < kArmCount; a++) {
    const b = (a + 1) % kArmCount, gap = 45 - yaw[b] + yaw[a];
    if (gap < gmin) { const f = (gmin - gap) / 2; yaw[a] += f; yaw[b] -= f; }
  }
  return yaw;
}

// ---------------- 运行时（调度器 + Arduino 外设替身） ----------------
export class Runtime {
  constructor({ F, i2cWrite, log, skipPrescale = false, mode = "ino", plan = "A", adcMv = null, board = "pca", servoPins = null, ledcWrite = null }) {
    this.board = board; this.servoPins = servoPins; this.ledcWriteFn = ledcWrite || (() => 0);
    this.adcMv = adcMv || (() => 0); this.vbat = null; this.lowBatt = false;
    this.F = F; this.i2cWrite = i2cWrite; this.logFn = log || (() => {}); this.skipPrescale = skipPrescale; this.mode = mode; this.plan = plan;
    this.now = 0; this.tasks = []; this.lines = []; this.out = []; this.body = new OctopusBody(this); this.lastCmdMs = 0; this.halted = null; this.boots = 0;
  }
  ledcAttach(pin, freq, bits) { this.ledcFreq = freq; this.ledcBits = bits; this.ledcWriteFn(pin, 0, freq, bits); return true; }
  ledcWrite(pin, duty) { return this.ledcWriteFn(pin, duty, this.ledcFreq, this.ledcBits) !== false; }
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
      this.log(this.board === "v10" ? "LEDC 初始化失败" : "PCA9685 初始化失败！检查 SDA/SCL 接线、供电、I2C 地址");
      this.halted = "PCA9685 初始化失败，程序停在 while(1)";
      while (true) yield 1000;
    }
    yield* this.body.SoftHome();
    this.body.Start();
    if (this.F.batt) this.spawn("batt", this.battTask());
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
    if (this.F.batt) this.spawn("batt", this.battTask());
    this.log("小智固件（模拟）：已注册 self.octopus.action / self.octopus.set_gait");
    this.mcpReady = true;
    while (true) yield 50;
  }
  // 我的补充：GPIO10 电池检测。analogReadMilliVolts（11 dB 衰减，校准后 0–2900 mV）× (100k+22k)/22k，16 次平均，9.6 V 停、10.2 V 恢复（估算）
  // v10：GPIO8（A3），100k/100k → K = 2，3.55 V 停、3.75 V 恢复（估算）
  *battTask() {
    const v10 = this.board === "v10";
    const K = v10 ? 2 : 122 / 22, CUT = v10 ? 3.55 : 9.6, RESUME = v10 ? 3.75 : 10.2, PIN = v10 ? 8 : 10;
    while (true) {
      let mv = 0; for (let i = 0; i < 16; i++) mv += Math.min(2900, Math.max(0, this.adcMv(PIN)));
      const v = (mv / 16 / 1000) * K;
      this.vbat = v;
      if (!this.lowBatt && v < CUT) { this.lowBatt = true; this.body.Rest(); this.log(`电池 ${v.toFixed(2)} V < ${CUT} V：停止运动，请充电（我的补充）`); }
      else if (this.lowBatt && v > RESUME) { this.lowBatt = false; this.log(`电池回到 ${v.toFixed(2)} V，恢复接受指令`); }
      yield 500;
    }
  }
  send(line) { this.lines.push(line); }
  *handleCommand(s0) {
    let s = s0.trim().toUpperCase();
    this.lastCmdMs = this.millis();
    this.log("> " + s);
    const b = this.body;
    if (s === "STOP" || s === "REST") { b.Rest(); return; }
    if (this.lowBatt && !s.startsWith("GAIT")) { this.log("电池电压低，忽略动作指令（我的补充）"); return; }
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
    if (this.F.gait2) keys.push("PRESS="); // 完善版固件才有（v9）
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
      else if (keys[5] && tok.startsWith(keys[5])) { p.press_deg = num(6); hit++; }
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
    if (this.lowBatt && action !== "rest") return "电池电压低，请先充电";
    const hz = 1000 / (this.F.speed ? Math.max(834, speed) : speed > 0 ? speed : 1000);
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
