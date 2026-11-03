// 6. 故障种子：纯规则管线（不调用 LLM、不需要任何 API 密钥）。
// 输入：data/meta/fault-sources.json 里每个来源的 notes（自己的话写的概述）；link-only 来源只有 标题 + 失效模式名称。
// 我的补充：LLIS 是单页应用，curl 拿不到正文；NASA PDF 也不在 CI 里解析，所以分类器跑在自己写的概述上，
// 这样构建可离线、可重复；来源链接全部保留在 seed.source.ref 里。
import { join } from "node:path";
import { DATA, readJSON, writeJSON, log } from "./bank/lib.js";

export const FAILURE_PATTERNS = [
  { failureMode: "cold-solder", keywords: ["cold solder", "cold joint", "虚焊", "冷焊", "dull joint", "poor wetting"], symptomHints: ["intermittent", "vibration", "间歇"], injectType: "solder-joint", faultTypes: ["coldJoint"] },
  { failureMode: "reverse-polarity", keywords: ["reverse polarity", "reversed polarity", "reversed", "反接", "polarised"], symptomHints: ["no power", "protection", "not light", "不上电", "不亮"], injectType: "component-orientation", faultTypes: ["reversed"] },
  { failureMode: "pad-lift", keywords: ["pad lift", "lifted pad", "焊盘起翘", "detaches the pad"], symptomHints: ["open", "detached"], injectType: "solder-pad", faultTypes: ["crackedTrace"] },
  { failureMode: "connector-misinsert", keywords: ["misinsert", "mismate", "排线反插", "连接器误插", "wrong half", "swapped"], symptomHints: ["no output", "wrong or no output", "short"], injectType: "connector", faultTypes: ["looseConn"] },
  { failureMode: "stripped-screw", keywords: ["stripped screw", "overtighten", "滑牙"], symptomHints: ["loose"], injectType: "fastener", faultTypes: [] },
  { failureMode: "thermal-failure", keywords: ["thermal", "thermal shutdown", "overheat", "热失效", "过温", "thermal excursion"], symptomHints: ["drift", "参数漂移", "dropout"], injectType: "power-component", faultTypes: ["wrongLdo"] },
  { failureMode: "harness-overbend", keywords: ["bend radius", "harness", "线束弯折", "flex"], symptomHints: ["open", "intermittent"], injectType: "harness", faultTypes: ["thinWire"] },
  // 我的补充：5.5 的难度表里有 IMC 过厚 / 间歇性多故障，但 6.3 没给规则，这里补上。
  { failureMode: "imc-thick", keywords: ["intermetallic", "imc", "金属间化合物"], symptomHints: ["brittle", "intermittent", "open"], injectType: "solder-joint", faultTypes: [] },
  { failureMode: "intermittent-multi", keywords: ["several faults", "multiple faults", "多故障"], symptomHints: ["intermittent"], injectType: "multi", faultTypes: ["__multi"] },
];

// 症状说明（自己写的，中英）
const SYMPTOM = {
  "cold-solder": { zh: ["间歇性工作", "轻敲或晃动后恢复"], en: ["works intermittently", "recovers when tapped or flexed"] },
  "reverse-polarity": { zh: ["上电无反应", "保护器件动作或发热"], en: ["no response at power-on", "protection part trips or heats"] },
  "pad-lift": { zh: ["焊点看着正常，但对应走线开路"], en: ["joint looks fine but the trace is open"] },
  "connector-misinsert": { zh: ["某一路没有输出或输出错位"], en: ["one channel has no or wrong output"] },
  "stripped-screw": { zh: ["固定不牢，振动后松动"], en: ["part not held, loosens under vibration"] },
  "thermal-failure": { zh: ["带载后输出下降或漂移"], en: ["output drops or drifts under load"] },
  "harness-overbend": { zh: ["线束弯折处间歇性断开"], en: ["intermittent open at a tight bend"] },
  "imc-thick": { zh: ["温度变化时出现开路"], en: ["opens appear with temperature change"] },
  "intermittent-multi": { zh: ["多个症状叠加，修一个还有一个"], en: ["several symptoms stack; fixing one leaves another"] },
};

import { FAULT_DIFFICULTY } from "./bank/lib.js";
export { FAULT_DIFFICULTY };

export function splitSentences(text) { return String(text || "").split(/(?<=[.!?。；;])\s+|\n+/).map((s) => s.trim()).filter(Boolean); }
const has = (hay, k) => (/^[\x00-\x7f]+$/.test(k) ? new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(hay) : hay.includes(k));

