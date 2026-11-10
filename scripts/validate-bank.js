// 题库静态校验：id 唯一、必填字段、index 与文件一致、staleCount 可独立复算。
import { join } from "node:path";
import { DATA, MODES, DIFFICULTIES, readJSON, log } from "./bank/lib.js";
import { computeFreshness } from "./build-bank.js";

export function validateBank({ dataDir = DATA, now = Date.now(), bankDir } = {}) {
  const dir = bankDir || join(dataDir, "bank");
  const errors = [];
  const index = readJSON(join(dir, "index.json"));
  if (!index) return { ok: false, errors: ["缺少 index.json"] };
  let total = 0;
  const ids = new Set();
  for (const mode of MODES) {
    if (!index.modes?.[mode]) { errors.push(`index 缺少 mode ${mode}`); continue; }
    for (const diff of DIFFICULTIES) {
      const meta = index.modes[mode][diff];
      const entries = readJSON(join(dir, mode, `${diff}.json`));
      if (!Array.isArray(entries)) { errors.push(`缺少 ${mode}/${diff}.json`); continue; }
      total += entries.length;
      if (!meta) { errors.push(`index 缺少 ${mode}/${diff}`); continue; }
      for (const k of ["count", "updatedAt", "staleEarliest", "staleLatest", "staleCount"]) {
        if (!(k in meta)) errors.push(`${mode}/${diff} 缺少字段 ${k}`);
      }
      if (meta.count !== entries.length) errors.push(`${mode}/${diff} count=${meta.count} 但文件有 ${entries.length} 条`);
      const fresh = computeFreshness(entries, now);
      if (fresh.staleCount !== meta.staleCount) errors.push(`${mode}/${diff} staleCount=${meta.staleCount} 复算为 ${fresh.staleCount}`);
      if (fresh.staleEarliest !== meta.staleEarliest) errors.push(`${mode}/${diff} staleEarliest 不一致`);
      if (fresh.staleLatest !== meta.staleLatest) errors.push(`${mode}/${diff} staleLatest 不一致`);
      for (const e of entries) {
        if (!e.id) errors.push(`${mode}/${diff} 有条目没有 id`);
        else if (ids.has(e.id)) errors.push(`重复 id ${e.id}`);
        else ids.add(e.id);
        if (!e.source) errors.push(`${e.id} 缺少 source`);
        if (!e.difficulty) errors.push(`${e.id} 缺少 difficulty`);
        if (!e.staleAfter) errors.push(`${e.id} 缺少 staleAfter`);
        if (!e.passCondition?.type) errors.push(`${e.id} 缺少 passCondition.type`);
        if (e.mode && e.mode !== mode) errors.push(`${e.id} mode 字段与目录不一致`);
      }
    }
  }
  if (index.total !== total) errors.push(`index.total=${index.total} 但合计 ${total}`);
  if (total === 0) errors.push("题库 0 条");
  return { ok: errors.length === 0, errors, total };
}

function main() {
  const r = validateBank();
  if (!r.ok) { console.error("validate-bank 失败：\n" + r.errors.join("\n")); process.exit(1); }
  log(`validate-bank：${r.total} 条通过`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
