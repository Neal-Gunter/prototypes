// 维修台的板子视图（SVG）：正面 / 背面、旋转、缩放平移、外壳、放大镜。点击返回目标给上层处理。
import { useMemo, useRef, useState } from "react";
import { padsOf } from "../boards.js";

const FILL = { res: "#d9c7a3", led: "#f3d9d9", diode: "#444", ldo: "#333", boost: "#2d4a6b", mcu: "#24303d", sensor: "#3a3a3a", conn: "#f1f1ee", sw: "#777", bat: "#3c5d3c", dcin: "#222", servo: "#3c4f7a", load: "#bbb" };
const LEDC = { 亮: "#ff3b30", 很暗: "#ff9c94", 一闪一闪: "#ff6b60" };

function pt(e, svg) { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); }

export default function BoardView({ board, obs, side, rot, zoom, setZoom, pan, setPan, loupe, running, onPick, selected, probes, height = 460 }) {
  const svgRef = useRef(null);
  const [mouse, setMouse] = useState(null);
  const drag = useRef(null);
  const W = board.w, H = board.h, M = 8;
  const mx = (x) => (side === "back" ? W - x : x);
  const padPos = useMemo(() => { const m = {}; for (const p of board.parts) m[p.ref] = padsOf(p); return m; }, [board]);
  const netPads = useMemo(() => {
    const m = {};
    for (const p of board.parts) { if (p.offBoard) continue; for (const [pin, n] of Object.entries(p.pins)) (m[n] ||= []).push({ ref: p.ref, pin, xy: padPos[p.ref][pin] }); }
    for (const t of board.testpoints) (m[t.net] ||= []).push({ tp: t.id, xy: [t.x, t.y] });
    return m;
  }, [board, padPos]);
  const netXY = (n, near) => { const L = netPads[n] || []; if (!L.length) { const p = board.parts.find((q) => Object.values(q.pins).includes(n)); if (p) { const pin = Object.entries(p.pins).find(([, v]) => v === n)[0]; return padPos[p.ref][pin]; } return [W / 2, H / 2]; } if (!near) return L[0].xy; return L.reduce((b, x) => (Math.hypot(x.xy[0] - near[0], x.xy[1] - near[1]) < Math.hypot(b.xy[0] - near[0], b.xy[1] - near[1]) ? x : b)).xy; };
  const vw = (W + 2 * M) / zoom, vh = (H + 2 * M) / zoom;
  const vb = `${W / 2 - vw / 2 + pan[0]} ${H / 2 - vh / 2 + pan[1]} ${vw} ${vh}`;
  const isSel = (t) => selected && Object.keys(t).every((k) => selected[k] === t[k]);
  const probeAt = (pr) => { if (!pr) return null; if (pr.ref) return padPos[pr.ref]?.[pr.pin]; if (pr.tp) { const t = board.testpoints.find((x) => x.id === pr.tp); return t && [t.x, t.y]; } return netXY(pr.net); };
  const click = (t) => (e) => { e.stopPropagation(); if (drag.current?.moved) return; onPick(t); };

  const content = (
    <g transform={`rotate(${rot} ${W / 2} ${H / 2})`}>
      <rect x={0} y={0} width={W} height={H} rx={2} fill={side === "back" ? "#1f5b3a" : "#2b6e47"} stroke="#173d28" strokeWidth={0.6} />
      <text x={side === "back" ? W - 2 : 2} y={H - 1.5} fontSize={2.4} fill="#cfe8d6" textAnchor={side === "back" ? "end" : "start"}>{board.name} · {side === "back" ? "背面（焊点 / 走线）" : "正面（零件）"}</text>
      {/* 走线（两面都画，背面更清楚） */}
      {board.traces.map((t) => { const pts = t.pts || [netXY(t.a), netXY(t.b)]; const d = pts.map((p, i) => `${i ? "L" : "M"}${mx(p[0])},${p[1]}`).join(" "); return (
        <g key={t.id} onClick={click({ type: "trace", id: t.id })} style={{ cursor: "pointer" }} data-testid={`trace-${t.id}`}>
          <path d={d} stroke={isSel({ type: "trace", id: t.id }) ? "#f6c945" : "#c98d4a"} strokeOpacity={side === "back" ? 1 : 0.55} strokeWidth={1.2} fill="none" />
          <path d={d} stroke="transparent" strokeWidth={4} fill="none" />
          {t.state.cracked && side === "back" && zoom >= 2.5 && <circle cx={mx(pts[1][0])} cy={pts[1][1]} r={0.5} fill="#111" />}
        </g>); })}
      {/* 零件 */}
      {board.parts.map((p) => {
        const missing = p.state.present === false;
        const pads = padPos[p.ref];
        const sel = isSel({ type: "part", ref: p.ref });
        const x = side === "back" ? W - p.x - p.w : p.x;
        return (
          <g key={p.ref} data-testid={`part-${p.ref}`}>
            {side === "front" && !missing && (
              <g onClick={click({ type: "part", ref: p.ref })} style={{ cursor: "pointer" }}>
                <rect x={x} y={p.y} width={p.w} height={p.h} rx={p.kind === "led" ? p.w / 2 : 1} fill={FILL[p.kind] || "#999"} stroke={sel ? "#f6c945" : p.state.burnt ? "#5a2a00" : "#111"} strokeWidth={sel ? 0.9 : 0.3} strokeDasharray={p.offBoard ? "1.2 0.8" : undefined} opacity={p.offBoard ? 0.85 : 1} />
                {p.state.burnt && <circle cx={x + p.w / 2} cy={p.y + p.h / 2} r={Math.min(p.w, p.h) / 3} fill="#3b2616" opacity={0.8} />}
                {obs?.hot?.some((h) => h.ref === p.ref) && <rect x={x - 1} y={p.y - 1} width={p.w + 2} height={p.h + 2} fill="none" stroke="#ff5a00" strokeWidth={0.8} className="animate-pulse" />}
                {p.kind === "led" && obs?.leds[p.ref] && LEDC[obs.leds[p.ref].state] && <circle cx={x + p.w / 2} cy={p.y + p.h / 2} r={obs.leds[p.ref].state === "很暗" ? p.w * 0.5 : p.w} fill={LEDC[obs.leds[p.ref].state]} opacity={0.55} pointerEvents="none" className={obs.leds[p.ref].state === "一闪一闪" ? "animate-pulse" : ""} data-testid={`glow-${p.ref}`} />}
                {p.kind === "servo" && <line x1={x + p.w / 2} y1={p.y + p.h / 2} x2={x + p.w / 2 + 6} y2={p.y + p.h / 2} stroke="#eee" strokeWidth={1.2} strokeLinecap="round" style={obs?.servos[p.ref]?.moving && running ? { transformOrigin: `${x + p.w / 2}px ${p.y + p.h / 2}px`, animation: "repairSweep 0.7s ease-in-out infinite alternate" } : undefined} />}
                <text x={x + p.w / 2} y={p.y - 0.8} fontSize={2.6} fill="#fff" textAnchor="middle">{p.ref}{p.state.newPart ? "*" : ""}</text>
                {p.kind === "res" && zoom >= 2 && <text x={x + p.w / 2} y={p.y + p.h / 2 + 0.8} fontSize={1.6} fill="#222" textAnchor="middle">{p.props.ohms >= 1000 ? p.props.ohms / 1000 + "k" : p.props.ohms}</text>}
              </g>
            )}
            {side === "front" && missing && <rect x={x} y={p.y} width={p.w} height={p.h} fill="none" stroke="#e8e8e8" strokeWidth={0.3} strokeDasharray="0.8 0.6" onClick={click({ type: "part", ref: p.ref })} style={{ cursor: "pointer" }} />}
            {side === "front" && missing && <text x={x + p.w / 2} y={p.y - 0.8} fontSize={2.6} fill="#e8e8e8" textAnchor="middle" onClick={click({ type: "part", ref: p.ref })}>{p.ref}（空）</text>}
            {/* 引脚 / 焊盘 */}
            {!p.offBoard && Object.entries(pads).map(([pin, xy]) => {
              const cold = p.joints?.[pin] === "cold";
              if (side === "front") return missing ? null : (
                <g key={pin} onClick={click({ type: "pin", ref: p.ref, pin })} style={{ cursor: "crosshair" }} data-testid={`pin-${p.ref}-${pin}`}>
                  <rect x={mx(xy[0]) - 0.8} y={xy[1] - 0.8} width={1.6} height={1.6} fill="#c0c0c0" stroke="#555" strokeWidth={0.15} />
                  {zoom >= 2 && <text x={mx(xy[0])} y={xy[1] + 2.6} fontSize={1.3} fill="#fff" textAnchor="middle">{pin}</text>}
                </g>);
              return (
                <g key={pin} onClick={click({ type: "pad", ref: p.ref, pin, net: p.pins[pin] })} style={{ cursor: "crosshair" }} data-testid={`pad-${p.ref}-${pin}`}>
                  <circle cx={mx(xy[0])} cy={xy[1]} r={1.3} fill={missing ? "#b87333" : cold ? "#8a8a84" : "#e3e3e3"} stroke={missing ? "#7a4a1d" : "#9a9a9a"} strokeWidth={0.25} />
                  {missing && <circle cx={mx(xy[0])} cy={xy[1]} r={0.45} fill="#1f5b3a" />}
                  {cold && zoom >= 2 && <circle cx={mx(xy[0]) + 0.3} cy={xy[1] - 0.3} r={0.9} fill="#a5a59e" stroke="#666" strokeWidth={0.15} />}
                  {zoom >= 2.5 && <text x={mx(xy[0])} y={xy[1] + 2.8} fontSize={1.2} fill="#dff" textAnchor="middle">{p.pins[pin]}</text>}
                </g>);
            })}
            {side === "back" && !p.offBoard && <text x={x + p.w / 2} y={p.y - 0.8} fontSize={2} fill="#cfe8d6" textAnchor="middle" opacity={0.8}>{p.ref}</text>}
          </g>
        );
      })}
      {/* 线（两面都能看到） */}
      {board.wires.map((w) => { const a = netXY(w.a), b = netXY(w.b, a); const mid = [(mx(a[0]) + mx(b[0])) / 2, (a[1] + b[1]) / 2 - 4]; return (
        <g key={w.id} onClick={click({ type: "wire", id: w.id })} style={{ cursor: "pointer" }} data-testid={`wire-${w.id}`}>
          <path d={`M${mx(a[0])},${a[1]} Q${mid[0]},${mid[1]} ${mx(b[0])},${b[1]}`} stroke={/BAT-|-$/.test(w.a) ? "#222" : w.id.startsWith("JW") ? "#e0e050" : "#d42"} strokeWidth={w.state.awg >= 28 ? 0.45 : 1.1} fill="none" />
          <path d={`M${mx(a[0])},${a[1]} Q${mid[0]},${mid[1]} ${mx(b[0])},${b[1]}`} stroke={isSel({ type: "wire", id: w.id }) ? "#f6c945" : "transparent"} strokeWidth={3} fill="none" strokeOpacity={0.5} />
        </g>); })}
      {/* 锡桥 / 飞线短路 */}
      {board.shorts.map((s) => { const a = netXY(s.a), b = netXY(s.b, a); const vis = s.kind === "wire" || side === "back" || zoom >= 2; return vis && (
        <g key={s.id} onClick={click({ type: "short", id: s.id })} style={{ cursor: "pointer" }} data-testid={`short-${s.id}`}>
          {s.kind === "wire" ? <path d={`M${mx(a[0])},${a[1]} Q${(mx(a[0]) + mx(b[0])) / 2},${(a[1] + b[1]) / 2 - 5} ${mx(b[0])},${b[1]}`} stroke="#e8e050" strokeWidth={0.5} fill="none" />
            : <line x1={mx(a[0])} y1={a[1]} x2={mx(b[0])} y2={b[1]} stroke="#eaeaea" strokeWidth={zoom >= 2 ? 1.6 : 0.8} strokeLinecap="round" opacity={0.9} />}
          {isSel({ type: "short", id: s.id }) && <circle cx={(mx(a[0]) + mx(b[0])) / 2} cy={(a[1] + b[1]) / 2} r={3} fill="none" stroke="#f6c945" strokeWidth={0.5} />}
        </g>); })}
      {/* 测试点 */}
      {board.testpoints.map((t) => (
        <g key={t.id} onClick={click({ type: "tp", net: t.net, tp: t.id })} style={{ cursor: "crosshair" }} data-testid={`tp-${t.id}`}>
          <circle cx={mx(t.x)} cy={t.y} r={1.6} fill="#f6d27a" stroke="#8a6d1f" strokeWidth={0.3} />
          <text x={mx(t.x)} y={t.y - 2.2} fontSize={1.9} fill="#fff6d0" textAnchor="middle">{t.id} {t.net}</text>
        </g>))}
      {/* 外壳（只在正面挡住零件） */}
      {side === "front" && board.covers.map((c) => (
        <g key={c.id} onClick={click({ type: "cover", id: c.id })} style={{ cursor: "pointer" }} data-testid={`cover-${c.id}`}>
          {c.on ? <><rect x={c.x} y={c.y} width={c.w} height={c.h} rx={1.5} fill="#8b8f96" opacity={0.93} stroke={isSel({ type: "cover", id: c.id }) ? "#f6c945" : "#555"} strokeWidth={0.5} />
            <text x={c.x + c.w / 2} y={c.y + c.h / 2} fontSize={2.4} fill="#fff" textAnchor="middle">{c.zh}（点一下拆）</text></>
            : <rect x={c.x} y={c.y} width={c.w} height={c.h} rx={1.5} fill="none" stroke="#ccc" strokeWidth={0.3} strokeDasharray="1 1" />}
        </g>))}
      {/* 表笔 */}
      {[["red", "#e11"], ["black", "#111"]].map(([k, col]) => { const xy = probeAt(probes?.[k]); return xy && <g key={k} pointerEvents="none"><line x1={mx(xy[0])} y1={xy[1]} x2={mx(xy[0]) + (k === "red" ? 4 : -4)} y2={xy[1] - 7} stroke={col} strokeWidth={1} /><circle cx={mx(xy[0])} cy={xy[1]} r={0.9} fill={col} stroke="#fff" strokeWidth={0.25} /></g>; })}
    </g>
  );

  const onWheel = (e) => { e.preventDefault?.(); setZoom((z) => Math.min(6, Math.max(1, z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))); };
  return (
    <div className="relative select-none border border-line bg-[#0f1a14]" style={{ height }} onWheel={onWheel}>
      <svg ref={svgRef} viewBox={vb} className="h-full w-full touch-none" data-testid="board-svg"
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, pan, moved: false }; }}
        onPointerMove={(e) => {
          if (svgRef.current && loupe) { const p = pt(e, svgRef.current); setMouse([p.x, p.y]); }
          const d = drag.current; if (!d || !(e.buttons & 1)) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.hypot(dx, dy) > 4) { d.moved = true; const s = vw / (svgRef.current?.clientWidth || 600); setPan([d.pan[0] - dx * s, d.pan[1] - dy * s]); }
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
        onPointerLeave={() => setMouse(null)}>
        <defs>
          <style>{"@keyframes repairSweep{from{transform:rotate(-35deg)}to{transform:rotate(35deg)}}"}</style>
          {mouse && <clipPath id="repair-loupe"><circle cx={mouse[0]} cy={mouse[1]} r={vw * 0.12} /></clipPath>}
        </defs>
        <g id="repair-board-content">{content}</g>
        {loupe && mouse && (
          <g pointerEvents="none" data-testid="loupe">
            <g clipPath="url(#repair-loupe)"><rect x={mouse[0] - vw} y={mouse[1] - vw} width={2 * vw} height={2 * vw} fill="#0f1a14" /><g transform={`translate(${mouse[0]} ${mouse[1]}) scale(3) translate(${-mouse[0]} ${-mouse[1]})`}><use href="#repair-board-content" /></g></g>
            <circle cx={mouse[0]} cy={mouse[1]} r={vw * 0.12} fill="none" stroke="#f6c945" strokeWidth={vw * 0.006} />
          </g>
        )}
      </svg>
    </div>
  );
}
