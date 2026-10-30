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
    what: "零件库：开发板、传感器、显示屏、电机、连接器等 450 个（/parts、/assembly）",
    file: "public/lib/*/ada-*.glb、public/lib/thumbs/ada-*.webp",
    from: "Adafruit CAD Parts（STEP），转换为 GLB、减面、meshopt 压缩；缩略图由这些 GLB 渲染",
    url: "https://github.com/adafruit/Adafruit_CAD_Parts",
    lic: "MIT License · Copyright (c) 2016 Adafruit Industries",
  },
  {
    what: "零件库：排针、JST 座、USB 座、LED、电阻、按键等封装 114 个（/parts、/assembly）",
    file: "public/lib/*/kc-*.glb、public/lib/thumbs/kc-*.webp",
    from: "KiCad packages3D（KiCad Libraries Team 及贡献者），转换为 GLB、减面；缩略图由这些 GLB 渲染",
    url: "https://gitlab.com/kicad/libraries/kicad-packages3D",
    lic: "CC BY-SA 4.0（附 KiCad 例外条款）；改编后的 GLB 同样以 CC BY-SA 4.0 发布",
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
      <h2 className="mt-8 text-xl font-medium">代码库</h2>
      <p className="mt-2 leading-7 text-ink-soft">
        React、three.js、@dimforge/rapier3d-compat（Apache-2.0，物理碰撞）、@react-three/fiber、@react-three/drei、zustand、Tailwind CSS（除注明外均为 MIT 许可）。模型转换脚本用 occt-import-js（LGPL‑2.1，只在开发时运行，不打包进网页）、glTF‑Transform 和 meshoptimizer（MIT）。
      </p>
      <Link to="/workbench" className="mt-8 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2">
        回到工作台
      </Link>
    </section>
  );
}
