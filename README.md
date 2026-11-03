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
- `/pinouts` — per-pin tables (v21): 29 boards / modules, 789 pins, source URL per board, 3V3 / 5V logic; unverified pins marked 估算
- `/parts` — parts library (v20, 3081 parts in v21): 2940 parts = 2415 open-source CAD (Adafruit MIT, KiCad / Espressif / Seeed CC BY-SA 4.0, SparkFun CC BY 4.0) + 525 procedural standard parts (CC0); real mm sizes, thumbnails, licence per part, no prices; search / filters / favourites / compare / size ruler / used-in
- `/electrics` — now redirects to `/assembly?scene=electrics` (v5: one bench for assembly + circuit)
- `/assembly/guide` — printable assembly guide (BOM, wiring table, breadboard holes, steps, `.ino`, 对照现实 readings, safety notes); `?src=default|bench`
- `/repair` — **维修关卡（v17）**：12 个由易到难的维修场景 + 关卡编辑器（早期原型，简化仿真）
- `/teardown` — **拆解模式（v29）**：3 台设备的分步拆解指南 + 安全 + 材料清单 + 完成勾选 + 存进零件库 + 爆炸图（早期原型，简化仿真；按公开资料整理，未经实物验证）
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
- Thin categories (v4): motor 10, breadboard 13, wire 5. No fasteners or tools come from CAD (those are procedural). This is far from every part on the market. **v20 update: 2940 parts, see the v20 section.**

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

## v35：键盘旋转 + 拆解指南打印 / 存成 PDF + axe-core 无障碍检查 + guide-lint 覆盖维修关卡 + 红外遥控器拆解（早期原型，简化仿真）

- **键盘旋转（我的补充，`SceneA11y.jsx`）**：3D 场景里选中零件后按 R 绕竖直轴转 90°，Shift + R 反向，Alt + R 每次 15°。转之前用 `engine.overlapAt` 预检，会穿模就不转并读出原因；固定件拒绝。读屏描述里多了“朝向 N°”。
- **打印 / 存 PDF（`src/teardown/guideSheet.js`）**：拆解指南页新增“打印 / 存成 PDF”和“下载打印版 HTML”。在浏览器里生成一页独立的 HTML（安全须知、工具材料勾选、每步 SVG 示意图、警告、停止点、模块表、笔记），用浏览器自带的“另存为 PDF”。不依赖付费服务和额外库。
- **axe-core 无障碍检查（开发依赖，MPL-2.0）**：`node e2e/axe-check.mjs`（`LANG_UI=en` 查英文）检查 16 个页面，规则集 WCAG 2.0 / 2.1 A + AA，严重（critical / serious）问题必须为 0。第一次跑查出：语言切换按钮的读屏名称不含可见文字（label-content-name-mismatch，每页都有）、可滚动的代码块不能用键盘聚焦（scrollable-region-focusable）。已修。axe 只在测试里注入页面，不进发布包。
- **guide-lint 覆盖维修关卡**：`scripts/guide-lint.mjs` 现在也检查 28 个维修关卡（id、星级、模板、故障类型和目标、量测点、期望读数区间、操作名和对象、换件在零件箱里、提示 ≥ 2、安全须知、电池 ≤ 24 V）。`scripts/guide-lint-selftest.mjs` 故意造 12 种错误，确认每种都能查出来。
- **红外遥控器拆解（第 12 台，3 V 直流）**：7 步、2 个停止点、6 个模块（3 个新近似件 + 红外 LED / 晶振 / 2 × AAA 电池座三个相近现成件）。文字本项目自写，按公开资料整理，未经实物验证。
- **测试**：`node e2e/v35-bench.mjs`（R / Shift + R / Alt + R、固定件拒绝、帮助标签、打印页弹出和内容、下载 HTML、page.pdf 生成真 PDF、英文页无汉字、帮助 / 致谢中英文、手机 / 宽屏不溢出）。
- **限制**：只能绕竖直轴转；打印版用的是简化示意图，不是照片；axe 自动检查只能查出一部分无障碍问题，读屏的实际体验没有真人测过。

## v34：按穿透深度放宽冷检间隔 + 细长件加时修穿透 + 3D 场景键盘和读屏 + 指南格式调研和 guide-lint（早期原型，简化仿真）

- **冷检间隔按穿透深度放宽（我的补充）**：醒着的零件 ≥ 12 个（`engine.coldCrowd`）时，已经连续 12 步以上没压进、或者压进不到 0.1 mm（`engine.shallowMm`）的零件改为每 3 步查一次（`engine.coldMax`，0 = 关闭）；压得深的立即回到每步查。`depenetrate()` 记下第一轮最深的穿透（`_dep`）来做判断。
  - 一开始用 4 步间隔，凸包基准的结束穿透有一次到 4.2 mm，改 3。之后 `engine-v5` 的 M8×16 两两叠落出现 0.349 mm（限制 0.1），改成只在 ≥ 12 个零件醒着时放宽后通过。
  - 重场景耗时（`PROF=1 node e2e/hull-bench.mjs`，同一台机器，同时段对比 v33 设置，估算）：体素盒 约 19.95 → 18.6–19.0 ms，凸包 约 15.4 → 14.3 ms，凸包 + 分层 约 14.6 → 12.1 ms；结束穿透 0.09–0.28 mm。
  - 冲击峰值（`peak-bench`，种子 0/1/2/3/5）：峰值平均 1.56 mm（最坏 1.81），v33 为 1.57 mm（2.60）。
- **细长件（我的补充）**：新基准 `node e2e/thin-bench.mjs`（长宽比 ≥ 4 的程序零件逐个斜着落下；`PAIR=1` 再在上面交叉落一根同款）。单根落下本来就稳（80 种，峰值平均 0.03 mm）；问题出在两根细轴交叉叠落：上面那根一步能走 2 cm，比轴还粗，Φ8×200 光轴留下一帧 3.5 mm 的压进。现在最细一边 ≤ 12 mm、长度 ≥ 4 倍宽度的单个零件（`engine.isThin()`，`engine.thinMm`，0 = 关闭）按“小件”加时修穿透：交叉叠落峰值平均 0.247 → 0.117 mm，细轴最坏 3.49 → 0.04 mm。试过加大细长件的转动阻尼（`engine.thinDamp` 4 / 8），弹跳次数只从 1.14 降到 0.96–1.01，默认不开。比桌面还长的型材（600 / 1000 mm）放不平、会搭在侧墙上，不在这项基准里。
- **3D 场景的键盘和读屏（`SceneA11y.jsx`）**：装配页的场景可以 Tab 聚焦（`role="application"`，`aria-label` 里写了按键说明）。← / → 或 [ / ] 切换零件，Home / End 跳到首尾，Alt + 方向键平移 1 cm（加 Shift 为 5 mm），Alt + PageUp / PageDown 抬起或放下 3 mm，回车读出位置，Esc 取消选中。选中的零件名称、序号和位置写进 `aria-live` 区域；另有一份隐藏的零件清单（按钮）。平移前用 `overlapAt` 查会不会穿模，固定的零件不让动。还没有用真实读屏软件试过。
- **GitHub 调研（先查许可，原创实现，致谢在 /credits#v34-research）**：wokwi-docs（MIT，`diagram.json` 的零件 + 连线结构和 `lint` 检查思路）、wokwi-elements（MIT）、OpenKnowHow（GPL-3.0，开源硬件文档元数据）、fritzing-app（许可 NOASSERTION）、BreadboardSim（GPL-3.0）、circuitjs1（GPL-2.0）；常见维修指南网站的“难度 / 时间 / 工具 / 零件 / 逐步 + 注意事项”结构（内容多为 CC BY-NC-SA，没有使用）。据此新增 `node scripts/guide-lint.mjs`：逐台检查拆解指南（id 唯一、≤ 24 V 直流、有电池就要有“电池先处理”、难度和时间、每步中英文、插图图层存在、停止点、模块零件在零件库里）。当前 11 台 / 76 步 / 64 个模块，0 个问题。
- **测试**：`node e2e/v34-bench.mjs`（键盘标签、→ 切换和读出、Alt + → 平移 1 cm、Esc、平移后穿透、帮助页和致谢页中英文、手机 / 宽屏不溢出）。
- **限制**：耗时数字只对这个基准场景、这台机器；细长件只改了穿透修正，弹跳没明显减少；键盘移动是瞬移（不是推着走），读屏只做了自动化检查。

## v33：同帧生成的重叠预检 + 密集落地限速 + 拖动推开按接触角 + AA 玩具车拆解（早期原型，简化仿真）

- **同帧生成重叠预检（我的补充）**：v32 遗留的“最开始几步压进约 1 cm”，用逐步追踪（`T0=1 node e2e/peak-bench.mjs`）查到原因：Rapier 的场景查询表只在 `world.step()` 里更新，同一帧里刚放下的零件互相查不到，生成位置的重叠预检形同虚设。现在 `makeBody` 把新零件记进 `_fresh`，`overlapAt` 先用包围球筛一遍，再对这些零件逐个形状做 `intersectsShape`；`world.step()` 之后清空。包围球预筛让基准场景从每个种子约 40 s 回到约 7 s。`engine.freshCheck = false` 关闭。
- **密集落地限速（简化仿真）**：修好预检后零件被摞得更高、落得更快，峰值往后挪。现在醒着的动态零件 ≥ 6 个（`engine.fallCrowd`）时，在 `world.step()` 之前把下落速度限制在 30 cm/s（`engine.fallMax`，0 = 关闭）。代价：密集场景里高处落下比真实自由落体慢。
  - 第一次把限速放在 `world.step()` 之后、并且对所有零件生效，`engine-v5` 的“两两叠落”测试里 M3×30 内六角螺丝出现单步 0.77 mm 的尖峰（限制 0.1 mm）；改成步前限速 + 只在密集时生效后通过。
  - 冲击峰值（`node e2e/peak-bench.mjs`，93 个零件，种子 0/1/2/3/5）：

    | | v32 | v33 |
    |---|---|---|
    | 峰值平均（最坏） | 9.6 mm（11.8） | 1.57 mm（2.60） |
    | p95 平均 | 4.2 mm | 0.88 mm |
    | 结束时平均 | 0.31 mm | 0.25 mm |

