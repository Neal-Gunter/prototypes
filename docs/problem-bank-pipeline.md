# Prototypes 题库管线：从两个 GitHub 仓库持续提取可实践的问题

> 目标页面：<https://neal-gunter.github.io/prototypes/>  
> 数据源：`kitspace/awesome-electronics`、`geohot/fromthetransistor`、公开失效分析资料  
> 建议文件位置：`docs/problem-bank-pipeline.md`  
> 状态：全部关键决策已确认（含模板支持、条目级新鲜度）

---

## 本次修订（相对上一版）

| 变更项 | 上一版 | 本版 |
|---|---|---|
| 页面端 C/C++ 解析器 | 不支持模板 | 支持 `template<...>` 前缀识别（含嵌套 `<>` 与 `>>`），新增 `requiredTemplates` 检查项；体积目标调整为 <35KB gzip |
| index.json | 组合级 `updatedAt` | 增加条目级新鲜度：`staleEarliest`、`staleLatest`、`staleCount` |
| 构建期 tree-sitter | 支持 C/C++ | 增加模板类/模板函数校验 |

---

## 0. 一句话结论

构建时提取、静态化存储、页面内验证。`fromthetransistor` 全 fork 接入作题库主矿脉，`awesome-electronics` 作反馈知识库，故障题库从公开失效分析资料全自动提取。输出按 `mode` + `difficulty` 双层拆分，`index.json` 记录组合级与条目级新鲜度。C/C++ 校验采用**页面轻量解析 + 构建期 tree-sitter** 双层方案，页面不加载 WASM，页面端支持模板识别。

---

## 1. 数据源定位

### 1.1 fromthetransistor：题库主矿脉，全 fork 接入

每个 Section 下有 `[ ] Project` 列表，附带语言和 LOC 估计。通过 GitHub API 自动发现所有 fork，原版兜底，override 兜底。

### 1.2 awesome-electronics：反馈知识库

不独立出题。从 `Learning`、`Simulators`、`EDA Packages`、`Gerber Viewers` 条目提取“工具/教程覆盖哪个判断点”，注入到已有题目的 `hints` 和 `feedback`。

### 1.3 公开失效分析资料：故障题库，全自动录入

NASA NEPP/GSFC 报告、NASA Lessons Learned、iFixit 拆解、EEVblog 返修、datasheet 绝对最大额定值、公开论文失效模式章节。纯规则分类，低分候选进 review 队列，不阻断入库。

---

## 2. 采集层：全 fork 自动发现与解析

### 2.1 fork 自动发现

