// 抓 README 到 .cache/bank（不提交：原文版权归各仓库作者）。data/meta/sources.json 只记 hash / 状态。
// 离线（BANK_OFFLINE=1 或网络失败）时什么都不抓，后续解析器回退到已提交的事实快照 data/meta/ftt-projects.json。
import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { CACHE, DATA, readJSON, writeJSON, hash, stamp, log } from "./bank/lib.js";

export const cacheName = (repo) => repo.replace("/", "__") + ".md";
const LIMIT = +(process.env.FETCH_FORKS || 1000), CONC = 8;

async function getReadme(repo, branch) {
  for (const b of [branch, "master", "main"].filter((x, i, a) => x && a.indexOf(x) === i))
    for (const f of ["README.md", "readme.md", "Readme.md", "README.markdown", "README"]) {
      const r = await fetch(`https://raw.githubusercontent.com/${repo}/${b}/${f}`).catch(() => null);
      if (r?.ok) return await r.text();
    }
  return null;
}

async function main() {
  const forks = (readJSON(join(DATA, "meta/forks.json"))?.forks || []).slice(0, LIMIT);
  const out = { generatedAt: stamp(), mode: "live", fromthetransistor: {}, awesomeElectronics: null };
  if (process.env.BANK_OFFLINE === "1") { log("fetch-sources：离线，跳过"); writeJSON(join(DATA, "meta/sources.json"), { ...(readJSON(join(DATA, "meta/sources.json")) || {}), lastOfflineRun: stamp() }); return; }
  mkdirSync(join(CACHE, "ftt"), { recursive: true });
  let ok = 0, miss = 0, i = 0;
  await Promise.all(Array.from({ length: CONC }, async () => {
    while (i < forks.length) {
      const f = forks[i++];
      const txt = await getReadme(f.repo, f.branch);
      if (txt == null) { miss++; out.fromthetransistor[f.repo] = { status: "missing" }; continue; }
      ok++;
      writeFileSync(join(CACHE, "ftt", cacheName(f.repo)), txt);
      out.fromthetransistor[f.repo] = { status: "ok", bytes: txt.length, sha256: hash(txt).slice(0, 16) };
    }
  }));
  const ae = await getReadme("kitspace/awesome-electronics", "master");
  if (ae) { writeFileSync(join(CACHE, "awesome-electronics.md"), ae); out.awesomeElectronics = { status: "ok", bytes: ae.length, sha256: hash(ae).slice(0, 16) }; }
  else out.awesomeElectronics = { status: "missing" };
  out.summary = { forks: forks.length, ok, missing: miss, distinctReadmes: new Set(Object.values(out.fromthetransistor).map((x) => x.sha256).filter(Boolean)).size };
  writeJSON(join(DATA, "meta/sources.json"), out);
  log(`fetch-sources：README ${ok} 个，缺 ${miss} 个，不同内容 ${out.summary.distinctReadmes} 种；awesome-electronics ${out.awesomeElectronics.status}`);
}
if (import.meta.url === `file://${process.argv[1]}`) main();
