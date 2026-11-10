// v37（我的补充）：键盘焦点顺序检查，放在 axe 那一步一起跑（axe 不按 Tab，查不到这些）。
// 每页从地址栏之后开始一直按 Tab，记录每次落到的元素，检查：
//   order   焦点顺序和 DOM 顺序一致（不用正数 tabindex 打乱）
//   visible 每个落点都有看得见的焦点样式（outline 或 box-shadow），而且在可视区里
//   trap    没有焦点陷阱：能把页面上所有可 Tab 元素走完，再回到开头；Shift+Tab 能退回上一个
//   contrast v39：焦点环相对相邻背景的对比度至少 3:1（相对亮度，WCAG 2.2 焦点外观的下限）
// 用法：BASE=http://localhost:4173 OUT=/tmp/focus node e2e/focus-order.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/tmp/focus";
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [["home", "/"], ["example", "/example"], ["workbench", "/workbench"], ["assembly", "/assembly"], ["parts", "/parts"], ["guide", "/assembly/guide"], ["octo-guide", "/assembly/octopus-guide"], ["teardown", "/teardown/"], ["teardown-step", "/teardown/?d=micro-servo&s=3"], ["credits", "/credits"], ["help", "/help"], ["bank", "/bank"]];
// 自测：MUTATE=1 时在 /example 里人为加一个焦点陷阱、一个正数 tabindex、一个去掉焦点样式的按钮，三类都必须报出来
const MUT = process.env.MUTATE === "1";
if (MUT) PAGES.splice(0, PAGES.length, ["mut-trap", "/example"], ["mut-order", "/example"], ["mut-visible", "/example"], ["mut-contrast", "/example"]);
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rows = []; let fail = 0;
const READ = () => {
  const e = document.activeElement; if (!e || e === document.body) return null;
  const s = getComputedStyle(e), r = e.getBoundingClientRect();
  const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
  const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  const parse = (c) => {
    const m = String(c).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/);
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : +m[4] };
  };
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const ratio = (a, b) => { const hi = Math.max(lum(a), lum(b)), lo = Math.min(lum(a), lum(b)); return (hi + 0.05) / (lo + 0.05); };
  const solid = (n) => {
    while (n) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.05) return c;
      n = n.parentElement;
    }
    return { r: 231, g: 223, b: 208, a: 1 };
  };
  const cols = [];
  if (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) { const c = parse(s.outlineColor); if (c && c.a > 0.05) cols.push(c); }
  if (s.boxShadow && s.boxShadow !== "none") for (const m of s.boxShadow.matchAll(/rgba?\([^)]+\)/g)) { const c = parse(m[0]); if (c && c.a > 0.05) cols.push(c); }
  const bg = solid(e.parentElement || e);
  const fill = (() => { const c = parse(s.backgroundColor); return c && c.a > 0.05 ? c : bg; })();
  let contrast = 0;
  for (const c of cols) contrast = Math.max(contrast, ratio(c, bg), ratio(c, fill));
  return { idx: window.__fo.get(e) ?? -1, ti: e.tabIndex, ring, inView, contrast, name: (e.getAttribute("data-testid") || e.id || e.tagName.toLowerCase()) + (e.textContent ? ":" + e.textContent.trim().slice(0, 18) : "") };
};
for (const [k, u] of PAGES) {
  if (ONLY && !ONLY.has(k)) continue;
  const c = await b.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: "reduce" }); // 站点在减少动态效果时关掉平滑滚动，落点位置才能马上量
  await c.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); } catch { /* */ } });
  const p = await c.newPage();
  const errs = [];
  try {
    await p.goto(BASE + u, { waitUntil: "load", timeout: 60000 });
    await p.waitForTimeout(k.startsWith("assembly") ? 6000 : 2000);
    if (MUT) await p.evaluate((k) => {
      const m = document.querySelector("main") || document.body, x = document.createElement(k === "mut-trap" ? "input" : "button");
      x.textContent = "mut"; m.prepend(x);
      if (k === "mut-trap") x.addEventListener("keydown", (e) => { if (e.key === "Tab") e.preventDefault(); });
      if (k === "mut-order") { m.append(x); x.tabIndex = 1; }
      if (k === "mut-visible") { x.style.outline = "none"; x.style.boxShadow = "none"; }
      if (k === "mut-contrast") { x.style.outline = "2px solid #e8e4dc"; x.style.outlineOffset = "2px"; x.style.boxShadow = "none"; }
    }, k);
    const at0 = await p.evaluate(() => document.activeElement?.id || "");
    await p.evaluate(() => { window.__fo = new WeakMap(); let i = 0; for (const e of document.querySelectorAll("*")) window.__fo.set(e, i++); document.activeElement?.blur?.(); window.scrollTo(0, 0); });
    const total = await p.evaluate(() => [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]')].filter((e) => {
      if (e.disabled || e.tabIndex < 0 || e.closest("[inert],[hidden]")) return false;
      const dt = e.closest("details"); if (dt && !dt.open && !e.closest("summary")) return false; // 收起的 <details> 里面的不算
      const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    }).length);
    const seq = [], probs = [];
    // 打印页二维码的深链接：焦点应该停在第 N 步上，按 Tab 从这一步里面继续
    const sN = new URL(BASE + u).searchParams.get("s");
    if (sN) {
      const at = at0;
      await p.keyboard.press("Tab");
      const inStep = await p.evaluate((n) => !!document.activeElement?.closest(`#td-step-${n}`), sN);
      if (at !== `td-step-${sN}` || !inStep) probs.push(["order", `深链接没把焦点放到第 ${sN} 步（落在 ${at || "body"}，Tab 后${inStep ? "" : "不"}在这一步里）`]);
      await p.evaluate(() => { window.scrollTo(0, 0); document.querySelector("a[href],button")?.focus(); }); // 从第一个控件重新走一遍
      seq.push(await p.evaluate(READ));
    }
    for (let i = 0; i < total + 3; i++) {
      await p.keyboard.press("Tab");
      const f = await p.evaluate(READ);
      if (!f) { if (seq.length) break; else continue; }
      if (seq.length && f.idx === seq[0].idx) break; // 回到开头了
      seq.push(f);
    }
    const uniq = new Set(seq.map((s) => s.idx));
    const dupN = [...new Set(seq.filter((s, i) => seq.findIndex((x) => x.idx === s.idx) !== i).map((s) => s.name))];
    if (uniq.size < seq.length) probs.push(["trap", `同一元素被重复 Tab 到（${seq.length - uniq.size} 次）：${dupN.slice(0, 3).join(" | ")}`]);
    if (uniq.size < total) {
      const miss = await p.evaluate((got) => { const g = new Set(got); return [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex],[contenteditable="true"]')].filter((e) => !e.disabled && e.tabIndex >= 0 && !g.has(window.__fo.get(e)) && e.getBoundingClientRect().width > 0).slice(0, 4).map((e) => (e.getAttribute("data-testid") || e.id || e.tagName.toLowerCase()) + ":" + (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 20)); }, [...uniq]);
      probs.push(["trap", `只走到 ${uniq.size} / ${total} 个可 Tab 元素，没走到：${miss.join(" | ")}`]);
    }
    let inv = 0; for (let i = 1; i < seq.length; i++) if (seq[i].idx < seq[i - 1].idx) inv++;
    if (inv) probs.push(["order", `${inv} 处焦点往回跳（和 DOM 顺序不一致）`]);
    if (seq.some((s) => s.ti > 0)) probs.push(["order", "用了正数 tabindex"]);
    const noRing = seq.filter((s) => !s.ring), off = seq.filter((s) => !s.inView);
    if (noRing.length) probs.push(["visible", `${noRing.length} 个落点没有焦点样式：${noRing.slice(0, 3).map((s) => s.name).join(" | ")}`]);
    if (off.length) probs.push(["visible", `${off.length} 个落点不在可视区：${off.slice(0, 3).map((s) => s.name).join(" | ")}`]);
    const lowC = seq.filter((s) => s.ring && (s.contrast || 0) < 3);
    if (lowC.length) probs.push(["contrast", `${lowC.length} 个落点焦点环对比度不到 3:1（最低 ${Math.min(...lowC.map((s) => s.contrast)).toFixed(2)}）：${lowC.slice(0, 3).map((s) => s.name).join(" | ")}`]);
    // Shift+Tab 退一步
    if (seq.length >= 3) {
      await p.evaluate(() => document.activeElement?.blur?.());
      for (let i = 0; i < 3; i++) await p.keyboard.press("Tab");
      await p.keyboard.press("Shift+Tab");
      const back = await p.evaluate(() => window.__fo.get(document.activeElement) ?? -1);
      if (back !== seq[1].idx) probs.push(["trap", "Shift+Tab 没退回上一个"]);
    }
    p.on("pageerror", (e) => errs.push(String(e)));
    rows.push({ page: k, total, visited: uniq.size, probs });
    if (probs.length) fail++;
    console.log(probs.length ? "✗" : "✓", k, `可 Tab ${total}，走到 ${uniq.size}`, probs.map((x) => `[${x[0]}] ${x[1]}`).join("；"));
  } catch (e) { fail++; rows.push({ page: k, err: String(e).slice(0, 200) }); console.log("✗", k, String(e).slice(0, 200)); }
  await c.close();
}
await b.close();
fs.writeFileSync(`${OUT}/focus-order.json`, JSON.stringify(rows, null, 1));
if (MUT) { const want = { "mut-trap": "trap", "mut-order": "order", "mut-visible": "visible", "mut-contrast": "contrast" }; const hit = rows.filter((r) => r.probs?.some((x) => x[0] === want[r.page])).length; console.log(`focus-order 自测：${hit}/4`); process.exit(hit === 4 ? 0 : 1); }
console.log(`focus-order：${rows.length} 页，${rows.length - fail} 页通过，${fail} 页有问题`);
process.exit(fail ? 1 : 0);
