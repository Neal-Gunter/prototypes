// 2.1 fork 自动发现。在线：GitHub API 分页列出所有 fork；离线或失败：保留已提交的 data/meta/forks.json。
// 我的补充（修 spec 示例代码）：
//  - 没有 token 时不发 Authorization 头（spec 会发出 "token undefined" 导致 401）；token 只从环境变量读，不打印
//  - 检查 res.ok（限流时 API 返回对象而不是数组，spec 会静默当成“没有更多”）
//  - stars: Infinity 在 JSON 里会变成 null，改成 original: true + 真实星数，排序时原版永远第一
//  - spec 写了“其余按星数降序”但代码没排序，这里补上；并记录 forks_count 方便核对覆盖率
import { join } from "node:path";
import { DATA, ORIGIN, readJSON, writeJSON, writeJSONStable, stamp, log } from "./bank/lib.js";

const OUT = join(DATA, "meta/forks.json");
const MAX_PAGES = +(process.env.MAX_FORK_CALLS || 120); // API 调用上限（无 token 时 60 次/小时）
const MAX_DEPTH = +(process.env.MAX_FORK_DEPTH || 3);

function headers() {
  const h = { Accept: "application/vnd.github+json", "User-Agent": "prototypes-bank" };
  const tok = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (tok) h.Authorization = `Bearer ${tok}`;
  return h;
}

export async function discoverForks({ fetchImpl = globalThis.fetch, maxPages = MAX_PAGES } = {}) {
  const r0 = await fetchImpl(`https://api.github.com/repos/${ORIGIN}`, { headers: headers() });
  if (!r0.ok) throw new Error(`repo HTTP ${r0.status}`);
  const meta = await r0.json();
  const forks = [];
  let truncated = false, calls = 1;
  const missing = []; // 子 fork 列表 404（已删除/转私有）：记下来，不阻断
  // 我的补充：GitHub 的 /forks 只列直接 fork；forks_count>0 的 fork 再往下找（最多 MAX_DEPTH 层），覆盖“fork 的 fork”
  const queue = [{ repo: ORIGIN, depth: 0 }];
  while (queue.length) {
    const { repo, depth } = queue.shift();
    for (let page = 1; ; page++) {
      if (calls >= maxPages) { truncated = true; break; }
      calls++;
      const res = await fetchImpl(`https://api.github.com/repos/${repo}/forks?per_page=100&sort=stargazers&page=${page}`, { headers: headers() });
      if (!res.ok) { if (repo === ORIGIN) throw new Error(`forks page ${page} HTTP ${res.status}`); missing.push(repo); break; }
      const batch = await res.json();
      if (!Array.isArray(batch)) throw new Error(`forks ${repo} page ${page} 不是数组`);
      for (const f of batch) {
        forks.push({ repo: f.full_name, branch: f.default_branch, stars: f.stargazers_count, pushedAt: f.pushed_at, parent: repo === ORIGIN ? undefined : repo });
        if (f.forks_count > 0 && depth + 1 < MAX_DEPTH) queue.push({ repo: f.full_name, depth: depth + 1 });
      }
      if (batch.length < 100) break;
    }
    if (truncated) break;
  }
  const seen = new Set([ORIGIN]);
  const uniq = forks.filter((f) => !seen.has(f.repo) && seen.add(f.repo));
  uniq.sort((a, b) => b.stars - a.stars || a.repo.localeCompare(b.repo));
  uniq.unshift({ repo: ORIGIN, branch: meta.default_branch || "master", stars: meta.stargazers_count, pushedAt: meta.pushed_at, original: true });
  return { forks: uniq, forksCount: meta.forks_count, truncated, missing };
}

async function main() {
  const prev = readJSON(OUT);
  if (process.env.BANK_OFFLINE === "1") {
    if (!prev) writeJSON(OUT, { generatedAt: stamp(), mode: "offline-seed", forksCount: null, count: 1, forks: [{ repo: ORIGIN, branch: "master", stars: null, original: true }] });
    log(`discover-forks：离线，沿用 ${prev ? prev.count : 1} 个`); return;
  }
  try {
    const { forks, forksCount, truncated, missing } = await discoverForks();
    writeJSONStable(OUT, { generatedAt: stamp(), mode: "live", forksCount, truncated, missing, count: forks.length, forks });
    log(`discover-forks：在线发现 ${forks.length} 个（含原版；API forks_count=${forksCount}${truncated ? "，已截断" : ""}）`);
  } catch (e) {
    log(`discover-forks：在线失败（${e.message}），沿用已提交的 forks.json`);
    if (!prev) writeJSON(OUT, { generatedAt: stamp(), mode: "offline-seed", forksCount: null, count: 1, forks: [{ repo: ORIGIN, branch: "master", stars: null, original: true }] });
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
