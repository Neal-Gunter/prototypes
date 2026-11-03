// 题库 code-check 的统一入口：按 format 分派（页面端，纯 JS，无 WASM）
import { validateCSource } from "./c-lite.js";
import { validateAsm } from "./asm.js";
import { validateHex } from "./hex.js";
export function validateCode(format, src, spec) {
  if (format === "c" || format === "cpp") return validateCSource(src, spec);
  if (format === "asm") return validateAsm(src, spec);
  if (format === "hex") return validateHex(src, spec);
  return { pass: false, errors: [{ code: "format", msg: `不支持的格式 ${format}`, msgEn: `Unsupported format ${format}` }], warnings: [] };
}
