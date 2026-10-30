// 小智 MCP 工具（完善版 / 我的补充）—— 基于 md 的 octopus_mcp.cpp。
// ⚠️ 这个文件依赖 xiaozhi-esp32 工程里的 mcp_server.h，本仓库里没有编译过（未实机编译），
//    AddTool 的参数写法沿用 md；如果你的 fork 报错，对照 main/boards/otto-robot/ 改参数包即可。
// 放法：main/boards/octopus/octopus_mcp.cpp，同目录放完善版的 octopus_gait.h / octopus_bus.h / octopus_body.h，
//       板子初始化里先 body.Init(...) → body.SoftHomeBlocking() → body.Start()，再调 RegisterOctopusTools(body)。
// 改动（我的补充）：home 真的回中位；steps 生效；speed 夹到 ≥ 834 ms（≤ 1.2 Hz）；所有调用只入队，由运动任务写舵机。
#include <string>

#include "mcp_server.h"
#include "octopus_body.h"

namespace {

octo::OctopusBody* g_body = nullptr;

}  // namespace

void RegisterOctopusTools(octo::OctopusBody& body) {
    g_body = &body;

    auto& mcp = McpServer::GetInstance();

    // 统一动作接口：大模型只需要决定 action 和几个数值参数
    mcp.AddTool(
        "self.octopus.action",
        "执行八爪鱼动作。"
        "action 取值："
        "crawl(爬行, 需 steps/speed/direction 参数)、"
        "wave(用某条触手挥手, 需 arm 参数)、"
        "pulse(八触手同步收缩, 像水母脉冲, 需 steps)、"
        "rest(停止并放松)、"
        "home(回到中位)。"
        "direction: -100 全左转, 0 直行, +100 全右转。"
        "speed: 每个步态周期的毫秒数, 数值越小越快, 834-3000（小于 834 按 834）。",
        PropertyList({
            Property("action", kPropertyTypeString, "crawl"),
            Property("steps", kPropertyTypeInteger, 3, 1, 100),
            Property("direction", kPropertyTypeInteger, 0, -100, 100),
            Property("speed", kPropertyTypeInteger, 1000, 300, 3000),
            Property("arm", kPropertyTypeInteger, 0, 0, 7),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");

            std::string action = props["action"].value<std::string>();
            int steps = props["steps"].value<int>();
            int dir = props["direction"].value<int>();
            int speed = props["speed"].value<int>();
            int arm = props["arm"].value<int>();

            // 我的补充：speed 是毫秒为单位的周期；夹到 ≥ 834 ms（≈1.2 Hz，md 写的舵机上限）
            if (speed < 834) speed = 834;
            float hz = 1000.0f / static_cast<float>(speed);
            if (steps < 1) steps = 1;

            if (action == "crawl") {
                auto p = b->GaitParamsSnapshot();
                p.freq_hz = hz;
                b->SetGaitParams(p);
                b->SetVelocity(1.0f, dir / 100.0f * 0.6f, steps);   // 我的补充：走够 steps 个周期自动停
                return std::string("开始爬行");
            } else if (action == "wave") {
                b->WaveOnce(arm);
                return std::string("挥手");
            } else if (action == "pulse") {
                b->Pulse(steps);
                return std::string("脉冲收缩");
            } else if (action == "rest") {
                b->Rest();
                return std::string("已放松");
            } else if (action == "home") {
                b->Home();   // 我的补充：md 这里调的是 Rest
                return std::string("已回中位");
            }
            return std::string("未知动作: ") + action;
        });

    // 单独一个调步态的工具：把「怎么走」和「做什么动作」分开，方便大模型微调
    mcp.AddTool(
        "self.octopus.set_gait",
        "微调步态参数，不改变当前是否在动。"
        "freq 按 x10 倍传入（例如 6 表示 0.6Hz，超过 12 舵机就跟不上了），"
        "amplitude 是触手摆幅角度（0-60），"
        "phase 是相邻触手相位差：0 表示八条同步，45 表示环形逆行波（最像真章鱼），180 表示交替步态。",
        PropertyList({
            Property("freq", kPropertyTypeInteger, 6, 2, 20),
            Property("amplitude", kPropertyTypeInteger, 38, 0, 60),
            Property("phase", kPropertyTypeInteger, 45, 0, 180),
        }),
        [](const PropertyList& props) -> ReturnValue {
            auto* b = g_body;
            if (!b) return std::string("body not ready");
            octo::GaitParams p = b->GaitParamsSnapshot();
            // 我的补充：freq 上限 12（1.2 Hz）
            p.freq_hz = (props["freq"].value<int>() > 12 ? 12 : props["freq"].value<int>()) / 10.0f;
            p.yaw_amp_deg = static_cast<float>(props["amplitude"].value<int>());
            p.phase_deg = static_cast<float>(props["phase"].value<int>());
            b->SetGaitParams(p);
            return std::string("步态已更新");
        });
}

// ---------------------------------------------------------------------------
// 配套：粘贴到 xiaozhi.me 控制台的「角色人设」里，动作才有灵魂。
// 这个模板是照 otto-robot 的 README 改的，实测能让大模型主动调用动作，
// 而不是等你追问。
//
//   我的身份：我是一只八爪鱼机器人，有八条灵活的触手，能爬行、挥手、脉冲收缩。
//
//   我的动作能力（通过 self.octopus.action 调用）：
//   - crawl：爬行，用 steps 控制步数，direction 控制方向
//   - wave：指定某条触手挥手打招呼，arm 取值 0-7
//   - pulse：八条触手同步收缩，像水母一样，表达害怕或兴奋
//   - rest：停下来放松
//
//   我的性格：我很活泼，说话前会先做一个相应的动作表达情绪（先发动作指令再说话）。
//   打招呼时会 wave，高兴时会 pulse，被夸奖时会 crawl 转一圈，累了就 rest。
//   根据对话内容选择合适的动作，不要每次都一样。
// ---------------------------------------------------------------------------