```js
// scripts/discover-forks.js
async function discoverForks() {
  const forks = [];
  let page = 1;
  while (true) {
    const res = await fetch(
      `https://api.github.com/repos/geohot/fromthetransistor/forks?per_page=100&page=${page}`,
      { headers: { Authorization: `token ${process.env.GH_TOKEN}` } }
    );
    const batch = await res.json();
    if (!batch.length) break;
    forks.push(...batch.map(f => ({
      repo: f.full_name, branch: f.default_branch,
      stars: f.stargazers_count, pushedAt: f.pushed_at
    })));
    page++;
  }
  forks.unshift({ repo: 'geohot/fromthetransistor', branch: 'master', stars: Infinity });
  return forks;
}
```

结果写入 `data/meta/forks.json`。原版永远排第一，其余按星数降序。

### 2.2 格式检测 + 多解析器

```js
const FORMAT_DETECTORS = [
  { name: 'checkbox-list',  test: /^-\s*\[\s*\]\s*\*\*.+\(.+,\s*\d+\s*LOC\)/m, parser: parseCheckboxList },
  { name: 'markdown-table', test: /^\|.*\|.*\|/m,                              parser: parseMarkdownTable },
  { name: 'plain-list',     test: /^-\s*\*\*.+\(.+\)\*\*/m,                    parser: parsePlainList },
  { name: 'html-list',      test: /<li>.*<\/li>/i,                             parser: parseHtmlList },
];
```

### 2.3 跨 fork 去重

按 `normalize(title + language + locEstimate)` 去重，保留优先级最高的来源，其余写入 `source.alsoFoundIn`。

### 2.4 手动 override

自动解析失败的 fork 写入 `data/overrides/fromthetransistor/{fork}.json`。构建脚本优先读 override，再回退自动解析。override 缺失且解析失败时标记 `_skipped` 并写入 build-report，不阻断整体构建。

### 2.5 项目到练习模式的映射

| 项目特征 | 练习模式 |
|---|---|
| 有明确“运行后应产生某行为”的描述 | `firmware` |
| 涉及硬件连接、MMIO、引脚映射 | `3d-workbench` |
| 涉及板级设计、BGA reflow、装配 | `assembly` |
| 涉及 Assembler / Compiler 输出格式 | `code-check` |

### 2.6 翻译而非运行原代码

Verilog 仿真器、Haskell 工具链不在页面里跑。把原项目的可观测行为翻译成页面内等价验证，保留核心判断点。

---

## 3. 映射层：题库 Schema

### 3.1 条目结构

```json
{
  "id": "ftt-led-blink-01",
  "source": {
    "repo": "geohot/fromthetransistor",
    "path": "Section 2: Bringup",
    "originalProject": "Blinking an LED (Verilog, 10 LOC)",
    "adaptation": "translated-to-js-timing",
    "alsoFoundIn": ["fork-a/fromthetransistor"]
  },
  "mode": "firmware",
  "difficulty": "intro",
  "title": "用页面指令集实现 LED 闪烁时序",
  "firmwareTemplate": "// 在这里写你的闪烁逻辑\n",
  "passCondition": {
    "type": "behaviorTimeline",
    "expected": [
      { "t": 0, "pin": "LED", "state": "HIGH" },
      { "t": 500, "pin": "LED", "state": "LOW" },
      { "t": 1000, "pin": "LED", "state": "HIGH" }
    ],
    "toleranceMs": 100
  },
  "hints": ["原题在 Verilog 中用计数器分频时钟", "你的解释器支持 delay()"],
  "staleAfter": "2026-06-01"
}
```

### 3.2 passCondition 类型

| 类型 | 来源 | 验证内容 |
|---|---|---|
| `behaviorTimeline` | 时序类项目 | 引脚状态随时间变化是否符合预期 |
| `connectionGraphConstraint` | 接线类项目 | 连接图满足约束而非固定连线 |
| `assemblyConstraint` | 板级类项目 | 装配方案满足约束而非固定步骤 |
| `codeCheck` | Assembler / Compiler 类项目 | asm / hex / c / cpp 静态校验 |

---

## 4. code-check：页面轻量校验 + 构建期 tree-sitter

### 4.1 双层分工

- **页面端**：自研轻量 C/C++ 解析器，体积 <35KB gzip，支持命名空间、类、成员函数、`::` 限定名、`template<...>` 前缀
- **构建期**：tree-sitter 校验 `referenceAnswer` 与 spec 一致性，支持 C 与 C++（含模板），不进入页面

### 4.2 页面端轻量 C/C++ 解析器

四个组件：tokenizer、括号栈、作用域识别、函数/模板识别。

#### 4.2.1 Tokenizer

```js
// src/validators/c-lite.js
// 体积目标：<35KB gzip

const TOKEN_RE = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\/.*|\/\*[\s\S]*?\*\/|::|->|<<|>>|\w+|\d+\.?\d*|[{}()\[\];,.<>~*&+\-=/!%^|?:])/g;

