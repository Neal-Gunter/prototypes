# 硬件验证 · 概念演示

Clickable concept mock for a browser place where a maker walks a hardware idea through idea, simulation, and assembly. The interface copy is Simplified Chinese. Every page shows the banner `Concept mock, not a working product`.

This is not a working product. Nothing here loads MuJoCo, simulates an ESP32-S3, stores a waitlist, or gives real soldering instructions.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173

```bash
npm run build
npm run preview
```

## Pages

- `/` — pitch, flow (想法 → 仿真 → 装配), three feature cards, who-it's-for strip, waitlist form
- `/workbench` — **hardware workbench, early prototype, simplified simulation** (see below)
- `/assembly` — **assembly bench (v4), early prototype, simplified simulation**: Rapier collisions, standoffs/screws/nuts M2/M2.5/M3, base plate, headers, JST/Dupont/USB plugs, breadboard, servo bracket + horn + tentacle, automated demo
- `/parts` — parts library: 564 open-source CAD parts (real mm sizes, thumbnails, licence per part, no prices) + 76 procedural
- `/electrics` — now redirects to `/assembly?scene=electrics` (v5: one bench for assembly + circuit)
- `/assembly/guide` — printable assembly guide (BOM, wiring table, breadboard holes, steps, `.ino`, 对照现实 readings, safety notes); `?src=default|bench`
- `/credits` — asset sources and licences
- `/example` — eight-tentacle robot driven by an ESP32-S3, with tabs 想法 / 仿真 / 装配 (`?tab=idea|simulate|assemble`)

## What is stubbed

- MuJoCo WASM mechanical / physics panel: placeholder, library not loaded
- ESP32-S3 firmware / MCU panel: placeholder, chip not simulated
- Servo slider: animates a tentacle drawing only; it does not drive either panel
- Soldering checklist: sample lines for the mock; ticks stay in page state
- Waitlist: email plus an optional free-text answer, held in page state only; nothing is sent or stored


## Workbench (`/workbench`): early prototype, simplified simulation (v3)

The page shows the label 早期原型，简化仿真 and a list of what is simplified. The assets and their licences are listed on `/credits` and in `LICENSES.md`.

There are two modes:

- **自由搭建（引导）**: place the parts, cut the wires, strip them, solder, screw the servo down, plug in USB, flash, then watch it move.
- **维修任务：机器人不动**: a pre-built robot has 3 hidden faults:
  - a cold joint on servo VCC;
  - the signal wire is on GPIO6 but the code says `attach(5)`;
  - there is no common ground.
  Find them with the magnifier and the multimeter, fix them, mount the servo and flash. The checklist gives a score with penalties for burnt pads, bridges, nicked wire, undo and fixing a fault before finding it.

### Real and procedural

- **Real CAD**: Feather ESP32-S3, the micro servo and the 4×AA holder. These are Adafruit STEP files (MIT), converted to GLB.
- **CC0 from Poly Haven**: the HDRI and the wood desk textures.
- **Procedural**: all the tools, the wires, the solder joints and the mat.

### Tools (keys 1–9)

You can pick a tool from the toolbar, the tray, or by clicking it on the desk. The tools are:

- magnifier: inspect a joint;
- wire stripper: 22/24/26 AWG holes, where only 24 strips cleanly;
- wire;
- flux pen;
- iron: hold the mouse on the pad, watch the pad temperature, hold Space to feed solder;
- solder wick;
- solder pump;
- multimeter: continuity with a beep, or DC volts;
- screwdriver: hold to drive the M2 screws.

The workbench also has:

- undo/redo with Ctrl+Z and Ctrl+Y;
- camera presets;
- an iron temperature setting from 200 to 450 °C.

### How it is simplified

- **Soldering**: pad temperature uses a first-order heating/cooling model. Solder wets above 217 °C and wets well at 237 °C or more. Joint quality depends on:
  - flux;
  - solder volume;
  - heat time;
  - whether the wire was stripped.
- **Faults**: too much solder makes a bridge, too long at high temperature burns the pad, and an unstripped wire makes smoke and a cold joint.
- **Multimeter**: readings come from net connectivity, not circuit solving. The voltages are fixed: battery 6.00 V, USB 5.00 V, 3V 3.30 V.
- **Firmware**: a small Arduino-style interpreter runs in a Web Worker. It is not an ESP32-S3 emulator. The flash progress is cosmetic. The serial plotter shows the command and the servo angle.

### Walkthrough

Run these commands:

```bash
npm run build
npx vite preview --port 4173 &
CHROME=/usr/bin/google-chrome OUT=./e2e-shots node e2e/walk.mjs
```

- **Build mode**: place the parts, wire, try 22 AWG (it fails), strip at 24 AWG, show a tap with no feed, solder 7 joints, screw the servo, plug USB, flash, check that the servo angle changes.
- **Repair mode**: inspect, find the faults with the meter, reflow VCC, wick GPIO6 and move the wire to GPIO5, add a ground wire, screw, flash, and wait for the "done" state.
- Set `ONLY_REPAIR=1` to run repair mode only.

The script uses `window.__wb` test hooks only to find where things are on the screen and to read state. All actions are real mouse and keyboard input.

## v4: assembly bench, parts library, simplified electrics

### Parts library (`public/lib/`)

- 564 real CAD parts converted to GLB by `scripts/convert-library.mjs`: Adafruit CAD Parts (MIT) 450, KiCad packages3D (CC BY-SA 4.0) 114. Every GLB is under 2 MB; `public/` is about 38 MB. Each category is lazy-loaded from `public/lib/catalog/<cat>.json`.
- 25 procedural parts (fasteners M2/M2.5/M3, base plate, Dupont wire, tentacle, tools) in `src/assembly/procedural.js`, sized from ISO/DIN nominal values. A value that was not checked is shown as 估算.
- Thumbnails: `public/lib/thumbs/<id>.webp`, rendered from the GLBs by `scripts/make-thumbs.mjs` (run `npx vite --port 5199` first).
- Thin categories: motor 10, breadboard 13, wire 5. No fasteners or tools come from CAD (those are procedural). This is far from every part on the market.

### Collisions (`src/assembly/engine.js`)

