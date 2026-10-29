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
- `/example` — eight-tentacle robot driven by an ESP32-S3, with tabs 想法 / 仿真 / 装配 (`?tab=idea|simulate|assemble`)

## What is stubbed

- MuJoCo WASM mechanical / physics panel: placeholder, library not loaded
- ESP32-S3 firmware / MCU panel: placeholder, chip not simulated
- Servo slider: animates a tentacle drawing only; it does not drive either panel
- Soldering checklist: sample lines for the mock; ticks stay in page state
- Waitlist: email plus an optional free-text answer, held in page state only; nothing is sent or stored


## Workbench (`/workbench`) — early prototype, simplified simulation

The page shows the label 早期原型，简化仿真 / Early prototype, simplified simulation. Everything below is simplified.

Flow (guided mode on top of the page): 放置零件 → 连线 → 焊接 → 烧录代码 → 看它动.

What works:

- **Assemble**: 3D bench (three.js / react-three-fiber). Procedural, simplified models: ESP32‑S3 dev board with 20 labeled pins (pin layout is *not* the real board), up to 3 MG90S‑like servos, 4×AA battery box. Drag a part from the tray onto the base plate (or click to drop it at a suggested spot). Parts snap to a 0.5 grid, can be moved, rotated 90° and removed.
- **Wire and solder**: wire tool = click pin → pin (Dupont wire drawn as a curve; double‑click or the list to delete). Iron tool = press and hold on a joint: 0.5 s heating, then keep holding until 1.3 s total. Releasing early gives a cold joint (虚焊) that must be redone. Joints can also be soldered from the joint list (keyboard accessible).
- **Check panel** (`src/workbench/circuit.js`, rule based, no voltages/currents): short circuits, two supplies tied together, power on a signal pin, servo signal on a non‑PWM pin (EN, GPIO43/44 UART0, GPIO0 strapping), reversed VCC/GND, missing common ground, unsoldered and cold joints, 3V3 too low for a servo, 5V/USB powering servos (warning).
- **Firmware**: in‑page editor with a mini Arduino dialect (`Servo.attach/write/read`, `delay`, `millis`, `Serial.begin/print/println`, `pinMode/digitalWrite/digitalRead`, `map/constrain/min/max/abs/sin/cos/random`, `int/float/bool/String`, arrays, functions, `if/for/while`). Hand‑written tokenizer + parser + generator interpreter running in a Web Worker (`src/workbench/firmware/`), no `eval` / `new Function`. Serial monitor and pin table. A servo only moves when its circuit passes the check; otherwise the serial log shows a `[仿真]` note why.
- **Robot**: 8‑tentacle body; tentacle *n* follows servo *n* through a spring‑damper chain (`src/workbench/physics/simpleSpring.js`).

What is stubbed / not real:

- No ESP32‑S3 emulation, no compiler; the interpreter only knows the subset above.
- No electrical simulation; each pin is one joint; solder quality = hold time.
- **MuJoCo WASM seam**: `src/workbench/physics/index.js` documents the `PhysicsBackend` interface (`step(dt, drives)`, `getPose()`, `dispose()`). `createPhysicsBackend("mujoco")` loads `mujocoAdapter.js`, which is a documented stub that throws until a MuJoCo WASM build and an MJCF model are added.

Automated walkthrough (Playwright, headless Chrome): `e2e/walk.mjs` — needs `npm run build && npm run preview -- --port 4173` running; it places parts, mis‑wires (signal on GPIO43, no common ground), fixes, makes a cold joint, re‑solders, flashes code with a typo, fixes it, and checks the servo angle changes. Screenshots are written to `OUT` in the script.