function tokenize(src) {
  const tokens = [];
  let m;
  while ((m = TOKEN_RE.exec(src))) {
    const text = m[0];
    const type =
      text.startsWith('//') || text.startsWith('/*') ? 'comment' :
      text.startsWith('"') ? 'string' :
      text.startsWith("'") ? 'char' :
      /^\w+$/.test(text) ? 'ident' :
      /^\d/.test(text) ? 'number' : 'punct';
    if (type !== 'comment') tokens.push({ type, text, pos: m.index });
  }
  return tokens;
}
```

#### 4.2.2 模板参数跳过（新增）

`template<...>` 的 `<...>` 可能嵌套，也可能以 `>>` 结束（C++11 起 `std::vector<std::vector<int>>` 合法）。教学题场景不做完整的模板语法解析，只识别模板前缀的范围，跳过它，然后在后面找类名或函数名。

```js
// i 指向 'template' 关键字，返回模板参数结束后的位置
function skipTemplateParams(tokens, i) {
  if (tokens[i].text !== 'template') return i;
  let j = i + 1;
  if (tokens[j]?.text !== '<') return i + 1;  // template<> 特化
  let depth = 0;
  for (; j < tokens.length; j++) {
    const t = tokens[j].text;
    if (t === '<') depth++;
    else if (t === '>') { depth--; if (depth <= 0) return j + 1; }
    else if (t === '>>') { depth -= 2; if (depth <= 0) return j + 1; }
  }
  return j;
}
```

返回值使用方式：

```js
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].text === 'template') {
    const after = skipTemplateParams(tokens, i);
    // 从 after 开始继续找类名或函数名
    // 记录该模板名到模板集合
    i = after - 1;
    continue;
  }
  // ... 普通识别逻辑
}
```

已知限制（写进 spec 约束）：

- 模板特化 `template<>` 支持，模板部分特化 `template<typename T> class X<T*>` 不单独追踪
- 模板内部表达式不做语义分析（教学题不涉及）
- `template` 与非模板同名函数的重载不区分

#### 4.2.3 作用域识别：命名空间、类、模板类

```js
function findScopes(tokens) {
  const scopes = [];       // 最终输出的作用域
  const templates = [];    // 模板名集合
  const stack = [];

  for (let i = 0; i < tokens.length; i++) {
    let isTemplate = false;
    let cursor = i;

    if (tokens[i].text === 'template') {
      isTemplate = true;
      cursor = skipTemplateParams(tokens, i);
    }

    const t = tokens[cursor];
    if (t?.type === 'ident' && ['namespace', 'class', 'struct', 'union'].includes(t.text)) {
      let j = cursor + 1;
      while (j < tokens.length && tokens[j].type !== 'ident') j++;
      const name = tokens[j]?.text || '<anonymous>';
      let k = j + 1;
      while (k < tokens.length && tokens[k].text !== '{' && tokens[k].text !== ';') k++;
      if (tokens[k]?.text === '{') {
        stack.push({ kind: t.text, name, isTemplate, openBrace: k });
        if (isTemplate) templates.push(name);
      }
      i = k;
    } else if (tokens[i].text === '}' && stack.length) {
      const top = stack.pop();
      scopes.push({
        kind: top.kind, name: top.name, isTemplate: top.isTemplate,
        start: top.openBrace, end: i
      });
    }
  }
  return { scopes, templates };
}
```

#### 4.2.4 函数定义识别：含模板函数

支持的形式：

```text
int foo() { ... }
namespace N { int foo() {} }
class C { void foo() {} };
void C::foo() { ... }
C::C() { ... }
~C::C() { ... }
template<typename T> T max(T a, T b) { ... }         // 模板函数
template<typename T> void C<T>::set(T v) { ... }      // 模板类成员外联
template<> void C<int>::set(int v) { ... }             // 全特化
```

```js
function findFunctionDefs(tokens) {
  const fns = [];          // { qualifiedName, name, isTemplate, isSpecialization, ... }
  const templates = new Set();

  for (let i = 0; i < tokens.length; i++) {
    let isTemplate = false;
    let isSpecialization = false;
    let cursor = i;

    if (tokens[i].text === 'template') {
      isTemplate = true;
      // 判断是否为全特化：template <>
      if (tokens[i + 1]?.text === '<' && tokens[i + 2]?.text === '>') {
        isSpecialization = true;
      }
      cursor = skipTemplateParams(tokens, i);
    }

    const tok = tokens[cursor];
    if (!tok || (tok.type !== 'ident' && tok.text !== '~')) continue;

    // 回溯限定名 a::b::c
    let nameStart = cursor;
    const parts = [tok.text];
    let k = cursor - 1;
    while (k >= 1 && tokens[k].text === '::' && tokens[k - 1].type === 'ident') {
      parts.unshift(tokens[k - 1].text);
      nameStart = k - 1;
      k -= 2;
    }
    // 处理模板类外联：C<T>::set
    while (k >= 1 && tokens[k].text === '>' ) {
      let depth = 0, m = k;
      for (; m >= 0; m--) {
        if (tokens[m].text === '>') depth++;
        else if (tokens[m].text === '<') { depth--; if (depth === 0) break; }
      }
      if (m > 0 && tokens[m - 1].type === 'ident') {
        parts.unshift(tokens[m - 1].text);
        nameStart = m - 1;
        k = m - 2;
        while (k >= 1 && tokens[k].text === '::' && tokens[k - 1].type === 'ident') {
          parts.unshift(tokens[k - 1].text);
          nameStart = k - 1;
          k -= 2;
        }
      } else break;
    }

    const qualifiedName = parts.join('::');
    const name = parts[parts.length - 1];
    const afterTemplate = isTemplate ? skipTemplateParams(tokens, i) : cursor;

    let j = afterTemplate + 1;
    if (tokens[j]?.text !== '(') continue;

    let depth = 0;
    for (; j < tokens.length; j++) {
      if (tokens[j].text === '(') depth++;
      else if (tokens[j].text === ')') { depth--; if (depth === 0) break; }
    }
    let m = j + 1;
    while (m < tokens.length && tokens[m].text !== '{' && tokens[m].text !== ';' && tokens[m].text !== '=') m++;
    if (tokens[m]?.text === '{') {
      fns.push({ qualifiedName, name, isTemplate, isSpecialization, start: nameStart, paramsEnd: j, bodyStart: m });
      if (isTemplate && !isSpecialization) templates.add(name);
    }
    i = m;
  }
  return { fns, templates };
}
```

#### 4.2.5 调用识别

```js
function findCalls(tokens) {
  const calls = new Set();
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i].type !== 'ident') continue;
    const next = tokens[i + 1].text;
    if (next === '(') calls.add(tokens[i].text);
    else if (next === '::' && tokens[i + 2]?.type === 'ident' && tokens[i + 3]?.text === '(') {
      calls.add(tokens[i + 2].text);
    }
  }
  for (let i = 1; i < tokens.length - 1; i++) {
    if (tokens[i].type === 'ident' && tokens[i + 1].text === '(') {
      if (tokens[i - 1].text === '.' || tokens[i - 1].text === '->') {
        calls.add(tokens[i].text);
      }
    }
  }
  return calls;
}
```

#### 4.2.6 循环深度

`for` / `while` / `do` 关键字 + 花括号层级，逻辑同前，支持 C++ range-for。

#### 4.2.7 校验主函数

```js
function validateCSource(src, spec) {
  const tokens = tokenize(src);
  const errors = [];
  const warnings = [];

  const braceErr = checkBalanced(tokens);
  if (braceErr) errors.push(braceErr);

  const { fns, templates: fnTemplates } = findFunctionDefs(tokens);
  const { scopes, templates: classTemplates } = findScopes(tokens);
  const allTemplates = new Set([...fnTemplates, ...classTemplates]);

  const definedNames = new Set(fns.map(f => f.name));
  const definedQualified = new Set(fns.map(f => f.qualifiedName));

  spec.requiredFunctions?.forEach(fn => {
    if (!definedNames.has(fn) && !definedQualified.has(fn)) {
      errors.push({ msg: `缺少必需函数 ${fn}` });
    }
  });

  spec.requiredTemplates?.forEach(tpl => {
    if (!allTemplates.has(tpl)) errors.push({ msg: `缺少模板 ${tpl}` });
  });

  const calls = findCalls(tokens);
  spec.forbiddenCalls?.forEach(fn => { if (calls.has(fn)) errors.push({ msg: `调用了禁用函数 ${fn}` }); });
  spec.requiredCalls?.forEach(fn => { if (!calls.has(fn)) errors.push({ msg: `未调用必需函数 ${fn}` }); });

  const depth = maxLoopDepth(tokens);
  if (spec.maxLoopDepth && depth > spec.maxLoopDepth) {
    warnings.push({ msg: `循环嵌套深度 ${depth} 超过建议值 ${spec.maxLoopDepth}` });
  }

  if (spec.requiredNamespaces) {
    const nsNames = new Set(scopes.filter(s => s.kind === 'namespace').map(s => s.name));
    spec.requiredNamespaces.forEach(ns => {
      if (!nsNames.has(ns)) errors.push({ msg: `缺少命名空间 ${ns}` });
    });
  }
  if (spec.requiredClasses) {
    const classNames = new Set(scopes.filter(s => s.kind === 'class' || s.kind === 'struct').map(s => s.name));
    spec.requiredClasses.forEach(c => {
      if (!classNames.has(c)) errors.push({ msg: `缺少类 ${c}` });
    });
  }

  return { pass: errors.length === 0, errors, warnings };
}
```

#### 4.2.8 页面端支持的检查项

| 检查项 | 支持 |
|---|---|
| 必需函数存在性（含 `Ns::fn`、`C::method`、`C<T>::method`） | ✅ |
| 禁用函数调用 | ✅ |
| 必需函数调用 | ✅ |
| 括号配对 | ✅ |
| 循环嵌套深度 | ✅ |
| 必需命名空间 | ✅ |
| 必需类/结构体 | ✅ |
| 必需模板（模板函数或模板类） | ✅ |
| 模板全特化识别 | ✅（计入函数存在性，不单独检查） |
| 指令白名单（asm） | ✅ |
| HEX 记录格式与地址范围 | ✅ |
| 模板部分特化 `template<typename T> class X<T*>` | ❌ 构建期 |
| 模板参数内的表达式/概念约束 | ❌ 构建期 |
| 类型检查 | ❌ 构建期 |
| 宏展开 | ❌ 构建期 |
| 跨文件符号解析 | ❌ 构建期 |
| 复杂控制流分析 | ❌ 构建期 |

**体积估算**：tokenizer + 模板跳过 + 作用域 + 函数定义 + 调用识别 + 循环深度 + 校验，未压缩约 52KB，gzip 后约 26–32KB，落在 <35KB 目标内。

### 4.3 构建期 tree-sitter 用途

1. **题库 spec 自检**：用 tree-sitter 解析 `referenceAnswer`，确认 spec 中所有规则对参考答案成立
2. **离线批量分析**：从 fromthetransistor 的 Assembler/Compiler 类项目中自动提取检查规则
3. **难度分级辅助**：估算 AST 深度和节点数，作为 LOC 之外的辅助分层依据

```js
// scripts/validate-code-specs.js
const Parser = require('tree-sitter');
const C = require('tree-sitter-c');
const Cpp = require('tree-sitter-cpp');

