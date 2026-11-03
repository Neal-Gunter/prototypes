// v37：打印页二维码真的能扫出来吗？两条路都解码一遍（jsQR，Apache-2.0，只在测试里用，不进网站包）：
//   A. 每个二维码 SVG 画到 canvas（每格 4 像素）再解码 —— 13 台 × 2 种语言全部
//   B. 打印样式下对元素截图（真实栅格化，96dpi 下 20mm ≈ 76 像素）再解码 —— 每种语言抽 3 台
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { DEVICES } from "../src/teardown/devices.js";
import { guideHtml } from "../src/teardown/guideSheet.js";
const JSQR = readFileSync(new URL("../node_modules/jsqr/dist/jsQR.js", import.meta.url), "utf8");
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const page = await browser.newPage({ deviceScaleFactor: 1 });
let pass = 0, fail = 0, nA = 0, nB = 0;
const ok = (c, m) => { c ? pass++ : fail++; if (!c) console.log("✗", m); };
for (const d of DEVICES) for (const lang of ["zh", "en"]) {
  await page.setContent(guideHtml(d, lang, { now: new Date("2026-11-03") }));
  await page.addScriptTag({ content: JSQR });
  const r = await page.evaluate(async () => {
    const out = [];
    for (const s of document.querySelectorAll("svg.qr")) {
      const n = +s.getAttribute("viewBox").split(" ")[2], px = n * 4;
      const img = new Image(); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s.outerHTML.replace(/width="[^"]+" height="[^"]+"/, `width="${px}" height="${px}"`));
      await img.decode();
      const c = document.createElement("canvas"); c.width = c.height = px; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
      const q = window.jsQR(g.getImageData(0, 0, px, px).data, px, px);
      out.push([s.dataset.qr, q?.data || null]);
    }
    return out;
  });
  for (const [want, got] of r) { nA++; ok(got === want, `A ${d.id}/${lang}: 期望 ${want} 解出 ${got}`); }
  if (DEVICES.indexOf(d) % 5 === 0) {
    await page.emulateMedia({ media: "print" });
    const els = await page.$$("svg.qr");
    for (const el of els.slice(0, 3)) {
      const want = await el.getAttribute("data-qr");
      const b64 = (await el.screenshot()).toString("base64");
      const got = await page.evaluate(async (b) => { const img = new Image(); img.src = "data:image/png;base64," + b; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return [img.width, window.jsQR(g.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data || null]; }, b64);
      nB++; ok(got[1] === want, `B ${d.id}/${lang}: ${got[0]}px 期望 ${want} 解出 ${got[1]}`);
    }
    await page.emulateMedia({ media: "screen" });
  }
}
await browser.close();
console.log(`qr-decode：A 画布解码 ${nA} 个，B 截图解码 ${nB} 个 → ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
