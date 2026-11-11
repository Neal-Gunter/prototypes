// v38：题库管线 + 页面校验器单测（不开浏览器）。v45 增加路径测验和自学记录检查。早期原型，简化仿真。
import { gzipSync } from "node:zlib";
import { readFileSync, mkdirSync, rmSync, cpSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { tokenize, skipTemplateParams, validateCSource, analyze, findCalls, maxLoopDepth, checkBalanced } from "../src/validators/c-lite.js";
import { validateAsm } from "../src/validators/asm.js";
import { validateHex } from "../src/validators/hex.js";
import { validateCode } from "../src/validators/index.js";
import { runTimeline, checkTimeline } from "../src/bank/timeline.js";
import { checkConnectionGraph, checkAssembly, netsOf } from "../src/bank/graph.js";
import { freshnessFlag, itemStale, SOON_MS } from "../src/bank/load.js";
import { computeFreshness, buildIndex, groupBank, build, assembleItems, hashBankContent, problemTextOf } from "./build-bank.js";
import { validateBank } from "./validate-bank.js";
import { DATA, ROOT, hash, writeJSON, readJSON, MODES, DIFFICULTIES } from "./bank/lib.js";
import { classify, scoreSeed, tier, extract, FAILURE_PATTERNS } from "./extract-fault-seeds.js";
import { mergeForks } from "./parse-fromthetransistor.js";
import { parseReadme } from "./bank/ftt-parsers.js";

let pass = 0, fail = 0;
const ok = (c, m, x = "") => { (c ? pass++ : fail++); console.log(c ? "✓" : "✗", m, x); };

// ---------- c-lite ----------
{
  const src = "int x = 42; // 注释\n#define FOO 1\nint main() { return x; }\n";
  const t = tokenize(src);
  ok(t.some((x) => x.type === "number" && x.text === "42"), "tokenizer：数字不会被当成 ident");
  ok(!t.some((x) => x.text === "FOO" || x.text === "#"), "tokenizer：预处理行被抹掉");
}
{
  // 我的补充 2：括号里的 > 不算
  const t = tokenize("template<int N = (3>2)> class X {};");
  const i = t.findIndex((x) => x.text === "template");
  const after = skipTemplateParams(t, i);
  ok(t[after]?.text === "class" || t[after - 0]?.text === "class", `skipTemplateParams 跨过括号里的 >，下一个是 class（得到 ${t[after]?.text}）`);
}
{
  const t = tokenize("template<typename T> class Vec { void f() { if (a > b) { } } };");
  const r = analyze(t);
  ok(r.scopes.some((s) => s.kind === "class" && s.name === "Vec" && s.isTemplate), "findScopes：函数体里的 } 不会提前关掉类");
}
{
  const r = validateCSource("template<class T> class Box { T v; };", { requiredClasses: ["Box"], requiredTemplates: ["Box"] });
  ok(r.pass, "template<class T> 的参数不会被认成 class T", r.errors.map((e) => e.msg).join(";"));
}
{
  const r = validateCSource("void f(struct S *p, enum class Color c) { (void)p; (void)c; }", { requiredClasses: ["S"] });
  ok(!r.pass && r.errors.some((e) => e.name === "S"), "参数列表里的 struct S 不算类定义");
}
{
  const r = validateCSource("namespace { int x; } namespace N { int y; }", { requiredNamespaces: ["N"] });
  ok(r.pass && r.info.scopes.includes("namespace <anonymous>"), "匿名命名空间记作 <anonymous>，不吃掉下一个标识符");
}
{
  const r = validateCSource("template<typename T> T max(T a, T b) { return a > b ? a : b; }", { requiredTemplates: ["max"], requiredFunctions: ["max"] });
  ok(r.pass, "带返回类型的模板函数会被标成模板", JSON.stringify(r.info));
}
{
  const src = "template<typename T> struct C { void set(T); };\ntemplate<typename T> void C<T>::set(T v) { (void)v; }\nC::~C() {}\n";
  const r = validateCSource(src, { requiredFunctions: ["C::set"] });
  ok(r.info.functions.some((f) => f.includes("set")), "C<T>::set 外联能识别", r.info.functions.join(","));
}
{
  const r = validateCSource("int main() { if (1) {} for (int i=0;i<3;i++) {} }", { requiredFunctions: ["main"] });
  ok(r.pass && !r.info.functions.includes("if") && !r.info.functions.includes("for"), "if/for 不会被当成函数");
}
{
  const r = validateCSource("class Gpio { void set() {} };", { requiredFunctions: ["Gpio::set"], requiredClasses: ["Gpio"] });
  ok(r.pass, "类内联成员能对上 Gpio::set");
}
{
  const r = validateCSource("int foo() { return 1; }\nint main() { foo(); new int; malloc(1); bar<int>(1); }\n", { requiredCalls: ["foo", "new", "malloc", "bar"], requiredFunctions: ["foo", "main"] });
  ok(r.pass, "findCalls：定义不算调用；能认出 new、malloc、foo<int>(", r.info.calls.join(","));
  const r2 = validateCSource("int foo() { return 1; }", { forbiddenCalls: ["foo"] });
  ok(r2.pass, "函数定义本身不会被当成调用了 foo");
}
{
  const r = validateCSource("int main() { for(;;) { while(1) { } } }", { requiredFunctions: ["main"], maxLoopDepth: 1 });
  ok(r.pass && r.warnings.some((w) => w.code === "loop-depth") && r.info.loopDepth >= 2, `循环深度 ${r.info.loopDepth}，超过建议值给警告`);
}
{
  const bad = checkBalanced(tokenize("int main() { if (1) { }"));
  ok(bad && bad.code === "unbalanced-open", "checkBalanced 能发现未闭合的 {");
}
{
  const r = validateCSource("template<typename T> class A { }; template<typename T> class B { A<A<T>> x; };", { requiredTemplates: ["A", "B"] });
  ok(r.pass, "模板参数里的 >> 能跳过");
}
{
  const bytes = gzipSync(readFileSync(new URL("../src/validators/c-lite.js", import.meta.url)), { level: 9 }).length;
  ok(bytes < 35 * 1024, `c-lite.js gzip ${bytes} B < 35 KB`);
}
ok(!/WebAssembly|wasm/.test(readFileSync(new URL("../src/validators/c-lite.js", import.meta.url), "utf8") + readFileSync(new URL("../src/validators/index.js", import.meta.url), "utf8")), "页面校验器源码不加载 WASM");

// ---------- asm / hex ----------
{
  const r = validateAsm(".text\nstart:\n  mov r0, #1\n  add r0, r0, #1\n  b start\n", { requiredInstructions: ["mov", "add"], requiredLabels: ["start"] });
  ok(r.pass, "asm：合法的 mov/add/b");
  const r2 = validateAsm("foo:\n  b bar\n", {});
  ok(!r2.pass && r2.errors.some((e) => e.code === "label"), "asm：跳转目标不存在");
  const r3 = validateAsm("mov r0, #1, #2, #3\n", {});
  ok(!r3.pass && r3.errors.some((e) => e.code === "operands"), "asm：操作数数量不对");
  const r4 = validateAsm("mov foo0, #1\n", {});
  ok(!r4.pass && r4.errors.some((e) => e.code === "register"), "asm：寄存器不在白名单");
}
{
  const okHex = ":0100000000FF\n:00000001FF\n";
  ok(validateHex(okHex, { maxBytes: 8 }).pass, "hex：合法记录 + EOF + 校验和");
  ok(!validateHex(":010000000000\n:00000001FF\n").pass, "hex：校验和错误");
  ok(!validateHex(":0100000000FF\n").pass, "hex：缺少 EOF");
  const entry = ":020000040800F2\n:020100000001FC\n:0400000508000100EE\n:00000001FF\n";
  // checksum of type 05 will be verified by parser — if I got it wrong the test tells us
  const v = validateHex(readFileSync(join(ROOT, "data/seeds/reference/cc-hex-entry-01.hex"), "utf8"), { entry: 0x08000100, mustContain: [{ address: 0x08000100, bytes: "0001" }], addrMin: 0x08000000, addrMax: 0x0800ffff, maxBytes: 32 });
  ok(v.pass, "hex：入口与复位向量", v.errors.map((e) => e.msg).join(";"));
}

// ---------- timeline ----------
{
  const src = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(500);digitalWrite(LED_BUILTIN,LOW);delay(500);}";
  const ev = runTimeline(src, { horizonMs: 1500 });
  const r = checkTimeline(ev, { pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 500, pin: "LED", state: "LOW" }, { t: 1000, pin: "LED", state: "HIGH" }], toleranceMs: 100 });
  ok(r.pass, "firmware 时间线：500 ms 闪烁");
  const bad = "void setup(){pinMode(LED_BUILTIN,OUTPUT);}void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(50);digitalWrite(LED_BUILTIN,LOW);delay(50);}";
  const r2 = checkTimeline(runTimeline(bad, { horizonMs: 1500 }), { pins: { LED: 48 }, expected: [{ t: 0, pin: "LED", state: "HIGH" }, { t: 500, pin: "LED", state: "LOW" }], toleranceMs: 100 });
  ok(!r2.pass, "firmware 时间线：周期不对会失败；乱翻转也会因 extra 失败");
}

