// v11 单元测试（node）：解析 GLB/OBJ/STL、坏文件、猜单位、自动拆分、连通块、尺寸/体积/凸包、工程清洗、ZIP 往返
import fs from "node:fs";
import { parseModel, guessUnits } from "../src/modellab/load.js";
import { autoSplit, splitConnected, modelXform, rawSize, analyzeModule, engineDefs, explodeOffsets, mkModule } from "../src/modellab/modules.js";
import { sanitize, exportZip, importZip, emptyProject, newFunction, SCHEMA } from "../src/modellab/project.js";
const F = "e2e/fixtures/v11/";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ✓", m); } else { fail++; console.log("  ✗", m); } };
const ab = (f) => { const b = fs.readFileSync(F + f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.length); };
const near = (a, b, t) => Math.abs(a - b) <= t;

console.log("GLB 小车");
const g = await parseModel(ab("sample-rover.glb"), "sample-rover.glb");
ok(g.format === "glb" && g.meshes.length === 10, `GLB 解析出 10 个网格（${g.meshes.length}）`);
const gs = rawSize(g.meshes);
const gu = guessUnits(Math.max(gs.x, gs.y, gs.z), "glb", g.unitHint);
ok(gu.guess === "m", `GLB 单位猜成米（${gu.guess}：${gu.why}）`);
const sp = autoSplit(g.meshes);
ok(sp.modules.length === 9 && sp.modules.some((m) => m.name === "主控板" && m.meshes.length === 2), `按组名拆成 9 个模块，主控板含 2 个网格（${sp.how}）`);
const X = modelXform(g.meshes, { units: "m" });
ok(near(X.sizeMm.x, 142, 0.5) && near(X.sizeMm.z, 90, 0.5), `真实尺寸 ≈ 142×${X.sizeMm.y.toFixed(1)}×90 mm（轮子伸出底盘）（${X.sizeMm.x.toFixed(1)}×${X.sizeMm.z.toFixed(1)}）`);
const byId = new Map(g.meshes.map((m) => [m.id, m]));
const base = sp.modules.find((m) => m.name === "底盘");
const aBase = analyzeModule({ ...base, collider: "hull", material: "pla" }, byId, X.M);
ok(near(aBase.volCm3, 12 * 0.6 * 8, 0.01) && aBase.volHow.startsWith("闭合"), `底盘闭合体积 57.6 cm³（${aBase.volCm3.toFixed(2)}，${aBase.volHow}）`);
ok(near(aBase.massG, 57.6 * 1.24, 0.1), `底盘 PLA 质量估算 ≈ 71.4 g（${aBase.massG.toFixed(1)}）`);
ok(aBase.hull && aBase.hullPts === 8, `底盘凸包 8 个点（${aBase.hullPts}）`);
const wheel = sp.modules.find((m) => m.name === "左轮");
const aW = analyzeModule({ ...wheel, collider: "hull" }, byId, X.M);
ok(near(aW.volCm3, 12 * 4 * Math.sin((2 * Math.PI) / 24) * 1, 0.02), `左轮（24 边形）体积 ${aW.volCm3.toFixed(3)} cm³ ≈ ${(12 * 4 * Math.sin((2 * Math.PI) / 24)).toFixed(3)}`);
const aBox = analyzeModule({ ...wheel, collider: "box" }, byId, X.M);
ok(!aBox.hull && aBox.colliderUsed === "box", "选“方块”时不生成凸包");

console.log("OBJ 支架");
const o = await parseModel(ab("sample-bracket.obj"), "sample-bracket.obj");
ok(o.meshes.length === 3 && o.meshes.map((m) => m.name).join() === "底板,立板,加强筋", `OBJ 3 个 o 分组（${o.meshes.map((m) => m.name)}）`);
const os = rawSize(o.meshes), ou = guessUnits(Math.max(os.x, os.y, os.z), "obj");
ok(ou.guess === "mm", `OBJ 单位猜成毫米（${ou.why}）`);
ok(autoSplit(o.meshes).modules.length === 3, "OBJ 自动拆成 3 个模块");

console.log("STL 两块");
const s = await parseModel(ab("sample-two-blocks.stl"), "sample-two-blocks.stl");
ok(s.meshes.length === 1, "STL 是 1 个网格");
const parts = splitConnected(s.meshes[0]);
ok(parts.length === 2 && parts[0].tris === 12 && parts[1].tris === 12, `按连通块拆成 2 块（${parts.length}）`);
const sX = modelXform(parts, { units: "mm" });
ok(near(sX.sizeMm.x, 35, 0.01) && near(sX.sizeMm.y, 10, 0.01), `STL 尺寸 35×10×10 mm（${sX.sizeMm.x.toFixed(2)}×${sX.sizeMm.y.toFixed(2)}×${sX.sizeMm.z.toFixed(2)}）`);
const pById = new Map(parts.map((m) => [m.id, m]));
const big = analyzeModule(mkModule("大块", [parts[0].id]), pById, sX.M);
ok(near(big.volCm3, 2, 1e-3) && near(big.center.y, 0.5, 1e-4), `大块体积 2 cm³，中心 y=0.5 cm（底面在桌上）`);
const zX = modelXform(parts, { units: "mm", upAxis: "z" });
ok(near(zX.sizeMm.y, 10, 0.01) && near(zX.sizeMm.z, 10, 0.01), "Z 朝上换算后尺寸仍对");

