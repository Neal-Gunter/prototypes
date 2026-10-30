// v17：维修关卡走查。① 页面 / 导航 / 12 关 ② 真点击玩一关（放大镜读色环、万用表量阻值、带电焊接被拦、拆焊换件、交付、成绩单）
// ③ 看板子：翻面、旋转、放大、放大镜、外壳 ④ 提示扣分、零件箱用错有后果 ⑤ 12 关全部按预期修法在浏览器里过一遍
// ⑥ 编辑器：选模板 + 故障 → 校验 → 保存试玩 → 导出 / 导入；从装配台导入当前电路。用法同 v16（BASE / OUT / SHOTS=0）
import { chromium } from "playwright";
import fs from "node:fs";
import { execSync } from "node:child_process";
const BASE = process.env.BASE || "http://localhost:4173", OUT = process.env.OUT || "/workspace/proto-site/v17", SHOT = process.env.SHOTS !== "0", VID = "/tmp/pwv17";
fs.mkdirSync(`${OUT}/logs`, { recursive: true }); fs.rmSync(VID, { recursive: true, force: true });
let pass = 0, fail = 0, n = 0; const res = {};
const ok = (c, zh, extra = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", zh, extra); };
const b = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, ...(SHOT ? { recordVideo: { dir: VID, size: { width: 1440, height: 900 } } } : {}) });
const p = await ctx.newPage(); const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
const L = (f, a) => p.evaluate(f, a), wait = (ms) => p.waitForTimeout(ms);
const shot = async (s, t) => { if (!SHOT) return; const f = `${OUT}/${String(++n).padStart(2, "0")}-${s}.png`; if (t) await p.locator(`[data-testid=${t}]`).screenshot({ path: f }); else await p.screenshot({ path: f }); };
const click = (t) => p.click(`[data-testid=${t}]`);
const txt = (t) => p.locator(`[data-testid=${t}]`).innerText();
const lastLog = () => L(() => window.__repair.game.log.at(-1).text);

await p.goto(BASE + "/repair"); await p.waitForSelector("[data-testid=board-svg]");
await L(() => localStorage.clear()); await p.reload(); await p.waitForSelector("[data-testid=board-svg]");
ok(await p.locator("nav a", { hasText: "维修关卡" }).count() >= 1, "导航栏有“维修关卡”");
const scs = await p.locator("[data-testid^=sc-]").count();
ok(scs === 12, `关卡列表 ${scs} 关`);
ok(/早期原型，简化仿真/.test(await p.locator("main, body").first().innerText()) && /不替代真实安全培训/.test(await p.locator("body").innerText()), "页面标明“早期原型，简化仿真 · 不替代真实安全培训”");
await shot("repair-start");

// ② 真点击：夜灯暗（R1 被换成 22 kΩ）
await click("sc-led-wrong-resistor"); await wait(200);
await click("tool-magnifier"); await p.mouse.move(700, 450);
await p.locator("[data-testid=part-R1] rect").first().click();
ok(/红-红-橙/.test(await lastLog()), "放大镜看 R1：读出色环 红-红-橙", await lastLog());
ok(await p.locator("[data-testid=loupe]").count() === 1, "放大镜工具：鼠标处出现 3× 放大圆");
await shot("magnifier");
await click("tool-meter"); await click("mode-ohm");
await click("zoom-in");
await p.locator("[data-testid=pin-R1-1] rect").click(); await p.locator("[data-testid=pin-R1-2] rect").click();
const ohm = await txt("reading"); ok(/22\.0+ kΩ/.test(ohm), "万用表电阻档量 R1 两脚（断电）", ohm);
await shot("meter-ohm");
await click("power"); await click("mode-V");
await click("tool-hand"); await p.locator("[data-testid=part-R1] rect").first().click();
await click("tool-iron"); await click("act-desolder");
ok(/先断电/.test(await txt("flash")) && await L(() => window.__repair.game.safety.length) === 1, "通电时拿烙铁拆 R1 → 被拦下并记一次安全违规", await txt("flash"));
await click("power"); await click("act-desolder");
ok(/电池还接着/.test(await txt("flash")), "只关开关不拔电池 → 仍然被拦（电池还接着）");
await click("bat-remove"); await click("act-desolder");
ok(await L(() => window.__repair.game.board.parts.find((x) => x.ref === "R1").state.present === false), "拔掉电池后拆下 R1");
await click("bin-res-150"); await click("act-place"); await click("bat-insert");
await click("power"); await wait(200);
ok(await p.locator("[data-testid=glow-D1]").count() === 1 && /亮/.test(await txt("status")), "换上 150 Ω、装回电池、通电 → D1 亮了");
await shot("fixed-lit");
await click("deliver"); await p.waitForSelector("[data-testid=report]");
const rep = await txt("report"); res.manual = await L(() => window.__repair.game.report());
ok(/修好了/.test(rep) && /根本原因/.test(rep) && /安全/.test(rep) && /不显示价格/.test(rep), `成绩单：${res.manual.total} 分 ${res.manual.stars} 星，含根本原因 / 教训 / 安全 / 不显示价格`);
ok(res.manual.items.some((x) => /安全违规/.test(x.zh)) && res.manual.stars < 3, "安全违规在成绩单里扣分");
await shot("report", "report");

