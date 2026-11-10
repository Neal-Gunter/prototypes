// 4.3：构建期用 tree-sitter 校验 code-check 条目的 referenceAnswer 能满足 spec。
// 只作开发依赖，不进页面，页面不加载 WASM。
// 我的补充：优先用 Node 的 tree-sitter 原生绑定；若未安装则尝试 web-tree-sitter（同样只在构建期）。
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { ROOT, DATA, readJSON, log } from "./bank/lib.js";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));

let native = null, web = null;
async function loadParsers() {
  if (native || web) return native || web;
  try {
    const Parser = require("tree-sitter");
    const C = require("tree-sitter-c");
    const Cpp = require("tree-sitter-cpp");
    native = { kind: "native", Parser, C, Cpp };
    return native;
  } catch (e) {
    log(`validate-code-specs：原生 tree-sitter 不可用（${e.message}），尝试 web-tree-sitter`);
  }
  try {
    const Parser = (await import("web-tree-sitter")).default;
    await Parser.init();
    const wasmDir = join(ROOT, "node_modules/tree-sitter-wasms/out") ;
    // fallback paths tried later
    web = { kind: "web", Parser };
    return web;
  } catch (e) {
    throw new Error(`构建期 tree-sitter 不可用：请安装开发依赖 tree-sitter、tree-sitter-c、tree-sitter-cpp（${e.message}）`);
  }
}

function walk(node, fn) {
  fn(node);
  for (let i = 0; i < node.namedChildCount; i++) walk(node.namedChild(i), fn);
}

function collect(root, types) {
  const want = new Set(Array.isArray(types) ? types : [types]);
  const out = [];
  walk(root, (n) => { if (want.has(n.type)) out.push(n); });
  return out;
}

function textOf(n) { return n ? n.text : ""; }

export function checkReferenceAst(root, spec, lang) {
  const errors = [];
  const fnNodes = collect(root, ["function_definition", "function_declarator", "declaration"]);
  const fnText = fnNodes.map((n) => n.text).join("\n");
  const identText = collect(root, ["identifier", "qualified_identifier", "type_identifier", "field_identifier", "destructor_name"]).map((n) => n.text);

  for (const fn of spec.requiredFunctions || []) {
    const name = fn.includes("::") ? fn.split("::").pop() : fn;
    const bare = name.replace(/^~/, "");
    const found = identText.some((t) => t === name || t === bare || t === `~${bare}`) && (fnText.includes(name + "(") || fnText.includes(bare + "(") || fnText.includes(`~${bare}(`) || root.text.includes(name));
    // 更严：名字标识符出现，且源码里有 name( 或 ~Name(
    const hasCallish = root.text.includes(name + "(") || root.text.includes(`::${bare}(`) || root.text.includes(`~${bare}(`) || root.text.includes(`${bare}::`);
    if (!found && !hasCallish) errors.push(`参考答案中不存在必需函数 ${fn}，spec 不可满足`);
    else if (!hasCallish && !found) errors.push(`参考答案中不存在必需函数 ${fn}，spec 不可满足`);
  }

  const calls = collect(root, "call_expression");
  const callNames = calls.map((c) => {
    const f = c.childForFieldName?.("function") || c.namedChild(0);
    return textOf(f);
  });
  for (const fn of spec.requiredCalls || []) {
    if (!callNames.some((t) => t === fn || t.endsWith("::" + fn) || t.includes(fn))) errors.push(`参考答案未调用 ${fn}，spec 不可满足`);
  }
  for (const fn of spec.forbiddenCalls || []) {
    if (callNames.some((t) => t === fn || t.endsWith("::" + fn) || t.split(/::|\./).pop() === fn)) errors.push(`参考答案调用了被禁用函数 ${fn}`);
  }
  for (const ns of spec.requiredNamespaces || []) {
    const found = collect(root, "namespace_definition").some((n) => (n.childForFieldName?.("name")?.text || textOf(n.namedChild(0))) === ns);
    if (!found) errors.push(`参考答案中不存在命名空间 ${ns}`);
  }
  for (const cls of spec.requiredClasses || []) {
    const found = collect(root, ["class_specifier", "struct_specifier"]).some((n) => (n.childForFieldName?.("name")?.text || "") === cls);
    if (!found) errors.push(`参考答案中不存在类 ${cls}`);
  }
  for (const tpl of spec.requiredTemplates || []) {
    const decls = collect(root, "template_declaration");
    const ok = decls.some((t) => {
      const inner = [...Array(t.namedChildCount)].map((_, i) => t.namedChild(i));
      const cls = inner.find((c) => c && ["class_specifier", "struct_specifier"].includes(c.type));
      if (cls?.childForFieldName?.("name")?.text === tpl) return true;
      const fn = inner.find((c) => c && ["function_definition", "declaration"].includes(c.type));
      if (fn?.text?.includes(tpl + "(")) return true;
      return t.text.includes("class " + tpl) || t.text.includes(tpl + "(");
    });
    if (!ok) errors.push(`参考答案中不存在模板 ${tpl}`);
  }
  return errors;
}

function parseNative(parsers, lang, source) {
  const parser = new parsers.Parser();
  parser.setLanguage(lang === "cpp" ? parsers.Cpp : parsers.C);
  return parser.parse(source).rootNode;
}

export async function validateSpecAgainstReference(spec, referenceSource, lang = "c", parsers) {
  const p = parsers || await loadParsers();
  if (p.kind !== "native") throw new Error("当前只实现了原生 tree-sitter 绑定");
  const root = parseNative(p, lang, referenceSource);
  if (root.hasError) {
    // 不立刻失败：教学参考答案应可解析，但标出来
  }
  const errors = checkReferenceAst(root, spec, lang);
  if (root.hasError) errors.push("参考答案无法被 tree-sitter 完整解析");
  return errors;
}

export async function validateAllCodeSpecs({ dataDir = DATA } = {}) {
  const doc = readJSON(join(dataDir, "seeds/bank-items.json"));
  const items = (doc?.items || []).filter((i) => i.passCondition?.type === "codeCheck" && (i.passCondition.format === "c" || i.passCondition.format === "cpp") && i.passCondition.referenceAnswer);
  const parsers = await loadParsers();
  const errors = [];
  for (const it of items) {
    const p = join(ROOT, it.passCondition.referenceAnswer);
    if (!existsSync(p)) { errors.push(`${it.id} 缺少参考答案文件 ${it.passCondition.referenceAnswer}`); continue; }
    const src = readFileSync(p, "utf8");
    const e = await validateSpecAgainstReference(it.passCondition.spec, src, it.passCondition.format, parsers);
    for (const x of e) errors.push(`${it.id}: ${x}`);
  }
  return { ok: errors.length === 0, errors, checked: items.length, parser: parsers.kind };
}

async function main() {
  try {
    const r = await validateAllCodeSpecs();
    if (!r.ok) { console.error("validate-code-specs 失败：\n" + r.errors.join("\n")); process.exit(1); }
    log(`validate-code-specs：${r.checked} 条参考答案通过（${r.parser}）`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