- **拖动推开按接触角放大**：预检改变了零件堆的样子后，`engine-node` 拖动推挤测试一度到 1.66 mm（限制 0.3）。`dragDepenetrate` 只在水平方向推，斜面接触时推的距离按 1/cos(接触角) 放大（最多 3 倍），现在 0.015 mm。
- **重场景耗时**（`PROF=1 node e2e/hull-bench.mjs`，单独跑，±10% 噪声）：体素盒 约 19.3 ms / 0.18 mm，凸包 约 15.0 ms / 0.18 mm，凸包 + 分层 约 14.4 ms / 0.20 mm（v32：25.8 / 14.7 / 14.0 ms）。
- **拆解模式新增 AA 电池玩具车**（3 V，7 步，2 个停止点；原创文字和插图，**按公开资料整理，未经实物验证**）。设备 10 → 11，近似件 31 → 33（底盘、黄色减速箱）。
- **回译检查**重跑（200 条抽样，样本池比 v30 大，不能直接比）：平均相似度 0.316，低于 0.2 的 79 条，大多是短片段；其中明显错译手改 9 条（如“光耦”原机翻 “Light decriminalize” → Optocoupler，“下一个：” → Next:）。
- **爆炸图说明**：v32 记录里说“只有中文”，复查是旧 DOM 导出造成的误报，英文模式本来就显示英文；`v33-bench` 现在专门检查。
- **测试**：`node e2e/v33-bench.mjs`（19 项：玩具车列表 / 电压 / 搜索 / 步骤和插图 / 安全须知 / 爆炸图说明中英文 / 帮助页说明 / 手机和宽屏不溢出）。
- **限制**：数字只对这个基准场景；限速让密集场景的下落变慢；“自适应凸包检查间隔”这一版没做；新设备未经实物验证。

## v32：机翻收尾 + 叠压穿透 + 凸包模式提速 + 2 台低压拆解设备 + 录屏中文字幕（早期原型，简化仿真）

- **手写译文**：`hand.json` 1604 → 1911 条（/assembly/guide、/credits、零件库、引导项目约 300 条，v32 新设备和近似件说明），术语表 +20。按运行时查找顺序算，页面上实际露出中文的整句 2 条（都是 `L({zh,en})` 成对写好的提示，页面显示英文）。英文模式下 /assembly/guide 剩余汉字 2 个（生成时间 / 代码注释里的原文），/credits 0 个。
- **可读性**：200 条抽样（两个随机种子）199/200、200/200 无问题；全库 5 / 13570 触发规则。规则检查抓不到“意思错”。
- **叠压穿透（`depenetrate()`，我的补充，简化）**：诊断发现超过 5 mm 的压进大多不是高速撞击，而是两个大件上下叠着（夹心）：只把下面那个往下推，会被再下面的零件顶回来。现在当被压的是下方零件、对方是醒着的动态件时，改为把上面的往上推（`engine.stackPush`，阈值 `engine.stackMm` 默认 0.3 mm；`stackPush = 0` 关闭）。
  - 冲击峰值（`node e2e/peak-bench.mjs`，93 个零件，5 个随机摆放种子平均）：

    | | 关（≈ v31） | v32 默认 |
    |---|---|---|
    | 峰值平均（最坏） | 12.9 mm（19.7） | 9.6 mm（11.8） |
    | 前 10 步之后的峰值 | 8.8 mm | 3.6 mm |
    | p95 | 8.4 mm | 4.2 mm |
    | 中位数 | 0.71 mm | 0.36 mm |
    | 结束时 | 0.43 mm | 0.31 mm |

    **最开始几步仍会短暂压进约 1 cm**：来自基准场景一开始摆得太密、零件生成时就互相重叠，不是落地冲击本身。没解决。
- **凸包模式提速**：分步计时（`PROF=1 node e2e/hull-bench.mjs`）显示穿透修正 `settleStep` 占凸包模式每步约一半时间，大多花在已经贴合、只是还没睡着的零件上。现在连续 3 次检查都不用推、也没在快速移动的零件，改成每 2 步查一次（`engine.coldEvery`，错开相位；拖动零件时每步都查）。试过每 3 步：更快，但分层场景结束时穿透升到 0.82 mm，没用。
  - 重场景（93 个零件，360 步 @120 Hz，同一台机器单独跑，耗时 ±10% 噪声；穿透是结束时一次采样）：

    | 模式 | v31 | v32 |
    |---|---|---|
    | 体素盒 | 26.5–27.8 ms / 0.08–0.38 mm | 约 25.8 ms / 0.40 mm |
    | 凸包 | 18.8–20.5 ms / 0.18–0.22 mm | 约 14.7 ms / 0.15 mm |
    | 凸包 + 分层 | 14.2–15.2 ms / 0.16–0.56 mm | 约 14.0 ms / 0.12 mm |

  - 掉落测试（`e2e/collider-engine.mjs`）、首屏预算、拖动推挤全程 < 0.1 mm（`engine-test`）都仍通过。
- **拆解模式新增 2 台**（原创文字和插图，**按公开资料整理，未经实物验证**）：9V 电池扣 LED 测试器（7 步；限流电阻例子“约 7 mA”是按欧姆定律算的估算，不是数据手册值）、小型 USB OTG 集线器（7 步）。设备 8 → 10，近似件 27 → 31。
- **低压规则**：只收电池或 USB 供电、不超过 24 V 的直流设备；每台设备在列表里显示电压。安全须知第一条写明不收市电设备；搜索“充电头 / 适配器 / 220V / wall charger”等词时页面会提示不提供市电设备的拆解步骤。`teardown-test` 会检查每台设备 ≤ 24 V、名称不含市电词。
- **录屏演示加中文字幕**：`e2e/demo-record.mjs` 按每一步的真实起止时间写 `demo.srt`（8 条），ffmpeg 烧进画面（Noto Sans CJK SC）。
- **修复**：拆解页在 390 宽手机上被长型号撑宽（445–524 px），改成 `minmax(0,1fr)` 网格 + 长词可断行。
- **测试**：`node e2e/v32-bench.mjs`（新设备、电压、市电提示中英文、/assembly/guide 和 /credits 英文无汉字、手机 / 宽屏、3D 模型路径）。
- **限制**：最开始几步的穿透峰值仍约 1 cm；数字只对这个基准场景；回译只测了抽样；新设备未经实物验证。

## v31：翻译计数查清 + 小件穿透加时 + 真实录屏 + 2 台新拆解设备（早期原型，简化仿真）

- **“未翻译”从 987 涨到 1230 的原因**（查清了，不是丢译文）：v30 提交时库里的基线是 994；v30 新增了 248 条源文字，其中 17 条已经有译文，所以 994 + 248 − 17 ≈ 1230（脚本按 need 数组计数，含整句 / 片段 / 子串）。没有任何原来有译文的字符串丢失，机翻条目数也没变（10828）。其中 100 多条其实是源码里成对写好的中英文（`T("中","英")`、`zh:/en:`、`make(id, 中, 英)`），页面上早就显示英文，只是提取脚本没认出来。
  - 修正：`scripts/i18n/extract.mjs` 现在把成对字符串直接记成“原文自带译文”（paired 435 条），不再拆成片段去机翻。“未翻译”1230 → 640（加了 2 台设备后 650）；按运行时查找顺序算，**页面上实际还会露出中文的整句是 0 条**（`.scratch/eff.mjs`；剩下的 650 条是只在已翻译整句里出现的片段，查不到也不影响显示）。
  - 机翻质检新规则（`merge.mjs`）：很短的原文配很长的译文一律拒收（例：“来源：”被机翻成一句无关英文）。
- **手写译文**：`hand.json` 1320 → 1604 条，覆盖首页全部 46 条、零件库页约 118 条、引导项目零件清单（改成源码里直接给英文提示）、拆解近似件说明、出处页、v31 新设备。机翻页面露出行（`.scratch/mtcheck.mjs`）611 → 297，剩下的主要在 /assembly/guide（约 207）和 /credits（约 60）。
- **可读性 / 回译**：200 条抽样 0 条有问题（全库 5 / 13420 触发规则）；回译均值 0.306、低于 0.2 的 83 条。样本随条目数变了，和 v30 的 0.358 不能直接比；v30 那 200 条样本的译文这次 0 条变化。规则检查抓不到“意思错”。
- **穿透修正（`depenetrate()`）**：小件（质量 < 1.5，`engine.smallMass`；基准场景 93 个里有 24 个）规定轮数做完还压进 > 0.5 mm 就最多加 6 轮（`engine.xtraIt` / `xtraMm`），卡住时 12 次（原来 40 次）就拎出来（`engine.stuckSmall`）。大件冲击时加时（`engine.xtraItDeep`）实测能把峰值压低一些，但每步更慢、终态穿透反而变大，**默认关**。
  - 重场景（`node e2e/hull-bench.mjs`，93 个零件、360 步 @120 Hz，同一台机器，耗时 ±10% 噪声；穿透是结束时一次采样）：

    | 模式 | v30 | v31 |
    |---|---|---|
    | 体素盒 | 28.7 ms / 1.414 mm | 26.5–27.8 ms / 0.08–0.38 mm |
    | 凸包 | 18.0 ms / 0.463 mm | 18.8–20.5 ms / 0.18–0.22 mm |
    | 凸包 + 分层 | 16.2 ms / 1.446 mm | 14.2–15.2 ms / 0.16–0.56 mm |

    分层模式达到“约 15 ms、约 1 mm”的目标；凸包模式反而慢了约 5–10%。
  - 冲击瞬间（`.scratch/peak.mjs`，每 5 步采样）：峰值 14.9 → 11.8 mm，中位数 2.06 → 0.77 mm。**落地那一刻仍会短暂压进约 1 cm**，没解决。
- **真实录屏演示**：`e2e/demo-record.mjs` 用 Playwright `recordVideo` 录真实操作（首页 → 拆解搜索 → LED 手电指南 + 爆炸图 → 引导项目零件清单 → 维修关卡 → 装配台 3D → 工作台），ffmpeg 转 H.264 mp4（约 57 秒、约 2 MB）。
- **拆解模式新增 2 台**（原创文字和插图，**按公开资料整理，未经实物验证**）：小型 LED 手电（7 步，含爆炸图）、TP4056 单节锂电充电板（7 步，认元件 / 焊盘，不给编程电阻具体数值，以数据手册为准）。设备 6 → 8，近似件 22 → 27。
- **测试**：`node e2e/v31-bench.mjs`（新设备、手电爆炸图、3D 模型路径、英文无汉字、手机 / 宽屏）；`scripts/teardown-test.mjs` 改成 8 台 / 27 个近似件。
- **限制**：/assembly/guide 和 /credits 还有约 270 行机翻；冲击瞬间穿透峰值仍约 1 cm；穿透数字只对这个基准场景；凸包（非分层）模式比 v30 略慢。

## v30：接触面优先的穿透修正 + 手写术语表 + 回译检查 + 3 台新拆解设备（早期原型，简化仿真）

- **穿透修正只查“接触面”**（我的补充，`src/assembly/engine.js` `depenetrate()`）：只对 narrow-phase 流形里真有接触点的碰撞体对做精确距离查询；桌面 / 围栏先用包围球筛。拖拽中、工具在动、或这一步移动 > 0.5 mm（正在下落）时流形是旧的，这时改成宽相位 + 碰撞分组筛选。小件卡在空腔里连续 40 次推不出来就往上“拎出来”；被上面零件压在桌面上的夹心情况，改为把上面那个提起来。`engine.fastDepen = false`（或 hull-bench 的 `SLOWDEPEN=1`）退回 v29 全查。
- **重场景实测**（`node e2e/hull-bench.mjs`，93 个零件、360 步 @120 Hz，同一台机器；耗时有 ±10% 噪声）：

  | 模式 | v29 全查 | v30 接触面优先 |
  |---|---|---|
  | 体素盒 | 33.2 ms / 1.585 mm | 29.7 ms / 1.414 mm |
  | 凸包 | 24.3 ms / 4.007 mm | 18.4 ms / 0.463 mm |
  | 凸包 + 分层 | 20.3 ms / 3.815 mm | 16.7 ms / 1.446 mm |

  目标是约 15 ms、约 1 mm：分层模式**没完全达到**（16.7 ms、1.45 mm，最深的是小 SMD 开关 / 外壳贴桌面）。掉落瞬间峰值仍可达约 10 mm，静止后回落。