// ③ 看板子：翻面、旋转、外壳
await click("sc-octo-combo"); await wait(200);
ok(await p.locator("[data-testid=cover-TOP] rect").count() >= 1, "八爪鱼板有上壳");
await click("tool-hand"); await click("cover-TOP");
ok(await L(() => !window.__repair.game.board.covers[0].on), "点外壳 → 拆下上壳");
await shot("octo-front");
await click("flip"); await wait(100);
ok(await p.locator("[data-testid^=pad-]").count() > 10 && /背面/.test(await txt("flip")), "翻到背面：显示焊盘 / 走线");
await click("rotate"); await click("zoom-in"); await shot("octo-back-rot");
await click("flip"); await click("rotate"); await click("rotate"); await click("rotate");

// ④ 提示扣分 + 零件箱用错
await click("sc-led-dead-battery");
for (let i = 0; i < 3; i++) await click("hint");
ok(await p.locator("[data-testid=hints] li").count() === 3 && await p.locator("[data-testid=hint]").isDisabled(), "3 级提示逐级出现，用完后按钮变灰");
await click("bat-remove"); await click("bat-bat-aa3-old"); await click("deliver");
ok(/没修好/.test(await txt("report")) && await L(() => window.__repair.game.wrongParts.length) === 1, "换上“旧 AA 电池”→ 验收不过，并记为用错零件");
await click("restart"); await click("bat-remove"); await click("bat-bat-aa3-new"); for (let i = 0; i < 3; i++) await click("hint"); await click("deliver");
res.hinted = await L(() => window.__repair.game.score());
ok(res.hinted.total === 65 && res.hinted.stars === 1 && res.hinted.items.some((x) => x.v === -35), "用了 3 个提示的成绩：扣 5+10+20=35 分 → 65 分 1 星", JSON.stringify(res.hinted.items));

// ⑤ 12 关在浏览器里按预期修法全部过一遍
res.all = await L(async () => {
  const { SCENARIOS } = window.__repairData || {};
  const out = [];
  const list = [...document.querySelectorAll("[data-testid^=sc-]")].map((e) => e.dataset.testid.slice(3));
  for (const id of list) {
    window.__repair.setScenario(id);
    await new Promise((r) => setTimeout(r, 30));
    const g = window.__repair.game; g.autoTool = true;
    const bad0 = g.board.parts.some((x) => x.state.burnt);
    for (const c of g.board.covers) g.act({ a: "cover", id: c.id, on: false });
    for (const grp of g.sc.solution) for (const a of grp) g.act(a);
    const r = window.__repair.act({ a: "deliver" });
    out.push({ id, ok: r.ok, stars: g.score().stars, minutes: +g.minutes.toFixed(1), bad0 });
    void SCENARIOS;
  }
  return out;
});
for (const r of res.all) ok(r.ok && r.stars >= 1, `浏览器里修好「${r.id}」`, `${r.stars} 星 · ${r.minutes} 分钟（估算）`);
ok(await L(() => Object.keys(JSON.parse(localStorage.getItem("repair.progress.v1") || "{}")).length) === 12, "12 关的最好成绩记在本机（localStorage）");
await shot("all-stars", "scenario-list");

