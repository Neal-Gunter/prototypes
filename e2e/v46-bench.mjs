// v46：深蓝 + 白色改版走查（首页 / 装配台 / 题库 / 使用说明 / 示波器）。早期原型，简化仿真。
// 用法：BASE=http://127.0.0.1:4173 OUT=/workspace/proto-site/v46 SHOTS=1 node e2e/v46-bench.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.BASE || "http://127.0.0.1:4173").replace(/\/$/, "");
const OUT = process.env.OUT || "/workspace/proto-site/v46";
const SHOT = process.env.SHOTS !== "0";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(`${OUT}/screenshots`, { recursive: true });
fs.mkdirSync(`${OUT}/after`, { recursive: true });

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => {
  if (cond) { pass++; console.log("  ok ", msg); }
  else { fail++; console.log("  FAIL", msg, extra === undefined ? "" : extra); }
};

const chrome = process.env.CHROME || "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: chrome, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function page({ theme = "light", w = 1440, h = 900, lang = "zh" } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme === "dark" ? "dark" : "light" });
  await c.addInitScript(([theme, lang]) => {
    try {
      localStorage.setItem("asm-tour-v22-done", "1");
      localStorage.setItem("ui-lang", lang);
      localStorage.setItem("wb-theme-v1", theme);
    } catch {}
  }, [theme, lang]);
  const p = await c.newPage();
  p.setDefaultTimeout(30000);
  const T = (t) => p.locator(`[data-testid="${t}"]`);
  return { c, p, T };
}

function hexOf(p, sel) {
  return p.$eval(sel, (el) => {
    const s = getComputedStyle(el);
    const m = s.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "";
    return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
  });
}

