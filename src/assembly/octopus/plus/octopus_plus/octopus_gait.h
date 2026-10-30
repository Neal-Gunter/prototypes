#pragma once
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
    float yaw_amp_deg   = 30.0f;  // 我的补充：A 默认 30°（md 38°）；B 由 OctopusBody 改成 15°（防碰撞，估算）
    float lift_amp_deg  = 20.0f;
    float phase_deg     = 45.0f;  // 0=同步划水 45=环形波 180=交替
    float duty          = 0.6f;   // 我的补充：A 0.6 / B 0.5（md 0.65）
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
        if (p < d) return 0.0f;
        float k = (p - d) / (1.0f - d);
        return std::sin(k * static_cast<float>(M_PI)) * params_.lift_amp_deg;
    }

    bool IsPowerStroke(int arm) const { return Phase01(arm) < params_.duty; }

    // 0 号在正前方，顺时针排布（md）
    static float MountAngle(int arm) { return -90.0f + arm * 45.0f; }

    // 我的补充：左右舷 = cos(安装角)：右舷 > 0，左舷 < 0，正前 / 正后 = 0
    static float Side(int arm) {
        return std::cos(MountAngle(arm) * static_cast<float>(M_PI) / 180.0f);
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
// 小于 gmin（机械间隙 + 3° 余量；A 12°、B 40°，按 3D 结构估算）就两边各退一半，迭代收敛。
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
