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

## v20：零件库扩充到 2942 个（真实 CAD 2415 + 程序生成 527）

每个真实 CAD 零件的来源链接（`url`）、作者（`author`）、来源名（`source`）和许可证（`licence`）都写在 `public/lib/catalog/<分类>.json` 里，`scripts/parts-validate.mjs` 会逐条检查。只收了许可证清楚、允许商用的来源；许可证不清楚或禁止商用的一律没收。

| 来源 | 数量 | 许可证（已在仓库 LICENSE 文件核对） | 署名 | 文件 |
|---|---|---|---|---|
| Adafruit CAD Parts（https://github.com/adafruit/Adafruit_CAD_Parts） | 465 | MIT | Copyright (c) 2016 Adafruit Industries | `ada-*.glb` |
| KiCad packages3D（https://gitlab.com/kicad/libraries/kicad-packages3D） | 1728 | CC BY-SA 4.0 + KiCad 例外条款 | KiCad Library Team 及贡献者 | `kc-*.glb` |
| SparkFun KiCad Libraries（https://github.com/sparkfun/SparkFun-KiCad-Libraries） | 193 | CC-BY-4.0（README 写明 CC BY 4.0，允许商用） | SparkFun Electronics | `sfe-*.glb` |
| Espressif KiCad Libraries（https://github.com/espressif/kicad-libraries） | 25 | CC-BY-SA-4.0 + 与 KiCad 相同的例外条款（LICENSE.md） | Espressif Systems | `esp-*.glb` |
| Seeed Studio OPL KiCad Library（https://github.com/Seeed-Studio/OPL_Kicad_Library） | 4 | CC-BY-SA-4.0（LICENSE） | Seeed Studio | `seeed-*.glb` |
| 本项目程序生成（`src/assembly/procedural*.js`） | 527 | CC0 | — | 代码 |

改动内容（所有 CAD 来源相同）：STEP/WRL → GLB 转换、网格减面、材质合并、单位换算、meshopt 压缩，另由 GLB 渲染 256 px 缩略图（`public/lib/thumbs/*.webp`，许可证随原模型）。CC BY-SA 来源的改编 GLB 同样以 CC BY-SA 4.0 发布；CC BY 4.0 的 SparkFun 模型保留署名。许可证全文：`licenses/CC-BY-4.0.txt`、`licenses/CC-BY-SA-4.0.txt`、`licenses/KiCad-packages3D-LICENSE.md`、`licenses/Espressif-kicad-libraries-LICENSE.md`、`licenses/Seeed-OPL-LICENSE.txt`。

按分类 / 来源：

| 分类 | 合计 | Adafruit | KiCad | SparkFun | Espressif | Seeed | 程序生成 |
|---|---|---|---|---|---|---|---|
| 主控板 / MCU 模块 | 101 | 83 | 15 | 2 | 0 | 0 | 1 |
| 传感器 | 151 | 76 | 55 | 15 | 0 | 1 | 4 |
| 显示屏 | 126 | 46 | 76 | 3 | 0 | 0 | 1 |
| 电机 / 舵机 / 步进 | 61 | 10 | 0 | 0 | 0 | 0 | 51 |
| 驱动 / 扩展板 | 128 | 41 | 81 | 6 | 0 | 0 | 0 |
| 电源 / 电池 | 162 | 43 | 81 | 1 | 0 | 0 | 37 |
| 无源器件 | 208 | 0 | 187 | 1 | 0 | 0 | 20 |
| 分立半导体 / 芯片封装 | 194 | 0 | 194 | 0 | 0 | 0 | 0 |
| LED / 灯 | 117 | 15 | 90 | 12 | 0 | 0 | 0 |
| 开关 / 按键 / 输入 | 301 | 37 | 238 | 26 | 0 | 0 | 0 |
| 连接器 / 排针 | 828 | 23 | 667 | 94 | 0 | 0 | 44 |
| 面包板 / 洞洞板 | 17 | 14 | 0 | 0 | 0 | 0 | 3 |
| 导线 / 线缆 | 21 | 5 | 0 | 0 | 0 | 0 | 16 |
| 通信 / 音频 / 存储模块 | 136 | 52 | 29 | 27 | 25 | 3 | 0 |
| 紧固件 | 138 | 0 | 1 | 6 | 0 | 0 | 131 |
| 轴承 / 齿轮 / 带轮 / 型材 | 182 | 0 | 0 | 0 | 0 | 0 | 182 |
| 外壳 / 结构件 | 60 | 20 | 14 | 0 | 0 | 0 | 26 |
| 工具 | 11 | 0 | 0 | 0 | 0 | 0 | 11 |
| **合计** | **2942** | 465 | 1728 | 193 | 25 | 4 | 527 |


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

## v9

- `loco.js` 物理行走用 `@dimforge/rapier3d-compat`（Apache-2.0，已在上面列出）；舵机参数引自 MG90S 公开规格（堵转扭矩、速度、质量），只引用数字。
- 走查录屏用 Playwright（Apache-2.0）和 ffmpeg（LGPL/GPL），只在本地使用，不随项目分发。

## v13：闭环连杆 + 步态编辑器

- `public/demo/fourbar.obj`、`fourbar-functions.svg`、`fourbar.project.json`（`scripts/make-fourbar-demo.mjs`）和 `public/demo/quad.obj`、`quad-functions.svg`、`quad.project.json`（`scripts/make-quad-demo.mjs`）：本项目自制示例，**CC0**。四足的舵机是按 MG90S datasheet 外形尺寸画的简化方块，不是厂家 CAD。
- 步态编辑器、测量、固件头文件生成都是本项目代码（`src/gait/`），没有引入新的第三方库。

## v12：关节 + 运动

- `public/demo/arm2dof.obj`、`arm2dof-functions.svg`、`arm2dof.project.json`：本项目用 `scripts/make-arm-demo.mjs` 自制的 2 自由度机械臂示例，**CC0**（可以随便用）。舵机外形是按 datasheet 外形尺寸画的简化方块，不是厂家 CAD。
- 舵机参数出处：Tower Pro MG90S datasheet、SG51R 商品 / 数据页（见 `src/modellab/servos.js` 里的 `src` 字段）；只引用数字，不包含它们的文件。

## v11：模型 + 功能图（`/assembly/model`）

- `occt-import-js`（LGPL-2.1）：v11 起也在网页里用（读上传的 STEP）。作为单独的 JS + wasm 文件、第一次上传 STEP 时才从本站加载，未修改，用户可以替换成自己编译的版本；源码：https://github.com/kovacsv/occt-import-js 。
- `pdfjs-dist`（Apache-2.0）：读 PDF 功能图的一页，按需加载，`isEvalSupported: false`。
- `three` 自带的 `GLTFLoader` / `OBJLoader` / `STLLoader` / `meshopt_decoder`（MIT）。
- `public/demo/octo-v10.glb`、`octo-v10-functions.svg`、`octo-v10.project.json`：本项目自制（从 v10 预设导出，glTF-Transform + meshoptimizer 压缩），与本仓库同许可。
- `e2e/fixtures/v11/*`：本项目用脚本生成的测试样例，CC0（见 `LICENSE-samples.txt`）。
- e2e 测试里用到的 KiCad `SOT-23.step` 来自 KiCad 3D 库（CC-BY-SA 4.0 + 例外条款），只在本地测试时读取，不随网站发布。