// ---------- graph / assembly ----------
{
  const ok1 = checkConnectionGraph({ wires: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }] }, { requiredEdges: [{ a: "pico.GP15", b: "led.A" }, { a: "led.K", b: "r220.1" }, { a: "r220.2", b: "pico.GND" }], forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }] });
  ok(ok1.pass, "连接图：经电阻到地通过");
  const short = checkConnectionGraph({ wires: [{ a: "pico.3V3", b: "pico.GND" }] }, { forbiddenEdges: [{ a: "pico.3V3", b: "pico.GND" }] });
  ok(!short.pass, "连接图：电源短接失败");
  const aok = checkAssembly({ steps: [{ part: "copper-standoff" }, { part: "board" }, { part: "screw" }] }, { requiredParts: ["copper-standoff", "board", "screw"], order: [{ before: "copper-standoff", after: "board" }, { before: "board", after: "screw" }] });
  ok(aok.pass, "装配顺序：铜柱 → 板 → 螺丝");
  const aBad = checkAssembly({ steps: [{ part: "screw" }, { part: "board" }] }, { requiredParts: ["board", "screw"], order: [{ before: "board", after: "screw" }] });
  ok(!aBad.pass, "装配顺序：先拧螺丝会失败");
}

// ---------- freshness ----------
{
  const now = Date.parse("2026-11-10T00:00:00Z");
  const entries = [{ staleAfter: "2026-10-01" }, { staleAfter: "2026-11-25" }, { staleAfter: "2027-11-01" }];
  const f = computeFreshness(entries, now);
  ok(f.staleCount === 1, `staleCount=${f.staleCount}（只有 2026-10-01 已过期）`);
  ok(f.staleEarliest === "2026-10-01T00:00:00.000Z" || f.staleEarliest.startsWith("2026-10-01"), `staleEarliest=${f.staleEarliest}`);
  ok(freshnessFlag({ staleEarliest: "2026-11-25T00:00:00Z", staleCount: 0 }, now) === "soon", "距今 <30 天黄标");
  ok(freshnessFlag({ staleEarliest: "2027-11-01T00:00:00Z", staleCount: 0 }, now) === "none", "一年后不过期，不黄标");
  ok(freshnessFlag({ staleCount: 1, staleEarliest: "2026-10-01T00:00:00Z" }, now) === "stale", "已过期条目记 stale");
  ok(itemStale({ staleAfter: "2026-10-01" }, now) && !itemStale({ staleAfter: "2027-11-01" }, now), "itemStale 按 staleAfter 判断");
  ok(SOON_MS === 30 * 24 * 3600 * 1000, "黄标窗口是 30 天");
}

