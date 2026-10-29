import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { analyzeBench, rejectionForPin, singlePinTaken, tentacleAngles } from "./checks.js";
import { createFirmwareRunner } from "./firmware/runner.js";
import { guidePhase } from "./guide.js";
import {
  endpointLabel,
  firstOpenSlot,
  getPart,
  nearestSlot,
  PARTS,
  samePin,
} from "./model.js";
import { SAMPLE_FIRMWARE } from "./sample.js";

const HEAT_MS = 800;
const COLD_AT = 0.55;

function withLog(state, entry) {
  const log = [...state.log, { id: state.logSeq, ...entry }].slice(-80);
  return { log, logSeq: state.logSeq + 1 };
}

function initialState() {
  return {
    placements: {},
    wires: [],
    wireSeq: 1,
    pendingPin: null,
    tool: "pointer",
    notice: "把零件放到基板上。可以拖，也可以点「放到基板」。",
    dragPreview: null,
    trayDrag: null,
    code: SAMPLE_FIRMWARE,
    log: [],
    logSeq: 1,
    pinWrites: {},
    servoAngles: { "servo-0": 90, "servo-1": 90, "servo-2": 90 },
    running: false,
    guide: true,
    sawMotion: false,
  };
}

function applyFirmwareEvent(state, event) {
  if (event.type === "log") {
    return { ...state, ...withLog(state, { t: event.t, kind: "info", text: event.text }) };
  }
  if (event.type === "done") return { ...state, running: false };
  if (event.type !== "servo") return state;
  const analysis = analyzeBench(state);
  const pinName = `GPIO${event.pin}`;
  const reason = rejectionForPin(analysis, event.pin);
  const servo = analysis.servoList.find((item) => item.electrical && item.signalPin === pinName);
  const text = servo
    ? `${pinName} → ${servo.name} ${event.angle}°，简化模型已接受`
    : `${pinName} 写入 ${event.angle}°，未驱动舵机：${reason}`;
  const servoAngles = { ...state.servoAngles };
  if (servo) servoAngles[servo.id] = event.angle;
  return {
    ...state,
    servoAngles,
    sawMotion: state.sawMotion || Boolean(servo),
    pinWrites: {
      ...state.pinWrites,
      [pinName]: { angle: event.angle, applied: Boolean(servo), detail: text },
    },
    ...withLog(state, { t: event.t, kind: servo ? "ok" : "bad", text }),
  };
}

function heatEndNotice(before, after) {
  if (!before || !after) return null;
  if (before.solder !== "good" && after.solder === "good") return "这个焊点按简化规则记为焊好。";
  if (after.solder === "cold") return "松手太早，这个焊点记为冷焊。按住可以重焊。";
  return null;
}