- Rapier (`@dimforge/rapier3d-compat`) contact solving, plus a depenetration pass after every step for awake bodies.
- Dragging pushes a chain of touching parts and does a vertical sweep. New parts spawn without overlap. Inward velocity is removed on depenetration.
- Limits: about 0.3 mm transient overlap while dragging fast; low parts can be ridden over; colliders are boxes (toggle "碰撞盒" to see them).
- Tests: `scripts/engine-test.sh` runs the node-side overlap tests (44/44); `e2e/asm-walk.mjs` runs the browser demo and measures penetration every frame.

### Electrics (`/electrics`)

- Fixed simplified circuit, steady-state Ohm's law only. The LED forward voltage of 2.0 V is a typical value (估算). The full list of simplifications is on the page.
- Test: `node e2e/electrics.mjs`.

## v5: one bench, linked to the real world (early prototype, simplified simulation)

- **One bench** (`/assembly`): assembly, wiring and the simplified circuit run in the same scene. `/electrics` redirects to `/assembly?scene=electrics`.
- **Real-world bridge**:
  - "生成装配指南…" opens `/assembly/guide`, built from the state on the bench: BOM with sizes and sources, a net/wiring table, breadboard holes, steps and `.ino` download.
  - Print it or save it as PDF from the browser; the print CSS hides the site chrome.
  - "导入清单" rebuilds a circuit from a text list.
  - "对照现实" in the circuit panel lists what a multimeter should read on the real build, using the same simulated values.
  - Safety notes are included.
- **More parts** (76 procedural, all made in this project, CC0):
  - socket-head cap screws M2/M2.5/M3 (ISO 4762), washers (ISO 7089) and hex keys (ISO 2936);
  - breadboards with 830, 400 and 170 holes (2.54 mm pitch; outer size 估算);
  - motors: NEMA 17 at 34/40/48 mm (42.3 mm flange, 31 mm M3 hole spacing), 28BYJ-48, N20, 130 and a coin vibration motor;
  - desk tools: tweezers, cutter, stripper, multimeter, solder pump and solder spool;
  - Dupont wires at 10 and 30 cm.
  - No licence-clean CAD models were found for these, so they are built from primitives, and unverified shapes are marked 估算.
- **Collisions**:
  - The active tool is a kinematic collider. It moves at most 2 mm per physics step, so a mouse jump pushes parts instead of teleporting through them.
  - Wires are 20-segment capsule ropes with CCD. They collide with parts, the bench and tools.
- **Tests**:
  - `sh scripts/engine-test.sh` runs `e2e/engine-node.mjs` (44 checks), `e2e/engine-v5.mjs` (12 checks) and `e2e/elec-node.mjs` (24 checks).
  - The v5 checks cover: every new part dropping and stacking without overlap, the hole counts 830/400/170, the screwdriver pushing a NEMA 17 (sweep and one-frame jump), and a breadboard dropped on a wire and dragged with no rope segment inside the board.
  - `CHROME=/usr/bin/google-chrome node e2e/v5-walk.mjs` runs the browser walkthrough. It writes screenshots, `guide.pdf` and `v5-walk.json` to `../v5/`.
- **Simplified**:
  - Washers do not change screw clamping.
  - Hand tools on the bench are props: only the screwdriver, soldering iron and probes act.
  - The mini/full breadboard tops are drawn without hole detail.
  - The import list's coordinates are tuned for the 400-hole board.

## v6：小智八爪鱼复刻（早期原型，简化仿真）

按用户给的 md（`octopus-ai/` 目录 9 个文件，副本在 `src/assembly/octopus/md/`）在装配台上复刻八爪鱼。装配台右侧“八爪鱼”标签页，或直接打开 `/assembly?scene=octoA` / `?scene=octoB`。

- **预设**：方案A（8 个 MG90S，每条只摆）和方案B（16 个 MG90S，每条摆 + 抬）。
- **按 md 阶段装**：阶段 0（只有语音部分）→ 1（1 个舵机）→ 2（PCA9685 + 独立电源 + 4 个舵机）→ 3/4（整只上台）；阶段 5 只有文字。
- **零件**：库里有真实 CAD 的用真实的（PCA9685 Adafruit 815、MAX98357A Adafruit 3006、喇叭 Adafruit 3923 作为 md 的 8 Ω 2 W 的最接近件、MG90S 用 Adafruit 1143、ESP32‑S3‑WROOM‑1 和 220 µF 电解电容用 KiCad 模型）；其余 10 个按数据手册尺寸程序生成，标“估算”。
- **接线和供电**：按 md 的引脚表接线。舵机 V+ 走 XL4015 6 V → PCA9685 V+ 端子，ESP32 由第二块 XL4015（5 V，md 没写，补充）供电，并且共地。电路检查逐条对照 md。
- **固件**：`body_firmware_A.ino` 和 `octopus_*.h` 的 JS 移植，跑在寄存器级的 PCA9685 替身上（预分频、MODE1、LEDn）。“固件修正”可以逐项开关，全关就是 md 原样。
- **小智 MCP**：`self.octopus.action` / `self.octopus.set_gait` 做成按钮，另有一个文字框。语音、云端识别、大模型、WiFi / 蓝牙都是**模拟**：文字框用关键词规则代替大模型。
- **故障场景**：没共地、PWM 不是 50 Hz、舵机 V+ 从 ESP32 取电、360° 舵机、机械超限、phase = 0、I2C 地址、6 V 模块没调压、电池没电，每个都标了 md 出处。
- **指南**：`/assembly/octopus-guide` 包含台面物料（不含价格）、md 原价（标“来自你的 md”）、接线表、台面引脚表、对照现实、出处表、md 问题清单，以及 md 原文固件（可下载）。
- **测试**：`node scripts/octo-test.mjs`（19 项）。浏览器走查：`cd ../e2e && node ../prototypes/e2e/octo-walk.mjs`，截图和 `walk-result.json` 写到 `../v6/`。
- **简化的地方**：
  - 触手的 3D 刚体固定，舵机转动只改画面姿态；位移和转向在俯视图里用摩擦模型估算。
  - 电流是估算值。
  - 只做直流层面的电压、电流检查。

## v15：多工况鲁棒搜索 + 横坡侧滑补偿 + Worker 池（早期原型，简化仿真）

全部是软件仿真，没上实机；数字都是仿真值，不是实物速度。

