// v28：英文译文抽样可读性测试。按固定种子从 en-mt.json 抽 50 条，逐条查明显的坏译：
// 残留汉字、空译文、长度比离谱、数字丢失、词语重复、全大写乱码、括号不配对、Markdown 前缀丢失。
// 只能抓“明显坏掉”的，抓不到“意思译错”（那要人看）。输出 50 条原文 / 译文 / 结果，写到 LOG（默认 /tmp/readability.log）。
import fs from "node:fs";
import { TERM_FIX } from "./terms.mjs";
const j = JSON.parse(fs.readFileSync(new URL("../../public/i18n/en-mt.json", import.meta.url)));
const hand = JSON.parse(fs.readFileSync(new URL("./hand.json", import.meta.url)));
const N = +(process.env.N || 50), SEED = +(process.env.SEED || 28);
let s = SEED >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const all = Object.entries(j.dict).filter(([k, v]) => /[\u4e00-\u9fff]/.test(k) && v && v !== k).sort((a, b) => (a[0] < b[0] ? -1 : 1));
const pick = new Set(); while (pick.size < Math.min(N, all.length)) pick.add(Math.floor(rnd() * all.length));
const cjk = (t) => (t.match(/[\u4e00-\u9fff]/g) || []).length;
const nums = (t) => (t.match(/\d+(?:\.\d+)?/g) || []);
const pairs = [["(", ")"], ["[", "]"], ["{", "}"]];
const norm = (t) => t.replace(/（/g, "(").replace(/）/g, ")").replace(/【/g, "[").replace(/】/g, "]");
export function check(zh, en) {
  const bad = [];
  if (!en.trim()) bad.push("空译文");
  // 手译里故意保留的原文（文件名、括号里的原名、语言切换按钮“中文”）不算残留
  if (cjk(en) && !hand[zh]) bad.push("残留汉字 " + cjk(en));
  const zl = cjk(zh) + zh.replace(/[\u4e00-\u9fff]/g, "").length * 0.5;
  if (zl >= 6) { const r = en.length / zl; if (r < 0.6 || r > 9) bad.push("长度比 " + r.toFixed(2)); }
  const en2 = en.replace(/(\d),(\d{3})/g, "$1$2");
  for (const n of nums(zh)) if (!en2.includes(n) && !(n === "0" && /\b(none|no|zero)\b/i.test(en)) && !(n === "1" && /\b(one|a|an)\b/i.test(en)) && !(n === "2" && /\b(two|both|twice)\b/i.test(en)) && !(n === "3" && /\b(three)\b/i.test(en))) { bad.push("丢数字 " + n); break; }
  // 相邻重复（“soldering soldering”）；“item-by-item / one by one”这类正常说法不算
  const rep = en.match(/\b([a-z]{3,})\s+\1\b/i);
  if (rep && !zh.toLowerCase().includes(rep[1].toLowerCase()) && !/^(that|had|very|bye)$/i.test(rep[1])) bad.push("重复词 " + rep[1]);
  const caps = en.match(/\b[A-Z]{3,}\b(?:\s+\b[A-Z]{3,}\b){3,}/g);
  if (caps && !caps.every((c) => zh.includes(c))) bad.push("全大写串");
  const zn = norm(zh);
  // 原文本身是半截（括号没闭合）时译文补齐不算错；只抓“原文配对、译文不配对”
  for (const [o, c] of pairs) { const d = en.split(o).length - en.split(c).length, dz = zn.split(o).length - zn.split(c).length; if (d !== 0 && dz === 0) { bad.push(`括号 ${o}${c} 不配对`); break; } }
  // 机翻常见的“凭空加话”（原文没有的口头语 / 套话）
  const filler = /\b(I don't know|I'm not sure|I do not know|Nonetheless|the following are the following|we all do|you know what|Oh, my God|I'm sorry|Thank you|Okay|Yeah|Well, )/i;
  const fm = en.match(filler); if (fm && !/谢|抱歉|不知道|不认识|读不懂|好的/.test(zh)) bad.push("凭空加话 " + fm[0]);
  for (const [z, re] of TERM_FIX) if (zh.includes(z) && new RegExp(re.source, re.flags.replace("g", "")).test(en)) { bad.push("错误术语 " + en.match(new RegExp(re.source, re.flags.replace("g", "")))[0]); break; }
  const mz = zh.match(/^#+/), me = en.match(/^#+/);
  if (mz && (!me || me[0] !== mz[0])) bad.push("Markdown 标题前缀丢失");
  return bad;
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const out = []; let fail = 0, i = 0;
  for (const idx of [...pick].sort((a, b) => a - b)) {
    const [zh, en] = all[idx]; const bad = check(zh, en); if (bad.length) fail++;
    out.push(`${String(++i).padStart(2)} ${bad.length ? "✗" : "✓"} ${hand[zh] ? "[手译]" : "[机翻]"} ${zh.slice(0, 80)}\n     → ${en.slice(0, 120)}${bad.length ? "\n     问题：" + bad.join("；") : ""}`);
  }
  const head = `可读性抽样（种子 ${SEED}，从 ${all.length} 条译文里抽 ${pick.size} 条）：${pick.size - fail} 条没发现明显问题，${fail} 条有问题`;
  fs.writeFileSync(process.env.LOG || "/tmp/readability.log", head + "\n" + out.join("\n") + "\n");
  // 全库扫一遍同样的检查，给出比例（机翻的问题主要在这里）
  let fa = 0; const kinds = {}; for (const [zh, en] of all) { const b = check(zh, en); if (b.length) { fa++; for (const k of b) { const t = k.split(" ")[0]; kinds[t] = (kinds[t] || 0) + 1; } } }
  console.log(head);
  console.log(`全库 ${all.length} 条：${fa} 条（${(fa / all.length * 100).toFixed(1)}%）触发检查`, JSON.stringify(kinds));
  const MAX = +(process.env.MAX_FAIL ?? 5);
  console.log(fail <= MAX ? `readability-test ok（抽样问题 ${fail} ≤ ${MAX}）` : `readability-test FAIL（抽样问题 ${fail} > ${MAX}）`);
  process.exit(fail <= MAX ? 0 : 1);
}