function lum(hex) {
  const h = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = rgb.map(f);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const cr = (a, b) => {
  const L1 = lum(a), L2 = lum(b);
  const hi = Math.max(L1, L2), lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
};

{
  const { c, p, T } = await page({ theme: "light" });
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  await T("theme-toggle").waitFor({ timeout: 20000 });
  const paperL = await hexOf(p, "body");
  ok(/^#f4f7fb$/i.test(paperL), "浅色页面是淡蓝灰，不是纸色", paperL);
  const banner = await p.$eval("[data-testid=banner]", (el) => {
    const s = getComputedStyle(el.parentElement);
    const m = s.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return "";
    return "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("");
  });
  ok(/^#0b2545$/i.test(banner), "横幅为深蓝", banner);
  const tokens = await p.evaluate(() => {
    const r = getComputedStyle(document.documentElement);
    const pick = (n) => r.getPropertyValue(n).trim();
    return {
      paper: pick("--color-paper"),
      paper2: pick("--color-paper-2"),
      ink: pick("--color-ink"),
      copper: pick("--color-copper"),
      brand: pick("--color-brand"),
    };
  });
  ok(/^#f4f7fb$/i.test(tokens.paper) && /^#ffffff$/i.test(tokens.paper2) && /^#0b2545$/i.test(tokens.ink), "浅色 token 为深蓝+白", JSON.stringify(tokens));
  ok(/^#1868b0$/i.test(tokens.copper), "点缀是浅蓝而不是铜", tokens.copper);
  ok(/^#0b2545$/i.test(tokens.brand), "brand token 为深蓝", tokens.brand);
  const navRadius = await T("main-nav").locator("a").first().evaluate((el) => getComputedStyle(el).borderRadius);
  ok(parseFloat(navRadius) >= 999 || /999|50%/.test(navRadius) || parseFloat(navRadius) >= 16, "导航是圆角胶囊", navRadius);
  const newsStart = await (await page({ theme: "light" }).then(async (x) => {
    await x.p.goto(BASE + "/help#whats-new", { waitUntil: "load", timeout: 60000 });
    await x.T("help-whats-new").waitFor({ timeout: 20000 });
    const start = await x.T("help-whats-new").getAttribute("start");
    const text = await x.T("help-whats-new").innerText();
    await x.c.close();
    return { start, text };
  }));
  ok(newsStart.start === "46" && /v46/.test(newsStart.text) && /深蓝|navy/i.test(newsStart.text), "使用说明本版更新含 v46", newsStart.start + " " + newsStart.text.slice(0, 80));
  await c.close();
}

{
  const { c, p, T } = await page({ theme: "dark" });
  await p.goto(BASE + "/", { waitUntil: "load", timeout: 60000 });
  const paperD = await hexOf(p, "body");
  ok(/^#0b2545$/i.test(paperD), "深色页面是深蓝表面", paperD);
  const ink = await p.evaluate(() => getComputedStyle(document.body).color);
  const m = ink.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const inkHex = m ? "#" + [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("") : "";
  ok(cr(inkHex || "#ffffff", paperD) >= 4.5, "深色正文 ≥ 4.5:1", inkHex + " on " + paperD + " = " + (inkHex ? cr(inkHex, paperD).toFixed(2) : "?"));
  await T("theme-toggle").selectOption("light");
  await wait(200);
  await c.close();
}

{
  const { c, p } = await page({ theme: "dark" });
  await p.goto(BASE + "/help", { waitUntil: "load", timeout: 60000 });
  await p.emulateMedia({ media: "print" });
  await wait(200);
  const printed = await p.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return { paper: root.getPropertyValue("--color-paper").trim(), ink: root.getPropertyValue("--color-ink").trim() };
  });
  ok(/^#f4f7fb$/i.test(printed.paper) && /^#0b2545$/i.test(printed.ink), "打印时 token 回到白/深蓝", JSON.stringify(printed));
  await c.close();
}

{
  const { c, p, T } = await page({ theme: "light" });
  await p.goto(BASE + "/assembly?scene=electrics", { waitUntil: "load", timeout: 60000 });
  await p.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
  await wait(4000);
  const bgL = await p.evaluate(() => window.__asm?.themeBg || "");
  ok(/^#f4f7fb$/i.test(bgL), "装配台浅色背景", bgL);
  await T("theme-toggle").selectOption("dark");
  await wait(800);
  const bgD = await p.evaluate(() => window.__asm?.themeBg || "");
  ok(/^#0b2545$/i.test(bgD), "装配台深色背景", bgD);
  await c.close();
}

{
  const { c, p } = await page({ theme: "light" });
  await p.goto(BASE + "/workbench", { waitUntil: "load", timeout: 60000 });
  await p.waitForSelector("canvas", { timeout: 30000 });
  await p.waitForFunction(() => window.__bench?.sceneBg, { timeout: 30000 });
  const bg = await p.evaluate(() => window.__bench.sceneBg);
  ok(/^#f4f7fb$/i.test(bg || ""), "工作台 3D 为浅色干净背景，不再是夜景", bg);
  await c.close();
}

{
  const { c, p, T } = await page({ theme: "light" });
  await p.goto(BASE + "/credits#v46-ui", { waitUntil: "load", timeout: 60000 });
  await T("credits-v46").waitFor({ timeout: 20000 });
  const crd = await T("credits-v46").innerText();
  ok(/v46/.test(crd) && /第三方|third-party/i.test(crd), "致谢页有 v46 说明", crd.slice(0, 160));
  await c.close();
}

if (SHOT) {
  const screens = [
    ["home", "/"],
    ["assembly", "/assembly"],
    ["bank", "/bank"],
    ["help", "/help"],
  ];
  for (const theme of ["light", "dark"]) {
    for (const [w, h, tag] of [[1920, 1080, "1920"], [390, 844, "390"]]) {
      const { c, p, T } = await page({ theme, w, h });
      for (const [name, path] of screens) {
        await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 });
        if (name === "assembly") {
          await p.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
          await wait(5000);
        } else await wait(800);
        const resolved = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
        ok(resolved === theme, `截图前 ${name} ${theme} ${tag} 主题正确`, resolved);
        await p.screenshot({ path: `${OUT}/screenshots/${name}-${theme}-${tag}.png`, fullPage: false });
      }
      // scope
      await p.goto(BASE + "/assembly", { waitUntil: "load", timeout: 60000 });
      await p.waitForSelector("canvas", { timeout: 60000 }).catch(() => {});
      await wait(4000);
      if (await T("tab-elec").count()) { await T("tab-elec").click(); await wait(800); }
      if (await T("bench-scope-open").count()) {
        await T("bench-scope-open").click();
        await T("bench-scope").waitFor({ timeout: 15000 }).catch(() => {});
        await wait(1500);
      }
      await p.screenshot({ path: `${OUT}/screenshots/scope-${theme}-${tag}.png`, fullPage: false });
      await c.close();
    }
  }
}

await browser.close();
console.log(`v46-bench ${pass}/${fail}`);
if (fail) process.exit(1);
