#pragma once
// v14 我的补充：MPU-6050 六轴 IMU（I²C 地址 0x68，直接读寄存器，不需要额外的库）。
// 寄存器按 InvenSense MPU-6000/6050 Register Map（RM-MPU-6000A-00）：
//   0x6B PWR_MGMT_1（写 0x01 = 唤醒 + 用 X 轴陀螺做时钟）、0x1A CONFIG（DLPF = 3 → 约 44 Hz）、
//   0x1B GYRO_CONFIG（0x08 = ±500 °/s，65.5 LSB/(°/s)）、0x1C ACCEL_CONFIG（0x00 = ±2 g，16384 LSB/g）、
//   0x3B 起 14 字节 = ACCEL_XOUT_H … GYRO_ZOUT_L、0x75 WHO_AM_I（应读到 0x68）。
// v10：接在 QT Py 的 STEMMA QT 口（Wire1，SDA 41 / SCL 40）；完善版接在和 PCA9685 同一条 Wire 上。
// 上电静止 1 s 求陀螺零偏。安装方向：X 指向机身前方、Z 向上（我的补充）。
#include <Arduino.h>
#include <Wire.h>
#include "octopus_ctrl.h"

namespace octo {

class Mpu6050 {
public:
    bool Begin(TwoWire* w, uint8_t addr = 0x68) {
        w_ = w; addr_ = addr;
        uint8_t who = 0;
        if (!Read(0x75, &who, 1) || (who & 0x7E) != 0x68) { ok_ = false; return false; }
        ok_ = Write(0x6B, 0x01) && Write(0x1A, 0x03) && Write(0x1B, 0x08) && Write(0x1C, 0x00);
        delay(50);
        return ok_;
    }
    // 机器人静止时调用：平均 n 次陀螺读数当零偏
    void CalibrateGyro(int n = 200) {
        if (!ok_) return;
        float s[3] = {0, 0, 0}; int got = 0;
        for (int i = 0; i < n; i++) { ImuSample x; if (ReadRaw(x)) { for (int k = 0; k < 3; k++) s[k] += x.gyro[k]; got++; } delay(5); }
        if (got) for (int k = 0; k < 3; k++) bias_[k] = s[k] / got;
    }
    bool Read(ImuSample& out) {
        if (!ok_ || !ReadRaw(out)) return false;
        for (int k = 0; k < 3; k++) out.gyro[k] -= bias_[k];
        return true;
    }
    bool Ok() const { return ok_; }

private:
    bool ReadRaw(ImuSample& out) {
        uint8_t b[14];
        if (!Read(0x3B, b, 14)) return false;
        auto v = [&](int i) { return static_cast<int16_t>((b[i] << 8) | b[i + 1]); };
        for (int k = 0; k < 3; k++) { out.acc[k] = v(2 * k) / 16384.0f; out.gyro[k] = v(8 + 2 * k) / 65.5f; }
        return true;
    }
    bool Write(uint8_t reg, uint8_t val) { w_->beginTransmission(addr_); w_->write(reg); w_->write(val); return w_->endTransmission() == 0; }
    bool Read(uint8_t reg, uint8_t* dst, size_t n) {
        w_->beginTransmission(addr_); w_->write(reg);
        if (w_->endTransmission(false) != 0) return false;
        if (w_->requestFrom(static_cast<int>(addr_), static_cast<int>(n)) != static_cast<int>(n)) return false;
        for (size_t i = 0; i < n; i++) dst[i] = w_->read();
        return true;
    }
    TwoWire* w_ = nullptr; uint8_t addr_ = 0x68; bool ok_ = false; float bias_[3] = {0, 0, 0};
};

}  // namespace octo