// ---------- index updatedAt hash ----------
{
  const now = Date.parse("2026-11-10T00:00:00Z");
  const { bank } = groupBank([
    { id: "a", mode: "firmware", difficulty: "intro", source: { repo: "x" }, staleAfter: "2027-01-01", title: "t", passCondition: { type: "behaviorTimeline", expected: [] } },
  ], now);
  const i1 = buildIndex(bank, null, now);
  const later = now + 86400000;
  const i2 = buildIndex(bank, i1, later);
  ok(i1.modes.firmware.intro.updatedAt === i1.generatedAt, "首次 updatedAt = generatedAt");
  ok(i2.modes.firmware.intro.updatedAt === i1.modes.firmware.intro.updatedAt, "内容不变时保留上次 updatedAt");
  ok(i2.modes.firmware.intro.contentHash === i1.modes.firmware.intro.contentHash, "内容 hash 不变");
  bank.firmware.intro[0] = { ...bank.firmware.intro[0], title: "changed" };
  const i3 = buildIndex(bank, i2, later + 1000);
  ok(i3.modes.firmware.intro.updatedAt === i3.generatedAt, "内容变了才更新 updatedAt");
}

// ---------- v39：alsoFoundIn / toolLinks 不算内容 hash ----------
{
  const now = Date.parse("2026-11-10T00:00:00Z");
  const later = now + 86400000;
  const base = { id: "a", mode: "firmware", difficulty: "intro", source: { repo: "x" }, staleAfter: "2027-01-01", title: "t", prompt: "p", passCondition: { type: "behaviorTimeline", expected: [] } };
  const { bank } = groupBank([base], now);
  const i1 = buildIndex(bank, null, now);
  const withMeta = { ...bank.firmware.intro[0], alsoFoundIn: ["someone/fromthetransistor"], toolLinks: [{ name: "Soldering is Easy" }], source: { repo: "x", lastSeen: "2099-01-01" }, _stale: true };
  bank.firmware.intro[0] = withMeta;
  const i2 = buildIndex(bank, i1, later);
  ok(i2.modes.firmware.intro.contentHash === i1.modes.firmware.intro.contentHash, "改 alsoFoundIn/toolLinks/source/_stale 不改 contentHash");
  ok(i2.modes.firmware.intro.updatedAt === i1.modes.firmware.intro.updatedAt, "元数据变了也不改 updatedAt");
  // 首次用新算法对照旧 hash：即使 prevIndex 里的旧 hash 对不上，只要题面一样就不刷新
  const oldIndex = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    modes: { firmware: { intro: { updatedAt: "2026-01-01T00:00:00.000Z", contentHash: "aaaaaaaaaaaaaaaa", count: 1 } } },
  };
  const prevBank = { firmware: { intro: [{ ...base, alsoFoundIn: ["old/fork"], toolLinks: [{ name: "old" }] }] } };
  const cur = groupBank([{ ...base, alsoFoundIn: ["new/fork"] }], now).bank;
  const i3 = buildIndex(cur, oldIndex, later, prevBank);
  ok(i3.modes.firmware.intro.updatedAt === "2026-01-01T00:00:00.000Z", "迁移时用新算法重算旧条目，题面没变就不改 updatedAt");
  const cur2 = groupBank([{ ...base, title: "new title" }], now).bank;
  const i4 = buildIndex(cur2, oldIndex, later, prevBank);
  ok(i4.modes.firmware.intro.updatedAt === i4.generatedAt, "题面改了（标题）仍会更新 updatedAt");
  ok(problemTextOf(withMeta).alsoFoundIn === undefined && problemTextOf(withMeta).toolLinks === undefined, "problemTextOf 去掉元数据字段");
  ok(hashBankContent([base]) === hashBankContent([{ ...base, alsoFoundIn: ["z"] }]), "hashBankContent 忽略 alsoFoundIn");
}