- **手写术语表**：`scripts/i18n/hand.json` 新增约 320 条（/workbench 90、维修关卡 172、回译修正 60）；英文里 “Client:” 后面补空格（`src/i18n-dom.js`）。
- **可读性抽样** 200 条（`scripts/i18n/readability-test.mjs`）+ **回译检查**（`scripts/i18n/roundtrip.mjs`，本机 Argos 英→中，字二元组相似度，只报告不判失败）：均值 0.304 → 0.358；回译模型自己会乱译，分数是噪声很大的信号。
- **拆解模式新增 3 台**（原创文字和插图）：有线鼠标、小型蓝牙音箱、电子厨房秤，各 7 步；充电宝也有了爆炸图。仍是**按公开资料整理，未经实物验证**。近似件 10 → 22 个。
- **测试**：`node e2e/v30-bench.mjs`（新设备、爆炸图、Client 空格、/workbench 英文、3D 模型路径、手机 / 宽屏）。
- **限制**：约 600 条英文仍只有机翻；回译分数不代表译文质量；穿透数字是这个基准场景的，不是所有场景。

## v29：拆解模式（早期原型，简化仿真）

`/teardown`（中文默认，右上角 EN 切换；英文是手写，不走机翻）。全部文字、插图、近似零件由本项目自己写 / 程序生成，**按公开资料整理，未经实物验证**；没有复制任何外部拆解指南的文字或照片（灵感来源见 `/credits#teardown`）。

- **3 台设备**（`src/teardown/devices.js`）：微型舵机（SG90 一类，7 步）、单节 18650 USB 充电宝（7 步）、USB 桌面小风扇（6 步）。可按名称 / 型号 / 别名搜索（中英文都行）。
- **每份指南**：概述、安全（含电池的先处理电池、防静电、停止点；通用 4 条 + 设备专属）、材料和工具清单（可勾选）、编号步骤（警告 / 停止点单独标出、每步标“未经实物验证”）、本项目自绘的 SVG 步骤插图（同一张示意图里高亮 / 移开对应部件）。
- **完成勾选**存在 localStorage `teardown-progress`，刷新还在；设备列表显示已完成步数。
- **存进零件库**：拆下的模块写进本机 localStorage `bench-inventory`（同一零件累加数量、记来源设备）。能对上的用零件库已有件（`fc-servo-sg90-horn1`、`fc-dc-6v-servo`、`p-cell-18650`、`p-motor-130`、USB-C 母座、拨动开关、3P 杜邦胶壳），对不上的用 10 个**近似件**（`src/teardown/approxParts.js`，id 以 `td-` 开头，名字带“近似件 · 拆解模式”，全部尺寸估算、形状示意，CC0）。零件库和装配台的零件列表里新增视图“拆解所得”，可以直接加到台面上；`/parts?view=inv` 直接打开这个视图。
- **交互爆炸图**（`src/teardown/TeardownExplode.jsx`）：舵机和风扇，复用零件库 3D 预览的 `ProcMesh` / `Glb`，滑块 0–100% 拆开，悬停高亮，模块标签。位置是示意。
- **入口**：导航“拆解模式”、Ctrl/⌘ K 命令面板（页面 + 3 台设备）、首页按钮、使用说明页、出处页。
- **测试**：`node scripts/teardown-test.mjs`（35 项：数据完整性、中英成对、英文无汉字、插图图层、模块都能在零件库找到、近似标记、电池顺序、库存读写）；`node e2e/v29-bench.mjs`（37 项：搜索、步骤 / 插图 / 安全、勾选持久化、爆炸图、存进库存 → 零件库视图 → 装配台、入口链接、出处页、英文 0 汉字、手机 / 宽屏中英文）。
- **限制**：指南没在实物上验证过，真实设备的螺丝数量、卡扣位置、电芯连接方式都可能不同；近似件尺寸是估算；爆炸图位置是示意，不是装配尺寸；库存只存在当前浏览器。

## v28：碰撞体分级、八爪鱼指南英文、3D 画布标签英文、可读性抽样、7 个新维修关卡（早期原型，简化仿真）

- **碰撞体分级（LOD，`src/assembly/engine.js` 的 `lodTick`）**：每个用凸包的零件分“外凸包”（和桌面、远处零件碰）和“细凸包”。每 4 步按包围球 + 外凸包 GJK 距离判断：1.5 cm（加速度余量）内有别的零件才启用细凸包，否则细凸包休眠。有线缆或工具时保守地全部启用。`window.__engine.lodStats()` 可以看启用了多少。
  - **实测（本机噪声较大，数值会浮动，诚实记录）**：

    | 场景 | 方块 | 全部细凸包（v27 做法） | 细凸包 + 分级（v28） |
    |---|---|---|---|
    | 重场景 93 个零件，ms/步 | 约 32–36 | 25.1（p95 30.3） | **20.7–21.2（p95 26.8–27.3）**；早些单独跑过 18.0 |
    | 重场景最大穿透 | 约 1.6 mm | 4.0 mm | **3.8 mm**（早些单独跑过 0.24 mm） |
    | 稀疏场景 31 个零件，ms/步 | 7.7 | 7.5–8 | **4.1** |
    | 稀疏场景最大穿透 | 0.22 mm | 7.8 mm | 5.9 mm |

    参照：v26 是 14.8 ms / 1.05 mm，v27 是 22.7 ms / 4.0 mm。**目标（约 15 ms、约 1 mm）在重场景里没达到**：这个场景 93 个零件里 88–90 个真的互相接触，分级能休眠的细凸包很少。稀疏场景提速明显，但穿透仍偏大。collider-engine（单零件落到桌面）静止穿透 0.016 mm。
- **八爪鱼指南英文**：标题、正文、表格、清单手写或机翻后修正（手写词典 `scripts/i18n/hand.json` 共 980 条，v27 是 136 条）。英文模式正文剩余汉字 **0.2%**（25 / 10799 字，v27 是 7.2%）。固件源码块（约占全文 9.9% 字符）**有意保留中文**，标了 `lang="zh"` `translate="no"` `data-no-mt`，页面上有说明。
- **3D 画布标签英文**：画在 canvas 里的字（工具标签：烙铁架、吸锡带、助焊剂笔、万用表等；零件标签“舵机 1”；万用表屏模式；串口绘图图例“GPIO13 指令”）画之前过 `ct()`（`src/i18n-canvas.js`），切语言时重画贴图。最显眼的 16 条手写，带编号的按模式翻，其余查同一份词典。
- **术语修正表**（`scripts/i18n/terms.mjs`）：机翻常见的错术语按规则改（接线表→Wiring table、焊盘→pad、万用表→multimeter、固件→firmware、杜邦线→Dupont wire、排针→Pin header 等），只在中文原文含该术语时生效，共改 234 条；去掉机翻凭空加的口头语 60 条。
- **可读性抽样测试**（`node scripts/i18n/readability-test.mjs`）：从 13 058 条译文里随机抽 50 条（固定种子），检查明显坏句：残留汉字、相邻重复词、括号不配对、长度比异常、数字丢失、口头语、错术语。种子 28 / 1 / 2 / 3：50 条里 0 条有问题。全库：最初的检查标出 248 条（1.9%），去掉误报后 71 条（0.6%），手修后 **4 条（0.0%）**。**限制**：只抓明显坏句，抓不到意思翻错。
- **维修关卡 +7（共 28）**（`src/repair/scenarios28.js`）：开关虚焊 ★1、漏装 LED 限流电阻 ★1、传感器板 LED 电阻虚焊 ★2、整流二极管装反 ★2、八爪鱼插头没插到位 ★2、主控舵机信号脚虚焊 ★3、舵机插头磨损 ★4。期望读数来自本项目简化仿真（估算，例如二极管装反：正向压降 Inf → 修好后 0.56 V，VIN 0 → 8.21 V）。中英文描述都是手写。`node scripts/repair-test.mjs` **402 / 402**（v27 是 309）。
- **测试**：新增 `e2e/v28-bench.mjs`（LOD 状态、工作台 3D 画布英文标签、装配台 EN 来回切换、八爪鱼指南正文剩余汉字 < 1% 和代码块标注、29 个标题都是英文、28 关和 7 个新关卡、新关卡英文描述、线上词典抽样、手机 390 / 宽屏 1920 × 中英文）。

## v27：英文版、使用说明页、更多维修关卡和示例场景、碰撞体再细分（早期原型，简化仿真）

- **使用说明 `/help`**（导航栏“使用说明”，命令面板搜“使用说明 / help”）：快速上手、每个模式（台面、模型实验室、关节和步态、串口 / 蓝牙连接、维修关卡、示波器、焊接和返修、零件库、工程和实测）、键盘快捷键、常见问题、诚实的限制。中文默认，右上角切到 EN 是**手写英文**（不是机翻）。
- **维修关卡 +9（共 21）**：每关都有故障、症状、可测点和检查（`node scripts/repair-test.mjs` 309/309）。章鱼指南页底部链到 `/help`。
- **示例场景 +4**（`/example`）：LED 闪烁、按键读数、电位器控舵机、双故障排查；v27-bench 逐个装配，无失败检查。
- **英文模式（机器辅助翻译，machine-assisted）**：
  - 中文仍是默认。切到 EN 时懒加载 `public/i18n/en-mt.json`（1.0 MB，gzip 约 411 KB），运行时把页面里的中文文字替换成英文；canvas / 3D 里画的字仍是中文。
  - 引擎：Argos Translate（MIT，离线，不联网、不收费），模型 translate-zh_en 1.9（OPUS-MT 派生，CC BY 4.0）。零件名用原零件库的英文名，不机翻。
  - **质检**（`scripts/i18n/qc.py`、`mt2.py`）：译文不得含汉字；原文里的型号 / 数字 / 单位必须原样出现；不得多出原文没有的数字；黑名单幻觉词；连续重复字符。不合格的先不用术语表重译、再按中文标点拆句译，还不合格就**保留中文**（宁可不翻，不要乱翻）。合并后的过滤还拒掉原文没有的全大写词（模型常幻觉出 UNSCR、RACIAL 一类）和连续重复的词。
  - 结果：待翻 11480 段，机翻采用 10848 条，质检拒掉 632 条（保留中文或退回更短片段），零件原名 1912 条，**手写补充 136 条**（`scripts/i18n/hand.json`，覆盖率测试发现漏翻的界面常用片段）。英文模式剩余汉字（`window.__cjkLeft()`，按页面可见文字统计；**不含**有意标 `lang="zh"` 的双语说明和“中文”切换按钮，共 37 字）：v27-bench 9 个页面 0–0.6%（全算 0.9–12.5%，/example 页面短，所以全算比例最高）；/help 0.3%、/electrics 0.2%、/pinouts 0.4%；**八爪鱼指南 7.2%**（固件源码和部分标题未翻）。这只说明“字被换成了英文”，不说明译文读得通。
  - **踩坑（已记在 mt2.py 开头）**：同时开两个 ctranslate2 进程，译文会随机变成乱码和联合国文件腔（实测：同一句“电池电压”单进程 20/20 次都是 battery voltage，两进程并行时 20 次里 9 次是乱码）。现在只用单进程跑。
  - 八爪鱼指南里的固件源码（代码注释）不翻译，保持原样。
  - 页面上方有一条横幅说明“机器辅助翻译”。机翻质量一般，术语可能不准；关键安全提示以中文为准。
