// v38 题库管线公共工具（docs/problem-bank-pipeline.md）。纯 Node，无外部依赖。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA = process.env.BANK_DATA ? resolve(process.env.BANK_DATA) : join(ROOT, "data");
export const CACHE = process.env.BANK_CACHE ? resolve(process.env.BANK_CACHE) : join(ROOT, ".cache/bank");
export const MODES = ["firmware", "workbench", "assembly", "diagnosis", "code-check"];
export const DIFFICULTIES = ["intro", "intermediate", "advanced"];
export const ORIGIN = "geohot/fromthetransistor";

export const hash = (s) => (s == null ? null : createHash("sha256").update(String(s)).digest("hex"));
export function readFileSafe(p) { try { return readFileSync(p, "utf8"); } catch { return null; } }
export function readJSON(p, dflt = null) { const s = readFileSafe(p); if (s == null) return dflt; try { return JSON.parse(s); } catch { return dflt; } }
export function writeJSON(p, v) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); }
export const exists = existsSync;

// 去重键：normalize(title + language + locEstimate)
export function normalize(s) {
  return String(s).toLowerCase().normalize("NFKC").replace(/[’'`"“”]/g, "").replace(/[^a-z0-9\u4e00-\u9fff+#]+/g, " ").trim().replace(/\s+/g, " ");
}
export const dedupeKey = (p) => normalize(`${p.title} ${p.language || ""} ${p.locEstimate ?? ""}`);

// 5.5 难度：LOC 1–50 intro，51–300 intermediate，301+ advanced；code-check 多文件/多阶段上调一级
export function difficultyForLoc(loc, { bumpMultiStage = false } = {}) {
  // 我的补充：原版 Section 7「Building an FPGA board」「Bringup」没有 LOC；spec 没规定，这里按 intermediate 处理
  // （硬件板级任务不算入门），并在 docs 里注明。
  let d = loc == null ? 1 : loc <= 50 ? 0 : loc <= 300 ? 1 : 2;
  if (bumpMultiStage) d = Math.min(2, d + 1);
  return DIFFICULTIES[d];
}
// 5.5 故障种子：按失效模式复杂度
export const FAULT_DIFFICULTY = {
  "reverse-polarity": "intro", "connector-misinsert": "intro", "stripped-screw": "intro",
  "cold-solder": "intermediate", "pad-lift": "intermediate", "harness-overbend": "intermediate",
  "thermal-failure": "advanced", "imc-thick": "advanced", "intermittent-multi": "advanced",
};

// 2.5 项目特征 → 允许的练习模式（确定性关键词规则；一个项目可能命中多个模式）
export function modesForProject(p) {
  const t = normalize(`${p.title} ${p.language || ""}`);
  const m = new Set();
  if (/\b(assembler|compiler|linker|bootrom|assembly)\b/.test(t) || p.language === "Assembler") m.add("code-check");
  if (/\b(uart|mmio|ethernet|sd card|jtag|fpga|serial|pin)\b/.test(t)) m.add("workbench");
  if (/\b(board|reflow|bga|bringup)\b/.test(t)) m.add("assembly");
  if (/\b(led|blink|uart|bootloader|timer|telnetd)\b/.test(t)) m.add("firmware");
  if (/\b(c|libc|malloc)\b/.test(t) && p.language === "C") m.add("code-check");
  return [...m];
}
// 多文件/多阶段输出的 code-check 项目（assembler→binary→linker、compiler→asm）
export const isMultiStage = (p) => /\b(compiler|linker|dynamic linking)\b/.test(normalize(p.title));

// 我的补充：内容不变时保留上次的时间戳，避免 workflow 每次都产生一个只改时间的提交
export function writeJSONStable(p, v, key = "generatedAt") {
  const prev = readJSON(p);
  const strip = (o) => JSON.stringify({ ...o, [key]: null });
  if (prev && strip(prev) === strip(v)) v = { ...v, [key]: prev[key] };
  writeJSON(p, v);
  return v[key];
}
export function stamp() { return new Date().toISOString(); }
export function log(...a) { if (!process.env.QUIET) console.log(...a); }