function validateSpecAgainstReference(spec, referenceSource, lang = 'c') {
  const parser = new Parser();
  parser.setLanguage(lang === 'cpp' ? Cpp : C);
  const root = parser.parse(referenceSource).rootNode;
  const errors = [];

  spec.requiredFunctions?.forEach(fn => {
    const name = fn.includes('::') ? fn.split('::').pop() : fn;
    const found = root.descendantsOfType(['function_definition', 'function_declarator'])
      .some(n => n.text.includes(name + '('));
    if (!found) errors.push(`参考答案中不存在必需函数 ${fn}，spec 不可满足`);
  });

  spec.requiredCalls?.forEach(fn => {
    const called = root.descendantsOfType('call_expression')
      .some(c => c.childForFieldName('function')?.text.includes(fn));
    if (!called) errors.push(`参考答案未调用 ${fn}，spec 不可满足`);
  });

  spec.forbiddenCalls?.forEach(fn => {
    const called = root.descendantsOfType('call_expression')
      .some(c => c.childForFieldName('function')?.text.includes(fn));
    if (called) errors.push(`参考答案调用了被禁用函数 ${fn}`);
  });

  spec.requiredNamespaces?.forEach(ns => {
    const found = root.descendantsOfType('namespace_definition')
      .some(n => n.childForFieldName('name')?.text === ns);
    if (!found) errors.push(`参考答案中不存在命名空间 ${ns}`);
  });

  spec.requiredClasses?.forEach(cls => {
    const found = root.descendantsOfType(['class_specifier', 'struct_specifier'])
      .some(n => n.childForFieldName('name')?.text === cls);
    if (!found) errors.push(`参考答案中不存在类 ${cls}`);
  });

  // 模板类与模板函数（新增）
  spec.requiredTemplates?.forEach(tpl => {
    const classTpl = root.descendantsOfType('template_declaration')
      .some(t => {
        const inner = t.namedChildren.find(c =>
          ['class_specifier', 'struct_specifier'].includes(c.type));
        return inner?.childForFieldName('name')?.text === tpl;
      });
    const fnTpl = root.descendantsOfType('template_declaration')
      .some(t => {
        const inner = t.namedChildren.find(c =>
          ['function_definition', 'function_declarator'].includes(c.type));
        return inner?.text?.includes(tpl + '(');
      });
    if (!classTpl && !fnTpl) errors.push(`参考答案中不存在模板 ${tpl}`);
  });

  return errors;
}
```

### 4.4 题库条目声明规则

```json
{
  "passCondition": {
    "type": "codeCheck",
    "format": "cpp",
    "spec": {
      "requiredFunctions": ["main", "Gpio::set"],
      "requiredNamespaces": ["hal"],
      "requiredClasses": ["Gpio"],
      "requiredTemplates": ["RingBuffer"],
      "forbiddenCalls": ["printf", "malloc", "new"],
      "requiredCalls": ["gpio_init"],
      "maxLoopDepth": 3
    },
    "referenceAnswer": "src/reference/ftt-gpio-01.cpp"
  }
}
```

`referenceAnswer` 仅在构建期被 tree-sitter 校验，页面端只加载 `spec`。

### 4.5 汇编与 hex 校验器

**asm**：指令白名单、寄存器白名单、标签定义/跳转目标存在性、操作数数量。  
**hex**：Intel HEX 记录格式、总字节数上限、地址范围、入口向量、校验和。

---

## 5. 存储与加载：按 mode + difficulty 双层拆分

### 5.1 目录结构

```text
data/
  bank/
    firmware/     { intro, intermediate, advanced }.json
    workbench/    { intro, intermediate, advanced }.json
    assembly/     { intro, intermediate, advanced }.json
    diagnosis/    { intro, intermediate, advanced }.json
    code-check/   { intro, intermediate, advanced }.json
    index.json
  overrides/
    fromthetransistor/{fork}.json
  seeds/
    fault-seeds.json
    fault-seeds-review.json
  meta/
    forks.json
    sources.json
    build-report.json
