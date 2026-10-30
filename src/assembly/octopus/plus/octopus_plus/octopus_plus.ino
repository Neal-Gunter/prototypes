/*
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

// v16 我的补充：BLE 默认 MTU 23 → 每次 notify 最多 20 字节，长行分段发，主机按 '\n' 拼回整行
void bleSend(const char* p, size_t n) {
  if (!bleConnected || !txChar) return;
  for (size_t i = 0; i < n; i += 20) {
    const size_t k = (n - i) < 20 ? (n - i) : 20;
    txChar->setValue((uint8_t*)(p + i), k);
    txChar->notify();
  }
}

void sendLine(const char* line, size_t n) {   // v16：协议帧（已带 '\n'）
  Serial.write(reinterpret_cast<const uint8_t*>(line), n);
  bleSend(line, n);
}

void reply(const String& s) {
  Serial.println(s);
  String t = s + "\n";   // v16：BLE 也补换行，分段后主机才能断行
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
      if (ch == '\n' || ch == '\r') { push(); }
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
    if (c == '\n' || c == '\r') { if (usbLine.length()) { handleLine(usbLine.c_str()); usbLine = ""; } }
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
