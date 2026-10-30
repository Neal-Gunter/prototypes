// v16 我的补充：实物连接。Web Serial / Web Bluetooth 连真 ESP32（OCTL/1 协议），或者连浏览器里的“模拟设备”演示。
// 仿真那一列 = 同一份固件逻辑（firmware.js 孪生）吃同样被确认的指令；实物那一列 = 板子回来的遥测。
import { useEffect, useMemo, useRef, useState } from "react";
import { LinkSession, TIMING } from "./session.js";
import { MockTransport, WebSerialTransport, BleTransport, linkSupport, MOCK_PRESETS } from "./transports.js";
import { RealClock } from "./clock.js";
import { loadCalib, saveCalib, sanitizeCalib, toTrimHeader, defaultCalib, WIZARD } from "./calib.js";
import { MODES, PROTO, NAK } from "./protocol.js";
import { SAFETY, gaitPeakRate } from "./safety.js";

const STATE_ZH = { idle: "未连接", connecting: "正在连接…", ready: "已连接", lost: "掉线了", reconnecting: "正在重连…", closed: "已断开" };
const f = (x, n = 1) => (x == null || !Number.isFinite(x) ? "—" : x.toFixed(n));
const B = ({ t, on, dis, cls = "", children, title }) => <button type="button" data-testid={t} disabled={dis} title={title} onClick={on} className={`rounded border border-line px-1.5 py-0.5 disabled:opacity-40 ${cls}`}>{children}</button>;
const download = (name, text) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

function Chart({ hist, ch, now, span = 10000 }) {
  const W = 320, H = 120, pad = 4;
  const xs = hist.filter((h) => now - h.t <= span);
  const X = (t) => pad + ((t - (now - span)) / span) * (W - 2 * pad);
  const Y = (v) => H / 2 - (v / 60) * (H / 2 - pad);
  const path = (get) => xs.map((h, i) => { const v = get(h); return Number.isFinite(v) ? `${i ? "L" : "M"}${X(h.t).toFixed(1)},${Y(Math.max(-60, Math.min(60, v))).toFixed(1)}` : ""; }).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-line bg-white" data-testid="link-chart">
      {[-55, 0, 55].map((v) => <g key={v}><line x1={pad} x2={W - pad} y1={Y(v)} y2={Y(v)} stroke={v ? "#fca5a5" : "#e5e7eb"} strokeDasharray={v ? "3 3" : ""} /><text x={W - pad - 1} y={Y(v) - 2} fontSize="8" textAnchor="end" fill="#9ca3af">{v}°</text></g>)}
      <path d={path((h) => h.sim?.a[ch])} fill="none" stroke="#2563eb" strokeWidth="1.5" data-testid="link-chart-sim" />
      <path d={path((h) => h.real.a[ch])} fill="none" stroke="#b45309" strokeWidth="1.5" strokeDasharray="4 2" data-testid="link-chart-real" />
      <text x={pad + 2} y={10} fontSize="9" fill="#2563eb">— 仿真孪生</text><text x={pad + 70} y={10} fontSize="9" fill="#b45309">- - 板子遥测</text><text x={pad + 140} y={10} fontSize="9" fill="#6b7280">舵机 {ch}，最近 {span / 1000} s</text>
    </svg>
  );
}

