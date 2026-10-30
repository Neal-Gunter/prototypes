#pragma once
// 我的补充：3S 电池电压检测（md 没有这一部分的完整实现）。
//   GPIO10 = ADC1_CH9（ESP32-S3 数据手册；ADC1 不受 WiFi 影响）
//   分压 100 kΩ（上）/ 22 kΩ（下），12.6 V → 2.27 V；ADC 脚对地并 0.1 µF
//   11 dB 衰减，analogReadMilliVolts() 用芯片里的校准值，量程约 0–2900 mV
//   低于 9.6 V（3 × 3.2 V，估算）停运动，回到 10.2 V 才恢复（迟滞，防止反复启停）

#include <Arduino.h>
#ifndef OCTO_V10
#define OCTO_V10 0
#endif

namespace octo {

class Battery {
public:
#if OCTO_V10
    // 我的补充 · v10：1S LiPo，100k / 100k 分压 → A3（GPIO8，ADC1_CH7），4.2 V → 2.1 V。
    // 3.55 V 停运动、3.75 V 恢复（估算）：保护板 3.0 V 才切，但 BAT 焊盘二极管 + LDO 让 QT Py 在电芯带载约 3.4 V 以下掉电复位，所以提前停
    static constexpr int   kPin       = 8;
    static constexpr float kRatio     = 2.0f;
    static constexpr float kCutoff    = 3.55f;
    static constexpr float kResume    = 3.75f;
#else
    static constexpr int   kPin       = 10;
    static constexpr float kRatio     = (100.0f + 22.0f) / 22.0f;
    static constexpr float kCutoff    = 9.6f;
    static constexpr float kResume    = 10.2f;
#endif

    void Begin() {
        pinMode(kPin, INPUT);
        analogSetPinAttenuation(kPin, ADC_11db);
        Update();   // 我的补充：开机先读一次，电池低就从一开始拒绝动作指令
    }

    // 16 次平均，返回电池电压（V）
    float Read() {
        uint32_t mv = 0;
        for (int i = 0; i < 16; i++) mv += analogReadMilliVolts(kPin);
        volts_ = (mv / 16.0f / 1000.0f) * kRatio;
        return volts_;
    }

    // 返回 true 表示状态刚刚变化
    bool Update() {
        float v = Read();
        if (!low_ && v < kCutoff) { low_ = true; return true; }
        if (low_ && v > kResume)  { low_ = false; return true; }
        return false;
    }

    bool Low() const { return low_; }
    float Volts() const { return volts_; }

private:
    bool low_ = false;
    float volts_ = 0.0f;
};

}  // namespace octo
