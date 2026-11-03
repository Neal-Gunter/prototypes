// 页面端轻量 C/C++ 静态校验器（docs/problem-bank-pipeline.md 第 4.2 节）。
// 早期原型，简化仿真：不是编译器，只做 4.2.8 列出的结构检查；不加载 WASM。
// 我的补充（相对 spec 示例代码修掉的问题，逐条见 docs/problem-bank-pipeline.md 末尾「v38 实现说明」）：
//  1. tokenizer：数字被 \w+ 先吃掉成 ident → 数字模式放前面、标识符要求字母或下划线开头；预处理行（#include / #define）先抹掉
//  2. skipTemplateParams：括号里的 > 不算（template<int N = (3>2)>）
//  3. findScopes：任何 } 都会弹出命名空间/类 → 改成完整的花括号栈（函数体、块、初始化列表都入栈）
//  4. template<class T> 的参数被重新扫描成 class T → 跳过模板参数后从参数之后继续
//  5. 参数列表里的 struct S、enum class 被当成类 → 只在声明位置、括号外识别；enum 单独处理
//  6. 匿名命名空间会吃掉下一个标识符 → namespace 后紧跟 { 时记作 <anonymous>
//  7. 带返回类型的模板函数（template<typename T> T max(...)）原示例永远标不成模板 → 用「待定模板」标记，直到被类或函数消费
//  8. C<T>::set 的回溯因为 k 还停在 :: 上不会执行 → 重写回溯；支持 C::~C()（spec 里的 ~C::C() 不是合法 C++）
//  9. if / for / while / switch / catch 等关键字被识别成函数 → 关键字表排除
// 10. 类内联成员没有加限定名，Gpio::set 匹配不到 class Gpio { void set() {} } → 用外层作用域补全限定名，并按 ::后缀匹配
// 11. findCalls 把定义当成调用、认不出 new / delete 和 foo<int>( → 修正
// 12. checkBalanced / maxLoopDepth 在 spec 里未定义 → 补上实现

const KEYWORDS = new Set("if else for while do switch case default return break continue goto sizeof alignof decltype typeid static_assert catch try throw new delete operator template typename class struct union enum namespace using typedef public private protected virtual override final const constexpr static inline extern volatile mutable explicit friend noexcept auto register signed unsigned".split(" "));

const TOKEN_RE = /("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|\/\/[^\n]*|\/\*[\s\S]*?\*\/|::|->|<<=|>>=|<<|>>|<=|>=|==|!=|&&|\|\||\+\+|--|\d[\w.]*|[A-Za-z_]\w*|[{}()[\];,.<>~*&+\-=/!%^|?:#])/g;

function stripPreprocessor(src) {
  // 用空格替换，保持位置不变，行号仍然准确；支持行尾 \ 续行
  return src.replace(/^[ \t]*#(?:[^\n\\]|\\[\s\S])*$/gm, (m) => m.replace(/[^\n]/g, " "));
}
export function tokenize(src) {
  const s = stripPreprocessor(String(src)), tokens = [];
  let m, line = 1, last = 0;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(s))) {
    const text = m[0];
    for (let i = last; i < m.index; i++) if (s.charCodeAt(i) === 10) line++;
    last = m.index;
    const c = text[0];
    const type = text.startsWith("//") || text.startsWith("/*") ? "comment" : c === '"' ? "string" : c === "'" ? "char" : /\d/.test(c) ? "number" : /[A-Za-z_]/.test(c) ? "ident" : "punct";
    if (type !== "comment") tokens.push({ type, text, pos: m.index, line });
  }
  return tokens;
}

const OPEN = { "(": ")", "[": "]", "{": "}" };
export function checkBalanced(tokens) {
  const st = [];
  for (const t of tokens) {
    if (OPEN[t.text]) st.push(t);
    else if (t.text === ")" || t.text === "]" || t.text === "}") {
      const top = st.pop();
      if (!top) return { code: "unbalanced-extra", line: t.line, msg: `第 ${t.line} 行多了一个 ${t.text}`, msgEn: `Extra ${t.text} on line ${t.line}` };
      if (OPEN[top.text] !== t.text) return { code: "unbalanced-mismatch", line: t.line, msg: `第 ${t.line} 行的 ${t.text} 和第 ${top.line} 行的 ${top.text} 不配对`, msgEn: `${t.text} on line ${t.line} does not match ${top.text} on line ${top.line}` };
    }
  }
  if (st.length) { const t = st[st.length - 1]; return { code: "unbalanced-open", line: t.line, msg: `第 ${t.line} 行的 ${t.text} 没有闭合`, msgEn: `${t.text} on line ${t.line} is never closed` }; }
  return null;
}

