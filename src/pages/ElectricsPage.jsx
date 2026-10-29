// 简化电路实验：两块 MCU、LED+电阻、按键、电位器、板间连线。早期原型，简化仿真。
import { useEffect, useRef, useState } from "react";
import { createFirmware } from "../workbench/firmware/runner";
import { containerClass } from "../container";

export const ELEC_SIMPLIFICATIONS = [
  "电路是固定接法，只算稳态电压电流（欧姆定律），没有瞬态、电容、噪声",
  "GPIO 输出当成理想电压源：高 = 3.3 V，低 = 0 V，没有内阻和电流上限",
  "LED 正向压降取 2.0 V（红色 LED 的典型值，估算），亮度按电流 ÷ 20 mA 线性换算",
  "按键没有抖动；INPUT 模式下松开 = 悬空，这里简化为读到 0（真实电路会乱跳）",
  "analogRead 直接按滑块位置换算（A 板 12 位、B 板 10 位），没有非线性和噪声",
  "两块板子共地，板间连线是理想导线；B 板只有在 A 的 GPIO 5 设成 OUTPUT 时才读到电平",
  "“烧坏”只是提示，换上电阻后 LED 会恢复（真实 LED 不会）",
  "固件由简化解释器执行，只支持一部分 Arduino 语法，时间是近似的",
];

const CODE_A = `// A 板（ESP32-S3 简化）
// LED 接 GPIO 2（经电阻），按键接 GPIO 4 到 GND，电位器接 GPIO 1，GPIO 5 连到 B 板
void setup() {
  Serial.begin(115200);
  pinMode(2, OUTPUT);
  pinMode(4, INPUT_PULLUP);
  pinMode(5, OUTPUT);
}

void loop() {
  int pressed = digitalRead(4) == LOW;
  int pot = analogRead(1);
  digitalWrite(2, pressed ? HIGH : LOW);
  digitalWrite(5, pot > 2048 ? HIGH : LOW);
  Serial.println(pot);
  delay(100);
}
`;
const CODE_B = `// B 板（RP2040 简化）
// GPIO 3 接 A 板 GPIO 5，LED 接 GPIO 25（经 330 Ω）
void setup() {
  Serial.begin(115200);
  pinMode(3, INPUT);
  pinMode(25, OUTPUT);
}

void loop() {
  int v = digitalRead(3);
  digitalWrite(25, v);
  Serial.println(v);
  delay(50);
}
`;

const VF = 2.0; // 估算：红色 LED 典型正向压降
const R_CHOICES = [0, 100, 220, 330, 1000, 10000];

function ledState(vOut, r) {
  if (vOut <= VF) return { mA: 0, glow: 0, burnt: false };
  if (r === 0) return { mA: Infinity, glow: 1, burnt: true };
  const mA = ((vOut - VF) / r) * 1000;
  return { mA, glow: Math.min(1, mA / 20), burnt: false, over: mA > 20 };
}

function Led({ glow, burnt, label, testid }) {
  const fill = burnt ? "#3a2a22" : `rgba(230,40,30,${0.15 + 0.85 * glow})`;
  return (
    <svg width="44" height="56" viewBox="0 0 44 56" data-testid={testid} data-glow={glow.toFixed(2)} aria-label={label}>
      {glow > 0 && !burnt && <circle cx="22" cy="20" r={14 + 8 * glow} fill={`rgba(255,80,60,${0.35 * glow})`} />}
      <path d="M10 34 V20 a12 12 0 0 1 24 0 V34 Z" fill={fill} stroke="#7a1a14" />
      <line x1="16" y1="34" x2="16" y2="54" stroke="#888" strokeWidth="2" />
      <line x1="28" y1="34" x2="28" y2="50" stroke="#888" strokeWidth="2" />
      {burnt && <text x="22" y="24" textAnchor="middle" fontSize="10" fill="#fff">✕</text>}
    </svg>
  );
}

