import { create } from "zustand";
import {
  DEFAULT_SLOTS,
  PART_TYPES,
  PLATE,
  localToWorld,
  neighborPins,
  pinDisplayName,
  pinMeta,
  splitPinId,
  wireColorFor,
} from "./parts";
import { AMBIENT, resetSim, sim } from "./sim";
import { startFirmware, stopFirmware } from "./firmware/runner";
import { parse } from "./firmware/interpreter";
import { jointState, measure } from "./circuit";

// ---------- 焊接物理（简化的一阶热模型） ----------
export const MELT = 217; // SAC305 无铅焊锡熔点 ≈ 217 °C
export const WET_T = MELT + 20; // 焊盘要比熔点再高一些，锡才会铺开
export const GOOD_VOL = [0.4, 1.6]; // 锡量：少于下限像“饿焊”，多于上限会桥连
const TAU_HEAT = 0.35; // 秒：普通信号焊盘升温时间常数（接地焊盘 × 热容量倍数）
const TAU_COOL = 1.8;
const FEED_RATE = 0.85; // 每秒送锡量（相对单位，1 ≈ 一个饱满焊点）
const DAMAGE_T = 300; // 超过这个温度焊盘开始受损
const BURN_AT = 5;

export const DEFAULT_CODE = `// 简化固件：在网页里的 JS 解释器中运行，不是真实的 ESP32-S3 仿真
#include <ESP32Servo.h>

Servo servo;

void setup() {
  Serial.begin(115200);
  servo.attach(5);          // 舵机 1 的信号线（橙）接 Feather 的 5 号脚（GPIO5）
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
const roleOf = (id, parts) => pinMeta(parts, id)?.role;
const snap = (v) => Math.round(v * 4) / 4;
const emptyFw = () => ({ status: "idle", error: null, errorLine: null, serial: [], pins: {}, flash: null });
const clamp = (x, z) => {
  const hw = PLATE.w / 2 - 1;
  const hd = PLATE.d / 2 - 1;
  return [Math.max(-hw, Math.min(hw, x)), Math.max(-hd, Math.min(hd, z))];
};

export function attachGpioFromCode(code) {
  const m = /\.attach\(\s*(\d+)/.exec(code.replace(/\/\/.*$/gm, ""));
  return m ? Number(m[1]) : null;
}
export function mountedMap(parts, screws) {
  const out = {};
  for (const p of parts) if (p.type === "servo") out[p.id] = (screws[p.id] || [0, 0]).every((v) => v >= 1);
  return out;
}

const emptyRepair = () => ({
  found: { cold: false, swap: false, ground: false },
  foundHow: {},
  fixedOrder: {},
  log: [],
  penalties: { burnt: 0, bridge: 0, nick: 0, undo: 0, blind: 0 },
  startAt: Date.now(),
  done: null,
});

function wireEndsAt(wires, pin) {
  const out = [];
  for (const w of wires) for (const e of ["a", "b"]) if (w[e] === pin && w.loose !== e) out.push([w, e]);
  return out;
}

export const useBench = create((set, get) => ({
  mode: "build", // build | repair
  parts: [],
  wires: [],
  joints: {}, // pinId -> {state:'none'|'good'|'cold'|'bridge'|'burnt', vol, flux, damage, bridgeTo}
  screws: {}, // servoId -> [0..1, 0..1]
  usb: false,
  tool: "select", // select | wire | strip | iron | flux | wick | pump | meter | screw
  ironTemp: 350,
  stripGauge: 24,
  meter: { mode: "cont", red: null, black: null, next: "red", reading: null },
  op: null, // 正在进行的焊接/拆焊 {kind, pin}
  feeding: false,
  screwOp: null,
  pendingPin: null,
  pendingMove: null, // {wireId, end}
  selectedPart: null,
  dragging: null,
  toast: null,
  inspect: null,
  guided: true,
  movedOnce: false,
  lastPin: null,
  hintPins: [],
  code: DEFAULT_CODE,
  fw: emptyFw(),
  past: [],
  future: [],
  repair: emptyRepair(),

  say(msg, level = "info") {
    set({ toast: { msg, level, at: Date.now() } });
  },

  // ---------- 撤销 / 重做 ----------
  snapshot() {
    const { parts, wires, joints, screws, usb } = get();
    return { parts, wires, joints, screws, usb };
  },
  commit() {
    const past = [...get().past, get().snapshot()].slice(-80);
    set({ past, future: [] });
  },
  undo() {
    const { past, future } = get();
    if (!past.length || get().op) return;
    const prev = past[past.length - 1];
    set({ ...prev, past: past.slice(0, -1), future: [get().snapshot(), ...future], pendingPin: null, pendingMove: null });
    if (get().mode === "repair") get().penalize("undo");
    get().say("已撤销");
  },
  redo() {
    const { past, future } = get();
    if (!future.length) return;
    set({ ...future[0], future: future.slice(1), past: [...past, get().snapshot()] });
    get().say("已重做");
  },

  setTool(tool) {
    if (get().op) get().endOp();
    set({ tool, pendingPin: null, pendingMove: null, inspect: null });
  },
  setGuided(guided) {
    set({ guided });
  },
  setIronTemp(t) {
    set({ ironTemp: t });
  },
  setStripGauge(g) {
    set({ stripGauge: g });
  },
  setFeeding(v) {
    if (get().feeding !== v) set({ feeding: v });
  },
  setMeterMode(mode) {
    set({ meter: { ...get().meter, mode, reading: null } });
    get().remeasure();
  },
  setNextProbe(next) {
    set({ meter: { ...get().meter, next } });
  },
  clearProbes() {
    set({ meter: { ...get().meter, red: null, black: null, next: "red", reading: null } });
  },

  countOf(type) {
    return get().parts.filter((p) => p.type === type).length;
  },

  // ---------- 零件 ----------
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
      for (let i = 1; i <= def.max; i++)
        if (!parts.some((p) => p.id === `servo${i}`)) {
          id = `servo${i}`;
          break;
        }
    }
    let x, z;
    if (pos) [x, z] = [snap(pos.x), snap(pos.z)];
    else {
      const idx = type === "servo" ? Number(id.replace("servo", "")) - 1 : 0;
      ({ x, z } = DEFAULT_SLOTS[type][idx]);
    }
    [x, z] = clamp(x, z);
    get().commit();
    const screws = type === "servo" ? { ...get().screws, [id]: [0, 0] } : get().screws;
    set({ parts: [...parts, { id, type, x, z, rot: 0 }], selectedPart: id, screws });
    return id;
  },
  movePart(id, x, z) {
    const [cx, cz] = clamp(snap(x), snap(z));
    set({ parts: get().parts.map((p) => (p.id === id ? { ...p, x: cx, z: cz } : p)) });
  },
  rotatePart(id) {
    get().commit();
    set({ parts: get().parts.map((p) => (p.id === id ? { ...p, rot: ((p.rot || 0) + Math.PI / 2) % (Math.PI * 2) } : p)) });
  },
  removePart(id) {
    get().commit();
    const prefix = `${id}.`;
    const joints = { ...get().joints };
    for (const k of Object.keys(joints)) if (k.startsWith(prefix)) delete joints[k];
    const screws = { ...get().screws };
    delete screws[id];
    set({
      parts: get().parts.filter((p) => p.id !== id),
      wires: get().wires.filter((w) => !w.a.startsWith(prefix) && !w.b.startsWith(prefix)),
      joints,
      screws,
      selectedPart: null,
    });
  },
  setDragging(dragging) {
    if (dragging && !get().dragging) get().commit();
    set({ dragging });
  },
  selectPart(id) {
    set({ selectedPart: id });
  },

  // ---------- 引脚点击（按当前工具分派） ----------
  clickPin(id) {
    const { tool } = get();
    set({ lastPin: id });
    if (tool === "wire") return get().wireClick(id);
    if (tool === "meter") return get().placeProbe(id);
    if (tool === "flux") return get().applyFlux(id);
    if (tool === "select") return get().inspectPin(id);
    if (tool === "strip") return get().say("剥线钳要点在导线上（不是焊盘）");
    if (tool === "screw") return get().say("螺丝刀要按在舵机耳朵的螺丝孔上");
  },

  wireClick(id) {
    const { pendingPin, pendingMove, wires, parts } = get();
    if (pendingMove) {
      const w = wires.find((x) => x.id === pendingMove.wireId);
      const other = w && w[pendingMove.end === "a" ? "b" : "a"];
      if (!w || id === other) {
        set({ pendingMove: null });
        return;
      }
      get().commit();
      const joints = { ...get().joints };
      const msg = get().wetExisting(joints, id);
      set({
        wires: wires.map((x) => (x.id === w.id ? { ...x, [pendingMove.end]: id, loose: null } : x)),
        pendingMove: null,
        joints,
      });
      get().say(`线头接到了 ${pinDisplayName(parts, id)}，记得焊上${msg ? "（" + msg + "）" : ""}`);
      return;
    }
    // 点在一个已经拆开的线头上：拿起来
    const looseW = wires.find((w) => w.loose && w[w.loose] === id);
    if (looseW && !pendingPin) {
      set({ pendingMove: { wireId: looseW.id, end: looseW.loose } });
      get().say("拿起了松开的线头：再点一个焊盘，把它接过去");
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
      get().say("这两个点已经连过了", "warn");
      set({ pendingPin: null });
      return;
    }
    get().commit();
    const color = wireColorFor(roleOf(pendingPin, parts), roleOf(id, parts));
    const joints = { ...get().joints };
    get().wetExisting(joints, pendingPin);
    get().wetExisting(joints, id);
    set({
      wires: [...wires, { id: `w${seq++}`, a: pendingPin, b: id, color, strip: { a: "none", b: "none" }, loose: null }],
      pendingPin: null,
      joints,
    });
    get().say("剪了一段 24 AWG 导线。两头要先用剥线钳剥皮，才能焊");
  },
  // 焊盘上原来就有锡：新线头插进去后要重新熔合
  wetExisting(joints, id) {
    const j = joints[id];
    if (j && j.state === "good") {
      joints[id] = { ...j, state: "cold", flux: false };
      return "焊盘上原来有锡，要重新加热把新线头熔进去";
    }
    return null;
  },

  removeWire(wid) {
    get().commit();
    const w = get().wires.find((x) => x.id === wid);
    const wires = get().wires.filter((x) => x.id !== wid);
    const joints = { ...get().joints };
    if (w) for (const p of [w.a, w.b]) if (!wires.some((x) => x.a === p || x.b === p) && joints[p]?.state === "none") delete joints[p];
    set({ wires, joints });
  },

  stripWire(wid) {
    const w = get().wires.find((x) => x.id === wid);
    if (!w) return;
    const g = get().stripGauge;
    if (g < 24) {
      get().say(`剥线钳 ${g} AWG 的孔比线（24 AWG）大，刀口没切到绝缘皮，剥不下来`, "warn");
      return;
    }
    const ends = ["a", "b"].filter((e) => (w.strip?.[e] || "ok") === "none" && w.loose !== e);
    if (!ends.length) {
      get().say("这根线两头都剥好了");
      return;
    }
    get().commit();
    const res = g === 24 ? "ok" : "nick";
    const strip = { ...w.strip };
    for (const e of ends) strip[e] = res;
    set({ wires: get().wires.map((x) => (x.id === wid ? { ...x, strip } : x)) });
    if (res === "nick") {
      get().penalize("nick");
      get().say("26 AWG 的孔太小：剥掉了皮，但也切断了几股铜丝（能用，不结实）", "warn");
    } else get().say("剥好了：露出约 3 mm 铜丝，股线拧紧");
  },

  applyFlux(id) {
    get().commit();
    const j = get().joints[id] || { state: "none", vol: 0, damage: 0 };
    set({ joints: { ...get().joints, [id]: { ...j, flux: true } } });
    get().say("点了一点助焊剂（松香）。加热时它会冒烟，帮锡铺开");
  },

  // ---------- 焊接 / 拆焊 ----------
  startOp(pin) {
    const { tool, parts, wires, joints } = get();
    const kind = tool === "iron" ? "iron" : tool === "wick" ? "wick" : tool === "pump" ? "pump" : null;
    if (!kind) {
      if (tool === "select") get().inspectPin(pin);
      return;
    }
    const meta = pinMeta(parts, pin);
    if (!meta) return;
    const j = joints[pin] || { state: "none", vol: 0, flux: false, damage: 0 };
    if (j.state === "burnt") {
      get().say("这个焊盘已经烧坏翘起了，焊不上。换一个焊盘（改线 + 改代码）", "error");
      return;
    }
    if (kind !== "iron" && !(j.vol > 0.02)) {
      get().say("这里没有锡，不用拆");
      return;
    }
    get().commit();
    const ends = wireEndsAt(wires, pin);
    sim.op = {
      kind,
      pin,
      meta,
      t: 0,
      T: sim.padT[pin] ?? AMBIENT,
      vol: j.vol || 0,
      flux: !!j.flux,
      fluxLeft: j.flux ? 3.0 : 0,
      preFlux: !!j.flux, // 事先点了助焊剂：润湿更快、更不容易桥连、更耐久热
      dryTime: 0,
      damage: j.damage || 0,
      hotTime: 0,
      fedHot: 0,
      fedCold: 0,
      startState: j.state,
      bridgeTo: j.bridgeTo || null,
      insulated: ends.some(([w, e]) => (w.strip?.[e] || "ok") === "none"),
      hasWire: ends.length > 0,
      warned: {},
      world: localToWorld(parts.find((p) => p.id === splitPinId(pin)[0]), meta.local),
    };
    set({ op: { kind, pin }, lastPin: pin });
  },
  startSolder(pin) {
    return get().startOp(pin);
  },

  tickOp(dt) {
    // 所有焊盘自然冷却
    for (const k of Object.keys(sim.padT)) {
      if (sim.op && sim.op.pin === k) continue;
      sim.padT[k] += (AMBIENT - sim.padT[k]) * (1 - Math.exp(-dt / TAU_COOL));
      if (sim.padT[k] < AMBIENT + 0.5) delete sim.padT[k];
    }
    sim.smoke = [];
    const o = sim.op;
    if (!o) return;
    dt = Math.min(dt, 0.05);
    o.t += dt;
    const { ironTemp, feeding } = get();
    const tip = o.kind === "wick" ? ironTemp - 45 : ironTemp;
    const tau = TAU_HEAT * o.meta.thermal * (o.kind === "wick" ? 1.6 : 1);
    o.T += (tip - o.T) * (1 - Math.exp(-dt / tau));
    sim.padT[o.pin] = o.T;
    let smoke = 0;
    if (o.flux && o.T > 170) {
      // 松香在高温下挥发得更快（简化：300 °C 以上每高 100 °C 快一倍）
      o.fluxLeft -= dt * (1 + Math.max(0, o.T - 300) / 100);
      smoke = 1;
      if (o.fluxLeft <= 0) o.flux = false;
    }
    if (o.kind === "iron" && feeding) {
      if (o.T >= MELT) {
        o.vol += FEED_RATE * dt;
        o.fedHot += dt;
        o.flux = true; // 焊锡丝里有松香芯，但量很少：停止送锡后很快就烧完
        o.fluxLeft = Math.max(o.fluxLeft, 0.8);
      } else {
        o.fedCold += dt;
        o.vol += FEED_RATE * 0.3 * dt; // 锡只在烙铁头上化开，滴到冷焊盘上成了一坨
        if (!o.warned.cold && o.fedCold > 0.25) {
          o.warned.cold = true;
          get().say(`焊盘才 ${Math.round(o.T)} °C，还没到 ${MELT} °C 就送锡了：锡挂不住`, "warn");
        }
      }
    }
    if (o.T >= WET_T && o.flux && o.vol > 0.1) o.hotTime += dt * (o.preFlux ? 1.6 : 1);
    // 助焊剂烧完还继续加热：锡面氧化、发灰起皱
    if (o.T >= WET_T && !o.flux && o.vol > 0.1) {
      o.dryTime += dt;
      if (o.dryTime > 0.6 && !o.warned.dry) {
        o.warned.dry = true;
        get().say("助焊剂烧完了，锡面开始氧化发灰：抬起烙铁，或者点一下助焊剂再焊", "warn");
      }
    }
    if (o.kind === "wick" && o.T >= MELT) {
      o.vol = Math.max(0, o.vol - 1.1 * dt);
      smoke = Math.max(smoke, 0.6);
    }
    if (o.insulated && o.T > 120) {
      smoke = 2;
      if (!o.warned.ins) {
        o.warned.ins = true;
        get().say("绝缘皮被烫化了，冒黑烟：线头没剥皮，锡挂不上", "error");
      }
    }
    if (o.T > DAMAGE_T) o.damage += ((o.T - DAMAGE_T) / 60) * dt;
    if (o.damage > 3 && !o.warned.dmg) {
      o.warned.dmg = true;
      get().say("焊盘开始发黑了：加热太久，快抬起烙铁", "warn");
    }
    if (o.damage >= BURN_AT && o.meta.kind === "tht") {
      o.burnt = true;
      get().endOp();
      return;
    }
    if (smoke) sim.smoke.push({ p: o.world, rate: smoke });
  },

  endOp() {
    const o = sim.op;
    if (!o) return;
    sim.op = null;
    const { parts, wires } = get();
    const joints = { ...get().joints };
    const prev = joints[o.pin] || { state: "none", vol: 0, damage: 0 };
    const j = { ...prev, damage: o.damage, flux: false };
    const name = pinDisplayName(parts, o.pin);
    let wiresOut = wires;
    const finish = () => set({ op: null, joints, wires: wiresOut });
    const clearBridge = () => {
      if (j.bridgeTo) {
        const nb = joints[j.bridgeTo];
        if (nb?.bridgeTo === o.pin) joints[j.bridgeTo] = { ...nb, bridgeTo: null, state: nb.vol > 0.3 ? "good" : "none" };
        j.bridgeTo = null;
      }
    };
    const release = () => {
      // 锡吸干净以后，线头可以拔出来
      const ends = wireEndsAt(wiresOut, o.pin);
      if (ends.length) {
        const ids = new Set(ends.map(([w]) => w.id));
        wiresOut = wiresOut.map((w) => (ids.has(w.id) ? { ...w, loose: w.a === o.pin ? "a" : "b" } : w));
        return true;
      }
      return false;
    };

    if (o.burnt) {
      j.state = "burnt";
      clearBridge();
      joints[o.pin] = j;
      finish();
      get().penalize("burnt");
      get().say(`${name} 的焊盘烧坏翘起了：在 ${Math.round(o.T)} °C 下停留太久`, "error");
      return;
    }
    if (o.t < 0.15) {
      set({ op: null });
      get().say("烙铁碰一下就走了：要按住不放，先加热焊盘", "warn");
      return;
    }
    if (o.kind === "pump") {
      if (o.T >= MELT) {
        j.vol = 0;
        j.state = "none";
        clearBridge();
        joints[o.pin] = j;
        const freed = release();
        finish();
        get().say(freed ? "吸锡器“啪”一下把锡吸走了，线头松开了" : "吸锡器把锡吸走了");
      } else {
        finish();
        get().say(`锡还没化（${Math.round(o.T)} °C）就按了吸锡器，什么也没吸走`, "warn");
      }
      return;
    }
    if (o.kind === "wick") {
      j.vol = o.vol;
      if (j.vol <= 0.05) {
        j.vol = 0;
        j.state = "none";
        clearBridge();
        joints[o.pin] = j;
        const freed = release();
        finish();
        get().say(freed ? "吸锡带把锡吸干净了，线头松开了，可以用连线工具把它接到别处" : "吸锡带把锡吸干净了");
      } else {
        if (j.bridgeTo && j.vol < 1.2) {
          clearBridge();
          j.state = j.vol >= GOOD_VOL[0] ? "good" : "cold";
          get().say("桥连吸开了");
        }
        joints[o.pin] = j;
        finish();
        if (j.state !== "good") get().say(`吸掉了一部分锡（剩 ${Math.round(j.vol * 100)}%）`);
      }
      return;
    }
    // 烙铁
    j.vol = o.vol;
    const nbs = neighborPins(parts, o.pin);
    if (j.vol < 0.12) {
      joints[o.pin] = { ...j, state: prev.state === "none" ? "none" : prev.state, vol: j.vol };
      finish();
      if (prev.state === "none")
        get().say("没送锡：烙铁压着焊盘时，按住空格（或“送锡”按钮）把焊锡丝送到焊盘和烙铁头之间", "warn");
      return;
    }
    if (o.insulated) {
      j.state = "cold";
    } else if (j.vol > GOOD_VOL[1] * (o.preFlux ? 1.3 : 1) && nbs.length) {
      clearBridge();
      const nb = nbs[0];
      j.state = "bridge";
      j.bridgeTo = nb;
      const nj = joints[nb] || { state: "none", vol: 0, damage: 0 };
      joints[nb] = { ...nj, state: "bridge", bridgeTo: o.pin, vol: Math.max(nj.vol || 0, 0.5) };
      get().penalize("bridge");
    } else {
      clearBridge();
      const coldOk = o.preFlux ? 0.6 : 0.35; // 有助焊剂时，少量“冷送锡”也能被重新润湿
      const wet = o.hotTime >= 0.35 && o.dryTime < 1.0 && o.fedCold <= coldOk * (o.fedHot + o.fedCold + 1e-6);
      j.state = wet && j.vol >= GOOD_VOL[0] ? "good" : "cold";
      o.oxidized = o.dryTime >= 1.0;
    }
    joints[o.pin] = j;
    finish();
    const T = Math.round(o.T);
    if (j.state === "good")
      get().say(
        j.vol > 1.3 && !nbs.length ? `焊好了，不过锡有点多（${name}）` : `焊好了：焊点光亮、呈小山形（${name}，焊盘 ${T} °C）`,
        "ok",
      );
    else if (j.state === "bridge") get().say(`锡太多，${name} 和旁边的焊盘粘在一起了（桥连）。用吸锡带吸掉多余的锡`, "error");
    else if (o.insulated) get().say("虚焊：线头没剥皮，锡只裹住了绝缘皮", "error");
    else if (o.oxidized)
      get().say(`虚焊：助焊剂烧完后又加热了 ${o.dryTime.toFixed(1)} 秒，锡面氧化发灰（${name}）。点一下助焊剂再重焊`, "error");
    else if (o.fedHot + o.fedCold === 0 && !o.hotTime)
      get().say("没有助焊剂，重熔后锡面氧化发灰：先用助焊剂笔点一下，或者再送一点锡（锡丝里有松香）", "error");
    else if (j.vol < GOOD_VOL[0]) get().say(`锡太少，焊点没盖住焊盘：虚焊（${name}）`, "error");
    else get().say(`虚焊：焊盘温度不够或时间太短，锡没有铺开（${name}，最高 ${T} °C）`, "error");
  },
  endSolder() {
    return get().endOp();
  },

  // ---------- 螺丝 ----------
  startScrew(servoId, idx) {
    if (get().tool !== "screw") return;
    const cur = get().screws[servoId]?.[idx] ?? 0;
    if (cur >= 1) {
      get().say("这颗螺丝已经拧紧了");
      return;
    }
    get().commit();
    sim.screwOp = { servoId, idx, p: cur };
    set({ screwOp: { servoId, idx } });
  },
  tickScrew(dt) {
    const o = sim.screwOp;
    if (!o) return;
    o.p = Math.min(1, o.p + dt / 1.4);
    if (o.p >= 1) get().endScrew();
  },
  endScrew() {
    const o = sim.screwOp;
    if (!o) return;
    sim.screwOp = null;
    const arr = [...(get().screws[o.servoId] || [0, 0])];
    arr[o.idx] = o.p;
    set({ screws: { ...get().screws, [o.servoId]: arr }, screwOp: null });
    const both = arr.every((v) => v >= 1);
    if (o.p >= 1) get().say(both ? "两颗 M2 螺丝都拧紧了，舵机固定好了" : "拧紧了一颗，还有一颗", "ok");
    else get().say(`螺丝拧了 ${Math.round(o.p * 100)}%，还没拧紧：按住不放`, "warn");
  },

  // ---------- USB ----------
  toggleUsb() {
    if (!get().parts.some((p) => p.type === "esp32")) {
      get().say("先把 Feather 放到底板上", "warn");
      return;
    }
    get().commit();
    const usb = !get().usb;
    set({ usb });
    if (!usb && ["running", "flashing"].includes(get().fw.status)) get().powerFail("USB‑C 拔掉了，开发板断电，程序停止");
    get().say(usb ? "USB‑C 线插上了：开发板通电，3V 脚有 3.3 V" : "USB‑C 线拔掉了");
  },

  // ---------- 检查 / 万用表 ----------
  inspectPin(id) {
    const { parts, joints, wires } = get();
    const j = joints[id];
    const st = jointState(joints, id);
    const ends = wireEndsAt(wires, id);
    const desc = {
      none: ends.length ? "线头插着，但还没上锡" : "空焊盘",
      good: "焊点光亮、呈小山形，锡沿着焊盘和线头铺开（润湿良好）",
      cold: "表面发灰、有颗粒，边缘没有贴住焊盘，像一颗球蹲在上面——很可能是虚焊",
      bridge: "锡太多，和旁边的焊盘连成了一片（桥连）",
      burnt: "焊盘发黑、铜箔翘起，已经烧坏",
    }[st];
    const others = ends.map(([w, e]) => pinDisplayName(parts, w[e === "a" ? "b" : "a"]));
    const text = `${pinDisplayName(parts, id)}：${desc}${others.length ? `。导线通到 ${others.join("、")}` : ""}${j?.damage > 2.5 && st !== "burnt" ? "。周围有点发黄，被烫过" : ""}`;
    set({ inspect: { pin: id, text } });
    if (get().mode === "repair") {
      if (st === "cold" && id === "servo1.VCC") get().discover("cold", "目视检查", "舵机 VCC 的对焊点表面发灰、颗粒状：虚焊");
      const sigEnd = id === "servo1.SIG" || ends.some(([w, e]) => w[e === "a" ? "b" : "a"] === "servo1.SIG");
      if (sigEnd) {
        const sigNet = get().wires.filter((w) => !w.loose && (w.a === "servo1.SIG" || w.b === "servo1.SIG")).map((w) => (w.a === "servo1.SIG" ? w.b : w.a));
        const gp = sigNet.map((p) => pinMeta(parts, p)?.gpio).filter((g) => g != null);
        const fwPin = attachGpioFromCode(get().code);
        if (gp.length && fwPin != null && !gp.includes(fwPin))
          get().discover("swap", "目视检查 + 读代码", `信号线接在 GPIO${gp[0]}，但代码里是 attach(${fwPin})`);
      }
    }
  },

  placeProbe(id) {
    const m = { ...get().meter };
    if (m.mode === "off") {
      get().say("万用表还在 OFF 档：先转到通断档或直流电压档", "warn");
      return;
    }
    if (m.next === "red") {
      m.red = id;
      m.next = "black";
    } else {
      m.black = id;
      m.next = "red";
    }
    set({ meter: m });
    get().remeasure(true);
  },
  remeasure(log) {
    const { meter, parts, usb } = get();
    if (!meter.red || !meter.black || !sim.analysis) {
      set({ meter: { ...get().meter, reading: null } });
      return;
    }
    const r = measure({ parts, analysis: sim.analysis, usb, pinCmd: sim.pinCmd, digital: sim.digital }, meter.red, meter.black, meter.mode);
    set({ meter: { ...get().meter, reading: r } });
    if (log) get().logMeasure(meter.red, meter.black, r);
  },
  logMeasure(red, black, r) {
    if (r.kind === "none") return;
    const { parts, wires, joints, mode } = get();
    const line = `${r.kind === "cont" ? "通断" : "电压"} 红 ${pinDisplayName(parts, red)} / 黑 ${pinDisplayName(parts, black)} → ${
      r.floating ? "乱跳" : r.text + " " + r.unit
    }`;
    if (mode !== "repair") return;
    set({ repair: { ...get().repair, log: [...get().repair.log, line].slice(-30) } });
    const pair = new Set([red, black]);
    const has = (x) => pair.has(x);
    const open = (r.kind === "cont" && !r.beep) || r.floating;
    const wiredBetween = wires.some((w) => !w.loose && pair.has(w.a) && pair.has(w.b));
    // 虚焊：一根导线两头之间不通
    if (open && wiredBetween && [...pair].some((p) => jointState(joints, p) === "cold"))
      get().discover("cold", "万用表", "导线两头之间不通：有一个焊点是虚焊");
    if (open && has("servo1.VCC") && (has("battery.+") || (has("battery.-") && r.kind === "dcv")))
      get().discover("cold", "万用表", "舵机 VCC 量不到电池电压：VCC 这一路断了");
    // 信号脚接错
    const fwPin = attachGpioFromCode(get().code);
    if (has("servo1.SIG") && fwPin != null) {
      const other = [...pair].find((p) => p !== "servo1.SIG");
      const om = pinMeta(parts, other);
      if (om?.gpio != null) {
        if (r.kind === "cont" && r.beep && om.gpio !== fwPin)
          get().discover("swap", "万用表", `舵机信号线通到 GPIO${om.gpio}，但代码里是 attach(${fwPin})`);
        if (r.kind === "cont" && !r.beep && om.gpio === fwPin)
          get().discover("swap", "万用表", `舵机信号线和代码用的 GPIO${fwPin} 之间不通`);
      }
    }
    // 缺共地
    const batSide = ["battery.-", "servo1.GND"];
    const espGnd = "esp32.GND";
    if (open && has(espGnd) && batSide.some(has)) get().discover("ground", "万用表", "电池盒 − 和 Feather GND 之间不通：缺共地");
    if (r.floating) {
      const metas = [...pair].map((p) => pinMeta(parts, p)?.role);
      if (metas.some((x) => ["bat+", "bat-", "servo-gnd", "servo-vcc"].includes(x)) && metas.some((x) => ["gnd", "3v3", "5v", "gpio"].includes(x)))
        get().discover("ground", "万用表", "电池这边和开发板那边之间量电压读数乱跳：两边没有共地");
    }
  },

  discover(key, how, text) {
    const rp = get().repair;
    if (rp.found[key]) return;
    set({ repair: { ...rp, found: { ...rp.found, [key]: true }, foundHow: { ...rp.foundHow, [key]: { how, text } } } });
    get().say(`发现故障：${text}`, "ok");
  },
  penalize(k) {
    const rp = get().repair;
    set({ repair: { ...rp, penalties: { ...rp.penalties, [k]: (rp.penalties[k] || 0) + 1 } } });
  },
  noteFixed(key) {
    const rp = get().repair;
    if (rp.fixedOrder[key]) return;
    const blind = !rp.found[key];
    set({ repair: { ...rp, fixedOrder: { ...rp.fixedOrder, [key]: Date.now() }, penalties: { ...rp.penalties, blind: rp.penalties.blind + (blind ? 1 : 0) } } });
  },
  finishRepair(score) {
    const rp = get().repair;
    if (rp.done) return;
    set({ repair: { ...rp, done: { at: Date.now(), ...score } } });
  },

  // ---------- 模式 ----------
  loadRepair() {
    stopFirmware();
    resetSim();
    sim.padT = {};
    const g = (vol = 0.9) => ({ state: "good", vol, flux: false, damage: 0 });
    set({
      mode: "repair",
      parts: [
        { id: "esp32", type: "esp32", ...DEFAULT_SLOTS.esp32[0], rot: 0 },
        { id: "servo1", type: "servo", ...DEFAULT_SLOTS.servo[0], rot: 0 },
        { id: "battery", type: "battery", ...DEFAULT_SLOTS.battery[0], rot: 0 },
      ],
      wires: [
        { id: "r1", a: "servo1.SIG", b: "esp32.6", color: "#e88a1a", strip: { a: "ok", b: "ok" }, loose: null },
        { id: "r2", a: "servo1.VCC", b: "battery.+", color: "#c8322a", strip: { a: "ok", b: "ok" }, loose: null },
        { id: "r3", a: "servo1.GND", b: "battery.-", color: "#2a2a2a", strip: { a: "ok", b: "ok" }, loose: null },
      ],
      joints: {
        "servo1.SIG": g(),
        "esp32.6": g(),
        "servo1.VCC": { state: "cold", vol: 0.75, flux: false, damage: 0 },
        "battery.+": g(),
        "servo1.GND": g(),
        "battery.-": g(),
      },
      screws: { servo1: [0, 0] },
      usb: true,
      tool: "select",
      code: DEFAULT_CODE,
      fw: emptyFw(),
      past: [],
      future: [],
      repair: emptyRepair(),
      meter: { mode: "cont", red: null, black: null, next: "red", reading: null },
      pendingPin: null,
      pendingMove: null,
      inspect: null,
      movedOnce: false,
      guided: false,
      selectedPart: null,
    });
    get().say("维修任务：这个机器人不动。先别急着动手，用万用表和放大镜找出故障", "info");
  },
  loadBuild() {
    get().resetAll();
    set({ mode: "build", guided: true });
  },

  // ---------- 固件 ----------
  setCode(code) {
    set({ code });
  },

  powerFail(reason) {
    stopFirmware();
    clearTimeout(flashTimer);
    sim.pinCmd = {};
    set({ fw: { ...get().fw, status: "stopped", flash: null } });
    get().pushSerial(`[模拟] ${reason}`, true, "sim");
  },

  pushSerial(text, nl, kind = "fw") {
    set((st) => {
      const serial = st.fw.serial.slice(-300);
      const last = serial[serial.length - 1];
      if (last && last.open && kind === "fw") serial[serial.length - 1] = { ...last, text: last.text + text, open: !nl };
      else serial.push({ text, kind, open: !nl && kind === "fw" });
      return { fw: { ...st.fw, serial } };
    });
  },

  flash() {
    const { parts, code, usb } = get();
    if (!parts.some((p) => p.type === "esp32")) {
      get().say("先把 Feather ESP32‑S3 放到底板上", "warn");
      return;
    }
    if (!usb) {
      get().say("开发板没连电脑：先插上 USB‑C 线（工具栏“插 USB‑C”）", "warn");
      return;
    }
    stopFirmware();
    clearTimeout(flashTimer);
    resetSim();
    set({ fw: { ...emptyFw(), status: "flashing", flash: { stage: "编译中", pct: 0 } }, movedOnce: false });
    const push = (t) => get().pushSerial(t, true, "sim");
    push("[模拟] 编译 sketch（简化：只做语法检查）…");
    try {
      parse(code);
    } catch (err) {
      set({ fw: { ...get().fw, status: "error", flash: null, error: `编译错误${err.line ? `（第 ${err.line} 行）` : ""}：${err.message}`, errorLine: err.line } });
      return;
    }
    const a = sim.analysis;
    if (a?.railShort) {
      push("[模拟] 连接中……失败：开发板没有响应。3V 和 GND 被短路，稳压器保护，芯片没电");
      set({ fw: { ...get().fw, status: "error", flash: null, error: "烧录失败：开发板没上电（电源短路）" } });
      return;
    }
    if (a && a.netOf("esp32.EN").some((p) => p.role === "gnd")) {
      push("[模拟] 连接中……失败：EN 接地，3.3 V 稳压器被关掉了");
      set({ fw: { ...get().fw, status: "error", flash: null, error: "烧录失败：EN 被接地，开发板断电" } });
      return;
    }
    const steps = [
      [350, "连接中", 0, "[模拟] esptool：连接中……"],
      [700, "连接中", 0, "[模拟] 芯片：ESP32-S3（通过原生 USB）"],
      [1000, "写入", 5, "[模拟] 写入固件……"],
    ];
    let t = 0;
    const run = (i) => {
      if (i < steps.length) {
        const [at, stage, pct, line] = steps[i];
        flashTimer = setTimeout(() => {
          push(line);
          set({ fw: { ...get().fw, flash: { stage, pct } } });
          t = at;
          run(i + 1);
        }, at - t);
        return;
      }
      let pct = 5;
      const tick = () => {
        pct = Math.min(100, pct + 7 + Math.random() * 6);
        set({ fw: { ...get().fw, flash: { stage: "写入", pct } } });
        if (pct < 100) flashTimer = setTimeout(tick, 90);
        else {
          push("[模拟] 写入 100%，校验通过");
          push("[模拟] 硬复位（RTS 引脚）……");
          set({ fw: { ...get().fw, flash: { stage: "复位", pct: 100 } } });
          flashTimer = setTimeout(() => get().boot(), 450);
        }
      };
      tick();
    };
    run(0);
  },

  boot() {
    const { code } = get();
    sim.ledOn = true;
    setTimeout(() => (sim.ledOn = false), 250);
    const noted = new Set();
    const note = (key, text) => {
      if (noted.has(key)) return;
      noted.add(key);
      get().pushSerial(text, true, "sim");
    };
    startFirmware(code, (ev) => {
      const st = get();
      switch (ev.type) {
        case "compiled":
          set({ fw: { ...st.fw, status: "running", flash: null } });
          get().pushSerial("[模拟] 启动，开始运行（代码由页面里的解释器执行）", true, "sim");
          break;
        case "serial":
          get().pushSerial(ev.text, ev.nl);
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
          const driven = servos.filter(([, s]) => s.ok && s.gpio === ev.pin);
          if (!driven.length) {
            const wiredTo = servos.find(([id]) => a.topoNetOf(`${id}.SIG`).some((p) => p.gpio === ev.pin));
            if (wiredTo) note(`p${ev.pin}-${wiredTo[1].reasons[0]}`, `[仿真] ${wiredTo[1].label} 没有动：${wiredTo[1].reasons[0]}`);
            else note(`p${ev.pin}-none`, `[仿真] GPIO${ev.pin} 上没有接好的舵机，所以什么都不会动`);
          } else {
            const mounted = mountedMap(get().parts, get().screws);
            for (const [id, s] of driven)
              if (!mounted[id]) note(`unmounted-${id}`, `[仿真] ${s.label} 在转，但没用螺丝固定：转的是舵机自己，触手几乎不动`);
          }
          break;
        }
        case "pin": {
          if (ev.value != null) {
            sim.digital[ev.pin] = ev.value;
            if (ev.pin === 13) sim.ledOn = !!ev.value;
          }
          set({
            fw: {
              ...st.fw,
              pins: {
                ...st.fw.pins,
                [ev.pin]: {
                  mode: ev.mode ?? st.fw.pins[ev.pin]?.mode ?? "OUTPUT",
                  value: ev.value != null ? (ev.value ? "HIGH" : "LOW") : (st.fw.pins[ev.pin]?.value ?? "-"),
                },
              },
            },
          });
          break;
        }
        case "warn":
          get().pushSerial(`[仿真] ${ev.msg}`, true, "sim");
          break;
        case "error":
          stopFirmware();
          set({
            fw: {
              ...get().fw,
              status: "error",
              flash: null,
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
    clearTimeout(flashTimer);
    set({ fw: { ...get().fw, status: "stopped", flash: null } });
  },

  markMoved() {
    if (!get().movedOnce) set({ movedOnce: true });
  },

  resetAll() {
    stopFirmware();
    clearTimeout(flashTimer);
    resetSim();
    sim.padT = {};
    sim.op = null;
    set({
      parts: [],
      wires: [],
      joints: {},
      screws: {},
      usb: false,
      pendingPin: null,
      pendingMove: null,
      selectedPart: null,
      op: null,
      inspect: null,
      movedOnce: false,
      past: [],
      future: [],
      meter: { mode: "cont", red: null, black: null, next: "red", reading: null },
      fw: emptyFw(),
      repair: emptyRepair(),
    });
  },
}));

let flashTimer = null;
