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
