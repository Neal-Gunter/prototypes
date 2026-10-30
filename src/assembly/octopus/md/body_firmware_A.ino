/*
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
    if (c == '\n' || c == '\r') {
      if (line.length()) { handleCommand(line); line = ""; }
    } else {
      line += c;
    }
  }
  // —— 同时支持 USB 串口调试（没蓝牙时也能用电脑测）——
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
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
