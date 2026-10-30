#pragma once
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