- **碰撞体再细分**（体素目标 1.8 mm + 不重叠凸包；按细参考网格实测外扩）：

  | 零件 | v26 | v27（凸包数） |
  |---|---|---|
  | ada-6241 | 4.933 mm（保留原碰撞体） | **1.602 mm**（99） |
  | ada-6126 | 3.914 mm | **1.875 mm**（64） |
  | ada-6124 | 3.903 mm | **1.853 mm**（57） |
  | fc-coupler-5x8 | 5.604 mm（细分更差，未采用） | **1.926 mm**（15） |

  collider-test：> 3 mm 的零件 **0 个**（最大 2.998 mm）。
  - **代价（限制）**：hull-bench 重场景凸包碰撞体 1461 → 2235 个，每步 14.8 → 23.4 ms（p95 29.2），最大穿透 1.05 → 4.0 mm（测试仍通过，但变差了，记为已知限制）。
- **无障碍漫游**（`e2e/v23-walk.mjs`，新增 `LANG_UI=en`、`WIDE=1920`，并加入 /help 和 4 个新场景）：中文 / 英文 × 手机 390 + 桌面 / 宽屏 1920 共 4 轮，横向溢出 0、低对比 0、无名控件 0、焦点不可见 0、报错 0；英文模式下零件收藏星变窄（22 px）导致手机小目标 946 个，已改成至少 24 px，使用说明目录链接同样处理，现在 0。
- **site-check** 加入 /help、/repair、/project（线上 11 页无错误）。
- **测试**：新增 `e2e/v27-bench.mjs`（/help 15 个段落、导航和命令面板入口、EN 切换和逐页英文覆盖率、切回中文复原、21 关、4 个场景、零件详情英文标签、手机 390 / 宽屏 1920）。

## v26：实测对比（实物读数 vs 估算）+ 用户校准（早期原型，简化仿真）

- **实测对比**（`/project` 第 5 步“仿真检查”的万用表表格下面；逻辑在 `src/project/measure.js`，界面 `src/project/MeasurePanel.jsx`）：16 条测试项（通断 5 条、断电 / 上电电压 7 条、待机电流 1 条，以及可选的带载 3 条），每条显示测哪里、档位、估算值（来自求解器）、容差和依据。
  - 在实物上量到的读数填进去（`OL` = 不导通，可以带单位和逗号），和估算对比，显示偏差，标成 **仅估算 / 已在实物上验证 / 有偏差 / 已按这条实测校准**。步骤导航上有小圆点（绿 = 全部吻合，红 = 有偏差）。
  - 容差也是估算（我的补充）：每条写在“依据”里。
  - 每条可以加一张照片：缩到 640 px JPEG，**只存在这台设备的浏览器里**（localStorage `octo-measure-photos-v26`），不上传；浏览器存储满了会提示。
  - 记录存在 localStorage（和项目进度一起），可导出 / 导入 JSON（导入会校验：未知测试项、读不了的读数、校准值、照片格式）；导出默认不带照片，勾选才带。
- **校准建议**：有偏差时提示该查哪个模型参数——电池开路电压、电池内阻、导线电阻、接触电阻（JST + 焊点）、QT Py 平均电流；短路 / 开路 / 升压 / 3V3 这些只提示查接线和焊点，不改参数。可以“应用到仿真（用户校准）”，界面和制作单都标“用户校准生效中”，可逐项或全部撤销。没有校准时结果和 v25 完全一样（有测试）。用来反推校准的那条读数标“已按这条实测校准”，不算独立验证。
- **示例数据**：“填入示例数据（不是实测）”只用于演示和测试，界面横幅、每一行、制作单里都写明“示例数据（不是实测）”，状态显示“示例数据：吻合 / 有偏差”，不会显示“已在实物上验证”。**没有任何真实实测数据。**
- **制作单**新增“4b. 实测对比（我的补充）”：每条的估算 / 实测 / 状态、每步的标记、校准建议和生效中的用户校准（Markdown 和 HTML 都有）。样例（示例数据）见交付目录 `v26/sample-build-sheet.md / .html`。
- 小修：`/project` 和实测界面补了英文翻译（110 多条）；`/project?step=…` 填错步骤名不再报错；命令面板加“实测对比”入口；八爪鱼指南 / 素材说明补了 v26 说明。
- 测试：`node scripts/measure-test.mjs`（36/36），`node e2e/v26-bench.mjs`（35/35：填读数、偏差、照片不上传、导出 / 导入、应用和撤销校准、刷新保留、制作单内容、手机 / 宽屏）。
- 局限：容差、校准公式（内阻 = (开路 − 带载) / 电流 等）都是简化的直流模型；带载估算按 8 个舵机一起摆动时 5 V 侧总共 0.8 A 的估算假设（平均 0.1 A / 个，不是数据手册数字）；照片不做任何识别；没有真实实测数据，所以**还没有任何一条在实物上验证过**。

## v25：从零做一只八爪鱼（引导项目 + 可打印制作单）（早期原型，简化仿真）

- **引导项目** `/project`（导航“动手做”；`src/pages/ProjectPage.jsx`，逻辑在 `src/project/octoProject.js`，纯 JS，node 里也能跑）：用 v10 紧凑无线八爪鱼的设计，按 6 步走：
  1. **选零件**：在零件库里搜、加入清单（数量对不上、加了清单外的零件都会提示）；
  2. **装配**：每个零件放到骨架 / 上层板的位置上（先放骨架、充电板和 QT Py 叠在电池上；按库里外形尺寸查重叠和超出上层板）；
  3. **接线**：从焊盘到焊盘连线，引脚名来自引脚表（例如 `A0（GPIO18）`）；查少接、接错、短路，提示下一根该接什么；
  4. **焊接**：用 v24 的焊接 / 返修规则——插着电池拒绝焊接；时间太短虚焊、太长不加助焊剂连锡；助焊剂补焊；拆焊加热过久焊盘翘起，可“换新板”；焊接顺序是我的补充；
  5. **仿真检查**：三组——网表（和参考网表对比）、电源（电池 / 升压 5.2 V / 3V3 / 电流，估算）、固件（编译状态、每个舵机焊盘和固件 `kV10Pins` 对得上、电池检测脚）；
  6. **完成**：装上触手，生成制作单。
  - 每步右侧有通过 / 未通过的检查和提示；“示范：自动完成这一步”会在制作单上注明用了示范。进度只存在本机 localStorage（`octo-project-v25`），可重置。
- **制作单**（`src/project/buildSheet.js`）：下载 Markdown / HTML，或打开打印版（`@media print`）。内容：BOM（零件名、数量、3D 模型许可证、来源 / 商品页链接，不写价格）、接线表（真实引脚名）、焊接顺序（我的补充）、万用表测试清单（读数来自求解器，标“估算”）、安全（锂电池、通风、烙铁）、**没有在实物上验证的部分**、来源。没做完时按参考设计生成并注明。样例见交付目录 `v25/sample-build-sheet.md / .html`。
- **碰撞体再细分**：6 个外扩超过 3 mm 的零件重新分解 + 不重叠凸包，结果见下面“数字”。
- 测试：`node scripts/project-test.mjs`（逻辑 + 制作单），`node e2e/v25-bench.mjs`（浏览器里把 6 步走一遍，含故意做错再改对、下载、刷新保留、手机 / 宽屏）。
- **数字（v25）**：
  - 碰撞体再细分（不重叠凸包，按 hull-colliders 的“外扩 最大”算）：ada-6057 2.697 → **2.585 mm**（38 个凸包），GNSS 螺旋天线 3.069 → **2.968 mm**（19 个凸包）——降到 3 mm 以下，已采用。ada-6241（4.933 mm）、ada-6126（3.914 mm）、ada-6124（3.903 mm）、fc-coupler-5x8（细分后 5.604 mm，更差）：细分没变好，**保留原碰撞体**，在元数据里记了 `hull_rejected`。
  - hull-bench：凸包 1461 个碰撞体，每步 14.8 ms，最大穿透 1.05 mm（体素盒 5142 个，25.8 ms，4.06 mm）。collider-engine 静止后最大穿透 0.094 mm（阈值 0.1）。
  - 测试：project-test 45/45，v25-bench 40/40；首屏入口 108.6 KB gzip（预算 150）。
- 局限：所有检查都是简化模型，**没有在实物上验证**；万用表读数是估算；焊接手感、热量都是阈值规则；BOM 许可证指 3D 模型素材，不是零件本身。

## v24：拆焊 / 返修 + 英文界面开关 + 凸包补完（早期原型，简化仿真）

- **拆焊 / 返修**（`src/assembly/engine.js` 的返修模型，`src/assembly/netlist.js`，工作台“拆焊”工具和返修面板 `rework-tools`）：
  - 选“拆焊”工具（或按住 Shift 用烙铁）对着焊点加热，焊锡熔化后焊点被移除，零件可以取下再用。直插件和贴片件都支持。
  - 返修面板：“全部拆焊”、“取下零件”、“飞线修补”，并显示焊盘磨损次数、翘起焊盘数和提示。
  - 简化模型（我的补充，数字是估算）：同一个焊盘返修超过 3 次（`PAD_REWORK_MAX`）或连续加热超过 4 s 会**翘起**；零件累计受热超过 30 s 标记为可能过热。
  - 翘起的焊盘在网表里算**开路**，检查面板显示“焊盘翘起”。可以用飞线修补恢复导通。
  - **测试**：`node scripts/rework-test.mjs`（31 PASS，已接入 `scripts/engine-test.sh`），覆盖拆焊后网表断开、重焊恢复、贴片返修、多次返修翘焊盘开路、飞线修补。`e2e/v24-bench.mjs`（26/0）用鼠标走一遍拆焊和英文开关。
- **英文界面开关**（`src/i18n.js`，导航栏右侧 `EN / 中文` 按钮）：
  - 默认中文，选择保存在 localStorage（`ui-lang`），刷新后保持。`<html lang>` 跟着切换（`zh-Hans` / `en`）。
  - 已翻译：导航、置顶横幅、命令面板（页面和场景名，搜索中英文都能匹配）、工作台新手导览、工作台主要标签、工具、返修面板、指南页各节标题。
  - **还没翻译（照实说明）**：指南正文、零件描述、仿真提示消息、大部分页面正文、命令面板里的修复条目。页脚的语言说明写清楚了范围。没翻译的词条在浏览器里记录到 `window.__i18nMissing`，方便以后补。
