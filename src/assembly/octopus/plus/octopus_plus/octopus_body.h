#pragma once
// OctopusBody（完善版）：步态发生器 + 舵机总线 + 50 Hz 运动任务。基于 md 的 octopus_body.h，改动处标「我的补充」。
//
// 我的补充：所有指令（走 / 停 / 挥手 / 回中位 / 调参）都通过 FreeRTOS 队列交给运动任务，
// 只有运动任务写舵机，loop()、BLE 回调、MCP 回调都不再直接动 bank_（md 里存在两边同时写的竞争）。

#include <cmath>
#include <cstdint>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/queue.h"
#include "esp_log.h"

#include "octopus_gait.h"
#include "octopus_bus.h"
// v13 我的补充：台面步态编辑器导出的自定义步态表（有这个文件就用它，没有就是默认步态）
#if defined(__has_include)
#if __has_include("octopus_gait_custom.h")
#include "octopus_gait_custom.h"
#endif
// v14 我的补充：台面闭环面板导出的增益（有这个文件 → 打开 IMU + 闭环倾斜 / 航向 PD）
#if __has_include("octopus_ctrl_custom.h")
#include "octopus_ctrl_custom.h"
#endif
#endif
#ifdef OCTO_CTRL_CUSTOM
#include "octopus_ctrl.h"
#endif

namespace octo {

enum class RigType {
    kSingle8,   // 方案 A：8 路，每条触手 1 个偏航舵机
    kDual16,    // 方案 B：16 路，每条触手 偏航 + 俯仰
    kTendon24,  // md 方案 C（完善版未改动、未验证）
};

inline int ChannelsFor(RigType rig) {
    switch (rig) {
        case RigType::kSingle8:  return 8;
        case RigType::kDual16:   return 16;
        case RigType::kTendon24: return 24;
    }
    return 8;
}

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
#ifdef OCTO_CTRL_CUSTOM
    // v14：IMU 读数回调（在运动任务里、每 20 ms 调一次）；读不到返回 false → 这一拍开环
    using ImuReadFn = bool (*)(void* ctx, ImuSample& out);
    void SetImu(ImuReadFn fn, void* ctx) { imu_fn_ = fn; imu_ctx_ = ctx; }
#endif
    static constexpr const char* kTag = "OctopusBody";

    // 我的补充：相邻触手机械间隙（°，按 3D 结构估算，需实物验证）
    static constexpr float kMinGapA = 12.0f;
    static constexpr float kMinGapB = 16.0f;
#if OCTO_V10
    // 我的补充 · v10：舵机橙线接的 QT Py 焊盘 A0 A1 A2 SDA SCL TX RX SCK → GPIO（Adafruit 5426 引脚图）
    static constexpr uint8_t kV10Pins[8] = {18, 17, 9, 7, 6, 5, 16, 36};
    // v10 短触手：2D 轮廓扫 ±55°，夹角 < −35° 才碰；+5° 余量 = −30（限位内等于不需要防撞）
    static constexpr float kMinGapV10 = -30.0f;
#endif

    ~OctopusBody() { Stop(); }

    bool Init(RigType rig, void* i2c_ctx, Pca9685::WriteFn write_fn) {
        rig_ = rig;
        channels_ = ChannelsFor(rig);
        board_count_ = (channels_ + 15) / 16;

#if OCTO_V10
        (void)i2c_ctx; (void)write_fn;
        board_count_ = 1;
        if (!boards_[0].Init(kV10Pins, 8)) { ESP_LOGE(kTag, "ledcAttach failed"); return false; }
#else
        for (int i = 0; i < board_count_; i++) {
            boards_[i] = Pca9685(static_cast<uint8_t>(Pca9685::kBaseAddr + i));
            if (!boards_[i].Init(i2c_ctx, write_fn, 50.0f)) {
                ESP_LOGE(kTag, "PCA9685 #%d (0x%02X) init failed", i, Pca9685::kBaseAddr + i);
                return false;
            }
        }
#endif

        bank_.Bind(boards_, board_count_);
        bank_.Begin(channels_, kHome);
#ifdef OCTO_SERVO_RATE_DPS
        bank_.SetMaxRate(OCTO_SERVO_RATE_DPS);  // v15：步态头文件里给的上限（例如 240 °/s = 80%）
#else
        bank_.SetMaxRate(300.0f);
#endif
        // 我的补充：每路软件限位 90°±55°（md §8 提到 SetLimit 但代码没调用）
        for (int i = 0; i < channels_; i++) bank_.SetLimit(i, kHome - 55.0f, kHome + 55.0f);

        // 我的补充：完善版默认步态（估算，台面里调出来的）
        GaitParams p;
        if (rig_ == RigType::kDual16) {
            p.freq_hz = 0.6f; p.yaw_amp_deg = 20.0f; p.lift_amp_deg = 25.0f; p.phase_deg = 180.0f; p.duty = 0.55f; p.press_deg = 20.0f;  // v9：两组交替 + 支撑相下压（物理仿真实测，我的补充）
        } else {
            p.freq_hz = 0.6f; p.yaw_amp_deg = 30.0f; p.lift_amp_deg = 20.0f; p.phase_deg = 45.0f; p.duty = 0.6f;
        }
        gait_.SetParams(p);
        gait_.SetSpinTurn(rig_ == RigType::kDual16);

        queue_ = xQueueCreate(8, sizeof(Cmd));
        return queue_ != nullptr;
    }

