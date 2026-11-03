// 2.2 格式检测 + 多解析器。只取 标题 / 语言 / LOC / 所在 Section（事实），不保存任何描述文字。
// 我的补充（修 spec 示例）：
//  - 原版 README 的格式是 “- Blinking an LED(Verilog, 10) -- 说明”，spec 的 4 个检测正则一个都匹配不上
//    （checkbox 要求 “[ ]”，plain-list 要求 “**粗体**”，都要求 “LOC” 字样），所以加了 dash-paren 解析器
//  - checkbox 只认 “[ ]”，做完打勾的 “[x]” 会漏掉，改成 [ xX]
//  - 不再只看“第一个匹配的检测器”：依次尝试，取第一个能解析出 ≥1 条的（markdown 表格正则几乎匹配所有带表格的 README）
const PROJ = /^(?<title>[^()\n]*?[^\s(])\s*\((?<lang>[A-Za-z][A-Za-z0-9+#/ .-]{0,20}?),\s*(?<loc>\d+)(?<plus>\+)?\s*(?:LOC)?\)\s*(?:(?:--|—|:).*)?$/;
const NOLOC = /^(?<title>[A-Z][^()\n]{2,60}?)\s+--\s+\S.*$/; // “- Building an FPGA board -- 说明”（原版里有两条没有 LOC）
const SECTION = /^(?:#{1,6}\s*)?(?:\*\*)?Section\s+(\d+)\s*:\s*([^—\n*]*?)(?:\s+--\s+[\d.]+\s+weeks?)?(?:\*\*)?\s*$/i;
const clean = (s) => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();

function fromText(text, section) {
  const t = clean(text);
  let m = PROJ.exec(t);
  if (m) return { section, title: m.groups.title.trim(), language: m.groups.lang.trim(), locEstimate: +m.groups.loc, locPlus: !!m.groups.plus };
  m = NOLOC.exec(t);
  if (m && section) return { section, title: m.groups.title.trim(), language: null, locEstimate: null, locPlus: false };
  return null;
}
function lineParser(lineRe) {
  return (md) => {
    const out = []; let section = null;
    for (const raw of md.split(/\r?\n/)) {
      const sm = SECTION.exec(clean(raw.replace(/^#+\s*/, "")));
      if (sm) { section = `Section ${sm[1]}: ${sm[2].trim()}`.replace(/:\s*$/, ""); continue; }
      const lm = lineRe.exec(raw);
      if (!lm) continue;
      const p = fromText(lm[1], section);
      if (p) out.push(p);
    }
    return out;
  };
}
export const parseCheckboxList = lineParser(/^\s*[-*]\s*\[[ xX]?\]\s*(.+)$/);
export const parseDashParen = lineParser(/^\s*[-*]\s+(?!\[)(.+)$/);
export const parsePlainLines = lineParser(/^(?![-*#|>\s\d])(.+)$/);
export function parseHtmlList(md) {
  const out = []; let section = null;
  const re = /<h\d[^>]*>([\s\S]*?)<\/h\d>|<li>([\s\S]*?)<\/li>/gi; let m;
  while ((m = re.exec(md))) {
    if (m[1]) { const sm = SECTION.exec(clean(m[1].replace(/<[^>]+>/g, ""))); if (sm) section = `Section ${sm[1]}: ${sm[2].trim()}`; continue; }
    const p = fromText(m[2].replace(/<[^>]+>/g, ""), section); if (p) out.push(p);
  }
  return out;
}
export function parseMarkdownTable(md) {
  const out = []; let section = null, cols = null;
  for (const raw of md.split(/\r?\n/)) {
    const sm = SECTION.exec(clean(raw.replace(/^#+\s*/, ""))); if (sm) { section = `Section ${sm[1]}: ${sm[2].trim()}`; cols = null; continue; }
    if (!/^\s*\|.*\|\s*$/.test(raw)) { cols = null; continue; }
    const cells = raw.trim().replace(/^\||\|$/g, "").split("|").map((c) => clean(c));
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    if (!cols) { cols = cells.map((c) => c.toLowerCase()); continue; }
    const at = (re) => { const i = cols.findIndex((c) => re.test(c)); return i < 0 ? null : cells[i]; };
    const title = at(/^(project|task|unit name|title|name)$/) ?? cells[0];
    if (!title || /^\d+$/.test(title)) continue;
    const lang = at(/^(lang|language)$/), loc = at(/^(loc|lines|size)$/);
    let p = fromText(title, section);
    if (!p && lang) p = { section, title: title.trim(), language: lang, locEstimate: loc && /\d/.test(loc) ? parseInt(loc, 10) : null, locPlus: /\+/.test(loc || "") };
    if (!p) { const m = /^(.+?)\s*\(([A-Za-z][A-Za-z0-9+#]*)\)$/.exec(title); if (m) p = { section, title: m[1].trim(), language: m[2], locEstimate: null, locPlus: false }; }
    if (p) out.push(p);
  }
  return out;
}

export const FORMAT_DETECTORS = [
  { name: "checkbox-list", test: /^\s*[-*]\s*\[[ xX]?\]\s*.+\(\s*[A-Za-z][^,()]*,\s*\d+\+?\s*(?:LOC)?\)/m, parser: parseCheckboxList },
  { name: "dash-paren", test: /^\s*[-*]\s+[^[\n]+\(\s*[A-Za-z][^,()]*,\s*\d+\+?\s*(?:LOC)?\)/m, parser: parseDashParen },
  { name: "markdown-table", test: /^\s*\|.*\|.*\|/m, parser: parseMarkdownTable },
  { name: "html-list", test: /<li>.*<\/li>/i, parser: parseHtmlList },
  { name: "plain-lines", test: /^[A-Z][^\n(]+\(\s*[A-Za-z][^,()]*,\s*\d+\+?\)\s+--/m, parser: parsePlainLines },
];

export function parseReadme(md) {
  const tried = [];
  for (const d of FORMAT_DETECTORS) {
    if (!d.test.test(md)) continue;
    const rows = d.parser(md);
    tried.push(`${d.name}:${rows.length}`);
    if (rows.length) return { format: d.name, projects: rows, tried };
  }
  return { format: null, projects: [], tried };
}