function useBoard(name, adcBits) {
  const [pins, setPins] = useState({});
  const [modes, setModes] = useState({});
  const [log, setLog] = useState([]);
  const [err, setErr] = useState(null);
  const fw = useRef(null);
  const onEv = useRef(() => {});
  if (!fw.current) fw.current = createFirmware((ev) => onEv.current(ev));
  onEv.current = (ev) => {
    if (ev.type === "pin") {
      if (ev.mode) setModes((m) => ({ ...m, [ev.pin]: ev.mode }));
      if (ev.value != null) setPins((p) => (p[ev.pin] === ev.value ? p : { ...p, [ev.pin]: ev.value }));
    } else if (ev.type === "serial") {
      setLog((l) => [...l.slice(-60), `${ev.text}`]);
    } else if (ev.type === "error") {
      setErr(`${ev.phase === "compile" ? "编译错误" : "运行错误"}${ev.line ? `（第 ${ev.line} 行）` : ""}：${ev.msg}`);
    }
  };
  useEffect(() => () => fw.current.stop(), []);
  return {
    name, pins, modes, log, err,
    start(code) { setPins({}); setModes({}); setLog([]); setErr(null); fw.current.start(code, { adcBits }); },
    stop() { fw.current.stop(); },
    input(k, p, v) { fw.current.input(k, p, v); },
  };
}