- **多工况鲁棒搜索**（搜索目标“多工况鲁棒（v15）”，`node scripts/gait-robust.mjs <种子> <次数> wheel|ball 240|300 out.json [v14]`）：每个候选在 6 个训练工况（μ、负载、坡度、随机种子组合）上跑，按平均值和最差值打分，侧漂大了扣分，最大角速度超过限速也扣分。之后在 11 个**留出工况**上复评，这些工况不参与训练，和训练集不重合（有测试）。留出工况结果（平均速度 / 最差速度 cm/s / 最大侧漂 cm）：
  - 定向小轮：同步划桨 3.50 / −1.29 / 5.85；v14 4.66 / 0.83 / 10.4；**v15 预设** 3.76 / 0.01 / 7.25（最大角速度 234 °/s）。
  - 万向珠：同步划桨 3.16 / −1.32 / 26.3；v14 4.54 / 0.91 / 26.8；v15 3.72 / 0.02 / 41.6。
  - 老实说的结论：**只部分泛化**。用定向小轮时，v15 比 v14 侧漂小（7.2 vs 10.4 cm），但平均慢约 19%，而且在 2° 上坡几乎走不动。侧漂下降主要靠支点硬件，不是靠步态。在 240 °/s 限速下 v14 仍然更快（只慢 3.9%）。从 v14 出发再搜一次（种子 2，600 次），留出工况 3.66 / 0.02 / 7.24，没有更好。用万向珠训练出的步态（最大角速度 195 °/s）换上定向小轮后是 2.76 / 0.91 / 3.55：最稳，但最慢。这几个结果都留在 `v15/robust-*.json` 里，台面预设没换。
- **限速 240 °/s（舵机标称 300 °/s 的 80%，我的补充）**：搜索时作为约束；固件导出时加 `#define OCTO_SERVO_RATE_DPS 240.0f`，`bank_.SetMaxRate` 用这个值。速度代价（平地 10 s）：同步划桨 3.757 → 3.488 cm/s（−7.2%），v14 4.733 → 4.547（−3.9%）。在搜索层面，240 限速比 300 限速在留出工况上平均慢 4.5%。
- **横坡侧滑补偿**（台面“横坡侧滑补偿”面板：5 组各跑 10 s；支点下拉框会实时换掉 3D 台面里的支点）。3° 横坡、同步划桨、10 s 侧漂：
  - 万向珠开环 36.3 cm；万向珠 + v14 闭环 45.0 cm（闭环修不了侧滑）。
  - 换成**定向小轮** 8.3 cm。
  - 定向小轮 + 航向闭环 4.7 cm。
  - 定向小轮 + **路径保持 PI** 3.4 cm，但速度从 4.24 降到 2.77 cm/s。按步态不同，侧漂补偿会让速度掉 15–35%。
  - 零件库新增 `p-octo-caster-wheel`（定向小轮：轮 Ø8 × 3 mm，支架 12 × 10 × 10 mm，2 g）和对照件 `p-octo-caster-lock`（锁死的万向珠）。尺寸、质量、摩擦都是**估算**。
- **Worker 池**：搜索时按 `navigator.hardwareConcurrency` 开评估 Worker（本机 8 个），结果和单线程逐位相同（有测试）。浏览器里同一任务从 1.06 提到 4.50 次评估/s（之前测的是 1.16）；鲁棒任务约 6.9–7.7 次仿真/s。命令行从 1.05 提到 3.84 次评估/s。
- **固件**：`GAIT_SRC=v15 CTRL_CFG=scripts/ctrl-wheel.json sh scripts/fw-compile.sh`。各组合的大小：
  - v10 + 步态 + 闭环：711888 B；
  - 完善版 OCTO_RIG=8 + 闭环：624456 B；
  - 我们的文件 0 警告。
- **老实说的限制**：
  - 路径保持需要外部的横向位置来源。仿真里直接读位置；C++ 固件里有 `SetLateral()`，但现在没有东西给它喂数据，所以 `lat_ok_` 一直是 false，实机上只剩航向闭环。
  - 定向小轮的尺寸和摩擦是估算。
  - v15 步态在上坡上几乎不动。
  - 头文件只编译过，没上板。
- **可选的下一步（本版没做）**：用 Web Serial 做硬件在环调参。浏览器连上板子以后读 IMU、下发增益，再拿实测值对照仿真。
- **测试**：`node scripts/v15-test.mjs`（19 项，已加进 `sh scripts/engine-test.sh`）；浏览器走查 `node e2e/v15-bench.mjs`（15 项，会录 demo.mp4）。

## v14：自动步态搜索 + 倾角闭环（早期原型，简化仿真）

**网址**：八爪鱼 https://neal-gunter.github.io/prototypes/assembly?scene=octo （“▶ v10 紧凑无线版”装好后，右侧“自动步态搜索”“闭环（IMU）”两块）；四足 https://neal-gunter.github.io/prototypes/assembly/model?demo=quad （“运动”里同样两块）。

