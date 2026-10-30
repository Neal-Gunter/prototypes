# Licenses for third-party assets

All third-party assets used by the workbench are free to use. The table lists each file, where it comes from and its licence.

| File | Source | Licence |
|---|---|---|
| `public/models/feather_esp32s3.glb` | Adafruit_CAD_Parts, `Feather ESP32-S3` STEP (https://github.com/adafruit/Adafruit_CAD_Parts), converted to GLB and simplified by `scripts/convert-models.mjs` | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/models/micro_servo.glb` | Adafruit_CAD_Parts, micro servo STEP, converted and simplified the same way | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/models/battery_4xaa.glb` | Adafruit_CAD_Parts, 4×AA battery holder STEP, converted and simplified the same way | MIT, Copyright (c) 2016 Adafruit Industries |
| `public/env/studio_small_09_1k.hdr` | Poly Haven, "Studio Small 09" (https://polyhaven.com/a/studio_small_09) | CC0 1.0 (public domain) |
| `public/textures/wood_table_001_*_1k.jpg` | Poly Haven, "Wood Table 001" (https://polyhaven.com/a/wood_table_001) | CC0 1.0 (public domain) |

Everything else in the 3D scene was made in code for this project: the iron and stand, solder spool, flux pen, wick, solder pump, screwdriver, wire stripper, multimeter, USB-C cable, wires, solder joints, the mat and smoke textures, labels and the robot.

Tools used only at development time (they are not bundled into the site):

- `occt-import-js`: LGPL-2.1, reads the STEP files.
- `@gltf-transform/*` and `meshoptimizer`: MIT, write and compress the GLB files.

The site itself uses React, three.js, @react-three/fiber, @react-three/drei, zustand and Tailwind CSS. All of these are MIT.

## Adafruit_CAD_Parts licence text

```
MIT License

Copyright (c) 2016 Adafruit Industries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 零件库 `public/lib/`（v4 新增）

`public/lib/` 里的 564 个 GLB 由 `scripts/convert-library.mjs` 从下列开源 CAD 转换并简化（减面、meshopt 压缩），每个文件都小于 2 MB。每个零件的来源链接写在 `public/lib/catalog/<分类>.json` 的 `url` 字段里。

| 来源 | 数量 | 许可证 | 文件 |
|---|---|---|---|
| Adafruit_CAD_Parts（https://github.com/adafruit/Adafruit_CAD_Parts） | 450 | MIT，Copyright (c) 2016 Adafruit Industries（全文见上） | `public/lib/*/ada-*.glb` |
| KiCad packages3D（https://gitlab.com/kicad/libraries/kicad-packages3D） | 114 | CC BY-SA 4.0，附 KiCad 的设计例外条款 | `public/lib/*/kc-*.glb` |

**相同方式共享（ShareAlike）说明：** `kc-*.glb` 是对 KiCad 3D 模型的改编（格式转换 + 减面）。这些改编文件作为一个集合再分发，KiCad 的设计例外不适用，所以它们**同样以 CC BY-SA 4.0 发布**，署名 “KiCad Libraries Team / KiCad packages3D 贡献者”。这条要求只针对这些 GLB 文件，不涉及本站其余代码。改动内容：STEP/WRL → GLB 转换、网格简化、材质合并、坐标单位换算。

许可证全文：

- `licenses/CC-BY-SA-4.0.txt`：CC BY-SA 4.0 法律文本（取自 creativecommons.org）
- `licenses/KiCad-packages3D-LICENSE.md`：KiCad 库许可证及例外条款原文

紧固件（螺丝、螺母、铜柱）、底板、面包板导线和工具都在 `src/assembly/procedural.js` 里用代码生成，尺寸参照 ISO/DIN 公称值；没有核实过的数值在界面上标“估算”。

v5 新增的程序零件（同样是本项目自制、CC0）：
- 内六角圆柱头螺丝 M2/M2.5/M3：头径、头高、内六角对边按 ISO 4762 公称值；平垫圈按 ISO 7089；内六角扳手按 ISO 2936 对边尺寸。
- 面包板 830 孔、400 孔、170 孔：孔距 2.54 mm，外形尺寸为估算。
- 步进电机：28BYJ‑48（外形为常见规格的估算）、NEMA 17（42.3 mm 法兰、31 mm 孔距、M3 螺纹孔按 NEMA ICS 16；机身长度 34/40/48 mm 为常见规格）；N20、130、扣式振动电机（估算）。
- 桌面工具：镊子、斜口钳、剥线钳、万用表、吸锡器、焊锡卷（外形估算）。

物理引擎：`@dimforge/rapier3d-compat`，Apache-2.0。

## v6：小智八爪鱼

- `src/assembly/octopus/md/` 里的 9 个文件（README、`.ino`、`octopus_*.h`、`octopus_mcp.cpp`、3 份中文 md）是项目所有者自己提供的资料。原样收录，一字未改，用于对照和导出指南。
- 新增 10 个程序零件（ESP32‑S3‑DevKitC‑1 板、INMP441、0.96" OLED、2 块 XL4015、2S 锂电池，以及躯干、触手、俯仰支架、B 型触手）由本项目用代码生成（CC0），尺寸按数据手册或 md，未核实的标“估算”。
- 用到的已有真实模型：Adafruit 815 / 3006 / 3923 / 1143（Adafruit_CAD_Parts，见上文），以及 KiCad 的 ESP32‑S3‑WROOM‑1 和 CP_Radial_D6.3mm（KiCad 库许可，见上文）。

## v7：完善版（我的补充）

- `src/assembly/octopus/plus/` 里的固件和 md 是在项目所有者提供的 md 基础上改写的（每处标“我的补充”），和 md 原件同样归项目所有者。
- 引用的事实来自公开数据手册：Espressif ESP32-S3 技术规格书 / DevKitC-1 用户指南、NXP PCA9685 数据手册、XL4015、TP4056 规格书，以及 Nordic UART Service UUID。只引用参数，没有复制文档内容。
- 编译用 arduino-cli（GPL-3.0）和 arduino-esp32 core（LGPL-2.1），只在本地使用，没有随项目分发。

## v8

- `plus/xiaozhi/stub_compile/` 是本项目写的桩（CC0），用于单独检查 `octopus_mcp.cpp` 能否编译。小智工程（xiaozhi-esp32，MIT）的头文件由 `scripts/fw-compile.sh` 在编译时从上游下载，不收录、不分发。
- 第 12 节的安全提示：“md / 完善版写到的”引自项目所有者的 md；其余是通用安全常识，标“我的补充”，没有复制任何文档。