- **凸包补完**（`scripts/hull-colliders.mjs`，4 路并行；6 路会把 15 GB 内存用完）：v23 剩下的 12 件和外扩超过 3 mm 的件全部重跑，共 27 件。
  - **采用凸包 18 件**，外扩都 ≤ 3 mm（细网格）：例如 ada-4444 4.357 → 2.985、ada-6114 3.249 → 2.998、ada-6252 3.222 → 2.937、ada-6299 3.401 → 2.888、fc-wheel-tt-65 3.546 → 2.979 mm（166 盒 → 32 凸包）。
  - **保留长方体 9 件**：
    - 5 件凸包互相重叠超过 5%，没通过零件校验：sfe-xh414h、microSD 卡座、GCT USB4105、GNSS 螺旋天线、fc-coupler-5x8。
    - 3 件凸包上螺丝落下会穿进外壳顶面，没通过落件测试：ada-6057、ada-6124、ada-6126。
    - ada-6241 的凸包没有更好。
  - 现在共 25 件用凸包：盒 1569 → 凸包 422。
  - **仍超过 3 mm**（细网格，长方体）：ada-6241 6.598、ada-6057 4.673、ada-6126 3.914、ada-6124 3.903、fc-coupler-5x8 3.251、GNSS 天线 3.069 mm。
  - **重场景**（`e2e/hull-bench.mjs`，75 个零件，360 步）：体素盒 4707 个碰撞体，每步 26.7 ms；凸包 1290 个碰撞体，每步 13.7 ms，约快 2 倍。
  - 这个场景里凸包的最大穿透（4.19 mm，含掉落撞击瞬间）比长方体（1.93 mm）大。静止后的穿透由 `e2e/collider-engine.mjs` 判定（≤ 0.1 mm，通过）。
  - 落件测试改用向下射线找真正的实体顶面当落点：凸包的外接盒中心下面不一定有实体。
- **限制（我的补充）**：
  - 返修的温度和翘焊盘是计次 / 计时的简化模型，没有温度场、焊盘铜箔强度或吸锡带 / 吸锡器的区别。
  - 英文只覆盖界面框架。
  - 6 件外扩仍超过 3 mm。
  - 凸包场景的撞击瞬间穿透偏大。

## v23：贴片转接板 + 凸包碰撞体 + 手机 / 宽屏走查修复 + 键盘可用（早期原型，简化仿真）

- **贴片转接板**（`scripts/build-breakouts.mjs` → `src/assembly/breakouts.gen.js`，`src/assembly/breakout.js`）：13 种贴片封装（SOIC-8/16、TSSOP-16、SSOP-24、QFN-16/32、LQFP-32/48、SOT-23/-5/-6、0603、0805）各有一块转接到 2.54 mm 排针的转接板。焊盘位置和尺寸取自 KiCad 官方封装库（提交 a337146e），板体、排针、走线按代码生成（CC0，板子外形是估算，我的补充）。
  - **焊接步骤**：把贴片件拖到转接板上，用“对位 / 贴上”放片（显示对位误差），再用烙铁逐脚焊。焊点质量沿用焊接模式的模型（好焊点 / 虚焊 / 桥连 / 烧坏）。
  - **接线**：转接板的排针能插面包板、接杜邦线；网表经“排针 → 走线 → 焊盘 → 焊点 → 芯片引脚”连通，虚焊或没焊的脚不导通。预设场景 `/assembly?scene=smd`。
  - **L298N 芯片（Multiwatt15）**：选中时显示醒目说明：这是直插件，15 根脚按 1.27 / 5.08 mm 交错排列，不能直接插面包板，要用模块板或自己焊转接。
  - **测试**：`node scripts/breakout-test.mjs`（95 PASS，含经转接板的网表连通、虚焊开路、连锡检查、杜邦线接排针导通），`e2e/v23-bench.mjs`（18/0）。
- **凸包碰撞体**（`scripts/hull-colliders.mjs`）：把 v22 的体素长方体按真实网格点收紧成凸包，再在外扩不超过上限的前提下合并。只有“外扩更小或碰撞体更少、且网格顶点全部被覆盖”的零件才采用。34 件里已处理 22 件，采用 11 件：
  - 盒 857 → 凸包 192。ada-1185（100 mm 大按钮）外扩最大值从 3.868 降到 2.987 mm（261 盒 → 44 凸包）。逐件数字写在 catalog 的 `collider_decomp.hull`，零件页也显示。
  - 外扩是同一把细网格尺子量的。v22 时用的度量偏粗，换成细网格后，有 4 件仍超过 3 mm：ada-4444 4.357、ada-6299 3.401、ada-6252 3.222、ada-6114 3.114 mm。这 4 件凸包没有让外扩变大，只是减少了碰撞体数量。
  - **重场景物理步**（`e2e/hull-bench.mjs`，33 个零件，360 步 @120 Hz）：体素盒 2571 个碰撞体，每步 13.95 ms（p95 18.9）；凸包 576 个碰撞体，每步 6.64 ms（p95 8.6），约快 2.1 倍。最大穿透 2.415 → 0.088 mm。落桌测试（`e2e/collider-engine.mjs`）和首屏预算（入口 104 KB gzip）都通过。
- **走查修复**（`e2e/v23-walk.mjs`：18 个页面 × 手机 390 px / 宽屏 1440 px）。查横向溢出、竖排挤压、文字对比度、无名控件、手机点按目标、Tab 焦点可见、页面报错。找到并修好的问题：
  - 铜色文字对比度 3.77 → 约 4.7。
  - 固件行号对比度 4.02 不够。
  - 工作台木纹上的提示文字对比度只有 1.2，已加底色。
  - 手机上约 500 个点按目标小于 24 px（复选框 13 px、折叠标题 / 链接 16 px）。
  - 手机导航挤成一列一个字，已改成单行可横向滑动。
  - 手机置顶横幅两行，已改短。
  - 八爪鱼指南表格短格竖排，已改成可横滑。
  - 修复后两种视口 36 页次合计：溢出 0、竖排 0、低对比 0、无名控件 0、手机小目标 0、焦点不可见 0、报错 0。
- **键盘**：
  - 命令面板：Tab 不会跑出面板，Esc 关闭，关闭后焦点回到原处，有 combobox / listbox 语义和结果数播报。
  - 新手导览：打开后焦点在“下一步”，←/→ 翻页，Esc 跳过，窄屏不溢出。
  - 这些都在 v23-bench 里测试。
- **语言说明**：页脚注明界面以中文为主，零件名、数据手册术语和代码保留英文，暂时没有英文版（`<html lang="zh-Hans">`；v24 加了英文界面开关，见上）。
- **限制（我的补充）**：
  - 还有 12 件没有跑凸包（每件 1–13 分钟），仍是长方体（v24 已补完）。
  - 4 件外扩超过 3 mm（v24 后剩 6 件，见上）。
  - 宽屏上仍有小于 24 px 的复选框和链接（鼠标操作，没有改）。
  - 转接板外形不对应具体厂家。
  - 焊接质量是简化模型，没有温度场。

## v22：29 块板的物理引脚位置 + 大件碰撞体细分 + 新手导览 + Ctrl/⌘ K 命令面板（早期原型，简化仿真）

- **物理引脚位置**（`scripts/build-physpins.mjs` → `src/assembly/fpBoards.gen.js` + catalog `phys`）：引脚表的 29 块板 / 模块全部在台面上有物理引脚，导线 / 表笔落在真实针脚或焊盘上。来源逐块写在 catalog 和悬停提示里：
  - **KiCad 封装焊盘 → 真实 CAD 模型（逐个核对落在模型上）15 块**：Pico、Pico W、Feather HUZZAH32 / HUZZAH8266 / M0 Express（28/28 焊盘对上 CAD 孔）、ESP32-WROOM-32E / WROOM-32、ESP32-S3-WROOM-1、ESP32-S3-MINI-1、ESP32-C3-WROOM-02、ESP32-C6-MINI-1、ESP-12F、TB6612FNG、DRV8833PW、VL53L1X。
  - **直接从 CAD 网格量出 2 块**：HC-SR04（CAD 模型把排针画成 2.0 mm 间距，实物 2.54 mm——照实提示，不改模型）、L298N 模块（13 根排针 / 端子，其中 7 个接线端子位置是估算）。
  - **只有封装（数据手册焊盘图），外形厚度估算 12 块**：Arduino UNO R3 / Nano / Nano Every / Leonardo / Nano ESP32 / Nano RP2040、ESP32-C3-DevKitM-1、ESP-01、A4988、DRV8825、L298N 芯片（Multiwatt15）、VL53L0X。
  - 悬停显示“名字（引脚 n）· 来源 · 间距”；间距逐块和数据手册比对。`node scripts/physpins-test.mjs`：211/0（引擎里 994 个有名字的引脚，每个都在模型上、容差内）。SparkFun 的 S3-MINI 模型坐标系不一致（54/65 偏出），没有映射。
- **碰撞体细分**（`TARGET=3 node scripts/decompose-colliders.mjs`）：外扩改用固定细参考网格实测（v21 的度量对薄片低估）。实测下 v21 分解有 13/34 件 > 3 mm；v22 对这 13 件提高分辨率（每件 ≤ 300 盒），结果 33/34 件 ≤ 3 mm，只剩 ada-1185（100 mm 大按钮，261 盒，3.70 mm：圆弧面需要更多盒子）。逐件最大 / 中位外扩写在 catalog `collider_decomp`（`exMax_mm` / `p50_mm`）。`node scripts/collider-test.mjs`，`node e2e/collider-engine.mjs`（落桌测试）。
- **新手导览**：装配台第一次打开时 8 步（装配、接线、万用表、示波器、维修模式、零件库、上传模型、连接实物），可跳过，关闭记在本机 localStorage（`asm-tour-v22-done`）；“新手导览”按钮或 `?tour=1` 重新打开。自动化浏览器（webdriver）下不自动弹出，避免挡住旧测试。
- **命令面板**：任意页面 Ctrl/⌘ K（或页头“搜索跳转”），跳到页面、零件（`/parts?id=`）、预设场景（`/assembly?scene=`）、维修题（`/repair?s=`）。
- **测试**：`e2e/v22-bench.mjs`（35/0）。
- **限制（我的补充）**：贴片焊盘只能用表笔点，不能插线；L298N 芯片（Multiwatt）不能插面包板；12 块只有封装的板外形是估算；程序生成件没有缩略图；碰撞体仍是体素长方体。

## v21：真实 CAD 替换近似件 + 引脚表与引脚冲突 / 电平检查 + 碰撞体凸分解 + 首屏预算（早期原型，简化仿真）

