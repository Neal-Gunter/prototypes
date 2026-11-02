// v28：机翻常见的错误术语 → 正确术语（只在原文含对应中文术语时替换）。merge.mjs 用它修译文，readability-test.mjs 用它查残留。
export const TERM_FIX = [
  ["接线表", /\bLinewatch\b/g, "Wiring table"],
  ["焊盘", /\bBat Welders?\b/g, "BAT pad"],
  ["焊盘", /\b[Ww]elders\b/g, "pads"],
  ["焊盘", /\b[Ww]elder\b/g, "pad"],
  ["万用表", /\bMultiple Table\b/gi, "multimeter"],
  ["固件", /\bSolid\b/g, "Firmware"],
  ["固件", /\bsolid\b/g, "firmware"],
  ["通电", /\belectrified\b/gi, "powered"],
  ["杜邦线", /\bDupont [Ll]ines?\b/g, "Dupont wire"],
  ["排针", /\bTiles\b/g, "Pin header"],
  ["电阻", /\belectrical resistance\b/gi, "resistance"],
  ["引脚", /\bLead pin\b/g, "Pin"],
  ["开发板", /\bdevelopment plate\b/gi, "dev board"],
];
export function fixTerms(zh, en) {
  if (typeof en !== "string") return en;
  let out = en;
  for (const [z, re, to] of TERM_FIX) if (zh.includes(z)) out = out.replace(re, to);
  return out;
}
