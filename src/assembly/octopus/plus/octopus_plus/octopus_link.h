#pragma once
// v16 我的补充：OCTL/1 实物连接协议（台面「实物连接」面板 ↔ 板子，走 USB 串口或 BLE Nordic UART）。
// 帧格式见 octopus_link_core.h；浏览器端是 src/link/protocol.js，两边用同一套测试帧对照（scripts/link-test.mjs）。
//
//   主机 → 板子                         板子 → 主机
//   @s HELLO 1                          @s OK 1 固件 rig 路数 限速 IMU
//   @s PING                             @s OK 运行毫秒
//   @s GO 油门0..1 转向-1..1            @s OK
//   @s STOP        （回中位后放松）      @s NAK 原因码
//   @s ESTOP       （立刻停 PWM，锁住，STOP 才解锁）
//   @s POSE d0 … d(n-1)  （相对中位 °，±55）
//   @s GAIT f yaw lift phase duty press
//   @s TRIM ch 中位 下限 上限   （中位 ±20，下限 −55..0，上限 0..55）
//   @s RATE °/s    （30..240）
//   @s TEL Hz      （0..20，0 = 关）
//   板子主动发（序号 0）：@0 TEL n 运行毫秒 电压 横滚 俯仰 模式 标志 a0 … a(n-1)
//                       @0 EVT 码 [值]（1 心跳超时停下 2 BLE 断开停下 3 低电）   @0 BOOT 1 复位原因
//
// 安全（我的补充）：会话中 1.5 s 收不到任何有效帧 → Rest（回中位）；BLE 断开 → Rest；ESTOP 之后只认 STOP / PING / HELLO / TEL。
// 遥测里的舵机角是固件的指令角（限速之后），普通舵机没有位置反馈，不是实测角。早期原型，没在实物上测过。

#include <Arduino.h>
#include <cstdio>
#include "octopus_link_core.h"
#include "octopus_body.h"
#include "octopus_batt.h"

namespace octo {

class Link {
public:
    using SendFn = void (*)(const char* line, size_t n);
    enum Nak { kFormat = 1, kCrc = 2, kLen = 3, kArgs = 4, kUnknown = 5, kRange = 6, kLowBatt = 7, kVersion = 8, kEstop = 9 };
    static constexpr uint32_t kWatchdogMs = 1500;

    void Begin(OctopusBody* body, Battery* batt, SendFn send, int fw_code) {
        body_ = body; batt_ = batt; send_ = send; fw_ = fw_code;
    }

    // 以 '@' 开头的行都归这里（返回 true）；其他行走老的文本指令
    bool Handle(const char* line, uint32_t now) {
        if (!line || line[0] != '@') return false;
        octl_frame f;
        const int e = octl_parse(line, strlen(line), &f);
        if (e != OCTL_OK) { bad_++; Nak(0, e == OCTL_E_CRC ? kCrc : e == OCTL_E_LEN ? kLen : e == OCTL_E_ARGS ? kArgs : kFormat); return true; }
        last_rx_ = now; session_ = true;
        Dispatch(f, now);
        return true;
    }

    void Tick(uint32_t now) {
        if (session_ && now - last_rx_ > kWatchdogMs) {
            session_ = false; tel_hz_ = 0;
            if (!estop_) body_->Rest();
            Event(1);
        }
        if (tel_hz_ > 0 && now - last_tel_ >= 1000u / static_cast<uint32_t>(tel_hz_)) { last_tel_ = now; SendTel(now); }
    }

    void OnDisconnect() {
        if (!session_) return;
        session_ = false; tel_hz_ = 0;
        if (!estop_) body_->Rest();
        Event(2);
    }

    void Event(int code, float val = NAN) {
        char a[24];
        if (std::isnan(val)) snprintf(a, sizeof(a), "%d", code);
        else snprintf(a, sizeof(a), "%d %.2f", code, static_cast<double>(val));
        Send(0, "EVT", a);
    }

    void Boot(int reason) { char a[16]; snprintf(a, sizeof(a), "1 %d", reason); Send(0, "BOOT", a); }

    bool Session() const { return session_; }
    unsigned BadFrames() const { return bad_; }

private:
    static bool In(double v, double lo, double hi) { return !std::isnan(v) && v >= lo && v <= hi; }