// i 指向 template；返回模板参数结束之后的位置。圆括号里的 < > 不计入深度。
export function skipTemplateParams(tokens, i) {
  if (tokens[i]?.text !== "template") return i;
  let j = i + 1;
  if (tokens[j]?.text !== "<") return i + 1;
  let depth = 0, paren = 0;
  for (; j < tokens.length; j++) {
    const t = tokens[j].text;
    if (t === "(") paren++;
    else if (t === ")") paren--;
    else if (paren > 0) continue;
    else if (t === "<") depth++;
    else if (t === ">") { if (--depth <= 0) return j + 1; }
    else if (t === ">>") { depth -= 2; if (depth <= 0) return j + 1; }
    else if (t === "{" || t === ";") return j; // 坏输入：别越过语句边界
  }
  return j;
}
// 跳过一组配对括号，i 指向开括号；返回闭括号的下标
function skipGroup(tokens, i) {
  const open = tokens[i].text, close = OPEN[open];
  let d = 0;
  for (let j = i; j < tokens.length; j++) {
    if (tokens[j].text === open) d++;
    else if (tokens[j].text === close && --d === 0) return j;
  }
  return tokens.length - 1;
}
// 跳过 <...>（模板实参），i 指向 <；不是合理的实参列表时返回 -1
function skipAngles(tokens, i) {
  let d = 0;
  for (let j = i; j < tokens.length && j < i + 64; j++) {
    const t = tokens[j];
    if (t.text === "<") d++;
    else if (t.text === ">") { if (--d === 0) return j; }
    else if (t.text === ">>") { d -= 2; if (d <= 0) return j; }
    else if (t.text === "(") j = skipGroup(tokens, j);
    else if (!(t.type === "ident" || t.type === "number" || t.text === "::" || t.text === "," || t.text === "*" || t.text === "&")) return -1;
  }
  return -1;
}
const DECL_START = new Set([undefined, ";", "{", "}", ":", ")", "typedef", "friend", "export", "inline", "static", "extern"]);
const SCOPE_KINDS = new Set(["namespace", "class", "struct", "union"]);