- **自动步态搜索**（`src/gait/search*.js`、`search.worker.js`，我的补充）：sep-CMA-ES，在 Web Worker 里跑，页面不卡；每个候选 = 4 s 站稳 + 10 s 步态的完整 Rapier 仿真（固件孪生里的防碰撞、限位 90±55°、限速 300 °/s 照样生效）。目标：速度优先 / 直线优先 / 省电 / 自定义权重（公式在面板上写明）；可选左右对称（21 维）、“在 μ 0.3 / 0.5 / 0.8 上取平均”（防过拟合，慢 3 倍）、搜完做鲁棒性复评（μ、机身质量 ×0.9 / ×1.1、5 个随机种子：每个关节 ±2° 装配零位误差 + 0–1 s 起步延迟，估算）。可以取消；结果可预览、应用到编辑器、导出 JSON / `octopus_gait_custom.h`。命令行同款：`node scripts/gait-cma.mjs`、`node scripts/quad-search.mjs`。
- **v14 预设“v14 自动搜索（速度优先）”**：命令行 CMA-ES（约 390 次评估）搜出来的。10 s、μ = 0.5（仿真，不是实物速度）：v13 同步划桨 3.757 cm/s、侧漂 0.27 cm、航向 0.7°、10.13 J（0.27 J/cm，估算）→ v14 开环 4.733 cm/s（+26%）、侧漂 0.45 cm、航向 11.7°、11.24 J（0.24 J/cm）→ v14 + 闭环 4.640 cm/s、侧漂 −1.97 cm、航向 3.3°。鲁棒性复评：平均 4.63 vs 3.63 cm/s，最差 3.38 vs 2.47 cm/s，但最大侧漂 2.43 vs 1.40 cm（更偏）。“直线优先”搜出来的单点很直（侧漂 −0.10 cm），复评最大侧漂 7.04 cm → 过拟合，没有用作预设。浏览器里只给 120 次评估时，从同步划桨出发找不到更好的（3.744 分保持）——要更多次数或用命令行。
- **倾角 / 航向闭环**（`src/gait/ctrl.js` 和固件 `octopus_ctrl.h`，同一套公式）：模拟 MPU-6050（量程 ±2 g / ±500 °/s 和固件里的寄存器配置一致；噪声取估算的保守值，不模拟零偏和温漂——固件上电静止 1 s 求零偏），互补滤波出横滚 / 俯仰，陀螺积分出航向；航向 PD 修左右两侧的划幅，倾斜 PD 修偏置。面板：4 个增益滑块、坡度 / 方向、2 s 时右侧加 30 g、开环 vs 闭环对比、台面上实时闭环。“自适应转向符号”（我的补充）：修正饱和而且越修越偏时翻转符号——因为坡上该往哪边修是按同步划桨标定的经验规则，换步态会反。数字（八爪鱼，仿真）：平地 + 30 g 航向 9.0° → 3.2°（同步划桨）、28.8° → 3.1°（v14，浏览器）；3° 横坡同步划桨 −46.1° → 0.8°，v14 −24.3° → −13.1°；四足 8° 横坡平均倾角 9.32° → 7.14°。
- **MPU-6050 零件 + 固件**：零件库 `p-octo-mpu6050`（Adafruit 3886 STEMMA QT 板：26.0 × 17.8 × 4.6 mm、1.8 g，按 Adafruit 产品页；板上引脚位置是估算）。接法：v10 接 QT Py 的 STEMMA QT 口（Wire1，SDA 41 / SCL 40，地址 0x68）；完善版和 PCA9685 共用一条 Wire。`octopus_imu.h` 直接读寄存器（不需要额外库），上电静止 1 s 求陀螺零偏。`node scripts/gait-export.mjs ctrl out.h` 导出控制参数；`GAIT_SRC=v14 sh scripts/fw-compile.sh`：v10 + 步态 + 闭环 712008 B（33%），完善版 OCTO_RIG=8 + 闭环 624564 B（47%），我们的文件 0 警告。
- **台面边界（我的补充）**：3D 台面只有 60 × 40 cm，v14 步态约 5 s 就会走到台边。现在整机（触手尖算进去）快出边时会被一起平移回起点（朝向、关节角不变），事件里记一条；测速、前进距离、轨迹照常累计。之前会走出台面、穿进台边（最深 36 mm）。
- **老实说的限制**：全部是简化仿真，没上实机；导出的头文件只编译过、没上板。三个万向球在横坡上整机侧滑（3° 横坡 10 s 侧滑 50–70 cm），闭环只修航向和倾角，不修侧滑；坡上修正方向的规则是经验的，自适应翻号是兜底；v14 步态最大角速度 294 °/s，离 300 °/s 限速很近，实机舵机可能跟不上；四足 8° 横坡闭环倾角更小但航向更偏。可选的下一步：3D 打印一条触手实测摩擦和速度（本版没做）。
- **测试**：`node scripts/search-test.mjs`、`node scripts/v14-test.mjs`（13 项）、`node scripts/ctrl-test.mjs`（25 项），都在 `sh scripts/engine-test.sh` 里；浏览器走查 `node e2e/v14-bench.mjs`（23 项，录屏 demo.mp4；`BASE` / `OUT` / `SHOTS=0` 可改）。

## v13：闭环连杆 + 台面步态编辑器（早期原型，简化仿真）

**网址**：八爪鱼 https://neal-gunter.github.io/prototypes/assembly?scene=octo （“▶ v10 紧凑无线版”装好后，右侧“步态编辑器”）；上传模型 https://neal-gunter.github.io/prototypes/assembly/model?demo=quad （四足示例，打开“运动”）、`?demo=fourbar`（四连杆）。

