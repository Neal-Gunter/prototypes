// v45：学习路径的自学记录打印页。始终浅色，版面同时适配 A4 和 Letter（按更窄、更矮的可印区域来排）。
// 标明这是自学记录、不是正式证书。姓名只出现在这份 HTML 里，生成时不上传。早期原型，简化仿真。
import { pathStats, pathQuizResult, pathRecordName, isStepDone } from "./progress.js";
import { stepKey } from "./paths.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function formatRecordDate(d, en) {
  const dt = d instanceof Date ? d : new Date(d || Date.now());
  if (Number.isNaN(dt.getTime())) return en ? "—" : "—";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatQuizScore(quiz, en) {
  if (!quiz || !quiz.total) return en ? "Not taken" : "尚未作答";
  return en ? `${quiz.correct} of ${quiz.total}` : `${quiz.correct} / ${quiz.total}`;
}

export function recordTitle(path, lang) {
  const en = lang === "en";
  return en ? (path?.titleEn || path?.title || "") : (path?.title || "");
}

/** Light workshop palette (same names as the on-screen tokens, values fixed to the light set). */
export const RECORD_INK = "#0B2545";
export const RECORD_PAPER = "#FFFFFF";
export const RECORD_PAPER2 = "#F4F7FB";
export const RECORD_LINE = "#5C6F86";
export const RECORD_SOFT = "#2F4E70";

// Usable area after 16/12/18 mm margins:
// A4 width 210-24=186 mm; Letter height 279.4-34=245.4 mm. Stay inside both.
const SHEET_CSS = (en, title, paper) => `
html,body{background:${RECORD_PAPER};color:${RECORD_INK};color-scheme:light;}
*{box-sizing:border-box;}
body{margin:0;font:11pt/1.45 "PingFang SC","Hiragino Sans GB","Noto Sans SC","Noto Sans CJK SC",sans-serif;}
.noprint{margin:0 0 12px;padding:8px 12px;border:1px solid ${RECORD_LINE};background:${RECORD_PAPER2};font:10pt/1.4 sans-serif;}
.noprint button{min-height:44px;padding:0 12px;margin-right:8px;border:1px solid ${RECORD_INK};background:${RECORD_PAPER};color:${RECORD_INK};font:inherit;cursor:pointer;}
.sheet{max-width:180mm;margin:0 auto;padding:6mm 5mm 8mm;border:1px solid ${RECORD_LINE};border-radius:8px;background:${RECORD_PAPER};color:${RECORD_INK};break-inside:avoid;page-break-inside:avoid;}
.kicker{margin:0;font:9pt/1.3 sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${RECORD_SOFT};}
h1{margin:6px 0 0;font:16pt/1.3 sans-serif;font-weight:650;color:${RECORD_INK};}
.disclaimer{margin:8px 0 0;padding:6px 8px;border:1px solid ${RECORD_LINE};background:${RECORD_PAPER2};font:9.5pt/1.4 sans-serif;}
.meta{margin:10px 0 0;width:100%;border-collapse:collapse;font:10.5pt/1.4 sans-serif;}
.meta th,.meta td{border:1px solid ${RECORD_LINE};padding:5px 8px;text-align:left;vertical-align:top;}
.meta th{width:32%;font-weight:600;background:${RECORD_PAPER2};}
.steps{margin:10px 0 0;padding:0 0 0 1.2em;font:10.5pt/1.4 sans-serif;}
.steps li{margin:0 0 3px;break-inside:avoid;}
h2{margin:12px 0 0;font:12pt/1.3 sans-serif;font-weight:650;color:${RECORD_INK};}
.foot{margin:12px 0 0;font:8.5pt/1.4 sans-serif;color:${RECORD_SOFT};}
@page{${paper && RECORD_PAPERS.includes(paper) ? `size:${paper};` : ""}margin:16mm 12mm 18mm;@top-right{content:"${css(title)}";font-size:9px;color:#555;}@bottom-center{content:${en ? '"Page " counter(page) " of " counter(pages)' : '"第 " counter(page) " 页 / 共 " counter(pages) " 页"'};font-size:9px;color:#555;}}
@media print{
  html,body{background:${RECORD_PAPER} !important;color:${RECORD_INK} !important;color-scheme:light;}
  .noprint{display:none !important;}
  .sheet{border-color:${RECORD_INK};background:${RECORD_PAPER};}
  a{color:${RECORD_INK};text-decoration:none;}
}
`.trim();

