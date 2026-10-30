// v13：把步态导出成固件头文件  node scripts/gait-export.mjs <row|v14|firmware|gait.json> <out.h>
// v14：闭环增益  node scripts/gait-export.mjs ctrl <out.h> [ctrl.json]  → octopus_ctrl_custom.h
// v16：舵机校准  node scripts/gait-export.mjs trim <out.h> [calib.json]  → octopus_trim_custom.h（不给 json 就用一组示例值）
import fs from "node:fs";
import { toFirmwareHeader, octoFirmwareGait, sanitizeGait } from "../src/gait/gait.js";
import { octoRowGait, octoV14Gait, octoV15Gait } from "../src/gait/octo-best.js";
import { toCtrlHeader, OCTO_CTRL } from "../src/gait/ctrl.js";
import { toTrimHeader, defaultCalib } from "../src/link/calib.js";
const [src = "row", out = "octopus_gait_custom.h", cfg = ""] = process.argv.slice(2);
if (src === "trim") {
  const c = cfg ? JSON.parse(fs.readFileSync(cfg, "utf8")) : (() => { const d = defaultCalib(8); d.servos[0].center = 3.5; d.servos[3].center = -2; d.servos[5].min = -40; d.servos[6].max = 48; return d; })();
  fs.writeFileSync(out, toTrimHeader(c, { source: "scripts/gait-export.mjs trim" + (cfg ? " " + cfg : "（示例值）") }));
  console.log("wrote", out, "trim");
} else if (src === "ctrl") {
  const c = cfg ? JSON.parse(fs.readFileSync(cfg, "utf8")) : OCTO_CTRL;
  fs.writeFileSync(out, toCtrlHeader(c, { source: "scripts/gait-export.mjs ctrl" + (cfg ? " " + cfg : "（默认增益）") }));
  console.log("wrote", out, "ctrl");
} else {
  const g = src === "row" ? octoRowGait() : src === "v14" ? octoV14Gait() : src === "v15" ? octoV15Gait() : src === "firmware" ? octoFirmwareGait() : sanitizeGait(JSON.parse(fs.readFileSync(src, "utf8")), 8);
  fs.writeFileSync(out, toFirmwareHeader(g, { source: "scripts/gait-export.mjs " + src, servoRate: src === "v15" ? 240 : process.env.SERVO_RATE ? +process.env.SERVO_RATE : null }));
  console.log("wrote", out, g.name);
}
