// v27：中文片段的切分规则（抽取脚本和运行时翻译共用同一套正则，保证查得到）
const C = "\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef“”‘’…—·";
// 一段：以中文字符开头和结尾，中间可以夹空格、数字、字母和常见符号（但不跨引号、花括号、尖括号、换行）
export const RUN_RE = new RegExp(`[${C}](?:[^"'\`{}<>$\\n\\\\]*[${C}])?`, "g");
// 子段：只含中文和中文标点
export const SUB_RE = new RegExp(`[\\u4e00-\\u9fff](?:[${C}]*[\\u4e00-\\u9fff])?`, "g");
export const HAS_CJK = /[\u4e00-\u9fff]/;
