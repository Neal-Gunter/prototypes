// v23：真实使用走查——每个页面和模式，窄屏（手机 390 px）+ 宽屏（1440 px），查：横向溢出、文字对比度（WCAG AA）、
// 无名按钮/链接、键盘焦点可见、手机上过小的点按目标、页面报错。早期原型，简化仿真。
// 用法：BASE=http://localhost:4173/prototypes OUT=/tmp/v23walk node e2e/v23-walk.mjs
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = (process.env.BASE || "http://localhost:4173/prototypes").replace(/\/$/, ""), OUT = process.env.OUT || "/tmp/v23walk", SHOTS = process.env.SHOTS !== "0";
fs.mkdirSync(OUT, { recursive: true });
const PAGES = [["home", "/"], ["example", "/example"], ["workbench", "/workbench"], ["assembly", "/assembly"], ["electrics", "/assembly?scene=electrics"], ["fault", "/assembly?scene=fault"], ["smd", "/assembly?scene=smd"], ["octo", "/assembly?scene=octo"],
  ["model", "/assembly/model"], ["guide", "/assembly/guide"], ["octo-guide", "/assembly/octopus-guide?plan=B&variant=plus"], ["repair", "/repair"], ["repair-editor", "/repair?tab=editor"], ["parts", "/parts"], ["part", "/parts?id=ada-1185"], ["pinouts", "/pinouts"], ["credits", "/credits"], ["404", "/nope"]];