scripts/
  discover-forks.js
  fetch-sources.js
  parse-fromthetransistor.js
  parse-awesome-electronics.js
  extract-fault-seeds.js
  validate-code-specs.js
  build-bank.js
  validate-bank.js
.github/workflows/
  build-bank.yml
```

### 5.2 index.json：组合级 + 条目级新鲜度

每个 `mode × difficulty` 记录：

- `count`：条目数
- `updatedAt`：本组合文件内容变化时更新
- `staleEarliest`：本组中最早的 `staleAfter`
- `staleLatest`：本组中最晚的 `staleAfter`
- `staleCount`：本组中 `staleAfter < now` 的条目数

```json
{
  "generatedAt": "2026-01-15T06:00:00Z",
  "modes": {
    "firmware": {
      "intro": {
        "count": 14,
        "updatedAt": "2026-01-15T06:00:00Z",
        "staleEarliest": "2026-03-01T00:00:00Z",
        "staleLatest":   "2026-08-01T00:00:00Z",
        "staleCount": 0
      },
      "intermediate": {
        "count": 9,
        "updatedAt": "2026-01-15T06:00:00Z",
        "staleEarliest": "2025-12-01T00:00:00Z",
        "staleLatest":   "2026-07-01T00:00:00Z",
        "staleCount": 2
      },
      "advanced": { "count": 3, "updatedAt": "2026-01-15T06:00:00Z", "staleEarliest": "2026-09-01T00:00:00Z", "staleLatest": "2026-09-01T00:00:00Z", "staleCount": 0 }
    },
    "workbench":  { "...": "同上结构" },
    "assembly":   { "...": "同上结构" },
    "diagnosis":  { "...": "同上结构" },
    "code-check": { "...": "同上结构" }
  },
  "total": 109
}
```

### 5.3 新鲜度统计实现

```js
// scripts/build-bank.js（节选）
function computeFreshness(entries, now) {
  let earliest = null, latest = null, staleCount = 0;
  for (const e of entries) {
    if (!e.staleAfter) continue;
    const t = Date.parse(e.staleAfter);
    if (Number.isNaN(t)) continue;
    if (earliest === null || t < earliest) earliest = t;
    if (latest === null || t > latest) latest = t;
    if (t < now) staleCount++;
  }
  return {
    staleEarliest: earliest !== null ? new Date(earliest).toISOString() : null,
    staleLatest:   latest   !== null ? new Date(latest).toISOString()   : null,
    staleCount
  };
}