// 一次扫描得到：作用域（命名空间 / 类 / 结构体 / 联合）、函数定义、模板名
export function analyze(tokens) {
  const scopes = [], fns = [], templates = new Set(), classTemplates = new Set(), defSites = new Set();
  const stack = [];
  let paren = 0, pendingTemplate = null;
  const enclosing = () => stack.filter((s) => SCOPE_KINDS.has(s.kind)).flatMap((s) => s.names || [s.name]).filter((n) => n !== "<anonymous>");
  const inCode = () => stack.some((s) => s.kind === "function" || s.kind === "block" || s.kind === "enum");
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i], x = t.text;
    if (x === "(") { paren++; continue; }
    if (x === ")") { paren = Math.max(0, paren - 1); continue; }
    if (x === "template" && paren === 0) {
      pendingTemplate = { isSpecialization: tokens[i + 1]?.text === "<" && tokens[i + 2]?.text === ">" };
      i = skipTemplateParams(tokens, i) - 1;
      continue;
    }
    if (x === "{") { stack.push({ kind: "block", open: i }); pendingTemplate = null; continue; }
    if (x === "}") {
      const top = stack.pop();
      if (top && SCOPE_KINDS.has(top.kind)) for (const n of top.names || [top.name]) scopes.push({ kind: top.kind, name: n, isTemplate: !!top.isTemplate, start: top.open, end: i });
      continue;
    }
    if (x === ";") { pendingTemplate = null; continue; }
    if (t.type !== "ident" || paren > 0) continue;

    if (x === "namespace" && !inCode()) {
      let j = i + 1; const names = [];
      while (tokens[j]?.type === "ident") { if (tokens[j].text !== "inline") names.push(tokens[j].text); j++; if (tokens[j]?.text === "::") j++; else break; }
      if (tokens[j]?.text === "{") { stack.push({ kind: "namespace", names: names.length ? names : ["<anonymous>"], open: j }); i = j; }
      else { while (j < tokens.length && tokens[j].text !== ";") j++; i = j; } // namespace X = Y;
      continue;
    }
    if (x === "enum") {
      let j = i + 1;
      while (j < tokens.length && !["{", ";", "(", "="].includes(tokens[j].text)) j++;
      if (tokens[j]?.text === "{") { stack.push({ kind: "enum", open: j }); i = j; }
      continue;
    }
    if ((x === "class" || x === "struct" || x === "union") && DECL_START.has(tokens[i - 1]?.text) || ((x === "class" || x === "struct" || x === "union") && pendingTemplate && tokens[i - 1]?.text === ">")) {
      let j = i + 1, name = "<anonymous>";
      while (tokens[j]?.text === "[" ) j = skipGroup(tokens, j) + 1; // [[attr]]
      if (tokens[j]?.type === "ident" && !KEYWORDS.has(tokens[j].text)) name = tokens[j].text;
      let k = j;
      while (k < tokens.length && !["{", ";", "(", "="].includes(tokens[k].text)) { if (tokens[k].text === "<") { const e = skipAngles(tokens, k); if (e > 0) k = e; } k++; }
      if (tokens[k]?.text === "{") {
        const isT = !!pendingTemplate;
        stack.push({ kind: x, name, isTemplate: isT, open: k });
        if (isT && !pendingTemplate.isSpecialization) { templates.add(name); classTemplates.add(name); }
        pendingTemplate = null; i = k;
      }
      continue;
    }
    // 函数定义：ident ( ... ) [限定符] {   ——只在命名空间 / 类 / 全局层识别
    let nameIdx = i, parts;
    if (x === "operator") {
      let j = i + 1, op = "";
      while (j < tokens.length && tokens[j].text !== "(") op += tokens[j++].text;
      if (tokens[j + 1]?.text === "(" && op === "(") { op = "()"; j += 1; } // operator()()
      parts = ["operator" + op]; i = j - 1;
    } else {
      if (KEYWORDS.has(x)) continue;
      if (tokens[i + 1]?.text !== "(") continue;
      parts = [x];
    }
    if (inCode()) continue;
    const callOpen = i + 1;
    // 回溯限定名：a::b::C<T>::~C
    let k = nameIdx - 1;
    if (tokens[k]?.text === "~") { parts[0] = "~" + parts[0]; k--; }
    for (;;) {
      if (tokens[k]?.text !== "::") break;
      let q = k - 1;
      if (tokens[q]?.text === ">" || tokens[q]?.text === ">>") {
        let d = 0, m = q;
        for (; m >= 0; m--) { const s = tokens[m].text; if (s === ">") d++; else if (s === ">>") d += 2; else if (s === "<" && --d <= 0) break; }
        q = m - 1;
      }
      if (tokens[q]?.type !== "ident" || KEYWORDS.has(tokens[q].text)) break;
      parts.unshift(tokens[q].text); k = q - 1;
    }
    const close = skipGroup(tokens, callOpen);
    let m = close + 1, initList = false;
    for (; m < tokens.length; m++) {
      const s = tokens[m].text;
      if (s === ";" || s === "=") break;
      if (s === ":" && !initList) { initList = true; continue; }
      if (s === "{") {
        if (!initList) break;
        const prev = tokens[m - 1];
        if (prev.type === "ident" || prev.text === ">") { m = skipGroup(tokens, m); continue; } // 成员{初值}
        break;
      }
      if (s === "(") { if (initList && tokens[m - 1]?.type === "ident") defSites.add(m - 1); m = skipGroup(tokens, m); continue; } // 初始化列表 a(1) 不是调用
      if (s === "<" && initList) { const e = skipAngles(tokens, m); if (e > 0) m = e; continue; }
    }
    if (tokens[m]?.text === "{") {
      const outer = enclosing();
      const qualifiedName = [...outer, ...parts].join("::");
      const name = parts[parts.length - 1];
      const isTemplate = !!pendingTemplate;
      const isSpecialization = !!pendingTemplate?.isSpecialization;
      fns.push({ qualifiedName, name, isTemplate, isSpecialization, line: tokens[nameIdx].line, bodyStart: m });
      defSites.add(nameIdx);
      if (isTemplate && !isSpecialization) { templates.add(name); templates.add(qualifiedName); }
      stack.push({ kind: "function", open: m });
      pendingTemplate = null; paren = 0; i = m;
    } else {
      defSites.add(nameIdx); // 声明（原型）也不是调用
      if (tokens[m]?.text === ";") pendingTemplate = null;
      i = close; paren = 0;
    }
  }
  return { scopes, fns, templates, classTemplates, defSites };
}

export function findCalls(tokens, defSites = new Set()) {
  const calls = new Set();
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type !== "ident") continue;
    if (t.text === "new" || t.text === "delete") { if (tokens[i - 1]?.text !== "operator") calls.add(t.text); continue; }
    if (KEYWORDS.has(t.text) || defSites.has(i)) continue;
    let j = i + 1;
    if (tokens[j]?.text === "<") { const e = skipAngles(tokens, j); if (e > 0 && tokens[e + 1]?.text === "(") j = e + 1; }
    if (tokens[j]?.text !== "(") continue;
    calls.add(t.text);
    // 限定调用 ns::fn( 也记完整名
    const q = [t.text];
    for (let k = i - 1; tokens[k]?.text === "::" && tokens[k - 1]?.type === "ident"; k -= 2) q.unshift(tokens[k - 1].text);
    if (q.length > 1) calls.add(q.join("::"));
  }
  return calls;
}

