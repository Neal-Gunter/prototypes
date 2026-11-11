// v44：深色配色（同一套 token）、开关与存储、无闪屏、打印仍为浅色、3D 背景，以及 4 个画面 × 浅/深 × 1920/390 截图。
// 用法：BASE=http://localhost:4173 OUT=/workspace/proto-site/v44 SHOTS=1 node e2e/v44-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v44", SHOT = process.env.SHOTS !== "0";
fs.mkdirSync(`${OUT}/logs`, { recursive: true });
let pass = 0, fail = 0;
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errs = [];
const page = async ({ lang = "zh", w = 1440, h = 900, theme, colorScheme, rawTheme } = {}) => {
  const c = await b.newContext({ viewport: { width: w, height: h }, colorScheme: colorScheme || "light" });
  // Playwright 会把 undefined 序列化成 null，不能靠 rawTheme === undefined 判断。
  const mode = rawTheme === undefined ? (theme || "") : (rawTheme === null ? "__clear__" : "__raw__:" + rawTheme);
  await c.addInitScript(([l, mode]) => {
    try {
      localStorage.setItem("asm-tour-v22-done", "1");
      localStorage.setItem("ui-lang", l);
      if (mode === "__clear__") localStorage.removeItem("wb-theme-v1");
      else if (mode.startsWith("__raw__:")) localStorage.setItem("wb-theme-v1", mode.slice(8));
      else if (mode === "light" || mode === "dark" || mode === "system") localStorage.setItem("wb-theme-v1", mode);
    } catch { /* */ }
  }, [lang, mode]);
  const p = await c.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  return { c, p, T: (t) => p.locator(`[data-testid="${t}"]`) };
};
const hexOf = async (p, sel) => p.evaluate((s) => {
  const el = s ? document.querySelector(s) : document.body;
  const cs = getComputedStyle(el);
  const c = cs.backgroundColor;
  const m = String(c).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return c;
  const h = (n) => Number(n).toString(16).padStart(2, "0");
  return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}`;
}, sel);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitAsm(p, min = 6) {
  await p.waitForSelector("canvas", { timeout: 30000 });
  await p.waitForFunction((n) => window.__asm?.engine && window.__asm.engine.parts.size >= n, min, { timeout: 90000 });
  await p.waitForFunction(() => window.__asm && window.__asm.engine.extDrive !== true, { timeout: 120000 }).catch(() => {});
  await wait(400);
}

// —— 帮助 / 致谢（中英文）——
for (const lang of ["zh", "en"]) {
  const { c, p, T } = await page({ lang, theme: "light" });
  await p.goto(BASE + "/help#whats-new", { waitUntil: "load", timeout: 60000 });
  await T("help-whats-new").waitFor({ timeout: 20000 });
  const news = await T("help-whats-new").innerText();
  const start = await T("help-whats-new").getAttribute("start");
  ok(+start >= 44, `${lang}：本版更新起号 ≥ 44`, start);
  ok(/v44/.test(news) && /v43/.test(news) && /v32/.test(news), `${lang}：本版更新含 v44`, news.slice(0, 180));
  ok(/深色|dark theme|token|配色|colour theme|color scheme|prefers-color-scheme/i.test(news), `${lang}：v44 摘要提到深色配色`);
  await p.goto(BASE + "/credits#v44-theme");
  await T("credits-v44").waitFor({ timeout: 20000 });
  const cr = await T("credits-v44").innerText();
  ok(/v44/.test(cr) && /没有增加新的第三方|no new third-party/i.test(cr), `${lang}：致谢页有 v44 段落`, cr.slice(0, 160));
  await c.close();
}

// —— 开关、存储、跟随系统、坏数据、无闪屏 ——
{
  const { c, p, T } = await page({ theme: "system", colorScheme: "light" });
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await T("theme-toggle").waitFor({ timeout: 20000 });
  const pref0 = await T("theme-toggle").inputValue();
  const resolved0 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(pref0 === "system", "默认选项是系统", pref0);
  ok(resolved0 === "light", "系统+浅色 OS → 浅色", resolved0);
  const paperL = await hexOf(p, "body");
  ok(/^#f4f7fb$/i.test(paperL), "浅色纸色", paperL);

  await T("theme-toggle").selectOption("dark");
  await wait(200);
  const resolvedD = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const stored = await p.evaluate(() => localStorage.getItem("wb-theme-v1"));
  const paperD = await hexOf(p, "body");
  ok(resolvedD === "dark", "切换到深色后 data-theme=dark", resolvedD);
  ok(stored === "dark", "选择写入 wb-theme-v1", stored);
  ok(/^#0b2545$/i.test(paperD), "深色纸色", paperD);
  await c.close();
}

{
  // 刷新后仍是深色：预渲染脚本在 React 前就写上 data-theme
  const { c, p } = await page({ theme: "dark" });
  await p.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
  const early = await p.evaluate(() => ({
    theme: document.documentElement.getAttribute("data-theme"),
    pref: document.documentElement.getAttribute("data-theme-pref"),
    scheme: document.documentElement.style.colorScheme,
  }));
  ok(early.theme === "dark" && early.pref === "dark", "首屏即可读到深色 data-theme（无闪浅色）", JSON.stringify(early));
  await c.close();
}

{
  const { c, p, T } = await page({ rawTheme: "purple", colorScheme: "dark" });
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  await T("theme-toggle").waitFor({ timeout: 20000 });
  const pref = await T("theme-toggle").inputValue();
  const resolved = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(pref === "system", "坏数据当成系统", pref);
  ok(resolved === "dark", "坏数据 + 深色 OS → 深色", resolved);
  await c.close();
}

{
  const { c, p, T } = await page({ theme: "system", colorScheme: "dark" });
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  await T("theme-toggle").waitFor({ timeout: 20000 });
  const resolved = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(resolved === "dark", "系统偏好深色时解析为深色", resolved);
  // 强制浅色不受 OS 影响
  await T("theme-toggle").selectOption("light");
  await wait(200);
  const forced = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(forced === "light", "强制浅色时忽略深色 OS", forced);
  await c.close();
}

// —— 打印始终浅色 ——
{
  const { c, p } = await page({ theme: "dark" });
  await p.goto(BASE + "/help", { waitUntil: "load", timeout: 60000 });
  await p.emulateMedia({ media: "print" });
  await wait(200);
  const printed = await p.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      paper: root.getPropertyValue("--color-paper").trim(),
      ink: root.getPropertyValue("--color-ink").trim(),
      scheme: root.colorScheme || document.documentElement.style.colorScheme,
    };
  });
  ok(/^#f4f7fb$/i.test(printed.paper) && /^#0b2545$/i.test(printed.ink), "打印时 token 回到浅色", JSON.stringify(printed));
  await c.close();
}

// —— 3D 背景随配色；工作台改为浅色干净背景（v46） ——
{
  const { c, p, T } = await page({ theme: "light" });
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await waitAsm(p);
  const bgL = await p.evaluate(() => window.__asm?.themeBg);
  ok(/^#f4f7fb$/i.test(bgL || ""), "装配台浅色背景", bgL);
  await T("theme-toggle").selectOption("dark");
  await wait(800);
  const bgD = await p.evaluate(() => window.__asm?.themeBg);
  ok(/^#0b2545$/i.test(bgD || ""), "装配台深色背景", bgD);
  await c.close();
}

{
  const { c, p } = await page({ theme: "light" });
  await p.goto(BASE + "/workbench", { waitUntil: "load", timeout: 60000 });
  await p.waitForSelector("canvas", { timeout: 30000 });
  await p.waitForFunction(() => window.__bench?.sceneBg, { timeout: 30000 });
  const nightL = await p.evaluate(() => window.__bench.sceneBg);
  ok(/^#f4f7fb$/i.test(nightL || ""), "工作台浅色外壳下 3D 为浅色背景", nightL);
  const T = (t) => p.locator(`[data-testid="${t}"]`);
  await T("theme-toggle").selectOption("dark");
  await wait(500);
  const nightD = await p.evaluate(() => window.__bench.sceneBg);
  ok(/^#0b2545$/i.test(nightD || ""), "切到深色后工作台 3D 为深蓝背景", nightD);
  await c.close();
}

// —— 同一组 4 个画面：浅/深 × 1920/390 ——
const SCREENS = [
  ["home", "/"],
  ["bank", "/bank"],
  ["help", "/help"],
  ["assembly", "/assembly?scene=electrics"],
];
for (const theme of ["light", "dark"]) {
  for (const [w, h, tag] of [[1920, 1080, "1920"], [390, 844, "390"]]) {
    const { c, p } = await page({ theme, w, h: tag === "390" ? 844 : 1080 });
    for (const [name, path] of SCREENS) {
      await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
      if (name === "assembly") await waitAsm(p).catch(() => wait(4000));
      else await wait(name === "bank" ? 2000 : 800);
      const resolved = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
      ok(resolved === theme, `截图前 ${name} ${theme} ${tag} 主题正确`, resolved);
      if (SHOT) {
        const file = `${OUT}/${name}-${theme}-${tag}.png`;
        await p.screenshot({ path: file, fullPage: false });
        ok(fs.existsSync(file) && fs.statSync(file).size > 1000, `写出 ${name}-${theme}-${tag}.png`, String(fs.statSync(file).size));
      }
    }
    await c.close();
  }
}

ok(errs.length === 0, "页面无报错", errs.slice(0, 3).join(" | "));
console.log(`v44-bench ${pass}/${fail}`);
await b.close();
process.exit(fail ? 1 : 0);
