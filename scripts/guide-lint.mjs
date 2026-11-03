// v34（我的补充）：拆解指南数据检查（类似电路仿真工具给 diagram 文件做 lint 的思路，代码是本项目自己写的）。
// 逐台设备检查：id 唯一、只收 ≤ 24 V 直流、有电池的设备安全须知里有“电池先处理”、难度 1–5 / 时间 > 0、
// 每一步中英文都有、插图引用的图层存在、至少一个停止点、模块指向的零件在零件库里、爆炸图模块 key 唯一。
// 用法：node scripts/guide-lint.mjs   （有问题时退出码 1）
import fs from "node:fs";
const { DEVICES } = await import("../src/teardown/devices.js");
const idx = JSON.parse(fs.readFileSync(new URL("../public/lib/index.json", import.meta.url), "utf8"));
const known = new Set(idx.parts.map((p) => p[0]));
// 程序生成零件的 id 列表来自 .tmp/proc-bundle.mjs（sh scripts/engine-test.sh elec-bundle-only 会生成）
let proc = new Set();
try { proc = new Set((await import("../.tmp/proc-bundle.mjs")).PROCEDURAL.map((d) => d.id)); } catch { console.log("（没有 .tmp/proc-bundle.mjs，先跑 sh scripts/engine-test.sh elec-bundle-only）"); process.exit(2); }
const exists = (id) => known.has(id) || proc.has(id);
const both = (x) => x && typeof x.zh === "string" && x.zh.trim() && typeof x.en === "string" && x.en.trim();
const probs = [], seen = new Set();
for (const d of DEVICES) {
  const bad = (m) => probs.push(`${d.id}: ${m}`);
  if (seen.has(d.id)) bad("id 重复"); seen.add(d.id);
  if (!(d.volts > 0 && d.volts <= 24)) bad(`电压 ${d.volts} V 不在 0–24 V 直流范围`);
  if (!both(d.name) || !both(d.summary)) bad("名称或简介缺中文 / 英文");
  if (!(d.difficulty >= 1 && d.difficulty <= 5) || !(d.minutes > 0)) bad(`难度 ${d.difficulty} / 时间 ${d.minutes} 分钟不合理`);
  if (!d.materials?.length || !d.materials.every(both)) bad("工具材料清单为空或缺译文");
  if (d.battery && !d.safety?.some((s) => s.zh.includes("电池先处理"))) bad("有电池但安全须知里没有“电池先处理”");
  const layers = new Set((d.fig || []).map((f) => f.id));
  if (layers.size !== (d.fig || []).length) bad("插图图层 id 重复");
  if ((d.steps || []).length < 3) bad("步骤少于 3 步");
  let stops = 0;
  (d.steps || []).forEach((s, i) => {
    if (!both(s.t) || !both(s.d)) bad(`第 ${i + 1} 步缺中文 / 英文`);
    if (s.stop) { stops++; if (!both(s.stop)) bad(`第 ${i + 1} 步停止点缺译文`); }
    for (const k of [...(s.fig?.hi || []), ...Object.keys(s.fig?.off || {})]) if (!layers.has(k)) bad(`第 ${i + 1} 步插图引用了不存在的图层 ${k}`);
  });
  if (!stops) bad("没有停止点");
  const keys = new Set();
  for (const m of d.modules || []) {
    if (keys.has(m.key)) bad(`模块 key ${m.key} 重复`); keys.add(m.key);
    if (!["same", "similar", "approx"].includes(m.match)) bad(`模块 ${m.key} 的 match=${m.match} 不认识`);
    if (!exists(m.part)) bad(`模块 ${m.key} 指向的零件 ${m.part} 在零件库里找不到`);
    if (!both(m.t)) bad(`模块 ${m.key} 缺译文`);
  }
}
console.log(JSON.stringify({ devices: DEVICES.length, steps: DEVICES.reduce((a, d) => a + d.steps.length, 0), modules: DEVICES.reduce((a, d) => a + (d.modules || []).length, 0), problems: probs.length }));
for (const p of probs) console.log("✗", p);
process.exit(probs.length ? 1 : 0);
