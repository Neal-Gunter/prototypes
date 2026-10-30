import { useEffect, useRef } from "react";
import { DEFAULT_CODE, useBench } from "../store";
import { sim } from "../sim";

const STATUS = {
  idle: "未烧录",
  flashing: "烧录中…",
  running: "运行中",
  error: "出错",
  stopped: "已停止",
};

export function CodeEditor() {
  const code = useBench((s) => s.code);
  const errLine = useBench((s) => s.fw.errorLine);
  const gutter = useRef();
  const lines = code.split("\n").length;
  return (
    <div className="flex h-80 border border-ink bg-[#14120f] font-mono text-[13px] leading-5 text-[#efe7d6]">
      <div ref={gutter} aria-hidden="true" className="select-none overflow-hidden border-r border-[#3a342c] px-2 py-2 text-right text-[#8f8574]">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className={errLine === i + 1 ? "bg-mark text-paper-2" : ""}>
            {i + 1}
          </div>
        ))}
      </div>
      <textarea
        aria-label="固件代码"
        data-testid="code"
        spellCheck={false}
        value={code}
        onChange={(e) => useBench.getState().setCode(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.target.scrollTop;
        }}
        onKeyDown={(e) => {
          if (e.key === "Tab") {
            e.preventDefault();
            const t = e.target;
            const s = t.selectionStart;
            const v = t.value;
            useBench.getState().setCode(v.slice(0, s) + "  " + v.slice(t.selectionEnd));
            requestAnimationFrame(() => (t.selectionStart = t.selectionEnd = s + 2));
          }
        }}
        className="flex-1 resize-none bg-transparent px-3 py-2 outline-none"
      />
    </div>
  );
}