// ---------- fork parsers still work ----------
{
  const md1 = "## Sec\n- [ ] **Blinking an LED (Verilog, 10 LOC)**\n";
  const md2 = "| Project | Lang | LOC |\n| --- | --- | --- |\n| UART bringup | C | 80 |\n";
  const a = parseReadme(md1), b = parseReadme(md2);
  ok(a.projects.length >= 1 && b.projects.length >= 1 && a.format !== b.format, `至少两种 README 格式能解析（${a.format} / ${b.format}）`);
  const r = mergeForks(
    [{ repo: "geohot/fromthetransistor" }, { repo: "someone/fromthetransistor" }, { repo: "empty/fromthetransistor" }],
    (repo) => repo === "empty/fromthetransistor" ? "# empty\nno projects here\n" : md1,
    (repo) => repo === "someone/fromthetransistor" ? { projects: [{ section: "S", title: "Override project", language: "C", locEstimate: 3 }] } : null,
  );
  ok(r.skipped.some((s) => s.repo === "empty/fromthetransistor" && s._skipped), "解析失败的 fork 被标 _skipped");
  ok(r.projects.some((p) => p.source.via === "override"), "override 优先于自动解析");
}

// ---------- fault seeds still work ----------
{
  const hits = classify("reversed polarity caused no power. 反接后不上电。");
  ok(hits.some((h) => h.failureMode === "reverse-polarity" && h.matchedKeywords.length >= 1), "故障规则能分出反接");
  ok(tier(0.9) === "high" && tier(0.5) === "medium" && tier(0.2) === "low", "打分分档");
  const seeds = readJSON(join(DATA, "seeds/fault-seeds.json"))?.seeds || [];
  const review = readJSON(join(DATA, "seeds/fault-seeds-review.json"))?.items || [];
  ok(seeds.length >= 1 && review.length >= 1, `故障种子入库 ${seeds.length}，review ${review.length}（不阻断）`);
  ok(seeds.every((s) => s.source.type !== "link-only"), "link-only 来源不入库");
}

// ---------- build + validate + failure protection ----------
{
  const r = build({ now: Date.parse("2026-11-10T00:00:00Z") });
  ok(r.ok && r.total >= 50, `build-bank 写出 ${r.total} 条（≥50）`);
  const v = validateBank({ now: Date.parse("2026-11-10T00:00:00Z") });
  ok(v.ok, "validate-bank 通过", v.errors?.join(";"));
  const idx = readJSON(join(DATA, "bank/index.json"));
  const intro = idx.modes["code-check"].intro;
  ok(intro.staleCount === 1 && intro.count >= 1, `code-check/intro staleCount=${intro.staleCount}（故意过期的那一题）`);
  const fwInt = idx.modes.firmware.intermediate;
  ok(fwInt.staleCount === 0 && fwInt.staleEarliest && Date.parse(fwInt.staleEarliest) > Date.parse("2026-11-10"), "即将过期的题计入 staleEarliest，但不计入 staleCount");
  ok(existsSync(join(ROOT, "public/bank/index.json")), "public/bank 已同步");
  // 0 条不覆盖
  const tmp = join(tmpdir(), "bank-data-" + Date.now());
  mkdirSync(join(tmp, "seeds"), { recursive: true });
  mkdirSync(join(tmp, "meta"), { recursive: true });
  mkdirSync(join(tmp, "bank"), { recursive: true });
  writeFileSync(join(tmp, "bank/marker.txt"), "keep-me");
  writeJSON(join(tmp, "seeds/bank-items.json"), { items: [] });
  let threw = false;
  try { build({ dataDir: tmp, dest: join(tmp, "bank"), publicDir: null, seedsPath: join(tmp, "seeds/bank-items.json") }); } catch { threw = true; }
  ok(threw && existsSync(join(tmp, "bank/marker.txt")) && !existsSync(join(tmp, "bank/index.json")), "0 条时不覆盖已有产物，只写 build-report");
  const rep = readJSON(join(tmp, "meta/build-report.json"));
  ok(rep && rep.ok === false && rep.errors?.length, "失败时写下 build-report.json");
  rmSync(tmp, { recursive: true, force: true });
}

