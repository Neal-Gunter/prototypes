// v45：学习路径末尾的短测验和自学记录打印入口。成绩和姓名只存在本机。早期原型，简化仿真。
import { useEffect, useRef, useState } from "react";
import { quizFor, gradeQuiz, optionById } from "./pathQuiz.js";
import {
  pathStats, pathQuizResult, pathRecordName, setPathQuiz, setPathRecordName, PATH_NAME_MAX,
} from "./progress.js";
import { recordHtml, formatRecordDate, formatQuizScore } from "./recordSheet.js";

function openSheet(html, lang) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const w = window.open(url, "_blank");
  const en = lang === "en";
  const msg = w
    ? (en
      ? "The self-study record opened in a new tab. Click “Print / save as PDF” there and choose Save as PDF. The sheet stays light and is laid out for A4 and Letter."
      : "已在新标签页打开自学记录，点上面的“打印 / 存成 PDF”，目标选“另存为 PDF”。打印页始终是浅色，版面兼顾 A4 和 Letter。")
    : (en
      ? "The browser blocked the new tab. Use “Download HTML” and print it from the browser instead."
      : "浏览器拦住了新标签页，请改用“下载 HTML”，再用浏览器打开打印。");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { ok: !!w, msg };
}

function downloadSheet(html, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

export function PathQuiz({ path, lang, prog }) {
  const en = lang === "en";
  const quiz = quizFor(path?.id);
  const saved = pathQuizResult(prog, path?.id);
  const complete = !!(path && pathStats(path, prog).complete);
  const [picks, setPicks] = useState(() => ({ ...(saved?.answers || {}) }));
  const [submitted, setSubmitted] = useState(() => !!(saved && saved.total));
  const resultRef = useRef(null);

  useEffect(() => {
    if (saved && saved.total) {
      setPicks({ ...(saved.answers || {}) });
      setSubmitted(true);
    }
  }, [saved?.at, saved?.correct, saved?.total]);

  if (!path || !quiz) return null;

  const result = submitted ? gradeQuiz(quiz, picks) : null;
  const unanswered = quiz.questions.filter((q) => !picks[q.id]).length;

  const onSubmit = (e) => {
    e.preventDefault();
    if (!complete || unanswered) return;
    const graded = gradeQuiz(quiz, picks);
    setPathQuiz(path.id, { ...graded, at: new Date().toISOString() });
    setSubmitted(true);
    requestAnimationFrame(() => resultRef.current?.focus());
  };

  const onRetry = () => {
    setPicks({});
    setSubmitted(false);
  };

  const pick = (qid, oid) => {
    if (submitted) return;
    setPicks((prev) => ({ ...prev, [qid]: oid }));
  };

  return (
    <section className="mt-6 border border-ink bg-paper p-5" id="path-quiz" data-testid="bank-path-quiz" data-path={path.id} data-complete={complete ? "1" : "0"} data-submitted={submitted ? "1" : "0"}>
      <h3 className="text-lg font-medium">{en ? "Short quiz" : "路径测验"}</h3>
      <p className="mt-2 text-sm leading-7 text-ink-soft">
        {en
          ? "Three to five multiple-choice questions drawn only from this path’s own notes and tasks. Each option has an explanation. Your result stays in this browser with the path progress. You can retry."
          : "根据这条路径自己的说明和题面出的 3 到 5 道选择题，每个选项都有说明。成绩和路径进度一起记在这台浏览器里，可以重做。"}
      </p>
      {!complete && (
        <p className="mt-2 border border-line bg-paper-2 px-3 py-2 text-sm" data-testid="bank-path-quiz-locked">
          {en ? "Finish every step on this path before you submit the quiz." : "请先完成这条路径的每一步，再提交测验。"}
        </p>
      )}
      <form onSubmit={onSubmit} data-testid="bank-path-quiz-form">
        <ol className="mt-4 space-y-5">
          {quiz.questions.map((q, i) => {
            const chosen = picks[q.id] || "";
            const show = submitted;
            const ok = show && chosen === q.correct;
            return (
              <li key={q.id}>
                <fieldset className="border border-line p-3" data-testid={`bank-path-quiz-q-${q.id}`} data-correct={show ? (ok ? "1" : "0") : ""}>
                  <legend className="px-1 text-sm font-medium">
                    {en ? `Question ${i + 1} of ${quiz.questions.length}` : `第 ${i + 1} / ${quiz.questions.length} 题`}
                  </legend>
                  <p className="mt-1 text-sm leading-7">{en ? q.prompt.en : q.prompt.zh}</p>
                  <div className="mt-2 space-y-2">
                    {q.options.map((opt) => {
                      const id = `quiz-${path.id}-${q.id}-${opt.id}`;
                      const checked = chosen === opt.id;
                      return (
                        <div key={opt.id} className="border border-line bg-paper-2 p-2">
                          <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-2 text-sm leading-6">
                            <input
                              id={id}
                              className="mt-1 size-4 shrink-0"
                              type="radio"
                              name={`quiz-${path.id}-${q.id}`}
                              value={opt.id}
                              checked={checked}
                              disabled={submitted}
                              onChange={() => pick(q.id, opt.id)}
                              data-testid={`bank-path-quiz-opt-${q.id}-${opt.id}`}
                            />
                            <span>
                              {en ? opt.en : opt.zh}
                              {show && opt.id === q.correct && (
                                <span className="ml-2 text-xs text-ink-soft">{en ? "(correct)" : "（正解）"}</span>
                              )}
                            </span>
                          </label>
                          {show && (
                            <p className="mt-1 pl-6 text-xs leading-6 text-ink-soft" data-testid={`bank-path-quiz-explain-${q.id}-${opt.id}`}>
                              {en ? opt.explain.en : opt.explain.zh}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {show && (
                    <p className="sr-only">
                      {ok
                        ? (en ? "Your answer is correct." : "你的回答正确。")
                        : (en
                          ? `Your answer is incorrect. The correct option is: ${optionById(q, q.correct)?.en || ""}`
                          : `你的回答不正确。正解是：${optionById(q, q.correct)?.zh || ""}`)}
                    </p>
                  )}
                </fieldset>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!submitted && (
            <button
              type="submit"
              className="inline-flex min-h-11 items-center border border-ink bg-ink px-3 text-sm text-paper hover:bg-copper hover:text-paper"
              disabled={!complete || unanswered > 0}
              data-testid="bank-path-quiz-submit"
            >
              {en ? "Check answers" : "核对答案"}
            </button>
          )}
          {submitted && (
            <button
              type="button"
              className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2"
              onClick={onRetry}
              data-testid="bank-path-quiz-retry"
            >
              {en ? "Retry quiz" : "重做测验"}
            </button>
          )}
          {!submitted && unanswered > 0 && complete && (
            <p className="text-xs text-ink-soft" data-testid="bank-path-quiz-remain">
              {en ? `${unanswered} question(s) still unanswered.` : `还有 ${unanswered} 题未作答。`}
            </p>
          )}
        </div>
      </form>
      {submitted && result && (
        <p
          ref={resultRef}
          tabIndex={-1}
          role="status"
          aria-live="polite"
          className="mt-3 border border-line bg-paper-2 px-3 py-2 text-sm outline-none"
          data-testid="bank-path-quiz-result"
          data-correct={result.correct}
          data-total={result.total}
        >
          {en ? `You scored ${result.correct} of ${result.total}.` : `成绩：${result.correct} / ${result.total}。`}
        </p>
      )}
    </section>
  );
}

export function PathRecordBar({ path, lang, prog }) {
  const en = lang === "en";
  const saved = pathQuizResult(prog, path?.id);
  const [name, setName] = useState(() => pathRecordName(prog, path?.id) || "");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setName(pathRecordName(prog, path?.id) || "");
  }, [prog, path?.id]);

  if (!path) return null;
  const hasQuiz = !!(saved && saved.total);
  const stats = pathStats(path, prog);

  const persistName = (value = name) => setPathRecordName(path.id, value);

  const sheet = () => recordHtml({
    path,
    lang,
    name,
    prog,
    quiz: saved,
    now: new Date(),
  });

  const onPrint = () => {
    persistName();
    const { msg: m } = openSheet(sheet(), lang);
    setMsg(m);
  };
  const onDownload = () => {
    persistName();
    downloadSheet(sheet(), `study-record-${path.id}-${lang}.html`);
    setMsg(en ? "The HTML file was downloaded. Open it in a browser to print." : "已下载 HTML。用浏览器打开后再打印。");
  };

  return (
    <section className="mt-4 border border-line bg-paper-2 p-5" data-testid="bank-path-record" id="path-record">
      <h3 className="text-lg font-medium">{en ? "Self-study record" : "自学记录"}</h3>
      <p className="mt-2 text-sm leading-7 text-ink-soft">
        {en
          ? "This is a self-study record, not an official certificate. Type a name if you want it on the print-out. The name stays in this browser and is not sent anywhere. The printed sheet is always light and is laid out to fit A4 and Letter."
          : "这是一份自学记录，不是正式证书。如需印上姓名，请在下面填写。姓名只留在这台浏览器里，不会被发送到任何地方。打印页始终是浅色，版面兼顾 A4 和 Letter。"}
      </p>
      <div className="mt-3">
        <label htmlFor={`record-name-${path.id}`} className="block text-sm font-medium">
          {en ? "Name on the record (optional, stored only in this browser)" : "记录上的姓名（选填，只存在这台浏览器）"}
        </label>
        <input
          id={`record-name-${path.id}`}
          type="text"
          autoComplete="name"
          maxLength={PATH_NAME_MAX}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => persistName()}
          className="mt-1 min-h-11 w-full max-w-md border border-ink bg-paper px-3 text-sm"
          data-testid="bank-path-record-name"
        />
      </div>
      <p className="mt-2 text-sm text-ink-soft" data-testid="bank-path-record-preview">
        {en
          ? `Steps done: ${stats.done} of ${stats.total}. Quiz: ${hasQuiz ? formatQuizScore(saved, true) : "not taken yet"}. Date: ${formatRecordDate(saved?.at || new Date(), true)}.`
          : `已完成步骤：${stats.done} / ${stats.total}。测验：${hasQuiz ? formatQuizScore(saved, false) : "尚未作答"}。日期：${formatRecordDate(saved?.at || new Date(), false)}。`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="inline-flex min-h-11 items-center border border-ink px-3 text-sm hover:bg-ink hover:text-paper-2" onClick={onPrint} data-testid="bank-path-record-print">
          {en ? "Print / save as PDF" : "打印 / 存成 PDF"}
        </button>
        <button type="button" className="inline-flex min-h-11 items-center border border-line px-3 text-sm" onClick={onDownload} data-testid="bank-path-record-html">
          {en ? "Download HTML" : "下载 HTML"}
        </button>
      </div>
      {msg ? <p className="mt-2 text-xs text-ink-soft" role="status" data-testid="bank-path-record-msg">{msg}</p> : null}
    </section>
  );
}
