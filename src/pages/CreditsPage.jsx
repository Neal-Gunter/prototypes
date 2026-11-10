import { useEffect } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";
import { useLang, tr } from "../i18n.js";

const ROWS = [
  {
    what: "Feather ESP32‑S3 开发板 3D 模型",
    file: "public/models/feather_esp32s3.glb",
    from: "Adafruit CAD Parts（STEP），转换为 GLB 并减面",
    url: "https://github.com/adafruit/Adafruit_CAD_Parts",
    lic: "MIT License · Copyright (c) 2016 Adafruit Industries",
  },
  {
    what: "微型舵机 3D 模型",
    file: "public/models/micro_servo.glb",
    from: "Adafruit CAD Parts（STEP），转换为 GLB 并减面",
    url: "https://github.com/adafruit/Adafruit_CAD_Parts",
    lic: "MIT License · Copyright (c) 2016 Adafruit Industries",
  },
  {
    what: "4 节 AA 电池盒 3D 模型",
    file: "public/models/battery_4xaa.glb",
    from: "Adafruit CAD Parts（STEP），转换为 GLB 并减面",
    url: "https://github.com/adafruit/Adafruit_CAD_Parts",
    lic: "MIT License · Copyright (c) 2016 Adafruit Industries",
  },
  {
    what: "环境光 HDRI “Studio Small 09”（1K）",
    file: "public/env/studio_small_09_1k.hdr",
    from: "Poly Haven",
    url: "https://polyhaven.com/a/studio_small_09",
    lic: "CC0 1.0（公共领域）",
  },
  {
    what: "木桌面贴图 “Wood Table 001”（漫反射 / 法线 / 粗糙度，1K）",
    file: "public/textures/wood_table_001_*_1k.jpg",
    from: "Poly Haven",
    url: "https://polyhaven.com/a/wood_table_001",
    lic: "CC0 1.0（公共领域）",
  },
  {
    what: "零件库：开发板、传感器、显示屏、电机、连接器等 465 个（/parts、/assembly）",
    file: "public/lib/*/ada-*.glb、public/lib/thumbs/ada-*.webp",
    from: "Adafruit CAD Parts（STEP），转换为 GLB、减面、meshopt 压缩；缩略图由这些 GLB 渲染",
    url: "https://github.com/adafruit/Adafruit_CAD_Parts",
    lic: "MIT License · Copyright (c) 2016 Adafruit Industries",
  },
  {
    what: "零件库：排针、JST 座、USB 座、LED、电阻、按键、IC 封装等 1728 个（/parts、/assembly）",
    file: "public/lib/*/kc-*.glb、public/lib/thumbs/kc-*.webp",
    from: "KiCad packages3D（KiCad Library Team 及贡献者），转换为 GLB、减面；缩略图由这些 GLB 渲染",
    url: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    lic: "CC BY-SA 4.0（附 KiCad 例外条款）；改编后的 GLB 同样以 CC BY-SA 4.0 发布",
  },
  {
    what: "零件库（v20）：SparkFun 开发板、Qwiic 传感器、连接器、按键等 193 个",
    file: "public/lib/*/sfe-*.glb、public/lib/thumbs/sfe-*.webp",
    from: "SparkFun KiCad Libraries（SparkFun Electronics），STEP 转换为 GLB、减面；缩略图由这些 GLB 渲染",
    url: "https://github.com/sparkfun/SparkFun-KiCad-Libraries",
    lic: "CC BY 4.0（署名：SparkFun Electronics；改动：格式转换、减面、材质合并）",
  },
  {
    what: "零件库（v20）：ESP32 / ESP32‑S3 / C3 / C6 等模组 25 个",
    file: "public/lib/*/esp-*.glb、public/lib/thumbs/esp-*.webp",
    from: "Espressif KiCad Libraries（Espressif Systems），STEP 转换为 GLB、减面",
    url: "https://github.com/espressif/kicad-libraries",
    lic: "CC BY-SA 4.0（附与 KiCad 相同的例外条款）；改编后的 GLB 同样以 CC BY-SA 4.0 发布",
  },
  {
    what: "零件库（v20）：Seeed XIAO / Grove 模块 4 个",
    file: "public/lib/*/seeed-*.glb、public/lib/thumbs/seeed-*.webp",
    from: "Seeed Studio OPL KiCad Library（Seeed Studio），转换为 GLB、减面",
    url: "https://github.com/Seeed-Studio/OPL_Kicad_Library",
    lic: "CC BY-SA 4.0；改编后的 GLB 同样以 CC BY-SA 4.0 发布",
  },
  {
    what: "零件库（v21）：舵机、步进 / 直流电机、轴承、直线轴承、同步带轮、铝型材、角码、T 螺母等 141 个（81 个真实 STEP + 60 个型材长度变体），替换掉对应的程序生成近似件",
    file: "public/lib/*/fc-*.glb、public/lib/thumbs/fc-*.webp",
    from: "FreeCAD-library（各零件作者，据 git 提交记录追溯，见 licenses/FreeCAD-library-AUTHORS.md），STEP 转换为 GLB、减面；型材变体只沿长度缩放",
    url: "https://github.com/FreeCAD/FreeCAD-library",
    lic: "CC BY 3.0（README：全部零件 CC-BY 3.0，归属各自作者）；改编后的 GLB 同样以 CC BY 3.0 发布",
  },
  {
    what: "引脚表（v21）：29 块开发板 / 模组 / 驱动芯片的逐脚表（/pinouts），引脚号和名称",
    file: "public/pinouts/*.json",
    from: "KiCad 官方符号库 kicad-symbols（KiCad Library Team 及贡献者），提交 45efbd93；逻辑电平取自各自数据手册 / 厂家页面（每个 JSON 里有链接）",
    url: "https://gitlab.com/kicad/libraries/kicad-symbols",
    lic: "CC BY-SA 4.0（附 KiCad 例外条款）；提取出的引脚表同样以 CC BY-SA 4.0 发布",
  },
  {
    what: "引脚物理位置（v22）：29 块板 / 模块每个焊盘 / 针脚在板上的坐标（mm）、孔径、间距；12 块没有许可干净 CAD 模型的板按封装生成板体（厚度估算）",
    file: "public/pinouts/phys/*.json、src/assembly/fpBoards.gen.js",
    from: "KiCad 官方封装库 kicad-footprints 提交 a337146e090931ad1176e20ed0b7100990fac5fa；KiCad packages3D 提交 8975715167d1a76f9b44be155ac02326f704cdbb（用来核对焊盘落在模型上）；Espressif KiCad Libraries 提交 dd76561812ab300351234ba6e0ec1295641796f0（ESP32 模组封装）；HC-SR04、L298N 模块的排针位置从 FreeCAD-library 模型上量出",
    url: "https://gitlab.com/kicad/libraries/kicad-footprints",
    lic: "CC BY-SA 4.0（附 KiCad 例外条款）；FreeCAD-library 部分 CC BY 3.0；提取出的坐标同样按原许可发布",
  },
  {
    what: "贴片转接板（v23）：13 种贴片封装（SOIC-8/16、TSSOP-16、SSOP-24、QFN-16/32、LQFP-32/48、SOT-23/-5/-6、0603、0805）的焊盘位置和尺寸，用来生成转接板上的焊盘和放片对位",
    file: "src/assembly/breakouts.gen.js（scripts/build-breakouts.mjs 生成）",
    from: "KiCad 官方封装库 kicad-footprints 提交 a337146e090931ad1176e20ed0b7100990fac5fa（Package_SO / Package_DFN_QFN / Package_QFP / Package_TO_SOT_SMD / Resistor_SMD）",
    url: "https://gitlab.com/kicad/libraries/kicad-footprints",
    lic: "CC BY-SA 4.0（附 KiCad 例外条款）；提取出的焊盘坐标同样按原许可发布",
  },
];