    // 我的补充：真正逐路上电。每路直接写到中位并 Arm，路与路之间隔 150 ms（舵机上电位置未知，只能错开）。
    // 只在 Start() 之前调用；运动任务跑起来之后用 Home()。
    void SoftHomeBlocking() {
        for (int i = 0; i < channels_; i++) {
            bank_.SetTarget(i, kHome);
            bank_.ArmNow(i);
            vTaskDelay(pdMS_TO_TICKS(150));
        }
    }

    void Start() {
        if (task_) return;
        running_ = true;
        xTaskCreatePinnedToCore(&OctopusBody::TaskEntry, "octo_motion", 4096, this, 6, &task_, 0);
    }

    void Stop() {
        if (!task_) return;
        running_ = false;
        vTaskDelay(pdMS_TO_TICKS(100));   // 任务自己退出并删除
        task_ = nullptr;
    }

    // ---------- 运动指令（线程安全：只入队） ----------
    void SetVelocity(float throttle, float steer, int cycles = 0) { Post({CmdType::kGait, throttle, steer, cycles, {}}); }
    void Rest()                 { Post({CmdType::kRest, 0, 0, 0, {}}); }
    // 我的补充 · v10 低电：不回中位，立刻停 PWM（舵机放松、不再耗电）。回中位时 8 个舵机一起动的电流会把快没电的单节电池拉到 QT Py 欠压复位（仿真估算）
    void RelaxNow()             { Post({CmdType::kRelax, 0, 0, 0, {}}); }
    void Home()                 { Post({CmdType::kHome, 0, 0, 0, {}}); }
    void WaveOnce(int arm)      { Post({CmdType::kWave, 0, 0, arm, {}}); }
    void Pulse(int times)       { Post({CmdType::kPulse, 0, 0, times, {}}); }
    void SetGaitParams(const GaitParams& p) { Post({CmdType::kParams, 0, 0, 0, p}); }

    // 读快照只读 Params()，不写（float 读写在 ESP32 上是原子的）
    GaitParams GaitParamsSnapshot() const { return gait_.Params(); }

    RigType Rig() const { return rig_; }
    int Channels() const { return channels_; }
    bool Relaxed() const { return bank_.Relaxed(); }

private:
    enum class Mode { kIdle, kGait, kWave, kPulse, kHoming };
    enum class CmdType { kGait, kRest, kHome, kWave, kPulse, kParams, kRelax };
    struct Cmd {
        CmdType type;
        float throttle;
        float steer;
        int n;            // gait：周期数（0 = 不限）；wave：触手号；pulse：次数
        GaitParams params;
    };

    static constexpr float kHome = 90.0f;

    void Post(const Cmd& c) { if (queue_) xQueueSend(queue_, &c, pdMS_TO_TICKS(20)); }

    static void TaskEntry(void* arg) { static_cast<OctopusBody*>(arg)->TaskLoop(); }

    void TaskLoop() {
        const TickType_t period = pdMS_TO_TICKS(20);  // 50 Hz
        TickType_t last = xTaskGetTickCount();
        while (running_) {
            Cmd c;
            while (xQueueReceive(queue_, &c, 0) == pdTRUE) Apply(c);
            Step(0.02f);
            vTaskDelayUntil(&last, period);
        }
        bank_.ReleaseAll();
        vTaskDelete(nullptr);
    }

