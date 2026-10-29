import fs from "node:fs";
import occtimportjs from "occt-import-js";
const occt = await occtimportjs();
for (const f of process.argv.slice(2)) {
  const r = occt.ReadStepFile(new Uint8Array(fs.readFileSync(f)), { linearUnit: "millimeter", linearDeflectionType: "bounding_box_ratio", linearDeflection: 0.002, angularDeflection: 0.5 });
  let tris = 0; const min = [1e9,1e9,1e9], max = [-1e9,-1e9,-1e9]; const colors = new Map();
  for (const m of r.meshes) {
    tris += m.index.array.length / 3;
    const p = m.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[i+k]); max[k] = Math.max(max[k], p[i+k]); }
    for (const bf of m.brep_faces) { const c = (bf.color || m.color || [0.5,0.5,0.5]).map(x=>x.toFixed(2)).join(","); colors.set(c, (colors.get(c)||0) + bf.last - bf.first + 1); }
  }
  console.log(f, r.success, "meshes", r.meshes.length, "tris", tris, "min", min.map(v=>v.toFixed(1)), "max", max.map(v=>v.toFixed(1)));
  console.log([...colors].sort((a,b)=>b[1]-a[1]).slice(0,25));
  console.log(r.meshes.slice(0,40).map(m=>m.name).join(" | "));
}
