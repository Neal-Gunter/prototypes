import { useEffect, useRef, useState } from "react";
import { MELT, WET_T, GOOD_VOL, useBench } from "../store";
import { partDisplayName } from "../parts";
import { sim } from "../sim";
import { sceneApi } from "../scene/api";

export const TOOLS = [
  { id: "select", label: "手 / 放大镜", key: "1", tip: "拖动零件；点焊盘看细节" },
  { id: "strip", label: "剥线钳", key: "2", tip: "选好孔径，点导线剥皮" },
  { id: "wire", label: "导线", key: "3", tip: "点两个焊盘剪一根线" },
  { id: "flux", label: "助焊剂", key: "4", tip: "点焊盘点一下松香" },
  { id: "iron", label: "烙铁", key: "5", tip: "按住焊盘加热，按空格送锡" },
  { id: "wick", label: "吸锡带", key: "6", tip: "按住焊点，锡被吸进铜网" },
  { id: "pump", label: "吸锡器", key: "7", tip: "按住加热，锡化了松手吸走" },
  { id: "meter", label: "万用表", key: "8", tip: "先点红表笔位置，再点黑表笔" },
  { id: "screw", label: "螺丝刀", key: "9", tip: "按住舵机耳朵上的螺丝" },
];

const CAMS = [
  ["overview", "全景"],
  ["top", "俯视"],
  ["board", "开发板特写"],
  ["servo", "舵机特写"],
  ["joint", "对准焊点"],
  ["meter", "万用表"],
];

const btn = (on) => `min-h-8 border px-2 text-xs -ml-px first:ml-0 ${on ? "border-ink bg-ink text-paper-2" : "border-line bg-paper hover:border-ink"}`;

