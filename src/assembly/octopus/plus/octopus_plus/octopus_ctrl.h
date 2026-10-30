#pragma once
// v14 我的补充：闭环倾斜 / 航向 PD（和台面 src/gait/ctrl.js 的 TiltCtrl + octoCorrections 同一套算式）。
// 只在有 octopus_ctrl_custom.h（台面导出的增益）时编进固件；没有 IMU 样本 → 输出“不修正”（= 开环）。
// 坐标：传感器 X = 机身前方、Y = 左、Z = 上（MPU-6050 安装方向是我的补充）。仿真整定，未上实机。
#include <cmath>
#include "octopus_gait.h"

namespace octo {

struct ImuSample { float acc[3]; float gyro[3]; };   // acc：g；gyro：°/s

class TiltController {
public:
    struct Out { float sc[kArmCount]; float off[kArmCount]; float u; float roll_deg; bool slope_mode; };

    void Reset() { init_ = false; yaw0_set_ = false; slope_mode_ = false; prev_ok_ = false; yaw_ = 0.0f; }

    // dt 秒；返回每条触手的摆幅倍数 sc（只减不增）和偏航偏置 off（°）
    Out Step(const ImuSample& s, float dt) {
        using namespace ctrl_cfg;
        const float k = static_cast<float>(M_PI) / 180.0f;
        const float rA = std::atan2(s.acc[1], s.acc[2]);
        const float pA = std::atan2(-s.acc[0], std::sqrt(s.acc[1] * s.acc[1] + s.acc[2] * s.acc[2]));
        if (!init_) { roll_ = rA; pitch_ = pA; init_ = true; }
        else {
            roll_ = kAlpha * (roll_ + s.gyro[0] * k * dt) + (1.0f - kAlpha) * rA;
            pitch_ = kAlpha * (pitch_ + s.gyro[1] * k * dt) + (1.0f - kAlpha) * pA;
        }
        yaw_ += s.gyro[2] * k * dt;
        if (!yaw0_set_) { yaw0_ = yaw_; yaw0_set_ = true; }
        const float eH = yaw0_ - yaw_;   // 机身右转 → yaw 变小 → eH > 0 → 往左修
        float u = Clamp(kKpH * eH / k - kKdH * s.gyro[2], -kUMax, kUMax);
        // 坡道换号（仿真经验规则，估算）：横滚超过 kSlopeFlipDeg 时转向符号取反（滞回 0.6 倍）
        const float roll_deg = std::fabs(roll_ / k);
        if (kSlopeFlipDeg > 0.0f) {
            slope_mode_ = slope_mode_ ? roll_deg > kSlopeFlipDeg * 0.6f : roll_deg > kSlopeFlipDeg;
            if (slope_mode_) u = -u;
        }
        // 世界“上”方向在传感器系里（小角度）；下坡方向 = −up 的水平分量
        const float up0 = -std::sin(pitch_), up1 = std::sin(roll_) * std::cos(pitch_);
        const float dUp0 = prev_ok_ ? (up0 - prev_up_[0]) / dt : 0.0f, dUp1 = prev_ok_ ? (up1 - prev_up_[1]) / dt : 0.0f;
        prev_up_[0] = up0; prev_up_[1] = up1; prev_ok_ = true;
        Out o{};
        o.u = u; o.roll_deg = roll_ / k; o.slope_mode = slope_mode_;
        for (int a = 0; a < kArmCount; a++) {
            const float th = Gait::MountAngle(a) * k, c = std::cos(th);
            const float sg = c > 1e-3f ? 1.0f : (c < -1e-3f ? -1.0f : 0.0f);
            o.sc[a] = Clamp(1.0f + std::fmin(0.0f, kTurnSign * u * sg), 0.0f, 1.0f);   // 只减不增
            const float tF = -std::cos(th), tL = std::sin(th);                         // 触手切向 → 前 / 左
            const float off = (kKpT * (tF * -up0 + tL * -up1) + kKdT * (tF * -dUp0 + tL * -dUp1)) / k;
            o.off[a] = Clamp(off, -kOffMax, kOffMax);
        }
        return o;
    }

private:
    static float Clamp(float v, float a, float b) { return v < a ? a : (v > b ? b : v); }
    bool init_ = false, yaw0_set_ = false, slope_mode_ = false, prev_ok_ = false;
    float roll_ = 0.0f, pitch_ = 0.0f, yaw_ = 0.0f, yaw0_ = 0.0f, prev_up_[2] = {0.0f, 0.0f};
};

}  // namespace octo
