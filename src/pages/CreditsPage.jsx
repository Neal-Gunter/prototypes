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
];

const PROCEDURAL = [
  "烙铁、烙铁架、焊锡丝、助焊笔、吸锡带、吸锡器、螺丝刀、剥线钳、万用表、USB‑C 线：用 three.js 基本几何体在代码里生成",
  "焊点形状（好焊点、虚焊、桥连、烧坏）、导线、绝缘皮、铜丝：代码生成",
  "开发板丝印 / 焊盘贴图、硅胶垫图案、烟雾贴图、文字标签：用 Canvas 在浏览器里画",
  "八触手机器人：代码生成",
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
        React、three.js、@react-three/fiber、@react-three/drei、zustand、Tailwind CSS（均为 MIT 许可）。模型转换脚本用 occt-import-js（LGPL‑2.1，只在开发时运行，不打包进网页）、glTF‑Transform 和 meshoptimizer（MIT）。
      </p>
      <Link to="/workbench" className="mt-8 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2">
        回到工作台
      </Link>
    </section>
  );
}