function buildIndex(bank, prevIndex) {
  const now = Date.now();
  const nextIndex = { generatedAt: new Date(now).toISOString(), modes: {}, total: 0 };
  for (const mode of MODES) {
    nextIndex.modes[mode] = {};
    for (const diff of DIFFICULTIES) {
      const filePath = `data/bank/${mode}/${diff}.json`;
      const newContent = JSON.stringify(bank[mode][diff], null, 2);
      const oldContent = readFileSafe(filePath);
      const changed = hash(newContent) !== hash(oldContent);
      const prevUpdatedAt = prevIndex.modes?.[mode]?.[diff]?.updatedAt;

      const freshness = computeFreshness(bank[mode][diff], now);
      nextIndex.modes[mode][diff] = {
        count: bank[mode][diff].length,
        updatedAt: changed || !prevUpdatedAt ? nextIndex.generatedAt : prevUpdatedAt,
        ...freshness
      };
      nextIndex.total += bank[mode][diff].length;
    }
  }
  return nextIndex;
}
```

### 5.4 页面按需加载

```js
async function loadIndex() {
  return fetch('data/bank/index.json').then(r => r.json());
}

async function loadBank(mode, difficulty) {
  const res = await fetch(`data/bank/${mode}/${difficulty}.json`);
  return res.ok ? res.json() : [];
}
```

首屏只加载 `index.json`。课程大纲页可直接用 `count`、`updatedAt`、`staleEarliest`、`staleLatest`、`staleCount` 展示题库新鲜度。

示例展示文案：

- 常规：「firmware / intro · 14 题 · 更新于 2026-01-15」
- 有即将过期：「firmware / intermediate · 9 题 · 2 题将在 2025-12-01 过期」
- 全部新鲜：「firmware / advanced · 3 题 · 最早过期 2026-09-01」

### 5.5 难度分层规则

确定性映射，保证构建可重复。

**fromthetransistor 条目**：按 `locEstimate` 分层。

| LOC 区间 | 难度 |
|---|---|
| 1–50 | `intro` |
| 51–300 | `intermediate` |
| 301+ | `advanced` |

对 `code-check` 的 Assembler/Compiler 类项目，按“是否需要多文件/多阶段输出”上调一级。

**故障种子**：按失效模式复杂度分层。

| 失效模式 | 难度 |
|---|---|
| 极性反接、连接器误插、螺丝滑牙 | `intro` |
| 冷焊/虚焊、焊盘起翘、线束弯折 | `intermediate` |
| 热失效、IMC 过厚、间歇性多故障组合 | `advanced` |

**awesome-electronics 注入的判断规则**：继承所在题目的难度。

### 5.6 跨层引用

同一项目按 `id` 唯一，不跨层重复。跨难度引用用 `prerequisite` 字段。

---

## 6. 故障种子：纯规则管线

### 6.1 管线总览

```text
抓取原文 → 文本清洗 → 分句 → 规则分类（关键词 + 症状匹配）
  → 置信度打分 → 高分/中分入 fault-seeds.json
  → 低分入 fault-seeds-review.json（不阻断入库）