function reduce(state, action) {
  switch (action.type) {
    case "place": {
      if (!action.partId || !PARTS.some((part) => part.id === action.partId)) return state;
      if (state.placements[action.partId]) {
        return { ...state, trayDrag: null, notice: "这个零件已经在基板上。" };
      }
      const slot = firstOpenSlot(action.partId, state.placements);
      if (!slot) return { ...state, trayDrag: null, notice: "基板上没有空位了。" };
      return {
        ...state,
        trayDrag: null,
        placements: { ...state.placements, [action.partId]: slot.id },
        notice: `${getPart(action.partId).name} 已吸到基板上。`,
      };
    }
    case "unplace": {
      const placements = { ...state.placements };
      delete placements[action.partId];
      return {
        ...state,
        placements,
        dragPreview: state.dragPreview?.partId === action.partId ? null : state.dragPreview,
        pendingPin: state.pendingPin?.partId === action.partId ? null : state.pendingPin,
        wires: state.wires.filter(
          (wire) => wire.from.partId !== action.partId && wire.to.partId !== action.partId,
        ),
        notice: `${getPart(action.partId).name} 已拿回零件盘。连在上面的线也拆了。`,
      };
    }
    case "preview":
      return { ...state, dragPreview: { partId: action.partId, x: action.x, z: action.z } };
    case "preview-clear":
      return state.dragPreview ? { ...state, dragPreview: null } : state;
    case "drop-3d": {
      const slot = nearestSlot(action.x, action.z, state.placements, action.partId);
      if (!slot) {
        return { ...state, dragPreview: null, notice: "没有吸到基板上的位置，零件回到原位。" };
      }
      const moved = slot.id !== state.placements[action.partId];
      return {
        ...state,
        dragPreview: null,
        placements: { ...state.placements, [action.partId]: slot.id },
        notice: moved ? "已吸到基板上的位置。" : state.notice,
      };
    }
    case "tray-drag":
      return { ...state, trayDrag: action.partId };
    case "select-pin": {
      const ref = { partId: action.partId, pinId: action.pinId };
      if (!state.placements[ref.partId]) {
        return { ...state, notice: "先把这个零件放到基板上。" };
      }
      const pending = state.pendingPin;
      if (!pending) {
        return {
          ...state,
          pendingPin: ref,
          notice: `已选 ${endpointLabel(ref)}。再点另一个零件上的引脚。`,
        };
      }
      if (samePin(pending, ref)) return { ...state, pendingPin: null, notice: "已取消选择。" };
      if (pending.partId === ref.partId) {
        return { ...state, pendingPin: ref, notice: "一根线要接到另一个零件。已改选这个引脚。" };
      }
      if (singlePinTaken(state.wires, pending) || singlePinTaken(state.wires, ref)) {
        return {
          ...state,
          pendingPin: null,
          notice: "这个信号脚已经有线了。简化模型里信号脚只接一根，先拆除。",
        };
      }
      const wire = {
        id: `w${state.wireSeq}`,
        from: pending,
        to: ref,
        solder: "open",
        heat: 0,
      };
      return {
        ...state,
        wires: [...state.wires, wire],
        wireSeq: state.wireSeq + 1,
        pendingPin: null,
        notice: `已连线：${endpointLabel(pending)} → ${endpointLabel(ref)}。还没焊接。`,
      };
    }
    case "clear-pin":
      return state.pendingPin ? { ...state, pendingPin: null } : state;
    case "remove-wire":
      return {
        ...state,
        wires: state.wires.filter((wire) => wire.id !== action.wireId),
        notice: "这根线已拆除。",
      };
    case "tool":
      return {
        ...state,
        tool: action.tool,
        notice: action.tool === "iron" ? "烙铁已拿起。按住焊点，直到热量条走满。" : "已放下烙铁。",
      };
    case "heat":
      return {
        ...state,
        wires: state.wires.map((wire) =>
          wire.id === action.wireId && wire.solder !== "good"
            ? { ...wire, heat: action.amount, solder: "heating" }
            : wire,
        ),
      };
    case "solder":
      return {
        ...state,
        wires: state.wires.map((wire) =>
          wire.id === action.wireId ? { ...wire, solder: "good", heat: 1 } : wire,
        ),
        notice: "这个焊点按简化规则记为焊好。",
      };
    case "heat-end": {
      let notice = null;
      const wires = state.wires.map((wire) => {
        if (wire.id !== action.wireId) return wire;
        if (wire.solder === "good") return { ...wire, heat: 1 };
        let next = wire;
        if (wire.heat >= 0.98) next = { ...wire, solder: "good", heat: 1 };
        else if (wire.heat >= COLD_AT) next = { ...wire, solder: "cold", heat: wire.heat };
        else next = { ...wire, solder: "open", heat: 0 };
        notice = heatEndNotice(wire, next);
        return next;
      });
      return notice ? { ...state, wires, notice } : { ...state, wires };
    }
    case "notice":
      return { ...state, notice: action.text };
    case "code":
      return { ...state, code: action.code };
    case "restore-code":
      return { ...state, code: SAMPLE_FIRMWARE, notice: "已恢复示例程序。" };
    case "guide":
      return { ...state, guide: action.value };
    case "run-start":
      return {
        ...state,
        running: true,
        pinWrites: {},
        servoAngles: { "servo-0": 90, "servo-1": 90, "servo-2": 90 },
        ...withLog(state, {
          t: 0,
          kind: "info",
          text: "开始运行简化解释器。这不是 ESP32-S3 仿真。",
        }),
      };
    case "run-error":
      return {
        ...state,
        running: false,
        ...withLog(state, { t: 0, kind: "bad", text: action.message }),
        notice: action.message,
      };
    case "firmware-events":
      return action.events.reduce((next, event) => applyFirmwareEvent(next, event), state);
    case "running":
      return { ...state, running: action.value };
    case "stop":
      return {
        ...state,
        running: false,
        ...withLog(state, { t: 0, kind: "info", text: "已停止。" }),
      };
    case "reset-bench":
      return {
        ...initialState(),
        code: state.code,
        guide: state.guide,
        notice: "零件和连线已清空。",
      };
    default:
      return state;
  }
}

