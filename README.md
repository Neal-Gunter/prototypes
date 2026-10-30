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
- **语言说明**：页脚注明界面以中文为主，零件名、数据手册术语和代码保留英文，暂时没有英文版（`<html lang="zh-Hans">`）。
- **限制（我的补充）**：
  - 还有 12 件没有跑凸包（每件 1–13 分钟），仍是长方体。
  - 4 件外扩超过 3 mm。
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
