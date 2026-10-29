import { useBench } from "../store";
import { pinDisplayName } from "../parts";
import { useHoldSolder } from "./Toolbar";

const LEVEL = {
  error: { label: "错误", cls: "border-mark text-mark" },
  warn: { label: "注意", cls: "border-copper-deep text-copper-deep" },
  info: { label: "提示", cls: "border-line text-ink-soft" },
};
const JS = {
  good: ["已焊好", "text-mask"],
  cold: ["虚焊", "text-mark"],
  bridge: ["桥连", "text-mark"],
  burnt: ["烧坏", "text-mark"],
  none: ["未焊", "text-ink-soft"],
};

function HoldButton({ pin }) {
  const h = useHoldSolder();
  return (
    <button
      type="button"
      data-solder={pin}
      title="键盘 / 无障碍路径：按住时自动在合适温度送锡"
      className="min-h-8 select-none border border-line px-2 text-xs hover:border-ink"
      onPointerDown={() => h.start(pin)}
      onPointerUp={h.end}
      onPointerLeave={() => useBench.getState().op && h.end()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          h.start(pin);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === " " || e.key === "Enter") h.end();
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
  const mode = useBench((s) => s.mode);
  const { issues, servoStatus } = analysis;
  const errors = issues.filter((i) => i.level === "error");
  const ok = analysis.pass;
  // 维修模式下不直接给答案：只说舵机能不能动
  const hide = mode === "repair";
  return (
    <section aria-labelledby="check-h" className="flex flex-col gap-3 text-sm" data-testid="check-panel">
      <div className="flex items-center justify-between">
        <h2 id="check-h" className="font-medium">
          {hide ? "现象" : "电路检查"}
        </h2>
        <span
          data-testid="check-badge"
          className={`px-2 py-0.5 text-xs ${ok ? "bg-mask text-paper-2" : errors.length ? "bg-mark text-paper-2" : "bg-line text-ink"}`}
        >
          {ok ? "检查通过" : hide ? "有故障" : errors.length ? `${errors.length} 个错误` : "未完成"}
        </span>
      </div>
      <p className="text-xs leading-5 text-ink-soft">
        {hide ? "维修模式：自动检查关掉了，用万用表和放大镜自己找。" : "简化规则检查：只看哪些引脚连在一起、焊点状态，不算真实电流。"}
      </p>
      {Object.entries(servoStatus).length > 0 && (
        <ul className="flex flex-col gap-1">
          {Object.entries(servoStatus).map(([id, s]) => (
            <li key={id} className="flex items-start gap-2" data-servo-status={id}>
              <span className={`mt-1 inline-block size-2 shrink-0 rounded-full ${s.ok ? "bg-mask" : "bg-mark"}`} />
              <span>
                {s.label}：{s.ok ? `能动（信号 GPIO${s.gpio}，${s.source === "battery" ? "电池供电" : "USB 5V 供电"}）` : hide ? "不动" : s.reasons[0]}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!hide && (
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-auto" data-testid="issues">
          {issues.length === 0 && <li className="text-ink-soft">没有发现问题。</li>}
          {issues.map((i, k) => (
            <li key={k} className={`border-l-2 pl-2 text-xs leading-5 ${LEVEL[i.level].cls}`}>
              <span className="font-medium">{LEVEL[i.level].label}</span> {i.msg}
            </li>
          ))}
        </ul>
      )}
      <details className="border-t border-line pt-2" open={!hide && wires.length > 0 && wires.length < 7}>
        <summary className="cursor-pointer text-xs text-ink-soft">
          导线 {wires.length} 根 · 焊点 {analysis.wiredPins.length} 个
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {wires.map((w) => (
            <li key={w.id} className="flex items-center gap-2">
              <span className="inline-block h-1 w-4" style={{ background: w.color }} />
              <span className="flex-1">
                {pinDisplayName(parts, w.a)} ↔ {pinDisplayName(parts, w.b)}
                {w.loose ? "（一头已拆）" : ""}
                {!hide && (w.strip?.a === "none" || w.strip?.b === "none") ? "（没剥皮）" : ""}
              </span>
              <button className="text-mark underline" onClick={() => useBench.getState().removeWire(w.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
        <ul className="mt-2 flex flex-col gap-1 text-xs">
          {analysis.wiredPins.map((p) => {
            const st = joints[p]?.state || "none";
            const [lbl, cls] = hide && st !== "none" ? ["已焊", "text-ink-soft"] : JS[st] || JS.none;
            return (
              <li key={p} className="flex items-center gap-2">
                <span className={`w-12 ${cls}`}>{lbl}</span>
                <span className="flex-1">{pinDisplayName(parts, p)}</span>
                {!hide && st !== "good" && st !== "burnt" && <HoldButton pin={p} />}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}