- **闭环连杆**：一块可以挂两个父关节（四连杆、曲柄滑块、平行连杆）。多出来的关节在 Rapier 里是额外的冲量约束；自由度面板用 Grübler 公式 + 当前姿态的旋量矩阵秩（我的补充）。示例四连杆与解析解：摇杆角误差 0.00°；曲柄滑块 0.001 mm；平行连杆连杆转 0.05°（`node scripts/loop-test.mjs`，15 项）。
- **步态编辑器**（`src/gait/`，八爪鱼和任意带驱动关节的上传模型共用）：每个关节一行——波形（正弦 / 三角 / 方波 / 锯齿）、幅度、相位、偏置、频率、占空，带实时预览曲线和总览图；超过舵机速度（八爪鱼按固件限速 300 °/s，上传模型按最慢那个驱动的 datasheet 速度）标“快”。预设：交替、波浪、三组轮换（类三足）、固件默认，八爪鱼另有“同步划桨”。公式：值 = 偏置 + 幅度 × 波形(t × 频率 + 相位/360°)。
- **测量**：后台另开一个同配置的物理世界跑 N 秒（不影响页面上那台），给出前进距离、速度、侧向漂移、航向变化、打滑率、平均着地数、机身最大倾角、支撑多边形最小裕度、能量和功率（估算：∫|扭矩 × 角速度|，扭矩按跟随误差 × 刚度截到上限）、峰值力矩；最近两次并排 = 前后对比。“冰面对照（μ = 0）”把所有摩擦改成 0 再跑一遍：走得动的步态在冰面上应该不动。
- **导出**：步态 JSON（可再导入）；八爪鱼另有固件头文件 `octopus_gait_custom.h`（放进 `octopus_plus/`，`octopus_body.h` 用 `__has_include` 检测到就用它代替默认步态，之后照样过防碰撞 / 限位 / 限速）。`sh scripts/fw-compile.sh` 用 arduino-cli 把 v10 + 自定义步态编译通过。上传模型的步态存进 `project.json` 的 `gait`（按关节 id），导出 zip 带上。
- **数字（仿真，μ = 0.5，不是实物速度）**：v10 八爪鱼 15 s：固件默认 9.17 cm（0.612 cm/s，侧漂 −1.25 cm，航向 −9.5°）→ 同步划桨 56.6 cm（3.773 cm/s，侧漂 0.58 cm，航向 1.0°，无碰撞，最小支撑裕度 5.48 cm，能量 15.1 J 估算）；μ = 0 时两者都 ≤ 0.03 cm。同步划桨是 `scripts/gait-search.mjs` 随机搜索 280 组 + 细化 210 组得出的（我的补充，未上实机）；把单向脚垫换成各向同性只剩 9.1 cm、装反变成 −41.6 cm 倒退 → 推进力主要来自单向脚垫的摩擦差（0.15 / 0.45 是估算）。四足示例（对角小跑，1 Hz）10 s：41 cm（4.10 cm/s，侧漂 −0.87 cm，最大倾角 8.8°，14.1 J 估算）；1.5 Hz 6.1 cm/s；不抬腿 −8.4 cm；μ = 0 0.04 cm。
- **四足示例**：`public/demo/quad.*`，`node scripts/make-quad-demo.mjs` 生成（本项目自制，CC0）：机身 + 4 条腿，每条腿“前后摆 + 抬腿”两个 MG90S 关节；质量按 PLA 实心算（估算，没算舵机本体）。
- **圆角碰撞体（我的补充）**：Rapier 的尖角凸包和地面接触偶尔给出歪的法向，冰面上也会把机身推着走（四足示例不圆角时 μ = 0 漂 9 cm / 10 s）。工程里勾“圆角碰撞体”后凸包向内收 0.5 mm 再加 0.5 mm 圆角，冰面对照降到 0.04 cm。默认关（会让本来刚好贴着的零件互相碰到，旧的关节 / 连杆示例不适合），四足示例默认开。
- **老实说的限制**：全部是简化仿真，没上实机；四足每个周期走 ≈ 4 cm，比纯几何步幅（≈ 2.6 cm，估算）大，说明有滑动 / 机身扭动，数字只用来比较步态；四足的支撑裕度最小是负的（对角小跑时质心会出两脚连线，靠动态平衡）；能量是关节机械功的粗估（偏大，不含舵机电耗、发热）；步态是开环的（没有传感器反馈）；八爪鱼“在台面上跑”用的是固件 JS 孪生，导出的头文件只编译过、没上板。
- **测试**：`node scripts/gait-test.mjs`（21 项：波形 / 预设 / 夹范围、固件公式逐点一致、头文件往返、基线和同步划桨数字、μ = 0、脚垫灵敏度、四足小跑 / 冰面 / 不抬腿、工程 gait 读回）；浏览器走查 `node e2e/gait-bench.mjs`（23 项，录屏 demo.mp4）；`node e2e/fourbar-lab.mjs`（四连杆）。`sh scripts/engine-test.sh` 包含 gait-test 和 loop-test。

## v12：上传模型的关节 + 运动（`/assembly/model` 和装配台，早期原型，简化仿真）

**网址**：https://neal-gunter.github.io/prototypes/assembly/model?demo=arm （内置 2 自由度机械臂）；装配台 `/assembly?custom=demo-arm`。

- **关节**：转动（铰链）、滑动（导轨）、球关节、固定。“加关节”模式：点父模块 → 子模块 → 表面上的铰接点（转轴默认取表面法线）；也可以全用数字填：铰接点（mm）、轴（X / Y / Z 按钮或三个分量）、限位、回中位置。一块只能有一个父关节（树形），会提示双父 / 成环 / 引用不存在。关节存在原始模型坐标里，改单位 / 缩放 / 朝上时跟着走。
- **舵机**：MG90S（Tower Pro datasheet：1.8 kgf·cm、0.10 s/60° @4.8 V；2.2 kgf·cm、0.08 s/60° @6 V）、SG51R（0.6 kgf·cm、0.1 s/60° @4.8 V，不外推）；自定义电机 / 直线推杆的数字由用户填，标“估算”。马达刚度 / 阻尼 / 转子惯量 / “负载%”是估算。
- **运动（Rapier）**：每个刚体组一个刚体，关节用 Rapier 原生关节 + 原生限位（`setLimits`），舵机是按 datasheet 速度追目标的力控位置马达；凸包碰撞、摩擦，和地面 / 测试方块 / 其他模块碰撞（关节两侧那一对不算）。每个关节一个滑块 + “测试”扫描；“负载”“堵转 / 被挡住”提示；穿透读数；起始重叠警告。
- **功能 ↔ 关节**：功能面板勾选关节；运动开着时选中功能 = 播放它的关节，“▶ 播放”会自动打开运动。
- **姿态 + 时间轴**：存 / 调 / 改名 / 删除姿态；关键帧（时间 + 姿态）线性插值，可循环。
- **导出 / 导入**：关节、姿态、时间轴、`sim`（固定底座、测试方块位置）都在 `project.json` 里；v11 的工程包照常能导入（没有关节 = 一块）。
- **装配台**：带关节的工程每个刚体组一个刚体，左侧出现关节面板（滑块、测试、功能、姿态、时间轴）；底座可固定在桌上；删掉其中一块后关节失效并提示。
- **内置示例**：八爪鱼（8 个偏航关节，SG51R）；2 自由度机械臂（本项目自制，CC0：`public/demo/arm2dof.*`，`node scripts/make-arm-demo.mjs` 生成）。
- **老实说的限制**：球关节没有马达，摆角限位是自写的软限位；Rapier 限位是软约束（用超过堵转扭矩的力硬扳时会超出几度，测试里 ≤4°）；关节两侧那一对不碰撞；不支持闭环连杆（v13 起支持，见上）；碰撞是凸包，不是逐三角形；不模拟电流、发热、齿轮间隙；装配台上关节面板只能调用 / 播放，编辑要回模型页。
- **测试**：`node scripts/artic-test.mjs`（38 项，含限位、速度、碰地堵转、推方块、球关节、滑动、zip 往返、v11 兼容）、`node e2e/artic-bench.mjs`（12 项，装配台）、浏览器走查 `node e2e/artic-lab.mjs`（32 项：3D 里点出关节、数字编辑、滑块、测试、姿态、时间轴推方块、功能播放、导出再导入、装配台关节面板）。`sh scripts/engine-test.sh` 全部包含前两个。