const PROCEDURAL = [
  "v28（我的补充）：7 个新维修关卡（开关虚焊、漏装限流电阻、传感器板虚焊、二极管装反、插头没插到位、主控信号脚虚焊、舵机插头磨损）的期望读数来自本项目的简化电路仿真（估算），不是实测；3D 画布标签的英文：工具和零件标签手写，其余来自同一份离线机器辅助翻译词典；术语修正表（scripts/i18n/terms.mjs）和可读性抽样测试是自己写的规则；碰撞体分级（外凸包 / 细凸包按距离切换）是自己写的代码。",
  "英文机器辅助翻译（v27）：public/i18n/en-mt.json 是在开发机上离线用 Argos Translate（MIT 许可）和它的 zh→en 1.9 模型生成的；该模型派生自 OPUS‑MT（Jörg Tiedemann、Santhosh Thottingal，EAMT 2020），原模型以 CC BY 4.0 许可。翻译后用本项目自己的术语表修正了一部分用词。网站运行时不调用任何翻译服务，只查这个词典；机翻文字可能不通顺，界面上标“机器翻译”。使用说明页（/help）的英文是手写的",
  "维修关卡和示例场景（v27，我的补充）：新增 9 个维修关卡和 4 个示例场景（闪灯、按钮、电位器 + 舵机、虚焊故障），期望读数来自本项目的简化仿真，不是实测",
  "拆焊返修 + 英文界面（v24，我的补充）：拆焊 / 翘起焊盘 / 飞线补救是代码里的简化规则（阈值估算），英文界面文字是自己翻译的，都不引入新素材",
  "实测对比 + 用户校准（v26，我的补充）：/project 里的容差、校准公式（电池内阻 / 导线 / 接触电阻拆分）都是代码里的估算；“示例数据”是为演示编的，不是任何真实硬件的实测；照片只存在浏览器里，不上传，不引入新素材",
  "引导项目 + 制作单（v25，我的补充）：/project 的步骤检查、焊接规则、万用表读数都是代码里的简化模型（读数标“估算”），制作单里的 BOM 许可证指 3D 模型素材的许可证；不引入新素材，不写价格",
  "贴片转接板（v23，我的补充）：板体、2.54 mm 排针、走线、丝印按焊盘图和 2.54 mm 栅格用代码生成，CC0；板子外形尺寸是常见转接板的估算，不对应某个具体厂家",
  "凸包碰撞体（v23）：用 three.js 的 ConvexHull（MIT）从已有的长方体碰撞体收紧到真实网格点上再合并，数据随零件元数据发布，不引入新素材",
  "小智八爪鱼（v6）：ESP32‑S3‑DevKitC‑1 板、INMP441、0.96\" OLED、XL4015 ×2、2S 锂电池、躯干骨架、触手、俯仰支架：按数据手册 / 你的 md 尺寸用代码生成，未核实的标“估算”；md 原文 9 个文件是你自己提供的资料，原样收录",
  "烙铁、烙铁架、焊锡丝、助焊笔、吸锡带、吸锡器、螺丝刀、剥线钳、万用表、USB‑C 线：用 three.js 基本几何体在代码里生成",
  "焊点形状（好焊点、虚焊、桥连、烧坏）、导线、绝缘皮、铜丝：代码生成",
  "开发板丝印 / 焊盘贴图、硅胶垫图案、烟雾贴图、文字标签：用 Canvas 在浏览器里画",
  "八触手机器人：代码生成",
  "装配台的螺丝、螺母、铜柱（M2 / M2.5 / M3）、底板、杜邦线、触手、工具：src/assembly/procedural.js 代码生成，尺寸参照 ISO/DIN 公称值，未核实的标“估算”（CC0）",
  "内六角圆柱头螺丝 M2/M2.5/M3（按 ISO 4762 头径/头高/内六角公称值）、平垫圈（ISO 7089）、内六角扳手 1.5/2/2.5 mm（ISO 2936）：src/assembly/procedural.js 代码生成（CC0）",
  "v20 标准件 451 个：深沟球轴承 / LMxUU 直线轴承（ISO 15 / 常见规格外形）、光轴、模数 0.5–2 直齿轮、GT2 带轮、2020–4040 铝型材及角码 / T 型螺母、ISO 7380 半圆头螺丝、热熔螺母、NEMA 8–34 步进、无刷电机、舵机各尺寸级别、直流减速电机、TT 电机、18650 等圆柱电池、纽扣电池、9 V 电池、LiPo 软包、汽车片式 / 玻璃管保险丝、杜邦 / JST XH·PH·SH·ZH / XT30·60·90 连接器、3D 打印底板和 L 型支架：src/assembly/procedural2.js 代码生成（CC0），尺寸按标准或常见规格，未核实的标“估算”",
  "面包板 830 孔 / 400 孔 / 170 孔（孔距 2.54 mm；外形尺寸为估算）、28BYJ‑48 步进电机、NEMA 17 步进电机（42.3 mm 法兰、31 mm 孔距按 NEMA ICS 16；机身长度为常见规格）、N20 / 130 / 扣式振动电机、镊子、斜口钳、剥线钳、万用表、吸锡器、焊锡卷：用基本几何体代码生成，外形为估算（CC0）",
];