```

不调用 LLM，不依赖外部 API。

### 6.2 来源清单

| 来源 | 格式 | 抓取方式 |
|---|---|---|
| NASA NEPP / GSFC 失效分析报告 | PDF | `pdf-parse` |
| NASA Lessons Learned 数据库 | HTML/JSON | API 或页面抓取 |
| iFixit 维修指南 | HTML | 页面抓取 |
| EEVblog 拆解/返修文章 | HTML | 页面抓取 + 正文提取 |
| datasheet 绝对最大额定值 | PDF | 表格提取 |
| 公开论文失效模式章节 | PDF | 文本提取 |

来源清单在 `data/meta/fault-sources.json`。

### 6.3 规则分类器

```js
const FAILURE_PATTERNS = [
  { failureMode: 'cold-solder', keywords: ['cold solder', 'cold joint', '虚焊', '冷焊', 'dull joint'], symptomHints: ['intermittent', 'vibration', '间歇'], injectType: 'solder-joint' },
  { failureMode: 'reverse-polarity', keywords: ['reverse polarity', 'reversed', '反接'], symptomHints: ['no power', 'protection'], injectType: 'component-orientation' },
  { failureMode: 'pad-lift', keywords: ['pad lift', 'lifted pad', '焊盘起翘'], symptomHints: ['open', 'detached'], injectType: 'solder-pad' },
  { failureMode: 'connector-misinsert', keywords: ['connector', 'misinsert', '排线反插', '连接器误插'], symptomHints: ['no output'], injectType: 'connector' },
  { failureMode: 'stripped-screw', keywords: ['stripped screw', 'overtighten', '滑牙'], symptomHints: ['loose'], injectType: 'fastener' },
  { failureMode: 'thermal-failure', keywords: ['thermal', 'overheat', '热失效', '过温'], symptomHints: ['drift', '参数漂移'], injectType: 'power-component' },
  { failureMode: 'harness-overbend', keywords: ['bend radius', 'harness', '线束弯折'], symptomHints: ['open', 'intermittent'], injectType: 'harness' },
];
```

### 6.4 置信度打分与分档

```js
function scoreSeed(seed, context) {
  let score = 0;
  if (seed.matchedKeywords.length >= 2) score += 0.4;
  if (seed.symptomHints.length >= 1) score += 0.3;
  if (context.sourceType === 'official-failure-report') score += 0.2;
  if (context.sourceType === 'datasheet') score += 0.1;
  return Math.min(score, 1);
}
```

- `>= 0.7`：入 `fault-seeds.json`，`confidence: "high"`
- `0.4–0.7`：入 `fault-seeds.json`，`confidence: "medium"`，同时写 review
- `< 0.4`：只写 `fault-seeds-review.json`

### 6.5 种子结构

```json
{
  "id": "fault-cold-solder-01",
  "source": { "type": "public-failure-analysis", "ref": "NASA NEPP report X / iFixit guide Y", "extractedAt": "2026-01-15" },
  "failureMode": "cold-solder",
  "symptom": ["间歇性工作", "轻敲后恢复", "固件行为不稳定"],
  "injectAt": { "target": "sp-20", "type": "solder-joint" },
  "verification": { "type": "faultRepaired", "firmwareBehavior": "led-stable-on" },
  "difficulty": "intermediate",
  "confidence": "high"
}
```

### 6.6 review 队列

`fault-seeds-review.json` 不阻断入库，异步复核，可手动提升为正式种子。

### 6.7 与 L5 诊断关卡衔接

```json
{
  "id": "L5-1",
  "mode": "diagnosis",
  "difficulty": "intermediate",
  "faultPool": ["fault-cold-solder-01", "fault-reverse-polarity-01"],
  "injected": 2,
  "symptom": "servo-jitter",
  "measurementPoints": ["tp-vin", "tp-3v3", "tp-gnd", "tp-pwm"],
  "budget": { "measurements": 8 }
}
```

按 difficulty 从对应层级种子池中抽取。

---

## 7. GitHub Actions 构建流水线

```yaml
# .github/workflows/build-bank.yml
name: Build Problem Bank

on:
  schedule: [{ cron: '0 6 * * 1' }]
  workflow_dispatch:
  push:
    paths:
      - 'scripts/**'
      - 'data/overrides/**'
      - 'data/meta/fault-sources.json'

jobs:
  build:
    runs-on: ubuntu-latest
    permissions: { contents: write }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: Discover forks
        run: node scripts/discover-forks.js
        env: { GH_TOKEN: '${{ secrets.GITHUB_TOKEN }}' }
      - run: node scripts/fetch-sources.js
      - run: node scripts/parse-fromthetransistor.js
      - run: node scripts/parse-awesome-electronics.js
      - run: node scripts/extract-fault-seeds.js
      - run: node scripts/validate-code-specs.js
      - run: node scripts/build-bank.js
      - run: node scripts/validate-bank.js
      - name: Commit bank if changed
        run: |
          git config user.name "bank-bot"
          git config user.email "bank-bot@users.noreply.github.com"
          git add data/bank data/seeds data/meta
          git diff --staged --quiet || git commit -m "chore: rebuild problem bank [skip ci]"
          git push
