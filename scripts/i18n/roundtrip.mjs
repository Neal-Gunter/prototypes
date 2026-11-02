// v30（我的补充）：往返检查入口。取 readability-test 同一批 200 条抽样（固定种子），
// 调 roundtrip.py（离线 Argos en→zh）译回中文，按相似度从低到高列出最差的 TOP 条，写到 LOG（默认 /tmp/roundtrip.log）。
// 没装 Argos（mtenv）时跳过、不算失败。只报告、不判失败：相似度低不一定是错译，要人看。
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { SAMPLE } from "./readability-test.mjs";
const PY = process.env.MTPY || "/workspace/mtenv/bin/python", TOP = +(process.env.TOP || 25);
if (!fs.existsSync(PY)) { console.log("roundtrip：没有离线翻译环境，跳过"); process.exit(0); }
fs.mkdirSync(".tmp", { recursive: true });
const rows = SAMPLE(); fs.writeFileSync(".tmp/rt-in.json", JSON.stringify(rows));
const r = spawnSync(PY, [new URL("./roundtrip.py", import.meta.url).pathname, ".tmp/rt-in.json", ".tmp/rt-out.json"], { stdio: ["ignore", "ignore", "pipe"] });
if (r.status !== 0) { console.log("roundtrip.py 失败", String(r.stderr).slice(-400)); process.exit(1); }
const out = JSON.parse(fs.readFileSync(".tmp/rt-out.json", "utf8")).sort((a, b) => a.sim - b.sim);
const mean = out.reduce((s, x) => s + x.sim, 0) / out.length, low = out.filter((x) => x.sim < 0.2).length;
const head = `往返检查（中→英→中，${out.length} 条）：平均相似度 ${mean.toFixed(3)} · 低于 0.2 的 ${low} 条`;
fs.writeFileSync(process.env.LOG || "/tmp/roundtrip.log", head + "\n" + out.slice(0, TOP).map((x, i) => `${i + 1}. ${x.sim}  ${x.zh.slice(0, 80)}\n   英：${x.en.slice(0, 120)}\n   回：${x.back.slice(0, 80)}`).join("\n") + "\n");
console.log(head);
