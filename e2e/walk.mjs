// 无头浏览器走查：搭建模式 + 维修模式。截图写到 $OUT（默认 ./e2e-shots）
// 运行：npm run build && npx vite preview --port 4173 &  然后  CHROME=/usr/bin/google-chrome node e2e/walk.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const OUT = process.env.OUT || "./e2e-shots";
const VIDEO = process.env.VIDEO || "/tmp/pwvideo";
const BASE = process.env.BASE || "http://localhost:4173";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: VIDEO, size: { width: 1280, height: 889 } } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(e.message));
p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
let n = 0;
const shot = async (name, opts = {}) => {
  n++;
  const f = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`;
  await p.screenshot({ path: f, ...opts });
  console.log("shot", f);
};
const W = (fn, arg) => p.evaluate(fn, arg);
const st = () => W(() => {
  const s = window.__wb.state();
  return { tool: s.tool, joints: s.joints, wires: s.wires, screws: s.screws, fw: s.fw, meter: s.meter, repair: s.repair, toast: s.toast, movedOnce: s.movedOnce, usb: s.usb };
});
const wait = (ms) => p.waitForTimeout(ms);
const until = async (fn, arg, ms = 10000, what = "条件") => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await W(fn, arg)) return true;
    await wait(60);
  }
  throw new Error("超时：" + what);
};
const pinXY = async (id) => {
  const s = await W((id) => window.__wb.pinScreen(id), id);
  if (!s) throw new Error("no pin " + id);
  return s;
};
const objXY = async (name) => {
  const s = await W((n) => window.__wb.objScreen(n), name);
  if (!s) throw new Error("no obj " + name);
  return s;
};
const clickAt = async (s) => {
  await p.mouse.move(s.x, s.y, { steps: 8 });
  await p.mouse.down();
  await p.mouse.up();
  await wait(250);
};
const clickPin = async (id) => clickAt(await pinXY(id));
const tool = async (id) => {
  await p.click(`[data-toolbar=${id}]`);
  await wait(150);
};
const cam = async (name) => {
  await p.click(`[data-cam=${name}]`);
  await benchTop();
  await wait(900);
};
const joint = async (id) => W((id) => window.__wb.state().joints[id]?.state ?? "none", id);
const toast = async () => W(() => window.__wb.state().toast?.msg || window.__wb.state().toast?.text || "");

// 烙铁：按住焊盘 → 看温度到润湿温度 → 按住空格送锡 → 松开空格再停一下 → 抬起
const solder = async (id, { vol = 0.9 } = {}) => {
  if ((await st()).tool !== "iron") await tool("iron");
  // 焊盘上原来有锡：要再送一点锡（锡丝里的松香）才能重新润湿
  const had = await W((id) => window.__wb.state().joints[id]?.vol ?? 0, id);
  if (had > 0.1) vol = Math.max(vol, had + 0.2);
  const s = await pinXY(id);
  await p.mouse.move(s.x, s.y, { steps: 8 });
  await p.mouse.down();
  await until(() => (window.__wb.sim().op?.T ?? 0) >= 250, null, 12000, `${id} 升温`);
  await p.keyboard.down("Space");
  await until((v) => (window.__wb.sim().op?.vol ?? 0) >= v, vol, 12000, `${id} 送锡`);
  await p.keyboard.up("Space");
  await wait(450);
  await p.mouse.up();
  await wait(300);
  const j = await joint(id);
  console.log("solder", id, "→", j, "|", await toast());
  return j;
};
// 吸锡带：压在焊点上直到锡被吸干
const wick = async (id) => {
  await tool("wick");
  const s = await pinXY(id);
  await p.mouse.move(s.x, s.y, { steps: 8 });
  await p.mouse.down();
  await until(() => (window.__wb.sim().op?.vol ?? 1) <= 0.04, null, 15000, `${id} 吸锡`);
  await wait(150);
  await p.mouse.up();
  await wait(300);
  console.log("wick", id, "→", await joint(id), "|", await toast());
};
const strip = async (wid) => {
  await tool("strip");
  const s = await W((id) => window.__wb.wireScreen(id), wid);
  await clickAt(s);
  console.log("strip", wid, "|", await toast());
};
const screw = async (sid, idx) => {
  await tool("screw");
  const s = await objXY(`screw:${sid}:${idx}`);
  await p.mouse.move(s.x, s.y, { steps: 8 });
  await p.mouse.down();
  await until(([sid, idx]) => (window.__wb.sim().screwOp ? false : (window.__wb.state().screws[sid]?.[idx] ?? 0) >= 1), [sid, idx], 10000, "拧螺丝");
  await p.mouse.up();
  await wait(200);
};
const probe = async (red, black) => {
  await clickPin(red);
  await clickPin(black);
  await wait(300);
  const m = (await st()).meter;
  console.log("meter", m.mode, red, black, "→", JSON.stringify(m.reading && { text: m.reading.text, unit: m.reading.unit, beep: m.reading.beep, floating: m.reading.floating }));
  return m.reading;
};
const benchTop = async () => {
  await W(() => {
    const el = document.querySelector("[data-toolbar=select]") || document.querySelector("[data-testid=bench]");
    window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 60);
  });
  await wait(400);
};
const lastWire = async () => (await st()).wires.at(-1).id;

// ===================== 1. 首页 → 工作台 =====================
await p.goto(BASE + "/");
await wait(800);
await shot("landing");
await p.click("[data-testid=cta-workbench]");
await p.waitForSelector("[data-testid=bench] canvas");
await wait(3500);
await benchTop();
await shot("workbench-empty");

if (!process.env.ONLY_REPAIR) {
// ===================== 2. 搭建模式：放零件 =====================
const bench = p.locator("[data-testid=bench]");
const box = await bench.boundingBox();
const drop = async (type, x, z) => {
  const s = await W(([x, z]) => window.__wb.plateScreen(x, z), [x, z]);
  await p.locator(`[data-part=${type}]`).dragTo(bench, { targetPosition: { x: s.x - box.x, y: s.y - box.y } });
  await wait(500);
};
await drop("esp32", 3, 3.5);
await drop("servo", -7, -4.5);
await drop("battery", -7.5, 4.5);
await p.keyboard.press("Escape");
await wait(500);
await shot("parts-placed");

// ===================== 3. 剪线、剥线 =====================
await tool("wire");
await clickPin("servo1.SIG");
await clickPin("esp32.5");
await clickPin("servo1.VCC");
await clickPin("battery.+");
await clickPin("servo1.GND");
await clickPin("battery.-");
await clickPin("esp32.GND");
await clickPin("battery.-");
await wait(400);
await shot("wired-unstripped");
// 先故意用 22 AWG 的孔剥：剥不下来
await tool("strip");
await p.click("[data-gauge='22']");
const wids = (await st()).wires.map((w) => w.id);
await strip(wids[0]);
await p.click("[data-gauge='24']");
await wait(150);
for (const w of wids) await strip(w);
await cam("board");
await shot("stripped-closeup");
await cam("overview");

// ===================== 4. 焊接 =====================
// 先演示一次“没送锡”：烙铁碰一下就走
await tool("iron");
await clickPin("esp32.5");
console.log("tap →", await toast());
const order = ["esp32.5", "esp32.GND", "servo1.SIG", "servo1.VCC", "servo1.GND", "battery.+", "battery.-"];
// 拍一张“正在焊”的特写
await W(() => window.__wb.preset("board"));
await wait(1100);
{
  const s = await pinXY("esp32.5");
  await p.mouse.move(s.x, s.y, { steps: 8 });
  await p.mouse.down();
  await until(() => (window.__wb.sim().op?.T ?? 0) >= 250, null, 12000, "升温");
  await p.keyboard.down("Space");
  await wait(250);
  await shot("soldering-live");
  await until(() => (window.__wb.sim().op?.vol ?? 0) >= 0.9, null, 12000, "送锡");
  await p.keyboard.up("Space");
  await wait(450);
  await p.mouse.up();
  await wait(300);
  console.log("solder esp32.5 →", await joint("esp32.5"));
}
await solder("esp32.GND");
await shot("joints-board");
await cam("overview");
for (const id of order.slice(2)) await solder(id);
const bad = [];
for (const id of order) if ((await joint(id)) !== "good") bad.push(id);
if (bad.length) console.log("NOT GOOD:", bad);

// ===================== 5. 拧螺丝 =====================
await cam("servo");
await screw("servo1", 0);
await screw("servo1", 1);
await shot("screwed");
await cam("overview");

// ===================== 6. 插 USB、烧录、看它动 =====================
await clickAt(await objXY("usb:plug"));
console.log("usb", (await st()).usb, await toast());
await wait(500);
await p.locator("[data-testid=flash]").scrollIntoViewIfNeeded();
await p.click("[data-testid=flash]");
await wait(900);
await benchTop();
await shot("flashing");
await until(() => window.__wb.state().fw.status === "running", null, 20000, "固件运行");
await wait(3000);
const ang1 = await W(() => window.__wb.servoAngle("servo1"));
await wait(700);
const ang2 = await W(() => window.__wb.servoAngle("servo1"));
console.log("build servo angle", ang1, ang2, "movedOnce", (await st()).movedOnce);
await shot("build-running-plotter");
await benchTop();
await shot("build-running-bench");

}

// ===================== 7. 维修模式 =====================
await p.click("[data-mode=repair]");
await wait(2500);
await benchTop();
await shot("repair-start");

// 7a. 先目视：放大镜看三个舵机焊点
await tool("select");
await cam("servo");
for (const id of ["servo1.SIG", "servo1.VCC", "servo1.GND"]) {
  await clickPin(id);
  console.log("inspect", id, "→", await W(() => window.__wb.state().inspect?.text));
}
await shot("repair-inspect-cold");
await cam("overview");

// 7b. 万用表：点 3D 万用表拿起表笔，转旋钮到通断档
await tool("meter");
await cam("meter");
await clickAt(await objXY("meter:dial")); // 旋钮转一格
console.log("meter mode after dial", (await st()).meter.mode);
await p.click("[data-meter-mode=cont]");
await shot("meter-closeup");
await cam("overview");
await probe("servo1.VCC", "battery.+");
await shot("repair-meter-vcc-open");
await probe("servo1.SIG", "esp32.6");
await probe("esp32.GND", "battery.-");
await p.click("[data-meter-mode=dcv]");
await probe("servo1.VCC", "servo1.GND");
await shot("repair-meter");
await p.click("[data-probes-clear]");
console.log("found", JSON.stringify((await st()).repair.found));

// 7c. 虚焊：重熔（加一点锡，锡丝里有松香）
await cam("servo");
await solder("servo1.VCC");
await shot("repair-reflowed");

// 7d. 信号线接错：用吸锡带把 GPIO6 的锡吸掉，线头挪到 GPIO5，再焊
await cam("board");
await wick("esp32.6");
await shot("repair-desoldered");
await tool("wire");
await clickPin("esp32.6"); // 拿起松开的线头
await clickPin("esp32.5");
await solder("esp32.5");
await shot("repair-sig-moved");

// 7e. 缺共地：补一根线，剥线，两头焊
await cam("overview");
await tool("wire");
await clickPin("esp32.GND");
await clickPin("battery.-");
await strip(await lastWire());
await solder("esp32.GND");
await solder("battery.-");
console.log("joints", JSON.stringify(Object.fromEntries(Object.entries((await st()).joints).map(([k, v]) => [k, v.state]))));

// 7f. 固定舵机、烧录
await cam("servo");
await screw("servo1", 0);
await screw("servo1", 1);
await cam("overview");
await p.click("[data-testid=flash]");
await until(() => window.__wb.state().fw.status === "running", null, 20000, "固件运行");
await until(() => !!window.__wb.state().repair.done, null, 15000, "维修完成");
await wait(1500);
const rp = (await st()).repair;
console.log("repair done", JSON.stringify(rp.done), "penalties", JSON.stringify(rp.penalties));
const a1 = await W(() => window.__wb.servoAngle("servo1"));
await wait(800);
const a2 = await W(() => window.__wb.servoAngle("servo1"));
console.log("repair servo angle", a1, a2);
await benchTop();
await wait(800);
await shot("repair-done");
await p.locator("[data-testid=robot]").screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-tentacle-a.png` });
await wait(900);
await p.locator("[data-testid=robot]").screenshot({ path: `${OUT}/${String(++n).padStart(2, "0")}-tentacle-b.png` });
await W(() => window.__wb.camera([0, 13, 15], [-4, 0, -3]));
await wait(1500);
await shot("repair-bench-closeup");

// ===================== 8. 素材与许可 =====================
await p.goto(BASE + "/credits");
await wait(800);
await shot("credits", { fullPage: true });

console.log("ERRORS", errs.length ? errs : "none");
await ctx.close();
await b.close();