export default function ElectricsPage() {
  useEffect(() => { document.title = "简化电路实验 · 早期原型"; }, []);
  const A = useBoard("A", 12);
  const B = useBoard("B", 10);
  const [codeA, setCodeA] = useState(CODE_A);
  const [codeB, setCodeB] = useState(CODE_B);
  const [running, setRunning] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pot, setPot] = useState(0.3);
  const [rA, setRA] = useState(220);

  // 输入电平送进固件
  useEffect(() => { A.input("d", 4, pressed ? 0 : A.modes[4] === "INPUT_PULLUP" ? 1 : null); }, [pressed, A.modes[4], running]); // eslint-disable-line
  useEffect(() => { A.input("a", 1, pot); }, [pot, running]); // eslint-disable-line
  const linkV = A.modes[5] === "OUTPUT" ? (A.pins[5] ? 1 : 0) : null;
  useEffect(() => { B.input("d", 3, linkV); }, [linkV, running]); // eslint-disable-line

  const vA = A.modes[2] === "OUTPUT" && A.pins[2] ? 3.3 : 0;
  const vB = B.modes[25] === "OUTPUT" && B.pins[25] ? 3.3 : 0;
  const ledA = ledState(vA, rA);
  const ledB = ledState(vB, 330);

  const run = () => { A.start(codeA); B.start(codeB); setRunning(true); };
  const stop = () => { A.stop(); B.stop(); setRunning(false); };

  return (
    <section className={`${containerClass} py-8`} data-testid="electrics">
      <h1 className="text-2xl font-medium">简化电路实验 <span className="ml-1 border border-copper px-1.5 py-0.5 align-middle text-xs text-copper">早期原型，简化仿真</span></h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-soft">两块开发板各跑一段固件（pinMode / digitalWrite / digitalRead / analogRead）。A 板接 LED+限流电阻、按键和电位器，GPIO 5 用一根线连到 B 板的 GPIO 3，B 板再点亮自己的 LED。所有数值都是简化计算，见页面底部。</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button className="min-h-10 border border-ink px-4 hover:bg-ink hover:text-paper-2" onClick={run} data-testid="elec-run">{running ? "重新运行" : "运行两块板子"}</button>
        <button className="min-h-10 border border-line px-4" onClick={stop} disabled={!running}>停止</button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="border border-line p-4">
          <h2 className="font-medium">A 板（ESP32‑S3 简化）</h2>
          <div className="mt-3 flex flex-wrap items-end gap-6">
            <div className="text-center text-xs">
              <Led glow={ledA.glow} burnt={ledA.burnt} label="A 板 LED" testid="led-a" />
              <div>GPIO 2 → 电阻 → LED → GND</div>
              <label className="mt-1 block">限流电阻
                <select className="ml-1 border border-line" value={rA} onChange={(e) => setRA(+e.target.value)} data-testid="r-select">
                  {R_CHOICES.map((r) => <option key={r} value={r}>{r === 0 ? "不接（短路）" : r >= 1000 ? `${r / 1000} kΩ` : `${r} Ω`}</option>)}
                </select>
              </label>
              <div className="mt-1 font-mono" data-testid="led-a-ma">{ledA.burnt ? "LED 烧坏（没有限流电阻）" : `${ledA.mA.toFixed(1)} mA`}</div>
              {ledA.over && <div className="text-copper">超过常见 LED 额定 20 mA（典型值，估算）</div>}
            </div>
            <div className="text-center text-xs">
              <button
                className={`size-14 rounded-full border-4 ${pressed ? "border-ink bg-ink/70" : "border-line bg-paper-2"}`}
                onPointerDown={() => setPressed(true)} onPointerUp={() => setPressed(false)} onPointerLeave={() => setPressed(false)}
                data-testid="btn-a" aria-pressed={pressed}
              />
              <div>按键：GPIO 4 → GND（按住）</div>
              <div className="font-mono">模式 {A.modes[4] || "—"}</div>
            </div>
            <div className="text-xs">
              <label>电位器 10 kΩ → GPIO 1
                <input type="range" min="0" max="1" step="0.01" value={pot} onChange={(e) => setPot(+e.target.value)} className="block w-40" data-testid="pot-a" />
              </label>
              <div className="font-mono">{(pot * 3.3).toFixed(2)} V · 读数约 {Math.round(pot * 4095)}</div>
            </div>
          </div>
          <div className="mt-3 text-xs">板间连线 A:GPIO 5 → B:GPIO 3：<span className="font-mono" data-testid="link-v">{linkV == null ? "悬空（A 未设成 OUTPUT）" : linkV ? "高 3.3 V" : "低 0 V"}</span></div>
          <textarea className="mt-3 h-64 w-full border border-line p-2 font-mono text-xs" value={codeA} onChange={(e) => setCodeA(e.target.value)} spellCheck={false} aria-label="A 板固件" />
          {A.err && <p className="text-sm text-copper">{A.err}</p>}
          <pre className="mt-2 h-24 overflow-auto bg-ink p-2 text-xs text-paper-2" data-testid="serial-a">{A.log.slice(-8).join("\n")}</pre>
        </div>
        <div className="border border-line p-4">
          <h2 className="font-medium">B 板（RP2040 简化）</h2>
          <div className="mt-3 flex items-end gap-6 text-center text-xs">
            <div>
              <Led glow={ledB.glow} burnt={ledB.burnt} label="B 板 LED" testid="led-b" />
              <div>GPIO 25 → 330 Ω → LED → GND</div>
              <div className="font-mono">{ledB.mA.toFixed(1)} mA</div>
            </div>
          </div>
          <textarea className="mt-3 h-64 w-full border border-line p-2 font-mono text-xs" value={codeB} onChange={(e) => setCodeB(e.target.value)} spellCheck={false} aria-label="B 板固件" />
          {B.err && <p className="text-sm text-copper">{B.err}</p>}
          <pre className="mt-2 h-24 overflow-auto bg-ink p-2 text-xs text-paper-2" data-testid="serial-b">{B.log.slice(-8).join("\n")}</pre>
        </div>
      </div>

      <h2 className="mt-6 font-medium">这里简化了什么</h2>
      <ul className="mt-1 list-disc pl-5 text-sm leading-6 text-ink-soft">
        {ELEC_SIMPLIFICATIONS.map((t) => <li key={t}>{t}</li>)}
      </ul>
    </section>
  );
}
