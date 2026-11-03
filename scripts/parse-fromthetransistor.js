// 2.2–2.4：每个 fork 先读 override，再回退自动解析；跨 fork 去重（保留优先级最高的来源，其余写 alsoFoundIn）。
// 输出只含事实（标题 / 语言 / LOC / Section），写到 data/meta/ftt-projects.json（已提交，离线构建的兜底）。
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { CACHE, DATA, ORIGIN, readJSON, writeJSONStable, dedupeKey, stamp, log } from "./bank/lib.js";
import { parseReadme } from "./bank/ftt-parsers.js";
import { cacheName } from "./fetch-sources.js";

export function overridePath(repo, data = DATA) { return join(data, "overrides/fromthetransistor", repo.replace("/", "__") + ".json"); }

// forks 已按优先级排序（原版第一，其余星数降序）
export function mergeForks(forks, readReadme, readOverride) {
  const byKey = new Map(), perFork = [], skipped = [];
  forks.forEach((f, prio) => {
    const ov = readOverride(f.repo);
    let projects, via, format = null, tried = [];
    if (ov?.projects?.length) { projects = ov.projects; via = "override"; }
    else {
      const md = readReadme(f.repo);
      if (md == null) { skipped.push({ repo: f.repo, _skipped: true, reason: "no-readme" }); return; }
      ({ projects, format, tried } = parseReadme(md));
      via = "auto";
      if (!projects.length) { skipped.push({ repo: f.repo, _skipped: true, reason: "parse-failed", tried }); return; }
    }
    perFork.push({ repo: f.repo, via, format, count: projects.length });
    for (const p of projects) {
      const key = dedupeKey(p);
      const hit = byKey.get(key);
      if (!hit) byKey.set(key, { key, ...p, source: { repo: f.repo, path: p.section, via, priority: prio, alsoFoundIn: [] } });
      else if (hit.source.repo !== f.repo && !hit.source.alsoFoundIn.includes(f.repo)) hit.source.alsoFoundIn.push(f.repo);
    }
  });
  return { projects: [...byKey.values()], perFork, skipped };
}

function main() {
  const forksDoc = readJSON(join(DATA, "meta/forks.json")) || { forks: [{ repo: ORIGIN }] };
  const cacheDir = join(CACHE, "ftt");
  const out = join(DATA, "meta/ftt-projects.json");
  if (!existsSync(cacheDir)) {
    const prev = readJSON(out);
    log(`parse-fromthetransistor：没有 README 缓存（离线），沿用已提交的 ${prev?.projects?.length ?? 0} 个项目事实`);
    if (!prev) throw new Error("离线且没有 ftt-projects.json 快照");
    return;
  }
  const readReadme = (repo) => { const p = join(cacheDir, cacheName(repo)); return existsSync(p) ? readFileSync(p, "utf8") : null; };
  const readOverride = (repo) => readJSON(overridePath(repo));
  const r = mergeForks(forksDoc.forks, readReadme, readOverride);
  const formats = {};
  for (const f of r.perFork) formats[f.via === "override" ? "override" : f.format] = (formats[f.via === "override" ? "override" : f.format] || 0) + 1;
  writeJSONStable(out, { generatedAt: stamp(), note: "只含标题 / 语言 / LOC / Section 事实，不含原文描述", forks: forksDoc.forks.length, parsedForks: r.perFork.length, formats, skipped: r.skipped, projects: r.projects.map(({ key, ...p }) => p) });
  log(`parse-fromthetransistor：${r.perFork.length} 个 fork 解析成功（${JSON.stringify(formats)}），_skipped ${r.skipped.length} 个，去重后 ${r.projects.length} 个项目`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
