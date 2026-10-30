// 装配台右侧的“通电”面板：电源状态、固件、串口、万用表、电路检查、按键 / 电位器
import { useEffect, useState } from "react";
import { engine } from "../engine.js";
import { elec } from "../elecStore.js";
import { meter, termLabel } from "../netlist.js";
import { makeGuide } from "../guide.js";
import { Link } from "react-router-dom";
import { benchToDesc, BENCH_KEY } from "../../repair/benchImport.js";
import BenchScope from "./BenchScope.jsx";

const LV = { error: "border-red-700 bg-red-50", warn: "border-amber-500 bg-amber-50", info: "border-line bg-white", ok: "border-emerald-700 bg-emerald-50" };

export default function ElecPanel({ probes, setProbes, tool, setTool }) {
  const [, force] = useState(0);
  const [board, setBoard] = useState(null);
  const [code, setCode] = useState("");
  const [mode, setMode] = useState("V");
  const [realOpen, setRealOpen] = useState(false);
  const [real, setReal] = useState([]);
  useEffect(() => {
    if (!realOpen) return;
    const f = () => { try { setReal(makeGuide(engine, { fw: elec.fw }).real); } catch { setReal([]); } };
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, [realOpen]);
  useEffect(() => {
    const id = setInterval(() => { elec.tick(); force((n) => n + 1); }, 100);
    return () => clearInterval(id);
  }, []);
  const L = elec.last;
  const boards = L?.sol.boards || [];
  const cur = boards.find((b) => b.uid === board) || boards[0];
  useEffect(() => { if (cur && cur.uid !== board) setBoard(cur.uid); }, [cur, board]);
  const st = cur ? elec.fw[cur.uid] : null;
  const items = L?.cir.items || [];
  const btns = items.filter((i) => i.kind === "btn");
  const pots = items.filter((i) => i.kind === "pot");
  const reading = L && probes.red && probes.black ? meter(L.cir, L.sol, probes.red.term, probes.black.term, mode) : null;

  const auto = () => { if (cur) setCode(elec.sketchFor(cur.uid)); };
  const upload = () => { if (cur) elec.upload(cur.uid, code || elec.sketchFor(cur.uid)); if (!code) auto(); };
  const download = () => {
    const blob = new Blob([code || (cur ? elec.sketchFor(cur.uid) : "")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cur?.ref || "sketch"}.ino`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="elec-panel">
      <section>
        <p className="font-medium">电源</p>
        {!boards.length && <p className="text-xs text-ink-soft">桌面上还没有开发板。先点上面的“电路练习”，或从左侧放一块 Pico。</p>}
        {boards.map((b) => (
          <button key={b.uid} type="button" onClick={() => setBoard(b.uid)} className={`mt-1 flex w-full items-center justify-between border px-2 py-1 text-left text-xs ${cur?.uid === b.uid ? "border-ink" : "border-line"} bg-white`} data-testid={`board-${b.ref}`}>
            <span>{b.ref} · {engine.parts.get(b.uid)?.def.name_zh || b.uid}</span>
            <span className={b.powered ? "text-emerald-700" : "text-ink-soft"} data-testid="power-state">{b.powered ? `已通电（${b.via || "USB"}）` : "未通电"}</span>
          </button>
        ))}
        {boards.some((b) => b.powered) && (
          <Link to="/repair?tab=editor&import=bench" className="mt-1 inline-block text-xs underline" data-testid="to-repair"
            onClick={() => { try { const d = benchToDesc(elec.last?.cir); if (d) localStorage.setItem(BENCH_KEY, JSON.stringify(d)); } catch (e) { console.warn(e); } }}>
            把这个电路做成维修关卡 →
          </Link>
        )}
      </section>

      {cur && (
        <section>
          <p className="font-medium">固件（{cur.ref}）</p>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={9} placeholder="点“按接线自动生成”，或者自己写 Arduino 风格代码" className="mt-1 w-full border border-line bg-white p-1 font-mono text-[11px] leading-4" data-testid="fw-code" />
          <div className="mt-1 flex flex-wrap gap-1 text-xs">
            <button type="button" onClick={auto} className="min-h-8 border border-line bg-white px-2" data-testid="fw-auto">按接线自动生成</button>
            <button type="button" onClick={upload} className="min-h-8 border border-ink bg-ink px-2 text-paper-2" data-testid="fw-upload">上传并运行</button>
            <button type="button" onClick={() => elec.stop(cur.uid)} className="min-h-8 border border-line bg-white px-2">停止</button>
            <button type="button" onClick={download} className="min-h-8 border border-line bg-white px-2" data-testid="fw-download">下载 .ino</button>
          </div>
          <p className="mt-1 text-xs" data-testid="fw-status">
            {st?.error ? <span className="text-red-700">{st.error.line ? `第 ${st.error.line} 行：` : ""}{st.error.msg}</span>
              : st?.running ? <span className="text-emerald-700">运行中</span>
              : st?.unpowered ? <span className="text-ink-soft">已上传，等通电（插上 USB 后从头运行）</span>
              : st?.done ? "程序结束" : <span className="text-ink-soft">还没上传</span>}
            {st?.warn && <span className="ml-1 text-amber-700">{st.warn}</span>}
          </p>
          <pre className="mt-1 h-24 overflow-y-auto border border-line bg-ink p-1 font-mono text-[11px] leading-4 text-paper-2" data-testid="serial">{(st?.serial || "").slice(-1500) || "（串口监视器）"}</pre>
        </section>
      )}

      {(btns.length > 0 || pots.length > 0) && (
        <section>
          <p className="font-medium">动手</p>
          {btns.map((b) => (
            <button key={b.uid} type="button" onPointerDown={() => elec.press(b.uid, true)} onPointerUp={() => elec.press(b.uid, false)} onPointerLeave={() => elec.press(b.uid, false)}
              className={`mt-1 mr-1 min-h-8 border px-2 text-xs ${engine.parts.get(b.uid)?.state.pressed ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`} data-testid={`press-${b.ref}`}>按住 {b.ref}</button>
          ))}
          {pots.map((p) => (
            <label key={p.uid} className="mt-1 flex items-center gap-2 text-xs">{p.ref}
              <input type="range" min={0} max={1} step={0.01} defaultValue={engine.parts.get(p.uid)?.state.pos ?? 0.5} onChange={(e) => elec.pot(p.uid, +e.target.value)} className="flex-1" data-testid={`pot-${p.ref}`} />
            </label>
          ))}
          <p className="mt-1 text-xs text-ink-soft">也可以在 3D 里用“手”右键按住按键。</p>
          {L?.servos.map((s) => <p key={s.uid} className="text-xs" data-testid="servo-state">{engine.parts.get(s.uid)?.state.ref}：{s.connected ? (s.moving ? `${Math.round(s.cur ?? s.angle)}°` : "有电，没收到信号") : "没接好"}</p>)}
          {[...(L?.leds.values() || [])].map((l) => <p key={l.uid} className="text-xs" data-testid="led-state">{engine.parts.get(l.uid)?.state.ref}：{engine.parts.get(l.uid)?.state.burnt ? "烧坏了" : `${l.mA.toFixed(2)} mA${l.mA > 0.3 ? "（亮）" : "（灭）"}`}</p>)}
        </section>
      )}

      <section>
        <p className="font-medium">万用表</p>
        <div className="mt-1 flex gap-1 text-xs">
          {[["V", "电压"], ["ohm", "电阻"], ["beep", "通断"]].map(([k, zh]) => (
            <button key={k} type="button" onClick={() => setMode(k)} aria-pressed={mode === k} className={`min-h-8 flex-1 border ${mode === k ? "border-ink bg-ink text-paper-2" : "border-line bg-white"}`}>{zh}</button>
          ))}
          <button type="button" onClick={() => setTool(tool === "meter" ? "hand" : "meter")} aria-pressed={tool === "meter"} className={`min-h-8 flex-1 border ${tool === "meter" ? "border-copper bg-copper text-white" : "border-line bg-white"}`} data-testid="probe-toggle">表笔</button>
        </div>
        <p className="mt-1 text-xs text-ink-soft">选“表笔”后：左键点 = 红表笔，右键（或 Shift+左键）点 = 黑表笔。点针脚、焊盘或面包板孔。</p>
        <p className="text-xs">红：{probes.red ? termLabel(engine, probes.red.term) : "—"} · 黑：{probes.black ? termLabel(engine, probes.black.term) : "—"}
          {(probes.red || probes.black) && <button type="button" className="ml-1 underline" onClick={() => setProbes({})}>收起</button>}</p>
        <p className="mt-1 border border-line bg-white px-2 py-1 font-mono text-base" data-testid="meter-reading">{reading ? reading.text : "—"}</p>
        {reading?.warn && <p className="text-xs text-amber-700">{reading.warn}</p>}
      </section>

      <details open={realOpen} onToggle={(e) => setRealOpen(e.currentTarget.open)} className="border border-copper bg-white p-2" data-testid="real-panel">
        <summary className="cursor-pointer font-medium">对照现实：实物上该量到多少</summary>
        <p className="mt-1 text-xs text-ink-soft">照着做好实物后，用万用表量同样两点，和模拟读数对比。差很多：多半是接错孔、虚焊或零件规格不同。</p>
        <ul className="mt-1 flex flex-col gap-1 text-xs">
          {real.map((r) => <li key={r.what} className="border-l-4 border-copper px-2"><span className="font-medium">{r.what}</span>：模拟 <span className="font-mono">{r.sim}</span><span className="block text-ink-soft">{r.how}</span></li>)}
          {!real.length && <li className="text-ink-soft">桌面上还没有可以对照的电路。</li>}
        </ul>
        {probes.red && probes.black && reading && <p className="mt-1 text-xs">表笔现在这两点：模拟 <span className="font-mono">{reading.text}</span>——实物上把表笔放在同样的两个针脚上量。</p>}
      </details>

      <section>
        <p className="font-medium">电路检查</p>
        <ul className="mt-1 flex flex-col gap-1" data-testid="checks">
          {(L?.checks || []).map((c) => (
            <li key={c.text} className={`border-l-4 px-2 py-1 text-xs ${LV[c.level] || LV.info}`}>{c.text}{c.fix && <span className="block text-ink-soft">怎么改：{c.fix}</span>}</li>
          ))}
          {L && !L.checks.length && <li className="text-xs text-ink-soft">没有发现问题（只检查了模拟里能判断的那些项目）</li>}
        </ul>
      </section>

      <details className="border border-line bg-white p-2" data-testid="bench-scope-panel">
        <summary className="cursor-pointer font-medium">示波器（时域模式，v18）：开机波形、舵机起步跌落、加不加电容</summary>
        <div className="mt-1"><BenchScope /></div>
      </details>
    </div>
  );
}
