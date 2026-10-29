# 硬件验证

首页和示例页是可点击的概念演示。工作台是另一页上的早期原型：可以放置简化零件、接线、焊接，并用一个很小的 JavaScript 解释器跑一段类似 Arduino 的程序。界面文案是简体中文。

首页和示例页顶部仍是 `Concept mock, not a working product`。工作台顶部是 `Early prototype, simplified simulation`。

这不是成品。工作台不加载 MuJoCo，不仿真 ESP32‑S3，不保存等候名单，也不提供真实焊接步骤。

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

## Click path

1. 打开首页，点「打开工作台」。
2. 放置：把 ESP32‑S3、电池和舵机 A 拖到基板上，或点「放到基板」。松手后零件吸到基板的空位。舵机 B、舵机 C 可以留下，也可以一起放上。
3. 接线：先点一个引脚，再点另一个零件上的引脚。先把电池 BAT+ 接到 5V，BAT− 接到 GND，舵机 A 的 VCC 接到 BAT+，GND 接到 GND。
4. 故意接错：把舵机 A 的 SIG 接到 GPIO1。检查面板应显示「检查未通过」，并指出信号线接在非 PWM 引脚上。
5. 改正：拆除那根线，把 SIG 接到 GPIO4。检查改为指出焊点还没焊。
6. 焊接：点「拿起烙铁」，对每根线按住「按住焊接」，直到热量条走满（大约一秒）。提前松开会记成冷焊，可以按住重焊。
7. 检查通过后，面板写「按简化规则可以通过」。
8. 固件：示例程序是 `arm.attach(4)` 和 `arm.write`。点「运行」。串口和引脚状态会更新。只有接线正确、焊点合格并且供上电，舵机才会动。
9. 观察：1 号触手跟着舵机 A 的角度弯曲。运动是简化的。

引导模式默认开着，按放置、接线、焊接、固件、观察往下走。可以关掉。

左键拖已经放上的零件，松手后重新吸到空位。右键转动视角，滚轮缩放。

## Pages

- `/` — 概念首页：想法 → 仿真 → 装配，三张功能卡，适合谁，等候名单。工作台是首页上的另一个入口。
- `/example` — 八触手概念页，标签仍是想法 / 仿真 / 装配。仿真面板仍是占位。
- `/workbench` — 早期原型。简化三维工作台、接线检查、烙铁、解释器、一条会动的触手。

## What is stubbed

- 零件外形是程序生成的简化块，不是 ESP32‑S3、MG90S 或电池的 CAD，也不是数据手册引脚图。这一页只保留了演示用的一批脚。
- 「PWM」只包括 GPIO4、GPIO5、GPIO6、GPIO7、GPIO15、GPIO16。这是页面规则，不是芯片手册。
- 检查只覆盖明显的接错、缺地、没焊和冷焊。它不验证真实电气，不能当焊接教程。
- 固件由 `src/workbench/firmware/engine.js` 解释，在 Web Worker 里执行。没有 eval，也没有 ESP32‑S3 仿真。`loop` 最多 3 次，`delay` 最大 5000 毫秒。
- 舵机只有在信号、电源、共地和开发板供电都按简化规则接通，并且相关焊点合格时才会转。1 号触手跟随舵机 A。舵机 B、C 如果同样接通，会分别带动 2 号、3 号触手。其余触手停在休息姿态。
- 物理是运动学骨架加弹簧，不是刚体接触，也不是舵机动力学。没有加载 MuJoCo。
- 示例页的 MuJoCo WASM 面板和 ESP32‑S3 面板仍是占位。
- 等候名单只留在首页状态里，不发送，不保存。
- 页面上的角度和热量是这一页自己的示意，不是测量值。

## Seams

### MuJoCo WASM

`src/workbench/physics/adapter.js` 的 `createPhysicsAdapter()` 是场景唯一的物理入口。

现在它返回 `SimplifiedTentaclePhysics`（`PHYSICS_ID = "simplified-kinematic-spring"`）：

- `setTargets(angles)`：长度 8。被接通的触手传入 0–180 度，没有接通的传入 `null`。
- `step(dtSeconds, reducedMotion)`：返回 8 个大约在 -1 到 1 之间、已经做完弹簧过渡的弯曲值。
- `dispose()`

要换上 MuJoCo WASM 时，新增一个实现同一组方法的适配器，只在 `createPhysicsAdapter()` 里返回它。不要在 React 组件里直接 import MuJoCo。换之前不要把现在的弹簧模型说成 MuJoCo。

### Real firmware emulation

`src/workbench/firmware/runner.js` 的 `createFirmwareRunner()` 是页面唯一的固件入口。

`run(source)` 把文本交给 `firmware/worker.js`。worker 只 import `firmware/engine.js`，没有 DOM。解释器遍历自己的语法树，不调用 `eval` 或 `Function`。

事件：

- `{ t, type: "log", text }`
- `{ t, type: "servo", name, pin, angle }`
- `{ t, type: "done" }`

`t` 是解释器时钟的毫秒，不是芯片周期。

要换上真正的 ESP32‑S3 仿真时，替换 worker，让它仍返回这组事件。React 界面继续只调用 runner。解释器不是那颗芯片。

支持的语句：`Servo 名字;`、`名字.attach(脚)`、`名字.write(角度)`、`delay(毫秒)`、`Serial.print` / `Serial.println`、`setup() {}`、`void setup() {}`、`loop() {}`、`void loop() {}`。行注释和块注释可以写。