    void Apply(const Cmd& c) {
        switch (c.type) {
            case CmdType::kGait:
                gait_.SetThrottle(c.throttle);
                gait_.SetSteer(c.steer);
                cycles_left_ = c.n;
                cycle_mark_ = gait_.Cycles();
                if (mode_ != Mode::kGait) {
                    custom_t_ = 0.0f;  // v13：自定义步态从 t = 0 开始
#ifdef OCTO_CTRL_CUSTOM
                    ctrl_.Reset();     // v14：航向目标 = 起步时的朝向
#endif
                }
                Enter(Mode::kGait);
                break;
            case CmdType::kRest:
                Enter(Mode::kIdle);
                want_relax_ = true;
                bank_.ReleaseAll();               // 我的补充：只改目标，由限速慢慢回中位
                break;
            case CmdType::kRelax:
                Enter(Mode::kIdle);
                want_relax_ = false;
                bank_.Relax();                     // 我的补充：立刻 FULL OFF / 占空比 0
                break;
            case CmdType::kHome:
                Enter(Mode::kHoming);              // 我的补充：先停步态，再一路一路回中位
                home_idx_ = 0;
                home_timer_ = 0.0f;
                break;
            case CmdType::kWave:
                gait_.Reset();
                wave_arm_ = ((c.n % kArmCount) + kArmCount) % kArmCount;
                wave_timer_ = 0.0f;
                Enter(Mode::kWave);
                break;
            case CmdType::kPulse:
                pulse_left_ = c.n < 1 ? 1 : c.n;
                pulse_timer_ = 0.0f;
                Enter(Mode::kPulse);
                break;
            case CmdType::kParams:
                gait_.SetParams(c.params);
                break;
        }
    }

    void Enter(Mode m) {
        mode_ = m;
        if (m != Mode::kIdle) { want_relax_ = false; idle_t_ = 0.0f; bank_.Wake(); }
    }

    void Step(float dt) {
        switch (mode_) {
            case Mode::kGait:   StepGait(dt);   break;
            case Mode::kWave:   StepWave(dt);   break;
            case Mode::kPulse:  StepPulse(dt);  break;
            case Mode::kHoming: StepHoming(dt); break;
            case Mode::kIdle:
            default:            StepIdle();     break;
        }
        RelaxCheck(dt);
        bank_.Tick(dt);
    }

    // 我的补充：Rest 之后全部到位、静止 1 s → FULL OFF
    void RelaxCheck(float dt) {
        if (mode_ != Mode::kIdle || !want_relax_ || bank_.Relaxed()) { idle_t_ = 0.0f; return; }
        idle_t_ = bank_.Settled() ? idle_t_ + dt : 0.0f;
        if (idle_t_ >= 1.0f) { bank_.Relax(); ESP_LOGI(kTag, "relaxed (FULL OFF)"); }
    }

