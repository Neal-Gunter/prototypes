import{n as e,r as t}from"./parts-BRocpuEe.js";import{a as n,i as r,o as i,r as a,t as o}from"./firmware-DZRiR8L_.js";import{c as s,l as c,t as l}from"./v10-DhkWcI5n.js";import{c as u,f as d,i as f,n as p,t as m,u as h}from"./octopus_batt-CSONAX-b.js";var g=class{constructor(){this.reset()}reset(){this.duty=new Map,this.freqHz=50,this.bits=14,this.writes=0}write(e,t,n,r){return this.duty.set(e,t),n&&(this.freqHz=n),r&&(this.bits=r),this.writes++,0}get freq(){return this.freqHz}gpio(e){return{us:(this.duty.get(e)||0)/((1<<this.bits)-1)*(1e6/this.freqHz)}}},_={pulse:`舵机脉宽 0.5–2.5 ms ↔ 0–180°（MG90S 常见标定，估算）`,speed:`空载 0.1 s/60°@4.8 V、0.08 s/60°@6 V（MG90S 常见标称），按电压线性插值`,current:`电流：保持 0.01 A，运动 0.12 + 0.45·(速度/最高速) A，堵转 0.7 A（估算）`,frame:`只有 10–30 ms 周期（33–100 Hz）的 PWM 舵机才认（模拟舵机估算）`,friction:`v9 走路是物理仿真（Rapier）：机身是有重力的刚体，触手是舵机关节连着的刚体，只靠触手和桌面的接触摩擦推着走；摩擦系数、PLA 质量等是估算（见下面“走路物理”）`,plusA:`完善版 A（我的补充）：底板下 3 个万向珠（滚动阻力系数约 0.02）、调高度让触手尖分担约 30% 重量 + 触手尖单向鳞片脚垫（向后滑 0.45、向前滑 0.15）——全部估算`,gap:`相邻触手最小夹角：方案 A 12°（按触手根部宽度）；方案 B 13°（v8 在 3D 碰撞体上实测，见 e2e/gapB.mjs）——A 为估算`},v=12;function y(e){let t=e>>>0||1;return()=>(t=t*1664525+1013904223>>>0)/4294967296}var b=class{constructor(e={}){this.o={plan:`A`,phase:3,fault:`none`,mode:`ino`,variant:`md`,seed:7,tipShare:.15,...e},this.o.F||(this.o.F=this.o.variant===`plus`||this.o.variant===`v10`?i():n(!1)),this.rebuild()}set(e){Object.assign(this.o,e),this.rebuild()}rebuild(){let e=this.o;this.bench=d(e),this.r=y(e.seed),this.v10=this.bench.board===`v10`,this.dev=this.v10?new g:new a(64),this.t=0,this.servoI=0,this.peakI=0,this.events=[],this.phys=null,this.pose={x:0,z:0,h:0},this.trace=[{x:0,z:0,h:0,t:0}],this.servos=this.bench.servos.map(e=>({...e,chN:+e.ch.slice(2),ang:72+this.r()*36,w:0,cmd:null,us:0,I:0,stall:!1,buzz:!1,collide:!1})),this.res=f(this.bench,{servoI:0,micSpkCm:e.micSpkCm}),this.espOn=!1,this.offFor=1e9,this.boots=0,this.scenarioDone=!1,this.rt=this.bench.phase===0?null:new r({F:e.F,mode:e.mode,plan:e.plan,skipPrescale:e.fault===`pwm200`,i2cWrite:(e,t,n)=>this.i2c(e,t,n),adcMv:e=>this.adcMv(e),...this.v10?{board:`v10`,servoPins:s.map(e=>e.gpio),ledcWrite:(e,t,n,r)=>this.espOn?this.dev.write(e,t,n,r):!1}:{}}),this.step(.001)}i2c(e,t,n){if(e!==64)return 2;let r=this.res.rails;return!r.pcaLogic||!r.i2cWired?2:(this.dev.write(t,n,this.rt.now),0)}adcMv(e){let t=this.res.rails;return this.v10?e===l.gpio&&t.battSense&&t.espOn?Math.min(2900,t.vbatSw/l.ratio*1e3+(this.r()-.5)*10):0:e!==10||!t.battSense||!t.espOn?0:Math.min(2900,t.vbat*22/122*1e3+(this.r()-.5)*20)}ev(e){this.events.push({t:+this.t.toFixed(2),zh:e}),this.events.length>60&&this.events.shift()}send(e){this.rt&&this.espOn?this.rt.send(e):this.ev(`ESP32 没在运行，指令没发出去`)}mcp(e,t){if(this.o.mode!==`mcp`)return`当前是蓝牙串口 .ino 模式`;if(!this.rt||!this.espOn)return`ESP32 没在运行`;let n=this.rt.mcp(e,t);return this.ev(`MCP ${e} ${JSON.stringify(t)} → ${n}`),n}step(e){let t=.005,n=Math.max(1,Math.round(e/t));for(;n--;)this.sub(t)}sub(e){this.t+=e;let t=this.o,n=this.bench;this.res=f(n,{servoI:this.servoI,micSpkCm:t.micSpkCm,railI:this.v10?Object.fromEntries(this.servos.map(e=>[e.role,e.I])):null});let r=this.res.rails;if(this.rt){if(r.espOn&&!this.espOn&&this.offFor>.3?(this.espOn=!0,this.boots++,this.dev.reset(),this.rt.now=this.t*1e3,this.rt.boot(),this.boots>1&&this.ev(`ESP32 重新启动（第 ${this.boots} 次）`),this.scenarioDone=!1):!r.espOn&&this.espOn&&(this.espOn=!1,this.offFor=0,this.ev(this.v10?`QT Py 电源掉到 ${r.espIn.toFixed(2)} V → 欠压复位`:`ESP32 5V 掉到 ${r.espIn.toFixed(2)} V → 欠压复位`),r.vpFromU1||this.dev.reset()),this.espOn||(this.offFor+=e),this.espOn&&(this.rt.step(e*1e3),!this.scenarioDone&&this.rt.body.running_)){if(this.scenarioDone=!0,t.fault===`mech`){let e=this.rt.body.GaitParamsSnapshot();e.yaw_amp_deg=60,this.rt.body.SetGaitParams(e),this.rt.body.SetVelocity(1,1),this.ev(`场景：步态 yaw 被改成 60°，并且右转`)}if(t.fault===`phase0`){let e=this.rt.body.GaitParamsSnapshot();e.phase_deg=0,this.rt.body.SetGaitParams(e),this.rt.body.SetVelocity(1,0),this.ev(`场景：phase = 0，八条触手同相`)}}}else this.espOn=r.espOn;let i=1e6/this.dev.freq,a=r.vservo,o=i>=1e4&&i<=3e4,s=e=>this.v10?e<3.5?0:c.speed48*Math.min(1,e/4.8):e<3.5?0:600+(Math.min(e,6.5)-4.8)*125,l=s(a),u=0;for(let t of this.servos){let n=this.v10?r.pwmGpio?.[t.role]:null,i=this.v10?n!=null&&r.espOn?this.dev.gpio(n):{us:0}:r.pcaLogic||r.vpFromU1?this.dev.channel(t.chN):{us:0},u=this.v10?s(r.vservoOf?.[t.role]??a):l;t.wmax=u,t.us=i.us,t.stall=!1,t.buzz=!1;let d=o&&i.us>=400&&i.us<=2700&&u>0;t.cmd=d?this.v10?(i.us-c.us0)/(c.us1-c.us0)*180:(i.us-500)/2e3*180:null;let f=0;if(t.type===`360`)d&&Math.abs(i.us-1500)>20&&(f=Math.max(-1,Math.min(1,(i.us-1500)/500))*780*(l/750)),t.ang+=f*e;else if(t.cmd!=null){let n=Math.max(-3,Math.min(183,t.cmd))-t.ang,r=u*e,i=Math.abs(n)<=r?n:Math.sign(n)*r;t.ang+=i,f=i/e,(t.cmd>183.5||t.cmd<-3.5)&&Math.abs(n)<.5&&(t.stall=!0,t.buzz=!0)}t.w=f}let d=this.yawServos();for(let e of d)e.collide=!1;if(d.length===8)for(let e=0;e<8;e++){let t=d[e],n=d[(e+1)%8],r=45-(n.ang-90)+(t.ang-90),i=this.v10?-35:this.bench.plan===`B`&&this.bench.robot?13:v;if(r<i){let e=(i-r)/2;t.ang+=e,n.ang-=e,t.stall=n.stall=!0,t.collide=n.collide=!0,t.buzz=n.buzz=!0}}for(let e of this.servos){if(this.v10){let t=e.wmax||0,n=r.vservoOf?.[e.role]??a;e.I=e.stall?.233*Math.min(1,n/4.8):t>0?.0033+(Math.abs(e.w)>1?.04+.15*Math.min(1,Math.abs(e.w)/t):0):0}else e.I=e.stall?.7*Math.min(1,a/6):l>0?.01+(Math.abs(e.w)>1?.12+.45*Math.min(1,Math.abs(e.w)/l):0):0;t.plan===`B`&&e.slot===1&&this.stanceArm(e.arm)&&(e.I+=.15),u+=e.I}if(this.servoI=u,this.avgI=(this.avgI||0)+(u-(this.avgI||0))*Math.min(1,e/.2),this.peakI=Math.max(this.peakI,this.avgI),this.peakInst=Math.max(this.peakInst||0,u),this.v10&&(this.eJ=(this.eJ||0)+(r.pBat||0)*e,this.eT=(this.eT||0)+e),n.robot&&this.phys){this.phys.step(e),this.benchWrap&&this.phys.keepOnBench(...this.benchWrap)&&this.ev(`走到台边 → 整机搬回起点（第 ${this.phys.wraps} 次；测速和前进距离照常累计，我的补充）`),this.imu&&this.imu.feed(this.t,this.phys.imuTruth()),this.pose=this.phys.pose2d();let t=this.phys.meas;this.vel={v:t.v,slip:t.slip}}this.t-(this.trace.at(-1)?.t||0)>.05&&(this.trace.push({...this.pose,t:this.t}),this.trace.length>3e3&&this.trace.shift())}yawServos(){return this.servos.filter(e=>e.slot===0&&e.arm!=null).sort((e,t)=>e.arm-t.arm)}liftOf(e){let t=this.servos.find(t=>t.arm===e&&t.slot===1);return t?t.ang-90:0}stanceArm(e){return this.liftOf(e)<=5}armPose(e){let t=this.servos.find(t=>t.arm===e&&t.slot===0);return{yaw:t?t.ang-90:0,lift:this.liftOf(e)}}attachImu(e){this.imu=e,this.rt&&(this.rt.imuRead=e?()=>this.imu?.read(this.t):null)}attachPhys(e){this.phys=e,this.pose=e?e.pose2d():{x:0,z:0,h:0},this.trace=[{...this.pose,t:this.t}]}snapshot(){let e=this.res.rails;return{t:this.t,espOn:this.espOn,boots:this.boots,halted:this.rt?.halted||null,rails:e,checks:this.res.checks,warn:this.res.warn,servos:this.servos.map(e=>({role:e.role,ch:e.ch,arm:e.arm,slot:e.slot,us:e.us,ang:e.ang,cmd:e.cmd,I:e.I,stall:e.stall,buzz:e.buzz,collide:e.collide,type:e.type})),pBatAvg:this.v10&&this.eT?this.eJ/this.eT:null,servoI:this.servoI,avgI:this.avgI||0,peakI:this.peakI,peakInst:this.peakInst||0,vel:this.vel,freq:this.dev.freq,pose:{...this.pose},loco:this.phys?this.phys.snapshot():null,log:this.rt?this.rt.out.slice(-40):[],events:this.events.slice(-20),mode:this.rt?.body.mode_,gait:this.rt?.body.GaitParamsSnapshot?.()}}},x=`/*
 * 八爪鱼身体固件 · 方案 A（手机手动蓝牙控制，零代码）
 * ============================================================
 * 手机装一个蓝牙串口 App，手动发送指令（WALK / LEFT / STOP ...）
 * 就能控制八爪鱼。步态引擎跑在本机 ESP32-S3 上，手机只发"动词"，
 * 不碰任何一个舵机角度。
 *
 * 依赖：把 octopus_gait.h / octopus_bus.h / octopus_body.h 三个头文件
 *       和本 .ino 放在【同一个 Arduino 工程文件夹】里。
 *
 * 板型：ESP32-S3 Dev Module（最小系统板，¥25~35）
 * 库：   BluetoothSerial（ESP32 核心自带，不用额外安装）
 * 烧录： Arduino IDE → 开发板选 "ESP32S3 Dev Module"
 */

#define OCTO_USE_ARDUINO          // 让 octopus_bus.h 编译 Arduino 版 I2C 驱动
#include <Wire.h>
#include <BluetoothSerial.h>

#include "octopus_gait.h"
#include "octopus_bus.h"
#include "octopus_body.h"

// ---- 引脚（按你手上的板子改，下面是最通用的 ESP32-S3 选择）----
#define I2C_SDA  8
#define I2C_SCL  9
//#define BATTERY_PIN 4          // 接电池分压，想启用低压保护就取消注释

BluetoothSerial SerialBT;
octo::OctopusBody body;

String line;
uint32_t lastCmdMs = 0;
const uint32_t AUTO_REST_MS = 15000;   // 15 秒没指令就自动回到待机，防失控

// 若启用电池检测，按你的分压电阻比改这个（示例：100k+100k 分压 → 2.0）
// vbat = adc * (3.1/4095) * VBAT_DIVISOR
#define VBAT_DIVISOR 2.0f

void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);               // PCA9685 支持 400kHz

#ifdef BATTERY_PIN
  pinMode(BATTERY_PIN, INPUT);
  analogSetAttenuation(ADC_11db);      // 量程拉到 ~3.1V，适配分压后电压
#endif

  // 初始化运动控制器（16 路 / 双自由度 / 8 条触手）
  if (!body.Init(octo::RigType::kDual16, &Wire, octo::I2cWriteArduino)) {
    Serial.println("PCA9685 初始化失败！检查 SDA/SCL 接线、供电、I2C 地址");
    while (1) delay(1000);
  }
  body.SoftHome();   // 分时把 16 路拉到中位，避免上电瞬间拉塌电源
  body.Start();      // 启动 50Hz 运动任务（FreeRTOS，固定跑在核心 0）

  SerialBT.begin("OctoBrain");  // 手机蓝牙里搜这个名字
  Serial.println("Octopus body ready. BT name = OctoBrain");
  SerialBT.println("Octopus ready");
  lastCmdMs = millis();
}

void loop() {
  // —— 读蓝牙指令（手机蓝牙串口 App 发的）——
  while (SerialBT.available()) {
    char c = SerialBT.read();
    if (c == '\\n' || c == '\\r') {
      if (line.length()) { handleCommand(line); line = ""; }
    } else {
      line += c;
    }
  }
  // —— 同时支持 USB 串口调试（没蓝牙时也能用电脑测）——
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || c == '\\r') {
      if (line.length()) { handleCommand(line); line = ""; }
    } else {
      line += c;
    }
  }

  // —— 安全：超时自动待机，避免断开后一直动 ——
  if (millis() - lastCmdMs > AUTO_REST_MS) {
    body.Rest();
    lastCmdMs = millis();   // 避免反复触发
  }

  // —— 低压保护：电池快没电时停运动，防止舵机抖 / 板子重启 ——
#ifdef BATTERY_PIN
  float vbat = analogRead(BATTERY_PIN) * (3.1f / 4095.0f) * VBAT_DIVISOR;
  if (vbat < 6.4f) {
    body.Rest();
    SerialBT.println("LOW BATTERY - stopped");
    delay(5000);
  }
#endif

  delay(10);
}

// ---------------------------------------------------------------------------
// 指令解析：手机只发"动词"，角度计算全在身体 ESP32 上
// ---------------------------------------------------------------------------
void handleCommand(String s) {
  s.trim();
  s.toUpperCase();
  lastCmdMs = millis();
  SerialBT.println("> " + s);

  if (s == "STOP" || s == "REST") {
    body.Rest();
    return;
  }
  if (s == "GO" || s == "WALK" || s == "FWD") {
    body.SetVelocity(1.0f, 0.0f);     // 爬行（相对自身向前）
    return;
  }
  if (s == "LEFT" || s == "TURNL") {
    body.SetVelocity(1.0f, -1.0f);    // 左转（差速）
    return;
  }
  if (s == "RIGHT" || s == "TURNR") {
    body.SetVelocity(1.0f, 1.0f);     // 右转
    return;
  }
  if (s.startsWith("WAVE")) {          // WAVE 3 → 第 3 号触手挥一下（0~7）
    int a = s.substring(4).toInt();
    if (a < 0 || a > 7) a = 0;
    body.WaveOnce(a);
    return;
  }
  if (s.startsWith("PULSE")) {        // PULSE 3 → 缩成一团 3 次
    int n = s.substring(5).toInt();
    if (n < 1) n = 1;
    body.Pulse(n);
    return;
  }
  if (s.startsWith("HOME")) {          // 回中位
    body.SoftHome();
    return;
  }
  if (s.startsWith("GAIT")) {          // GAIT f=0.6 yaw=38 lift=20 phase=45 duty=0.65
    setGait(s);
    return;
  }
  SerialBT.println("? unknown: " + s);
}

// 现场调 CPG 参数，不用重新烧录
void setGait(String s) {
  octo::GaitParams p = body.GaitParamsSnapshot();
  int i = 0;
  while (i < s.length()) {
    int sp = s.indexOf(' ', i);
    String tok = (sp == -1) ? s.substring(i) : s.substring(i, sp);
    if      (tok.startsWith("f="))    p.freq_hz     = tok.substring(2).toFloat();
    else if (tok.startsWith("yaw="))  p.yaw_amp_deg = tok.substring(4).toFloat();
    else if (tok.startsWith("lift=")) p.lift_amp_deg = tok.substring(5).toFloat();
    else if (tok.startsWith("phase=")) p.phase_deg  = tok.substring(6).toFloat();
    else if (tok.startsWith("duty=")) p.duty        = tok.substring(5).toFloat();
    i = (sp == -1) ? s.length() : sp + 1;
  }
  body.SetGaitParams(p);
  SerialBT.println("gait updated");
}
`,S=`#pragma once
// PCA9685 多舵机总线 + 软启动/限速保护
//
// 为什么必须用 PCA9685，而不是像很多 4 舵机例程那样拿 ESP32 的 LEDC 直驱：
//   1) ESP32-S3 的 LEDC 通道数名义上够，但和音频任务的 I2S DMA、Wi-Fi 抢定时器，
//      实际波形会抖，8 路以上尤其明显。
//   2) 音频播放（Opus 解码 + I2S 推送）会长时间占住一个核，软件 PWM 必抖。
//   3) PCA9685 自带 25MHz 振荡器，一旦写入就自己维持波形，主控可以长时间不理它。
//   4) 舵机电源从 PCA9685 的 V+ 螺丝端子独立引入，浪涌电流不经过 ESP32。

#include <cmath>
#include <cstdint>
#include <cstddef>

#include "octopus_gait.h"

#if defined(OCTO_USE_ESP_IDF)
#include "esp_err.h"
#include "esp_log.h"
#include "driver/i2c_master.h"
#elif defined(OCTO_USE_ARDUINO)
#include <Wire.h>
#endif

namespace octo {

class Pca9685 {
public:
    // —— 寄存器 ——
    static constexpr uint8_t kRegMode1     = 0x00;
    static constexpr uint8_t kRegMode2     = 0x01;
    static constexpr uint8_t kRegPrescale  = 0xFE;
    static constexpr uint8_t kRegLed0OnL   = 0x06;

    static constexpr uint8_t kBaseAddr     = 0x40;  // A5..A0 全接地时的地址
    static constexpr uint32_t kOscHz       = 25000000UL;
    static constexpr uint16_t kResolution  = 4096;

    Pca9685(uint8_t addr, uint16_t pulse_min = 150, uint16_t pulse_max = 600)
        : addr_(addr), pulse_min_(pulse_min), pulse_max_(pulse_max) {}

    uint8_t Addr() const { return addr_; }

    void SetPulseRange(uint16_t lo, uint16_t hi) { pulse_min_ = lo; pulse_max_ = hi; }

    uint16_t AngleToPulse(float deg) const {
        float d = deg < 0.0f ? 0.0f : (deg > 180.0f ? 180.0f : deg);
        return static_cast<uint16_t>(pulse_min_ + (pulse_max_ - pulse_min_) * (d / 180.0f));
    }

    // ---- 需要外部提供 I2C 写字节序列的实现 ----
    // WriteBytes(dev_addr, reg, data, len) -> 0 成功，其它为负 errno/esp_err_t
    //ReadBytes 仅在启动时可选用于校验
    using WriteFn = int (*)(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len);

    bool Init(void* ctx, WriteFn write_fn, float freq_hz = 50.0f) {
        ctx_ = ctx;
        write_ = write_fn;
        if (!write_) return false;

        uint8_t reset = 0x80;                        // MODE1 RESTART
        if (Write(kRegMode1, &reset, 1) != 0) return false;

        uint8_t sleep_ai = 0x10 | 0x20;              // SLEEP + AI(自动地址递增)
        if (Write(kRegMode1, &sleep_ai, 1) != 0) return false;

        // 预分频必须在 SLEEP 状态下写入
        uint32_t prescale = static_cast<uint32_t>(kOscHz / (kResolution * freq_hz) + 0.5f);
        if (prescale < 3) prescale = 3;
        if (prescale > 255) prescale = 255;
        uint8_t ps = static_cast<uint8_t>(prescale - 1);
        if (Write(kRegPrescale, &ps, 1) != 0) return false;

        uint8_t normal_ai = 0x20;                    // 退出 SLEEP，保留 AI
        if (Write(kRegMode1, &normal_ai, 1) != 0) return false;

        uint8_t mode2 = 0x04;                        // OUTDRV = 推挽输出
        if (Write(kRegMode2, &mode2, 1) != 0) return false;

        return true;
    }

    bool SetRaw(int ch, uint16_t on, uint16_t off) const {
        uint8_t buf[4] = {
            static_cast<uint8_t>(on & 0xFF),
            static_cast<uint8_t>(on >> 8),
            static_cast<uint8_t>(off & 0xFF),
            static_cast<uint8_t>(off >> 8),
        };
        return Write(static_cast<uint8_t>(kRegLed0OnL + 4 * ch), buf, 4) == 0;
    }

    bool SetAngle(int ch, float deg) const { return SetRaw(ch, 0, AngleToPulse(deg)); }

    void SetChannelInvert(bool inv) { invert_ = inv; }

private:
    bool Write(uint8_t reg, const uint8_t* data, size_t len) const {
        return write_(ctx_, addr_, reg, data, len) == 0;
    }

    uint8_t addr_;
    uint16_t pulse_min_, pulse_max_;
    bool invert_ = false;
    void* ctx_ = nullptr;
    WriteFn write_ = nullptr;
};

// ---------------------------------------------------------------------------
// ServoBank: 在 Pca9685 之上加一层"限速 + 软启动"，这是能不能跑稳的关键
// ---------------------------------------------------------------------------
class ServoBank {
public:
    void Bind(const Pca9685* boards, int board_count) {
        boards_ = boards;
        board_count_ = board_count;
    }

    // channels <= board_count * 16
    bool Begin(int channels, float home_angle = 90.0f) {
        channels_ = channels;
        for (int i = 0; i < kMaxChannels; i++) {
            target_[i] = home_angle;
            present_[i] = home_angle;
            trim_[i] = 0.0f;
            limit_lo_[i] = 0.0f;
            limit_hi_[i] = 180.0f;
        }
        return true;
    }

    // 单点标定：装歪了不用拆下来重装，写个偏移量就行（建议存 NVS）
    void SetTrim(int ch, float deg) { if (Valid(ch)) trim_[ch] = deg; }
    void SetLimit(int ch, float lo, float hi) {
        if (!Valid(ch)) return;
        limit_lo_[ch] = lo;
        limit_hi_[ch] = hi;
    }

    void SetTarget(int ch, float deg) {
        if (!Valid(ch)) return;
        float v = deg + trim_[ch];
        if (v < limit_lo_[ch]) v = limit_lo_[ch];
        if (v > limit_hi_[ch]) v = limit_hi_[ch];
        target_[ch] = v;
    }

    // 最大角速度限制。多个舵机同时大角度跳跃是掉电重启的头号原因。
    void SetMaxRate(float deg_per_s) { max_rate_ = deg_per_s; }

    // 每帧调用。会按 max_rate_ 把 present_ 推向 target_，并只在变化超阈值时写 I2C
    void Tick(float dt) {
        if (!boards_) return;
        const float step = max_rate_ * dt;
        for (int i = 0; i < channels_; i++) {
            float d = target_[i] - present_[i];
            if (std::fabs(d) <= step) {
                present_[i] = target_[i];
            } else {
                present_[i] += (d > 0) ? step : -step;
            }
            if (std::fabs(present_[i] - last_written_[i]) >= 0.35f) {
                WriteChannel(i, present_[i]);
                last_written_[i] = present_[i];
            }
        }
    }

    void ReleaseAll() {
        for (int i = 0; i < channels_; i++) {
            target_[i] = 90.0f + trim_[i];
        }
    }

    float Present(int ch) const { return Valid(ch) ? present_[ch] : 0.0f; }
    int Channels() const { return channels_; }

private:
    static constexpr int kMaxChannels = 48;  // 支持到方案 C 的 24 路还有余量

    bool Valid(int ch) const { return ch >= 0 && ch < channels_; }

    void WriteChannel(int ch, float deg) const {
        int b = ch / 16, c = ch % 16;
        if (b >= board_count_) return;
        boards_[b].SetAngle(c, deg);
    }

    const Pca9685* boards_ = nullptr;
    int board_count_ = 0;
    int channels_ = 0;
    float max_rate_ = 360.0f;  // 默认 360°/s，肉眼看着还算利落
    float trim_[kMaxChannels];
    float limit_lo_[kMaxChannels];
    float limit_hi_[kMaxChannels];
    float target_[kMaxChannels];
    float present_[kMaxChannels];
    float last_written_[kMaxChannels];
};

// ---------------------------------------------------------------------------
// I2C 传输实现（二选一）
// ---------------------------------------------------------------------------
#if defined(OCTO_USE_ESP_IDF)

// ESP-IDF v5.2+ / v6 的 i2c_master 新驱动
inline int I2cWriteIdf(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    i2c_master_dev_handle_t dev = *static_cast<i2c_master_dev_handle_t*>(ctx);
    uint8_t buf[8];
    if (len + 1 > sizeof(buf)) return -1;
    buf[0] = reg;
    for (size_t i = 0; i < len; i++) buf[i + 1] = data[i];
    return i2c_master_transmit(dev, buf, len + 1, 100);  // xTicksToWait
}

// 用法示例：
//   i2c_master_bus_config_t bus_cfg = {
//       .i2c_port = I2C_NUM_0,
//       .sda_io_num = GPIO_NUM_8,
//       .scl_io_num = GPIO_NUM_9,
//       .clk_source = I2C_CLK_SRC_DEFAULT,
//       .glitch_ignore_cnt = 7,
//       .flags = {.enable_internal_pullup = true},
//   };
//   i2c_master_bus_handle_t bus;
//   i2c_new_master_bus(&bus_cfg, &bus);
//   i2c_device_config_t dev_cfg = {
//       .dev_addr_length = I2C_ADDR_BIT_LEN_7,
//       .device_address = 0x40,
//       .scl_speed_hz = 400000,
//   };
//   i2c_master_dev_handle_t dev;
//   i2c_master_bus_add_device(bus, &dev_cfg, &dev);
//   board.Init(&dev, octo::I2cWriteIdf, 50.0f);

#elif defined(OCTO_USE_ARDUINO)

inline int I2cWriteArduino(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    TwoWire* wire = static_cast<TwoWire*>(ctx);
    wire->beginTransmission(addr);
    wire->write(reg);
    for (size_t i = 0; i < len; i++) wire->write(data[i]);
    return wire->endTransmission() == 0 ? 0 : -1;
}

#endif

}  // namespace octo
`,C=`#pragma once
// 八触手 CPG 步态发生器 —— 纯数学层，不依赖任何硬件。
// 可以直接在 PC 上单元测试，也可以塞进 ESP-IDF / Arduino 工程。
//
// 核心思想：不做逆运动学求解，只用一个带相位偏移的振荡器阵列。
// 每条触手 = 一个振荡器，相邻触手固定相差 params.phase_deg，
// 八个振荡器绕一圈自然形成"逆行波"(metachronal wave)，这就是章鱼爬行的样子。

#include <cmath>
#include <cstdint>

namespace octo {

static constexpr int kArmCount = 8;

// 每条触手最多 2 个自由度时的通道序号编排
// yaw = 偏航(前后扫动), lift = 俯仰(抬起放下)
struct ArmChannels {
    int yaw;
    int lift;
};

struct GaitParams {
    float freq_hz       = 0.6f;   // 步频，0.3 稳一点，超过 1.2 舵机会跟不上
    float yaw_amp_deg   = 38.0f;  // 偏航摆幅
    float lift_amp_deg  = 20.0f;  // 抬起幅度
    float phase_deg     = 45.0f;  // 相邻触手相位差：0=同步脉冲 45=环形波 180=交替
    float duty          = 0.65f;  // 推进相占比。>0.5 才像"慢慢推、快速收"
};

class Gait {
public:
    void SetParams(const GaitParams& p) { params_ = p; }
    const GaitParams& Params() const { return params_; }

    // 每帧调用一次，dt 单位秒
    void Tick(float dt) {
        phase_ += dt * params_.freq_hz * 360.0f;
        while (phase_ >= 360.0f) phase_ -= 360.0f;
        while (phase_ < 0.0f) phase_ += 360.0f;
    }

    void Reset() { phase_ = 0.0f; }

    // steer: -1 全力左转, 0 直行, +1 全力右转
    void SetSteer(float s) { steer_ = Clamp(s, -1.0f, 1.0f); }
    void SetThrottle(float t) { throttle_ = Clamp(t, 0.0f, 1.0f); }

    // 该触手在一个周期内的归一化相位 0..1
    float Phase01(int arm) const {
        float p = std::fmod(phase_ + params_.phase_deg * arm, 360.0f) / 360.0f;
        return (p < 0.0f) ? p + 1.0f : p;
    }

    // 偏航角：推进相缓慢线性扫过，回复相快速弹回（三角波 + 可调占空比）
    float Yaw(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float tri;
        if (p < d) {
            tri = 1.0f - 2.0f * (p / d);          // +amp -> -amp，撑地推进
        } else {
            tri = -1.0f + 2.0f * ((p - d) / (1.0f - d));  // -amp -> +amp，空中回复
        }
        return tri * params_.yaw_amp_deg * Gain(arm) * throttle_;
    }

    // 抬起角：只在回复相抬起，推进相贴地
    float Lift(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        if (p < d) return 0.0f;
        float k = (p - d) / (1.0f - d);
        return std::sin(k * static_cast<float>(M_PI)) * params_.lift_amp_deg;
    }

    bool IsPowerStroke(int arm) const { return Phase01(arm) < params_.duty; }

    // 第 arm 条触手的安装方位角(度)：0 号在正前方，顺时针排布
    static float MountAngle(int arm) { return -90.0f + arm * 45.0f; }

    // 把 [-180,180] 的方位角压到 [-90,90]，用于判断左右舷
    static float Lateriality(int arm) {
        return std::sin(MountAngle(arm) * static_cast<float>(M_PI) / 180.0f);
    }

private:
    // 转向增益：左右舷摆幅不对称，差速转弯
    float Gain(int arm) const {
        return 1.0f + steer_ * Lateriality(arm) * 0.85f;
    }

    static float Clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    GaitParams params_;
    float phase_ = 0.0f;
    float steer_ = 0.0f;
    float throttle_ = 1.0f;
};

// ---------------------------------------------------------------------------
// 固定 pose 插值器：用于 MCP 调用的"跳舞/挥手/缩成一团"这类定式动作
// ---------------------------------------------------------------------------
template <int N>
struct Pose {
    float ch[N];  // N 路舵机的目标角度（度）
};

template <int N>
class PoseBlender {
public:
    void Play(const Pose<N>& target, float duration_s) {
        for (int i = 0; i < N; i++) from_.ch[i] = current_.ch[i];
        target_ = target;
        duration_ = duration_s;
        elapsed_ = 0.0f;
        playing_ = duration_ > 0.0f;
    }

    void Tick(float dt) {
        if (!playing_) return;
        elapsed_ += dt;
        float k = elapsed_ / duration_;
        if (k >= 1.0f) { k = 1.0f; playing_ = false; }
        // smootherstep：起停都没有速度突变，舵机不会抖
        float e = k * k * k * (k * (k * 6.0f - 15.0f) + 10.0f);
        for (int i = 0; i < N; i++) {
            current_.ch[i] = from_.ch[i] + (target_.ch[i] - from_.ch[i]) * e;
        }
    }

    bool IsPlaying() const { return playing_; }
    const Pose<N>& Current() const { return current_; }
    void Snapshot(const Pose<N>& p) { current_ = p; }

private:
    Pose<N> current_{};
    Pose<N> from_{};
    Pose<N> target_{};
    float duration_ = 0.0f;
    float elapsed_ = 0.0f;
    bool playing_ = false;
};

}  // namespace octo
`,w=`#pragma once
// OctopusBody：把「步态发生器」和「舵机总线」粘起来的运动控制器。
// 自己开一个 FreeRTOS 任务跑 50Hz 控制环，不占用音频任务的 CPU 时间。

#include <cmath>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

#include "octopus_gait.h"
#include "octopus_bus.h"

namespace octo {

// 三种机械形态，对应 README 里的方案 A / B / C
enum class RigType {
    kSingle8,   // 8 路：每条触手 1 个偏航舵机
    kDual16,    // 16 路：每条触手 偏航 + 俯仰
    kTendon24,  // 24 路：每条触手 3 根腱绳，真软体
};

inline int ChannelsFor(RigType rig) {
    switch (rig) {
        case RigType::kSingle8:  return 8;
        case RigType::kDual16:   return 16;
        case RigType::kTendon24: return 24;
    }
    return 8;
}

// 第 arm 条触手的第 slot 个舵机对应全局通道号
inline int ChannelOf(RigType rig, int arm, int slot) {
    switch (rig) {
        case RigType::kSingle8:  return arm;
        case RigType::kDual16:   return arm * 2 + slot;
        case RigType::kTendon24: return arm * 3 + slot;
    }
    return arm;
}

class OctopusBody {
public:
    static constexpr const char* kTag = "OctopusBody";

    ~OctopusBody() { Stop(); }

    bool Init(RigType rig,
              void* i2c_ctx,
              Pca9685::WriteFn write_fn,
              int sda_gpio_unused = -1) {
        rig_ = rig;
        channels_ = ChannelsFor(rig);
        board_count_ = (channels_ + 15) / 16;

        for (int i = 0; i < board_count_; i++) {
            boards_[i] = Pca9685(static_cast<uint8_t>(Pca9685::kBaseAddr + i));
            if (!boards_[i].Init(i2c_ctx, write_fn, 50.0f)) {
                ESP_LOGE(kTag, "PCA9685 #%d (0x%02X) 初始化失败", i, Pca9685::kBaseAddr + i);
                return false;
            }
            ESP_LOGI(kTag, "PCA9685 #%d (0x%02X) 就绪", i, Pca9685::kBaseAddr + i);
        }

        bank_.Bind(boards_, board_count_);
        bank_.Begin(channels_, HomeAngle());
        bank_.SetMaxRate(300.0f);  // 300°/s，粗糙吃不消就往 200 调

        return true;
    }

    // 软启动：一个一个把舵机拉到中位，避免上电瞬间 16 路同时堵转把电源拉塌。
    // 这是从 xiaozhi-esp32-pet 项目踩过的坑里学来的：峰值电流能从 2.3A 降到 1.3A。
    void SoftHome() {
        for (int i = 0; i < channels_; i++) {
            bank_.SetTarget(i, HomeAngle());
            for (int k = 0; k < 3; k++) {
                bank_.Tick(0.02f);
                vTaskDelay(pdMS_TO_TICKS(16));
            }
        }
    }

    void Start() {
        if (task_) return;
        running_ = true;
        xTaskCreatePinnedToCore(&OctopusBody::TaskEntry, "octo_motion", 4096, this, 6, &task_, 0);
    }

    void Stop() {
        running_ = false;
        if (task_) {
            vTaskDelay(pdMS_TO_TICKS(100));
            vTaskDelete(task_);
            task_ = nullptr;
        }
    }

    // ---------- 运动指令（由 MCP 工具调用） ----------

    void SetVelocity(float throttle, float steer) {
        gait_.SetThrottle(throttle);
        gait_.SetSteer(steer);
        mode_ = Mode::kGait;
    }

    void SetGaitParams(const GaitParams& p) { gait_.SetParams(p); }
    GaitParams GaitParamsSnapshot() const { return gait_.Params(); }

    void Rest() { mode_ = Mode::kIdle; ReleaseHard(); }

    // 第 arm 条触手挥一下，可以连续多次调用做出"波浪"手势
    void WaveOnce(int arm) {
        mode_ = Mode::kIdle;
        wave_arm_ = arm % kArmCount;
        wave_timer_ = 0.0f;
        mode_ = Mode::kWave;
    }

    // 像水母一样八条同步收缩 —— 用于"害怕/缩成一团"这类情绪表达
    void Pulse(int times, float period_s = 0.6f) {
        mode_ = Mode::kPulse;
        pulse_left_ = times;
        pulse_period_ = period_s;
        pulse_timer_ = 0.0f;
    }

    RigType Rig() const { return rig_; }
    int Channels() const { return channels_; }

private:
    enum class Mode { kIdle, kGait, kWave, kPulse };

    static float HomeAngle() { return 90.0f; }

    static void TaskEntry(void* arg) { static_cast<OctopusBody*>(arg)->TaskLoop(); }

    void TaskLoop() {
        const TickType_t period = pdMS_TO_TICKS(20);  // 50Hz
        while (running_) {
            Step(0.02f);
            vTaskDelay(period);
        }
        ReleaseHard();
        vTaskDelete(nullptr);
    }

    void Step(float dt) {
        switch (mode_) {
            case Mode::kGait:  StepGait(dt);  break;
            case Mode::kWave:  StepWave(dt);  break;
            case Mode::kPulse: StepPulse(dt); break;
            case Mode::kIdle:
            default:           StepIdle(dt);  break;
        }
        bank_.Tick(dt);
    }

    void ReleaseHard() {
        bank_.ReleaseAll();
        for (int i = 0; i < 20; i++) bank_.Tick(0.02f);
    }

    void WriteArm(int arm, float yaw_deg, float lift_deg) {
        arm %= kArmCount;
        if (rig_ == RigType::kSingle8) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), HomeAngle() + yaw_deg);
        } else if (rig_ == RigType::kDual16) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), HomeAngle() + yaw_deg);
            bank_.SetTarget(ChannelOf(rig_, arm, 1), HomeAngle() + lift_deg);
        } else {
            // 腱绳连续体：把 (yaw, lift) 解成三根绳的张力分配
            // 三根绳在截面按 120° 分布，绳 j 的收紧量 ∝ cos(φ - θj)
            float phi = yaw_deg * static_cast<float>(M_PI) / 180.0f;
            float curve = 0.25f + lift_deg / 90.0f;  // 曲率
            for (int j = 0; j < 3; j++) {
                float theta = 2.0f * static_cast<float>(M_PI) * j / 3.0f;
                float tension = std::cos(phi - theta) * curve * 30.0f;
                bank_.SetTarget(ChannelOf(rig_, arm, j), HomeAngle() + tension);
            }
        }
    }

    void StepGait(float dt) {
        gait_.Tick(dt);
        for (int a = 0; a < kArmCount; a++) {
            WriteArm(a, gait_.Yaw(a), gait_.Lift(a));
        }
    }

    void StepWave(float dt) {
        gait_.Reset();
        wave_timer_ += dt;
        const float dur = 1.2f;
        if (wave_timer_ >= dur) { mode_ = Mode::kIdle; return; }
        float k = wave_timer_ / dur;
        float env = std::sin(k * static_cast<float>(M_PI));
        for (int a = 0; a < kArmCount; a++) {
            WriteArm(a, 0.0f, (a == wave_arm_) ? env * 45.0f : 0.0f);
        }
    }

    void StepPulse(float dt) {
        pulse_timer_ += dt;
        if (pulse_timer_ >= pulse_period_) {
            pulse_timer_ = 0.0f;
            if (--pulse_left_ <= 0) { mode_ = Mode::kIdle; return; }
        }
        float k = pulse_timer_ / pulse_period_;
        float curl = std::sin(k * static_cast<float>(M_PI)) * 40.0f;
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, curl);
    }

    void StepIdle(float dt) {
        gait_.Reset();
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, 0.0f);
    }

    RigType rig_ = RigType::kDual16;
    int channels_ = 16;
    int board_count_ = 1;

    Pca9685 boards_[3];
    ServoBank bank_;
    Gait gait_;

    Mode mode_ = Mode::kIdle;
    TaskHandle_t task_ = nullptr;
    volatile bool running_ = false;

    int wave_arm_ = 0;
    float wave_timer_ = 0.0f;
    int pulse_left_ = 0;
    float pulse_period_ = 0.6f;
    float pulse_timer_ = 0.0f;
};

}  // namespace octo
`,T=`// 把八爪鱼的动作注册成小智固件的 MCP 工具 —— 接进 xiaozhi-esp32 的示例。
//
// 放哪儿：main/boards/octopus/octopus_mcp.cpp，然后在 CMakeLists.txt 的 SRCS 里加上。
// 调用点：在你的板子 Initialize() 末尾（Display / Buttons 初始化之后）调 RegisterOctopusTools(body);
//
// 设计说明（重要）：
//   这里刻意采用「一个统一工具 + action 参数」，而不是「一个动作一个工具」。
//   这是抄官方 main/boards/otto-robot/ 的做法（它用 self.otto.action）。
//   原因：注册十几个工具会让大模型的选择变困难，还容易调错；
//   单个工具配一个枚举型的 action 参数，命中率明显更高，工具列表也干净。
//
// ⚠️ 注意 API 版本：xiaozhi-esp32 的 McpServer::AddTool 签名在 v1.x → v2.x 之间变过。
//    下面用的是 v2.x / v2.5 的常见写法。如果你的 fork 编译报错，去对着
//    main/boards/otto-robot/otto_controller.cc 里的 AddTool 调用改一下参数包即可，
//    运动层代码一行都不用动。

#include <string>

#include "mcp_server.h"
#include "octopus_body.h"

namespace {

octo::OctopusBody* g_body = nullptr;

}  // namespace

void RegisterOctopusTools(octo::OctopusBody& body) {
    g_body = &body;

    auto& mcp = McpServer::GetInstance();

    // 统一动作接口：大模型只需要决定 action 和几个数值参数
    mcp.AddTool(
        "self.octopus.action",
        "执行八爪鱼动作。"
        "action 取值："
        "crawl(爬行, 需 steps/speed/direction 参数)、"
        "wave(用某条触手挥手, 需 arm 参数)、"
        "pulse(八触手同步收缩, 像水母脉冲, 需 steps)、"
        "rest(停止并放松)、"
        "home(回到中位)。"
        "direction: -100 全左转, 0 直行, +100 全右转。"
        "speed: 数值越小越快, 建议 500-2000。",
        PropertyList({
            Property("action", kPropertyTypeString, "crawl"),
            Property("steps", kPropertyTypeInteger, 3, 1, 100),
            Property("direction", kPropertyTypeInteger, 0, -100, 100),
            Property("speed", kPropertyTypeInteger, 1000, 300, 3000),
            Property("arm", kPropertyTypeInteger, 0, 0, 7),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");

            std::string action = props["action"].value<std::string>();
            int steps = props["steps"].value<int>();
            int dir = props["direction"].value<int>();
            int speed = props["speed"].value<int>();
            int arm = props["arm"].value<int>();

            // speed 是毫秒为单位的周期，转成 Hz
            float hz = 1000.0f / static_cast<float>(speed > 0 ? speed : 1000);

            if (action == "crawl") {
                auto p = b->GaitParamsSnapshot();
                p.freq_hz = hz;
                b->SetGaitParams(p);
                b->SetVelocity(1.0f, dir / 100.0f * 0.6f);
                return std::string("开始爬行");
            } else if (action == "wave") {
                b->WaveOnce(arm);
                return std::string("挥手");
            } else if (action == "pulse") {
                b->Pulse(steps);
                return std::string("脉冲收缩");
            } else if (action == "rest") {
                b->Rest();
                return std::string("已放松");
            } else if (action == "home") {
                b->Rest();
                return std::string("已回中位");
            }
            return std::string("未知动作: ") + action;
        });

    // 单独一个调步态的工具：把「怎么走」和「做什么动作」分开，方便大模型微调
    mcp.AddTool(
        "self.octopus.set_gait",
        "微调步态参数，不改变当前是否在动。"
        "freq 按 x10 倍传入（例如 6 表示 0.6Hz，超过 12 舵机就跟不上了），"
        "amplitude 是触手摆幅角度（0-60），"
        "phase 是相邻触手相位差：0 表示八条同步，45 表示环形逆行波（最像真章鱼），180 表示交替步态。",
        PropertyList({
            Property("freq", kPropertyTypeInteger, 6, 2, 20),
            Property("amplitude", kPropertyTypeInteger, 38, 0, 60),
            Property("phase", kPropertyTypeInteger, 45, 0, 180),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");
            octo::GaitParams p = b->GaitParamsSnapshot();
            p.freq_hz = props["freq"].value<int>() / 10.0f;
            p.yaw_amp_deg = static_cast<float>(props["amplitude"].value<int>());
            p.phase_deg = static_cast<float>(props["phase"].value<int>());
            b->SetGaitParams(p);
            return std::string("步态已更新");
        });
}

// ---------------------------------------------------------------------------
// 配套：粘贴到 xiaozhi.me 控制台的「角色人设」里，动作才有灵魂。
// 这个模板是照 otto-robot 的 README 改的，实测能让大模型主动调用动作，
// 而不是等你追问。
//
//   我的身份：我是一只八爪鱼机器人，有八条灵活的触手，能爬行、挥手、脉冲收缩。
//
//   我的动作能力（通过 self.octopus.action 调用）：
//   - crawl：爬行，用 steps 控制步数，direction 控制方向
//   - wave：指定某条触手挥手打招呼，arm 取值 0-7
//   - pulse：八条触手同步收缩，像水母一样，表达害怕或兴奋
//   - rest：停下来放松
//
//   我的性格：我很活泼，说话前会先做一个相应的动作表达情绪（先发动作指令再说话）。
//   打招呼时会 wave，高兴时会 pulse，被夸奖时会 crawl 转一圈，累了就 rest。
//   根据对话内容选择合适的动作，不要每次都一样。
// ---------------------------------------------------------------------------
`,E={"octopus_plus/octopus_plus.ino":`/*
 * 小智八爪鱼 · 身体固件（完善版 / 我的补充）
 * ============================================================
 * 基于 md 的 body_firmware_A.ino。所有改动处都标了「我的补充」，对应指南里的“完善版改动表”。
 * 这是早期原型：已在仿真台面里跑过同样的逻辑，未在实物上验证。
 *
 * 文件：octopus_plus.ino + octopus_gait.h + octopus_bus.h + octopus_body.h + octopus_batt.h
 *       放在同一个 Arduino 工程文件夹（文件夹名必须是 octopus_plus）。
 * 板型：ESP32-S3-DevKitC-1（Arduino IDE 选 “ESP32S3 Dev Module”，arduino-esp32 3.x）
 * 库：  只用 ESP32 核心自带的 Wire 和 BLE，不需要额外安装。
 *
 * 手机：任意 BLE 串口 App（Nordic UART Service），连 “OctoBrain”，发文本指令：
 *   GO / WALK / FWD    向前爬
 *   LEFT / RIGHT       左转 / 右转（A 差速转，B 原地转）
 *   STOP / REST        停下，1 s 后舵机放松（FULL OFF）
 *   HOME               逐路回中位
 *   WAVE n             第 n 号触手挥手（0~7）
 *   PULSE n            八条一起收缩 n 次
 *   GAIT f=0.6 yaw=30 lift=20 phase=45 duty=0.6 press=20   现场调步态（大小写都行；press 只对 B 有用）
 *   BATT               回报电池电压
 * 15 s 没收到指令会自动 REST（md 的安全特性，保留）；想一直走，App 每 5 s 重发一次 GO。
 *
 * v16 我的补充：以 '@' 开头的行是 OCTL/1 协议帧（台面「实物连接」面板用，带序号和 CRC，见 octopus_link.h）。
 *   会话中 1.5 s 收不到帧 → 自动 REST；BLE 断开 → 自动 REST；ESTOP → 立刻停 PWM。上面的文本指令照常能用。
 */

// —— 我的补充：编译开关，选方案。8 = 方案 A（kSingle8），16 = 方案 B（kDual16）——
#ifndef OCTO_RIG
#define OCTO_RIG 8
#endif
// 我的补充 · v10 紧凑无线版：-DOCTO_V10=1（板子选 Adafruit QT Py ESP32-S3 No PSRAM）。只支持 8 舵机。
#ifndef OCTO_V10
#define OCTO_V10 0
#endif
#if OCTO_V10 && OCTO_RIG != 8
#error "v10 only has 8 servos (OCTO_RIG=8)"
#endif

#define OCTO_USE_ARDUINO
#include <Wire.h>
// 我的补充：ESP32-S3 只有低功耗蓝牙，md 用的 BluetoothSerial 在 S3 上编译不过，改 BLE Nordic UART
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#if !defined(CONFIG_BT_NIMBLE_ENABLED) && !defined(CONFIG_NIMBLE_ENABLED)
#include <BLE2902.h>   // Bluedroid 需要手动加 CCCD；NimBLE（arduino-esp32 3.3 起）自动加
#define OCTO_NEED_2902
#endif

#include "octopus_gait.h"
#include "octopus_bus.h"
#include "octopus_body.h"
#include "octopus_batt.h"
#include "octopus_link.h"   // v16 我的补充
#include <esp_system.h>
#ifdef OCTO_CTRL_CUSTOM
#include "octopus_imu.h"   // v14：MPU-6050（有 octopus_ctrl_custom.h 才编进来）
octo::Mpu6050 imu;
static bool ImuRead(void* ctx, octo::ImuSample& s) { return static_cast<octo::Mpu6050*>(ctx)->Read(s); }
#endif

// ---- 引脚（按 README / md .ino）----
#define I2C_SDA 8
#define I2C_SCL 9
// 我的补充：电池检测在 GPIO10（见 octopus_batt.h），不用 md 写的 GPIO4（已被麦克风 WS 占用）

// Nordic UART Service UUID（我的补充）
#define NUS_SERVICE "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
#define NUS_RX      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"   // 手机 → 板子（write）
#define NUS_TX      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"   // 板子 → 手机（notify）

octo::OctopusBody body;
octo::Battery batt;
octo::Link octoLink;            // v16
volatile bool bleDropped = false;   // v16：BLE 回调只置位，loop() 里处理

BLECharacteristic* txChar = nullptr;
volatile bool bleConnected = false;
QueueHandle_t lineQueue = nullptr;     // 我的补充：BLE 回调只把整行塞进队列，loop() 里解析

struct Line { char s[OCTL_MAX_LINE + 8]; };   // v16：OCTL/1 一行最长 160

String usbLine;
uint32_t lastCmdMs = 0;
uint32_t lastBattMs = 0;
const uint32_t AUTO_REST_MS = 15000;   // md：15 s 没指令自动待机

// v16 我的补充：BLE 默认 MTU 23 → 每次 notify 最多 20 字节，长行分段发，主机按 '\\n' 拼回整行
void bleSend(const char* p, size_t n) {
  if (!bleConnected || !txChar) return;
  for (size_t i = 0; i < n; i += 20) {
    const size_t k = (n - i) < 20 ? (n - i) : 20;
    txChar->setValue((uint8_t*)(p + i), k);
    txChar->notify();
  }
}

void sendLine(const char* line, size_t n) {   // v16：协议帧（已带 '\\n'）
  Serial.write(reinterpret_cast<const uint8_t*>(line), n);
  bleSend(line, n);
}

void reply(const String& s) {
  Serial.println(s);
  String t = s + "\\n";   // v16：BLE 也补换行，分段后主机才能断行
  bleSend(t.c_str(), t.length());
}

class ServerCb : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { bleConnected = true; }
  void onDisconnect(BLEServer* srv) override {
    bleConnected = false;
    bleDropped = true;   // v16
    srv->getAdvertising()->start();   // 断开后继续广播
  }
};

class RxCb : public BLECharacteristicCallbacks {
  String buf;
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue();
    for (size_t i = 0; i < v.length(); i++) {
      char ch = v[i];
      if (ch == '\\n' || ch == '\\r') { push(); }
      else if (buf.length() < OCTL_MAX_LINE + 1) buf += ch;
    }
    // 很多 App 发送时不带换行：一次 write 当一行（v16：'@' 协议帧会被分成多次 write，等换行）
    if (!buf.startsWith("@")) push();
  }
  void push() {
    if (!buf.length()) return;
    Line l;
    strncpy(l.s, buf.c_str(), sizeof(l.s) - 1);
    l.s[sizeof(l.s) - 1] = 0;
    xQueueSend(lineQueue, &l, 0);
    buf = "";
  }
};

void setupBle() {
  BLEDevice::init("OctoBrain");
  BLEServer* srv = BLEDevice::createServer();
  srv->setCallbacks(new ServerCb());
  BLEService* svc = srv->createService(NUS_SERVICE);
  txChar = svc->createCharacteristic(NUS_TX, BLECharacteristic::PROPERTY_NOTIFY);
#ifdef OCTO_NEED_2902
  txChar->addDescriptor(new BLE2902());
#endif
  BLECharacteristic* rx = svc->createCharacteristic(
      NUS_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  rx->setCallbacks(new RxCb());
  svc->start();
  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
}

void setup() {
  Serial.begin(115200);
#if !OCTO_V10
  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);
#endif
  batt.Begin();
  lineQueue = xQueueCreate(8, sizeof(Line));

#if OCTO_RIG == 16
  const octo::RigType rig = octo::RigType::kDual16;
#else
  const octo::RigType rig = octo::RigType::kSingle8;   // 我的补充：md 写死 kDual16，方案 A 只有 8 个舵机
#endif

  if (!body.Init(rig, &Wire, octo::I2cWriteArduino)) {
#if OCTO_V10
    Serial.println("LEDC init failed: check servo pins");
#else
    Serial.println("PCA9685 init failed: check SDA/SCL, V+ / VCC, address 0x40");
#endif
    while (1) delay(1000);
  }
  body.SoftHomeBlocking();   // 我的补充：真正逐路上电（每路间隔 150 ms）
#ifdef OCTO_CTRL_CUSTOM
#if OCTO_V10
  Wire1.begin(41, 40);       // v14：QT Py 的 STEMMA QT 口
  Wire1.setClock(400000);
  TwoWire* imuBus = &Wire1;
#else
  TwoWire* imuBus = &Wire;   // 完善版：和 PCA9685 同一条总线（都在运动任务里访问）
#endif
  if (imu.Begin(imuBus)) { imu.CalibrateGyro(); body.SetImu(ImuRead, &imu); Serial.println("IMU MPU-6050 ok: closed loop on"); }
  else Serial.println("IMU not found (WHO_AM_I) - open loop");
#endif
  body.Start();
  octoLink.Begin(&body, &batt, sendLine, OCTO_V10 ? 10 : 20);   // v16

  setupBle();
  reply(String(OCTO_V10 ? "Octopus ready (v10 wireless)" : "Octopus ready (plus)") + ". BLE name = OctoBrain, rig = " + String(OCTO_RIG));
  if (batt.Low()) reply("LOW BATTERY " + String(batt.Volts(), 2) + " V - charge first");   // 我的补充：开机就低电
  lastCmdMs = millis();
  octoLink.Boot(static_cast<int>(esp_reset_reason()));   // v16：主机靠这一帧发现板子复位过（比如欠压）
}

void handleCommand(String s);

// v16：协议帧给 link，其余走老的文本指令
void handleLine(const char* s) {
  if (octoLink.Handle(s, millis())) { lastCmdMs = millis(); return; }
  handleCommand(String(s));
}

void loop() {
  Line l;
  while (xQueueReceive(lineQueue, &l, 0) == pdTRUE) handleLine(l.s);

  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\\n' || c == '\\r') { if (usbLine.length()) { handleLine(usbLine.c_str()); usbLine = ""; } }
    else if (usbLine.length() < OCTL_MAX_LINE + 1) usbLine += c;
  }

  if (bleDropped) { bleDropped = false; octoLink.OnDisconnect(); }   // v16
  octoLink.Tick(millis());

  if (millis() - lastCmdMs > AUTO_REST_MS) {
    body.Rest();
    lastCmdMs = millis();
  }

  // 我的补充：每 500 ms 查一次电池，带迟滞
  if (millis() - lastBattMs > 500) {
    lastBattMs = millis();
    if (batt.Update()) {
      if (batt.Low()) {
#if OCTO_V10
        body.RelaxNow();
#else
        body.Rest();
#endif
        reply("LOW BATTERY " + String(batt.Volts(), 2) + " V - stopped");
        octoLink.Event(3, batt.Volts());   // v16
      }
      else reply("battery OK " + String(batt.Volts(), 2) + " V");
    }
  }

  delay(10);
}

void handleCommand(String s) {
  s.trim();
  s.toUpperCase();
  lastCmdMs = millis();
  reply("> " + s);

  if (s == "STOP" || s == "REST") { body.Rest(); return; }
  if (s == "BATT") { reply(String(batt.Read(), 2) + " V"); return; }
  // 我的补充：低电量时只接受 STOP / REST / BATT
  if (batt.Low()) { reply("battery low, charge first"); return; }

  if (s == "GO" || s == "WALK" || s == "FWD") { body.SetVelocity(1.0f, 0.0f); return; }
  if (s == "LEFT" || s == "TURNL")  { body.SetVelocity(1.0f, -1.0f); return; }
  if (s == "RIGHT" || s == "TURNR") { body.SetVelocity(1.0f, 1.0f); return; }
  if (s.startsWith("WAVE")) {
    int a = s.substring(4).toInt();
    if (a < 0 || a > 7) a = 0;
    body.WaveOnce(a);
    return;
  }
  if (s.startsWith("PULSE")) {
    int n = s.substring(5).toInt();
    if (n < 1) n = 1;
    body.Pulse(n);
    return;
  }
  if (s.startsWith("HOME")) { body.Home(); return; }   // 我的补充：交给运动任务，先停步态
  if (s.startsWith("GAIT")) { setGait(s); return; }
  reply("? unknown: " + s);
}

// 我的补充：toUpperCase() 之后按大写键名匹配（md 找小写，永远匹配不上）
void setGait(const String& s) {
  octo::GaitParams p = body.GaitParamsSnapshot();
  int i = 0, hit = 0;
  while (i < (int)s.length()) {
    int sp = s.indexOf(' ', i);
    String tok = (sp == -1) ? s.substring(i) : s.substring(i, sp);
    if      (tok.startsWith("F="))     { p.freq_hz      = tok.substring(2).toFloat(); hit++; }
    else if (tok.startsWith("YAW="))   { p.yaw_amp_deg  = tok.substring(4).toFloat(); hit++; }
    else if (tok.startsWith("LIFT="))  { p.lift_amp_deg = tok.substring(5).toFloat(); hit++; }
    else if (tok.startsWith("PHASE=")) { p.phase_deg    = tok.substring(6).toFloat(); hit++; }
    else if (tok.startsWith("DUTY="))  { p.duty         = tok.substring(5).toFloat(); hit++; }
    else if (tok.startsWith("PRESS=")) { p.press_deg    = tok.substring(6).toFloat(); hit++; }
    i = (sp == -1) ? s.length() : sp + 1;
  }
  // 我的补充：夹到 md 写的安全范围
  if (p.freq_hz > 1.2f) p.freq_hz = 1.2f;
  if (p.freq_hz < 0.1f) p.freq_hz = 0.1f;
  if (p.yaw_amp_deg > 55.0f) p.yaw_amp_deg = 55.0f;
  body.SetGaitParams(p);
  reply(hit ? "gait updated" : "gait: no key matched (use F= YAW= LIFT= PHASE= DUTY= PRESS=)");
}
`,"octopus_plus/octopus_gait.h":`#pragma once
// 八触手 CPG 步态发生器（完善版）—— 纯数学层，不依赖任何硬件。
// 基于 md 的 octopus_gait.h；改动处都标了「我的补充」。
//
// 我的补充：md 的 Yaw() 让八条触手往同一个方向扫，左右舷判断 Lateriality() 用的是 sin(安装角)，
// 实际区分的是前后，LEFT / RIGHT 转不了弯，转弯增益 1.85 还会让摆幅超过相邻 45° 的间隔。
// 完善版改成「镜像扫动」Sweep()：按 cos(安装角) 区分左右舷，左右两边反向扫，直行时转矩抵消；
//   - 方案 A（只有偏航，kSingle8）：一侧摆幅变小 = 差速转弯；
//   - 方案 B（偏航 + 俯仰，kDual16）：八条同向扫 = 原地转。
// 结果夹在 [-1, 1]，任何时候摆幅都不会超过设定值。

#include <cmath>
#include <cstdint>

namespace octo {

static constexpr int kArmCount = 8;

struct ArmChannels {
    int yaw;
    int lift;
};

struct GaitParams {
    float freq_hz       = 0.6f;   // 步频，0.3 稳一点，超过 1.2 舵机会跟不上（md）
    float yaw_amp_deg   = 30.0f;  // 我的补充：A 默认 30°（md 38°）；B 由 OctopusBody 改成 20°（v8；相邻差最大 0.71×20≈14°，45−14=31° > 间隙 16+3，估算）
    float lift_amp_deg  = 20.0f;
    float phase_deg     = 45.0f;  // 0=同步划水 45=环形波 180=交替
    float duty          = 0.6f;   // 我的补充：A 0.6 / B 0.55（md 0.65）
    float press_deg     = 0.0f;   // 我的补充（v9）：B 支撑相俯仰往下压的角度，把机身从底板上撑起来；A 没有俯仰舵机 = 0
};

class Gait {
public:
    void SetParams(const GaitParams& p) { params_ = p; }
    const GaitParams& Params() const { return params_; }

    // 我的补充：B（kDual16）原地转；A（kSingle8）差速转
    void SetSpinTurn(bool on) { spin_turn_ = on; }

    void Tick(float dt) {
        phase_ += dt * params_.freq_hz * 360.0f;
        while (phase_ >= 360.0f) { phase_ -= 360.0f; cycles_++; }
        while (phase_ < 0.0f) phase_ += 360.0f;
    }

    void Reset() { phase_ = 0.0f; cycles_ = 0; }
    uint32_t Cycles() const { return cycles_; }   // 我的补充：给 MCP steps 计数

    void SetSteer(float s) { steer_ = Clamp(s, -1.0f, 1.0f); }
    void SetThrottle(float t) { throttle_ = Clamp(t, 0.0f, 1.0f); }

    float Phase01(int arm) const {
        float p = std::fmod(phase_ + params_.phase_deg * arm, 360.0f) / 360.0f;
        return (p < 0.0f) ? p + 1.0f : p;
    }

    float Yaw(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float tri;
        if (p < d) {
            tri = 1.0f - 2.0f * (p / d);
        } else {
            tri = -1.0f + 2.0f * ((p - d) / (1.0f - d));
        }
        return tri * params_.yaw_amp_deg * Sweep(arm) * throttle_;
    }

    float Lift(int arm) const {
        float p = Phase01(arm);
        float d = Clamp(params_.duty, 0.05f, 0.95f);
        float pr = params_.press_deg;
        if (p < d) return -pr;
        float k = (p - d) / (1.0f - d);
        return -pr + std::sin(k * static_cast<float>(M_PI)) * (params_.lift_amp_deg + pr);
    }

    bool IsPowerStroke(int arm) const { return Phase01(arm) < params_.duty; }

    // 0 号在正前方，顺时针排布（md）
    static float MountAngle(int arm) { return -90.0f + arm * 45.0f; }

    // 我的补充：左右舷 = cos(安装角)：右舷 > 0，左舷 < 0，正前 / 正后 = 0
    static float Side(int arm) {
        return std::cos(MountAngle(arm) * static_cast<float>(M_PI) / 180.0f);
    }

    // v13 我的补充：自定义步态的摆幅缩放 = 油门 ×（转弯时内侧一舷缩小，同 Sweep 的差速思路）
    float CustomScale(int arm) const {
        const float c = Side(arm), sg = c > 1e-3f ? 1.0f : (c < -1e-3f ? -1.0f : 0.0f);
        return Clamp(1.0f - steer_ * sg, 0.0f, 1.0f) * throttle_;
    }

private:
    // 我的补充：镜像扫动（替代 md 的 Gain()）
    float Sweep(int arm) const {
        const float c = Side(arm), s = steer_;
        if (spin_turn_) return Clamp((1.0f - std::fabs(s)) * c - s, -1.0f, 1.0f);
        const float sg = (c > 1e-6f) ? 1.0f : (c < -1e-6f ? -1.0f : 0.0f);
        return Clamp(c * (1.0f - s * sg), -1.0f, 1.0f);
    }

    static float Clamp(float v, float lo, float hi) {
        return v < lo ? lo : (v > hi ? hi : v);
    }

    GaitParams params_;
    float phase_ = 0.0f;
    float steer_ = 0.0f;
    float throttle_ = 1.0f;
    bool spin_turn_ = false;
    uint32_t cycles_ = 0;
};

// 我的补充：相邻触手防碰撞。相邻两条的夹角 = 45° − yaw[i+1] + yaw[i]，
// 小于 gmin（机械间隙 + 3° 余量；A 12°、B 16°；B 为 v8 在 3D 碰撞体上实测 13° + 余量）就两边各退一半，迭代收敛。
inline void AntiCollide(float* yaw, float gmin) {
    for (int it = 0; it < 40; it++) {
        for (int a = 0; a < kArmCount; a++) {
            int b = (a + 1) % kArmCount;
            float gap = 45.0f - yaw[b] + yaw[a];
            if (gap < gmin) { float f = (gmin - gap) * 0.5f; yaw[a] += f; yaw[b] -= f; }
        }
    }
}

}  // namespace octo
`,"octopus_plus/octopus_bus.h":`#pragma once
// PCA9685 多舵机总线 + 软启动/限速保护（完善版）。基于 md 的 octopus_bus.h，改动处标「我的补充」。

#include <cmath>
#include <cstdint>
#include <cstddef>

#include "octopus_gait.h"

// 我的补充 · v10 紧凑无线版：-DOCTO_V10=1 时不用 PCA9685，8 个舵机直接接 QT Py ESP32-S3 的 GPIO，用 LEDC 出 PWM
#ifndef OCTO_V10
#define OCTO_V10 0
#endif

#if defined(OCTO_USE_ESP_IDF)
#include "esp_err.h"
#include "esp_log.h"
#include "esp_rom_sys.h"
#include "driver/i2c_master.h"
#define OCTO_DELAY_US(us) esp_rom_delay_us(us)
#elif defined(OCTO_USE_ARDUINO)
#include <Arduino.h>
#include <Wire.h>
#define OCTO_DELAY_US(us) delayMicroseconds(us)
#else
#define OCTO_DELAY_US(us) ((void)0)
#endif

namespace octo {

class Pca9685 {
public:
    static constexpr uint8_t kRegMode1     = 0x00;
    static constexpr uint8_t kRegMode2     = 0x01;
    static constexpr uint8_t kRegPrescale  = 0xFE;
    static constexpr uint8_t kRegLed0OnL   = 0x06;

    static constexpr uint8_t kBaseAddr     = 0x40;
    static constexpr uint32_t kOscHz       = 25000000UL;
    static constexpr uint16_t kResolution  = 4096;

    // 我的补充：脉宽 0.5–2.5 ms ↔ 0–180°（50 Hz 下 20 ms = 4096 计数 → 102 / 512），90° = 1.5 ms。
    // md 原值 150–600（0.73–2.93 ms），90° 落在 1.83 ms。每个舵机仍需 SetTrim 单点校准。
    static constexpr uint16_t kPulseMin = 102;
    static constexpr uint16_t kPulseMax = 512;

    // 我的补充：默认构造（OctopusBody 里的 boards_[3] 数组需要，md 版编译不过）
    Pca9685() : Pca9685(kBaseAddr) {}
    explicit Pca9685(uint8_t addr, uint16_t pulse_min = kPulseMin, uint16_t pulse_max = kPulseMax)
        : addr_(addr), pulse_min_(pulse_min), pulse_max_(pulse_max) {}

    uint8_t Addr() const { return addr_; }
    void SetPulseRange(uint16_t lo, uint16_t hi) { pulse_min_ = lo; pulse_max_ = hi; }

    uint16_t AngleToPulse(float deg) const {
        float d = deg < 0.0f ? 0.0f : (deg > 180.0f ? 180.0f : deg);
        return static_cast<uint16_t>(pulse_min_ + (pulse_max_ - pulse_min_) * (d / 180.0f) + 0.5f);
    }

    using WriteFn = int (*)(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len);

    bool Init(void* ctx, WriteFn write_fn, float freq_hz = 50.0f) {
        ctx_ = ctx;
        write_ = write_fn;
        if (!write_) return false;

        uint8_t sleep_ai = 0x10 | 0x20;              // SLEEP + AI；预分频只能在 SLEEP 时写
        if (Write(kRegMode1, &sleep_ai, 1) != 0) return false;

        uint32_t prescale = static_cast<uint32_t>(kOscHz / (kResolution * freq_hz) + 0.5f);
        if (prescale < 3) prescale = 3;
        if (prescale > 255) prescale = 255;
        uint8_t ps = static_cast<uint8_t>(prescale - 1);
        if (Write(kRegPrescale, &ps, 1) != 0) return false;

        uint8_t normal_ai = 0x20;                    // 退出 SLEEP，保留 AI
        if (Write(kRegMode1, &normal_ai, 1) != 0) return false;

        // 我的补充：振荡器唤醒后最多 500 µs 才稳定（PCA9685 数据手册），等够再写 RESTART
        OCTO_DELAY_US(500);
        uint8_t restart = 0x80 | 0x20;               // RESTART + AI
        if (Write(kRegMode1, &restart, 1) != 0) return false;

        uint8_t mode2 = 0x04;                        // OUTDRV = 推挽
        if (Write(kRegMode2, &mode2, 1) != 0) return false;
        return true;
    }

    bool SetRaw(int ch, uint16_t on, uint16_t off) const {
        uint8_t buf[4] = {
            static_cast<uint8_t>(on & 0xFF), static_cast<uint8_t>(on >> 8),
            static_cast<uint8_t>(off & 0xFF), static_cast<uint8_t>(off >> 8),
        };
        return Write(static_cast<uint8_t>(kRegLed0OnL + 4 * ch), buf, 4);
    }

    bool SetAngle(int ch, float deg) const { return SetRaw(ch, 0, AngleToPulse(deg)); }

    // 我的补充：FULL OFF（LEDn_OFF_H bit4 = 1），输出常低，舵机不再出力
    bool SetOff(int ch) const { return SetRaw(ch, 0, 0x1000); }

private:
    int Write(uint8_t reg, const uint8_t* data, size_t len) const {
        return write_(ctx_, addr_, reg, data, len);
    }
    // 注：md 版的 Write() 返回 bool 却和 0 比较（!= 0 表示失败），写成功时 Init 反而返回 false。
    // 完善版统一返回 int（0 = 成功）。

    uint8_t addr_;
    uint16_t pulse_min_, pulse_max_;
    void* ctx_ = nullptr;
    WriteFn write_ = nullptr;
};

#if OCTO_V10
// 我的补充 · v10：和 Pca9685 同样的 SetAngle / SetOff 接口，ServoBank / OctopusBody / Gait 不用改。
// arduino-esp32 3.x 的 LEDC API：ledcAttach(pin, 50 Hz, 14 位) 自动分配通道；ledcWrite(pin, duty)。
// 脉宽按 SG51R（Adafruit 2201）页面：0.75–2.25 ms 对应全行程。
class LedcBoard {
public:
    static constexpr float kUs0 = 750.0f, kUs1 = 2250.0f;
    bool Init(const uint8_t* pins, int n) {
        pins_ = pins; n_ = n;
        for (int i = 0; i < n; i++) if (!ledcAttach(pins[i], 50, 14)) return false;
        return true;
    }
    static uint32_t Duty(float us) { return static_cast<uint32_t>(std::lround(us / 20000.0f * 16383.0f)); }
    void SetAngle(int ch, float deg) const {
        if (ch < 0 || ch >= n_) return;
        if (deg < 0.0f) deg = 0.0f;
        if (deg > 180.0f) deg = 180.0f;
        ledcWrite(pins_[ch], Duty(kUs0 + (kUs1 - kUs0) * deg / 180.0f));
    }
    void SetOff(int ch) const { if (ch >= 0 && ch < n_) ledcWrite(pins_[ch], 0); }   // 占空比 0 = 不出脉冲，舵机放松
private:
    const uint8_t* pins_ = nullptr;
    int n_ = 0;
};
using BankBoard = LedcBoard;
#else
using BankBoard = Pca9685;
#endif

class ServoBank {
public:
    void Bind(const BankBoard* boards, int board_count) { boards_ = boards; board_count_ = board_count; }

    bool Begin(int channels, float home_angle = 90.0f) {
        channels_ = channels;
        for (int i = 0; i < kMaxChannels; i++) {
            target_[i] = home_angle;
            present_[i] = home_angle;
            trim_[i] = 0.0f;
            limit_lo_[i] = 0.0f;
            limit_hi_[i] = 180.0f;
            last_written_[i] = kNever;   // 我的补充：md 初值 0，SoftHome 第一轮 Tick 会同时写出全部通道
            armed_[i] = false;           // 我的补充：SoftHome 逐路 Arm，没 Arm 的通道 Tick 不写
        }
        relaxed_ = false;
        return true;
    }

    void SetTrim(int ch, float deg) { if (Valid(ch)) trim_[ch] = deg; }
    void SetLimit(int ch, float lo, float hi) { if (!Valid(ch)) return; limit_lo_[ch] = lo; limit_hi_[ch] = hi; }

    void SetTarget(int ch, float deg) {
        if (!Valid(ch)) return;
        float v = deg + trim_[ch];
        if (v < limit_lo_[ch]) v = limit_lo_[ch];
        if (v > limit_hi_[ch]) v = limit_hi_[ch];
        target_[ch] = v;
    }

    void SetMaxRate(float deg_per_s) { max_rate_ = deg_per_s; }

    // 我的补充：把一路立即写到目标并“上电”（SoftHome 用）
    void ArmNow(int ch) {
        if (!Valid(ch)) return;
        present_[ch] = target_[ch];
        WriteChannel(ch, present_[ch]);
        last_written_[ch] = present_[ch];
        armed_[ch] = true;
    }

    void Tick(float dt) {
        if (!boards_ || relaxed_) return;
        const float step = max_rate_ * dt;
        for (int i = 0; i < channels_; i++) {
            float d = target_[i] - present_[i];
            if (std::fabs(d) <= step) present_[i] = target_[i];
            else present_[i] += (d > 0) ? step : -step;
            if (armed_[i] && std::fabs(present_[i] - last_written_[i]) >= 0.35f) {
                WriteChannel(i, present_[i]);
                last_written_[i] = present_[i];
            }
        }
    }

    void ReleaseAll() { for (int i = 0; i < channels_; i++) target_[i] = 90.0f + trim_[i]; }

    // 我的补充：全部通道到位了吗（Rest 后判断能不能放松）
    bool Settled() const {
        for (int i = 0; i < channels_; i++) if (std::fabs(target_[i] - present_[i]) > 0.01f) return false;
        return true;
    }

    // 我的补充：放松 = 全部 FULL OFF；唤醒 = 下一次 Tick 重新写出全部通道
    void Relax() {
        if (relaxed_ || !boards_) return;
        for (int i = 0; i < channels_; i++) { int b = i / 16; if (b < board_count_) boards_[b].SetOff(i % 16); }
        relaxed_ = true;
    }
    void Wake() {
        if (!relaxed_) return;
        relaxed_ = false;
        for (int i = 0; i < channels_; i++) last_written_[i] = kNever;
    }
    bool Relaxed() const { return relaxed_; }

    float Present(int ch) const { return Valid(ch) ? present_[ch] : 0.0f; }
    float Trim(int ch) const { return Valid(ch) ? trim_[ch] : 0.0f; }   // v16 我的补充：遥测要换算成“相对校准中位”的角度
    float MaxRate() const { return max_rate_; }
    int Channels() const { return channels_; }

private:
    static constexpr int kMaxChannels = 48;
    static constexpr float kNever = 1e9f;

    bool Valid(int ch) const { return ch >= 0 && ch < channels_; }

    void WriteChannel(int ch, float deg) const {
        int b = ch / 16, c = ch % 16;
        if (b >= board_count_) return;
        boards_[b].SetAngle(c, deg);
    }

    const BankBoard* boards_ = nullptr;
    int board_count_ = 0;
    int channels_ = 0;
    float max_rate_ = 360.0f;
    bool relaxed_ = false;
    float trim_[kMaxChannels];
    float limit_lo_[kMaxChannels];
    float limit_hi_[kMaxChannels];
    float target_[kMaxChannels];
    float present_[kMaxChannels];
    float last_written_[kMaxChannels];
    bool armed_[kMaxChannels];
};

#if defined(OCTO_USE_ESP_IDF)
inline int I2cWriteIdf(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    (void)addr;
    i2c_master_dev_handle_t dev = *static_cast<i2c_master_dev_handle_t*>(ctx);
    uint8_t buf[8];
    if (len + 1 > sizeof(buf)) return -1;
    buf[0] = reg;
    for (size_t i = 0; i < len; i++) buf[i + 1] = data[i];
    return i2c_master_transmit(dev, buf, len + 1, 100);
}
#elif defined(OCTO_USE_ARDUINO)
inline int I2cWriteArduino(void* ctx, uint8_t addr, uint8_t reg, const uint8_t* data, size_t len) {
    TwoWire* wire = static_cast<TwoWire*>(ctx);
    wire->beginTransmission(addr);
    wire->write(reg);
    for (size_t i = 0; i < len; i++) wire->write(data[i]);
    return wire->endTransmission() == 0 ? 0 : -1;
}
#endif

}  // namespace octo
`,"octopus_plus/octopus_body.h":p,"octopus_plus/octopus_batt.h":m,"xiaozhi/octopus_mcp.cpp":`// 小智 MCP 工具（完善版 / 我的补充）—— 基于 md 的 octopus_mcp.cpp。
// ⚠️ 这个文件依赖 xiaozhi-esp32 工程里的 mcp_server.h，本仓库里没有编译过（未实机编译），
//    AddTool 的参数写法沿用 md；如果你的 fork 报错，对照 main/boards/otto-robot/ 改参数包即可。
// 放法：main/boards/octopus/octopus_mcp.cpp，同目录放完善版的 octopus_gait.h / octopus_bus.h / octopus_body.h，
//       板子初始化里先 body.Init(...) → body.SoftHomeBlocking() → body.Start()，再调 RegisterOctopusTools(body)。
// 改动（我的补充）：home 真的回中位；steps 生效；speed 夹到 ≥ 834 ms（≤ 1.2 Hz）；所有调用只入队，由运动任务写舵机。
#include <string>

#include "mcp_server.h"
#include "octopus_body.h"

namespace {

octo::OctopusBody* g_body = nullptr;

}  // namespace

void RegisterOctopusTools(octo::OctopusBody& body) {
    g_body = &body;

    auto& mcp = McpServer::GetInstance();

    // 统一动作接口：大模型只需要决定 action 和几个数值参数
    mcp.AddTool(
        "self.octopus.action",
        "执行八爪鱼动作。"
        "action 取值："
        "crawl(爬行, 需 steps/speed/direction 参数)、"
        "wave(用某条触手挥手, 需 arm 参数)、"
        "pulse(八触手同步收缩, 像水母脉冲, 需 steps)、"
        "rest(停止并放松)、"
        "home(回到中位)。"
        "direction: -100 全左转, 0 直行, +100 全右转。"
        "speed: 每个步态周期的毫秒数, 数值越小越快, 834-3000（小于 834 按 834）。",
        PropertyList({
            Property("action", kPropertyTypeString, "crawl"),
            Property("steps", kPropertyTypeInteger, 3, 1, 100),
            Property("direction", kPropertyTypeInteger, 0, -100, 100),
            Property("speed", kPropertyTypeInteger, 1000, 300, 3000),
            Property("arm", kPropertyTypeInteger, 0, 0, 7),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");

            std::string action = props["action"].value<std::string>();
            int steps = props["steps"].value<int>();
            int dir = props["direction"].value<int>();
            int speed = props["speed"].value<int>();
            int arm = props["arm"].value<int>();

            // 我的补充：speed 是毫秒为单位的周期；夹到 ≥ 834 ms（≈1.2 Hz，md 写的舵机上限）
            if (speed < 834) speed = 834;
            float hz = 1000.0f / static_cast<float>(speed);
            if (steps < 1) steps = 1;

            if (action == "crawl") {
                auto p = b->GaitParamsSnapshot();
                p.freq_hz = hz;
                b->SetGaitParams(p);
                b->SetVelocity(1.0f, dir / 100.0f * 0.6f, steps);   // 我的补充：走够 steps 个周期自动停
                return std::string("开始爬行");
            } else if (action == "wave") {
                b->WaveOnce(arm);
                return std::string("挥手");
            } else if (action == "pulse") {
                b->Pulse(steps);
                return std::string("脉冲收缩");
            } else if (action == "rest") {
                b->Rest();
                return std::string("已放松");
            } else if (action == "home") {
                b->Home();   // 我的补充：md 这里调的是 Rest
                return std::string("已回中位");
            }
            return std::string("未知动作: ") + action;
        });

    // 单独一个调步态的工具：把「怎么走」和「做什么动作」分开，方便大模型微调
    mcp.AddTool(
        "self.octopus.set_gait",
        "微调步态参数，不改变当前是否在动。"
        "freq 按 x10 倍传入（例如 6 表示 0.6Hz，超过 12 舵机就跟不上了），"
        "amplitude 是触手摆幅角度（0-60），"
        "phase 是相邻触手相位差：0 表示八条同步，45 表示环形逆行波（最像真章鱼），180 表示交替步态。",
        PropertyList({
            Property("freq", kPropertyTypeInteger, 6, 2, 20),
            Property("amplitude", kPropertyTypeInteger, 38, 0, 60),
            Property("phase", kPropertyTypeInteger, 45, 0, 180),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");
            octo::GaitParams p = b->GaitParamsSnapshot();
            // 我的补充：freq 上限 12（1.2 Hz）
            p.freq_hz = (props["freq"].value<int>() > 12 ? 12 : props["freq"].value<int>()) / 10.0f;
            p.yaw_amp_deg = static_cast<float>(props["amplitude"].value<int>());
            p.phase_deg = static_cast<float>(props["phase"].value<int>());
            b->SetGaitParams(p);
            return std::string("步态已更新");
        });
}

// ---------------------------------------------------------------------------
// 配套：粘贴到 xiaozhi.me 控制台的「角色人设」里，动作才有灵魂。
// 这个模板是照 otto-robot 的 README 改的，实测能让大模型主动调用动作，
// 而不是等你追问。
//
//   我的身份：我是一只八爪鱼机器人，有八条灵活的触手，能爬行、挥手、脉冲收缩。
//
//   我的动作能力（通过 self.octopus.action 调用）：
//   - crawl：爬行，用 steps 控制步数，direction 控制方向
//   - wave：指定某条触手挥手打招呼，arm 取值 0-7
//   - pulse：八条触手同步收缩，像水母一样，表达害怕或兴奋
//   - rest：停下来放松
//
//   我的性格：我很活泼，说话前会先做一个相应的动作表达情绪（先发动作指令再说话）。
//   打招呼时会 wave，高兴时会 pulse，被夸奖时会 crawl 转一圈，累了就 rest。
//   根据对话内容选择合适的动作，不要每次都一样。
// ---------------------------------------------------------------------------
`,"小智八爪鱼-完善版.md":`# 小智八爪鱼 · 完善版（我的补充）

> 早期原型，简化仿真。本文在你给的 md（README / 采购清单 / 手机控制指南 / 无线架构 / 4 个代码文件）基础上整理。
> **凡是 md 没写清楚、写错或互相矛盾的地方，我都按自己的判断补上了，并标注「我的补充」。**
> 依据分三种：**datasheet**（芯片 / 模块资料里查得到的事实）、**推理**（读 md 代码或简单计算）、**估算**（仿真台面或经验值，必须实物验证）。
> 价格只抄 md；md 没写价格的件写“md 无价格”，不编数字。所有电流、速度、间隙数字都来自仿真台面，属于估算。

## 0. 一句话

和 md 一样：8 个带相位差的振荡器（CPG）驱动 8 条触手，动作注册成小智 MCP 工具。
完善版改了三件大事（我的补充）：**供电改 3S**、**步态改成左右镜像扫动（能直行、能转弯、不打架）**、**固件能在 ESP32‑S3 上编译**（BLE 代替经典蓝牙）。

## 1. 方案命名（我的补充）

md 里“方案 A”有两个意思，.ino 又写死 16 路。完善版统一为：

| | 方案 A | 方案 B |
|---|---|---|
| 每条触手 | 1 个舵机（偏航） | 2 个舵机（偏航 + 俯仰） |
| 舵机总数 | 8（\`RigType::kSingle8\`） | 16（\`RigType::kDual16\`） |
| 固件开关 | \`#define OCTO_RIG 8\` | \`#define OCTO_RIG 16\` |
| 怎么走（估算） | 镜像扫 + 2 个万向球 + 触手尖单向防滑垫，差速转弯 | v9：交替步态（phase 180，duty 0.55）+ 支撑相俯仰下压 20° 把机身撑离桌面，原地转（v8 的同步划水 phase 0 在物理仿真里走 0 cm） |
| 默认步态（估算） | f 0.6 Hz, yaw 30°, phase 45°, duty 0.6 | f 0.6 Hz, yaw 20°（v8 由 15° 调大，见下）, lift 25°, phase 0°, duty 0.5 |

“手机蓝牙手动控制”改叫 **控制方式：手机 BLE**，A / B 都能用；**控制方式：小智语音（MCP）** 也是 A / B 都能用。md 的方案 C（腱绳 24 路）完善版没改、没验证。

## 2. 供电（我的补充）

\`\`\`
3S 锂电组 11.1 V（满 12.6 V / 截止 9.6 V，带 3S 保护板）
  └─ 主开关 ─ 保险丝（规格估算 5 A）
       ├─ XL4015 U1 → 6.0 V → PCA9685 V+ 螺丝端子 → 舵机
       ├─ XL4015 U2 → 5.0 V → DevKitC-1 的 5V 脚（J1 第 21 脚）
       └─ 100 kΩ / 22 kΩ 分压 → GPIO10（ADC1_CH9），ADC 脚对地 0.1 µF
GND 全部共地；PCA9685 V+ 端子并 220 µF，每个舵机插头旁再一个 220 µF
充电：3S 平衡充电器（不要用 TP4056）
\`\`\`

为什么：

- **XL4015 只有一路输出**（datasheet），md 一块做不出 6 V + 5 V，所以用两块。
- **XL4015 输入 8–36 V**（datasheet）：2S 电池 6.4–8.4 V 大部分时间低于下限；3S 9.6–12.6 V 全程在范围内。
- **TP4056 是单节 4.2 V 充电芯片**（datasheet），不能给串联电池组充。
- 分压 100k/22k：12.6 V → 2.27 V，在 ESP32‑S3 11 dB 衰减的校准量程（约 0–2900 mV，datasheet）里。
- DevKitC-1 丝印是 **5V**，没有 VIN（DevKitC-1 用户指南）。
- 电池外形按 3 节 18650（Φ18×65 mm）摆，容量 md 没写，自己按续航选。

## 3. 接线（补齐 md 没写的脚，我的补充）

| ESP32‑S3 | 外设 | 备注 |
|---|---|---|
| GPIO8 / GPIO9 | PCA9685 SDA / SCL，OLED SDA / SCL | 按 README / .ino（采购清单第二批写的 GPIO1/2 不用） |
| 3V3 / GND | PCA9685 VCC / GND | 只给逻辑供电 |
| GND | PCA9685 **OE** | OE 低有效，接地 = 常开输出 |
| GPIO5 / 4 / 6 | INMP441 SCK / WS / SD | INMP441 **VDD → 3V3，L/R → GND**（左声道） |
| GPIO15 / 16 / 7 | MAX98357A BCLK / LRC / DIN | MAX98357A **VIN → 5V** |
| 3V3 | OLED VCC | |
| GPIO10 | 电池分压中点 | **不用 GPIO4**（已是麦克风 WS） |

语音件只在“小智语音”玩法里装；“手机 BLE”玩法不需要麦克风 / 功放 / OLED。

## 4. 固件（完善版）

指南页可以下载：\`octopus_plus/\`（.ino + 4 个头文件）和 \`xiaozhi/octopus_mcp.cpp\`。

- **octopus_plus.ino**：Arduino（arduino-esp32 3.x，ESP32S3 Dev Module）。v8（2026-10-30）用 arduino-cli 1.5.1 + esp32:esp32 3.3.12 重新编译通过：OCTO_RIG 8 / 16 都是程序 620 776 B（47%）、全局变量 30 720 B（9%），我们自己的文件 0 个 warning（\`scripts/fw-compile.sh\`）。未上实物。
- **xiaozhi/octopus_mcp.cpp**：依赖 xiaozhi-esp32 的 \`mcp_server.h\`。v8 只做了**桩编译**：对着上游 xiaozhi-esp32 提交 addb1ed 的 \`mcp_server.h\`（原样下载，需 \`-std=gnu++23\`，见 stub_compile/build_opt.h）+ 空实现的 McpServer（\`stub_compile/mcp_server_stub.cpp\`）编译链接通过、0 warning。这只证明语法和 AddTool/Property 参数对得上，**不是**在小智工程里的真编译。

改动一览（都在代码里标了 \`我的补充\`）：

1. BLE Nordic UART（服务 \`6E400001-B5A3-F393-E0A9-E50E24DCCA9E\`，RX \`…0002\` 写，TX \`…0003\` 通知）代替 BluetoothSerial：ESP32‑S3 只有低功耗蓝牙（datasheet）。
2. \`Pca9685\` 加默认构造（\`boards_[3]\` 需要）；\`Init()\` 的返回值判断修正（md 的 \`Write()\` 成功返回 true，又拿 \`!= 0\` 当失败，写成功反而返回 false）。
3. \`Init()\`：SLEEP|AI → 预分频 → AI → **等 500 µs** → RESTART|AI → MODE2 推挽（datasheet：振荡器最长 500 µs 稳定）。
4. 脉宽 0.5–2.5 ms = 计数 102–512（50 Hz），90° = 1.5 ms（推理；具体舵机以实测为准，每路仍用 \`SetTrim\` 校准）。
5. \`last_written_\` 初值“从未写过”，\`SoftHomeBlocking()\` 每路直接写出并 Arm，路间隔 150 ms：真正分时上电。
6. 所有指令进 FreeRTOS 队列，**只有运动任务写舵机**；REST 按限速回中位，静止 1 s 后 FULL OFF（LEDn_OFF_H bit4，datasheet），下个指令自动唤醒。
7. 每路软件限位 90°±55°；**邻臂防撞** AntiCollide（相邻夹角 ≥ 机械间隙 + 3°，间隙 A 12° / B 16°。B 的 16° 是 v8 在 3D 碰撞体上实测：相邻两个模块夹角到 13° 才接触，再加 3° 余量；v7 的 40° 把两个模块当成绕躯干中心转来算，过于保守，把 B 的摆幅压到了约 ±6°）。
8. 新步态：左右舷按 cos(安装角) 区分，左右镜像；转弯增益夹在 1 以内（md 的 1.85 × 38° ≈ 70° 超过 45° 间隔）。
9. \`GAIT\` 指令大小写都行；频率夹到 ≤ 1.2 Hz。
10. kSingle8 下 WAVE / PULSE 用偏航舵机表达。
11. MCP：home 真的回中位；steps 生效；speed ≥ 834 ms（≈1.2 Hz）。
12. 电池：GPIO10，16 次平均，< 9.6 V 停运动只留通信，> 10.2 V 恢复（阈值估算）。

## 5. 手机 BLE 控制（我的补充）

用任意 BLE 串口 App（例如 nRF Toolbox 的 UART），连 **OctoBrain**，发：

\`GO\` \`LEFT\` \`RIGHT\` \`STOP\` \`HOME\` \`WAVE 3\` \`PULSE 2\` \`GAIT f=0.5 yaw=25\` \`BATT\`

**AUTO_REST**：15 s 没收到指令会自动停（md 的安全特性，保留）。想一直走，让 App 每 5 s 重发一次 \`GO\`（心跳）。

## 6. 物料（只用 md 价格，我的补充）

| 类别 | 型号 | 数量 | 价格 | 出处 |
|---|---|---|---|---|
| 主控 | ESP32-S3-DevKitC-1（或兼容） | 1 | ¥25~35 | 采购清单 无线化 |
| 舵机驱动 | PCA9685 16 路 | 1 | ¥12~25 | 采购清单 第二批 |
| 舵机（A） | MG90S 金属齿 | 8 | ¥40~64 | 采购清单 ¥5~8/个 |
| 舵机（B） | MG90S 金属齿 | 16 | ¥80~128 | 采购清单 ¥5~8/个 |
| 降压 | XL4015 ×2 | 2 | ¥16 | 采购清单 ¥8 × 2 |
| 电池 | 3S 锂电组 11.1 V + 3S 保护板 | 1 | md 无价格 | 我的补充 |
| 充电 | 3S 平衡充电器 | 1 | md 无价格 | 我的补充 |
| 电池检测 | 100 kΩ + 22 kΩ + 0.1 µF | 1 | md 无价格 | 我的补充 |
| 电源 | 主开关 + 保险丝（规格估算 5 A） | 1 | md 无价格 | 我的补充 |
| 电容 | 220 µF 电解 | A 9 / B 17 | A ¥9 / B ¥15 | 采购清单 ¥3/4 个 |
| 结构 | PLA 耗材 | 1 kg | ¥50 | 采购清单 第三批 |
| 方案 A 脚 | 万向球 ×2 + 防滑垫 | 1 套 | md 无价格 | 我的补充 |
| 语音（可选） | INMP441 / MAX98357A / 喇叭 / OLED | 各 1 | ¥5 / ¥6 / ¥4 / ¥10 | README §3 |

md 有价格部分（不含语音件）：**方案 A ≈ ¥152~201，方案 B ≈ ¥198~271**；没含 md 无价格的新增件。
md 里 MG90S 有三个价格（¥12、¥5~8/个、12 个 ¥60~95），完善版统一按采购清单 ¥5~8/个；README 的“合计约 ¥350”和逐项相加对不上，不再引用。

## 7. 推进顺序（同 md，补两点）

0. 小智语音链路跑通 → 1. 1 个舵机 + 最小 MCP → 2. PCA9685 + **两块 XL4015** + 3S 电池，先测 6.0 V / 5.0 V 再接负载 → 3. 组装 → 4. 调 CPG → 5. 升级。

- 第 2 步先只接 4 路，用万用表看电池电流；电流峰值的数字以你的实测为准（md 两处数字 2.3→1.3 A 和“3~5 A”互相矛盾，完善版不引用，台面里的电流是估算）。
- 方案 B 在 10 cm 躯干里相邻两条几乎没有摆动空间（台面几何估算）：现实中建议把俯仰舵机径向安装，或者加大躯干。

## 8. 还是仿真 / 未验证的部分

- 摩擦、步态速度、电流、机械间隙：仿真台面的简化模型，需要实物验证。
- \`octopus_mcp.cpp\`：只做过桩编译（上游 mcp_server.h + 空 McpServer），没在 xiaozhi-esp32 工程里编译。
- md 原样的 body_firmware_A.ino：ESP32‑S3 上编译失败（S3 没有经典蓝牙 \`BluetoothSerial\`；另外 \`OctopusBody\` 缺默认构造，\`Pca9685\` 没有无参构造），换经典 ESP32 也因后两条失败。
- \`octopus_plus.ino\`：编译通过（v8 复测），未上实物。
- 方案 C（腱绳）：沿用 md，未改动。

## 9. 改正的文字问题

- 无线架构里“立创实战派”一处乱码，已改正。
- “ESP32 的 VIN/5V 引脚” → “DevKitC-1 的 5V 脚（J1 第 21 脚）”。
- 方案 A 电源示意的“16 路舵机” → “8 路舵机”。
- 不再引用 MT3608 升压 / 照抄 xiaozhi-esp32-pet 的 BSP（本方案是降压供电）。
`},D={"body_firmware_A.ino":x,"octopus_bus.h":S,"octopus_gait.h":C,"octopus_body.h":w,"octopus_mcp.cpp":T},O={note:`价格全部来自你的 md（2026 年给的文档），台面物料表不写价格。md 没有单独的方案 A 物料表，README §2 只写了“舵机成本 ~60 元”。`,readmeB:{src:`README §3 物料清单（方案 B）`,rows:[[`主控`,`ESP32-S3 N16R8 开发板`,`1`,`¥45`],[`麦克风`,`INMP441 数字麦克风`,`1`,`¥5`],[`功放`,`MAX98357A 模块`,`1`,`¥6`],[`喇叭`,`8Ω 2W 小喇叭`,`1`,`¥4`],[`屏幕`,`SSD1306 OLED 0.96"（可选）`,`1`,`¥10`],[`舵机驱动`,`PCA9685 16 路模块`,`1`,`¥12`],[`舵机`,`MG90S 金属齿（别用 SG90）`,`16`,`¥12`],[`降压`,`XL4015 DC-DC 5A`,`1`,`¥8`],[`电池`,`2S 航模/21700 电池组 7.4V`,`1`,`¥35`],[`充电`,`2S 平衡充 / TP4056×2`,`1`,`¥15`],[`被动件`,`220µF 电解电容、端子、杜邦线`,`若干`,`¥15`],[`结构`,`PLA 打印料 ~200g`,`1`,`¥20`]],total:`md 写“合计约 ¥350”（按表逐项加：舵机按单价 ×16 是 ¥367；按 ¥12 总价是 ¥187——md 没说清 ¥12 是单价还是总价）`},servoCost:{src:`README §2 三档方案选型`,rows:[[`方案 A`,`~60 元`],[`方案 B`,`~150 元`],[`方案 C`,`~250 元`]]},batches:{src:`采购清单-零基础`,rows:[[`第一批`,`立创·实战派 ESP32-S3 开发板 ×1`,`¥148`],[`第二批`,`PCA9685 ×1`,`¥12~25`],[`第二批`,`MG90S ×4`,`¥5~8/个`],[`第二批`,`5V 6A 电源适配器`,`¥20~30`],[`第二批`,`DC 母头转接线`,`¥3`],[`第二批`,`杜邦线一套`,`¥6`],[`第二批`,`小号十字螺丝刀`,`¥5`],[`第三批`,`MG90S 再买 12 个`,`¥60~95`],[`第三批`,`PLA 耗材 1kg`,`¥50`],[`第三批`,`220µF 电解电容 ×4`,`¥3`],[`第三批`,`扎带 / 双面胶 / 热熔胶枪`,`¥20`],[`无线化`,`最小 ESP32-S3 开发板（DevKitC-1 或兼容）`,`¥25~35`],[`无线化`,`2S 锂聚合物电池 7.4V 2000mAh（带保护板）`,`¥35~50`],[`无线化`,`XL4015 降压模块`,`¥8`],[`无线化`,`2S USB-C 平衡充`,`¥15`],[`无线化`,`电池低压检测`,`¥5`]]}};function k(n){let r=[],i=n=>{let[r,i]=n.split(`.`);return(r===`J1`?e:t)?.[i-1]||n};for(let e of n.wires)for(let[t,n]of[[e.a,e.b],[e.b,e.a]])t[0]===`ESP`&&r.push({pin:t[1],gpio:i(t[1]),to:`${n[0]} ${n[1]}`,why:e.why,md:e.md});return r.sort((e,t)=>e.pin.localeCompare(t.pin,`en`,{numeric:!0}))}var A=[[`主控`,`md 写“ESP32-S3 N16R8 开发板”（README）/“最小 ESP32-S3 板，如 DevKitC-1”（无线架构 §8）。台面摆的是 DevKitC-1 外形（程序生成，尺寸按乐鑫资料 63×25.4 mm 左右），上面的 WROOM-1 模组是库里的真实 CAD。`,`估算`],[`INMP441 / OLED / XL4015 / 2S 电池`,`库里没有这些模块的 CAD，按常见模块尺寸程序生成（INMP441 约 14×14 mm、0.96" OLED 约 27×27 mm、XL4015 约 51×26 mm、2S 2000 mAh 约 70×34×18 mm）。`,`估算`],[`PCA9685 / MAX98357A / 喇叭 / MG90S / 220µF`,`用库里的真实 CAD：PCA9685 用 Adafruit 815、功放用 Adafruit 3006、喇叭用 Adafruit 3923（8 Ω 1 W 椭圆，md 写 8 Ω 2 W，最接近的真实件）、舵机用 Adafruit 1143（MG90S 同尺寸金属齿微型舵机）、电容用 KiCad Φ6.3 mm 电解。`,`最接近的真实件`],[`降压模块`,`md 写一块 XL4015 同时出 6 V 和 5 V——一块 XL4015 只有一路输出。台面放了两块（6 V 给舵机、5 V 给 ESP32）。另外 XL4015 标称输入 8–36 V，2S 电池满电 8.4 V、标称 7.4 V，大部分时间低于下限：现实里建议换低压差的降压（文档未写型号）。`,`补充`],[`机身`,`md 只写“躯干约 10 cm、触手 7–9 cm”，没有结构图。骨架（底板 + 立柱 + 上层板）和触手是本项目按这个尺寸设计的，全部估算。`,`估算`],[`方案 B 结构`,`md 只写“每条 2 个舵机（偏航 + 俯仰）”。台面把俯仰舵机侧躺装在偏航舵盘的支架上——这样 10 cm 躯干上相邻俯仰舵机只剩约 5° 的相对摆动空间（估算），按 md 默认 38° 摆幅会互相顶住。现实里需要更大的躯干或更小的摆幅。`,`估算`],[`导线`,`按引脚连接；长度按走线计（真实杜邦线 20/30 cm，多出来的要扎好）。舵机线 25 cm 盘在机身里。电容只摆在舵机旁，没画到每个舵机的导线（示意）。`,`示意`],[`固件`,`md 的 C++ 逐行移植成 JS，FreeRTOS 任务换成协程；I2C 写进一个寄存器级的 PCA9685 替身（MODE1 / PRESCALE / LEDn）。“全部原样”时行为和 md 代码一致（包括 bug），“修正”逐项可开关。`,`仿真`],[`语音 / 大模型 / 无线`,`小智的语音、云端大模型、WiFi、BLE / 蓝牙串口都是模拟：对话框用关键词规则把一句中文翻成 MCP 调用或串口指令。`,`模拟`],[`运动`,`舵机按脉宽→角度、限速、机械止位、堵转电流估算；桌面爬行用二维库仑摩擦估算，3D 机身不跟着走（看俯视轨迹）。`,`估算`],[`电`,`电池内阻、降压压差、ESP32 欠压复位门限（4.3 V）、舵机电流都是估算，不是 SPICE。`,`估算`]],j=[[`方案 A = 8 个舵机、每条只有偏航`,`README §2 三档方案选型`],[`方案 B = 16 个舵机、偏航 + 俯仰`,`README §2 / §3`],[`ESP32-S3 主控`,`README §3；无线架构 §8（最小板 DevKitC-1）`],[`INMP441 / MAX98357A / 喇叭 / OLED`,`README §3；采购清单 第一批（实战派板载）`],[`PCA9685 一块`,`README §2（A/B 都是 1 块）、§3`],[`MG90S 金属齿`,`README §3（别用 SG90）；采购清单 第二批 选购要点`],[`2S 7.4 V 电池 → XL4015 → 6 V 舵机 / 5 V ESP32`,`README §4；无线架构 §6`],[`第二块降压（5 V）`,`补充（md 只写一块）`],[`220µF 每个舵机旁一个`,`README §4 电源三原则 3`],[`GPIO 8/9 = I2C SDA/SCL，PCA9685 + OLED 同一条总线`,`README §4；body_firmware_A.ino I2C_SDA / I2C_SCL`],[`GPIO 5/4/6 → INMP441 SCK/WS/SD`,`README §4`],[`GPIO 15/16/7 → MAX98357A BCLK/LRC/DIN`,`README §4`],[`3V3 → PCA9685 VCC（只给逻辑）`,`README §4`],[`舵机 V+ 只走 PCA9685 螺丝端子、全部共地`,`README §4 电源三原则 1、2`],[`通道映射 kSingle8 = 第 n 条触手 → CHn；kDual16 = 2n / 2n+1`,`octopus_body.h ChannelOf()`],[`0 号触手在正前方，顺时针排布（每 45°）`,`octopus_gait.h MountAngle() 注释`],[`步态起点 0.6 Hz / 38° / duty 0.65 / phase 45°`,`README §7；octopus_gait.h GaitParams`],[`串口指令 GO / LEFT / RIGHT / STOP / HOME / WAVE n / PULSE n / GAIT`,`body_firmware_A.ino handleCommand()；手机控制指南 §4`],[`MCP 工具 self.octopus.action / set_gait`,`octopus_mcp.cpp`],[`50 Hz PWM、SoftHome 分时上电`,`README §8；octopus_bus.h / octopus_body.h`],[`低压截止 6.4 V`,`无线架构 §6；采购清单 无线化追加清单`],[`15 s 没指令自动停（AUTO_REST）`,`body_firmware_A.ino`],[`阶段 0–5`,`README §7 推进顺序`],[`故障场景`,`采购清单 故障表；README §8；补充项标“补充”`],[`麦克风和喇叭 ≥ 5 cm`,`README §8`]],M={QTPY:`QT Py ESP32‑S3（Adafruit 5426）`,BAT:`1200 mAh 单节 LiPo（Adafruit 258）`,CHG:`USB‑C LiPo 充电板（Adafruit 4410）`,BST1:`MiniBoost 5 V #1（Adafruit 4654）`,BST2:`MiniBoost 5 V #2（Adafruit 4654）`,SW:`拨动开关（Adafruit 805）`,DIV:`1S 分压板 100k/100k（我的补充，程序生成）`,CAP1:`电解电容（升压 1 输出，KiCad 封装）`,CAP2:`电解电容（升压 2 输出，KiCad 封装）`};function N(e,t){let n=e.bench,r=[];if(t){let e=new Map;for(let n of t.parts.values()){let t=n.def,r=t.id;e.has(r)||e.set(r,{id:r,zh:t.name_zh||t.name,n:0,real:!/^p-/.test(r),dims:t.dims_mm,src:t.dims_src||``,licence:t.licence||``}),e.get(r).n++}r.push(...e.values());let n=new Map;for(let e of t.cables)n.set(e.kind,(n.get(e.kind)||0)+1);for(let[e,t]of n)r.push({id:e,zh:{"octo-dupont-20":`杜邦线 20 cm`,"octo-dupont-30":`杜邦线 30 cm`,"octo-wire":`电源线（估算 20 AWG）`,"octo-servo":`舵机引线（MG90S 自带 25 cm，估算）`}[e]||e,n:t,real:!1,cable:!0})}else{let t={ESP:`ESP32‑S3‑DevKitC‑1（程序生成，估算）`,PCA:`PCA9685 16 路（Adafruit 815 CAD）`,MIC:`INMP441（程序生成，估算）`,AMP:`MAX98357A（Adafruit 3006 CAD）`,SPK:`喇叭（Adafruit 3923 CAD）`,BAT:`2S 7.4 V 锂电池（程序生成，估算）`,U1:`XL4015 降压 6 V（程序生成，估算）`,U2:`XL4015 降压 5 V（补充，程序生成）`,OLED:`0.96" OLED（程序生成，估算）`};e.o.variant===`plus`&&Object.assign(t,{BAT:`3S 锂电组 11.1 V（我的补充，程序生成，估算）`,U2:`XL4015 降压 5 V（我的补充，程序生成）`,DIV:`电池分压 100k/22k → GPIO10（我的补充）`});let i=e.o.variant===`v10`;i&&Object.assign(t,M);for(let e of n.roles)r.push({id:e,zh:t[e]||e,n:1,real:i?e!==`DIV`:[`PCA`,`AMP`,`SPK`].includes(e)});n.servos.length&&r.push(i?{id:`ada-2201`,zh:`SG51R 微型舵机（Adafruit 2201，按页面尺寸建模）`,n:n.servos.length,real:!0}:{id:`ada-1143`,zh:`MG90S 舵机（Adafruit 1143 CAD）`,n:n.servos.length,real:!0}),n.caps&&r.push({id:`cap`,zh:`220µF 电解电容（KiCad CAD）`,n:n.caps,real:!0})}return{title:e.o.variant===`v10`?`小智八爪鱼 v10 紧凑无线版（我的补充）`:`小智八爪鱼 方案${n.plan}${e.o.variant===`plus`?` · 完善版（我的补充）`:``}`,plan:n.plan,variant:e.o.variant||`md`,phase:n.phase,phaseZh:h.find(e=>e.k===n.phase)?.zh,fault:u.find(e=>e.k===n.fault)?.zh,fixes:o.filter(t=>e.o.F[t.k]).map(e=>e.zh),mode:e.o.mode,created:new Date().toISOString(),bom:r,wires:n.wires.map(e=>({a:e.a.join(` `),b:e.b.join(` `),why:e.why,md:e.md,kind:e.kind})),pinmap:e.o.variant===`v10`?[]:k(n),servos:n.servos}}export{j as a,b as c,A as i,D as n,N as o,E as r,_ as s,O as t};