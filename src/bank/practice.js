// 把题库条目的作答交给已有校验器。早期原型，简化仿真。
import { runTimeline, checkTimeline } from "./timeline.js";
import { validateCode } from "../validators/index.js";
import { checkConnectionGraph, checkAssembly } from "./graph.js";

export function practiceItem(item, answer, lang = "zh") {
  const pc = item?.passCondition || {};
  const pick = (e) => (lang === "en" ? (e.msgEn || e.msg) : (e.msg || e.msgEn));
  try {
    if (pc.type === "behaviorTimeline") {
      const ev = runTimeline(String(answer?.source ?? ""), { horizonMs: pc.horizonMs || 3000, inputs: pc.inputs || {} });
      const r = checkTimeline(ev, pc);
      const errors = [];
      for (const x of r.results || []) {
        if (!x.ok) errors.push({ msg: x.serial ? `串口在 ${x.t} ms 未出现“${x.text}”` : `引脚 ${x.pin} 在 ${x.t} ms 未变成 ${x.value ? "高" : "低"}`, msgEn: x.serial ? `Serial text “${x.text}” not seen at ${x.t} ms` : `Pin ${x.pin} was not ${x.value ? "high" : "low"} at ${x.t} ms` });
      }
      for (const x of r.extra || []) errors.push({ msg: `引脚 ${x.pin} 跳变 ${x.got} 次，多于预期 ${x.exp} 次`, msgEn: `Pin ${x.pin} toggled ${x.got} times, more than the expected ${x.exp}` });
      return { pass: r.pass, errors: errors.map((e) => ({ ...e, text: pick(e) })), warnings: [], info: { events: ev } };
    }
    if (pc.type === "codeCheck") {
      const r = validateCode(pc.format, String(answer?.source ?? ""), pc.spec || {});
      return { ...r, errors: (r.errors || []).map((e) => ({ ...e, text: pick(e) })), warnings: (r.warnings || []).map((e) => ({ ...e, text: pick(e) })) };
    }
    if (pc.type === "connectionGraphConstraint") {
      const r = checkConnectionGraph({ wires: answer?.wires || [] }, pc);
      return { ...r, errors: r.errors.map((e) => ({ ...e, text: pick(e) })) };
    }
    if (pc.type === "assemblyConstraint") {
      const r = checkAssembly({ steps: answer?.steps || [] }, pc);
      return { ...r, errors: r.errors.map((e) => ({ ...e, text: pick(e) })) };
    }
    if (pc.type === "diagnosisQuiz") {
      const answers = answer?.answers || {};
      const errors = [];
      for (const q of pc.questions || []) {
        if (answers[q.id] !== q.answer) errors.push({ msg: `还有题目没有选对`, msgEn: `At least one question is still wrong`, text: lang === "en" ? "At least one question is still wrong" : "还有题目没有选对" });
      }
      const uniq = errors.length ? [errors[0]] : [];
      return { pass: uniq.length === 0, errors: uniq, warnings: [], info: { repairUrl: pc.repairUrl, scenario: pc.scenario } };
    }
    return { pass: false, errors: [{ text: lang === "en" ? "Unknown task type" : "不支持的题目类型" }], warnings: [] };
  } catch (e) {
    return { pass: false, errors: [{ text: String(e.message || e) }], warnings: [] };
  }
}
