#pragma once
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
