const HEADER_ALIASES = new Set(["name", "names", "姓名", "name,wins,losses"]);

// 只讀取每一列的第一欄當作姓名，可自動略過標題列。
export function parseNamesCsv(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(",")[0]?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => !HEADER_ALIASES.has(name.toLowerCase()));
}
