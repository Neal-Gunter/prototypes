// 部署检查：在子路径下逐页打开，确认页面渲染、资源（GLB/缩略图/JSON）加载、无报错。用法：node site-check.mjs <BASE> <OUTDIR>
import { chromium } from "playwright";
import fs from "node:fs";
const BASE = (process.argv[2] || "http://localhost:4180/prototypes").replace(/\/$/, ""), OUT = process.argv[3] || "/tmp/sitecheck";
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const pages = [["home", "/"], ["assembly", "/assembly"], ["octo", "/assembly?scene=octo"], ["parts", "/parts"], ["credits", "/credits"], ["guide", "/assembly/guide"], ["octo-guide", "/assembly/octopus-guide?plan=B&variant=plus"], ["workbench", "/workbench"]];
const out = [];
for (const [k, u] of pages) {
  const ctx = await b.newContext({ viewport: { width: 1366, height: 768 } }); const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200)));
  p.on("response", (r) => { const s = r.status(); if (s >= 400 && !r.url().endsWith(u)) bad.push(`${s} ${r.url().replace(BASE, "")}`); });
  await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => errs.push("goto " + e.message));
  await p.waitForTimeout(k === "octo" || k === "assembly" || k === "workbench" ? 6000 : 1500);
  const info = await p.evaluate(() => ({ title: document.title, h1: document.querySelector("h1,h2")?.textContent?.trim().slice(0, 60), text: document.body.innerText.length, notFound: /找不到|404/.test(document.body.innerText.slice(0, 400)), canvas: document.querySelectorAll("canvas").length, imgsBroken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length, path: location.pathname }));
  await p.screenshot({ path: `${OUT}/${k}.png` });
  out.push({ k, u, ...info, errs: errs.slice(0, 5), bad: bad.slice(0, 5) }); console.log(JSON.stringify(out.at(-1)));
  await ctx.close();
}
fs.writeFileSync(`${OUT}/site-check.json`, JSON.stringify(out, null, 1));
await b.close();
