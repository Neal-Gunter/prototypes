import { useEffect } from "react";
import { Link } from "react-router-dom";
import { containerClass } from "../container";

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
];

const PROCEDURAL = [
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
  useEffect(() => {
    document.title = "素材与许可 · 硬件工作台";
  }, []);
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
