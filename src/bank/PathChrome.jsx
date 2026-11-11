// v42：学习路径进度条、继续/重置，以及题目与路径步骤的互相链接。保持 v41 的纸、墨语言。
// v45：卡片上增加测验与自学记录入口；重置时一并清掉测验成绩和姓名。
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { findPath, stepKey } from "./paths.js";
import {
  loadPathProgress, pathStats, markPathStep, resetPathProgress, resumeHref,
  PATH_PROGRESS_EVENT, isStepDone,
} from "./progress.js";

export function usePathProgress() {
  const [prog, setProg] = useState(() => loadPathProgress());
  useEffect(() => {
    const sync = () => setProg(loadPathProgress());
    window.addEventListener("storage", sync);
    window.addEventListener(PATH_PROGRESS_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(PATH_PROGRESS_EVENT, sync);
    };
  }, []);
  return prog;
}

export function pathProgressLabel(done, total, en) {
  return en ? `Learning progress: ${done} of ${total} steps done` : `学习进度：已完成 ${done} / ${total} 步`;
}

export function PathProgressBar({ done, total, testid, label }) {
  const max = Math.max(0, Number(total) || 0);
  const now = Math.max(0, Math.min(max, Number(done) || 0));
  const pct = max ? Math.round((now / max) * 100) : 0;
  return (
    <div className="mt-2 w-full">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={now}
        aria-label={label}
        data-testid={testid}
        data-done={now}
        data-total={max}
        className="h-2 w-full overflow-hidden border border-line bg-paper"
      >
        <div className="h-full bg-ink" style={{ width: `${pct}%` }} aria-hidden="true" />
      </div>
      <p className="mt-1 text-xs text-ink-soft">{label}</p>
    </div>
  );
}

export function ItemPathLinks({ itemId, pathLinks, lang, currentPathId }) {
  const en = lang === "en";
  const links = (pathLinks && itemId && pathLinks[itemId]) || [];
  if (!links.length) return null;
  return (
    <nav className="mt-2 text-sm" data-testid={`bank-item-paths-${itemId}`} aria-label={en ? "Learning paths for this task" : "本题所在的学习路径"}>
      <p className="text-ink-soft">{en ? "Also on a learning path:" : "本题出现在学习路径中："}</p>
      <ul className="mt-1 space-y-1">
        {links.map((lk) => (
          <li key={`${lk.pathId}-${lk.step}`}>
            <Link className="underline" to={lk.href} data-testid={`bank-item-path-${lk.pathId}`}>
              {en
                ? `${lk.titleEn || lk.title}, step ${lk.step + 1}`
                : `「${lk.title}」第 ${lk.step + 1} 步`}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function StepRelatedItems({ items, currentId, lang, pathId, testid }) {
  const en = lang === "en";
  const list = (items || []).filter((it) => it && it.id && it.id !== currentId);
  if (!list.length) return null;
  return (
    <div className="mt-1 text-sm" data-testid={testid}>
      <p className="text-ink-soft">{en ? "Related bank tasks:" : "相关题库条目："}</p>
      <ul className="mt-1 space-y-1">
        {list.map((it) => (
          <li key={it.id}>
            <Link
              className="underline"
              to={`/bank?${new URLSearchParams({ mode: it.mode || "", diff: it.diff || it.difficulty || "", id: it.id, ...(pathId ? { path: pathId } : {}) }).toString()}`}
              data-testid={`bank-related-${it.id}`}
            >
              {en ? (it.titleEn || it.title) : it.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PathCardControls({ path, lang, prog }) {
  const en = lang === "en";
  const st = pathStats(path, prog);
  const label = pathProgressLabel(st.done, st.total, en);
  return (
    <div className="mt-2 w-full" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <PathProgressBar done={st.done} total={st.total} testid={`bank-path-progress-${path.id}`} label={label} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
          to={resumeHref(path, prog)}
          data-testid={`bank-path-resume-${path.id}`}
        >
          {st.done === 0 ? (en ? "Start" : "开始") : st.complete ? (en ? "Review" : "再看一遍") : (en ? "Resume" : "继续学习")}
        </Link>
        <Link
          className="inline-flex min-h-11 items-center border border-line px-3 text-sm"
          to={"/bank?path=" + encodeURIComponent(path.id) + "#path-quiz"}
          data-testid={`bank-path-quiz-link-${path.id}`}
        >
          {en ? "Quiz & record" : "测验与记录"}
        </Link>
      </div>
    </div>
  );
}

export function PathResetButton({ pathId, lang, testid }) {
  const en = lang === "en";
  const onReset = () => {
    const ok = typeof window !== "undefined" && window.confirm(
      en ? "Clear the progress, quiz result and saved name for this learning path? This only affects this browser." : "清除这条学习路径的进度、测验成绩和已保存的姓名？只影响这台浏览器。"
    );
    if (ok) resetPathProgress(pathId);
  };
  return (
    <button type="button" className="inline-flex min-h-11 items-center border border-line px-3 text-sm" onClick={onReset} data-testid={testid || `bank-path-reset-${pathId}`}>
      {en ? "Reset progress" : "重置进度"}
    </button>
  );
}

export function StepDoneButton({ pathId, index, lang, prog }) {
  const en = lang === "en";
  const path = findPath(pathId);
  if (!path || !path.steps[index]) return null;
  const key = stepKey(pathId, path.steps[index], index);
  const done = isStepDone(prog, pathId, key);
  return (
    <button
      type="button"
      className="mt-1 inline-flex min-h-11 items-center border border-line px-3 text-sm"
      onClick={() => markPathStep(pathId, index, !done)}
      data-testid={`bank-path-done-${index}`}
      aria-pressed={done ? "true" : "false"}
    >
      {done ? (en ? "Completed — undo" : "已完成，撤销") : (en ? "Mark this step done" : "标记本步完成")}
    </button>
  );
}

/** Compact banner on teardown / repair when opened from a path. */
export function PathFollowBanner({ pathId, kind, refId, lang }) {
  const prog = usePathProgress();
  const path = findPath(pathId);
  const en = lang === "en";
  if (!path) return null;
  const index = path.steps.findIndex((st) => (
    kind === "teardown" ? st.kind === "teardown" && st.device === refId
      : kind === "repair" ? st.kind === "repair" && st.scene === refId
        : st.kind === "bank" && st.id === refId
  ));
  const st = pathStats(path, prog);
  const title = en ? (path.titleEn || path.title) : path.title;
  return (
    <aside className="mt-3 border border-line bg-paper-2 p-3 text-sm" data-testid="path-follow-banner" data-path={path.id} data-step={index}>
      <p>{en ? `Learning path “${title}”` : `学习路径「${title}」`}{index >= 0 ? (en ? ` · step ${index + 1} of ${path.steps.length}` : ` · 第 ${index + 1} / ${path.steps.length} 步`) : ""}</p>
      <PathProgressBar done={st.done} total={st.total} testid="path-follow-progress" label={pathProgressLabel(st.done, st.total, en)} />
      <div className="mt-2 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-11 items-center underline" to={"/bank?path=" + encodeURIComponent(path.id)} data-testid="path-follow-back">
          {en ? "Back to the path" : "返回路径"}
        </Link>
        {index >= 0 && <StepDoneButton pathId={path.id} index={index} lang={lang} prog={prog} />}
        <Link className="inline-flex min-h-11 items-center border border-ink px-3 hover:bg-ink hover:text-paper-2" to={resumeHref(path, prog)} data-testid="path-follow-resume">
          {en ? "Resume" : "继续学习"}
        </Link>
      </div>
    </aside>
  );
}
