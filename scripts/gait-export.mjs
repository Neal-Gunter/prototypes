// v13：把步态导出成固件头文件  node scripts/gait-export.mjs <row|v14|firmware|gait.json> <out.h>
// v14：闭环增益  node scripts/gait-export.mjs ctrl <out.h> [ctrl.json]  → octopus_ctrl_custom.h
import fs from "node:fs";
import { toFirmwareHeader, octoFirmwareGait, sanitizeGait } from "../src/gait/gait.js";
import { octoRowGait, octoV14Gait } from "../src/gait/octo-best.js";
import { toCtrlHeader, OCTO_CTRL } from "../src/gait/ctrl.js";
const [src = "row", out = "octopus_gait_custom.h", cfg = ""] = process.argv.slice(2);
if (src === "ctrl") {
  const c = cfg ? JSON.parse(fs.readFileSync(cfg, "utf8")) : OCTO_CTRL;
  fs.writeFileSync(out, toCtrlHeader(c, { source: "scripts/gait-export.mjs ctrl" + (cfg ? " " + cfg : "（默认增益）") }));
  console.log("wrote", out, "ctrl");
} else {
  const g = src === "row" ? octoRowGait() : src === "v14" ? octoV14Gait() : src === "firmware" ? octoFirmwareGait() : sanitizeGait(JSON.parse(fs.readFileSync(src, "utf8")), 8);
  fs.writeFileSync(out, toFirmwareHeader(g, { source: "scripts/gait-export.mjs " + src }));
  console.log("wrote", out, g.name);
}