// ---------- 参考答案用页面校验器自检（构建期也用） ----------
{
  const doc = readJSON(join(DATA, "seeds/bank-items.json"));
  let n = 0, bad = [];
  for (const it of doc.items) {
    const pc = it.passCondition;
    if (pc.type === "codeCheck" && pc.referenceAnswer) {
      const src = readFileSync(join(ROOT, pc.referenceAnswer), "utf8");
      const r = validateCode(pc.format, src, pc.spec);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "behaviorTimeline" && it.referenceFirmware) {
      const ev = runTimeline(it.referenceFirmware, { horizonMs: pc.horizonMs || 3000, inputs: pc.inputs || {} });
      const r = checkTimeline(ev, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": timeline");
    } else if (pc.type === "connectionGraphConstraint" && it.referenceAnswer) {
      const r = checkConnectionGraph(it.referenceAnswer, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "assemblyConstraint" && it.referenceAnswer) {
      const r = checkAssembly(it.referenceAnswer, pc);
      n++;
      if (!r.pass) bad.push(it.id + ": " + r.errors.map((e) => e.msg).join(","));
    } else if (pc.type === "diagnosisQuiz") {
      n++;
      const qok = (pc.questions || []).every((q) => q.answer && (q.options || []).some((o) => o.id === q.answer)) && pc.repairUrl;
      if (!qok) bad.push(it.id + ": quiz");
    }
  }
  ok(bad.length === 0 && n >= 30, `参考答案 / 题面自检 ${n} 条，失败 ${bad.length}`, bad.join("; "));
}


// ---------- v40：学习路径 + tocPageMap 跨页回填 ----------
{
  const { PATHS, findPath, pathStepHref, stepIndexForItem } = await import("../src/bank/paths.js");
  const { tocPageMap, tocPageLabel } = await import("../src/teardown/guideSheet.js");
  const { DEVICES } = await import("../src/teardown/devices.js");
  const doc = readJSON(join(DATA, "seeds/bank-items.json"));
  const ids = new Set((doc.items || []).map((it) => it.id));
  const devIds = new Set(DEVICES.map((d) => d.id));
  ok(PATHS.length >= 3, `学习路径 ${PATHS.length} 条（≥3）`);
  const seen = new Set();
  let bad = [];
  for (const pa of PATHS) {
    if (seen.has(pa.id)) bad.push("重复 id " + pa.id);
    seen.add(pa.id);
    if (!pa.title || !pa.titleEn || !pa.summary || !pa.summaryEn) bad.push(pa.id + " 缺中英标题或摘要");
    if (/[\u4e00-\u9fff]/.test(pa.titleEn + pa.summaryEn + pa.steps.map((st) => (st.titleEn || "") + (st.noteEn || "")).join(""))) bad.push(pa.id + " 英文里有汉字");
    if (pa.steps.length < 3 || pa.steps.length > 5) bad.push(pa.id + " 步数 " + pa.steps.length + "（要 3–5）");
    const kinds = new Set(pa.steps.map((st) => st.kind));
    for (const st of pa.steps) {
      if (!st.title || !st.titleEn || !st.note || !st.noteEn) bad.push(pa.id + " 某一步缺中英说明");
      if (st.kind === "bank") {
        if (!ids.has(st.id)) bad.push(pa.id + " 指向不存在的题 " + st.id);
        if (!st.mode || !st.diff) bad.push(pa.id + " 缺少 mode/diff");
      } else if (st.kind === "teardown") {
        if (!devIds.has(st.device)) bad.push(pa.id + " 指向不存在的拆解设备 " + st.device);
      } else if (st.kind === "repair") {
        if (!st.scene) bad.push(pa.id + " 缺维修关卡");
        if (!String(pathStepHref(st, pa.id)).startsWith("/repair?")) bad.push(pa.id + " 维修关卡链接不对");
      } else bad.push(pa.id + " 未知步骤类型 " + st.kind);
    }
    if (!kinds.has("bank")) bad.push(pa.id + " 没有题库步骤");
    ok(findPath(pa.id)?.id === pa.id, `findPath(${pa.id})`);
  }
  const night = findPath("path-night-light");
  ok(night && night.steps[0].kind === "teardown" && night.steps.some((st) => st.kind === "repair"), "小夜灯路径：拆解 → … → 维修");
  ok(PATHS.some((pa) => pa.steps.some((st) => st.kind === "bank" && st.mode === "workbench")) && PATHS.some((pa) => pa.steps.some((st) => st.kind === "bank" && st.mode === "assembly")), "路径里有接线题和装配题");
  const href = pathStepHref(night.steps[1], night.id);
  ok(/mode=diagnosis/.test(href) && /id=dx-dead-battery-01/.test(href) && /path=path-night-light/.test(href), "路径步骤链接带 path 参数", href);
  ok(stepIndexForItem(night, "dx-dead-battery-01") === 1, "stepIndexForItem 找到诊断题");
  ok(bad.length === 0, `路径条目完整，目标都存在（问题 ${bad.length}）`, bad.join("; "));

  const dev = { steps: new Array(7).fill({}) };
  const a = tocPageMap(dev);
  ok(a.safety === 2 && a.mats === 3 && a.steps === 4 && a.step(0) === 4 && a.step(6) === 10 && a.modules === 11 && a.notes === 12 && a.total === 12, "tocPageMap 默认与 v39 一致");
  const b = tocPageMap(dev, { safety: 3, front: 1 });
  ok(b.safety === 2 && b.mats === 5 && b.steps === 6 && b.step(0) === 6 && b.modules === 13 && b.notes === 14, `安全节占 3 页时后面页码后移 mats=${b.mats}`);
  const c = tocPageMap(dev, { front: 2, step: [1, 2, 1, 1, 1, 1, 1] });
  ok(c.safety === 3 && c.step(1) === 6 && c.step(2) === 8 && c.modules === 13, "封面跨页且第 2 步占 2 页时页码连续");
  ok(tocPageLabel(2, 1, false) === "第 2 页" && tocPageLabel(2, 3, false) === "第 2–4 页" && tocPageLabel(4, 2, true) === "p. 4–5", "tocPageLabel 单页和跨页");
}


// ---------- v42：路径进度存储 + 构建期映射 + 新设备路径 ----------
{
  const { PATHS, findPath, pathStepHref, stepKey } = await import("../src/bank/paths.js");
  const { buildPathMap } = await import("../src/bank/pathMap.js");
  const prog = await import("../src/bank/progress.js");
  const { DEVICES } = await import("../src/teardown/devices.js");
  const doc = readJSON(join(DATA, "seeds/bank-items.json"));
  const items = doc.items || [];
  const ids = new Set(items.map((it) => it.id));
  const map = buildPathMap(PATHS, items);
  const pub = readJSON(join(ROOT, "public/bank/index.json")) || readJSON(join(DATA, "bank/index.json"));

  ok(PATHS.length >= 4, `学习路径 ${PATHS.length} 条（≥4）`);
  const usedDevices = new Set();
  for (const pa of PATHS) for (const st of pa.steps) if (st.kind === "teardown") usedDevices.add(st.device);
  const fresh = findPath("path-powerbank-hot");
  ok(fresh && fresh.steps.length >= 3 && fresh.steps.length <= 5, "新路径存在且为 3–5 步");
  ok(fresh.steps[0].kind === "teardown" && fresh.steps[0].device === "powerbank-18650", "新路径从尚未覆盖的充电宝拆解开始");
  ok(fresh.steps.some((st) => st.kind === "bank") && fresh.steps.some((st) => st.kind === "repair"), "新路径含诊断/题库和维修");
  const otherTeardowns = PATHS.filter((pa) => pa.id !== "path-powerbank-hot").flatMap((pa) => pa.steps.filter((st) => st.kind === "teardown").map((st) => st.device));
  ok(!otherTeardowns.includes("powerbank-18650"), "充电宝此前没有学习路径");
  ok(DEVICES.some((d) => d.id === "powerbank-18650"), "充电宝拆解设备存在");
  ok(/未经实物验证|not verified/i.test(fresh.summary + fresh.summaryEn + fresh.steps.map((s) => s.note + s.noteEn).join("")), "新路径注明未经实物验证");
  ok(!/[一-鿿]/.test(fresh.titleEn + fresh.summaryEn + fresh.steps.map((st) => (st.titleEn || "") + (st.noteEn || "")).join("")), "新路径英文里没有汉字");

  ok(map.pathLinks["dx-dead-battery-01"]?.some((x) => x.pathId === "path-night-light"), "诊断题映射到小夜灯路径步骤");
  ok(map.pathLinks["dx-psu-bridge-01"]?.some((x) => x.pathId === "path-powerbank-hot" && x.step === 1), "短路诊断题映射到充电宝路径");
  ok(!map.pathLinks["fw-btn-led-01"], "对不上的题目不出现在映射里");
  ok(Array.isArray(map.pathStepBank["path-powerbank-hot"]?.[0]) && map.pathStepBank["path-powerbank-hot"][0].some((it) => it.id === "dx-psu-bridge-01"), "拆解步骤能链回相关题目");
  if (pub) {
    ok(pub.pathLinks?.["dx-psu-bridge-01"]?.some((x) => x.pathId === "path-powerbank-hot"), "构建产物 index.json 含 pathLinks");
    ok(pub.pathStepBank?.["path-night-light"]?.[0]?.some((it) => it.id === "dx-dead-battery-01"), "构建产物 index.json 含 pathStepBank");
  }

  const mem = () => {
    const s = new Map();
    return {
      getItem: (k) => (s.has(k) ? s.get(k) : null),
      setItem: (k, v) => { s.set(k, String(v)); },
      removeItem: (k) => { s.delete(k); },
      _raw: s,
    };
  };
  const st = mem();
  ok(prog.parsePathProgress(null).v === 1 && Object.keys(prog.parsePathProgress(null).paths).length === 0, "空值解析成空白进度");
  ok(Object.keys(prog.parsePathProgress("{").paths).length === 0, "坏 JSON 解析成空白进度");
  ok(Object.keys(prog.parsePathProgress({ v: 99, paths: { x: { done: { a: true } } } }).paths).length === 0, "错误版本丢弃");
  ok(Object.keys(prog.parsePathProgress({ v: 1, paths: [] }).paths).length === 0, "paths 为数组时丢弃");
  ok(Object.keys(prog.parsePathProgress({ v: 1, paths: null }).paths).length === 0, "paths 为 null 时丢弃");
  const dirty = prog.parsePathProgress({ v: 1, paths: { "path-night-light": { done: { "k": 1, "": true, ok: true }, extra: 1 }, bad: "nope" } });
  ok(dirty.paths["path-night-light"] && dirty.paths["path-night-light"].done.k && dirty.paths["path-night-light"].done.ok && !dirty.paths.bad, "只保留结构正常的完成标记");
  let p = prog.loadPathProgress(st);
  ok(p.v === 1 && Object.keys(p.paths).length === 0, "空存储加载为空白");
  p = prog.markPathStep("path-powerbank-hot", 0, true, st);
  const k0 = stepKey("path-powerbank-hot", fresh.steps[0], 0);
  ok(p.paths["path-powerbank-hot"].done[k0], "可标记某一步完成");
  ok(prog.pathStats(fresh, p).done === 1 && prog.pathStats(fresh, p).nextIndex === 1, "进度统计和继续位置");
  const href = prog.resumeHref(fresh, p);
  ok(href.includes("dx-psu-bridge-01") && href.includes("path-powerbank-hot"), "继续按钮指向下一步题目", href);
  p = prog.markItemDone("dx-psu-bridge-01", st);
  ok(prog.pathStats(fresh, p).done === 2, "做完对应题目会记下该步");
  p = prog.resetPathProgress("path-powerbank-hot", st);
  ok(!p.paths["path-powerbank-hot"] && prog.pathStats(fresh, p).done === 0, "重置后该路径进度清空");
  const st2 = mem();
  st2.setItem(prog.PATH_PROGRESS_KEY, "not-json");
  ok(prog.pathStats(fresh, prog.loadPathProgress(st2)).done === 0, "存储里的坏数据不会让进度崩溃");

  // v45：测验成绩和姓名与进度存在同一条版本化记录里；标记步骤时不得冲掉已有成绩。
  const { PATH_QUIZZES, quizFor, gradeQuiz, quizCoverage } = await import("../src/bank/pathQuiz.js");
  const { recordHtml, formatQuizScore, RECORD_PAPER, RECORD_INK } = await import("../src/bank/recordSheet.js");
  const CJK = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;
  const cov = quizCoverage(PATHS, PATH_QUIZZES);
  ok(cov.every((x) => x.n >= 3 && x.n <= 5), "每条路径都有 3–5 道测验题", JSON.stringify(cov));
  ok(PATHS.every((pa) => quizFor(pa.id)), "每条路径都能取到测验");
  for (const pa of PATHS) {
    const quiz = quizFor(pa.id);
    const ids = new Set();
    for (const q of quiz.questions) {
      ok(q.id && !ids.has(q.id), `${pa.id} 题号唯一 ${q.id}`);
      ids.add(q.id);
      ok(q.prompt?.zh && q.prompt?.en, `${pa.id}/${q.id} 有中英文题干`);
      ok(!CJK.test(q.prompt.en), `${pa.id}/${q.id} 英文题干无汉字`);
      ok(Array.isArray(q.options) && q.options.length >= 2, `${pa.id}/${q.id} 至少两个选项`);
      ok(q.options.some((o) => o.id === q.correct), `${pa.id}/${q.id} 正解存在`);
      for (const o of q.options) {
        ok(o.id && o.zh && o.en && o.explain?.zh && o.explain?.en, `${pa.id}/${q.id}/${o.id} 选项和说明完整`);
        ok(!CJK.test(o.en) && !CJK.test(o.explain.en), `${pa.id}/${q.id}/${o.id} 英文无汉字`);
      }
    }
    const allCorrect = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correct]));
    const g = gradeQuiz(quiz, allCorrect);
    ok(g.correct === g.total && g.total === quiz.questions.length, `${pa.id} 全对计分 ${g.correct}/${g.total}`);
    const allWrong = Object.fromEntries(quiz.questions.map((q) => [q.id, (q.options.find((o) => o.id !== q.correct) || q.options[0]).id]));
    const w = gradeQuiz(quiz, allWrong);
    ok(w.correct === 0 && w.total === quiz.questions.length, `${pa.id} 全错计分为 0`);
  }

  const st3 = mem();
  let p3 = prog.markPathStep("path-night-light", 0, true, st3);
  const night = findPath("path-night-light");
  const nightQuiz = quizFor("path-night-light");
  const first = nightQuiz.questions[0];
  p3 = prog.setPathQuiz("path-night-light", { answers: { [first.id]: first.correct }, correct: 1, total: nightQuiz.questions.length, at: "2026-11-11T04:00:00.000Z" }, st3);
  p3 = prog.setPathRecordName("path-night-light", "  李七  ", st3);
  ok(p3.paths["path-night-light"].quiz?.correct === 1, "测验成绩写入同一条进度");
  ok(p3.paths["path-night-light"].name === "李七", "姓名去空白后写入进度");
  p3 = prog.markPathStep("path-night-light", 1, true, st3);
  ok(p3.paths["path-night-light"].quiz?.correct === 1 && p3.paths["path-night-light"].name === "李七", "再标记步骤时保留测验和姓名");
  const dirtyQuiz = prog.parsePathProgress({ v: 1, paths: { "path-night-light": { done: { ok: true }, quiz: "nope", name: ["x"], extra: 1 } } });
  ok(dirtyQuiz.paths["path-night-light"].done.ok && !dirtyQuiz.paths["path-night-light"].quiz && !dirtyQuiz.paths["path-night-light"].name, "坏的测验/姓名字段被丢掉，完成标记仍在");
  ok(prog.sanitizeName("a".repeat(200)).length === prog.PATH_NAME_MAX, "姓名有长度上限");
  p3 = prog.resetPathProgress("path-night-light", st3);
  ok(!p3.paths["path-night-light"], "重置路径时测验和姓名一并清除");

  const filled = {
    v: 1,
    paths: {
      "path-night-light": {
        done: Object.fromEntries(night.steps.map((st, i) => [stepKey("path-night-light", st, i), true])),
        quiz: { answers: { [first.id]: first.correct }, correct: 3, total: 4, at: "2026-11-11T04:00:00.000Z" },
        name: "Alex",
      },
    },
  };
  const recProg = prog.parsePathProgress(filled);
  for (const lang of ["zh", "en"]) {
    const html = recordHtml({ path: night, lang, name: "Alex", prog: recProg, quiz: recProg.paths["path-night-light"].quiz, now: new Date("2026-11-11T04:00:00.000Z") });
    ok(html.includes("data-record=\"1\""), `${lang} 自学记录带标记`);
    ok(html.includes("color-scheme:light") && html.includes(RECORD_PAPER) && html.includes(RECORD_INK), `${lang} 自学记录固定浅色`);
    ok(/counter\(page\)/.test(html) && /counter\(pages\)/.test(html), `${lang} 自学记录有页码`);
    ok(/break-inside:avoid/.test(html), `${lang} 自学记录主体避免中部分页`);
    ok(!/size:\s*(A4|Letter|auto)/i.test(html), `${lang} 不写死纸张尺寸，以便 A4 和 Letter`);
    if (lang === "en") {
      ok(/Self-study record/.test(html) && /not an official certificate/i.test(html), "英文自学记录标明非正式证书");
      const body = html.replace(/<style[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ");
      ok(!CJK.test(body), "英文自学记录正文无汉字");
    } else {
      ok(/自学记录/.test(html) && /不是正式证书/.test(html), "中文自学记录标明非正式证书");
    }
    ok(html.includes("Alex") && html.includes("2026-11-11"), `${lang} 含姓名和日期`);
    ok(html.includes(formatQuizScore(recProg.paths["path-night-light"].quiz, lang === "en")), `${lang} 含测验成绩`);
    ok(html.includes(lang === "en" ? night.titleEn : night.title), `${lang} 含路径标题`);
    for (const st of night.steps) ok(html.includes(lang === "en" ? st.titleEn : st.title), `${lang} 含步骤 ${st.title}`);
  }
}


console.log(`bank-test ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
