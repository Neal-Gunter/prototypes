// v42：在题库构建时，把题目和所在学习路径步骤互相对上。没有命中的题目不出现在映射里。
import { PATHS, pathStepHref } from "./paths.js";

function itemScene(item) {
  const pc = item?.passCondition || {};
  if (pc.scenario) return String(pc.scenario);
  const url = String(pc.repairUrl || "");
  const m = url.match(/[?&]s=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function pushUnique(arr, rec, keyFn) {
  const k = keyFn(rec);
  if (arr.some((x) => keyFn(x) === k)) return;
  arr.push(rec);
}

/** Build item→path-step links and per-step related bank items. Only include items that exist. */
export function buildPathMap(paths = PATHS, items = []) {
  const byId = new Map((items || []).filter((it) => it && it.id).map((it) => [it.id, it]));
  const pathLinks = {};

  for (const path of paths || []) {
    (path.steps || []).forEach((st, i) => {
      if (st.kind !== "bank" || !st.id || !byId.has(st.id)) return;
      const rec = {
        pathId: path.id,
        step: i,
        kind: st.kind,
        title: path.title,
        titleEn: path.titleEn,
        stepTitle: st.title,
        stepTitleEn: st.titleEn,
        href: pathStepHref(st, path.id),
      };
      if (!pathLinks[st.id]) pathLinks[st.id] = [];
      pushUnique(pathLinks[st.id], rec, (x) => `${x.pathId}:${x.step}`);
    });
  }

  const pathStepBank = {};
  for (const path of paths || []) {
    const onPath = [];
    for (const st of path.steps || []) {
      if (st.kind === "bank" && byId.has(st.id)) {
        const it = byId.get(st.id);
        pushUnique(onPath, { id: it.id, mode: it.mode, diff: it.difficulty || it.diff, title: it.title, titleEn: it.titleEn }, (x) => x.id);
      }
    }
    pathStepBank[path.id] = (path.steps || []).map((st) => {
      // Every step lists the bank items that appear on this path.
      // The UI hides the current item on a bank step, and hides the block when nothing remains.
      return onPath.map((x) => ({ ...x }));
    });
  }

  return { pathLinks, pathStepBank };
}

export function attachPathMap(index, map) {
  const next = { ...(index || {}) };
  next.pathLinks = map.pathLinks || {};
  next.pathStepBank = map.pathStepBank || {};
  return next;
}

// itemScene is kept for tests / possible later related-by-scene use; not currently auto-linked
export { itemScene };

/** Client-side fallback if index.json has not loaded yet. Titles come from the path steps. */
export function pathLinksFromPaths(paths = PATHS) {
  return buildPathMap(paths, (paths || []).flatMap((pa) => (pa.steps || []).filter((st) => st.kind === "bank" && st.id).map((st) => ({
    id: st.id, mode: st.mode, difficulty: st.diff, title: st.title, titleEn: st.titleEn,
  })))).pathLinks;
}

export function pathStepBankFromPaths(paths = PATHS) {
  return buildPathMap(paths, (paths || []).flatMap((pa) => (pa.steps || []).filter((st) => st.kind === "bank" && st.id).map((st) => ({
    id: st.id, mode: st.mode, difficulty: st.diff, title: st.title, titleEn: st.titleEn,
  })))).pathStepBank;
}
