import { chromium } from "playwright";
const OUT = process.env.OUT || "./e2e-shots";
const BASE = "http://localhost:4173";
const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir: "/tmp/pwvideo", size: { width: 1440, height: 1000 } } });
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
const pin = async (id) => {
  const s = await p.evaluate((id) => window.__wb.pinScreen(id), id);
  if (!s) throw new Error("no pin " + id);
  return s;
};
const clickPin = async (id) => {
  const s = await pin(id);
  await p.mouse.move(s.x, s.y, { steps: 6 });
  await p.mouse.down();
  await p.mouse.up();
  await p.waitForTimeout(250);
};
const wire = async (a, b) => {
  await clickPin(a);
  await clickPin(b);
};
const solder = async (id, ms) => {
  const s = await pin(id);
  await p.mouse.move(s.x, s.y, { steps: 6 });
  await p.mouse.down();
  await p.waitForTimeout(ms);
  await p.mouse.up();
  await p.waitForTimeout(250);
};
const benchTop = async () => {
  await p.evaluate(() => {
    const el = document.querySelector("[data-testid=bench]");
    const y = el.getBoundingClientRect().top + window.scrollY - 300;
    window.scrollTo(0, y);
  });
  await p.waitForTimeout(400);
};

// 1. 首页
await p.goto(BASE + "/");
await p.waitForTimeout(800);
await shot("landing");
await p.click("[data-testid=cta-workbench]");
await p.waitForSelector("[data-testid=bench] canvas");
await p.waitForTimeout(2000);
await benchTop();
await shot("workbench-empty");

// 2. 从零件盒拖到底板
const bench = p.locator("[data-testid=bench]");
const box = await bench.boundingBox();
const drop = async (type, x, z) => {
  const s = await p.evaluate(([x, z]) => window.__wb.plateScreen(x, z), [x, z]);
  await p.locator(`[data-part=${type}]`).dragTo(bench, { targetPosition: { x: s.x - box.x, y: s.y - (box.y) } });
  await p.waitForTimeout(500);
};
// 坐标已经滚动过，重新取
const box2 = await bench.boundingBox();
Object.assign(box, box2);
await drop("esp32", 2, 3.5);
await drop("servo", -9, -5.5);
await drop("battery", -9.5, 4.5);
await p.mouse.click(box.x + 20, box.y + box.height - 20); // 取消选中
await p.waitForTimeout(600);
await shot("parts-placed");

// 3. 连线：故意接错（信号接 GPIO43，并且不共地）
await p.click("[data-toolbar=wire]");
await wire("servo1.SIG", "esp32.GPIO43");
await wire("servo1.VCC", "battery.+");
await wire("servo1.GND", "battery.-");
await p.waitForTimeout(500);
await shot("miswired-check-fails");
const badge1 = await p.textContent("[data-testid=check-badge]");
console.log("badge after miswire:", badge1);

// 4. 改正：删掉 GPIO43 那根线，改接 GPIO4，加共地
await p.evaluate(() => {
  const st = window.__wb.state();
  const w = st.wires.find((w) => w.b === "esp32.GPIO43" || w.a === "esp32.GPIO43");
  st.removeWire(w.id);
});
await p.waitForTimeout(300);
await wire("servo1.SIG", "esp32.GPIO4");
await wire("battery.-", "esp32.GND");
await p.waitForTimeout(500);
await shot("wiring-fixed");
console.log("badge after fix (unsoldered):", await p.textContent("[data-testid=check-badge]"));

// 5. 焊接：先故意虚焊一个
await p.click("[data-toolbar=iron]");
await solder("esp32.GPIO4", 600);
await p.waitForTimeout(300);
await shot("cold-joint");
// 拍一张焊接进行中的
const s0 = await pin("esp32.GPIO4");
await p.mouse.move(s0.x, s0.y);
await p.mouse.down();
await p.waitForTimeout(800);
await shot("soldering-in-progress");
await p.waitForTimeout(800);
await p.mouse.up();
const st = await p.evaluate(() => window.__wb.state().wires.flatMap((w) => [w.a, w.b]));
for (const id of [...new Set(st)]) {
  const j = await p.evaluate((id) => window.__wb.state().joints[id], id);
  if (j !== "good") await solder(id, 1500);
}
await p.waitForTimeout(500);
await shot("soldered-check-passes");
console.log("badge after solder:", await p.textContent("[data-testid=check-badge]"));

// 6. 固件：先写一个错误
await p.evaluate(() => document.querySelector("[data-testid=code]").scrollIntoView({ block: "center" }));
await p.waitForTimeout(300);
const code = await p.inputValue("[data-testid=code]");
await p.fill("[data-testid=code]", code.replace("servo.write(a);", "servo.wirte(a);"));
await p.click("[data-testid=flash]");
await p.waitForTimeout(1200);
await shot("firmware-error");
console.log("fw status:", await p.textContent("[data-testid=fw-status]"));
await p.fill("[data-testid=code]", code);
await p.click("[data-testid=flash]");
await p.waitForTimeout(2500);
await shot("firmware-running-serial");
console.log("fw status:", await p.textContent("[data-testid=fw-status]"));

// 7. 看触手动
await benchTop();
await p.evaluate(() => window.scrollBy(0, 0));
await p.waitForTimeout(300);
const angles = [];
for (let i = 0; i < 3; i++) {
  angles.push(await p.evaluate(() => window.__wb.servoAngle("servo1")));
  await p.locator("[data-testid=robot]").screenshot({ path: `${OUT}/${String(n + 1).padStart(2, "0")}-tentacle-moving-${i + 1}.png` });
  await p.waitForTimeout(700);
}
n++;
console.log("servo1 angles sampled:", angles);
await shot("tentacle-moves-overview");
await p.waitForTimeout(3000);
// 8. 断开一根焊好的线，触手停下
await p.evaluate(() => {
  const st = window.__wb.state();
  const w = st.wires.find((w) => w.a === "battery.-" && w.b === "esp32.GND");
  st.removeWire(w.id);
});
await p.waitForTimeout(1200);
const a1 = await p.evaluate(() => window.__wb.servoAngle("servo1"));
await p.waitForTimeout(800);
const a2 = await p.evaluate(() => window.__wb.servoAngle("servo1"));
console.log("after removing common ground, angle frozen?", a1, a2);
await shot("ground-removed-stops");
console.log("guide:", await p.textContent("[data-testid=guide-steps]"));
console.log("errors:", errs);
await p.close();
await ctx.close();
await b.close();
