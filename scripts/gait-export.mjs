// v13：把步态导出成固件头文件  node scripts/gait-export.mjs <row|firmware|gait.json> <out.h>
import fs from "node:fs";
import { toFirmwareHeader, octoFirmwareGait, sanitizeGait } from "../src/gait/gait.js";
import { octoRowGait } from "../src/gait/octo-best.js";
const [src = "row", out = "octopus_gait_custom.h"] = process.argv.slice(2);
const g = src === "row" ? octoRowGait() : src === "firmware" ? octoFirmwareGait() : sanitizeGait(JSON.parse(fs.readFileSync(src, "utf8")), 8);
fs.writeFileSync(out, toFirmwareHeader(g, { source: "scripts/gait-export.mjs " + src }));
console.log("wrote", out, g.name);
