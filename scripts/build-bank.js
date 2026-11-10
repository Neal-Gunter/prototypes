// 5 / 7：按 mode × difficulty 写出题库和 index.json；先写临时目录，失败或 0 条不覆盖已有产物。
import { cpSync, mkdtempSync, rmSync, renameSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ROOT, DATA, MODES, DIFFICULTIES, hash, readJSON, writeJSON, writeJSONStable, stamp, log,
} from "./bank/lib.js";

const SEEDS = join(DATA, "seeds/bank-items.json");
const DEST = join(DATA, "bank");
const PUBLIC = join(ROOT, "public/bank");
const REPORT = join(DATA, "meta/build-report.json");

// v39（我的补充）：内容 hash 只算题面，不算 alsoFoundIn、toolLinks、_stale 等元数据，
// 也不算注入的 awesome-electronics 提示。这样在线拉 fork 不会把 updatedAt 改掉。
export function problemTextOf(item) {
  const skip = new Set(["source", "toolLinks", "alsoFoundIn", "_stale"]);
  const out = {};
  for (const k of Object.keys(item).sort()) {
    if (skip.has(k)) continue;
    if (k === "hints") out.hints = (item.hints || []).filter((h) => !String(h).startsWith("相关公开工具"));
    else if (k === "hintsEn") out.hintsEn = (item.hintsEn || []).filter((h) => !String(h).startsWith("Related public tool"));
    else out[k] = item[k];
  }
  return out;
}
export function hashBankContent(entries) {
  const payload = entries.map(problemTextOf);
  return hash(JSON.stringify(payload)).slice(0, 16);
}

export function computeFreshness(entries, now) {
  let earliest = null, latest = null, staleCount = 0;
  for (const e of entries) {
    if (!e.staleAfter) continue;
    const t = Date.parse(e.staleAfter);
    if (Number.isNaN(t)) continue;
    if (earliest === null || t < earliest) earliest = t;
    if (latest === null || t > latest) latest = t;
    if (t < now) staleCount++;
  }
  return {
    staleEarliest: earliest !== null ? new Date(earliest).toISOString() : null,
    staleLatest: latest !== null ? new Date(latest).toISOString() : null,
    staleCount,
  };
}

function publicItem(item, now) {
  const { referenceFirmware, referenceAnswer, ...rest } = item;
  const t = item.staleAfter ? Date.parse(item.staleAfter) : NaN;
  return { ...rest, _stale: !Number.isNaN(t) && t < now };
}

function emptyBank() {
  const b = {};
  for (const m of MODES) {
    b[m] = {};
    for (const d of DIFFICULTIES) b[m][d] = [];
  }
  return b;
}

function attachFtt(item, projects) {
  const title = item.source?.originalProject;
  if (!title || !projects?.length) return item;
  const head = String(title).split("(")[0].trim().toLowerCase();
  const hits = projects.filter((p) => (p.title || "").trim().toLowerCase() === head || String(title).toLowerCase().includes((p.title || "").toLowerCase()));
  if (!hits.length) return item;
  const also = new Set(item.source.alsoFoundIn || []);
  for (const p of hits) {
    if (p.source?.repo && p.source.repo !== item.source.repo) also.add(p.source.repo);
    for (const x of p.source?.alsoFoundIn || []) if (x !== item.source.repo) also.add(x);
  }
  return { ...item, source: { ...item.source, alsoFoundIn: [...also] } };
}

function injectAeHints(item, tools) {
  if (!tools?.length) return item;
  const hay = `${item.title} ${item.prompt} ${(item.hints || []).join(" ")}`.toLowerCase();
  const want = [];
  if (/焊|solder|joint/.test(hay)) want.push("soldering");
  if (/仿真|simulat|circuit/.test(hay)) want.push("simulation");
  if (/原理图|eda|gerber/.test(hay)) want.push("eda");
  if (!want.length) return item;
  const picks = tools.filter((t) => (t.points || []).some((p) => want.includes(p))).slice(0, 2);
  if (!picks.length) return item;
  const extra = picks.map((t) => `相关公开工具（awesome-electronics，CC0 名录）：${t.name}`);
  const extraEn = picks.map((t) => `Related public tool (awesome-electronics, CC0 list): ${t.name}`);
  return { ...item, hints: [...(item.hints || []), ...extra], hintsEn: [...(item.hintsEn || []), ...extraEn], toolLinks: picks.map((t) => ({ name: t.name, url: t.url })) };
}

export function assembleItems(rawItems, { projects, tools, now }) {
  return rawItems.map((it) => injectAeHints(attachFtt(it, projects), tools));
}