function css(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export const RECORD_PAPERS = ["A4", "Letter"];

export function recordHtml({ path, lang = "zh", name = "", prog, quiz, now = new Date(), paper } = {}) {
  if (!path) return "";
  const en = lang === "en";
  const title = recordTitle(path, lang);
  const stats = pathStats(path, prog);
  const scoreSrc = quiz || pathQuizResult(prog, path.id);
  const displayName = String(name || pathRecordName(prog, path.id) || "").trim();
  const dateSrc = scoreSrc?.at || now;
  const date = formatRecordDate(dateSrc, en);
  const score = formatQuizScore(scoreSrc, en);
  const kicker = en ? "Self-study record — not an official certificate" : "自学记录（不是正式证书）";
  const h1 = en ? "Self-study record" : "自学记录";
  const disclaimer = en
    ? "This is a self-study record from an early prototype (simplified simulation). It only reflects the learning-path steps and the short quiz completed in this browser. It is not an official certificate, diploma or licence, and it does not show that you are qualified to repair real hardware. The name below stays on this sheet and is not sent to any server."
    : "这是早期原型（简化仿真）里的一份自学记录，只反映你在这台浏览器里完成的学习路径步骤和短测验。它不是文凭、执照或正式证书，也不证明你已具备维修实物的资格。下面的姓名只写在这份记录上，不会被发送到任何服务器。";
  const nameLabel = en ? "Name" : "姓名";
  const nameValue = displayName || (en ? "(not provided)" : "（未填写）");
  const pathLabel = en ? "Learning path" : "学习路径";
  const dateLabel = en ? "Date" : "日期";
  const stepsLabel = en ? "Steps done" : "已完成步骤";
  const stepsValue = en ? `${stats.done} of ${stats.total}` : `${stats.done} / ${stats.total}`;
  const quizLabel = en ? "Quiz score" : "测验成绩";
  const listHead = en ? "Steps" : "步骤";
  const doneWord = (yes) => (yes ? (en ? "done" : "已完成") : (en ? "not marked done" : "未标记完成"));
  const foot = en
    ? "Printed from this prototype. Always light. Laid out to fit A4 and Letter. Early prototype, simplified simulation."
    : "由本原型在浏览器里生成。打印始终为浅色。版面兼顾 A4 与 Letter。早期原型，简化仿真。";
  const printBtn = en ? "Print / save as PDF" : "打印 / 存成 PDF";
  const hint = en
    ? "Use the browser print dialog. Choose A4 or Letter; the sheet is laid out for both. The page stays light even if the app is in dark theme."
    : "用浏览器的打印对话框，纸张选 A4 或 Letter 均可。即使应用是深色，这份打印页也保持浅色。";

  const items = (path.steps || []).map((st, i) => {
    const key = stepKey(path.id, st, i);
    const done = isStepDone(prog, path.id, key);
    const label = en ? (st.titleEn || st.title) : st.title;
    return `<li data-step="${i}" data-done="${done ? "1" : "0"}">${esc(label)} — ${esc(doneWord(done))}</li>`;
  }).join("");

  return `<!doctype html>
<html lang="${en ? "en" : "zh-CN"}" data-theme="light" data-record="1" data-path="${esc(path.id)}" data-paper="${esc(RECORD_PAPERS.includes(paper) ? paper : "auto")}">
<meta charset="utf-8">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="${RECORD_PAPER}">
<title>${esc(h1)} · ${esc(title)}</title>
<style>${SHEET_CSS(en, `${h1} · ${title}`, paper)}</style>
<body>
  <div class="noprint">
    <button type="button" onclick="window.print()">${esc(printBtn)}</button>
    <span>${esc(hint)}</span>
  </div>
  <article class="sheet" id="record" data-testid="study-record">
    <p class="kicker">${esc(kicker)}</p>
    <h1>${esc(h1)}</h1>
    <p class="disclaimer" id="disclaimer">${esc(disclaimer)}</p>
    <table class="meta">
      <tr><th>${esc(nameLabel)}</th><td data-field="name">${esc(nameValue)}</td></tr>
      <tr><th>${esc(pathLabel)}</th><td data-field="path">${esc(title)}</td></tr>
      <tr><th>${esc(dateLabel)}</th><td data-field="date">${esc(date)}</td></tr>
      <tr><th>${esc(stepsLabel)}</th><td data-field="steps">${esc(stepsValue)}</td></tr>
      <tr><th>${esc(quizLabel)}</th><td data-field="score">${esc(score)}</td></tr>
    </table>
    <h2 id="steps">${esc(listHead)}</h2>
    <ol class="steps">${items}</ol>
    <p class="foot">${esc(foot)}</p>
  </article>
</body>
</html>`;
}