    void WriteArm(int arm, float yaw_deg, float lift_deg) {
        arm %= kArmCount;
        if (rig_ == RigType::kSingle8) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), kHome + yaw_deg);
        } else if (rig_ == RigType::kDual16) {
            bank_.SetTarget(ChannelOf(rig_, arm, 0), kHome + yaw_deg);
            bank_.SetTarget(ChannelOf(rig_, arm, 1), kHome + lift_deg);
        } else {
            float phi = yaw_deg * static_cast<float>(M_PI) / 180.0f;
            float curve = 0.25f + lift_deg / 90.0f;
            for (int j = 0; j < 3; j++) {
                float theta = 2.0f * static_cast<float>(M_PI) * j / 3.0f;
                bank_.SetTarget(ChannelOf(rig_, arm, j), kHome + std::cos(phi - theta) * curve * 30.0f);
            }
        }
    }

    void StepGait(float dt) {
        gait_.Tick(dt);
        // 我的补充：MCP steps → 走够周期数自动 Rest
        if (cycles_left_ > 0 && gait_.Cycles() - cycle_mark_ >= static_cast<uint32_t>(cycles_left_)) {
            cycles_left_ = 0;
            Apply({CmdType::kRest, 0, 0, 0, {}});
            return;
        }
        float yaw[kArmCount];
        float sc[kArmCount], off[kArmCount];
        for (int a = 0; a < kArmCount; a++) { sc[a] = 1.0f; off[a] = 0.0f; }
#ifdef OCTO_CTRL_CUSTOM
        {   // v14：闭环（和台面 JS 孪生同式）
            ImuSample s;
            if (imu_fn_ && imu_fn_(imu_ctx_, s)) {
                const TiltController::Out o = ctrl_.Step(s, dt);
                for (int a = 0; a < kArmCount; a++) { sc[a] = o.sc[a]; off[a] = o.off[a]; }
            }
        }
#endif
#ifdef OCTO_GAIT_CUSTOM
        custom_t_ += dt;
        for (int a = 0; a < kArmCount; a++) yaw[a] = custom_gait::Yaw(a, custom_t_, gait_.CustomScale(a) * sc[a]) + off[a];
#else
        for (int a = 0; a < kArmCount; a++) yaw[a] = gait_.Yaw(a) * sc[a] + off[a];
#endif
        // 我的补充：邻臂防撞
#if OCTO_V10
        AntiCollide(yaw, kMinGapV10);
#else
        AntiCollide(yaw, (rig_ == RigType::kDual16 ? kMinGapB : kMinGapA) + 3.0f);
#endif
        for (int a = 0; a < kArmCount; a++) WriteArm(a, yaw[a], gait_.Lift(a));
    }

    void StepWave(float dt) {
        wave_timer_ += dt;
        const float dur = 1.2f;
        if (wave_timer_ >= dur) { mode_ = Mode::kIdle; return; }
        float k = wave_timer_ / dur;
        float env = std::sin(k * static_cast<float>(M_PI));
        for (int a = 0; a < kArmCount; a++) {
            if (rig_ == RigType::kSingle8) {
                // 我的补充：8 舵机版用偏航来回摆表示挥手
                WriteArm(a, a == wave_arm_ ? env * 40.0f * std::sin(k * 6.0f * static_cast<float>(M_PI)) : 0.0f, 0.0f);
            } else {
                WriteArm(a, 0.0f, a == wave_arm_ ? env * 45.0f : 0.0f);
            }
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
        for (int a = 0; a < kArmCount; a++) {
            if (rig_ == RigType::kSingle8) WriteArm(a, (a % 2 ? 1.0f : -1.0f) * curl * 0.6f, 0.0f);  // 我的补充
            else WriteArm(a, 0.0f, curl);
        }
    }

    // 我的补充：运动任务里的逐路回中位（每 150 ms 一路）
    void StepHoming(float dt) {
        gait_.Reset();
        home_timer_ -= dt;
        if (home_timer_ > 0.0f) return;
        if (home_idx_ >= channels_) { mode_ = Mode::kIdle; return; }
        bank_.SetTarget(home_idx_++, kHome);
        home_timer_ = 0.15f;
    }

    void StepIdle() {
        gait_.Reset();
        for (int a = 0; a < kArmCount; a++) WriteArm(a, 0.0f, 0.0f);
    }

    RigType rig_ = RigType::kSingle8;
    int channels_ = 8;
    int board_count_ = 1;

    BankBoard boards_[3];     // 需要 Pca9685 默认构造（我的补充）
    ServoBank bank_;
    Gait gait_;

    QueueHandle_t queue_ = nullptr;
    Mode mode_ = Mode::kIdle;
    TaskHandle_t task_ = nullptr;
    volatile bool running_ = false;

    bool want_relax_ = false;
    float idle_t_ = 0.0f;
    float custom_t_ = 0.0f;  // v13：自定义步态的时间（秒）
#ifdef OCTO_CTRL_CUSTOM
    TiltController ctrl_;           // v14
    ImuReadFn imu_fn_ = nullptr;
    void* imu_ctx_ = nullptr;
#endif
    int cycles_left_ = 0;
    uint32_t cycle_mark_ = 0;
    int home_idx_ = 0;
    float home_timer_ = 0.0f;
    int wave_arm_ = 0;
    float wave_timer_ = 0.0f;
    int pulse_left_ = 0;
    float pulse_period_ = 0.6f;
    float pulse_timer_ = 0.0f;
};

}  // namespace octo
