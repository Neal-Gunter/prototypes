import { useBench } from "../store";
import { pinDisplayName } from "../parts";

const LEVEL = {
  error: { label: "错误", cls: "border-mark text-mark" },
  warn: { label: "注意", cls: "border-copper-deep text-copper-deep" },
  info: { label: "提示", cls: "border-line text-ink-soft" },
};

function HoldButton({ pin }) {
  const st = useBench.getState;
  const start = () => {
    if (st().tool !== "iron") st().setTool("iron");
    st().startSolder(pin);
  };
  return (
    <button
      type="button"
      data-solder={pin}
      className="min-h-8 select-none border border-line px-2 text-xs hover:border-ink"
      onPointerDown={start}
      onPointerUp={() => st().endSolder()}
      onPointerLeave={() => st().endSolder()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") st().endSolder();
      }}
    >
      按住焊接
    </button>
  );
}

export default function CheckPanel({ analysis }) {
  const parts = useBench((s) => s.parts);
  const wires = useBench((s) => s.wires);
  const joints = useBench((s) => s.joints);
  const { issues, servoStatus } = analysis;
  const errors = issues.filter((i) => i.level === "error");
  const ok = analysis.pass;
  return (
    <section aria-labelledby="check-h" className="flex flex-col gap-3 text-sm" data-testid="check-panel">
      <div className="flex items-center justify-between">
        <h2 id="check-h" className="font-medium">
          电路检查
        </h2>
        <span
          data-testid="check-badge"
          className={`px-2 py-0.5 text-xs ${ok ? "bg-mask text-paper-2" : errors.length ? "bg-mark text-paper-2" : "bg-line text-ink"}`}
        >
          {ok ? "检查通过" : errors.length ? `${errors.length} 个错误` : "未完成"}
        </span>
      </div>
      <p className="text-xs leading-5 text-ink-soft">简化规则检查：只看哪些引脚连在一起，不算真实电压和电流。</p>
      {Object.entries(servoStatus).length > 0 && (
        <ul className="flex flex-col gap-1">
          {Object.entries(servoStatus).map(([id, s]) => (
            <li key={id} className="flex items-start gap-2" data-servo-status={id}>
              <span className={`mt-1 inline-block size-2 shrink-0 rounded-full ${s.ok ? "bg-mask" : "bg-mark"}`} />
              <span>
                {s.label}：{s.ok ? `能动（信号 ${s.gpio}，${s.source === "battery" ? "电池供电" : "USB 5V 供电"}）` : s.reasons[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ul className="flex max-h-56 flex-col gap-1.5 overflow-auto" data-testid="issues">
        {issues.length === 0 && <li className="text-ink-soft">没有发现问题。</li>}
        {issues.map((i, k) => (
          <li key={k} className={`border-l-2 pl-2 text-xs leading-5 ${LEVEL[i.level].cls}`}>
            <span className="font-medium">{LEVEL[i.level].label}</span> {i.msg}
          </li>
        ))}
      </ul>
      <details className="border-t border-line pt-2" open={wires.length > 0 && wires.length < 7}>
        <summary className="cursor-pointer text-xs text-ink-soft">导线 {wires.length} 根 · 焊点 {analysis.wiredPins.length} 个</summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {wires.map((w) => (
            <li key={w.id} className="flex items-center gap-2">
              <span className="inline-block h-1 w-4" style={{ background: w.color }} />
              <span className="flex-1">
                {pinDisplayName(parts, w.a)} ↔ {pinDisplayName(parts, w.b)}
              </span>
              <button className="text-mark underline" onClick={() => useBench.getState().removeWire(w.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {analysis.wiredPins.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span className={`w-12 ${joints[p] === "good" ? "text-mask" : joints[p] === "cold" ? "text-mark" : "text-ink-soft"}`}>
                {joints[p] === "good" ? "已焊好" : joints[p] === "cold" ? "虚焊" : "未焊"}
              </span>
              <span className="flex-1">{pinDisplayName(parts, p)}</span>
              {joints[p] !== "good" && <HoldButton pin={p} />}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