## v11：模型 + 功能图（`/assembly/model`，早期原型，简化仿真）

上传自己的 3D 模型和一张功能图，把两者结合起来：模型拆成模块，功能图上画热点，功能 ↔ 模块绑定、双向高亮，再把模型放上装配台做碰撞（不穿模）。

- **只在本机**：文件在浏览器里解析，不上传、不联网下载外部资源；工程存在 IndexedDB，可导出 / 导入 `.modellab.zip`（`project.json` + 模型 + 功能图 + README）。
- **3D 模型**：GLB / glTF（内嵌资源，支持 meshopt；Draco 和外链 `.bin` 会给出提示）、OBJ（按 `g` / `o` 分组）、STL（二进制 / ASCII）、STEP（`occt-import-js`，第一次用时才加载 ~7.6 MB wasm）。上限见 `src/modellab/limits.js`（GLB 40 MB、STEP 15 MB、三角形 300 万等）。
- **尺寸**：单位（mm / cm / m / in，自动猜并说明理由）、缩放、朝上的轴、真实尺寸读数、银行卡（ISO/IEC 7810 ID-1）对照、尺寸异常警告。
- **模块**：按组 / 网格自动拆、按连通块拆、选网格拆出新模块、移动网格、合并、改名、改色；每个模块的碰撞体（凸包 / 方块）、材料（估算质量）、实测质量。
- **功能图**：PNG / JPG / SVG（拒绝脚本、事件属性和外链）、PDF 的一页（`pdfjs-dist`，转 PNG）。矩形热点 → 功能（名称、类型、说明、引脚 / 信号）。
- **结合**：绑定模式（点热点再点模块）或列表勾选；点热点 ↔ 点模块双向高亮；隐藏 / 隔离模块、隔离功能、按模块 / 按功能爆炸；树：功能 → 模块 → 网格。
- **装配台**：`/assembly?custom=<工程 id>` 或 `?custom=demo`，没有关节时整个模型一个刚体（v12 起有关节时见上），每个模块一个碰撞体（`engine.addAssembly` 会把它抬出重叠）。
- **内置示例**：v10 八爪鱼（`public/demo/`，本项目自制）：27 个模块、9 个功能，162 × 61 × 162 mm，质量按 v10 质量表 116.8 g（估算）。重做：`npx vite build && npx vite preview --port 4173`，`npx esbuild scripts/gltfx-entry.js --bundle --format=iife --outfile=.tmp/gx.js`，`node scripts/export-demo-glb.mjs`，`node scripts/compress-glb.mjs /tmp/octo-v10-raw.glb public/demo/octo-v10.glb`，`node scripts/make-demo-project.mjs`。
- **简化（老实说）**：碰撞是凸包 / 方块，不是逐三角形；质量是体积 × 密度估算；绑定只是标签，不做电路仿真；单位靠猜；贴图 / 动画忽略；爆炸图是示意。
- **测试**：`sh scripts/engine-test.sh`（含 `modellab-test` 33 项、`modellab-engine` 9 项）；浏览器走查 `node e2e/modellab.mjs`（先 `npx vite build && npx vite preview --port 4173`，40 项：GLB / OBJ / STL / STEP + SVG / PNG / PDF 上传、画热点、绑定、拆分 / 合并、隔离 / 爆炸、导出再导入、坏文件、装配台碰撞）。样例在 `e2e/fixtures/v11/`（CC0，`node scripts/make-v11-samples.mjs` 生成）。

## v10：紧凑无线版（我的补充，早期原型，简化仿真）

**网址**：https://neal-gunter.github.io/prototypes/ → 装配台 → 八爪鱼 → “▶ v10 紧凑无线版”（预设 `octo-preset-v10`）。指南：`/assembly/octopus-guide?variant=v10` 第 13 节。

电池、主控、升压都装在机身上，没有墙插，也没有 USB 线。USB‑C 只在充电时插。手机用 BLE 遥控，指令和完善版一样。只用商品页或数据手册查得到尺寸的零件，每个数字都在 `src/assembly/octopus/v10.js` 里写了出处。

| 项目 | v9 方案B 完善版 | v10 紧凑无线版 | 说明 |
|---|---|---|---|
| 质量 | 449 g（估算） | 117 g（估算：页面数字 66 g + 估算 51 g） | 约 −74% |
| 触手展开直径 | 26.0 cm | 16.5 cm | 在装配台里按 3D 碰撞盒量 |
| 高度 | 6.0 cm | 4.8 cm | 同上 |
| 包络体积（外包圆柱） | ≈ 3 184 cm³ | ≈ 1 036 cm³ | 约 −67%（估算口径） |
| 舵机 | 16 × MG90S | 8 × SG51R（5 g/个） | Adafruit 2201 |
| 装配台零件 | 52 个（身上 42 + 桌上 10） | 26 个（全部在身上） | 实数 |
| 导线 | 48 根（32 根从桌上拖到机身） | 35 根（0 根离开机身） | 实数 |
| 供电 | 3S 锂电组 + 降压，放在桌上 | 1S 1200 mAh LiPo 装在身上 | Adafruit 258 |
| 续航 | 不估算（md 没写电池容量） | 约 4 h（估算） | 4.44 Wh ÷ 行走平均 1.0–1.15 W，电流模型是估算 |
| 速度（仿真，μ = 0.5，15 s） | 18.2 cm（≈ 1.2 cm/s） | 9.2 cm（≈ 0.6 cm/s） | v10 更小、触手更短，大约慢一半 |
| μ = 0 | ≈ 0 cm | ≈ 0 cm | 前进全靠摩擦 |
| 价格 | md 给了人民币区间 | 未核实，不写数字 | — |

**零件**（Adafruit 商品页核对）：
- QT Py ESP32‑S3 No PSRAM（5426）
- 8 × SG51R（2201）
- 1200 mAh LiPo（258）
- Micro‑Lipo USB‑C 充电板（4410）
- 2 × MiniBoost 5 V TPS61023（4654），每个带 4 个舵机
- 拨动开关（805），只管两个 EN 和 QT Py，舵机电流不经过它
- 100k/100k 分压板（我的补充）→ A3/GPIO8
- 2 颗电解电容
- PLA 骨架（Ø9 cm）、上层板（Ø8 cm）、8 根触手
- 3 个万向珠（估算）

