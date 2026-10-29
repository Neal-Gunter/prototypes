import { create } from "zustand";
import { DEFAULT_SLOTS, PART_TYPES, PLATE, pinsOfType, splitPinId, wireColorFor } from "./parts";
import { sim, resetSim } from "./sim";
import { startFirmware, stopFirmware } from "./firmware/runner";

export const HEAT_MS = 500; // 先加热焊盘
export const HOLD_MS = 1300; // 再送锡并保持，到这个时间才算焊好
export const MIN_MS = 200; // 太短算没碰到

export const DEFAULT_CODE = `// 简化固件：在网页里的 JS 解释器中运行，不是真实的 ESP32-S3 仿真
#include <ESP32Servo.h>

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(4);          // 舵机 1 的信号线（橙）接 GPIO4
  Serial.println("开始摆动触手 1");
}

void loop() {
  for (int a = 30; a <= 150; a += 10) {
    servo.write(a);
    delay(60);
  }
  Serial.println("到达 150 度");
  for (int a = 150; a >= 30; a -= 10) {
    servo.write(a);
    delay(60);
  }
  Serial.println("回到 30 度");
}
`;

let seq = 1;
const roleOf = (id, parts) => {
  const [partId, name] = splitPinId(id);
  const part = parts.find((p) => p.id === partId);
  return part ? pinsOfType(part.type).find((p) => p.name === name)?.role : null;
};

function snap(v) {
  return Math.round(v * 2) / 2;
}