- **真实 CAD 替换（FreeCAD-library，CC BY 3.0，逐件署名）**：零件库 3081 个（真实 CAD 2556 + 程序生成 525）。运动 / 机械类替换情况（替换 / 仍为近似）：舵机 2 / 6，舵盘 1 / 0，步进电机 4 / 14，直流电机 3 / 11，轴承与直线轴承 7 / 21，光轴 0 / 18，齿轮 0 / 40，同步带轮 1 / 9，型材 / 角码 / T 螺母 63 / 25，无刷电机 0 / 11；合计替换 81、仍近似 155，另新增 21 个真实件。没找到许可干净的真实模型的件保留程序生成，列表里标“近似形状（程序生成）”，有真实版本的会给出“真实 CAD：…”链接。
- **引脚表**（`/pinouts`，零件详情里有“引脚表”链接）：29 块板 / 模块、789 个引脚，每块写来源 URL（KiCad 符号库 CC BY-SA 4.0、官方数据手册 / 引脚图）；引脚功能分类是我的补充（自动分类），L298N 模块的排针顺序是估算。电路检查新增：两个输出接在一起 → “输出冲突”；3.3 V 引脚被推到 > VDD + 0.3 V → “电平不匹配”；没用的引脚直接接 GND → 只提醒。`NOBUNDLE=1 node scripts/pinout-test.mjs`（18/0）。只有 Pico、Pico W、Feather S3 在台面上有物理引脚映射。
- **碰撞体凸分解**（`scripts/decompose-colliders.mjs`，构建时）：原来 34 个真实件的自动碰撞盒在同一刚体里互相重叠；现在按 GLB 体素化（内部空腔按 2 倍细网格判断）、贪心合并成互不重叠的长方体（每件 ≤ 40 个，每个都是凸块）。实测：网格顶点 349,967 个 100% 落在碰撞体内（0.01 mm）；盒子两两不重叠（深度 < 0.001 mm）；碰撞体比可见网格最多外扩 = 体素对角线以内（逐件写在 catalog 的 `collider_decomp`，中位容差 3.06 mm，最大 12.2 mm——大件如 100 mm 大按钮体素 7 mm）。ada-4444 / ada-5036 尺寸警告已修好（重新转换补回薄片，包围盒和 CAD 一致）。零件库 3D 预览加了“显示碰撞体”线框。
  - `node scripts/collider-test.mjs`：覆盖 / 不重叠 / 外扩 ≤ 容差。`node e2e/collider-engine.mjs`（45/0）：34 件单独落桌、小件落到 4 个凸分解件顶面、按尺寸分 7 组叠落；静止后最大穿透 0.061 mm（阈值 0.1 mm）；掉落撞击瞬间峰值 16 mm，几帧内被推开，不计入判定。都加进了 `scripts/engine-test.sh`。
  - `parts-validate` 现在对真实件也严格检查“碰撞盒体积和 ≤ 包围盒 × 1.05”（16/0）。
- **首屏**：three.js 不再打进首页入口包（`src/lib/three-base.js` 由 3D 页面懒加载引入）。入口 JS + CSS 从约 200 KB 降到 101 KB gzip（预算 150 KB），/parts 另外按需 194 KB gzip（预算 900 KB），首页和 /parts 都不加载 Rapier / Worker：`node scripts/load-budget.mjs`。限速 1.6 Mbit/s 的首屏测试在 `e2e/v21-bench.mjs`。
- **限制（我的补充）**：碰撞体是体素长方体，精度取决于体素大小（大件外扩可到 1 个体素对角线）；几克的贴片件压在很重的大件下会被压进 2–3 mm（旧 AABB 碰撞盒同样 2.3 mm，是求解器质量比问题）；GT2 带轮齿数未核实；NEMA23 长度含轴；2060 / 2080 型材没有真实来源；型材长度变体由真实截面沿长度缩放；ada-4444 / 5036 缩略图没重新渲染。

## v20：零件库扩充到 2940 个 + 零件浏览器升级 + 升压平均值模型（早期原型，简化仿真）

**打开 `/parts`。** 读数和尺寸来自开源 CAD 文件与标准尺寸；电气参数能核对的写明来源，核对不了的标“估算”；质量全部是估算。**不替代真实安全培训**。

### 零件库：2940 个（真实 CAD 2415 + 程序生成 525）

另有 2 件只用于动画的工具（螺丝刀、烙铁），不计入总数，也不能放到台面上。来源全部是允许商用的开放许可证，逐条写在 `LICENSES.md` 和 `/credits` 页面里。不清楚许可证、或者只允许非商用的来源一律没收。

| 来源 | 数量 | 许可证 |
|---|---|---|
| KiCad packages3D | 1728 | CC BY-SA 4.0（附 KiCad 例外条款） |
| Adafruit_CAD_Parts | 465 | MIT |
| SparkFun KiCad Libraries | 193 | CC BY 4.0 |
| Espressif KiCad Libraries | 25 | CC BY-SA 4.0（附例外条款） |
| Seeed Studio OPL KiCad Library | 4 | CC BY-SA 4.0 |
| 程序生成（按 ISO / DIN / JEDEC / 常见规格尺寸） | 525 | CC0（本项目） |

按许可证：MIT 465 · CC BY-SA 4.0 1757 · CC BY 4.0 193 · CC0 525。

| 类别 | 数量 | 类别 | 数量 |
|---|---|---|---|
| connector 连接器 | 828 | led | 117 |
| switch 开关 | 301 | mcu 主控板 | 101 |
| passive 无源件 | 208 | motor 电机 / 舵机 | 61（其中 51 个是程序生成） |
| semi 半导体 | 194 | enclosure 外壳 | 60 |
| mech 机械（铝型材 / 轴承 / 齿轮 / 打印件） | 182（全部程序生成） | wire 线 | 21 |
| power 电源 / 电池 | 162 | breadboard 面包板 | 17 |
| sensor 传感器 | 151 | tool 工具 | 9 |
| fastener 紧固件 | 138 | | |
| module 模块 | 136 | | |
| driver 驱动 | 128 | | |
| display 显示屏 | 126 | | |

- **每个零件都有**：真实毫米尺寸、碰撞体（包围盒或复合盒）、许可证 + 来源 + 作者、缩略图（真实 CAD 件）。引脚表和额定值只给能核对的；质量标“估算”。
- **下载预算（实测）**：构建产物 118 MB，其中零件库 90 MB；GLB 合计 72.4 MB（平均 31 KB，中位数 18 KB，最大 422 KB，meshopt 压缩，共 915 万个三角形）；缩略图 2415 张 webp（平均 1.7 KB，懒加载）；索引 `index.json` 377 KB（gzip 后 59 KB）；分类目录 2.7 MB，按类别懒加载；主程序 js 188 KB（gzip）。打开 `/parts` 只下载索引 + 当前页缩略图。
- **限速加载测试**（Chrome CDP，1.6 Mbit/s 下行、150 ms 往返、不用缓存）：列表 3.2 s 出来，3D 预览 4.0 s，共下载 601 KB。
- **GLB 读取测试**（`node scripts/glb-load-test.mjs`）：2415/2415 个真实 CAD 件都能解析（meshopt 解码），都有三角形，包围盒和标注尺寸吻合（误差 5% + 0.5 mm 以内）；用时 4.5 s。两个已知警告：ada-4444 PyPortal Titano（60.6 对 65.66 mm）和 ada-5036 RGB 点阵 2.5 mm（14.5 对 17.5 mm），原因是网格简化时丢了很薄的部分。

### 零件浏览器

- **全文搜索**：中文和英文都能搜（例：“舵机” / servo 72 个，“继电器” / relay 88 个，“继电器 5V”、“轴承 608”、“JST XH 4”、XT60、esp32）。名称命中排在只命中类别名的前面。装配台的零件搜索用同一套引擎。
- **筛选**：类别、尺寸范围、接口（I²C / SPI / UART …）、电压、许可证、来源、真实 CAD / 程序生成。
- **收藏、最近使用**（存在浏览器本地，刷新后还在）；**两个零件并排对比**；3D 预览里的**尺寸标尺**（长 / 宽 / 高，单位 mm）；**“用在哪”**：链接到装配指南里用到这个零件的那一行。

### 升压模块平均值模型（`src/sim/devices.js` → `boostAvg`，默认）

旧的行为模型按上一步的电感电流显式计算调压和限流，结果和步长有关。新模型把稳压 / 限流写成同一步里迭代求解的分段线性结构，并显式写出电感、ESR、整流压降、开关管导通损耗、压差直通和限流。用开关级参考电路（真实 PWM 开关 + 二极管 + 电感 + 电容，`node scripts/boost-avg-test.mjs`，12/0）在几个工作点校验：稳态输入电流误差 ≤ 1.2%，输出电压误差 ≤ 13 mV。

| 步长敏感度（旧 → 新） | 旧模型 | 平均值模型 |
|---|---|---|
| 负载阶跃：步长 ≤ 2 µs 之间的差 | 16.5 mV | 5.9 mV |
| 负载阶跃：4 µs 对 0.25 µs | 43.6 mV | 15.8 mV |
| 舵机起步跌落：1000–25000 点之间的最大差 | 103.9 mV | 64.8 mV |
| 舵机起步跌落：2500 点对 25000 点 | 36.4 mV | 15.4 mV |
| 舵机起步跌落：自适应步长对 25000 点 | 16.6 mV | 15.2 mV |

- 25000 点时 5 V 轨最低值：旧模型 4.942 V，新模型 5.016 V。旧模型的跌落偏深，有一部分是步长造成的假象。
- **行为变化（如实说明）**：老化电池（内阻 0.25 Ω，估算）时电池最低约 3.44 V，高于主控欠压门限 3.4 V（估算），所以**不再欠压复位**，而是先触发固件低压保护（3.55 V）停舵机。what-if 面板：默认组合 0 次复位 0 次低压停；老化电池复位 0 次、低压停 2 次（v19 旧模型是复位 13 次）。v18 / v19 / netlist 测试的断言改成“复位或低压停”。舵机起步跌落：不加电容 167 mV，100 µF 99 mV，1000 µF 89 mV。参考板对照：不加电容 173.1 对 167.2 mV。
- 想对比旧模型：在浏览器控制台或脚本里设 `BOOST_MODEL.mode = "legacy"`。

### 测试

- `node scripts/parts-validate.mjs`（15/0）：数据格式、每个零件有许可证、尺寸都为正、默认碰撞体不重叠、每个来源都有致谢条目（`LICENSES.md` + `/credits`）。
- `node scripts/glb-load-test.mjs`（2415/2415）、`node scripts/boost-avg-test.mjs`（12/0）。这三个都已加进 `scripts/engine-test.sh`。
- `node e2e/v20-bench.mjs`（33/0）：搜索、筛选、标尺、“用在哪”、收藏 / 最近使用、对比、9 个零件抽样加载、装配台搜索、致谢页、指南、限速加载、没有页面错误；同时生成截图和视频。
- 之前的测试全部重跑：engine-test、repair、transient、scope、netlist、e2e v14–v19、`reg.sh`。

### 局限（我的补充）

