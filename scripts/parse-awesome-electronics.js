// 1.2 awesome-electronics（CC0-1.0）作反馈知识库：只记 名称 + 链接 + 所在分类，不保存条目描述。
// 规则：按名称 / 分类 / 描述里的关键词判断“这个工具或教程覆盖哪个判断点”（描述只用来分类，不写出）。
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { CACHE, DATA, readJSON, writeJSON, writeJSONStable, stamp, log } from "./bank/lib.js";

const KEEP = /^(Learning|Simulators|Gerber Viewers|Free EDA Packages|EDA Packages)$/;
export const JUDGEMENT_RULES = [
  { point: "timing", re: /verilog|hdl|fpga|logic|digital|timing/i },
  { point: "circuit-sim", re: /spice|analog|circuit|simulat/i },
  { point: "gerber-check", re: /gerber|fab|manufactur/i },
  { point: "schematic-pcb", re: /eda|kicad|pcb|schematic|layout|board/i },
  { point: "soldering", re: /solder/i },
  { point: "theory", re: /theory|course|lecture|university|fundamental/i },
];
export function parseAwesome(md) {
  const out = []; let h2 = null, h3 = null;
  for (const line of md.split(/\r?\n/)) {
    let m;
    if ((m = /^##\s+(.+?)\s*$/.exec(line))) { h2 = m[1].trim(); h3 = null; continue; }
    if ((m = /^###\s+(.+?)\s*$/.exec(line))) { h3 = m[1].trim(); continue; }
    if (!h2 || !KEEP.test(h2)) continue;
    if (!(m = /^\s*[-*]\s+\[([^\]]+)\]\((https?:[^)\s]+)\)\s*(?:[-–—:]\s*(.*))?$/.exec(line))) continue;
    const [, name, url, desc = ""] = m;
    const hay = `${name} ${h2} ${h3 || ""} ${desc}`;
    const points = JUDGEMENT_RULES.filter((r) => r.re.test(hay)).map((r) => r.point);
    if (points.length) out.push({ name: name.trim(), url, section: h3 ? `${h2} / ${h3}` : h2, points });
  }
  return out;
}
function main() {
  const p = join(CACHE, "awesome-electronics.md"), out = join(DATA, "meta/ae-tools.json");
  if (!existsSync(p)) { const prev = readJSON(out); log(`parse-awesome-electronics：离线，沿用已提交的 ${prev?.tools?.length ?? 0} 条`); if (!prev) throw new Error("离线且没有 ae-tools.json 快照"); return; }
  const tools = parseAwesome(readFileSync(p, "utf8"));
  writeJSONStable(out, { generatedAt: stamp(), source: "https://github.com/kitspace/awesome-electronics", license: "CC0-1.0", note: "只记名称 + 链接 + 分类；判断点由关键词规则得出", tools });
  const by = {}; for (const t of tools) for (const q of t.points) by[q] = (by[q] || 0) + 1;
  log(`parse-awesome-electronics：${tools.length} 条（${JSON.stringify(by)}）`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
