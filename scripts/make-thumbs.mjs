// 生成 public/lib/thumbs/<id>.webp（128×128）。先在另一个终端跑：npx vite --port 5199
import { chromium } from "playwright";
import fs from "node:fs";
const idx = JSON.parse(fs.readFileSync("public/lib/index.json", "utf8"));
fs.mkdirSync("public/lib/thumbs", { recursive: true });
const b = await chromium.launch({ ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage();
await p.goto("http://localhost:5199/scripts/thumbgen.html");
await p.waitForFunction(() => window.thumbReady);
let ok = 0, bad = [];
for (const row of idx.parts) {
  const [id, , , cat] = row;
  if (/^fc-ext-.*-l\d+$/.test(id)) continue; // v21：型材长度变体共用原件缩略图
  const f = `public/lib/thumbs/${id}.webp`;
  if (fs.existsSync(f) && !process.env.FORCE) { ok++; continue; }
  try {
    const url = await p.evaluate((u) => window.renderThumb(u), `/lib/${cat}/${id}.glb`);
    fs.writeFileSync(f, Buffer.from(url.split(",")[1], "base64"));
    ok++;
  } catch (e) { bad.push(id + ": " + e.message.slice(0, 80)); }
}
console.log("ok", ok, "bad", bad.length, bad.slice(0, 5));
await b.close();
