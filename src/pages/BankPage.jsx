// v38–v45：题库练习页。先加载 index.json，再按 mode × difficulty 按需加载。v40 增加学习路径，列表在加载完成后才标 ready。v42 增加路径进度、题目与路径互链。v45 在路径末尾加测验和自学记录。早期原型，简化仿真。
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { containerClass } from "../container";
import { useLang, tr } from "../i18n.js";
import { loadIndex, loadBank, freshnessFlag, itemStale, MODES, DIFFICULTIES } from "../bank/load.js";
import { practiceItem } from "../bank/practice.js";
import { PATHS, findPath, pathStepHref, stepIndexForItem, stepKey } from "../bank/paths.js";
import { pathLinksFromPaths, pathStepBankFromPaths } from "../bank/pathMap.js";
import { markItemDone, pathStats, resumeHref, isStepDone } from "../bank/progress.js";
import { usePathProgress, PathProgressBar, pathProgressLabel, PathCardControls, PathResetButton, StepDoneButton, ItemPathLinks, StepRelatedItems } from "../bank/PathChrome.jsx";
import { PathQuiz, PathRecordBar } from "../bank/PathQuiz.jsx";

const MODE_LABEL = {
  firmware: ["固件时序", "Firmware timing"],
  workbench: ["接线约束", "Wiring constraints"],
  assembly: ["装配顺序", "Assembly order"],
  diagnosis: ["故障诊断", "Diagnosis"],
  "code-check": ["代码检查", "Code check"],
};
const DIFF_LABEL = {
  intro: ["入门", "Intro"],
  intermediate: ["进阶", "Intermediate"],
  advanced: ["提高", "Advanced"],
};
const L = (en, pair) => (en ? pair[1] : pair[0]);
const pathStatsSafe = (path, prog) => pathStats(path, prog);
const resumeHrefSafe = (path, prog) => resumeHref(path, prog);
const pathStepDone = (path, prog, i) => isStepDone(prog, path.id, stepKey(path.id, path.steps[i], i));
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

function PassWatch({ r, itemId }) {
  useEffect(() => { if (r?.pass && itemId) markItemDone(itemId); }, [r, itemId]);
  return null;
}
function Result({ r, itemId }) {
  if (!r) return null;
  return (
    <div className={`mt-3 border px-3 py-2 text-sm ${r.pass ? "border-ink" : "border-copper"}`} data-testid="bank-result" data-pass={r.pass ? "1" : "0"}>
      <p className="font-medium">{r.pass ? tr("通过", "Pass") : tr("还没有通过", "Not passed yet")}</p>
      <ul className="mt-1 list-disc pl-5">
        {(r.errors || []).map((e, i) => <li key={i}>{e.text || e.msg}</li>)}
        {(r.warnings || []).map((e, i) => <li key={"w" + i}>{e.text || e.msg}</li>)}
      </ul>
    </div>
  );
}