// 循环嵌套深度：for / while / do，含单语句循环体和 range-for；do-while 结尾的 while 不重复计数
export function maxLoopDepth(tokens) {
  const braces = []; // {loop:bool}
  let pending = []; // 单语句循环：记录所在花括号层
  let max = 0, doBraces = new Set();
  const depth = () => braces.filter((b) => b.loop).length + pending.length;
  for (let i = 0; i < tokens.length; i++) {
    const x = tokens[i].text;
    if (x === "for" || x === "while" || x === "do") {
      if (x === "while" && tokens[i - 1]?.text === "}" && doBraces.has(i - 1)) { continue; }
      let j = i + 1;
      if (x !== "do") { if (tokens[j]?.text !== "(") continue; j = skipGroup(tokens, j) + 1; }
      if (tokens[j]?.text === "{") { braces.push({ loop: true, isDo: x === "do" }); i = j; }
      else { pending.push(braces.length); i = j - 1; }
      max = Math.max(max, depth());
      continue;
    }
    if (x === "{") { braces.push({ loop: false }); continue; }
    if (x === "}") {
      const b = braces.pop();
      if (b?.isDo) doBraces.add(i);
      if (tokens[i + 1]?.text !== "else") pending = pending.filter((lvl) => lvl < braces.length || (lvl === braces.length && false));
      continue;
    }
    if (x === ";") pending = pending.filter((lvl) => lvl < braces.length);
  }
  return max;
}

const has = (set, want) => set.has(want) || [...set].some((n) => n.endsWith("::" + want));
const E = (code, msg, msgEn, extra) => ({ code, msg, msgEn, ...extra });

export function validateCSource(src, spec = {}) {
  const tokens = tokenize(src);
  const errors = [], warnings = [];
  const braceErr = checkBalanced(tokens);
  if (braceErr) errors.push(braceErr);
  const { scopes, fns, templates, defSites } = analyze(tokens);
  const defined = new Set(fns.flatMap((f) => [f.name, f.qualifiedName]));
  for (const fn of spec.requiredFunctions || []) if (!has(defined, fn)) errors.push(E("missing-function", `缺少必需函数 ${fn}`, `Missing required function ${fn}`, { name: fn }));
  // 已确认决策（我的补充）：requiredTemplates 保持合并检查，模板函数或模板类都算
  for (const tpl of spec.requiredTemplates || []) if (!has(templates, tpl)) errors.push(E("missing-template", `缺少模板 ${tpl}`, `Missing template ${tpl}`, { name: tpl }));
  const calls = findCalls(tokens, defSites);
  for (const fn of spec.forbiddenCalls || []) if (has(calls, fn)) errors.push(E("forbidden-call", `调用了禁用函数 ${fn}`, `Calls forbidden function ${fn}`, { name: fn }));
  for (const fn of spec.requiredCalls || []) if (!has(calls, fn)) errors.push(E("missing-call", `未调用必需函数 ${fn}`, `Does not call required function ${fn}`, { name: fn }));
  const depth = maxLoopDepth(tokens);
  if (spec.maxLoopDepth && depth > spec.maxLoopDepth) warnings.push(E("loop-depth", `循环嵌套深度 ${depth} 超过建议值 ${spec.maxLoopDepth}`, `Loop nesting depth ${depth} exceeds the suggested ${spec.maxLoopDepth}`, { depth }));
  const ns = new Set(scopes.filter((s) => s.kind === "namespace").map((s) => s.name));
  for (const n of spec.requiredNamespaces || []) if (!ns.has(n)) errors.push(E("missing-namespace", `缺少命名空间 ${n}`, `Missing namespace ${n}`, { name: n }));
  const cls = new Set(scopes.filter((s) => s.kind === "class" || s.kind === "struct").map((s) => s.name));
  for (const c of spec.requiredClasses || []) if (!cls.has(c)) errors.push(E("missing-class", `缺少类 ${c}`, `Missing class ${c}`, { name: c }));
  return { pass: errors.length === 0, errors, warnings, info: { functions: fns.map((f) => f.qualifiedName), templates: [...templates], scopes: scopes.map((s) => `${s.kind} ${s.name}`), calls: [...calls].sort(), loopDepth: depth } };
}
