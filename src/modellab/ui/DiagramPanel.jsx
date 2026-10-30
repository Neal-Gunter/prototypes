// v11 功能图：图片上画热点框（归一化坐标 0–1），点框 = 选功能；和 3D 双向高亮
import { useRef, useState } from "react";

export default function DiagramPanel({ url, w, h, functions, selFn, hlFns, drawing, onRegion, onDraw, onRemoveRegion }) {
  const box = useRef(null);
  const [drag, setDrag] = useState(null);
  const [zoom, setZoom] = useState(1);
  const norm = (e) => { const r = box.current.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  const rect = drag && { x: Math.min(drag.a.x, drag.b.x), y: Math.min(drag.a.y, drag.b.y), w: Math.abs(drag.b.x - drag.a.x), h: Math.abs(drag.b.y - drag.a.y) };
  const anyHl = hlFns.size > 0 || !!selFn;
  return (
    <div>
      <div className="mb-1 flex items-center gap-2 text-xs text-ink-soft">
        <span>{w}×{h} 像素</span>
        <label className="ml-auto flex items-center gap-1">缩放<input type="range" min="1" max="3" step="0.25" value={zoom} onChange={(e) => setZoom(+e.target.value)} aria-label="功能图缩放" /></label>
      </div>
      <div className="max-h-[60vh] overflow-auto border border-line bg-white">
        <div ref={box} data-testid="diagram" className={`relative select-none ${drawing ? "cursor-crosshair" : ""}`} style={{ width: `${zoom * 100}%`, aspectRatio: `${w} / ${h}` }}
          onPointerDown={(e) => { if (!drawing || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); const p = norm(e); setDrag({ a: p, b: p }); }}
          onPointerMove={(e) => drag && setDrag((d) => ({ ...d, b: norm(e) }))}
          onPointerUp={() => { if (!drag) return; if (rect.w > 0.01 && rect.h > 0.01) onDraw(rect); setDrag(null); }}>
          <img src={url} alt="功能图" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="功能热点">
            {functions.map((f) => f.regions.map((r, i) => {
              const on = selFn === f.id || hlFns.has(f.id);
              return (
                <g key={f.id + i} data-fn={f.id} style={{ cursor: drawing ? "crosshair" : "pointer" }}
                  onPointerDown={(e) => { if (drawing) return; e.stopPropagation(); onRegion(f.id, e); }}
                  onContextMenu={(e) => { e.preventDefault(); onRemoveRegion?.(f.id, i); }}>
                  <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={f.color} fillOpacity={on ? 0.32 : anyHl ? 0.04 : 0.12} stroke={f.color} strokeOpacity={on ? 1 : anyHl ? 0.3 : 0.8} strokeWidth={on ? 3 : 1.5} vectorEffect="non-scaling-stroke" />
                </g>
              );
            }))}
            {rect && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill="#d9792b" fillOpacity="0.15" stroke="#d9792b" strokeDasharray="4 3" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
          </svg>
          {functions.map((f) => f.regions.slice(0, 1).map((r) => (
            <span key={f.id} className="pointer-events-none absolute px-1 text-[11px] font-medium text-white" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, background: f.color, opacity: !anyHl || selFn === f.id || hlFns.has(f.id) ? 1 : 0.35 }}>{f.name}</span>
          )))}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-soft">{drawing ? "在图上拖一个框 = 给当前功能加热点区域（没选功能会新建一个）" : "点热点 = 选中这个功能（3D 里高亮它绑定的模块）；右键热点 = 删掉这个区域"}</p>
    </div>
  );
}
