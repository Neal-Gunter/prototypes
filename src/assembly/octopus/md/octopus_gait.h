#pragma once
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