export function classify(text) {
  const sentences = splitSentences(text), out = [];
  for (const p of FAILURE_PATTERNS) {
    const kw = new Set(), sym = new Set();
    for (const s of sentences) {
      const k = p.keywords.filter((x) => has(s, x));
      if (!k.length) continue;
      k.forEach((x) => kw.add(x.toLowerCase()));
    }
    if (!kw.size) continue;
    // 我的补充：重叠关键词只算一次（"reversed polarity" 命中时不再额外算 "reversed"），避免一句话刷出 2 个关键词
    for (const a of [...kw]) for (const b of kw) if (a !== b && b.includes(a)) kw.delete(a);
    for (const s of sentences) p.symptomHints.filter((x) => has(s, x)).forEach((x) => sym.add(x.toLowerCase()));
    out.push({ failureMode: p.failureMode, injectType: p.injectType, matchedKeywords: [...kw], symptomHints: [...sym] });
  }
  return out;
}
// 我的补充：结果四舍五入到 2 位小数（0.1+0.2 浮点误差会让 0.3 档判断不稳）
export function scoreSeed(seed, context) {
  let score = 0;
  if (seed.matchedKeywords.length >= 2) score += 0.4;
  if (seed.symptomHints.length >= 1) score += 0.3;
  if (context.sourceType === "official-failure-report") score += 0.2;
  if (context.sourceType === "datasheet") score += 0.1;
  return Math.round(Math.min(score, 1) * 100) / 100;
}
export const tier = (s) => (s >= 0.7 ? "high" : s >= 0.4 ? "medium" : "low");

export function scenarioMap(scenarios) {
  const m = {};
  for (const s of scenarios) {
    const types = [...new Set(s.faults.map((f) => f.type))];
    const keys = types.length >= 2 ? ["__multi"] : types;
    for (const p of FAILURE_PATTERNS) if (p.faultTypes.some((t) => keys.includes(t))) (m[p.failureMode] ||= []).push(s.id);
  }
  return m;
}

// prior：上一次的 review 队列（保留人工复核状态）。status=promoted 的低分条目入库；status=rejected 的中分条目移出。
// 许可规则（我的补充，按任务要求）：link-only 来源（iFixit / EEVblog 等 CC 或版权内容）只保留链接和失效模式名，
// 永远不入库，即使被标成 promoted。
export function extract(sources, scenarios, extractedAt, prior = []) {
  const decided = new Map(prior.filter((r) => r.status && r.status !== "pending").map((r) => [`${r.source?.ref}|${r.failureMode}`, r]));
  const seeds = [], review = [], map = scenarioMap(scenarios), counter = {};
  for (const src of sources) {
    const text = src.type === "link-only" ? `${src.title}. ${src.failureModeName || ""}` : src.notes;
    for (const c of classify(text)) {
      const score = scoreSeed(c, { sourceType: src.type });
      const n = (counter[c.failureMode] = (counter[c.failureMode] || 0) + 1);
      const repair = map[c.failureMode] || [];
      const seed = {
        id: `fault-${c.failureMode}-${String(n).padStart(2, "0")}`,
        source: { type: src.type === "official-failure-report" ? "public-failure-analysis" : src.type, ref: src.id, url: src.url, title: src.title, license: src.license, extractedAt },
        failureMode: c.failureMode, matchedKeywords: c.matchedKeywords, symptomHints: c.symptomHints,
        symptom: SYMPTOM[c.failureMode].zh, symptomEn: SYMPTOM[c.failureMode].en,
        injectAt: { target: repair[0] || null, type: c.injectType },
        repairScenarios: repair,
        verification: { type: "faultRepaired", scenario: repair[0] || null },
        difficulty: FAULT_DIFFICULTY[c.failureMode], score, confidence: tier(score),
      };
      const d = decided.get(`${src.id}|${c.failureMode}`);
      const linkOnly = src.type === "link-only";
      const promoted = d?.status === "promoted" && !linkOnly, rejected = d?.status === "rejected";
      if (!linkOnly && !rejected && (seed.confidence !== "low" || promoted)) seeds.push(promoted ? { ...seed, promotedBy: d.promotedBy || "manual" } : seed);
      if (seed.confidence !== "high") review.push({ ...seed, reviewReason: linkOnly ? "仅链接来源：只保留链接与失效模式名，不入库" : seed.confidence === "low" ? "低分：只写 review，不入库" : "中分：已入库，同时待复核", status: d?.status || "pending", ...(d?.promotedBy ? { promotedBy: d.promotedBy } : {}) });
    }
  }
  return { seeds, review };
}

async function main() {
  const doc = readJSON(join(DATA, "meta/fault-sources.json"));
  if (!doc?.sources?.length) throw new Error("fault-sources.json 为空");
  const { SCENARIOS } = await import("../src/repair/scenarios.js");
  const prior = readJSON(join(DATA, "seeds/fault-seeds-review.json"))?.items || [];
  const { seeds, review } = extract(doc.sources, SCENARIOS, doc.checkedAt, prior);
  if (!seeds.length) throw new Error("故障种子 0 条，不覆盖已有产物");
  writeJSON(join(DATA, "seeds/fault-seeds.json"), { note: "纯规则提取（关键词 + 症状 + 来源类型打分）；症状文字为自己撰写", seeds });
  writeJSON(join(DATA, "seeds/fault-seeds-review.json"), { note: "review 队列：不阻断入库；把 status 改成 promoted 并写 promotedBy 即可手动提升", items: review });
  const by = (a, k) => a.reduce((o, x) => ((o[x[k]] = (o[x[k]] || 0) + 1), o), {});
  log(`extract-fault-seeds：入库 ${seeds.length}（${JSON.stringify(by(seeds, "confidence"))}），review ${review.length}（${JSON.stringify(by(review, "confidence"))}）`);
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
