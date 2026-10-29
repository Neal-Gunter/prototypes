import { PART_TYPES } from "../parts";
import { useBench } from "../store";

const ITEMS = [
  { type: "esp32", icon: "▭", hint: "20 个常用引脚" },
  { type: "servo", icon: "◫", hint: "SIG / VCC / GND 三根线" },
  { type: "battery", icon: "▤", hint: "+ / − 两根线" },
];

export default function Tray() {
  const parts = useBench((s) => s.parts);
  const tool = useBench((s) => s.tool);
  const st = useBench.getState;
  return (
    <aside aria-label="零件盒" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink-soft">零件盒</h2>
      <p className="text-xs leading-5 text-ink-soft">拖到底板上，或点一下放到推荐位置。外形是程序生成的简化模型，不是厂家 CAD。</p>
      {ITEMS.map((it) => {
        const def = PART_TYPES[it.type];
        const used = parts.filter((p) => p.type === it.type).length;
        const left = def.max - used;
        return (
          <button
            key={it.type}
            type="button"
            data-part={it.type}
            draggable={left > 0}
            disabled={left <= 0}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/x-part", it.type);
              e.dataTransfer.effectAllowed = "copy";
            }}
            onClick={() => st().addPart(it.type)}
            className="group flex items-start gap-3 border border-line bg-paper-2 p-3 text-left hover:border-ink disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span aria-hidden="true" className="mt-0.5 text-xl leading-none text-copper-deep">
              {it.icon}
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{def.label}</span>
              <span className="block text-xs text-ink-soft">{it.hint}</span>
              <span className="mt-1 block text-xs text-ink-soft">剩余 {left} / {def.max}</span>
            </span>
          </button>
        );
      })}
      <h2 className="mt-2 text-sm font-medium text-ink-soft">工具</h2>
      <button
        type="button"
        data-tool="wire"
        onClick={() => st().setTool(tool === "wire" ? "select" : "wire")}
        className={`border p-3 text-left text-sm ${tool === "wire" ? "border-copper bg-copper text-paper-2" : "border-line bg-paper-2 hover:border-ink"}`}
      >
        <span className="block font-medium">杜邦线（连线）</span>
        <span className="block text-xs opacity-80">点一个引脚，再点另一个引脚</span>
      </button>
      <button
        type="button"
        data-tool="iron"
        onClick={() => st().setTool(tool === "iron" ? "select" : "iron")}
        className={`border p-3 text-left text-sm ${tool === "iron" ? "border-copper bg-copper text-paper-2" : "border-line bg-paper-2 hover:border-ink"}`}
      >
        <span className="block font-medium">烙铁 330 °C</span>
        <span className="block text-xs opacity-80">按住焊点：先加热，再送锡保持，约 1.3 秒</span>
      </button>
    </aside>
  );
}
