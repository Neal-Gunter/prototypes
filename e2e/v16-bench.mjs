// v16：实物连接走查。① 不支持的浏览器提示 ② 模拟设备：连接 → 走 → 遥测叠加图 + 差值 → 信号丢失 / 拔线 / 欠压 → 自动重连
// ③ 急停（按钮 + Esc）④ 校准向导 → localStorage → 导出 .h → TRIM ⑤ 演练模式一帧不发 ⑥ 真实 Web Serial / Web Bluetooth 代码路径（用假的浏览器 API 桩驱动，不是硬件）
// 用法：npx vite preview --port 4173 & ; node e2e/v16-bench.mjs（BASE / OUT / SHOTS=0 可改）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v16", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv16";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) await p.locator(`[data-testid=${t}]`).screenshot({ path: f }); else await p.screenshot({ path: f }); };
const into = (t) => L((t) => document.querySelector(`[data-testid=${t}]`)?.scrollIntoView({ block: "start", behavior: "instant" }), t);
const st = () => L(() => window.__octoLink?.session?.state);
const dev = () => L(() => { const d = window.__octoLink?.transport?.device; return d && { ...d.snapshot(), estop: d.estop, boots: d.boots, telHz: d.telHz, trim0: d.body().bank_.trim_[0] }; });
const sess = () => L(() => { const s = window.__octoLink.session; return { state: s.state, estopped: s.estopped, stats: { ...s.stats }, diff: s.diff(2000), info: s.info, writes: window.__octoLink.transport.writes }; });
const until = (fn, arg, ms = 15000) => p.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true, () => false);
const click = (t) => p.click(`[data-testid=${t}]`);