export function groupBank(items, now) {
  const bank = emptyBank();
  const stale = [];
  for (const it of items) {
    if (!MODES.includes(it.mode)) throw new Error(`未知 mode ${it.mode}（${it.id}）`);
    if (!DIFFICULTIES.includes(it.difficulty)) throw new Error(`未知 difficulty ${it.difficulty}（${it.id}）`);
    if (!it.id || !it.source || !it.staleAfter) throw new Error(`条目缺少 id/source/staleAfter（${it.id}）`);
    const pub = publicItem(it, now);
    bank[it.mode][it.difficulty].push(pub);
    if (pub._stale) stale.push({ id: it.id, staleAfter: it.staleAfter });
  }
  for (const m of MODES) for (const d of DIFFICULTIES) bank[m][d].sort((a, b) => a.id.localeCompare(b.id));
  return { bank, stale };
}

export function buildIndex(bank, prevIndex, now, prevBank = null) {
  const generatedAt = new Date(now).toISOString();
  const next = { generatedAt, modes: {}, total: 0 };
  for (const mode of MODES) {
    next.modes[mode] = {};
    for (const diff of DIFFICULTIES) {
      const entries = bank[mode][diff];
      const prevUpdatedAt = prevIndex?.modes?.[mode]?.[diff]?.updatedAt;
      const contentHash = hashBankContent(entries);
      const prevEntries = prevBank?.[mode]?.[diff];
      const baseline = Array.isArray(prevEntries) ? hashBankContent(prevEntries) : prevIndex?.modes?.[mode]?.[diff]?.contentHash;
      const changed = contentHash !== baseline;
      const freshness = computeFreshness(entries, now);
      next.modes[mode][diff] = {
        count: entries.length,
        updatedAt: changed || !prevUpdatedAt ? generatedAt : prevUpdatedAt,
        contentHash,
        ...freshness,
      };
      next.total += entries.length;
    }
  }
  return next;
}

export function writeBankTree(dir, bank, index) {
  for (const mode of MODES) {
    mkdirSync(join(dir, mode), { recursive: true });
    for (const diff of DIFFICULTIES) writeJSON(join(dir, mode, `${diff}.json`), bank[mode][diff]);
  }
  writeJSON(join(dir, "index.json"), index);
}

function publish(from, dest) {
  const stage = dest + ".next";
  const bak = dest + ".bak";
  rmSync(stage, { recursive: true, force: true });
  rmSync(bak, { recursive: true, force: true });
  cpSync(from, stage, { recursive: true });
  if (existsSync(dest)) renameSync(dest, bak);
  renameSync(stage, dest);
  rmSync(bak, { recursive: true, force: true });
}

export function build({ now = Date.now(), dataDir = DATA, dest = join(dataDir, "bank"), publicDir = PUBLIC, seedsPath = join(dataDir, "seeds/bank-items.json") } = {}) {
  const report = { generatedAt: new Date(now).toISOString(), ok: false, errors: [], stale: [], counts: {}, total: 0 };
  const writeReport = () => writeJSON(join(dataDir, "meta/build-report.json"), report);
  try {
    const doc = readJSON(seedsPath);
    const raw = doc?.items;
    if (!raw?.length) throw new Error("种子题库 0 条");
    const ids = new Set();
    for (const it of raw) {
      if (ids.has(it.id)) throw new Error(`重复 id ${it.id}`);
      ids.add(it.id);
    }
    const projects = readJSON(join(dataDir, "meta/ftt-projects.json"))?.projects || [];
    const tools = readJSON(join(dataDir, "meta/ae-tools.json"))?.tools || [];
    const items = assembleItems(raw, { projects, tools, now });
    const { bank, stale } = groupBank(items, now);
    const total = MODES.reduce((n, m) => n + DIFFICULTIES.reduce((k, d) => k + bank[m][d].length, 0), 0);
    if (total === 0) throw new Error("分组后 0 条，不覆盖已有产物");
    const prevIndex = readJSON(join(dest, "index.json"));
    const prevBank = {};
    if (prevIndex) {
      for (const mode of MODES) {
        prevBank[mode] = {};
        for (const diff of DIFFICULTIES) prevBank[mode][diff] = readJSON(join(dest, mode, `${diff}.json`)) || [];
      }
    }
    const index = buildIndex(bank, prevIndex, now, prevIndex ? prevBank : null);
    const work = mkdtempSync(join(tmpdir(), "bank-"));
    try {
      writeBankTree(work, bank, index);
      report.ok = true;
      report.stale = stale;
      report.total = total;
      report.counts = Object.fromEntries(MODES.map((m) => [m, Object.fromEntries(DIFFICULTIES.map((d) => [d, bank[m][d].length]))]));
      report.index = index;
      publish(work, dest);
      if (publicDir) {
        mkdirSync(publicDir, { recursive: true });
        publish(work, publicDir);
      }
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
    writeReport();
    return { ok: true, index, total, stale, dest };
  } catch (e) {
    report.ok = false;
    report.errors.push(String(e.message || e));
    writeReport();
    throw e;
  }
}

function main() {
  try {
    const r = build();
    log(`build-bank：${r.total} 条，stale ${r.stale.length}，已写入 ${r.dest}`);
  } catch (e) {
    console.error(`build-bank 失败，已有题库未覆盖：${e.message}`);
    process.exit(1);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