export function SerialMonitor() {
  const serial = useBench((s) => s.fw.serial);
  const ref = useRef();
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [serial]);
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-soft">串口监视器（115200）</h3>
      <div ref={ref} data-testid="serial" className="mt-1 h-40 overflow-auto border border-line bg-[#14120f] p-2 font-mono text-xs leading-5 text-[#cfe9d8]">
        {serial.length === 0 && <div className="text-[#8f8574]">（还没有输出）</div>}
        {serial.map((l, i) => (
          <div key={i} className={l.kind === "sim" ? "text-[#f0b48a]" : ""}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}

export function PinTable({ analysis }) {
  const pins = useBench((s) => s.fw.pins);
  const entries = Object.entries(pins);
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-soft">引脚状态</h3>
      <table className="mt-1 w-full border-collapse text-xs" data-testid="pins">
        <thead>
          <tr className="text-left text-ink-soft">
            <th className="border-b border-line py-1 font-normal">引脚</th>
            <th className="border-b border-line py-1 font-normal">模式</th>
            <th className="border-b border-line py-1 font-normal">值</th>
            <th className="border-b border-line py-1 font-normal">接到</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 && (
            <tr>
              <td colSpan={4} className="py-2 text-ink-soft">
                运行固件后显示
              </td>
            </tr>
          )}
          {entries.map(([pin, s]) => {
            const servo = Object.entries(analysis.servoStatus).find(([id]) => analysis.topoNetOf(`${id}.SIG`).some((p) => p.gpio === Number(pin)));
            return (
              <tr key={pin}>
                <td className="border-b border-line py-1">GPIO{pin}</td>
                <td className="border-b border-line py-1">{s.mode}</td>
                <td className="border-b border-line py-1">{typeof s.value === "number" ? `${s.value}°` : s.value}</td>
                <td className="border-b border-line py-1">
                  {servo ? (
                    <span className={servo[1].ok ? "text-mask" : "text-mark"}>
                      {servo[1].label}
                      {servo[1].ok ? "（可驱动）" : "（没接好）"}
                    </span>
                  ) : (
                    <span className="text-ink-soft">没接舵机</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FirmwareControls() {
  const status = useBench((s) => s.fw.status);
  const error = useBench((s) => s.fw.error);
  const st = useBench.getState;
  const running = status === "running" || status === "flashing";
  const flash = useBench((s) => s.fw.flash);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          data-testid="flash"
          onClick={() => st().flash()}
          className="min-h-10 bg-ink px-4 text-sm text-paper-2 hover:bg-copper-deep"
        >
          {running ? "重新烧录并运行" : "烧录并运行"}
        </button>
        <button disabled={!running} onClick={() => st().stop()} className="min-h-10 border border-ink px-4 text-sm disabled:opacity-40">
          停止
        </button>
        <button onClick={() => st().setCode(DEFAULT_CODE)} className="min-h-10 px-2 text-sm text-ink-soft underline">
          恢复示例代码
        </button>
        <span data-testid="fw-status" className="ml-auto text-xs">
          状态：<span className={status === "running" ? "text-mask" : status === "error" ? "text-mark" : ""}>{STATUS[status]}</span>
        </span>
      </div>
      {flash && (
        <div data-testid="flash-progress" className="text-xs">
          <div className="flex justify-between">
            <span>{flash.stage}…</span>
            <span className="tabular-nums">{Math.round(flash.pct)}%</span>
          </div>
          <div className="mt-1 h-2 bg-line">
            <div className="h-2 bg-copper transition-[width]" style={{ width: `${flash.pct}%` }} />
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="border-l-2 border-mark pl-2 text-xs text-mark">
          {error}
        </p>
      )}
      <p className="text-xs leading-5 text-ink-soft">
        简化：代码在网页里的 JS 解释器（Web Worker）中运行，只支持一小部分 Arduino 写法：Servo 的 attach / write / read、delay、millis、
        Serial.print / println、pinMode / digitalWrite、if / for / while、int / float 变量和数组、自定义函数。不是真实的 ESP32‑S3 仿真，也不会编译成机器码。
      </p>
    </div>
  );
}

// 串口绘图仪：舵机实际角度 vs 代码里的指令角度
const COLORS = ["#e88a1a", "#6cc3ff", "#9be38a", "#ff6b8b", "#d6c36a", "#c48cff"];
export function SerialPlotter() {
  const ref = useRef();
  const status = useBench((s) => s.fw.status);
  useEffect(() => {
    let raf;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const c = ref.current;
      if (!c) return;
      const w = (c.width = c.clientWidth * 2);
      const h = (c.height = c.clientHeight * 2);
      const g = c.getContext("2d");
      g.fillStyle = "#14120f";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#2e2a24";
      g.lineWidth = 1;
      g.font = "18px monospace";
      g.fillStyle = "#7d7366";
      for (const v of [0, 45, 90, 135, 180]) {
        const y = h - 10 - (v / 180) * (h - 20);
        g.beginPath();
        g.moveTo(40, y);
        g.lineTo(w, y);
        g.stroke();
        g.fillText(`${v}°`, 2, y + 6);
      }
      const data = sim.plot;
      if (data.length < 2) return;
      const t1 = data[data.length - 1].t;
      const t0 = t1 - 8;
      sim.plotNames.forEach((name, k) => {
        g.strokeStyle = COLORS[k % COLORS.length];
        g.lineWidth = name.includes("指令") ? 2 : 3;
        g.setLineDash(name.includes("指令") ? [8, 6] : []);
        g.beginPath();
        let first = true;
        for (const d of data) {
          if (d.t < t0 || d.values[name] == null) continue;
          const x = 40 + ((d.t - t0) / 8) * (w - 44);
          const y = h - 10 - (d.values[name] / 180) * (h - 20);
          if (first) g.moveTo(x, y);
          else g.lineTo(x, y);
          first = false;
        }
        g.stroke();
      });
      g.setLineDash([]);
      sim.plotNames.forEach((name, k) => {
        g.fillStyle = COLORS[k % COLORS.length];
        g.fillText(name, 50 + k * 190, 22);
      });
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [status]);
  return (
    <div>
      <h3 className="text-xs font-medium text-ink-soft">串口绘图仪（最近 8 秒：实线 = 舵机实际角度，虚线 = 代码指令）</h3>
      <canvas ref={ref} data-testid="plotter" className="mt-1 h-36 w-full border border-line" />
    </div>
  );
}