// ⑥ 编辑器
await click("tab-editor"); await p.waitForSelector("[data-testid=editor]");
await click("ed-tpl-led");
await p.fill("[data-testid=ed-title]", "e2e 夜灯虚焊");
const optVal = await p.locator("[data-testid=ed-fault-select] option", { hasText: "冷焊 / 虚焊：D1 的 A 脚" }).getAttribute("value");
await p.selectOption("[data-testid=ed-fault-select]", optVal); await click("ed-fault-add");
const v = await txt("ed-validate");
ok(/故障能被观察到/.test(v) && /没有故障的板子能通过验收/.test(v), "编辑器校验：故障可观察、健康板能过验收");
await shot("editor", "editor");
await click("ed-play"); await p.waitForSelector("[data-testid=board-svg]"); await wait(200);
ok(await L(() => window.__repair.game.sc.title) === "e2e 夜灯虚焊" && await p.locator("[data-testid^=sc-custom-]").count() === 1, "保存并试玩：自制关卡出现在列表里并已载入");
ok(await L(() => { const g = window.__repair.game; g.autoTool = true; g.act({ a: "battery", op: "remove" }); g.act({ a: "reflow", ref: "D1", pin: "A" }); g.act({ a: "battery", op: "insert" }); return window.__repair.act({ a: "deliver" }).ok; }), "自制关卡能修好（补焊 D1.A）");
await click("tab-editor");
const [dl] = await Promise.all([p.waitForEvent("download"), click("ed-export")]);
const pf = `${OUT}/logs/repair-pack.json`; await dl.saveAs(pf);
const pack = JSON.parse(fs.readFileSync(pf, "utf8"));
ok(pack.schema === "proto-repair/1" && pack.scenarios.length === 1, "导出关卡包 JSON（proto-repair/1）");
pack.scenarios[0] = { ...pack.scenarios[0], id: "custom-imported", title: "导入的关卡" };
fs.writeFileSync("/tmp/pack2.json", JSON.stringify(pack));
await p.setInputFiles("[data-testid=ed-file]", "/tmp/pack2.json"); await wait(200);
ok(/导入了 1 个/.test(await txt("ed-msg")), "导入关卡包");
fs.writeFileSync("/tmp/pack-bad.json", JSON.stringify({ schema: "other", scenarios: [] }));
await p.setInputFiles("[data-testid=ed-file]", "/tmp/pack-bad.json"); await wait(200);
ok(/导入失败/.test(await txt("ed-msg")), "格式不对的文件被拒绝");

// 从装配台导入
await p.goto(BASE + "/assembly?scene=electrics");
await p.waitForFunction(() => window.__asmBuilt, null, { timeout: 180000 }); await wait(1500);
ok(await p.locator("[data-testid=to-repair]").count() === 1, "装配台电路面板有“把这个电路做成维修关卡”");
await L(() => document.querySelector("[data-testid=to-repair]").click());
await p.waitForSelector("[data-testid=editor]");
res.bench = await L(() => JSON.parse(localStorage.getItem("repair.benchImport.v1")));
ok(res.bench?.boards?.length >= 1 && res.bench.els.length >= 1, `装配台电路导出：${res.bench?.boards?.length} 块板、${res.bench?.els?.length} 个电阻 / LED`);
ok(await p.locator("[data-testid=ed-bench]").getAttribute("class").then((c) => /bg-copper/.test(c)), "编辑器自动切到“从装配台导入”");
const opts = await p.locator("[data-testid=ed-fault-select] option").count();
ok(opts > 3, `导入的板子可以挑故障（${opts} 种）`);
await shot("editor-bench", "editor");

ok(!errs.length, "没有页面错误", errs.join(" | "));
fs.writeFileSync(`${OUT}/logs/v17-bench-results.json`, JSON.stringify({ pass, fail, ...res }, null, 1));
await ctx.close(); await b.close();
if (SHOT) {
  const v = fs.readdirSync(VID).filter((f) => f.endsWith(".webm")).map((f) => ({ f, s: fs.statSync(`${VID}/${f}`).size })).sort((a, b) => b.s - a.s)[0]?.f;
  if (v) { execSync(`ffmpeg -y -loglevel error -i ${VID}/${v} -vf "setpts=0.5*PTS,scale=1280:-2,fps=24" -an -c:v libx264 -crf 32 -preset veryfast -pix_fmt yuv420p -movflags +faststart ${OUT}/demo.mp4`); console.log("demo.mp4", (fs.statSync(`${OUT}/demo.mp4`).size / 1e6).toFixed(1), "MB"); }
}
console.log(`\nv17 e2e：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
