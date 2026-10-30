// v13：用固件 JS 孪生 + Rapier 物理跑一个步态并测量（node scripts/gait-run.mjs [gait.json] [sec] [mu]）
// gait = null → 固件默认步态；否则相当于把 octopus_gait_custom.h 编进固件（Body.SetCustomGait）。
import fs from "node:fs";
import { runGait, fmt } from "../src/gait/octo-measure.js";
export { runGait, fmt };
if (import.meta.url === `file://${process.argv[1]}`) {
  const [f, sec = "15", mu = "0.5"] = process.argv.slice(2);
  const gait = f && f !== "-" ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
  const t0 = Date.now(); const r = await runGait({ gait, sec: +sec, mu: +mu });
  console.log(JSON.stringify(fmt(r)), "wall", Date.now() - t0, "ms");
}