```

### 7.1 失败保护

`build-bank.js` 先写临时目录，全部校验通过后再替换 `data/bank/`。任一解析器抛错或产出 0 条时不覆盖已有产物，只写 `build-report.json`，workflow 标记 failure 但线上题库不受影响。

### 7.2 stale 标记

构建期为过期条目打 `_stale = true` 写入 `build-report.json`；`index.json` 通过 `staleCount` 汇总。页面加载对 `_stale` 条目显示“来源可能已变更”提示，不阻断练习。

---

## 8. 实施顺序

1. fork 自动发现 + 多格式解析器 + 去重 + override
2. 难度分层规则落地，输出 `mode/difficulty` 双层结构 + 带新鲜度字段的 `index.json`
3. 页面端轻量 C/C++ 解析器（命名空间、类、成员函数、`::` 限定名、`template<...>` 前缀）+ asm/hex 校验器
4. 构建期 tree-sitter 校验题库 spec 可满足性（C 与 C++，含模板）
5. 故障种子纯规则提取管线
6. GitHub Actions 全链路，带失败保护和 stale 标记
7. 页面按 `index.json` → `mode/difficulty` 按需加载

---

## 9. 验收标准

- [ ] fork 自动发现覆盖原版 + 所有可发现的 fork，去重后来源可追溯
- [ ] 至少两种不同 README 格式的 fork 能被正确解析
- [ ] override 机制生效，自动解析失败的 fork 被标记 `_skipped` 且不阻断构建
- [ ] 题库按 `mode/difficulty` 双层输出
- [ ] `index.json` 每个组合含 `count`、`updatedAt`、`staleEarliest`、`staleLatest`、`staleCount`
- [ ] `updatedAt` 按文件内容 hash 判断是否变化，无变化时保留上次时间
- [ ] `staleCount` 与 `staleEarliest < now` 一致，可被独立测试用例验证
- [ ] 页面端 C/C++ 解析器 gzip 体积 <35KB，支持第 4.2.8 节列出的全部检查项
- [ ] 页面端能识别 `namespace X { ... }`、`class X { ... }`、`void C::foo() { ... }`、`C::C() { ... }`
- [ ] 页面端能识别 `template<typename T>` 模板函数与模板类，模板参数内出现 `>>` 时正确跳过
- [ ] 页面端不加载任何 WASM
- [ ] 构建期 tree-sitter 支持 C 与 C++（含模板），能校验 `referenceAnswer`，不可满足的 spec 被拦截
- [ ] 故障种子提取管线跑通：规则打分，高分/中分入库，低分进 review
- [ ] 构建流程不依赖任何外部 LLM API 密钥
- [ ] review 队列不阻断入库，可异步复核
- [ ] GitHub Actions 定时构建成功提交，失败不覆盖已有产物
- [ ] 每条条目带 `source`、`difficulty`、`staleAfter`
- [ ] 页面首屏只加载 `index.json`，选择 mode/difficulty 后再加载对应文件
- [ ] 全流程在纯静态 GitHub Pages 下可运行

---

## 10. 已确认决策

| 决策项 | 结论 |
|---|---|
| fromthetransistor fork 接入范围 | 全部接入，GitHub API 自动发现 + 原版兜底 + override 兜底 |
| code-check C/C++ 校验 | 页面端自研轻量解析器（<35KB gzip，支持命名空间、类、成员函数、`::` 限定名、`template<...>` 前缀），构建期 tree-sitter 校验 spec 可满足性，页面不加载 WASM |
| 故障种子录入方式 | 纯规则管线，高分/中分入库，低分进 review，不调用 LLM |
| 题库分层 | 按 `mode` + `difficulty` 双层拆分，LOC 与失效模式复杂度作为确定性分层规则 |
| 题库索引 | `index.json` 记录组合级 `count`、`updatedAt`，以及条目级 `staleEarliest`、`staleLatest`、`staleCount` |
| 页面模板支持 | 支持 `template<...>` 前缀识别，含嵌套 `<>` 与 `>>`；不支持模板部分特化与模板参数内表达式，仅构建期 tree-sitter 校验 |

---

## 11. 剩余待确认

1. 课程大纲页是否需要在「题目即将过期」时主动提示（例如 `staleEarliest` 距今 <30 天时显示黄色标记）？如果不需要，`index.json` 里的字段保留供外部工具使用即可。
2. 模板题的 `requiredTemplates` 是否需要区分“模板函数”与“模板类”？当前实现合并成一个集合检查，如果教学上需要区分，spec 可拆为 `requiredTemplateFunctions` 与 `requiredTemplateClasses`。