**3D 和防穿模**：
- 全身是一个刚体组，所以引擎自带的穿模检测看不到组内零件之间的重叠。为此 `scripts/v10-clip.mjs` 另做一遍检查（OBB/SAT），内容是：
  - 两两零件穿透：最深 0 mm；
  - 舵机线到其它零件的间隙：+0.58 mm；
  - 触手扫过 ±55° 时的碰撞：0 次。
- 对照测试：故意把 QT Py 挪进骨架，检查必须报出来。
- 浏览器里行走时，和桌面的最大穿透约 0.04 mm。

**固件**：
- 用的还是 `octopus_plus` 文件夹，加 `-DOCTO_V10=1`。Arduino IDE 里就是把 `.ino` 顶部改成 `#define OCTO_V10 1`。
- 不用 PCA9685 和 I2C。8 个舵机直接接 GPIO 18 17 9 7 6 5 16 36，用 LEDC 出 50 Hz / 14 位 PWM，脉宽 0.75–2.25 ms。
- 电池检测在 GPIO8，开机先测一次。低于 3.55 V 拒绝动作指令；运动中掉到 3.55 V 以下就**立刻停 PWM**，舵机放松，不回中位。原因是仿真里发现：快没电时 8 个舵机一起回中，会把电池拉到 QT Py 欠压复位。改了以后，低电场景只启动 1 次，不再反复重启。回到 3.75 V 以上恢复。两个阈值都是估算。
- 编译：arduino-cli 1.5.1 + esp32 核心 3.3.12，板子选 `adafruit_qtpy_esp32s3_nopsram`。程序 708,324 B（33%），全局变量 63,344 B（19%），0 warning。完善版 RIG 8/16 仍然通过，621,324 B（47%）。用 `bash scripts/fw-compile.sh` 复现。**没上过实物。**

**测试**：
- `node scripts/octo-test.mjs`：76 项通过，其中包括：
  - v10 防穿模、线间隙和触手扫掠，加上对照组；
  - μ = 0.5 前进、μ = 0 不前进；
  - 两项 C++ 静态检查（LEDC 引脚、电池阈值）。
- `node e2e/octo-walk-v10.mjs`：
  - 截图、`walk-result.json` 和 `demo.mp4` 输出到 `../v10/`；
  - 浏览器里一键 GO，6.6 s 仿真走 4.1 cm，8 根触手着地，启动 1 次，没有 err；
  - μ = 0 时位移约 0；
  - 低电时停 PWM、不重启。

**LiPo 安全**：
- 只用 LiPo 专用的 CC/CV 充电器（板上的 4410），充电电流 ≤ 500 mA。
- 充电时人别走开，放在不可燃的表面上。
- 不要刺破、挤压电池。鼓包、漏液、发烫就停用，按规定回收。
- 保护板约 3.0 V 切断；固件在 3.55 V 就提前停运动。

**简化和限制（老实说）**：
- 升压输出 5.2 V，比 SG51R 标的 4.8 V 高。仿真不外推，扭矩按 4.8 V 封顶；实物要实测，或者换输出可调的升压。
- 开关页面没写额定电流。
- 电池线按 2 A 设计，8 路同时堵转时会接近这个值（估算）。
- 升压有限流（3.5 V 输入时最大 1.1 A）。
- 电芯带载低于约 3.4 V 时 QT Py 可能复位（估算）。
- SG51R 页面没写电流，电流模型是按 MG90S 估算缩小的。
- 万向珠没画进 3D，只在物理里算支撑；导线是近似走线。
- 速度只用来比较版本，不代表实物速度。

## v9：八爪鱼真的靠触手走路（物理行走，早期原型，简化仿真）

- **位移只来自物理**：`src/assembly/octopus/loco.js`。机身是 Rapier 刚体（重力 981 cm/s²），质量按 md 采购清单算（datasheet：MG90S 13.4 g；PLA 结构 150–250 g 是 md 的范围，取值是估算）：方案B 449 g，方案A 292 g，完善版A 301 g。每条触手是刚体连杆：偏航连杆 + 俯仰臂；尖球和下段胶囊体会和桌面碰撞并带摩擦。关节由模拟 PCA9685 输出的舵机角度驱动，力矩上限是 MG90S 堵转扭矩（datasheet：4.8 V 1.8 kgf·cm，6 V 2.2 kgf·cm，按舵机电压插值）。v8 那种运动学摆位已经删掉：不接物理时，机身不动。
- **步态分析（我的补充）**，μ = 0.5（估算，可调），node 测试，10 s：
  - 完善版B：直行约 12 cm，每周期 2.05 cm，打滑率 0.83，向侧面漂约 7 cm（俯仰轴都偏在同一侧，手性导致）；原地左转 / 右转 6 s 约 115°。
  - 完善版A：直行约 11.7 cm。
  - md 原样 A：只有偏航，底板贴桌，走不动。最小改动：脚垫 + 预压，也就是完善版A 的万向珠、单向脚垫和触手预压 30% 重量。
  - md 原样 B 和 v8 的 B 步态（相位 0、不下压）：原地踏步，前进 < 1 cm。最小改动是“交替步态 + 支撑相下压 20°”，固件加了 `PRESS=`。
  - 扭矩：静态只需约 0.36 × 堵转扭矩；瞬间峰值会到 100%（落脚冲击），UI 里有显示。
- **导线**：v9 只做提示。导线两端直线距离达到线长 90% 就显示“实物里会拉紧”；导线不拽机身，机身也不会被瞬移。
- **UI**：“走路物理”框显示速度、每周期前进距离、打滑率、着地触手数、每条触手承重（g）、机身离桌高度、底板承重、峰值扭矩，以及 μ 滑块。新增镜头“走路侧视”。
- **测试**：`node scripts/octo-test.mjs` 56 项通过，其中包括：μ = 0 时 A、B 都不前进；md A、md B 和 v8 B 步态都走不动；不接物理时不动；完善版B 底板承重 < 5%。`bash scripts/engine-test.sh` 44 项通过。完善版固件重新编译：620,932 字节（47%）。
- **走查**：`cd ../e2e && node octo-walk-v9.mjs`，截图、`walk-result.json`、`demo.mp4` 在 `../v9/`。浏览器是软件渲染，大约 0.4× 实时；按仿真时间算，完善版B 约 0.8 cm/s，完善版A 约 1.2 cm/s。
- **已知限制**：
  - 摩擦各向同性（完善版A 的单向脚垫按滑动方向切换摩擦来近似）。
  - 没有导线力。
  - PLA 弯曲只在完善版A 用一个估算柔度来代表。
  - 完善版B 有侧漂。
  - **完善版B 支撑相触手尖球会陷进桌面约 2.2 mm**（完善版A 约 0.3 mm）。这是 Rapier 冲量关节在“4 g 触手托 449 g 机身”这种质量比下的求解器残差：改迭代数、步长、接触刚度都不变，和连杆质量成反比。UI 和测试都如实报出，阈值 2.5 mm。