export default function LinkPanel({ tid = "link" }) {
  const support = useMemo(() => linkSupport(), []);
  const [kind, setKind] = useState("mock"), [flavor, setFlavor] = useState("ble"), [dry, setDry] = useState(false);
  const [, setTick] = useState(0); const S = useRef(null), T = useRef(null);
  const [ch, setCh] = useState(1), [thr, setThr] = useState(0.6), [steer, setSteer] = useState(0);
  const [pose, setPose] = useState(() => Array(8).fill(0));
  const [gait, setGait] = useState({ freq_hz: 0.6, yaw_amp_deg: 30, lift_amp_deg: 20, phase_deg: 90, duty: 0.6, press_deg: 0 });
  const [rate, setRate] = useState(SAFETY.rateCap);
  const [calib, setCalib] = useState(() => loadCalib(typeof localStorage !== "undefined" ? localStorage : null, 8));
  const [cch, setCch] = useState(0), [saved, setSaved] = useState("");
  const s = S.current, st = s?.state || "idle", live = st === "ready";
  const realKind = kind !== "mock";

  useEffect(() => { const id = setInterval(() => setTick((x) => x + 1), 200); return () => clearInterval(id); }, []);
  useEffect(() => {
    const bye = () => { const x = S.current; if (x && x.state === "ready" && !x.dryRun) x.estop(); };
    const key = (e) => { if (e.key === "Escape" && S.current && S.current.state !== "idle") { S.current.estop(); setTick((x) => x + 1); } };
    addEventListener("beforeunload", bye); addEventListener("keydown", key);
    return () => { removeEventListener("beforeunload", bye); removeEventListener("keydown", key); bye(); S.current?.destroy(); T.current?.destroy?.(); };
  }, []);

  async function connect() {
    S.current?.destroy(); T.current?.destroy?.();
    const clock = new RealClock();
    let tr;
    if (kind === "mock") tr = new MockTransport({ clock, flavor, seed: (Date.now() & 0xffff) + 1 });
    else if (kind === "serial") tr = new WebSerialTransport();
    else tr = new BleTransport();
    T.current = tr;
    const sess = new LinkSession({ transport: tr, clock, calib, dryRun: dry });
    S.current = sess; window.__octoLink = { session: sess, transport: tr, support, kind, dry };
    sess.on("state", () => setTick((x) => x + 1));
    if (kind === "mock" && !dry) await new Promise((r) => setTimeout(r, 1300)); // 模拟板子上电自检（SoftHome 约 1.2 s）
    await sess.connect();
    setTick((x) => x + 1);
  }
  async function disconnect() { await S.current?.disconnect(); setTick((x) => x + 1); }
  const run = async (p) => { await p; setTick((x) => x + 1); };

  const d = s?.diff(2000);
  const last = s?.hist.at(-1);
  const now = s?.clock.now() || 0;
  const unsupportedReal = realKind && !dry && !(kind === "serial" ? support.serial : support.ble);
  const setC = (i, k, v) => { const c = sanitizeCalib({ ...calib, servos: calib.servos.map((x, j) => (j === i ? { ...x, [k]: v } : x)) }); setCalib(c); if (S.current) S.current.calib = c; return c; };
  const tryServo = async (i, k, c) => {
    if (!S.current?.ready) return;
    const sv = c.servos[i]; await S.current.trim(i, sv.center, sv.min, sv.max);
    const p = Array(8).fill(0); p[i] = k === "min" ? sv.min : k === "max" ? sv.max : 0; await S.current.pose(p); setTick((x) => x + 1);
  };

  return (
    <fieldset className="flex flex-col gap-1 border border-red-300 p-2" data-testid={tid}>
      <legend className="font-medium">实物连接（v16，我的补充）：浏览器 ⇄ ESP32</legend>
      <p className="rounded bg-amber-50 px-1 text-amber-800">早期原型，简化仿真。这套协议和固件只在编译器和模拟设备上测过，<b>还没有在真机上测过</b>。</p>
      {!support.serial && !support.ble && <p className="rounded bg-red-50 px-1 text-red-800" data-testid={`${tid}-unsupported`}>连真板子：{support.why} 下面的「模拟设备」和「演练」照样能用。</p>}
      <div className="flex flex-wrap items-center gap-1">
        {[["serial", "USB 串口"], ["ble", "蓝牙 BLE"], ["mock", "模拟设备（演示）"]].map(([k, zh]) => (
          <label key={k} className={`flex items-center gap-0.5 rounded border px-1 ${kind === k ? "border-copper bg-copper/10" : "border-line"}`}>
            <input type="radio" name={`${tid}-kind`} checked={kind === k} disabled={st !== "idle"} onChange={() => setKind(k)} data-testid={`${tid}-kind-${k}`} />{zh}
          </label>))}
        {kind === "mock" && <select value={flavor} disabled={st !== "idle"} onChange={(e) => setFlavor(e.target.value)} className="border border-line bg-white" data-testid={`${tid}-flavor`}><option value="ble">像蓝牙（延迟 {MOCK_PRESETS.ble.latencyMs}±{MOCK_PRESETS.ble.jitterMs} ms，丢包 {MOCK_PRESETS.ble.drop * 100}%）</option><option value="serial">像 USB 串口（延迟 {MOCK_PRESETS.serial.latencyMs} ms）</option></select>}
        <label className="flex items-center gap-0.5" title="演练：不打开串口 / 蓝牙，一个字节都不发，指令只喂给仿真孪生"><input type="checkbox" checked={dry} disabled={st !== "idle"} onChange={(e) => setDry(e.target.checked)} data-testid={`${tid}-dry`} />演练（不发送）</label>
      </div>
      {kind === "mock" && <p className="text-[11px] text-ink-soft" data-testid={`${tid}-mock-note`}>模拟设备 = 浏览器里的一块虚拟板子：跑的是同一份固件逻辑（firmware.js 孪生 + OCTL/1），加了延迟、丢包、坏帧、时钟漂移、电池压降和合成的 IMU 晃动（都是估算）。它只用来演示和测试，<b>不代表真机效果</b>。</p>}
      {unsupportedReal && <p className="text-red-700" data-testid={`${tid}-unsupported-kind`}>{support.why || `这个浏览器没有 ${kind === "serial" ? "Web Serial" : "Web Bluetooth"}。`}</p>}
      <div className="flex flex-wrap items-center gap-1">
        {st === "idle" ? <B t={`${tid}-connect`} dis={unsupportedReal} on={() => run(connect())} cls="border-copper bg-copper/10 font-medium">{dry ? "开始演练" : kind === "mock" ? "连接模拟设备" : `选择${kind === "serial" ? "串口" : "蓝牙设备"}并连接`}</B>
          : <B t={`${tid}-disconnect`} on={() => run(disconnect())}>断开</B>}
        <span data-testid={`${tid}-state`} data-state={st} className={live ? "text-emerald-700" : st === "idle" ? "text-ink-soft" : "text-amber-700"}>● {STATE_ZH[st] || st}{s?.dryRun ? "（演练，不发送）" : ""}</span>
        {s?.info && !s.info.dry && <span className="text-ink-soft" data-testid={`${tid}-info`}>{s.info.fw === 10 ? "v10 紧凑版" : s.info.fw === 20 ? "完善版" : `固件 ${s.info.fw}`} · {s.info.channels} 路 · {s.info.imu ? "有 IMU" : "无 IMU"} · OCTL/{s.info.version}</span>}
      </div>
      <button type="button" data-testid={`${tid}-estop`} disabled={st === "idle"} onClick={() => { S.current?.estop(); setTick((x) => x + 1); }}
        className="rounded-lg border-2 border-red-800 bg-red-600 py-3 text-lg font-bold text-white shadow disabled:opacity-40">■ 急停（Esc）：舵机立刻断电</button>
      {s?.estopped && <div className="flex items-center gap-1 text-red-700" data-testid={`${tid}-estopped`}>急停锁定中：运动指令一律不发。<B t={`${tid}-clear-estop`} dis={!live} on={() => run(S.current.clearEstop())}>解除急停（发 STOP）</B></div>}

      <fieldset className="flex flex-col gap-1" disabled={!live}>
        <div className="grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-x-1">
          <span>油门</span><input type="range" min="0" max="1" step="0.05" value={thr} onChange={(e) => setThr(+e.target.value)} data-testid={`${tid}-thr`} /><span>{thr.toFixed(2)}</span>
          <span>转向</span><input type="range" min="-1" max="1" step="0.05" value={steer} onChange={(e) => setSteer(+e.target.value)} data-testid={`${tid}-steer`} /><span>{steer.toFixed(2)}</span>
          <span>限速</span><input type="range" min="30" max="240" step="10" value={rate} onChange={(e) => setRate(+e.target.value)} data-testid={`${tid}-rate`} /><span>{rate}°/s</span>
        </div>
        <div className="flex flex-wrap gap-1">
          <B t={`${tid}-go`} on={() => run(S.current.go(thr, steer))} cls="border-copper">▶ 开始 / 更新速度</B>
          <B t={`${tid}-stop`} on={() => run(S.current.stop())}>停（STOP）</B>
          <B t={`${tid}-send-rate`} on={() => run(S.current.rate(rate))}>发限速</B>
        </div>
        <details data-testid={`${tid}-adv`}><summary className="cursor-pointer text-ink-soft">姿势 / 步态参数</summary>
          <div className="mt-1 grid grid-cols-4 gap-1">{pose.map((v, i) => <label key={i} className="flex flex-col text-[10px]">舵机 {i}：{v}°<input type="range" min="-55" max="55" value={v} onChange={(e) => setPose(pose.map((x, j) => (j === i ? +e.target.value : x)))} data-testid={`${tid}-pose-${i}`} /></label>)}</div>
          <B t={`${tid}-send-pose`} on={() => run(S.current.pose(pose))}>发姿势（POSE，按校准限位裁剪）</B>
          <div className="mt-1 grid grid-cols-[4.5rem_1fr_3rem] items-center gap-x-1">
            {[["freq_hz", "频率 Hz", 0.1, 1.2, 0.05], ["yaw_amp_deg", "摆幅 °", 0, 55, 1], ["lift_amp_deg", "抬幅 °", 0, 55, 1], ["phase_deg", "相位差 °", 0, 360, 5], ["duty", "划水占比", 0.3, 0.9, 0.05], ["press_deg", "下压 °", 0, 40, 1]].map(([k, zh, lo, hi, step]) => [<span key={k + "l"}>{zh}</span>, <input key={k} type="range" min={lo} max={hi} step={step} value={gait[k]} onChange={(e) => setGait({ ...gait, [k]: +e.target.value })} data-testid={`${tid}-gait-${k}`} />, <span key={k + "v"}>{gait[k]}</span>])}
          </div>
          <p className="text-[11px] text-ink-soft">估算峰值角速度 {gaitPeakRate(gait).toFixed(0)} °/s{gaitPeakRate(gait) > SAFETY.rateCap ? `，超过 ${SAFETY.rateCap} °/s，发送时自动降频` : ""}。</p>
          <B t={`${tid}-send-gait`} on={() => run(S.current.gait(gait))}>发步态参数（GAIT）</B>
        </details>
      </fieldset>

      {kind === "mock" && !dry && st !== "idle" && <div className="flex flex-wrap items-center gap-1" data-testid={`${tid}-faults`}><span>注入故障（模拟）：</span>
        <B t={`${tid}-fault-drop`} on={() => T.current.fault("drop", 3000)}>信号丢失 3 s</B>
        <B t={`${tid}-fault-unplug`} on={() => T.current.fault("unplug", 2000)}>{flavor === "ble" ? "蓝牙断开" : "拔 USB"} 2 s</B>
        <B t={`${tid}-fault-brownout`} on={() => T.current.fault("brownout")}>欠压复位</B>
        <B t={`${tid}-fault-freeze`} on={() => T.current.fault("freeze", 2000)}>固件卡死 2 s</B>
      </div>}

      {s && (s.hist.length > 0 || s.dryRun) && <>
        <div className="flex items-center gap-1">看哪一路：<select value={ch} onChange={(e) => setCh(+e.target.value)} className="border border-line bg-white" data-testid={`${tid}-ch`}>{Array.from({ length: 8 }, (_, i) => <option key={i} value={i}>舵机 {i}</option>)}</select></div>
        {s.dryRun ? <p className="text-ink-soft" data-testid={`${tid}-dry-note`}>演练模式没有板子遥测，只显示仿真孪生：模式 {MODES[s.ref?.snapshot().mode] || "—"}，舵机 {ch} = {f(s.ref?.snapshot().a[ch])}°。本来要发的最近几帧：<code className="block break-all text-[10px]" data-testid={`${tid}-dry-frames`}>{s.dry.slice(-4).join("  ")}</code></p>
          : <Chart hist={s.hist} ch={ch} now={now} />}
        {!s.dryRun && d && <table className="w-full font-mono text-[11px]" data-testid={`${tid}-diff`}><tbody>
          <tr><td>角度差（最近 2 s，{d.samples} 帧）</td><td className="text-right" data-testid={`${tid}-diff-rms`}>RMS {f(d.rmsAll, 2)}°</td><td className="text-right">最大 {f(d.maxAll)}°</td></tr>
          <tr><td>舵机 {ch}</td><td className="text-right">RMS {f(d.rms[ch], 2)}°</td><td className="text-right">最大 {f(d.max[ch])}°</td></tr>
          <tr><td>电池（实物 / 仿真）</td><td className="text-right" data-testid={`${tid}-vbat`}>{f(last?.real.vbat, 2)} V</td><td className="text-right">{f(last?.sim?.vbat, 2)} V</td></tr>
          <tr><td>倾斜 横滚 / 俯仰（IMU）</td><td className="text-right">{f(last?.real.roll)}° / {f(last?.real.pitch)}°</td><td className="text-right">差 {f(d.roll)}° / {f(d.pitch)}°</td></tr>
          <tr><td>板子模式 / 运行时间</td><td className="text-right" data-testid={`${tid}-mode`}>{MODES[last?.real.mode] || "—"}{last?.real.relaxed ? "（断电）" : ""}{last?.real.estop ? "（急停）" : ""}{last?.real.lowBatt ? "（电量低）" : ""}</td><td className="text-right">{f((last?.real.up || 0) / 1000)} s</td></tr>
          <tr><td>往返延迟 / 遥测丢帧</td><td className="text-right" data-testid={`${tid}-rtt`}>{f(d.rtt, 0)} ms</td><td className="text-right">{f(d.telLoss * 100)} %</td></tr>
          <tr><td>收 / 发 / 坏帧 / 重发 / 重连</td><td className="text-right" colSpan="2" data-testid={`${tid}-stats`}>{s.stats.rx} / {s.stats.tx} / {s.stats.badRx} / {s.stats.retries} / {s.stats.reconnects}</td></tr>
        </tbody></table>}
      </>}
      {s?.logs.length > 0 && <ul className="max-h-28 overflow-auto border border-line bg-white p-1 text-[10px]" data-testid={`${tid}-log`}>{s.logs.slice(-12).map((e, i) => <li key={i} className={e.level === "error" ? "text-red-700" : e.level === "warn" ? "text-amber-700" : ""}>{(e.t / 1000).toFixed(1)}s {e.text}</li>)}</ul>}

      <details data-testid={`${tid}-calib`}><summary className="cursor-pointer font-medium">舵机校准向导（中位 / 下限 / 上限，存在本浏览器）</summary>
        <ol className="mt-1 flex flex-col gap-0.5 text-[11px]">{WIZARD.map((w) => <li key={w.title}><b>{w.title}</b>：{w.text}</li>)}</ol>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <label>舵机<select value={cch} onChange={(e) => setCch(+e.target.value)} className="ml-0.5 border border-line bg-white" data-testid={`${tid}-calib-ch`}>{calib.servos.map((_, i) => <option key={i} value={i}>{i}</option>)}</select></label>
          <B t={`${tid}-calib-home`} dis={!live} on={() => run(S.current.pose(Array(8).fill(0)))}>全部回中位</B>
          {[["center", -0.5, "中位 −"], ["center", 0.5, "中位 +"], ["min", -2, "下限 −"], ["min", 2, "下限 +"], ["max", -2, "上限 −"], ["max", 2, "上限 +"]].map(([k, dv, zh]) => <B key={zh} t={`${tid}-calib-${k}-${dv > 0 ? "up" : "down"}`} on={() => { const c = setC(cch, k, calib.servos[cch][k] + dv); tryServo(cch, k, c); }}>{zh}</B>)}
        </div>
        <table className="mt-1 w-full font-mono text-[10px]" data-testid={`${tid}-calib-table`}><thead><tr className="text-ink-soft"><th>路</th><th>中位°</th><th>下限°</th><th>上限°</th></tr></thead><tbody>
          {calib.servos.map((x, i) => <tr key={i} className={i === cch ? "bg-copper/10" : ""}><td>{i}</td><td>{f(x.center)}</td><td>{f(x.min)}</td><td>{f(x.max)}</td></tr>)}
        </tbody></table>
        <div className="mt-1 flex flex-wrap gap-1">
          <B t={`${tid}-calib-save`} on={() => setSaved(saveCalib(localStorage, calib) ? "已保存到本浏览器 localStorage" : "保存失败（浏览器禁用了本地存储？）")}>保存</B>
          <B t={`${tid}-calib-send`} dis={!live} on={() => run((async () => { for (let i = 0; i < 8; i++) { const x = calib.servos[i]; await S.current.trim(i, x.center, x.min, x.max); } setSaved("已用 TRIM 发到板子（断电后失效，要长期生效请导出 .h 编进固件）"); })())}>发到板子（TRIM）</B>
          <B t={`${tid}-calib-export`} on={() => { const h = toTrimHeader(calib); window.__octoTrimHeader = h; download("octopus_trim_custom.h", h); }}>导出 octopus_trim_custom.h</B>
          <B t={`${tid}-calib-reset`} on={() => { const c = defaultCalib(8); setCalib(c); if (S.current) S.current.calib = c; }}>恢复默认</B>
        </div>
        {saved && <p className="text-emerald-700" data-testid={`${tid}-calib-msg`}>{saved}</p>}
      </details>
      <details><summary className="cursor-pointer text-ink-soft">协议 OCTL/{PROTO.version}、安全层和限制</summary>
        <ul className="list-disc pl-4 text-[11px] text-ink-soft">
          <li>一行一帧：<code>@序号 指令 参数…*CRC16</code>，CRC-16/CCITT-FALSE（十六进制 4 位），最长 {PROTO.maxLine} 字符，串口 {PROTO.baud} 波特，蓝牙用 Nordic UART 服务（20 字节分包）。完整说明见 README「v16 实物连接」。</li>
          <li>主机：每条指令等应答 {TIMING.ackMs} ms、最多重发 {TIMING.retries} 次；每 {TIMING.pingMs} ms 心跳；{TIMING.lostMs} ms 收不到任何东西就判掉线并自动重连（重连后先发 STOP，不自动恢复动作）。</li>
          <li>板子：{PROTO.watchdogMs} ms 没收到帧就自己停（看门狗）；蓝牙断开立刻停；急停后只认 STOP 解锁；电量低拒绝运动。</li>
          <li>安全层：姿势夹到校准限位和 ±55°；限速 ≤ {SAFETY.rateCap} °/s（标称 300 °/s 的 80 %，估算）；步态估算峰值角速度超限自动降频；拒绝的原因：{Object.values(NAK).slice(4).join("、")}。</li>
          <li>限制：普通舵机没有位置反馈，“实物角度”其实是固件发出的指令角（限速之后）；IMU 倾斜要装 MPU-6050 才有；USB 转串口芯片的开发板打开串口时可能被 DTR/RTS 复位一次；要用电脑上的 Chrome / Edge，网页必须 HTTPS，第一次连接必须点按钮。</li>
        </ul>
      </details>
    </fieldset>
  );
}
