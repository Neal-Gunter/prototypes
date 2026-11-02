// v27：把机翻结果 + 零件原英文名合成 public/i18n/en-mt.json（运行时英文模式懒加载）
import fs from "node:fs";
import { fixTerms } from "./terms.mjs";
const src = JSON.parse(fs.readFileSync(".tmp/i18n-src.json", "utf8"));
const dict = {};
// 第二版（mt2.py，已过质检）优先；null = 质检不合格，故意不翻
const v2 = fs.readdirSync(".tmp").filter((f) => /^i18n-v2-\d+\.json$/.test(f));
const files = v2.length ? v2 : fs.readdirSync(".tmp").filter((f) => /^i18n-mt-\d+\.json$/.test(f));
let rejected = 0;
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/, BAD = /session|discriminat|palestin|israel|occupied|assembly of|security council|secretar|committee|paragraph|rapporteur|delegation|united nations|human rights|punisher|instalment|amendment|government|republic|terroris|refugee|agenda|annex|♪|(.)\1{4,}/i;
// 原文里没有的全大写词（UNSCR、RACIAL、CIVILIAN……）几乎都是模型幻觉；常见技术缩写放行
const CAPS_OK = new Set("LED USB PCB GND VCC OK DC AC MCU IC SMD CAD PWM UART ID URL PDF JSON CSV PLA ABS IO RX TX ADC GPS IMU CPU RAM ROM TV PC II".split(" "));
function capsJunk(k, v) { for (const t of v.match(/\b[A-Z]{2,}\b/g) || []) if (!CAPS_OK.has(t) && !k.toUpperCase().includes(t)) return true; return false; }
// v28：机翻遇到以标点开头的半截句（“。工时”“）。先把……”）常凭空加一句口头语（I don't know. / I'm sorry. / Okay.）。
// 原文里没有对应意思的，删掉这些口头语，并把开头的中文标点换成英文标点；删完为空的宁可不翻
const FILL = /^[-–\s]*(?:I don't know|I'm sorry|I'm not sure|Yeah|Okay|It's okay|Nonetheless|You know what\??|The following are the following:?)[.,!?:;]*\s*/i;
const FILL_END = /[\s,.]*\b(?:Okay|Yeah)[.!]*$/i;
const LEAD = { "。": ". ", "）。": "). ", "”。": "\". ", "）": ") ", "：": ": ", "，": ", ", "、": ", " };
let cleaned = 0, termFixed = 0;
function unfill(k, v) {
  if (v == null || /不知道|不认识|读不懂|抱歉|对不起|好的|是的|然而/.test(k)) return v;
  let w = v, n = 0; while (FILL.test(w) && n++ < 3) w = w.replace(FILL, "");
  w = w.replace(FILL_END, (m) => (/[.!]$/.test(m) ? "." : ""));
  if (w === v) return v;
  cleaned++;
  if (!w.trim()) return null;
  const lead = Object.keys(LEAD).sort((x, y) => y.length - x.length).find((p) => k.startsWith(p));
  return (lead && !/^[.,:;)"]/.test(w) ? LEAD[lead] : "") + w;
}
for (const f of files) for (let [k, v] of Object.entries(JSON.parse(fs.readFileSync(".tmp/" + f, "utf8")))) {
  v = unfill(k, v); const v0 = v; v = fixTerms(k, v); if (v !== v0) termFixed++;
  if (v == null || CJK.test(v) || BAD.test(v) || capsJunk(k, v) || /\b(\w+)(?:\W+\1\b){3,}/i.test(v)) { rejected++; continue; } // 最后一道闸：含汉字或幻觉词的一律不要
  dict[k] = v;
}
let mtN = Object.keys(dict).length;
for (const [k, v] of Object.entries(src.exact)) dict[k] = v;
const hand = JSON.parse(fs.readFileSync("scripts/i18n/hand.json", "utf8")); delete hand._note; Object.assign(dict, hand); // 手写优先 // 零件名用原英文名，不机翻
// 只保留现在源码里还存在的片段
const keep = new Set([...Object.keys(hand), ...src.whole, ...src.runs, ...src.subs, ...Object.keys(src.exact)]);
for (const k of Object.keys(dict)) if (!keep.has(k)) delete dict[k];
const need = [...src.whole, ...src.runs, ...src.subs].filter((k) => !(k in dict));
const meta = { engine: "Argos Translate 1.9（离线），模型 translate-zh_en 1.9", note: "machine-assisted translation; part names use the original English names from the source libraries", generated: new Date().toISOString(), entries: Object.keys(dict).length, machine: mtN, exact: Object.keys(src.exact).length, untranslated: need.length, hand: Object.keys(hand).length, rejected_by_qc: rejected, filler_removed: cleaned, term_fixed: termFixed, qc: "译文不得含汉字；原文的型号 / 数字必须原样保留；不得出现原文没有的数字；黑名单幻觉词；不合格的宁可保留中文" };
fs.mkdirSync("public/i18n", { recursive: true });
fs.writeFileSync("public/i18n/en-mt.json", JSON.stringify({ meta, dict }));
console.log(JSON.stringify(meta), (fs.statSync("public/i18n/en-mt.json").size / 1024).toFixed(0) + " KB");