export default function CreditsPage() {
  const [lang] = useLang();
  const en = lang === "en";
  useEffect(() => {
    document.title = en ? "Credits & licenses · hardware workbench" : "素材与许可 · 硬件工作台";
  }, [en]);
  return (
    <section className={`${containerClass} py-12`}>
      <h1 className="text-3xl font-medium tracking-tight">素材与许可</h1>
      <p className="mt-3 max-w-3xl leading-7 text-ink-soft">
        硬件工作台（早期原型，简化仿真）用到的外部素材都在下面，全部是可免费使用的开源 / 公共领域许可。完整许可文本见仓库里的 <code>LICENSES.md</code>。
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm" data-testid="credits">
          <thead>
            <tr className="text-left text-ink-soft">
              <th className="border-b border-line py-2 pr-4 font-normal">素材</th>
              <th className="border-b border-line py-2 pr-4 font-normal">文件</th>
              <th className="border-b border-line py-2 pr-4 font-normal">来源</th>
              <th className="border-b border-line py-2 font-normal">许可</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.file}>
                <td className="border-b border-line py-2 pr-4">{r.what}</td>
                <td className="border-b border-line py-2 pr-4 font-mono text-xs">{r.file}</td>
                <td className="border-b border-line py-2 pr-4">
                  <a className="underline" href={r.url} target="_blank" rel="noreferrer">
                    {r.from}
                  </a>
                </td>
                <td className="border-b border-line py-2">{r.lic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 text-xl font-medium">程序生成的部分（没有外部素材）</h2>
      <ul className="mt-2 list-disc pl-5 leading-7 text-ink-soft">
        {PROCEDURAL.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <h2 className="mt-8 text-xl font-medium">维修关卡（v17）</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-repair">
        12 个关卡、板子、故障、提示和文字全部由本项目自写（我的补充），板子是示意图，不是某款真实产品的原理图。AWG 线阻用常见的实心铜线 20 °C 换算表（22AWG 约 0.053 Ω/m … 30AWG 约 0.339 Ω/m）；色环按 IEC 60062 的颜色代码；I2C 上拉下限按标准模式 3 mA 灌电流估算。其他电阻、压降、内阻、接触电阻、工时都是估算。不显示价格。仿真读数不是实测，不替代真实安全培训。
      </p>
      <h2 className="mt-8 text-xl font-medium">时域仿真和示波器（v18）</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-scope">
        时域求解器（改进节点法、梯形法 / 后向欧拉伴随模型、非线性迭代）、器件行为模型、示波器面板、三板台架和 6 个示波器关卡全部由本项目自写（我的补充），没有用第三方电路仿真库。验证用的是 RC / RL / RLC 阶跃响应的教科书解析解。LiPo 内阻和极化、升压限流、舵机起步 / 堵转电流、主控欠压阈值、电容老化后的容量和 ESR、端子接触电阻都是估算，不代表某个具体型号；不显示价格。仿真读数不是实测，不替代真实安全培训。
      </p>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-netlist">
        v19 的台面网表提取（从 3D 台面上实际放的零件和线生成电路，查悬空 / 短路 / 缺地）、自适应步长（误差控制、最小步长限制、开关 / 欠压 / 限流事件对齐）、实时改参数 + 撤销 + 改前改后对比、八爪鱼 what-if 面板，全部由本项目自写（我的补充）。线阻按 AWG 铜线每米电阻 × 线长，杜邦端子接触电阻、板载 LDO / 主控电流、舵机起步电流、电池老化内阻都是估算，不是数据手册数值。
      </p>
      <h2 className="mt-8 text-xl font-medium" id="teardown">拆解模式（v29–v33）：灵感来源</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-teardown">
        拆解模式的指南文字、步骤插图（SVG）、爆炸图和近似零件全部由本项目自己编写和程序生成，按公开的通用常识整理，未经实物验证；没有复制下面任何项目的文字、照片或代码。下面这些公开项目只是做法上的灵感（列出它们、并如实写出我们看到的许可）：
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-teardown-list">
        <li><a className="underline" href="https://github.com/Caleb-Guyer/teardown-library">Caleb-Guyer/teardown-library</a>：代码 MIT；指南文字和照片 CC BY-NC-SA 3.0（非商业、相同方式共享）。本项目没有使用其中的文字或照片。</li>
        <li><a className="underline" href="https://github.com/HardwareHackingHandbook/teardowns">HardwareHackingHandbook/teardowns</a>：照片 CC BY 4.0。本项目没有使用其中的照片。</li>
        <li><a className="underline" href="https://github.com/ttepatti/teardown-rivian-axm-1.0">ttepatti/teardown-rivian-axm-1.0</a>：只作参考（拆解记录的组织方式）。</li>
        <li><a className="underline" href="https://github.com/gipi/teardown">gipi/teardown</a>：只作参考（拆解记录的组织方式）。</li>
        <li><a className="underline" href="https://github.com/nox-x/TG3442DE-Teardown">nox-x/TG3442DE-Teardown</a>：我们没有看到许可文件，所以只看了它的结构，没有使用任何内容。</li>
      </ul>
      <p className="mt-2 leading-7 text-ink-soft">零件库里新增的 36 个“近似件 · 拆解模式”（td- 开头）是本项目程序生成（CC0），全部尺寸是估算，形状是示意。</p>
      <h2 className="mt-8 text-xl font-medium" id="v34-research">v34 调研：维修 / 装配指南格式和面包板工具</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v34">
        v34 先查了许可，再看了下面这些公开项目的做法。没有复制任何文字、图片或代码；v34 新增的指南检查脚本（scripts/guide-lint.mjs）和 3D 场景键盘操作都是本项目自己写的。
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v34-list">
        <li><a className="underline" href="https://github.com/wokwi/wokwi-docs">wokwi/wokwi-docs</a>（MIT）：电路文件里“零件列表 + 连线列表”的结构，和用命令行工具检查文件（重复 id、未知零件）的做法，启发了 guide-lint 这个检查脚本。</li>
        <li><a className="underline" href="https://github.com/wokwi/wokwi-elements">wokwi/wokwi-elements</a>（MIT）：把电子零件做成网页组件的思路，只作参考。</li>
        <li><a className="underline" href="https://github.com/iop-alliance/OpenKnowHow">iop-alliance/OpenKnowHow</a>（GPL-3.0）：开源硬件文档的元数据规范（许可、版本、制作说明的位置），只作参考，没有使用其中的内容。</li>
        <li><a className="underline" href="https://github.com/fritzing/fritzing-app">fritzing/fritzing-app</a>：GitHub 上许可标为“其他”（NOASSERTION），零件库另有许可。只看了“面包板视图 / 原理图 / PCB 三视图”的做法，没有使用代码或零件图。</li>
        <li><a className="underline" href="https://github.com/gatecat/BreadboardSim">gatecat/BreadboardSim</a>（GPL-3.0）、<a className="underline" href="https://github.com/pfalstad/circuitjs1">pfalstad/circuitjs1</a>（GPL-2.0）：面包板界面的电路仿真，只作参考。</li>
        <li>常见的维修指南网站把每份指南分成难度、所需时间、工具、零件和逐步说明（每步配图，注意事项单独标出）。它们的指南内容多用 CC BY-NC-SA 许可，本项目没有使用；本项目的拆解指南本来就有难度、时间、工具和停止点，这次加了自动检查。</li>
      </ul>
      <h2 className="mt-8 text-xl font-medium" id="v35-a11y">v35：无障碍检查和打印导出</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v35">
        v35 新增了无障碍自动检查：开发时用 axe-core（MPL-2.0，只作为开发依赖，只在测试里注入页面，不进网站的发布包）检查 16 个页面的中英文界面。打印 / 导出 PDF 用的是浏览器自带的“打印 → 另存为 PDF”，没有用付费服务或额外的库。红外遥控器拆解指南的文字和示意图是本项目自己写的，按公开资料整理，未经实物验证。
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v35-list">
        <li><a className="underline" href="https://github.com/dequelabs/axe-core">dequelabs/axe-core</a>（MPL-2.0）：网页无障碍规则引擎。只在开发测试里用（e2e/axe-check.mjs），没有修改或打包进网站。</li>
      </ul>
      <h2 className="mt-8 text-xl font-medium" id="v36-print">v36：打印版检查和厨房计时器</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v36">
        v36 的打印版页码用的是浏览器自带的 CSS 分页（@page 页边框里的页码计数），目录是普通的页内链接，没有用额外的库或付费服务。检查打印版 PDF 时用 Playwright 生成 PDF，再用 poppler-utils 里的 pdftotext（GPL-2.0，只在开发机上的测试里调用，不进网站的发布包）逐页读出文字。电子厨房计时器拆解指南的文字和示意图是本项目自己写的，按公开资料整理，未经实物验证；尺寸都是估算。
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v36-list">
        <li><a className="underline" href="https://poppler.freedesktop.org/">poppler / pdftotext</a>（GPL-2.0）：只在测试脚本 e2e/sheet-pdf-lint.mjs 里调用，没有修改或打包进网站。</li>
        <li><a className="underline" href="https://www.w3.org/TR/css-page-3/">W3C CSS Paged Media Module Level 3</a>：页边框和页码计数的写法按这份规范，代码是自己写的。</li>
      </ul>
      <h2 className="mt-8 text-xl font-medium" id="v37-qr">v37：打印版二维码、焦点检查和小夜灯</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v37">
        v37 打印版上的二维码用 uqr 在浏览器里编码，画成 SVG 的代码是自己写的；测试里用 jsQR 把每个二维码重新解码一遍，确认扫出来的就是对应那一步的网址。键盘倾斜改用四元数，代码是自己写的，没有用额外的库。键盘焦点顺序检查是自己写的 Playwright 脚本。电池感应小夜灯拆解指南的文字和示意图都是本项目自己写、自己画的，没有复制任何外部拆解指南；尺寸标了估算。
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v37-list">
        <li><a className="underline" href="https://github.com/unjs/uqr">unjs/uqr</a>（MIT）：二维码编码，打包进拆解页（按需加载的那一块）。它的算法来自 <a className="underline" href="https://github.com/nayuki/QR-Code-generator">Project Nayuki 的 QR-Code-generator</a>（MIT）。</li>
        <li><a className="underline" href="https://github.com/cozmo/jsQR">cozmo/jsQR</a>（Apache-2.0）：二维码解码，只在测试脚本 e2e/qr-decode.mjs 里用，没有修改或打包进网站。</li>
      </ul>

      <div data-no-mt="">
      <h2 className="mt-8 text-xl font-medium" id="v38-bank">{en ? "v38: problem bank pipeline" : "v38：题库管线"}</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v38">
        {en
          ? "All v38 problem-bank wording was written for this project and compiled from public information. fromthetransistor and its forks contribute only title, language and LOC as source facts; README prose is not copied. The awesome-electronics catalogue is CC0; only tool names and links are injected as hints into existing tasks. Fault seeds come from overviews written here: US-government public-domain NASA Lessons Learned / NEPP material is retold in our own words; datasheets contribute only facts such as absolute maximum ratings; CC or copyrighted sources such as iFixit and EEVblog are kept as a link plus a failure-mode name, are never copied, and never enter the bank. The on-page C/C++, assembly and Intel HEX checkers are original lightweight parsers and load no WASM. tree-sitter (MIT) is used at build time to check that reference answers satisfy each spec; it is a development dependency and is not shipped in the site bundle. The GitHub Actions workflow lives only on this feature branch and is not enabled on main by itself. When a group's earliest expiry is within 30 days the catalogue uses a yellow background (our addition, agreed); template functions and template classes stay in one requiredTemplates check (agreed). Two tasks are deliberately marked soon-to-expire or already expired, only to demonstrate freshness counts."
          : "v38 的题库题面全部是本项目自己写的，按公开资料整理。fromthetransistor 及其 fork 只取标题、语言和 LOC 作为出处事实，不复制 README 正文。awesome-electronics 名录是 CC0，只把工具名称和链接作为提示注入已有题目。故障种子来自自己撰写的概述：NASA Lessons Learned / NEPP 等美国政府公有领域资料用自己的话转写；datasheet 只提取绝对最大额定值这类事实；iFixit、EEVblog 等 CC 或版权来源只保留链接和失效模式名称，不入库、不复制原文。页面上的 C/C++、汇编和 Intel HEX 校验器是自己写的轻量解析器，不加载 WASM。构建期用 tree-sitter（MIT）校验参考答案是否满足题目规则，只作开发依赖，不进网站发布包。GitHub Actions 的构建工作流只放在本功能分支，不会自行启用到 main。课程大纲在某一组最早过期日距今不到 30 天时用黄底提示（我的补充，已确认）；模板函数和模板类仍合并在 requiredTemplates 里检查（已确认）。有两道题被故意标成即将过期或已过期，只为演示新鲜度统计。"}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v38-list">
        <li><a className="underline" href="https://github.com/geohot/fromthetransistor">geohot/fromthetransistor</a>{en ? " and its forks: only title / language / LOC are recorded; problem text is original." : " 及其 fork：只记录标题 / 语言 / LOC，题面自己写。"}</li>
        <li><a className="underline" href="https://github.com/kitspace/awesome-electronics">kitspace/awesome-electronics</a>{en ? " (CC0-1.0): tool names and links." : "（CC0-1.0）：工具名称和链接。"}</li>
        <li><a className="underline" href="https://llis.nasa.gov/">NASA Lessons Learned</a>、{""}<a className="underline" href="https://nepp.nasa.gov/">NASA NEPP</a>{en ? ": US-government public-domain material; the overviews are written here." : "：美国政府公有领域资料，概述自己写。"}</li>
        <li><a className="underline" href="https://tree-sitter.github.io/tree-sitter/">tree-sitter</a>{en ? " (MIT) and the C / C++ grammars: used only at build time and in development tests, not bundled into the site." : "（MIT）以及 C / C++ 语法：只在构建期和开发测试里用，不打包进网站。"}</li>
      </ul>
      </div>
      <h2 className="mt-8 text-xl font-medium" id="v39-fresh">{en ? "v39: stable freshness, table bounds, print TOC pages, more tasks" : "v39：新鲜度稳定、桌面边界、目录页码和更多题目"}</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v39">
        {en
          ? "v39 keeps the same licence line as v38: all new problem text and the CR2032 keychain-light teardown guide were written for this project and compiled from public information, not verified on a real device. The content hash ignores provenance metadata. The Actions workflow defaults to the committed offline snapshots. Focus-ring contrast uses relative luminance (3:1). Print TOC page numbers are written into the sheet because CSS target-counter is not reliable in Chrome. Approximate keyfob parts are estimated."
          : "v39 沿用 v38 的许可规则：新增题面和 CR2032 钥匙扣灯拆解指南都是本项目自己写的，按公开资料整理，未经实物验证。内容 hash 不算出处元数据。Actions 默认用已提交的离线快照。焦点环对比度按相对亮度计算（3:1）。打印目录页码写进指南里，因为 Chrome 对 CSS target-counter 支持不稳。钥匙扣灯的近似件尺寸是估算。"}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v39-list">
        <li>{en ? "No new third-party licences in this release. tree-sitter remains a development dependency only, as in v38." : "本版没有新增第三方许可。tree-sitter 仍只作开发依赖，和 v38 一样。"}</li>
      </ul>
      <h2 className="mt-8 text-xl font-medium" id="v40-paths">{en ? "v40: TOC backfill, bank list ready, learning paths" : "v40：目录回填、题库就绪选择器和学习路径"}</h2>
      <p className="mt-2 leading-7 text-ink-soft" data-testid="credits-v40">
        {en
          ? "v40 keeps the same licence line as v38 and v39. The three learning-path notes and the What's new text on the help page were written for this project. No new third-party material was copied. Print TOC page numbers are still written into the sheet (Chrome's target-counter remains unreliable); when a chapter spans pages the later numbers are backfilled from the measured layout. Approximate parts and teardown guides remain estimates compiled from public information, not verified on real devices."
          : "v40 沿用 v38 和 v39 的许可规则。三条学习路径的说明和使用说明里的「本版更新」都是本项目自己写的，没有复制新的第三方材料。打印目录页码仍写进指南里（Chrome 对 target-counter 的支持仍然不稳）；某一节跨页时，后面的页码按实测版面回填。近似件和拆解指南仍是按公开资料整理的估算，未经实物验证。"}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-6 text-ink-soft" data-testid="credits-v40-list">
        <li>{en ? "No new third-party licences in this release. tree-sitter remains a development dependency only, as in v38." : "本版没有新增第三方许可。tree-sitter 仍只作开发依赖，和 v38 一样。"}</li>
      </ul>
      <h2 className="mt-8 text-xl font-medium">代码库</h2>
      <p className="mt-2 leading-7 text-ink-soft">
        React、three.js、@dimforge/rapier3d-compat（Apache-2.0，物理碰撞）、@react-three/fiber、@react-three/drei、zustand、Tailwind CSS（除注明外均为 MIT 许可）。模型转换脚本用 glTF‑Transform 和 meshoptimizer（MIT，只在开发时运行）。“模型 + 功能图”页（v11）在浏览器里用 occt-import-js（LGPL‑2.1，读 STEP；作为单独的 JS + wasm 文件按需加载，没有改动，可替换）和 pdfjs-dist（Apache-2.0，读 PDF 功能图，按需加载）。内置示例的八爪鱼 GLB 和功能图 SVG 由本项目从 v10 预设自制；v12 的 2 自由度机械臂示例（OBJ + 功能图 + 工程）由本项目脚本自制，CC0。关节和舵机运动用同一个 Rapier 引擎。
      </p>
      <Link to="/workbench" className="mt-8 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2">
        回到工作台
      </Link>
    </section>
  );
}
