import { useEffect } from "react";
import { HEAT_MS, HOLD_MS, useBench } from "../store";
import { partDisplayName } from "../parts";

const TOOLS = [
  { id: "select", label: "选择 / 移动" },
  { id: "wire", label: "连线" },
  { id: "iron", label: "烙铁" },
];

export function Toolbar() {
  const tool = useBench((s) => s.tool);
  const selected = useBench((s) => s.parts.find((p) => p.id === s.selectedPart));
  const pending = useBench((s) => s.pendingPin);
  const st = useBench.getState;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-2 px-3 py-2 text-sm">
      <div role="radiogroup" aria-label="工具" className="flex">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            role="radio"
            aria-checked={tool === t.id}
            data-toolbar={t.id}
            onClick={() => st().setTool(t.id)}
            className={`min-h-9 border px-3 ${tool === t.id ? "border-ink bg-ink text-paper-2" : "border-line bg-paper hover:border-ink"} -ml-px first:ml-0`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {selected && tool === "select" && (
        <>
          <span className="ml-2 text-ink-soft">已选：{partDisplayName(selected)}</span>
          <button className="min-h-9 border border-line px-3 hover:border-ink" onClick={() => st().rotatePart(selected.id)}>
            旋转 90°
          </button>
          <button className="min-h-9 border border-line px-3 text-mark hover:border-mark" onClick={() => st().removePart(selected.id)}>
            移除
          </button>
        </>
      )}
      <span className="ml-auto text-xs text-ink-soft">
        {tool === "select" && "拖动零件可以移动；拖空白处旋转视角，滚轮缩放"}
        {tool === "wire" && (pending ? "已选第一个引脚，再点另一个引脚完成连线；双击导线可删除" : "点第一个引脚开始连线")}
        {tool === "iron" && "在焊点上按住鼠标：先加热焊盘，再送锡保持"}
      </span>
    </div>
  );
}

export function SolderMeter() {
  const solder = useBench((s) => s.solder);
  const pr = useBench((s) => s.solderProgress);
  if (!solder) return null;
  const ms = pr * HOLD_MS;
  const phase = ms < HEAT_MS ? "加热焊盘…" : "送锡，保持住…";
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 w-72 -translate-x-1/2 border border-ink bg-paper-2 p-3 text-sm shadow" role="status">
      <div className="flex justify-between">
        <span>{phase}</span>
        <span>{Math.round(pr * 100)}%</span>
      </div>
      <div className="mt-2 h-2 bg-line">
        <div className="h-2 bg-copper" style={{ width: `${pr * 100}%` }} />
      </div>
      <div className="mt-1 h-1 w-full" style={{ background: `linear-gradient(90deg, #e2a26b 0 ${(HEAT_MS / HOLD_MS) * 100}%, #c7c7c7 ${(HEAT_MS / HOLD_MS) * 100}% 100%)` }} />
    </div>
  );
}

export function Toast() {
  const toast = useBench((s) => s.toast);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      if (useBench.getState().toast === toast) useBench.setState({ toast: null });
    }, 2800);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const color = toast.level === "error" ? "bg-mark" : toast.level === "ok" ? "bg-mask" : toast.level === "warn" ? "bg-copper-deep" : "bg-ink";
  return (
    <div role="status" className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 text-sm text-paper-2 shadow ${color}`}>
      {toast.msg}
    </div>
  );
}