export default function useWorkbench() {
  const [state, dispatch] = useReducer(reduce, undefined, initialState);
  const heatRef = useRef(null);
  const playToken = useRef(0);
  const rafRef = useRef(0);
  const runnerRef = useRef(null);
  const aliveRef = useRef(true);
  const busyRef = useRef(false);
  const controlsRef = useRef(null);
  const toolRef = useRef(state.tool);
  const wiresRef = useRef(state.wires);
  const codeRef = useRef(state.code);
  toolRef.current = state.tool;
  wiresRef.current = state.wires;
  codeRef.current = state.code;

  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    const runner = createFirmwareRunner();
    runnerRef.current = runner;
    return () => {
      aliveRef.current = false;
      playToken.current += 1;
      clearTimeout(rafRef.current);
      const heat = heatRef.current;
      if (heat) {
        cancelAnimationFrame(heat.raf);
        window.removeEventListener("pointerup", heat.stop);
        window.removeEventListener("pointercancel", heat.stop);
        heatRef.current = null;
      }
      runner.dispose();
    };
  }, []);

  const analysis = useMemo(() => analyzeBench(state), [state]);
  const tentacles = useMemo(
    () => tentacleAngles(state.servoAngles, analysis),
    [state.servoAngles, analysis],
  );
  const phase = guidePhase({
    partsReady: analysis.partsReady,
    topologyReady: analysis.topologyReady,
    powerReady: analysis.powerReady,
    sawMotion: state.sawMotion,
  });

  function finishHeat(wireId, mode) {
    const current = heatRef.current;
    if (!current || current.wireId !== wireId) return;
    cancelAnimationFrame(current.raf);
    window.removeEventListener("pointerup", current.stop);
    window.removeEventListener("pointercancel", current.stop);
    heatRef.current = null;
    if (mode === "good") dispatch({ type: "solder", wireId });
    else dispatch({ type: "heat-end", wireId });
  }

  function beginHeat(wireId) {
    const wire = wiresRef.current.find((item) => item.id === wireId);
    if (!wire || wire.solder === "good") return;
    if (toolRef.current !== "iron") {
      dispatch({ type: "notice", text: "先点「拿起烙铁」，再按住焊点。" });
      return;
    }
    if (heatRef.current?.wireId === wireId) return;
    if (heatRef.current) finishHeat(heatRef.current.wireId, "release");
    const start = performance.now();
    const stop = () => finishHeat(wireId, "release");
    const tick = () => {
      if (!heatRef.current || heatRef.current.wireId !== wireId) return;
      const amount = Math.min(1, (performance.now() - start) / HEAT_MS);
      dispatch({ type: "heat", wireId, amount });
      if (amount >= 1) {
        finishHeat(wireId, "good");
        return;
      }
      heatRef.current.raf = requestAnimationFrame(tick);
    };
    heatRef.current = { wireId, stop, raf: 0 };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    heatRef.current.raf = requestAnimationFrame(tick);
  }

  function endHeat(wireId) {
    finishHeat(wireId, "release");
  }

  async function runFirmware() {
    if (busyRef.current) return;
    if (!runnerRef.current) {
      dispatch({ type: "run-error", message: "解释器还没准备好。" });
      return;
    }
    busyRef.current = true;
    playToken.current += 1;
    const token = playToken.current;
    clearTimeout(rafRef.current);
    dispatch({ type: "run-start" });
    let result;
    try {
      result = await runnerRef.current.run(codeRef.current);
    } catch (error) {
      if (!aliveRef.current || playToken.current !== token) return;
      busyRef.current = false;
      dispatch({
        type: "run-error",
        message: error instanceof Error ? error.message : "解释失败",
      });
      return;
    }
    if (!aliveRef.current || playToken.current !== token) return;
    const events = result.events || [];
    let cursor = 0;
    const started = performance.now();
    const tick = () => {
      if (playToken.current !== token) return;
      const elapsed = performance.now() - started;
      const batch = [];
      while (cursor < events.length && events[cursor].t <= elapsed) {
        batch.push(events[cursor]);
        cursor += 1;
      }
      if (batch.length) dispatch({ type: "firmware-events", events: batch });
      if (cursor < events.length) rafRef.current = window.setTimeout(tick, 32);
      else {
        busyRef.current = false;
        dispatch({ type: "running", value: false });
      }
    };
    rafRef.current = window.setTimeout(tick, 32);
  }

  function stopFirmware() {
    if (!busyRef.current && !state.running) return;
    busyRef.current = false;
    playToken.current += 1;
    clearTimeout(rafRef.current);
    dispatch({ type: "stop" });
  }

  function resetView() {
    const controls = controlsRef.current;
    if (!controls) return;
    controls.object.position.set(2.35, 3.45, 3.55);
    controls.target.set(0.1, 0.32, -0.15);
    controls.update();
  }

  return {
    ...state,
    analysis,
    tentacles,
    phase,
    reducedMotion,
    controlsRef,
    dispatch,
    beginHeat,
    endHeat,
    runFirmware,
    stopFirmware,
    resetView,
    place(partId) {
      dispatch({ type: "place", partId });
    },
    resetBench() {
      busyRef.current = false;
      playToken.current += 1;
      clearTimeout(rafRef.current);
      if (heatRef.current) finishHeat(heatRef.current.wireId, "release");
      dispatch({ type: "reset-bench" });
    },
  };
}