export const useBench = create((set, get) => ({
  parts: [],
  wires: [],
  joints: {}, // pinId -> 'cold' | 'good'
  tool: "select", // select | wire | iron
  pendingPin: null,
  selectedPart: null,
  dragging: null,
  solder: null, // {pin, start}
  solderProgress: 0,
  toast: null,
  guided: true,
  movedOnce: false,
  code: DEFAULT_CODE,
  fw: { status: "idle", error: null, errorLine: null, serial: [], pins: {}, notes: [] },

  say(msg, level = "info") {
    set({ toast: { msg, level, at: Date.now() } });
  },

  setTool(tool) {
    set({ tool, pendingPin: null });
  },
  setGuided(guided) {
    set({ guided });
  },

  countOf(type) {
    return get().parts.filter((p) => p.type === type).length;
  },

  addPart(type, pos) {
    const { parts } = get();
    const def = PART_TYPES[type];
    const have = parts.filter((p) => p.type === type);
    if (have.length >= def.max) {
      get().say(`${def.label}最多放 ${def.max} 个`, "warn");
      return null;
    }
    let id = type;
    if (type === "servo") {
      for (let i = 1; i <= def.max; i++) if (!parts.some((p) => p.id === `servo${i}`)) { id = `servo${i}`; break; }
    }
    let x, z;
    if (pos) {
      x = snap(pos.x);
      z = snap(pos.z);
    } else {
      const idx = type === "servo" ? Number(id.replace("servo", "")) - 1 : 0;
      ({ x, z } = DEFAULT_SLOTS[type][idx]);
    }
    const hw = PLATE.w / 2 - 1;
    const hd = PLATE.d / 2 - 1;
    x = Math.max(-hw, Math.min(hw, x));
    z = Math.max(-hd, Math.min(hd, z));
    set({ parts: [...parts, { id, type, x, z, rot: 0 }], selectedPart: id });
    return id;
  },

  movePart(id, x, z) {
    const hw = PLATE.w / 2 - 1;
    const hd = PLATE.d / 2 - 1;
    set({
      parts: get().parts.map((p) =>
        p.id === id ? { ...p, x: Math.max(-hw, Math.min(hw, snap(x))), z: Math.max(-hd, Math.min(hd, snap(z))) } : p,
      ),
    });
  },

  rotatePart(id) {
    set({ parts: get().parts.map((p) => (p.id === id ? { ...p, rot: ((p.rot || 0) + Math.PI / 2) % (Math.PI * 2) } : p)) });
  },

  removePart(id) {
    const prefix = `${id}.`;
    const joints = { ...get().joints };
    for (const k of Object.keys(joints)) if (k.startsWith(prefix)) delete joints[k];
    set({
      parts: get().parts.filter((p) => p.id !== id),
      wires: get().wires.filter((w) => !w.a.startsWith(prefix) && !w.b.startsWith(prefix)),
      joints,
      selectedPart: null,
    });
  },

  setDragging(dragging) {
    set({ dragging });
  },
  selectPart(id) {
    set({ selectedPart: id });
  },

  clickPin(id) {
    const { tool, pendingPin, wires, parts } = get();
    if (tool !== "wire") {
      if (tool === "select") get().say("先在工具栏选“连线”，再点两个引脚");
      return;
    }
    if (!pendingPin) {
      set({ pendingPin: id });
      return;
    }
    if (pendingPin === id) {
      set({ pendingPin: null });
      return;
    }
    if (wires.some((w) => (w.a === pendingPin && w.b === id) || (w.a === id && w.b === pendingPin))) {
      get().say("这两个引脚已经连过了", "warn");
      set({ pendingPin: null });
      return;
    }
    const color = wireColorFor(roleOf(pendingPin, parts), roleOf(id, parts));
    const joints = { ...get().joints };
    // 简化：每个接点都当作焊点；新加一根线后，这两个焊点要重新焊
    delete joints[pendingPin];
    delete joints[id];
    set({ wires: [...wires, { id: `w${seq++}`, a: pendingPin, b: id, color }], pendingPin: null, joints });
  },

  removeWire(wid) {
    const w = get().wires.find((x) => x.id === wid);
    const wires = get().wires.filter((x) => x.id !== wid);
    const joints = { ...get().joints };
    if (w) for (const p of [w.a, w.b]) if (!wires.some((x) => x.a === p || x.b === p)) delete joints[p];
    set({ wires, joints });
  },

  startSolder(pin) {
    const { tool, wires } = get();
    if (tool !== "iron") {
      get().say("先拿起烙铁（工具栏“烙铁”）");
      return;
    }
    if (!wires.some((w) => w.a === pin || w.b === pin)) {
      get().say("这个引脚还没接线，不用焊", "warn");
      return;
    }
    set({ solder: { pin, start: performance.now() }, solderProgress: 0 });
  },

  tickSolder() {
    const s = get().solder;
    if (!s) return;
    const el = performance.now() - s.start;
    if (el >= HOLD_MS) {
      set({ solder: null, solderProgress: 0, joints: { ...get().joints, [s.pin]: "good" } });
      get().say("焊好了：焊点光亮饱满", "ok");
    } else set({ solderProgress: el / HOLD_MS });
  },

  endSolder() {
    const s = get().solder;
    if (!s) return;
    const el = performance.now() - s.start;
    if (el >= HOLD_MS) return get().tickSolder();
    if (el < MIN_MS) {
      set({ solder: null, solderProgress: 0 });
      get().say("烙铁碰一下就走了：要按住，先加热焊盘再送锡", "warn");
      return;
    }
    set({ solder: null, solderProgress: 0, joints: { ...get().joints, [s.pin]: "cold" } });
    get().say(el < HEAT_MS ? "焊盘还没热就松手了：虚焊" : "送锡后保持时间不够：虚焊。再按住重焊一次", "error");
  },

  // ---------- 固件 ----------
  setCode(code) {
    set({ code });
  },

  flash() {
    const { parts, code } = get();
    if (!parts.some((p) => p.type === "esp32")) {
      get().say("先把 ESP32‑S3 放到底板上（简化：默认通过 USB 连接电脑）", "warn");
      return;
    }
    resetSim();
    const noted = new Set();
    set({ fw: { status: "compiling", error: null, errorLine: null, serial: [], pins: {}, notes: [] }, movedOnce: false });
    const pushSerial = (text, nl, kind = "fw") =>
      set((st) => {
        const serial = st.fw.serial.slice(-300);
        const last = serial[serial.length - 1];
        if (last && last.open && kind === "fw") {
          serial[serial.length - 1] = { ...last, text: last.text + text, open: !nl };
        } else serial.push({ text, kind, open: !nl && kind === "fw" });
        return { fw: { ...st.fw, serial } };
      });
    const note = (key, text) => {
      if (noted.has(key)) return;
      noted.add(key);
      pushSerial(text, true, "sim");
    };
    startFirmware(code, (ev) => {
      const st = get();
      switch (ev.type) {
        case "compiled":
          set({ fw: { ...st.fw, status: "running" } });
          pushSerial("[仿真] 烧录完成（简化：代码由页面里的解释器运行）", true, "sim");
          break;
        case "serial":
          pushSerial(ev.text, ev.nl);
          break;
        case "attach":
          sim.pinCmd[ev.pin] = sim.pinCmd[ev.pin] ?? 90;
          set({ fw: { ...st.fw, pins: { ...st.fw.pins, [ev.pin]: { mode: "舵机 PWM", value: sim.pinCmd[ev.pin] } } } });
          break;
        case "write": {
          sim.pinCmd[ev.pin] = ev.angle;
          set({ fw: { ...st.fw, pins: { ...st.fw.pins, [ev.pin]: { mode: "舵机 PWM", value: ev.angle } } } });
          const a = sim.analysis;
          const servos = a ? Object.entries(a.servoStatus) : [];
          const driven = servos.filter(([, s]) => s.ok && s.gpio === `GPIO${ev.pin}`);
          if (!driven.length) {
            const wiredTo = servos.find(([id]) => a.netOf(`${id}.SIG`).some((p) => p.name === `GPIO${ev.pin}`));
            if (wiredTo) note(`p${ev.pin}-${wiredTo[1].reasons[0]}`, `[仿真] ${wiredTo[1].label} 没有动：${wiredTo[1].reasons[0]}`);
            else note(`p${ev.pin}-none`, `[仿真] GPIO${ev.pin} 上没有接好的舵机，所以什么都不会动`);
          }
          break;
        }
        case "pin":
          set({
            fw: {
              ...st.fw,
              pins: {
                ...st.fw.pins,
                [ev.pin]: {
                  mode: ev.mode ?? st.fw.pins[ev.pin]?.mode ?? "OUTPUT",
                  value: ev.value != null ? (ev.value ? "HIGH" : "LOW") : st.fw.pins[ev.pin]?.value ?? "-",
                },
              },
            },
          });
          break;
        case "warn":
          pushSerial(`[仿真] ${ev.msg}`, true, "sim");
          break;
        case "error":
          stopFirmware();
          set({
            fw: {
              ...get().fw,
              status: "error",
              error: `${ev.phase === "compile" ? "编译错误" : "运行错误"}${ev.line ? `（第 ${ev.line} 行）` : ""}：${ev.msg}`,
              errorLine: ev.line,
            },
          });
          break;
        case "done":
          set({ fw: { ...get().fw, status: "stopped" } });
          break;
        default:
      }
    });
  },

  stop() {
    stopFirmware();
    set({ fw: { ...get().fw, status: "stopped" } });
  },

  markMoved() {
    if (!get().movedOnce) set({ movedOnce: true });
  },

  resetAll() {
    stopFirmware();
    resetSim();
    set({
      parts: [],
      wires: [],
      joints: {},
      pendingPin: null,
      selectedPart: null,
      solder: null,
      movedOnce: false,
      fw: { status: "idle", error: null, errorLine: null, serial: [], pins: {}, notes: [] },
    });
  },
}));