export function Toolbar() {
  const tool = useBench((s) => s.tool);
  const selected = useBench((s) => s.parts.find((p) => p.id === s.selectedPart));
  const ironTemp = useBench((s) => s.ironTemp);
  const gauge = useBench((s) => s.stripGauge);
  const meterMode = useBench((s) => s.meter.mode);
  const usb = useBench((s) => s.usb);
  const canUndo = useBench((s) => s.past.length > 0);
  const canRedo = useBench((s) => s.future.length > 0);
  const feeding = useBench((s) => s.feeding);
  const st = useBench.getState;
  return (
    <div className="flex flex-col gap-1.5 border-b border-line bg-paper-2 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="工具" className="flex flex-wrap">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={tool === t.id}
              data-toolbar={t.id}
              title={`${t.tip}（快捷键 ${t.key}）`}
              onClick={() => st().setTool(t.id)}
              className={`${btn(tool === t.id)} min-h-9 px-2.5 text-sm`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex">
          <button className={btn(false)} disabled={!canUndo} onClick={() => st().undo()} title="撤销（Ctrl+Z）" data-undo>
            ↶ 撤销
          </button>
          <button className={btn(false)} disabled={!canRedo} onClick={() => st().redo()} title="重做（Ctrl+Y）" data-redo>
            ↷ 重做
          </button>
        </div>
        <button
          data-usb
          onClick={() => st().toggleUsb()}
          className={`min-h-8 border px-2 text-xs ${usb ? "border-mask bg-mask text-paper-2" : "border-line bg-paper hover:border-ink"}`}
        >
          {usb ? "USB‑C 已插（点击拔掉）" : "插 USB‑C"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        {tool === "iron" || tool === "wick" || tool === "pump" ? (
          <label className="flex items-center gap-2">
            烙铁温度
            <input
              type="range"
              min={200}
              max={450}
              step={10}
              value={ironTemp}
              data-iron-temp
              onChange={(e) => st().setIronTemp(Number(e.target.value))}
              className="w-32 accent-[#b5522b]"
            />
            <span className="w-12 tabular-nums">{ironTemp} °C</span>
          </label>
        ) : null}
        {tool === "iron" && (
          <button
            data-feed
            className={`min-h-8 select-none border px-2 ${feeding ? "border-copper bg-copper text-paper-2" : "border-line bg-paper hover:border-ink"}`}
            onPointerDown={(e) => {
              e.preventDefault();
              st().setFeeding(true);
            }}
            onPointerUp={() => st().setFeeding(false)}
            onPointerLeave={() => st().setFeeding(false)}
          >
            按住送锡（空格）
          </button>
        )}
        {tool === "strip" && (
          <span className="flex items-center gap-1">
            剥线钳孔径
            {[22, 24, 26].map((g) => (
              <button key={g} className={btn(gauge === g)} onClick={() => st().setStripGauge(g)} data-gauge={g}>
                {g} AWG
              </button>
            ))}
            <span className="ml-1 text-ink-soft">导线是 24 AWG</span>
          </span>
        )}
        {tool === "meter" && (
          <span className="flex items-center gap-1">
            档位
            {[
              ["off", "OFF"],
              ["cont", "通断 •))"],
              ["dcv", "直流电压 V⎓"],
            ].map(([m, l]) => (
              <button key={m} className={btn(meterMode === m)} onClick={() => st().setMeterMode(m)} data-meter-mode={m}>
                {l}
              </button>
            ))}
            <button className={btn(false)} onClick={() => st().clearProbes()} data-probes-clear>
              表笔放回
            </button>
          </span>
        )}
        {selected && tool === "select" && (
          <span className="flex items-center gap-1">
            <span className="text-ink-soft">已选：{partDisplayName(selected)}</span>
            <button className={btn(false)} onClick={() => st().rotatePart(selected.id)}>
              旋转 90°
            </button>
            <button className={`${btn(false)} text-mark`} onClick={() => st().removePart(selected.id)}>
              移除
            </button>
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          <span className="text-ink-soft">视角</span>
          {CAMS.map(([k, l]) => (
            <button key={k} className={btn(false)} data-cam={k} onClick={() => sceneApi.preset?.(k)}>
              {l}
            </button>
          ))}
        </span>
      </div>
      <p className="text-xs text-ink-soft" data-testid="tool-hint">
        {TOOLS.find((t) => t.id === tool)?.tip}。拖空白处旋转视角，右键拖动平移，滚轮缩放。
      </p>
    </div>
  );
}

// 焊接时的读数：焊盘温度、锡量、助焊剂
export function SolderHud() {
  const op = useBench((s) => s.op);
  const [, force] = useState(0);
  useEffect(() => {
    if (!op) return;
    const id = setInterval(() => force((n) => n + 1), 60);
    return () => clearInterval(id);
  }, [op]);
  const o = sim.op;
  if (!op || !o) return null;
  const T = Math.round(o.T);
  const pct = Math.max(0, Math.min(100, ((o.T - 25) / (450 - 25)) * 100));
  const melt = ((MELT - 25) / 425) * 100;
  const wet = ((WET_T - 25) / 425) * 100;
  const vol = Math.min(2, o.vol);
  const phase =
    o.kind === "wick"
      ? o.T >= MELT
        ? "锡在往铜网里吸…"
        : "隔着吸锡带加热…"
      : o.kind === "pump"
        ? o.T >= MELT
          ? "锡化了：松开鼠标，吸锡器“啪”地吸走"
          : "加热焊点，等锡化开…"
        : o.T < MELT
          ? "加热焊盘…（还没到熔点，先别送锡）"
          : o.T < WET_T
            ? "快到了…"
            : o.vol < GOOD_VOL[0]
              ? "温度够了：按住空格送锡"
              : o.vol > GOOD_VOL[1]
                ? "锡太多了！松开空格"
                : "锡铺开了，再停半秒后抬起烙铁";
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 w-80 -translate-x-1/2 border border-ink bg-paper-2/95 p-3 text-xs shadow" role="status" data-testid="solder-hud">
      <div className="flex justify-between text-sm">
        <span>{phase}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="w-14">焊盘</span>
        <div className="relative h-2.5 flex-1 bg-line">
          <div className="h-2.5" style={{ width: `${pct}%`, background: o.T > 330 ? "#b3261e" : "#c7733c" }} />
          <div className="absolute top-[-3px] h-4 w-px bg-ink" style={{ left: `${melt}%` }} title="熔点" />
          <div className="absolute top-[-3px] h-4 w-px bg-mask" style={{ left: `${wet}%` }} />
        </div>
        <span className="w-14 text-right tabular-nums" data-pad-temp>
          {T} °C
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="w-14">锡量</span>
        <div className="relative h-2.5 flex-1 bg-line">
          <div className="h-2.5 bg-[#9aa0a6]" style={{ width: `${(vol / 2) * 100}%` }} />
          <div className="absolute top-0 h-2.5 border-x border-mask bg-mask/15" style={{ left: `${(GOOD_VOL[0] / 2) * 100}%`, width: `${((GOOD_VOL[1] - GOOD_VOL[0]) / 2) * 100}%` }} />
        </div>
        <span className="w-14 text-right tabular-nums">{Math.round(o.vol * 100)}%</span>
      </div>
      <div className="mt-1.5 flex justify-between text-ink-soft">
        <span>助焊剂：{o.flux ? `有（还能撑 ${Math.max(0, o.fluxLeft).toFixed(1)} 秒${o.preFlux ? "，事先点过" : "，锡丝松香"}）` : o.dryTime > 0 ? `烧完了，已干烧 ${o.dryTime.toFixed(1)} 秒` : "没有"}</span>
        <span>熔点 {MELT} °C（SAC305）</span>
      </div>
    </div>
  );
}

// 万用表读数（大字）+ 通断蜂鸣
let actx = null;
function beepOn(on) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (on && !beepOn.osc) {
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.frequency.value = 2700;
      g.gain.value = 0.04;
      o.connect(g).connect(actx.destination);
      o.start();
      beepOn.osc = o;
    } else if (!on && beepOn.osc) {
      beepOn.osc.stop();
      beepOn.osc = null;
    }
  } catch {
    /* 没有声音也没关系 */
  }
}

export function MeterHud() {
  const tool = useBench((s) => s.tool);
  const m = useBench((s) => s.meter);
  const parts = useBench((s) => s.parts);
  const beep = m.mode === "cont" && m.reading?.beep;
  useEffect(() => {
    beepOn(!!beep);
    if (beep) {
      const t = setTimeout(() => beepOn(false), 350);
      return () => clearTimeout(t);
    }
  }, [beep, m.red, m.black]);
  if (tool !== "meter" && !m.red && !m.black) return null;
  const name = (id) => (id ? id.replace(".", " · ") : "—");
  const r = m.reading;
  const text = m.mode === "off" ? "OFF" : !r || r.kind === "none" ? (m.mode === "cont" ? "OL" : "0.00") : r.floating ? "乱跳" : `${r.text} ${r.unit}`;
  void parts;
  return (
    <div className="absolute right-3 top-3 w-56 border border-ink bg-[#262a2e]/95 p-2.5 text-xs text-paper-2 shadow" data-testid="meter-hud">
      <div className="flex items-baseline justify-between">
        <span className="opacity-75">{m.mode === "cont" ? "通断档" : m.mode === "dcv" ? "直流电压档" : "关"}</span>
        {beep && <span className="text-[#ffd75a]">•)) 嘀——</span>}
      </div>
      <div className="mt-1 bg-[#a9b78f] px-2 py-1 text-right font-mono text-2xl text-[#1d2318]" data-meter-reading>
        {text}
      </div>
      <div className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="text-[#ff7b70]">红</span>
        <span className={m.next === "red" && tool === "meter" ? "underline" : ""}>{name(m.red)}</span>
        <span>黑</span>
        <span className={m.next === "black" && tool === "meter" ? "underline" : ""}>{name(m.black)}</span>
      </div>
      {r?.note && <p className="mt-1 leading-4 text-[#ffd9a0]">{r.note}</p>}
      <p className="mt-1 leading-4 opacity-60">简化万用表：只有通断和直流电压，读数按理想电源算</p>
    </div>
  );
}