console.log("坏文件");
const bad = async (f, re) => { try { await parseModel(ab(f), f); ok(false, f + " 应该报错"); } catch (e) { ok(e.user && re.test(e.message), `${f} → ${e.message}`); } };
await bad("broken-truncated.stl", /截断/);
await bad("broken-not-a-model.glb", /glTF/);
try { await parseModel(new ArrayBuffer(0), "a.stl"); ok(false, "空文件"); } catch (e) { ok(e.user && /空/.test(e.message), "空文件 → " + e.message); }
try { await parseModel(new ArrayBuffer(10), "a.fbx"); ok(false, "fbx"); } catch (e) { ok(e.user && /不支持/.test(e.message), "FBX → " + e.message); }
try { await parseModel(new ArrayBuffer(41 * 1024 * 1024), "big.glb"); ok(false, "大文件"); } catch (e) { ok(e.user && /太大/.test(e.message), "41 MB → " + e.message); }
const ext = new TextEncoder().encode(JSON.stringify({ asset: { version: "2.0" }, buffers: [{ uri: "https://example.com/x.bin", byteLength: 10 }] })).buffer;
try { await parseModel(ext, "ext.gltf"); ok(false, "外部 bin"); } catch (e) { ok(e.user && /外部/.test(e.message), "外部 .bin → " + e.message); }
const nanObj = new TextEncoder().encode("v 0 0 0\nv 1 0 0\nv nan 1 0\nf 1 2 3\n").buffer;
try { await parseModel(nanObj, "nan.obj"); ok(false, "NaN"); } catch (e) { ok(e.user, "NaN 坐标 → " + e.message); }

console.log("引擎零件定义 + 爆炸");
const P = emptyProject("测试");
P.model = { file: "sample-rover.glb", format: "glb", units: "m", scale: 1, upAxis: "y" };
P.modules = sp.modules;
const defs = engineDefs(P, byId, X.M, "t");
ok(defs.length === 9 && defs.every((d) => d.kind === "custom" && d.colliders[0].m > 0), `9 个零件定义，都带质量`);
const f1 = newFunction("供电", 0, "供电"); f1.modules = [sp.modules[1].id]; P.functions = [f1];
const centers = new Map(sp.modules.map((m) => [m.id, analyzeModule(m, byId, X.M).center]));
const ex = explodeOffsets(P, centers, "function", 3);
ok(ex.size === 1 && ex.get(sp.modules[1].id).length() > 3, "按功能爆炸：只移动已绑定的模块");
ok(explodeOffsets(P, centers, "module", 3).size === 9, "按模块爆炸：9 个都移动");

console.log("工程清洗 + ZIP 往返");
const fn2 = newFunction("驱动", 1, "驱动"); fn2.modules = [sp.modules[3].id, "不存在"]; fn2.regions = [{ x: 0.2, y: 0.3, w: 0.1, h: 0.2 }, { x: -5, y: 9, w: 0, h: 1 }]; fn2.pins = [{ label: "PWM1", signal: "GPIO5" }];
P.functions.push(fn2);
P.diagram = { file: "f.svg", mime: "image/svg+xml", w: 1000, h: 560 };
const clean = sanitize(JSON.parse(JSON.stringify(P)));
ok(clean.functions[1].modules.length === 1, "不存在的模块引用被删掉");
ok(clean.functions[1].regions[1].x === 0 && clean.functions[1].regions[1].y === 1 && clean.functions[1].regions[1].w === 0.001, "越界区域被夹到 0..1");
try { sanitize({ schema: "x" }); ok(false, "schema"); } catch (e) { ok(/schema/.test(e.message), "错误 schema 被拒"); }
const zip = await exportZip(P, { model: ab("sample-rover.glb"), diagram: new Blob([fs.readFileSync(F + "sample-rover-functions.svg")], { type: "image/svg+xml" }) });
const back = await importZip(await zip.arrayBuffer());
ok(back.project.modules.length === 9 && back.project.functions.length === 2 && back.project.functions[1].pins[0].signal === "GPIO5", "ZIP 导出再导入：模块、功能、引脚都在");
ok(back.assets.model.byteLength === fs.statSync(F + "sample-rover.glb").size && (await back.assets.diagram.text()).includes("小车功能图"), "ZIP 里的模型和功能图字节一致");
const re = await parseModel(back.assets.model, back.project.model.file);
ok(re.meshes.map((m) => m.id).join() === g.meshes.map((m) => m.id).join(), "重新解析得到同样的网格编号（绑定不会错位）");
console.log(`\nmodellab-test: ${pass} 通过, ${fail} 失败`);
console.log(SCHEMA);
process.exit(fail ? 1 : 0);