await p.goto(BASE + "/assembly?scene=octo"); await p.waitForSelector("[data-testid=octo-panel]"); await p.waitForSelector("[data-testid=link]"); await wait(800);
res.browser = await L(() => ({ secure: isSecureContext, serial: !!navigator.serial, ble: !!navigator.bluetooth, ua: navigator.userAgent }));
ok(res.browser.secure && res.browser.serial, "本机 Chrome（localhost 算安全上下文）有 navigator.serial", JSON.stringify({ ...res.browser, ua: undefined }));
await into("link"); await shot("link-panel", "link");
// ② 模拟设备
await click("link-kind-mock"); await p.selectOption("[data-testid=link-flavor]", "ble"); await click("link-connect");
ok(await until(() => window.__octoLink?.session?.state === "ready", null, 10000), "连接模拟设备（像蓝牙）→ 已连接");
ok(/v10 紧凑版/.test(await p.locator("[data-testid=link-info]").innerText()) && await p.locator("[data-testid=link-mock-note]").count() === 1, "显示 v10 紧凑版 · 8 路，并标明“模拟设备，不代表真机”");
await click("link-go");
ok(await until(() => window.__octoLink.transport.device.snapshot().mode === 1, null, 3000), "点“开始”→ 模拟板子开始走（GO）");
await wait(3500);
let S = await sess(); res.walk = S.diff;
ok(S.diff.samples >= 12 && Number.isFinite(S.diff.rmsAll) && S.diff.rmsAll < 8, `遥测叠加图 + 差值：2 s 内 ${S.diff.samples} 帧，RMS ${S.diff.rmsAll?.toFixed(2)}°，最大 ${S.diff.maxAll?.toFixed(1)}°，RTT ${S.diff.rtt?.toFixed(0)} ms`);
ok((await p.locator("[data-testid=link-chart-sim]").getAttribute("d")).length > 50 && (await p.locator("[data-testid=link-chart-real]").getAttribute("d")).length > 50, "叠加图两条线（仿真孪生 / 板子遥测）都有数据");
ok(/走/.test(await p.locator("[data-testid=link-mode]").innerText()) && /V/.test(await p.locator("[data-testid=link-vbat]").innerText()), "读数：模式“走”、电池电压");
await into("link"); await shot("link-walk", "link");
// 信号丢失
await click("link-fault-drop"); const tDrop = Date.now();
ok(await until(() => ["lost", "reconnecting"].includes(window.__octoLink.session.state), null, 2500), "信号丢失 3 s → 1.2 s 内判定掉线", `${Date.now() - tDrop} ms`);
ok(await until(() => window.__octoLink.transport.device.snapshot().mode === 0, null, 2500), "模拟板子看门狗自己停下（1.5 s）");
await shot("link-lost", "link");
ok(await until(() => window.__octoLink.session.state === "ready", null, 12000), "信号恢复后自动重连", `${((Date.now() - tDrop) / 1000).toFixed(1)} s`);
await wait(800); ok((await dev()).mode === 0, "重连后没有自动恢复走路");
// 急停
await click("link-go"); await until(() => window.__octoLink.transport.device.snapshot().mode === 1, null, 3000);
await click("link-estop");
ok(await until(() => window.__octoLink.transport.device.estop && window.__octoLink.transport.device.body().relaxed_, null, 2000) && await p.locator("[data-testid=link-estopped]").count() === 1, "大红急停 → 模拟板子立刻断电并锁定，面板显示“急停锁定中”");
const b4 = await sess(); await click("link-go"); await wait(600); const af = await sess();
ok(af.stats.blocked > b4.stats.blocked && (await dev()).estop && (await dev()).relaxed, "急停期间点“开始”在主机端被挡下");
await shot("link-estop", "link");
await click("link-clear-estop"); ok(await until(() => !window.__octoLink.session.estopped && !window.__octoLink.transport.device.estop, null, 3000), "解除急停（STOP）");
await click("link-go"); await until(() => window.__octoLink.transport.device.snapshot().mode === 1, null, 3000);
await p.keyboard.press("Escape"); ok(await until(() => window.__octoLink.transport.device.estop, null, 2000), "键盘 Esc 也能急停");
await click("link-clear-estop"); await until(() => !window.__octoLink.session.estopped, null, 3000);
// 拔线 / 欠压
await click("link-go"); await wait(500); await click("link-fault-unplug");
ok(await until(() => window.__octoLink.session.state !== "ready", null, 500), "蓝牙断开事件 → 立刻判掉线");
ok(await until(() => window.__octoLink.transport.device.snapshot().mode === 0, null, 1000), "板子 BLE 断开回调 → 停");
ok(await until(() => window.__octoLink.session.state === "ready", null, 12000), "线回来 → 自动重连");
await click("link-go"); await wait(500); const boots0 = (await dev()).boots; await click("link-fault-brownout");
ok(await until((b0) => window.__octoLink.transport.device.boots > b0 && window.__octoLink.session.stats.boots >= 1, boots0, 4000), "欠压故障 → 模拟板子复位、主机收到 BOOT 9");
ok(await until(() => window.__octoLink.session.state === "ready", null, 15000) && (await dev()).mode === 0, "复位后重建会话，不自动恢复动作");
S = await sess(); res.faults = S.stats;
await shot("link-log", "link-log");
// ④ 校准
await L(() => document.querySelector("[data-testid=link-calib]").open = true); await into("link-calib");
for (let i = 0; i < 3; i++) { await click("link-calib-center-up"); await wait(150); }
await click("link-calib-max-down"); await wait(150);
ok(/1\.5/.test(await p.locator("[data-testid=link-calib-table] tbody tr").first().innerText()), "校准：舵机 0 中位 +0.5° ×3 = 1.5°");
ok(await until(() => Math.abs(window.__octoLink.transport.device.body().bank_.trim_[0] - 1.5) < 1e-6, null, 3000), "调中位时实时发 TRIM：模拟板子舵机 0 偏移 1.5°");
await click("link-calib-save"); const lsv = await L(() => JSON.parse(localStorage.getItem("octo.calib.v1")));
ok(lsv?.servos?.[0]?.center === 1.5 && lsv.servos[0].max === 53, "保存到 localStorage（octo.calib.v1）");
await click("link-calib-export"); const hdr = await L(() => window.__octoTrimHeader || "");
ok(/OCTO_TRIM_CUSTOM 1/.test(hdr) && /1\.5f/.test(hdr) && /53\.0f/.test(hdr), "导出 octopus_trim_custom.h（含 1.5f / 53.0f）");
await shot("link-calib", "link-calib");
await click("link-disconnect"); await until(() => window.__octoLink.session.state === "idle", null, 3000);
await p.reload(); await p.waitForSelector("[data-testid=link]"); await L(() => document.querySelector("[data-testid=link-calib]").open = true);
ok(/1\.5/.test(await p.locator("[data-testid=link-calib-table] tbody tr").first().innerText()), "刷新页面后校准还在");
await L(() => localStorage.removeItem("octo.calib.v1"));
// ⑤ 演练模式
await click("link-kind-mock"); await click("link-dry"); await click("link-connect");
ok(await until(() => window.__octoLink?.session?.state === "ready" && window.__octoLink.session.dryRun, null, 3000), "演练模式：立即“已连接（演练，不发送）”");
await click("link-go"); await wait(1500); await click("link-estop"); await wait(200);
const dr = await L(() => ({ writes: window.__octoLink.transport.writes, open: window.__octoLink.transport.isOpen, tx: window.__octoLink.session.stats.tx, dry: window.__octoLink.session.stats.dryFrames, mode: window.__octoLink.session.ref.snapshot().mode }));
ok(dr.writes === 0 && !dr.open && dr.tx === 0 && dr.dry >= 1, "演练：传输层一个字节没写、也没打开", JSON.stringify(dr));
ok(await p.locator("[data-testid=link-dry-frames]").count() === 1, "演练：面板显示“本来要发的帧”");
await into("link"); await shot("link-dry", "link");
await click("link-disconnect"); await click("link-dry");
// ①  不支持的浏览器
const p2 = await ctx.newPage(); p2.on("pageerror", (e) => errs.push(String(e)));
await p2.addInitScript(() => { Object.defineProperty(Navigator.prototype, "serial", { get: () => undefined }); Object.defineProperty(Navigator.prototype, "bluetooth", { get: () => undefined }); });
await p2.goto(BASE + "/assembly?scene=octo"); await p2.waitForSelector("[data-testid=link]");
const un = await p2.locator("[data-testid=link-unsupported]").innerText().catch(() => "");
await p2.click("[data-testid=link-kind-serial]");
ok(/Chrome|Edge/.test(un) && await p2.locator("[data-testid=link-connect]").isDisabled() && await p2.locator("[data-testid=link-unsupported-kind]").count() === 1, "没有 Web Serial / Bluetooth 的浏览器：明确提示用 Chrome / Edge，串口“连接”按钮禁用", un.slice(0, 60));
await p2.click("[data-testid=link-kind-mock]"); ok(!(await p2.locator("[data-testid=link-connect]").isDisabled()), "同一个浏览器里模拟设备仍然可用");
if (SHOT) await p2.locator("[data-testid=link]").screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-link-unsupported.png` });
await p2.close();
// ⑥ 真实传输层代码：用假的 navigator.serial / navigator.bluetooth 桩（一个极简应答器，不是硬件，也不是固件孪生）
const p3 = await ctx.newPage(); p3.on("pageerror", (e) => errs.push(String(e)));
await p3.addInitScript(() => {
  const crc = (s) => { let c = 0xffff; for (const ch of s) { c ^= ch.charCodeAt(0) << 8; for (let i = 0; i < 8; i++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c.toString(16).toUpperCase().padStart(4, "0"); };
  const seal = (b) => `${b}*${crc(b)}\n`;
  window.__stub = { rx: [], estop: false, go: 0 };
  const responder = (emit) => { let buf = ""; let tel = 0, n = 0; const t0 = Date.now();
    setInterval(() => { if (tel) emit(seal(`@0 TEL ${n++} ${Date.now() - t0} 3.9 - - ${window.__stub.go ? 1 : 0} ${window.__stub.estop ? 9 : 0} 0 0 0 0 0 0 0 0`)); }, 100);
    return (text) => { buf += text; let i; while ((i = buf.indexOf("\n")) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); window.__stub.rx.push(l); const m = /^@(\d+) ([A-Z]+)( [^*]*)?\*/.exec(l); if (!m) continue; const [, s, c, a] = m;
      if (c === "TEL") tel = +a; if (c === "ESTOP") window.__stub.estop = true; if (c === "STOP") { window.__stub.estop = false; window.__stub.go = 0; } if (c === "GO") window.__stub.go = 1;
      emit(seal(c === "HELLO" ? `@${s} OK 1 20 8 8 300 0` : c === "PING" ? `@${s} OK ${Date.now() - t0}` : c === "GO" && window.__stub.estop ? `@${s} NAK 9` : `@${s} OK`)); } }; };
  const enc = new TextEncoder(), dec = new TextDecoder();
  // 串口桩
  let ctrl; const port = { async open(o) { window.__stub.baud = o.baudRate; }, async setSignals() {}, async close() {},
    readable: new ReadableStream({ start(c) { ctrl = c; } }) };
  const feed = responder((t) => { try { ctrl.enqueue(enc.encode(t)); } catch {} });
  port.writable = new WritableStream({ write(chunk) { feed(dec.decode(chunk)); } });
  Object.defineProperty(Navigator.prototype, "serial", { get: () => ({ requestPort: async () => { window.__stub.picked = "serial"; return port; }, addEventListener() {} }) });
  // 蓝牙桩（20 字节分包两头都验证）
  const listeners = []; let notify = null; const chunks = [];
  const txc = { addEventListener: (e, f) => (notify = f), async startNotifications() {} };
  const bfeed = responder((t) => { const bytes = enc.encode(t); for (let i = 0; i < bytes.length; i += 20) { const part = bytes.slice(i, i + 20); setTimeout(() => notify?.({ target: { value: new DataView(part.buffer) } }), 5); } });
  const rxc = { async writeValueWithoutResponse(part) { chunks.push(part.length); window.__stub.maxChunk = Math.max(window.__stub.maxChunk || 0, part.length); bfeed(dec.decode(part)); } };
  const dev = { name: "OctoBrain-STUB", addEventListener: (e, f) => listeners.push(f), gatt: { async connect() { return { async getPrimaryService(u) { window.__stub.svc = u; return { async getCharacteristic(u) { return u.startsWith("6e400002") ? rxc : txc; } }; } }; }, disconnect() { listeners.forEach((f) => f()); } } };
  Object.defineProperty(Navigator.prototype, "bluetooth", { get: () => ({ requestDevice: async (o) => { window.__stub.filters = o; return dev; } }) });
});
await p3.goto(BASE + "/assembly?scene=octo"); await p3.waitForSelector("[data-testid=link]");
for (const kind of ["serial", "ble"]) {
  await p3.click(`[data-testid=link-kind-${kind}]`); await p3.click("[data-testid=link-connect]");
  const okc = await p3.waitForFunction(() => window.__octoLink?.session?.state === "ready", null, { timeout: 6000 }).then(() => true, () => false);
  const info = await p3.locator("[data-testid=link-info]").innerText().catch(() => "");
  await p3.click("[data-testid=link-go]"); await p3.waitForTimeout(600); await p3.click("[data-testid=link-estop]"); await p3.waitForTimeout(400);
  const r = await p3.evaluate(() => ({ rx: window.__stub.rx.map((l) => l.split(" ")[1].replace(/\*.*/, "")), estop: window.__stub.estop, baud: window.__stub.baud, maxChunk: window.__stub.maxChunk, svc: window.__stub.svc, tel: window.__octoLink.session.stats.telRx, bad: window.__octoLink.session.stats.badRx }));
  res[`stub_${kind}`] = r;
  ok(okc && /完善版/.test(info) && ["HELLO", "STOP", "RATE", "TEL", "GO", "ESTOP"].every((c) => r.rx.includes(c)) && r.estop && r.tel > 0 && r.bad === 0 && (kind === "serial" ? r.baud === 115200 : r.maxChunk <= 20 && r.svc === "6e400001-b5a3-f393-e0a9-e50e24dcca9e"),
    `${kind === "serial" ? "Web Serial（115200）" : "Web Bluetooth（NUS，≤ 20 字节分包）"} 代码路径：握手 → GO → 急停都按协议走（假 API 桩，不是硬件）`, JSON.stringify({ ...r, rx: [...new Set(r.rx)].join(",") }));
  await p3.click("[data-testid=link-disconnect]"); await p3.waitForTimeout(300); await p3.evaluate(() => { window.__stub.rx = []; window.__stub.estop = false; });
}
await p3.close();
ok(!errs.length, "没有页面错误", errs.join(" | "));
fs.writeFileSync(`${OUT}/logs/v16-bench-results.json`, JSON.stringify(res, null, 1));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).map((f) => ({ f, s: fs.statSync(`${VID}/${f}`).size })).sort((a, b) => b.s - a.s)[0]?.f;
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.5*PTS,scale=1280:-2,fps=24" -an -c:v libx264 -crf 32 -preset veryfast -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
}
console.log(`\nv16 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