export function InspectCard() {
  const inspect = useBench((s) => s.inspect);
  if (!inspect) return null;
  return (
    <div className="absolute bottom-14 left-3 max-w-sm border border-ink bg-paper-2/95 p-2.5 text-xs leading-5 shadow" data-testid="inspect">
      <div className="flex items-start gap-2">
        <span className="font-medium">放大镜</span>
        <span className="flex-1">{inspect.text}</span>
        <button className="text-ink-soft" onClick={() => useBench.setState({ inspect: null })} aria-label="关闭">
          ×
        </button>
      </div>
    </div>
  );
}

export function Toast() {
  const toast = useBench((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      if (useBench.getState().toast === toast) useBench.setState({ toast: null });
    }, 3600);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const color = toast.level === "error" ? "bg-mark" : toast.level === "ok" ? "bg-mask" : toast.level === "warn" ? "bg-copper-deep" : "bg-ink";
  return (
    <div role="status" data-testid="toast" className={`pointer-events-none absolute bottom-4 left-1/2 max-w-[80%] -translate-x-1/2 px-4 py-2 text-center text-sm text-paper-2 shadow ${color}`}>
      {toast.msg}
    </div>
  );
}

// 一个“自动送锡”的按住按钮（键盘 / 无障碍路径）：温度够了自动送锡到合适的量
export function useHoldSolder() {
  const timer = useRef(null);
  const st = useBench.getState;
  const start = (pin) => {
    if (st().tool !== "iron") st().setTool("iron");
    st().startOp(pin);
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      const o = sim.op;
      if (!o) return clearInterval(timer.current);
      st().setFeeding(o.T >= WET_T && o.vol < 0.95);
    }, 30);
  };
  const end = () => {
    clearInterval(timer.current);
    st().setFeeding(false);
    st().endOp();
  };
  return { start, end };
}
