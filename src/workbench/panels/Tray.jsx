import { PART_TYPES } from "../parts";
import { useBench } from "../store";
import { TOOLS } from "./Toolbar";

const ITEMS = [
  { type: "esp32", icon: "▭", hint: "排针孔直接焊线" },
  { type: "servo", icon: "◫", hint: "SIG / VCC / GND 线头，和导线对焊；两颗 M2 螺丝固定" },
  { type: "battery", icon: "▤", hint: "4 节 AA，+ / − 两根引线" },
];

export default function Tray() {
  const parts = useBench((s) => s.parts);
  const tool = useBench((s) => s.tool);
  const mode = useBench((s) => s.mode);
  const st = useBench.getState;
  return (
    <aside aria-label="零件盒" className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink-soft">零件盒</h2>
      <p className="text-xs leading-5 text-ink-soft">拖到底板上，或点一下放到推荐位置。外形来自 Adafruit 开源 CAD（MIT）。</p>
      {ITEMS.map((it) => {
        const def = PART_TYPES[it.type];
        const used = parts.filter((p) => p.type === it.type).length;
        const left = def.max - used;
        return (
          <button
            key={it.type}
            type="button"
            data-part={it.type}
            draggable={left > 0 && mode === "build"}
            disabled={left <= 0 || mode !== "build"}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/x-part", it.type);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => st().addPart(it.type)}
            className="group flex items-start gap-3 border border-line bg-paper-2 p-2.5 text-left hover:border-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span aria-hidden="true" className="mt-0.5 text-xl leading-none text-copper-deep">
              {it.icon}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{def.label}</span>
              <span className="block text-xs leading-4 text-ink-soft">{it.hint}</span>
              <span className="mt-1 block text-xs text-ink-soft">剩余 {left} / {def.max}</span>
            </span>
          </button>
        );
      })}
      <h2 className="mt-2 text-sm font-medium text-ink-soft">工具托盘</h2>
      <p className="text-xs leading-5 text-ink-soft">也可以直接点桌上的工具把它拿起来，再点一次放回。</p>
      <div className="grid grid-cols-2 gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-tool={t.id}
            title={t.tip}
            onClick={() => st().setTool(tool === t.id ? "select" : t.id)}
            className={`border px-2 py-1.5 text-left text-xs ${tool === t.id ? "border-copper bg-copper text-paper-2" : "border-line bg-paper-2 hover:border-ink"}`}
          >
            <span className="block font-medium">
              {t.key} · {t.label}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