    void Dispatch(const octl_frame& f, uint32_t now) {
        const char* c = f.cmd;
        const unsigned s = f.seq;
        const int n = f.nargs;
        const double* a = f.args;
        if (!strcmp(c, "HELLO")) {
            if (n != 1) return Nak(s, kArgs);
            if (a[0] != OCTL_VERSION) return Nak(s, kVersion);
            float r, p;
            char out[48];
            snprintf(out, sizeof(out), "%d %d %d %d %d %d", OCTL_VERSION, fw_, body_->Channels() == 16 ? 16 : 8, body_->Channels(),
                     static_cast<int>(body_->RateNow()), body_->Tilt(r, p) ? 1 : 0);
            return Send(s, "OK", out);
        }
        if (!strcmp(c, "PING")) { char out[16]; snprintf(out, sizeof(out), "%lu", static_cast<unsigned long>(now)); return Send(s, "OK", out); }
        if (!strcmp(c, "TEL")) {
            if (n != 1) return Nak(s, kArgs);
            if (!In(a[0], 0, 20)) return Nak(s, kRange);
            tel_hz_ = static_cast<int>(a[0]);
            return Ok(s);
        }
        if (!strcmp(c, "STOP")) { estop_ = false; body_->Rest(); return Ok(s); }
        if (!strcmp(c, "ESTOP")) { estop_ = true; body_->RelaxNow(); return Ok(s); }
        if (!strcmp(c, "RATE")) {
            if (n != 1) return Nak(s, kArgs);
            if (!In(a[0], 30, 240)) return Nak(s, kRange);
            body_->SetRate(static_cast<float>(a[0]));
            return Ok(s);
        }
        if (!strcmp(c, "TRIM")) {
            if (n != 4) return Nak(s, kArgs);
            if (!In(a[0], 0, body_->Channels() - 1) || !In(a[1], -20, 20) || !In(a[2], -55, 0) || !In(a[3], 0, 55)) return Nak(s, kRange);
            body_->SetTrimLimit(static_cast<int>(a[0]), static_cast<float>(a[1]), static_cast<float>(a[2]), static_cast<float>(a[3]));
            return Ok(s);
        }
        const bool motion = !strcmp(c, "GO") || !strcmp(c, "POSE") || !strcmp(c, "GAIT");
        if (!motion) return Nak(s, kUnknown);
        if (estop_) return Nak(s, kEstop);
        if (!strcmp(c, "GAIT")) {
            if (n != 6) return Nak(s, kArgs);
            if (!In(a[0], 0.1, 1.2) || !In(a[1], 0, 55) || !In(a[2], 0, 55) || !In(a[3], 0, 360) || !In(a[4], 0.3, 0.9) || !In(a[5], 0, 40)) return Nak(s, kRange);
            GaitParams p = body_->GaitParamsSnapshot();
            p.freq_hz = static_cast<float>(a[0]); p.yaw_amp_deg = static_cast<float>(a[1]); p.lift_amp_deg = static_cast<float>(a[2]);
            p.phase_deg = static_cast<float>(a[3]); p.duty = static_cast<float>(a[4]); p.press_deg = static_cast<float>(a[5]);
            body_->SetGaitParams(p);
            return Ok(s);
        }
        if (batt_->Low()) return Nak(s, kLowBatt);
        if (!strcmp(c, "GO")) {
            if (n != 2) return Nak(s, kArgs);
            if (!In(a[0], 0, 1) || !In(a[1], -1, 1)) return Nak(s, kRange);
            body_->SetVelocity(static_cast<float>(a[0]), static_cast<float>(a[1]));
            return Ok(s);
        }
        // POSE
        if (n != body_->Channels() || n > OctopusBody::kPoseMax) return Nak(s, kArgs);
        float d[OctopusBody::kPoseMax];
        for (int i = 0; i < n; i++) { if (!In(a[i], -55, 55)) return Nak(s, kRange); d[i] = static_cast<float>(a[i]); }
        body_->SetPose(d, n);
        Ok(s);
    }

    void SendTel(uint32_t now) {
        char out[OCTL_MAX_LINE + 8];
        float r = 0, p = 0;
        const bool imu = body_->Tilt(r, p);
        int k = 0;
        const int flags = (body_->Relaxed() ? 1 : 0) | (batt_->Low() ? 2 : 0) | (imu ? 4 : 0) | (estop_ ? 8 : 0);
        char rs[12], ps[12];
        if (imu) { snprintf(rs, sizeof(rs), "%.1f", static_cast<double>(r)); snprintf(ps, sizeof(ps), "%.1f", static_cast<double>(p)); }
        else { rs[0] = '-'; rs[1] = 0; ps[0] = '-'; ps[1] = 0; }
        k = snprintf(out, sizeof(out), "%u %lu %.2f %s %s %d %d", tel_n_, static_cast<unsigned long>(now), static_cast<double>(batt_->Volts()), rs, ps, body_->ModeCode(), flags);
        tel_n_ = (tel_n_ + 1) & 0xFFFF;
        for (int i = 0; i < body_->Channels() && k > 0 && k < static_cast<int>(sizeof(out)) - 8; i++) {
            const int w = snprintf(out + k, sizeof(out) - static_cast<size_t>(k), " %.1f", static_cast<double>(body_->Angle(i)));
            if (w <= 0) break;
            k += w;
        }
        Send(0, "TEL", out);
    }

    void Ok(unsigned s) { Send(s, "OK", nullptr); }
    void Nak(unsigned s, int code) { char a[8]; snprintf(a, sizeof(a), "%d", code); Send(s, "NAK", a); }
    void Send(unsigned s, const char* cmd, const char* args) {
        char line[OCTL_MAX_LINE + 8];
        const size_t n = octl_seal(line, sizeof(line), s, cmd, args);
        if (n && send_) send_(line, n);
    }

    OctopusBody* body_ = nullptr;
    Battery* batt_ = nullptr;
    SendFn send_ = nullptr;
    int fw_ = 0;
    bool session_ = false;
    bool estop_ = false;
    int tel_hz_ = 0;
    unsigned tel_n_ = 0;
    unsigned bad_ = 0;
    uint32_t last_rx_ = 0;
    uint32_t last_tel_ = 0;
};

}  // namespace octo