- 2940 个离“市面上所有零件”还差得远。电机、舵机、轴承、齿轮、铝型材、紧固件大多是程序生成的近似形状：尺寸按标准或常见规格，外形是简化的。
- 只有部分主控板和模块有逐个引脚的引脚表；电气额定值核对不了的都标“估算”，质量全部是估算。
- 默认碰撞体是包围盒或几个盒子拼成的复合盒，凹形零件（外壳、支架）会比实物“胖”一些。有 27 个真实 CAD 件的自动复合盒在同一刚体内部互相重叠（不影响和别的零件碰撞，只是碰撞体积偏大），只记为提示，没有修。
- 升压平均值模型仍然没有环路带宽和逐周期纹波；输入电流用上一步的输出电流（显式，影响小）；舵机起步跌落还剩约 15 mV 的步长差。
- 零件库让 GitHub Pages 站点变成约 118 MB（上限 1 GB），以后再加需要继续压缩或者拆分。

## v19：示波器仿真台面上实际接的电路（早期原型，简化仿真）

**打开 `/assembly?scene=electrics` 或 `/assembly?scene=octo` → “电”页签 → 示波器 → “我的电路（台面）”。** 程序按你在 3D 台面上实际放的零件和接的线生成网表，再交给 v18 的时域引擎；v18 的参考板示波器保留为“参考板（v18，备用）”，并标明它不是台面电路。读数全部是仿真，不是实测；**不替代真实安全培训**。

- **网表提取**（`src/sim/benchNetlist.js`、`src/assembly/netlist.js`）：电池、开关、升压 / 降压、稳压、主控板、舵机、电容、电阻、LED、连接器；用已有的电气数据（引脚表、AWG 线阻 × 线长、端子接触电阻）。悬空网络、短路、缺地、没有电源会报错；不支持的零件（例如面包板上的传感器）只提示、不参与仿真。八爪鱼 v10 按 3D 接线提取；其他台面走通用提取（板载 USB 5 V、3V3 LDO、主控电流、INPUT_PULLUP 上拉都是估算）。
- **自适应步长**（`src/sim/transient.js`）：按局部误差调步长，有最小步长限制，开关 / 欠压复位 / 限流事件会对齐到事件时刻。和解析解比：RC 阶跃误差 0.39 mV，用 84 步（固定步长 0.049 mV，500 步）；RLC 22.1 mV / 820 步（固定 7.8 mV / 1000 步）；开关事件 6.8 mV（固定 113.2 mV）。和细步长比：舵机起步 9.0 mV（固定 163.4 mV），老化电池复位时刻误差 2.7 µs（固定 79.2 µs），复位次数一致（4/4/4）。**默认容差下不比固定 2500 步更快**（186 ms 对 153 ms）。
- **实时改参数**：电容值、电池新旧、每根线的线规、拔掉某根线；改完自动重抓，改前的波形画成灰色虚线，支持一步步撤销和全部复原。
- **八爪鱼 what-if 面板**：选电容 / 电池 / 线规组合，给出复位次数、最低电压、舵机起步跌落、电池峰值电流（估算）。例：默认组合 0 次复位、跌落 114 mV、峰值约 2.3 A；去掉电容跌落 220 mV；老化电池 + 不加电容复位 13 次。（v19 旧升压模型的数字；v20 平均值模型下老化电池是 0 次复位、2 次低压停，见 v20 一节）
- **和 v18 参考结果比**：不加电容时纹波峰峰值 264.8 mV（参考 264.7 mV）；加 470 µF 后 55.3 mV（参考 49.6 mV）；老化电池复位 4 次（参考 4 次），5 V 最低 4.972 V（参考 4.979 V）。
- **测试**：`node scripts/netlist-test.mjs`（31 项）、`node e2e/bench-netlist-node.mjs`（12 项）、`node scripts/adaptive-test.mjs`（17 项），都已加进 `scripts/engine-test.sh`；`node e2e/v19-bench.mjs` 做浏览器走查 + 截图 + 视频。`e2e/v18-bench.mjs` 现在先点“参考板（备用）”再测，因为默认改成了“我的电路”。
- **局限（我的补充）**：升压是行为模型，结果和步长有关（舵机起步跌落有约 20 mV 的差别；v20 改成平均值模型后约 15 mV）；多块主控时只有第一块驱动舵机信号；LDO、主控、舵机电流和电池老化内阻都是估算；涌入电流是微秒级尖峰，表里单独列出；没有 EMI、温度、PCB 寄生参数。

## v18：时域仿真 + 示波器（早期原型，简化仿真）

**打开 `/repair`，点“时域”或选“示波器关卡（v18）”；装配台 `/assembly?scene=electrics` → 电路面板 → “示波器（时域模式，v18）” → “打开示波器（大窗口）”。** 原来的直流稳态模型（万用表读数）不变；时域是可选的第二种模式。读数全部是仿真，不是实测；**不替代真实安全培训**。

- **时域求解器**（`src/sim/transient.js`，自写，无第三方依赖）：改进节点法 + 定步长，梯形法 / 后向欧拉两种积分（伴随模型），非线性器件每步迭代求解。器件（`src/sim/devices.js`）：电阻、电容（带 ESR）、电感（带 DCR，升压 / 降压电感的简化）、二极管（指数模型）、开关、LiPo（内阻 + RC 极化 + 按电量的开路电压，“下垂”模型，参数估算）、LDO（带压差）、升压模块（软启动 + 限流 + 打嗝，行为模型，不是逐周期开关）、舵机（起步冲击 / 堵转电流随时间变化的负载）、主控欠压复位（阈值 + 回差 + 重启延时，估算）。
- **对解析解的误差**（`node scripts/transient-test.mjs`，29/0；最大绝对误差，阶跃 1 V）：

  | 电路 | 梯形法 N=50 / 200 / 1000 | 后向欧拉 N=1000 | 收敛阶（梯形 / 欧拉） |
  |---|---|---|---|
  | RC 阶跃 τ=1 ms | 4.25e-3 / 3.00e-4 / 1.24e-5 | 9.18e-4 | 1.98 / 0.99 |
  | RL 阶跃 τ=100 µs | 4.25e-3 / 3.00e-4 / 1.24e-5 | 9.18e-4 | 1.98 / 0.99 |
  | RLC 欠阻尼 ζ=0.16 | 1.26e-1 / 1.11e-2 / 4.97e-4 | 3.57e-2 | 1.93 / 0.88 |
  | RLC 临界阻尼 | 1.03e-2 / 1.06e-3 / 4.84e-5 | 1.54e-3 | 1.92 / 0.99 |
  | RLC 过阻尼（刚性） | 5.64e-3 / 3.10e-3 / 3.49e-4 | 9.43e-4 | 1.36 / 0.99 |

  另有半波整流峰值 / 纹波、LiPo 瞬间压降 72 mV（理论 72 mV）、LDO 压差、升压软启动 0.91 ms、限流打嗝、欠压复位与重启的检查。
- **稳态交叉核对**：时域跑到稳定后取平均，和直流模型比：原有模板（LED、稳压、传感器、八爪鱼）最大差 2.77 mV；新的三板台架最大差 17.68 mV（在传感器输出 AOUT，差来自时域里有纹波和非线性平均，我的补充）。
- **示波器**（维修台工具 7，键盘 `7`）：4 通道，探头点在任意测试点 / 零件脚上；时基、每格电压、DC / AC 耦合、垂直偏移；触发（通道、上升 / 下降沿、电平、自动 / 单次，单次等不到边沿会显示“等待触发”）；两条光标（Δt、1/Δt、每通道 ΔV）；数学 CH1 − CH2；三种抓法：连续 / 抓开机 / 抓舵机起步。屏幕上画主控欠压复位阈值（估算）和复位、启动、打嗝、低压保护的事件标记。面板上有“探头地夹”提醒：所有探头的地在仪器里是连在一起的，并通过电源线接大地，夹错地等于短路。
- **6 个示波器关卡**（新的“三板台架”：电源板 + 控制板 + 舵机板，用插头和排线连接；故障在万用表上不明显，要看波形）：

  | 关卡 | 难度 | 故障 | 示波器看到的（e2e 实测：故障 → 修好） |
  |---|---|---|---|
  | 舵机一起步，主控就重启 | ★★★ | 舵机板储能电容 C5 没装 | 3V3 最低 2.77 V → 3.24 V，复位 6 → 0 次 |
  | 放久了的机器人，电源嗡嗡响 | ★★★ | 输出电解电容干涸（容量掉、ESR 高） | 5 V 纹波 47 → 25 mV 峰峰 |
  | 升压模块一直在限流 | ★★★★ | 一个舵机堵转 | 5V_S 平均 1.45 V → 4.96 V |
  | 传感器读数一直在跳 | ★★★ | 传感器 RC 滤波电容 C4 没装 | AOUT 噪声 84 → 12 mV 峰峰 |
  | 舵机一动，传感器就乱（三块板） | ★★★★ | 电源排线负极端子退针，回流走细信号地 | GND_S − GND_C 最大 129 → 24 mV |
  | 无线一发射，主控就重启（三块板） | ★★★★★ | 电源排线正极端子没压好（约 6 Ω，估算） | 控制板 5 V 最低 3.03 V → 5.13 V |

  新动作：压线钳（工具 8，“重新压端子”）、换舵机、电解电容有方向（装反会出事）。每关都测了：故障在波形里看得到、预期修法修得好、错误修法修不好。
- **装配台示波器**：仿真八爪鱼 v10 参考板的电源树（电池 → 两个 5 V 升压 → 8 个舵机，主控直接吃电池电压）。新电池、5VA 不加电容时舵机起步 5VA 跌落 265 mV 峰峰，并 470 µF 后 55 mV；换老化电池（内阻 0.25 Ω，估算，我的补充）主控欠压复位 4 次，加多大电容都救不了（主控挂在电池上）；并 1000 µF 再抓开机，冲击电流把电池拉低，主控起不来。**注意**：这是参考板，不是工作台上当前连的电路（工作台电路检查是直流模型）。
- **测试**：`node scripts/transient-test.mjs`（29 项）、`node scripts/scope-test.mjs`（63 项，无浏览器：每关故障在波形里、修好后消失、错误修法不消失、旧 12 关不受影响）、`node e2e/v18-bench.mjs`（51 项浏览器走查 + 截图 + 视频）。

**简化和限制**（如实写）：
- 元件都是理想的；只算写明的寄生量（电容 ESR、电感 DCR、线阻、端子接触电阻、电池内阻），没有 PCB 走线电感、探头电容、EMI、温度。
- 升压 / 降压 / LDO / 舵机 / 主控是行为模型：升压不逐周期仿真开关管，纹波用按占空比的零均值脉冲电流叠加（时基足够小、步长 ≤ 开关周期 / 16 时才算）；舵机电流曲线和欠压阈值是估算，不代表某个具体型号。
- 定步长：最快能看到的现象受步长限制（步长 = 屏幕宽度 / 2500，限制在 20 ns–200 µs）；不做自适应步长。
- 示波器没有带宽限制、没有采样混叠、没有探头补偿；“地夹”只写了提醒，不仿真接错地的短路。
- 不显示价格；所有零件参数要么来自数据手册的典型值，要么标了估算。