## v8：步态提速 + 重新编译 + 上手更简单 + 如何实际动手做（早期原型，简化仿真）

- **方案B · 完善版步态（我的补充 / 估算）**：v7 把相邻触手的最小间隙按 2·atan(1.55/4.27) ≈ 40° 估，太保守，偏航被夹到约 ±6°，几乎不走。v8 在台面 3D 碰撞体上实测（`e2e/gapB.mjs`）：相邻触手 13° 才碰。仿真碰撞阈值 `GAP_B = 13`，固件 `MIN_GAP B = 16`（13° + 3° 余量），默认 `yaw_amp 20°、lift 25°、0.6 Hz`。仿真时间里直行 0.22 → 约 1.4 cm/s（node 测试），10 s 原地转 99° → 132°，0 次碰撞。浏览器（软件渲染，约 0.4× 实时）里按仿真时间算是 1.1 cm/s。
- **重新编译**（arduino-cli 1.5.1 + esp32 core 3.3.12，`bash scripts/fw-compile.sh`，日志在 `/tmp/octo-fw`）：
  - 完善版，ESP32-S3：方案A（8 舵机）和方案B（16 舵机，`-DOCTO_RIG=16`）都是 620,776 字节（47%），全局变量 30,720 字节（9%），0 个警告。两个固件的 md5 不同，说明宏确实生效了。
  - md 原样 `body_firmware_A`：在 ESP32-S3 上编译失败，因为 S3 没有经典蓝牙，没有 `BluetoothSerial`。在经典 ESP32 上也失败，因为 `OctopusBody` / `Pca9685` 没有默认构造。这和问题清单一致。
  - `octopus_mcp.cpp` 桩编译：小智工程的头文件编译时从上游下载，不随项目分发。`McpServer` 换成空实现，只用来检查语法和类型。300,469 字节，不是可用固件。
- **上手**：八爪鱼面板顶上有“一键开始”（方案A / 方案B 完善版：装好 → 通电 → 自动 GO），默认镜头能看清机身。阶段 / 故障 / 固件模式 / 步态滑块 / 串口 / 通道监视都收进“高级设置”折叠。已在 1366×768 和 1280×800 下检查：没有横向滚动条，一键按钮不用滚动就能看到。
- **指南**：加了目录（12 节，点击跳转）。新增第 12 节“如何实际动手做（我的补充）”：7 步流程，每步写出处；另有锂电池和焊接安全提示，分别标出“md / 完善版写到的”和“通用安全常识，我的补充”。没有出处的只写做法，不写数字。
- **测试**：`node scripts/octo-test.mjs` 45 项通过，`bash scripts/engine-test.sh` 44 项通过。走查：`cd ../e2e && node octo-walk-v8.mjs`（副本在 `e2e/`），截图、`walk-result.json`、`demo.mp4` 在 `../v8/`。

## v7：完善版（我的补充）+ 3D 触手动起来（早期原型，简化仿真）

- **两套预设**：`方案A / 方案B` 仍是 md 原样（一字不改）；新增 `方案A · 完善版 / 方案B · 完善版`，把 md 问题清单（29 条）逐条改掉，每处都标“我的补充”。
- **完善版固件**：`src/assembly/octopus/plus/octopus_plus/`（`octopus_plus.ino` + `octopus_gait.h` / `octopus_bus.h` / `octopus_body.h` / `octopus_batt.h`），用 arduino-cli 1.5.1 + esp32 core 3.3.12 编译通过（ESP32-S3，方案A 约 620 KB）；`plus/xiaozhi/octopus_mcp.cpp` 依赖小智工程的 `mcp_server.h`，没单独编译。`plus/小智八爪鱼-完善版.md` 是修订后的说明。
- **指南**：完善版构建后点“生成八爪鱼装配指南”，第 9 节改动表（md 问题 / 怎么改 / 理由 / 出处：datasheet、推理、估算），第 10 节物料（只用 md 自己写的价格，没写的标“md 无价格”），第 11 节可下载全部完善版文件。
- **3D 动作**：触手按模拟 PCA9685 的舵机角度转（方案B 摆 + 抬两级），整个机身按仿真位姿在台面上爬和转；导线超出 8 cm / ±45°（估算，按 20–30 cm 杜邦线）就“拉紧”，之后只在俯视轨迹里继续算。
- **镜头**：总览、俯视、机身特写、触手侧面、接线台面。
- **引擎修正（我的补充）**：
  - `V()` 之前把 Vector3 当数组读，导线途经点全是 NaN。现在接受 Vector3 / {x,y,z}。
  - `teleport` 之前把零件位姿直接当刚体位姿，机身第一次走动会跳 10 cm 多。现在会换算回刚体位姿。
  - 新增 `carry`：导线随机身一起搬，不再被甩成大圈。
  - 新增 `ties`：舵机线在底板上扎带成束，经中心立柱上到 PCA9685。
- **测试**：`node scripts/octo-test.mjs`（45 项）、`bash scripts/engine-test.sh`（12/12、24/24）。走查：`cd ../e2e && node octo-walk-v7.mjs`（副本在 `e2e/octo-walk-v7.mjs`），截图、`walk-result.json`、`frame-diff.json`（静止 vs 爬行的像素差 + 舵机角 + 机身位移）、`demo.mp4` 在 `../v7/`。
- **仍是模拟**：语音 / 云端 / 大模型 / BLE 链路、电流、摩擦步态模型；触手刚体不参与碰撞，只改画面姿态；机身位移是运动学摆位，不是足端摩擦力算出来的。