const VPS = [["m", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ["w", { width: 1440, height: 900 }]];
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const rep = [];
for (const [vk, vp] of VPS) for (const [k, u] of PAGES) {
  if (ONLY && !ONLY.has(k)) continue;
  const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.isMobile, hasTouch: vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem("asm-tour-v22-done", "1"); } catch { /* */ } });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message.slice(0, 160)));
  await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => errs.push("goto " + e.message.slice(0, 100)));
  await p.waitForTimeout(/assembly\?|workbench|^\/assembly$/.test(u) ? 4000 : 1200);
  const r = await p.evaluate(() => {
    const W = innerWidth, vis = (el) => { const s = getComputedStyle(el); if (s.visibility === "hidden" || s.display === "none" || +s.opacity === 0) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const desc = (el) => (el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.dataset.testid ? `[${el.dataset.testid}]` : "") + " " + (el.textContent || "").trim().slice(0, 24)).trim();
    // 1) 横向溢出：元素右边超出视口，且没有被可滚动/裁切的祖先包住
    const clipped = (el) => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) return true; } return false; };
    const over = [];
    for (const el of document.body.querySelectorAll("*")) { if (!vis(el) || el.closest("canvas,svg")) continue; const r = el.getBoundingClientRect(); if (r.right > W + 1 && r.left < W && !clipped(el) && getComputedStyle(el).position !== "fixed") over.push(desc(el) + ` →${Math.round(r.right)}`); }
    const docOver = document.documentElement.scrollWidth - W;
    // 2) 对比度：直接含文字的可见元素，前景色 vs 叠加后的背景色
    // Tailwind v4 的 bg-ink/85 算出来是 color(srgb …) / oklab(…)：统一画到 1×1 画布上读像素
    const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true }); const pc = new Map();
    const parse = (c) => { if (pc.has(c)) return pc.get(c); let o = null; if (c && c !== "transparent") { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; o = [d[0], d[1], d[2], d[3] / 255]; } pc.set(c, o); return o; };
    const lum = ([r, g, b]) => { const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { const st = []; for (let a = el; a; a = a.parentElement) { const s = getComputedStyle(a); if (s.backgroundImage !== "none") return null; const c = parse(s.backgroundColor); if (c && c[3] > 0) { st.push(c); if (c[3] >= 1) break; } } let o = [255, 255, 255]; for (const c of st.reverse()) o = o.map((v, i) => v * (1 - c[3]) + c[i] * c[3]); return o; };
    const low = []; let nText = 0;
    for (const el of document.body.querySelectorAll("*")) {
      if (!vis(el) || el.closest("canvas,svg,.sr-only")) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const s = getComputedStyle(el); const fg = parse(s.color), bg = bgOf(el); if (!fg || !bg) continue; nText++;
      const f = fg.slice(0, 3).map((v, i) => v * fg[3] + bg[i] * (1 - fg[3]) * (+s.opacity));
      const L1 = lum(f), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(s.fontSize), large = px >= 24 || (px >= 18.66 && +s.fontWeight >= 700);
      if (cr < (large ? 3 : 4.5)) low.push(`${desc(el)} ${cr.toFixed(2)} ${s.color}/${bg.map(Math.round).join(",")}`);
    }
    // 3) 无名按钮/链接/输入
    const noname = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter((el) => vis(el) && !((el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.getAttribute("placeholder") || el.labels?.[0]?.textContent || el.getAttribute("aria-labelledby") || el.value || "").trim()) && el.type !== "hidden").map(desc);
    // 4) 手机上过小的点按目标（< 24×24 CSS px，WCAG 2.2 AA 2.5.8；行内文字链接除外）
    const small = [...document.querySelectorAll("button,a[href],input:not([type=hidden]),select,[role=button],summary")].filter((el) => { if (!vis(el) || el.closest(".sr-only") || el.classList.contains("sr-only")) return false; const r = el.getBoundingClientRect(); if (r.width <= 2 && r.height <= 2) return false; if (el.tagName === "A" && getComputedStyle(el).display === "inline") return false; return r.width < 24 || r.height < 24; }).map((el) => { const r = el.getBoundingClientRect(); return desc(el) + ` ${Math.round(r.width)}×${Math.round(r.height)}`; });
    return { docOver, over: over.slice(0, 12), nOver: over.length, nText, low: low.slice(0, 15), nLow: low.length, noname: noname.slice(0, 10), nNoname: noname.length, small: small.slice(0, 10), nSmall: small.length, lang: document.documentElement.lang };
  });
  // 5) 键盘：Tab 30 次，记录焦点是否可见（outline / box-shadow / ring）、焦点是否落到不可见元素
  const kb = { steps: 0, invisible: [], hidden: [] };
  await p.mouse.click(1, 1).catch(() => {});
  for (let i = 0; i < 30; i++) {
    await p.keyboard.press("Tab");
    const f = await p.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const s = getComputedStyle(el), r = el.getBoundingClientRect(); return { d: (el.tagName.toLowerCase() + (el.dataset.testid ? `[${el.dataset.testid}]` : "") + " " + (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)), ring: (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none"), vis: r.width > 0 && r.height > 0 }; });
    if (!f) continue; kb.steps++;
    if (!f.ring) kb.invisible.push(f.d); if (!f.vis) kb.hidden.push(f.d);
  }
  kb.invisible = [...new Set(kb.invisible)]; kb.hidden = [...new Set(kb.hidden)];
  if (SHOTS) await p.screenshot({ path: `${OUT}/${vk}-${k}.png`, fullPage: false });
  const row = { vp: vk, k, u, ...r, kb: { steps: kb.steps, nInvisible: kb.invisible.length, invisible: kb.invisible.slice(0, 8), hidden: kb.hidden.slice(0, 5) }, errs: errs.slice(0, 4) };
  rep.push(row);
  console.log(`${vk} ${k.padEnd(13)} 溢出 ${r.docOver}px/${r.nOver} · 低对比 ${r.nLow}/${r.nText} · 无名 ${r.nNoname} · 小目标 ${vk === "m" ? r.nSmall : "-"} · 焦点不可见 ${kb.invisible.length}/${kb.steps} · 报错 ${errs.length}`);
  await ctx.close();
}
fs.writeFileSync(`${OUT}/walk.json`, JSON.stringify(rep, null, 1));
const tot = (f) => rep.reduce((s, r) => s + f(r), 0);
console.log(`合计：横向溢出页面 ${rep.filter((r) => r.docOver > 1).length} · 低对比文字 ${tot((r) => r.nLow)} · 无名控件 ${tot((r) => r.nNoname)} · 手机小目标 ${tot((r) => (r.vp === "m" ? r.nSmall : 0))} · 焦点不可见 ${tot((r) => r.kb.nInvisible)} · 报错 ${tot((r) => r.errs.length)}`);
await b.close();