## v17：维修关卡（早期原型，简化仿真）

**打开 `/repair`。** 拿到一块“坏板子”，先看、再量、最后动烙铁，修好后交付验收、拿成绩单。读数全部来自本项目的直流仿真，不是实测；**不替代真实安全培训**。

- **关卡 = JSON**（`src/repair/scenarios.js`）：板子模板 + 注入的故障 + 客户描述 + 现象 + 3 级提示 + 根本原因 / 教训 / 安全提示 + 标准工时（估算）。验收按板子的 spec（LED 电流、网络电压、主控状态、I2C、舵机在动、低压保护、没有烧坏的零件）；可以要求“有序”修理（例如先消除反接风险再给新 U1 通电）。
- **12 关**（难度 ★ → ★★★★★）：

  | # | 关卡 | 难度 | 板子 | 故障 |
  |---|---|---|---|---|
  | 1 | 夜灯不亮了 | ★ | LED 夜灯 | 电池没电（约 2 V） |
  | 2 | 夜灯暗得几乎看不见 | ★ | LED 夜灯 | R1 装成 22 kΩ（换 10 Ω 会烧 LED） |
  | 3 | 换了灯珠还是不亮 | ★★ | LED 夜灯 | LED 装反 |
  | 4 | 夜灯时亮时不亮 | ★★ | LED 夜灯 | R1 一只脚冷焊 |
  | 5 | 稳压模块一插上就烫手 | ★★ | 9 V→3.3 V 稳压 | 输出锡桥 |
  | 6 | 换了个适配器，模块冒了一股味 | ★★★ | 9 V→3.3 V 稳压 | 反接 + 防反二极管被飞线短接 + U1 烧（有序） |
  | 7 | 传感器读不到数据 | ★★★ | I2C 传感器 | 漏装上拉电阻 |
  | 8 | 摔了一下之后传感器就不行了 | ★★★ | I2C 传感器 | 走线裂纹 |
  | 9 | 八爪鱼开机了但不走路 | ★★★ | 八爪鱼 v10 | 锂电 3.45 V |
  | 10 | 八爪鱼一走就重启 | ★★★★ | 八爪鱼 v10 | 电源线 30AWG、0.3 m |
  | 11 | 八爪鱼走着走着突然断电 | ★★★★ | 八爪鱼 v10 | 电池插座簧片疲劳（插紧没用） |
  | 12 | 八爪鱼：两条腿不动，还越来越没劲 | ★★★★★ | 八爪鱼 v10 | 低电 + 舵机插头插反 + 冷焊 |

- **玩法**：正面 / 背面翻面、旋转 90°、滚轮缩放、拖动平移、拆外壳、放大镜（3× 圆形放大，读色环 / 芯片丝印 / 焊点）。工具栏 1–6：手、万用表（电压 / 电阻 / 通断 / 二极管档，红黑表笔放零件脚、背面焊盘或测试点）、镊子、电烙铁 + 焊锡、吸锡带、放大镜。可以补焊、拆焊、从零件箱焊新件（装错阻值 / 方向 / 型号有后果，会烧东西）、换线、飞线跨断线、换插座、换电池。
- **安全规则**：通电或电池还接着时动烙铁 / 改线会被拦下并扣 15 分；通电量电阻会提示读数不准并扣 5 分（只扣一次）。所有关卡都只有低压直流；页面和成绩单都写着“永远不要用表笔碰市电”。
- **计分**：100 分起；提示 5 / 10 / 20；安全违规 15；用错零件 5；修理中烧坏零件 10；超出标准工时每 2 分钟扣 1 分、最多 20（工时是估算）。≥90 三星，≥70 两星。**不显示价格**（没有可核实的报价），只列用了哪些零件。最好成绩存在本机 localStorage（`repair.progress.v1`）。
- **关卡编辑器**（`/repair?tab=editor`）：选模板或“从装配台导入当前电路”（装配台 → 电路面板 → “把这个电路做成维修关卡”）→ 从列表里挑故障 → 写文字 → 校验（故障能不能被观察到、健康板能不能过验收、带故障是不是还能过）→ 保存到本机 / 试玩 → 导出 / 导入关卡包 JSON（`proto-repair/1`）。
- **测试**：`node scripts/repair-test.mjs`（190 项：每关的故障读数、修好后的读数、预期修法、错误修法、修法分组乱序 20 次、有序关卡顺序错、烧件案例、编辑器）；`node e2e/v17-bench.mjs`（42 项浏览器走查 + 截图 + 视频）。

**简化和限制**（如实写）：
- 直流稳态电路（节点电压法），没有瞬态、电容、电感、频率（v18 起有可选的时域模式，见上）；“一走就重启”是用“舵机全速时的电流”算一次压降，不是波形。
- 电阻 / 压降 / 内阻 / 接触电阻 / 焊点电阻多数是估算（代码里标了“估算”）；AWG 线阻用常见的实心铜线 20 °C 表（22AWG 约 0.053 Ω/m，30AWG 约 0.339 Ω/m）。
- 万用表是理想表笔（不计表笔 0.1–0.3 Ω）；二极管档按“约 3 V、限流约 1 mA”的常见量级估算。
- 主控、I2C、舵机是行为模型（够不够电压、上拉在不在范围），不跑真实固件。
- 烧坏按“超过额定电流 / 功率就坏”判断，不模拟温度上升时间。
- 装配台导入只取电阻、LED 和 USB 供电板子的 3V3 / 5V 脚；GPIO、按钮、舵机不导入。
- 工时是“真实维修大概要多久”的估算，不是游戏里经过的时间。

## v16：实物连接——浏览器 ↔ ESP32（早期原型，简化仿真）

**全部是软件，没接过真板子。** 协议、固件、重连、急停只在编译器、浏览器里的模拟设备和假浏览器 API 桩上测过。

- **实物连接面板**（装配台 → 八爪鱼面板 → “实物连接”；`src/link/`）：
  - 三种连接：USB 串口（Web Serial，115200）、蓝牙 BLE（Web Bluetooth，Nordic UART Service，设备名前缀 `OctoBrain`，按 20 字节分包）、**模拟设备（演示）**。
  - 指令：开始 / 更新速度（GO 油门 转向）、停（STOP）、限速（RATE）；高级里有姿势（POSE 8 路）和步态参数（GAIT 6 个）。
  - 遥测：8 路角度、电池、IMU 横滚 / 俯仰、模式、运行时间。叠加图：蓝线是浏览器里的仿真孪生（同一份 firmware.js 吃被确认的指令），橙线是板子回传的值。差值表给出每路 RMS / 最大差、电池、倾角、往返延迟、遥测丢帧率。
  - 不支持的浏览器（没有 Web Serial / Web Bluetooth、不是 https）会明确提示“请用电脑上的 Chrome 或 Edge”，串口 / 蓝牙按钮禁用；模拟设备仍可用。
- **协议 OCTL/1**（`src/link/protocol.js`，固件 `octopus_link_core.h` / `octopus_link.h`）：
  - 一行一帧：`@序号 指令 参数…*CRC16\n`，最长 160 字节，CRC‑16/CCITT‑FALSE（校验值 0x29B1）。
  - 指令：`HELLO 1`、`PING`、`GO`、`STOP`、`ESTOP`、`POSE`、`GAIT`、`TRIM`、`RATE 30–240`、`TEL 0–20 Hz`。
  - 应答 `OK` / `NAK 1–9`；板子主动发 `TEL`、`EVT`（1 心跳超时、2 BLE 断开、3 电量低）、`BOOT`（复位原因）。
  - 每条 400 ms 等应答、重发 2 次；PING 每 400 ms；1.2 s 没帧判掉线；退避 0.3 → 4 s 自动重连，最多 12 次。
- **安全**（我的补充）：
  - 限速 240 °/s（舵机标称 300 °/s 的 80%），浏览器和固件两边都卡；GAIT 超速会自动降频率。
  - 角度限位：姿势 ±55°，中位 ±20°，再加校准的上下限。
  - 大红急停（也可按 Esc；关页面时也会发）：浏览器端先锁住，连发 3 次；板子断电锁定，直到 STOP。重连后急停仍然保持。
  - 板子 1.5 s 没收到帧就自己停；BLE 断开立刻停；**重连后从不自动恢复动作**；电量低拒绝动作（NAK 7）。
  - **演练（不发送）**：不打开串口 / 蓝牙，所有帧只记在面板里（e2e 验证写入 0 字节）。
- **校准向导**：每路中位 / 下限 / 上限，存在浏览器 localStorage（`octo.calib.v1`），连着板子时实时发 TRIM + POSE；可导出 `octopus_trim_custom.h`（`kCenter / kMin / kMax`）编进固件。
- **固件**：`GAIT_SRC=v15 CTRL_CFG=scripts/ctrl-wheel.json bash scripts/fw-compile.sh`。
  - v10 + 步态 + 闭环 + 校准 + OCTL/1：717308 B。
  - 完善版 OCTO_RIG=8 + 校准 + OCTL/1：626460 B。
  - 所有组合我们的文件 0 警告（md 原样固件不算，按原文保留）。
  - 主机端 C 版 `scripts/octl-host.c` 和 JS 解析器做了 4000 行模糊对拍，结果逐项相同。
- **模拟设备**（`src/link/device.js`、`transports.js`）：
  - 同一份 firmware.js v10 孪生，加上延迟（串口 4±3 ms / 蓝牙 30±15 ms）、丢包、坏帧、时钟漂移、电池压降、合成 IMU。参数都是**估算**。
  - 故障按钮：信号丢失 3 s、蓝牙断开 2 s、欠压复位、固件卡死 2 s。
  - 面板上始终标着“模拟设备，不代表真机”。
- **老实说的限制**：
  - 没上过真 ESP32。
  - TEL 回传的是固件的**指令角度**，舵机没有位置反馈。
  - 很多 ESP32 板子打开串口时 DTR/RTS 会复位板子，第一次连接会多等约 1 s。
  - Web Serial 只有电脑版 Chrome / Edge（https 或 localhost）有；Web Bluetooth 在 Linux 上可能要开实验开关。无头 Chrome 里没有 `navigator.bluetooth`，所以 e2e 用假的浏览器 API 桩来跑真的传输层代码。
  - 没接 IMU 时倾角显示“—”。
- **出处 / 许可**：Web Serial、Web Bluetooth 是浏览器内置的 W3C WICG API；NUS UUID 是 Nordic Semiconductor 公开的约定；CRC‑16/CCITT‑FALSE 是公开算法。OCTL/1、固件处理、模拟设备和面板都是本项目自写，和仓库同一许可。没加第三方库。
- **测试**：
  - `node scripts/link-test.mjs`：61 项，已加进 `sh scripts/engine-test.sh`。覆盖 CRC、模糊对拍、分包、安全限幅、校准、孪生、会话 + 模拟设备（掉线、重连、急停、欠压、演练）。
  - 浏览器走查 `node e2e/v16-bench.mjs`：34 项，会录 demo.mp4。

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
