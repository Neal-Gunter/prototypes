#pragma once
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