function FirmwarePractice({ item, lang, onDone }) {
  const [src, setSrc] = useState(item.firmwareTemplate || item.starter || "");
  const [r, setR] = useState(null);
  useEffect(() => { setSrc(item.firmwareTemplate || item.starter || ""); setR(null); }, [item.id]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); setR(practiceItem(item, { source: src }, lang)); }} className="mt-3">
      <label className="block text-sm" htmlFor="bank-fw-src">{tr("固件代码（类 Arduino 解释器，简化仿真）", "Firmware (Arduino-like interpreter, simplified simulation)")}</label>
      <textarea id="bank-fw-src" data-testid="bank-editor" className="mt-1 min-h-48 w-full border border-line bg-paper p-2 font-mono text-sm" value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} />
      <button type="submit" className="mt-2 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2" data-testid="bank-run">{tr("运行并对照时序", "Run and check the timeline")}</button>
      <PassWatch r={r} itemId={item.id} /><Result r={r} itemId={item.id} />
    </form>
  );
}
function CodePractice({ item, lang }) {
  const [src, setSrc] = useState(item.starter || "");
  const [r, setR] = useState(null);
  useEffect(() => { setSrc(item.starter || ""); setR(null); }, [item.id]);
  const fmt = item.passCondition?.format || "c";
  return (
    <form onSubmit={(e) => { e.preventDefault(); setR(practiceItem(item, { source: src }, lang)); }} className="mt-3">
      <label className="block text-sm" htmlFor="bank-cc-src">{tr(`代码（${fmt}，只做结构检查，不编译）`, `Code (${fmt}, structure check only, not compiled)`)}</label>
      <textarea id="bank-cc-src" data-testid="bank-editor" className="mt-1 min-h-48 w-full border border-line bg-paper p-2 font-mono text-sm" value={src} onChange={(e) => setSrc(e.target.value)} spellCheck={false} />
      <button type="submit" className="mt-2 inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2" data-testid="bank-run">{tr("检查", "Check")}</button>
      <PassWatch r={r} itemId={item.id} /><Result r={r} itemId={item.id} />
    </form>
  );
}
function QuizPractice({ item, lang }) {
  const qs = item.passCondition?.questions || [];
  const [answers, setAnswers] = useState({});
  const [r, setR] = useState(null);
  useEffect(() => { setAnswers({}); setR(null); }, [item.id]);
  const url = item.passCondition?.repairUrl;
  return (
    <form onSubmit={(e) => { e.preventDefault(); setR(practiceItem(item, { answers }, lang)); }} className="mt-3 space-y-4" data-testid="bank-quiz">
      {qs.map((q) => (
        <fieldset key={q.id} className="rounded-xl border border-line/60 p-3">
          <legend className="px-1 text-sm font-medium">{lang === "en" ? q.promptEn : q.prompt}</legend>
          <div className="mt-2 space-y-2">
            {(q.options || []).map((o) => (
              <label key={o.id} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm">
                <input type="radio" className="mt-1" name={item.id + "-" + q.id} value={o.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} data-testid={`bank-opt-${q.id}-${o.id}`} />
                <span>{lang === "en" ? o.en : o.zh}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button type="submit" className="inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2" data-testid="bank-run">{tr("提交判断", "Submit")}</button>
      <PassWatch r={r} itemId={item.id} /><Result r={r} itemId={item.id} />
      {url && (
        <p className="text-sm">
          <Link className="underline" to={url} data-testid="bank-repair-link">{tr("打开对应的维修关卡继续练习", "Open the matching repair level")}</Link>
        </p>
      )}
    </form>
  );
}
function WiresPractice({ item, lang }) {
  const [wires, setWires] = useState([{ a: "", b: "" }]);
  const [r, setR] = useState(null);
  useEffect(() => { setWires(item.starterWires?.length ? item.starterWires : [{ a: "", b: "" }]); setR(null); }, [item.id]);
  const set = (i, k, v) => setWires((w) => w.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); setR(practiceItem(item, { wires: wires.filter((w) => w.a && w.b) }, lang)); }} className="mt-3">
      <p className="text-sm">{tr("每行一根线，填写两端节点名。按连通性检查，不是 3D 台面。", "One wire per row. Enter the two node names. This checks connectivity, not the 3D bench.")}</p>
      <ul className="mt-2 space-y-2" data-testid="bank-wires">
        {wires.map((w, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`wa-${i}`}>{tr("一端", "End A")}</label>
            <input id={`wa-${i}`} className="min-h-11 min-w-32 flex-1 border border-line px-2 font-mono text-sm" value={w.a} onChange={(e) => set(i, "a", e.target.value)} data-testid={`bank-wire-a-${i}`} />
            <span aria-hidden="true">—</span>
            <label className="sr-only" htmlFor={`wb-${i}`}>{tr("另一端", "End B")}</label>
            <input id={`wb-${i}`} className="min-h-11 min-w-32 flex-1 border border-line px-2 font-mono text-sm" value={w.b} onChange={(e) => set(i, "b", e.target.value)} data-testid={`bank-wire-b-${i}`} />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-11 items-center border border-line px-3" onClick={() => setWires((w) => [...w, { a: "", b: "" }])} data-testid="bank-add-wire">{tr("加一根线", "Add a wire")}</button>
        <button type="submit" className="inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2" data-testid="bank-run">{tr("检查连接", "Check the wiring")}</button>
      </div>
      <PassWatch r={r} itemId={item.id} /><Result r={r} itemId={item.id} />
    </form>
  );
}
function StepsPractice({ item, lang }) {
  const [steps, setSteps] = useState([{ part: "", orient: "" }]);
  const [r, setR] = useState(null);
  useEffect(() => { setSteps(item.starterSteps?.length ? item.starterSteps : [{ part: "", orient: "" }]); setR(null); }, [item.id]);
  const set = (i, k, v) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <form onSubmit={(e) => { e.preventDefault(); setR(practiceItem(item, { steps: steps.filter((s) => s.part) }, lang)); }} className="mt-3">
      <p className="text-sm">{tr("按安装顺序填写零件名；需要朝向时填在第二格。", "List parts in install order; put an orientation in the second box when the task asks for one.")}</p>
      <ol className="mt-2 list-decimal space-y-2 pl-6" data-testid="bank-steps">
        {steps.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor={`sp-${i}`}>{tr("零件", "Part")}</label>
            <input id={`sp-${i}`} className="min-h-11 min-w-32 flex-1 border border-line px-2 font-mono text-sm" value={s.part || ""} onChange={(e) => set(i, "part", e.target.value)} data-testid={`bank-step-part-${i}`} />
            <label className="sr-only" htmlFor={`so-${i}`}>{tr("朝向（可选）", "Orientation (optional)")}</label>
            <input id={`so-${i}`} className="min-h-11 min-w-28 flex-1 border border-line px-2 font-mono text-sm" value={s.orient || ""} onChange={(e) => set(i, "orient", e.target.value)} placeholder={tr("朝向（可空）", "Orientation (optional)")} data-testid={`bank-step-orient-${i}`} />
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-11 items-center border border-line px-3" onClick={() => setSteps((s) => [...s, { part: "", orient: "" }])} data-testid="bank-add-step">{tr("加一步", "Add a step")}</button>
        <button type="submit" className="inline-flex min-h-11 items-center border border-ink px-4 hover:bg-ink hover:text-paper-2" data-testid="bank-run">{tr("检查顺序", "Check the order")}</button>
      </div>
      <PassWatch r={r} itemId={item.id} /><Result r={r} itemId={item.id} />
    </form>
  );
}

function PathNav({ path, itemId, lang }) {
  const i = stepIndexForItem(path, itemId);
  if (!path || i < 0) return null;
  const prev = path.steps[i - 1], next = path.steps[i + 1];
  const title = lang === "en" ? (path.titleEn || path.title) : path.title;
  return (
    <nav className="mt-3 rounded-2xl border border-line/60 bg-paper-2 px-3 py-2 text-sm shadow-[0_1px_2px_rgba(11,37,69,0.05),0_8px_24px_rgba(11,37,69,0.06)]" data-testid="bank-path-nav" aria-label={lang === "en" ? "Learning path" : "学习路径"}>
      <p>{lang === "en" ? `Path “${title}”, step ${i + 1} of ${path.steps.length}` : `学习路径「${title}」第 ${i + 1} / ${path.steps.length} 步`}</p>
      <p className="mt-1 flex flex-wrap gap-3">
        <Link to={"/bank?path=" + encodeURIComponent(path.id)} className="underline" data-testid="bank-path-back">{lang === "en" ? "Back to the path" : "返回路径"}</Link>
        {prev && <Link to={pathStepHref(prev, path.id)} className="underline" data-testid="bank-path-prev">{lang === "en" ? "Previous step" : "上一步"}</Link>}
        {next && <Link to={pathStepHref(next, path.id)} className="underline" data-testid="bank-path-next">{lang === "en" ? "Next step" : "下一步"}</Link>}
      </p>
    </nav>
  );
}

function Practice({ item, lang, pathId, pathLinks }) {
  const t = item.passCondition?.type;
  const path = findPath(pathId);
  return (
    <section className="mt-6 rounded-2xl border border-line/60 bg-paper-2 p-5 shadow-[0_1px_2px_rgba(11,37,69,0.05),0_8px_24px_rgba(11,37,69,0.06)]" data-testid="bank-practice" data-id={item.id}>
      <PathNav path={path} itemId={item.id} lang={lang} />
      <h2 className="text-xl font-medium">{lang === "en" ? (item.titleEn || item.title) : item.title}</h2>
      <ItemPathLinks itemId={item.id} pathLinks={pathLinks} lang={lang} currentPathId={pathId} />
      <p className="mt-2 text-sm leading-7 text-ink-soft">{lang === "en" ? (item.promptEn || item.prompt) : item.prompt}</p>
      {itemStale(item) || item._stale ? <p className="mt-2 text-sm" data-testid="bank-item-stale">{tr("来源可能已变更，仍可练习。", "The source may have changed; you can still practise.")}</p> : null}
      <p className="mt-1 text-xs text-ink-soft">{item.attribution || tr("按公开资料整理", "Compiled from public information")}</p>
      {(item.hints || []).length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer">{tr("提示", "Hints")}</summary>
          <ul className="mt-1 list-disc pl-5">{(lang === "en" ? (item.hintsEn || item.hints) : item.hints).map((h, i) => <li key={i}>{h}</li>)}</ul>
        </details>
      )}
      {t === "behaviorTimeline" && <FirmwarePractice item={item} lang={lang} />}
      {t === "codeCheck" && <CodePractice item={item} lang={lang} />}
      {t === "diagnosisQuiz" && <QuizPractice item={item} lang={lang} />}
      {t === "connectionGraphConstraint" && <WiresPractice item={item} lang={lang} />}
      {t === "assemblyConstraint" && <StepsPractice item={item} lang={lang} />}
    </section>
  );
}

export default function BankPage() {
  const [lang] = useLang();
  const en = lang === "en";
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") || "";
  const diff = params.get("diff") || "";
  const id = params.get("id") || "";
  const pathId = params.get("path") || "";
  const currentPath = findPath(pathId);
  const [index, setIndex] = useState(null);
  const [err, setErr] = useState("");
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(false);
  const prog = usePathProgress();
  const pathLinks = index?.pathLinks || pathLinksFromPaths();
  const pathStepBank = index?.pathStepBank || pathStepBankFromPaths();

  useEffect(() => { document.title = en ? "Problem bank · prototype" : "题库 · 原型"; }, [en]);
  useEffect(() => {
    let gone = false;
    loadIndex().then((x) => { if (!gone) setIndex(x); }).catch((e) => { if (!gone) setErr(String(e.message || e)); });
    return () => { gone = true; };
  }, []);
  useEffect(() => {
    if (!mode || !diff || !MODES.includes(mode) || !DIFFICULTIES.includes(diff)) { setItems(null); setLoading(false); return; }
    let gone = false;
    setItems(null);
    setLoading(true);
    loadBank(mode, diff).then((list) => { if (!gone) { setItems(list); setLoading(false); } }).catch((e) => { if (!gone) { setErr(String(e.message || e)); setLoading(false); } });
    return () => { gone = true; };
  }, [mode, diff]);

  const current = useMemo(() => (items || []).find((x) => x.id === id) || null, [items, id]);
  const setSel = (m, d, itemId, pth) => {
    const n = new URLSearchParams();
    if (m) n.set("mode", m);
    if (d) n.set("diff", d);
    if (itemId) n.set("id", itemId);
    const path = pth === undefined ? pathId : pth;
    if (path) n.set("path", path);
    setParams(n, { replace: false });
  };

  return (
    <div className={containerClass + " py-10"} data-testid="bank-page" data-lang={lang}>
      <p className="text-xs text-ink-soft">{tr("早期原型，简化仿真", "Early prototype, simplified simulation")}</p>
      <h1 className="mt-2 text-3xl font-medium tracking-tight">{tr("题库", "Problem bank")}</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">
        {tr("先看各组题目的数量和新鲜度，再点进某一组练习。固件题用已有的解释器对照时序，代码题只做结构检查，诊断题连到已有的维修关卡。全部题面是自己写的，按公开资料整理。不加载 WASM。", "First look at the counts and freshness of each group, then open a group to practise. Firmware tasks use the existing interpreter against a timeline, code tasks are structure checks only, and diagnosis tasks link to the existing repair levels. All problem text is original, compiled from public information. No WASM is loaded.")}
      </p>
      {err && <p className="mt-3 text-sm text-copper" data-testid="bank-error">{tr("题库索引加载失败：", "Could not load the bank index: ")}{err}</p>}
      {!index && !err && <p className="mt-3 text-sm" data-testid="bank-loading">{tr("正在加载目录…", "Loading the catalogue…")}</p>}
      {index && (
        <div className="mt-6 overflow-x-auto" data-testid="bank-index">
          <p className="text-sm text-ink-soft" data-testid="bank-total">{tr(`共 ${index.total} 题`, `${index.total} tasks in total`)} · {tr("目录更新", "Catalogue generated")} {fmtDate(index.generatedAt)}</p>
          <table className="mt-3 w-full min-w-[36rem] border-collapse text-left text-sm">
            <caption className="sr-only">{tr("按模式和难度列出题数和新鲜度", "Task counts and freshness by mode and difficulty")}</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">{tr("模式", "Mode")}</th>
                {DIFFICULTIES.map((d) => <th key={d} scope="col" className="py-2 pr-3">{L(en, DIFF_LABEL[d])}</th>)}
              </tr>
            </thead>
            <tbody>
              {MODES.map((m) => (
                <tr key={m} className="border-b border-line" data-testid={`bank-mode-${m}`}>
                  <th scope="row" className="py-2 pr-3 font-medium">{L(en, MODE_LABEL[m])}</th>
                  {DIFFICULTIES.map((d) => {
                    const meta = index.modes?.[m]?.[d] || {};
                    const flag = freshnessFlag(meta);
                    return (
                      <td key={d} className="py-2 pr-3 align-top">
                        <button type="button" className={`inline-flex min-h-11 flex-col items-start border px-2 py-1 text-left ${mode === m && diff === d ? "border-ink" : "border-line"} ${flag === "soon" ? "bg-amber-50" : ""}`} onClick={() => setSel(m, d)} data-testid={`bank-cell-${m}-${d}`} data-freshness={flag} aria-pressed={mode === m && diff === d}>
                          <span>{tr(`${meta.count ?? 0} 题`, `${meta.count ?? 0} tasks`)}</span>
                          <span className="text-xs text-ink-soft">{tr("更新于", "Updated")} {fmtDate(meta.updatedAt)}</span>
                          {flag === "soon" && <span className="text-xs" data-testid={`bank-soon-${m}-${d}`}>{tr(`最早将在 ${fmtDate(meta.staleEarliest)} 过期`, `Earliest expiry ${fmtDate(meta.staleEarliest)}`)}</span>}
                          {flag === "stale" && <span className="text-xs" data-testid={`bank-stale-${m}-${d}`}>{tr(`${meta.staleCount} 题已过期`, `${meta.staleCount} tasks expired`)}</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-soft">{tr("黄底表示该组里最早过期日距今不到 30 天（我的补充）。过期条目仍可练习，会提示来源可能已变更。", "A yellow background means the earliest expiry in that group is within 30 days (our addition). Expired items can still be practised, with a note that the source may have changed.")}</p>
        </div>
      )}
      <section className="mt-8" data-testid="bank-paths">
        <h2 className="text-xl font-medium tracking-tight">{tr("学习路径", "Learning paths")}</h2>
        <p className="mt-2 max-w-2xl text-base leading-7 text-ink-soft">{tr("把拆解、诊断、接线和维修关卡串成 3 到 5 步的短路径。进度只存在这台浏览器里。说明是自己写的。这是简化仿真，不是实物课。", "Short 3-to-5-step paths that chain a teardown, a diagnosis or wiring task, and a repair level. Progress stays in this browser only. The notes are original. This is a simplified simulation, not a lesson on a real device.")}</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {PATHS.map((pa) => (
            <li key={pa.id} className={`border px-4 py-3 ${pathId === pa.id ? "border-ink bg-paper-2" : "border-line bg-paper-2/60"}`}>
              <button type="button" className="flex min-h-11 w-full flex-col items-start text-left text-sm" onClick={() => setSel("", "", "", pa.id)} data-testid={`bank-path-${pa.id}`} aria-pressed={pathId === pa.id}>
                <span className="font-medium">{en ? pa.titleEn : pa.title}</span>
                <span className="mt-1 text-xs text-ink-soft">{tr(`${pa.steps.length} 步`, `${pa.steps.length} steps`)}</span>
              </button>
              <PathCardControls path={pa} lang={lang} prog={prog} />
            </li>
          ))}
        </ul>
      </section>
      {currentPath && (
        <section className="mt-6 rounded-2xl border border-line/60 bg-paper-2 p-5 shadow-[0_1px_2px_rgba(11,37,69,0.05),0_8px_24px_rgba(11,37,69,0.06)]" data-testid="bank-path-detail" data-path={currentPath.id} data-count={currentPath.steps.length}>
          <h2 className="text-lg font-medium">{en ? currentPath.titleEn : currentPath.title}</h2>
          <p className="mt-2 text-sm leading-7 text-ink-soft">{en ? currentPath.summaryEn : currentPath.summary}</p>
          <PathProgressBar done={pathStatsSafe(currentPath, prog).done} total={currentPath.steps.length} testid="bank-path-detail-progress" label={pathProgressLabel(pathStatsSafe(currentPath, prog).done, currentPath.steps.length, en)} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2" to={resumeHrefSafe(currentPath, prog)} data-testid="bank-path-detail-resume">{tr("继续学习", "Resume")}</Link>
            <PathResetButton pathId={currentPath.id} lang={lang} testid="bank-path-detail-reset" />
          </div>
          <ol className="mt-3 list-decimal space-y-3 pl-6">
            {currentPath.steps.map((st, i) => (
              <li key={currentPath.id + "-" + i} data-testid={`bank-path-step-${i}`} data-kind={st.kind} data-done={pathStepDone(currentPath, prog, i) ? "1" : "0"}>
                <Link className="underline" to={pathStepHref(st, currentPath.id)} data-testid={`bank-path-link-${i}`}>{en ? (st.titleEn || st.title) : st.title}</Link>
                <p className="mt-1 text-sm text-ink-soft">{en ? st.noteEn : st.note}</p>
                <StepRelatedItems items={(pathStepBank[currentPath.id] || [])[i] || []} currentId={st.kind === "bank" ? st.id : ""} lang={lang} pathId={currentPath.id} testid={`bank-path-related-${i}`} />
                <StepDoneButton pathId={currentPath.id} index={i} lang={lang} prog={prog} />
              </li>
            ))}
          </ol>
          <PathQuiz path={currentPath} lang={lang} prog={prog} />
          <PathRecordBar path={currentPath} lang={lang} prog={prog} />
        </section>
      )}
      {mode && diff && (
        <section className="mt-8" data-testid="bank-list" data-mode={mode} data-diff={diff} data-state={loading ? "loading" : items ? "ready" : "idle"} data-count={items ? String(items.length) : "0"}>
          <h2 className="text-lg font-medium">{L(en, MODE_LABEL[mode] || [mode, mode])} · {L(en, DIFF_LABEL[diff] || [diff, diff])}</h2>
          {loading && <p className="mt-2 text-sm" data-testid="bank-list-loading">{tr("正在加载这一组题目…", "Loading this group…")}</p>}
          {items && !loading && (
            <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line/60 bg-paper-2 shadow-[0_1px_2px_rgba(11,37,69,0.05),0_8px_24px_rgba(11,37,69,0.06)]" data-testid="bank-list-ready" data-count={items.length}>
              {items.map((it) => (
                <li key={it.id} className="px-0">
                  <button type="button" className={`flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${id === it.id ? "bg-paper-2" : ""}`} onClick={() => setSel(mode, diff, it.id)} data-testid={`bank-item-${it.id}`} aria-pressed={id === it.id}>
                    <span className="min-w-0 flex-1">
                      <span className="block">{en ? (it.titleEn || it.title) : it.title}</span>
                      {pathLinks[it.id] && <span className="mt-0.5 block text-xs text-ink-soft" data-testid={`bank-item-path-flag-${it.id}`}>{tr("出现在学习路径中", "On a learning path")}</span>}
                    </span>
                    {(it._stale || itemStale(it)) && <span className="shrink-0 text-xs text-ink-soft">{tr("可能已变更", "May have changed")}</span>}
                  </button>
                  {pathLinks[it.id] && (
                    <div className="px-3 pb-2">
                      <ItemPathLinks itemId={it.id} pathLinks={pathLinks} lang={lang} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {current && <Practice item={current} lang={lang} pathId={pathId} pathLinks={pathLinks} />}
    </div>
  );
}
