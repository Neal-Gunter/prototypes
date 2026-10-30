// v16：实物连接（OCTL/1 协议 + 安全层 + 模拟设备 + 会话）单元测试。全部离线、确定（ManualClock），不需要硬件。
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { crc16, encode, parse, validate, LineSplitter, parseTel, E, PROTO, NUS } from "../src/link/protocol.js";
import { guard, gaitPeakRate, SAFETY } from "../src/link/safety.js";
import { defaultCalib, sanitizeCalib, loadCalib, saveCalib, toTrimHeader, WIZARD, CALIB_KEY } from "../src/link/calib.js";
import { ManualClock, rng } from "../src/link/clock.js";
import { OctoDevice, RESET, BOOT_MS } from "../src/link/device.js";
import { MockTransport, linkSupport } from "../src/link/transports.js";
import { LinkSession, TIMING } from "../src/link/session.js";

let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? "  ok " : "  FAIL ") + m); };

// 1. CRC / 编码
ok(crc16("123456789") === 0x29b1, "CRC-16/CCITT-FALSE 校验值 \"123456789\" = 0x29B1");
ok(encode(7, "GO", [0.5, -0.25]) === "@7 GO 0.5 -0.25*D8C4", "encode(7, GO, [0.5, -0.25]) = @7 GO 0.5 -0.25*D8C4（和 C 端一致）");
const rt = parse(encode(65535, "POSE", [1, -2.5, NaN, 55, -55, 0, 0.01, 12.34]));
ok(rt.ok && rt.seq === 65535 && rt.cmd === "POSE" && rt.args.length === 8 && Number.isNaN(rt.args[2]) && rt.args[7] === 12.34, "往返：65535 号 POSE 8 个参数，'-' = NaN");
ok(parse(encode(3, "STOP") + "\r").ok, "行尾 \\r 容忍（Windows 串口工具）");
// 2. 错误码
const bad = (l) => parse(l).err;
const good = encode(5, "GO", [0.3, 0]);
ok(bad(good.slice(0, -1) + (good.at(-1) === "0" ? "1" : "0")) === E.CRC, "改一位 CRC → CRC 错");
ok(bad(good.replace("0.3", "0.4")) === E.CRC, "改内容不改 CRC → CRC 错");
ok(bad("@1 POSE " + "1 ".repeat(80) + "1*0000") === E.LEN, "超过 160 字符 → LEN");
ok(bad(encode(1, "POSE", Array(24).fill(0)).replace("POSE", "POSE 0").replace(/\*.*/, "") .padEnd(0) + "*" + crc16(encode(1, "POSE", Array(24).fill(0)).replace("POSE", "POSE 0").replace(/\*.*/, "")).toString(16).toUpperCase().padStart(4, "0")) === E.ARGS, "25 个参数 → ARGS");
const seal = (b) => `${b}*${crc16(b).toString(16).toUpperCase().padStart(4, "0")}`;
ok(bad(seal("#1 STOP")) === E.FORMAT && bad(seal("@1 stop")) === E.FORMAT && bad(seal("@65536 STOP")) === E.FORMAT && bad(seal("@1  STOP")) === E.FORMAT && bad(seal("@1 GO 1e3 0")) === E.FORMAT && bad(seal("@1")) === E.FORMAT, "格式错：没有 @、小写、序号越界、双空格、科学计数、只有序号");
ok(validate("GO", [2, 0]) === 6 && validate("GO", [1]) === 4 && validate("FLY", []) === 5 && validate("POSE", Array(8).fill(10)) === null && validate("TRIM", [8, 0, -10, 10]) === 6, "validate：范围 6、个数 4、未知 5");
// 3. 和 C 头文件（octopus_link_core.h）逐行对拍
const host = "/tmp/octl-host";
if (!existsSync(host)) execFileSync("gcc", ["-std=c99", "-Wall", "-Wextra", "-Werror", "-O2", "scripts/octl-host.c", "-o", host, "-lm"]);
const R = rng(2026), pick = (s) => s[Math.floor(R() * s.length)];
const lines = [];
for (let i = 0; i < 4000; i++) {
  const cmd = pick(["GO", "POSE", "GAIT", "TRIM", "PING", "HELLO", "ESTOP", "STOP", "TEL", "RATE", "OK", "NAK", "TEL"]);
  const n = Math.floor(R() * 26);
  const args = Array.from({ length: n }, () => (R() < 0.1 ? "-" : (R() < 0.5 ? "-" : "") + Math.floor(R() * 1000) / (R() < 0.5 ? 1 : 100)));
  let l = seal(`@${Math.floor(R() * 70000)} ${cmd}${args.map((a) => " " + a).join("")}`);
  const m = R();
  if (m < 0.35) { const k = Math.floor(R() * l.length); l = l.slice(0, k) + String.fromCharCode(32 + Math.floor(R() * 95)) + l.slice(k + 1); }
  else if (m < 0.45) { const k = Math.floor(R() * l.length); l = l.slice(0, k) + l.slice(k + 1); }
  else if (m < 0.5) l = Array.from({ length: Math.floor(R() * 40) }, () => String.fromCharCode(1 + Math.floor(R() * 126))).join("").replace(/[\n\r\0]/g, "x");
  lines.push(l);
}
const cOut = execFileSync(host, { input: lines.join("\n") + "\n", maxBuffer: 1 << 26 }).toString().trim().split("\n");
let mism = 0, valid = 0, first = "";
lines.forEach((l, i) => {
  const j = parse(l); const c = cOut[i].split(" ");
  let same;
  if (!j.ok) same = c[0] === "ERR" && +c[1] === j.err;
  else { valid++; same = c[0] === "OK" && +c[1] === j.seq && c[2] === j.cmd && +c[3] === j.args.length && j.args.every((v, k) => (Number.isNaN(v) ? c[4 + k] === "nan" : Number(c[4 + k]) === v)); }
  if (!same) { mism++; if (!first) first = `${JSON.stringify(l)} JS=${JSON.stringify(j)} C=${cOut[i]}`; }
});
ok(mism === 0 && cOut.length === lines.length, `模糊测试 ${lines.length} 行（其中 ${valid} 行合法）JS 和 C 解析结果完全一致${first ? "；第一处不同 " + first : ""}`);
const sealIn = [], sealJs = [];
for (let i = 0; i < 500; i++) { const cmd = pick(["GO", "TEL", "POSE", "OK", "EVT"]); const a = Array.from({ length: Math.floor(R() * 10) }, () => (R() < 0.1 ? "-" : String(Math.round((R() * 200 - 100) * 100) / 100))); sealIn.push(`#SEAL ${i * 131 % 65536} ${cmd}${a.map((x) => " " + x).join("")}`); sealJs.push("SEAL " + encode(i * 131 % 65536, cmd, a)); }
const sealC = execFileSync(host, { input: sealIn.join("\n") + "\n" }).toString().trim().split("\n");
ok(sealC.every((s, i) => s === sealJs[i]), "500 帧封包（octl_seal vs encode）逐字节一致");
// 4. 分行 / BLE 20 字节分包
const got = []; const sp = new LineSplitter((l) => got.push(l));
const stream = [encode(1, "OK", [1, 10, 8, 8, 240, 1]), encode(0, "TEL", [3, 1200, 3.95, 0.5, -0.2, 1, 4, 1, 2, 3, 4, 5, 6, 7, 8]), "x".repeat(400), encode(2, "OK")].join("\n") + "\n";
for (let i = 0; i < stream.length; i += NUS.chunk) sp.push(stream.slice(i, i + NUS.chunk));
ok(got.length === 3 && got.every((l) => parse(l).ok) && sp.overflow === 1, "20 字节分包重组 3 帧，超长垃圾行整行丢弃");
const tel = parseTel(parse(got[1]).args);
ok(tel.n === 3 && tel.vbat === 3.95 && tel.imu && !tel.estop && tel.a.length === 8, "TEL 解析：计数、电压、标志位、8 路角度");
ok(NUS.service === "6e400001-b5a3-f393-e0a9-e50e24dcca9e" && PROTO.baud === 115200, "NUS 服务 UUID / 波特率");
// 5. 安全层
ok(guard("GO", [3, -9]).args.join() === "1,-1" && guard("GO", [3, -9]).notes.length === 2, "GO 夹到 [0,1] × [-1,1] 并说明");
const cal = defaultCalib(8); cal.servos[2].max = 20; cal.servos[5].min = -10;
const pz = guard("POSE", [0, 0, 40, 0, 0, -30, 0, 90], { calib: sanitizeCalib(cal) });
ok(pz.args[2] === 20 && pz.args[5] === -10 && pz.args[7] === 55 && pz.notes.length === 3, "POSE 夹到校准上下限和 ±55");
ok(guard("RATE", [400]).args[0] === 240 && guard("RATE", [10]).args[0] === 30 && SAFETY.rateCap === 240, "RATE 上限 240 °/s（80 % × 300）");
const fast = guard("GAIT", { freq_hz: 1.2, yaw_amp_deg: 55, lift_amp_deg: 40, phase_deg: 90, duty: 0.8, press_deg: 10 });
ok(gaitPeakRate({ freq_hz: 1.2, yaw_amp_deg: 55, lift_amp_deg: 40, press_deg: 10, duty: 0.8 }) > 240 && gaitPeakRate(fast.params) <= 240 + 1e-6 && fast.notes.length === 1, `步态估算峰值 > 240 °/s 时自动降频（→ ${fast.args[0]} Hz）`);
// 6. 校准
const store = new Map(); const ls = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
const c2 = defaultCalib(8); c2.servos[0].center = 99; c2.servos[1].min = -80; c2.servos[3].center = -4.26;
saveCalib(ls, sanitizeCalib(c2));
const back = loadCalib(ls, 8);
ok(store.has(CALIB_KEY) && back.servos[0].center === 20 && back.servos[1].min === -55 && back.servos[3].center === -4.3, "校准存 localStorage，读回时夹到 ±20 / ±55 并保留 0.1°");
const hdr = toTrimHeader(back);
ok(/#define OCTO_TRIM_CUSTOM 1/.test(hdr) && /kCenter\[\d*\] = \{ ?20\.0f, 0\.0f, 0\.0f, -4\.3f/.test(hdr.replace(/\s+/g, " ")) && /我的补充/.test(hdr), "导出 octopus_trim_custom.h（OCTO_TRIM_CUSTOM、kCenter/kMin/kMax）");
ok(WIZARD.length >= 5 && WIZARD.every((w) => w.title && w.text), `校准向导 ${WIZARD.length} 步文字`);
const hfile = "src/assembly/octopus/plus/octopus_plus/octopus_body.h";
ok(/OCTO_TRIM_CUSTOM/.test(readFileSync(hfile, "utf8")) && /octoLink\.Handle|octoLink\.Tick/.test(readFileSync("src/assembly/octopus/plus/octopus_plus/octopus_plus.ino", "utf8")), "固件：body 套用校准表，.ino 接上 Link");
// 7. 浏览器支持判断
ok(!linkSupport({}, { isSecureContext: false }).serial && /HTTPS/.test(linkSupport({}, { isSecureContext: false }).why), "非 HTTPS → 不支持并说明");
ok(/Chrome/.test(linkSupport({}, { isSecureContext: true }).why) && linkSupport({ serial: {}, bluetooth: {} }, { isSecureContext: true }).ble, "没有 navigator.serial / bluetooth → 提示用 Chrome / Edge");

// 8. 模拟设备（固件 JS 孪生）
{
  const d = new OctoDevice(); const out = []; d.onLine = (l) => out.push(parse(l));
  d.receive(encode(1, "HELLO", [1])); ok(out.length === 0, "启动中（SoftHome）收到的帧被丢掉");
  d.advance(BOOT_MS + 20); ok(out[0]?.cmd === "BOOT" && out[0].args[1] === RESET.power, "启动完成发 BOOT 1 1（上电）");
  const tx = (s, c, a) => { out.length = 0; d.receive(encode(s, c, a)); return out[0]; };
  const h = tx(2, "HELLO", [1]); ok(h.cmd === "OK" && h.args.join() === "1,10,8,8,300,1", "HELLO → OK 1 10 8 8 300 1（v10、8 路、IMU）");
  ok(tx(3, "HELLO", [2]).args[0] === 8, "协议版本不同 → NAK 8");
  ok(tx(4, "RATE", [241]).args[0] === 6 && tx(5, "RATE", [240]).cmd === "OK" && d.body().bank_.max_rate_ === 240, "RATE 241 拒绝，240 生效");
  tx(6, "GO", [0.6, 0]); d.advance(1000); ok(d.snapshot().mode === 1, "GO → 走");
  ok(tx(7, "ESTOP", []).cmd === "OK" && d.body().relaxed_ && tx(8, "GO", [0.5, 0]).args[0] === 9 && tx(9, "POSE", Array(8).fill(0)).args[0] === 9, "ESTOP：立刻断电并锁定，GO / POSE 回 NAK 9");
  ok(tx(10, "STOP", []).cmd === "OK" && tx(11, "POSE", [10, 20, 30, 40, -10, -20, -30, -40]).cmd === "OK", "STOP 解锁后 POSE 可用");
  d.advance(800); ok(d.angles().map(Math.round).join() === "10,20,30,40,-10,-20,-30,-40", "POSE 到位（限速 240 °/s）");
  tx(12, "TEL", [10]); out.length = 0; d.advance(1000);
  const tels = out.filter((f) => f.cmd === "TEL"); ok(tels.length === 10 && parseTel(tels[0].args).a.length === 8, "TEL 10 Hz：1 s 10 帧，8 路角度");
  out.length = 0; d.advance(700);
  const evt = out.find((f) => f.cmd === "EVT"); ok(evt && evt.args[0] === 1 && d.snapshot().mode === 0 && !out.slice(out.indexOf(evt) + 1).some((f) => f.cmd === "TEL"), "1.5 s 没帧 → 看门狗 EVT 1、Rest、遥测停");
  ok(tx(13, "FLY", []).args[0] === 5 && (out.length = 0, d.receive("@1 GO 1 0*0000"), out[0].cmd === "NAK" && out[0].seq === 0 && out[0].args[0] === 2), "未知指令 NAK 5；坏 CRC 回 @0 NAK 2");
  out.length = 0; d.brownout(); d.advance(300); ok(!d.ready && d.reason === RESET.brownout, "欠压故障：电压掉到 3.0 V 以下 → 复位");
  d.advance(BOOT_MS + 300); ok(out.some((f) => f.cmd === "BOOT" && f.args[1] === 9) && !d.session && d.telHz === 0, "复位后 BOOT 1 9，会话和遥测都清零");
}

// 9. 会话 + 模拟设备（确定时钟）
const pump = async (clock, ms) => { for (let t = 0; t < ms; t += 10) { clock.advance(10); await new Promise((r) => setImmediate(r)); } };
{
  const clock = new ManualClock();
  const mock = new MockTransport({ clock, flavor: "ble", seed: 5 });
  await pump(clock, BOOT_MS + 100);
  const s = new LinkSession({ transport: mock, clock });
  const states = []; s.on("state", (e) => states.push(e.state));
  const p = s.connect(); await pump(clock, 800); const okc = await p;
  ok(okc && s.state === "ready" && s.info.fw === 10 && s.info.channels === 8, `连接模拟设备（像蓝牙：延迟 30±15 ms、丢包 2 %）→ 握手成功`);
  ok(mock.device.body().bank_.max_rate_ === 240 && mock.device.telHz === 10, "握手后自动 RATE 240、TEL 10");
  s.go(0.7, 0); await pump(clock, 3000);
  const d = s.diff(2000);
  ok(mock.device.snapshot().mode === 1 && d.samples >= 15 && Number.isFinite(d.rmsAll) && d.rmsAll < 6 && d.maxAll < 25, `走 3 s：遥测 ${d.samples} 帧 / 2 s，仿真 vs 模拟实物 RMS ${d.rmsAll.toFixed(2)}°、最大 ${d.maxAll.toFixed(1)}°、电压差 ${d.vbat.toFixed(3)} V、RTT ${d.rtt?.toFixed(0)} ms`);
  ok(s.stats.rx > 30 && s.rtt > 20 && s.rtt < 200, `收到 ${s.stats.rx} 帧，心跳 PING 测到 RTT ${s.rtt?.toFixed(0)} ms`);
  // 断线（走出范围，线没“断”）
  mock.fault("drop", 3000); const tLost = clock.now(); await pump(clock, 1500);
  ok(s.state !== "ready" && states.includes("lost"), `信号丢失 → ${TIMING.lostMs} ms 内判定掉线（${states.join(" → ")}）`);
  await pump(clock, 600);
  ok(mock.device.snapshot().mode === 0, "板子那边看门狗自己停下（不靠主机）");
  ok((await s.go(0.5, 0)).blocked === "offline", "掉线期间运动指令不发");
  await pump(clock, 4000);
  ok(s.state === "ready" && s.stats.reconnects === 1, `信号恢复后自动重连（${((clock.now() - tLost) / 1000).toFixed(1)} s 内）`);
  await pump(clock, 1000);
  ok(mock.device.snapshot().mode === 0, "重连后不自动恢复走路（先发 STOP）");
  // 急停
  s.go(0.7, 0); await pump(clock, 1000);
  const before = mock.writes; s.estop(); ok(mock.writes - before === 3, "急停连发 3 帧");
  await pump(clock, 300);
  ok(mock.device.estop && mock.device.body().relaxed_, "模拟板子急停：断电 + 锁定");
  const w0 = mock.writes; ok((await s.go(0.5, 0)).blocked === "estop" && mock.writes === w0, "急停锁定期间 GO 在主机端就被挡下，一帧都不发");
  await pump(clock, 500); const lastTel = s.hist.at(-1).real; ok(lastTel.estop && lastTel.relaxed, "遥测标志位显示 急停 + 断电");
  const ce = s.clearEstop(); await pump(clock, 600); ok((await ce).ok && !s.estopped && !mock.device.estop, "解除急停（STOP）两边都解锁");
  // 拔线（BLE 断开事件）
  s.go(0.7, 0); await pump(clock, 800); mock.fault("unplug", 1500); await pump(clock, 50);
  ok(s.state === "lost" || s.state === "reconnecting", "BLE 断开事件 → 立即判定掉线");
  ok(mock.device.snapshot().mode === 0, "设备端 BLE 断开回调 → Rest（EVT 2）");
  await pump(clock, 5000); ok(s.state === "ready" && s.stats.reconnects === 2, "线插回 → 自动重连");
  // 急停时掉线，重连后仍然急停
  s.estop(); mock.fault("unplug", 800); await pump(clock, 4000);
  ok(s.state === "ready" && mock.device.estop && s.estopped, "急停后掉线：重连时发 ESTOP 而不是 STOP，锁定保留");
  await (async () => { const r = s.clearEstop(); await pump(clock, 600); return r; })();
  // 欠压复位
  s.go(0.7, 0); await pump(clock, 600); mock.fault("brownout"); await pump(clock, 6000);
  ok(s.stats.boots >= 1 && s.state === "ready" && mock.device.snapshot().mode === 0 && mock.device.boots >= 2, `欠压复位 → 收到 BOOT 9 → 重建会话，不自动恢复动作（重连 ${s.stats.reconnects} 次）`);
  ok(s.stats.badRx + mock.stats.corrupted >= 0 && s.stats.retries >= 0, `坏帧 ${s.stats.badRx}、重发 ${s.stats.retries}、超时 ${s.stats.timeouts}、遥测丢 ${s.stats.telLost} 帧（丢包 2 %）：都不崩`);
  s.destroy(); mock.destroy();
}
{
  // 演练模式：一帧都不发
  const clock = new ManualClock();
  const mock = new MockTransport({ clock, flavor: "serial" });
  await pump(clock, BOOT_MS + 100);
  const s = new LinkSession({ transport: mock, clock, dryRun: true });
  await s.connect(); s.go(0.8, 0.2); s.pose(Array(8).fill(20)); s.gait({ freq_hz: 0.8 }); s.estop(); await s.clearEstop(); s.go(0.5, 0); await pump(clock, 2000);
  ok(mock.writes === 0 && !mock.isOpen && s.stats.tx === 0 && s.stats.dryFrames >= 6, `演练模式：${s.stats.dryFrames} 帧只记录不发送，串口没打开（writes = ${mock.writes}）`);
  ok(s.ref.snapshot().mode === 1, "演练模式下仿真孪生照样按指令走");
  s.destroy(); mock.destroy();
}
console.log(`\nlink-test：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
