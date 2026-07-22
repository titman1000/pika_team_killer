import type { WinLoss } from "./logic";

export interface CloudState {
  names: string[];
  winStats: Record<string, WinLoss>;
  teammateStats: Record<string, WinLoss>;
}

const CLOUD_URL_KEY = "pika_team_killer_cloud_url";

// 團隊共用的 Google Sheet Apps Script 網址，預設就指向它，使用者不用手動貼上。
// 仍可在畫面上改成別的網址（例如自己另外開一份表單測試）。
const DEFAULT_CLOUD_URL =
  "https://script.google.com/macros/s/AKfycbw7EifGZu17QqttzOu8DlaI_Yz4tUYPysrWqzaBcYebvTzq3nQc6JEKSHZO4rXsr2rv/exec";

export function getCloudUrl(): string {
  return localStorage.getItem(CLOUD_URL_KEY) || DEFAULT_CLOUD_URL;
}

export function setCloudUrl(url: string): void {
  localStorage.setItem(CLOUD_URL_KEY, url.trim());
}

export async function fetchCloudState(url: string): Promise<CloudState> {
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`讀取失敗（HTTP ${res.status}）`);
  return res.json();
}

// 用 text/plain 避免瀏覽器對 Apps Script 送出 CORS preflight（Apps Script 不處理 OPTIONS）。
export async function pushCloudState(url: string, state: CloudState): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(state),
  });
  if (!res.ok) throw new Error(`上傳失敗（HTTP ${res.status}）`);
}

export function diffCloudState(local: CloudState, cloud: CloudState): string[] {
  const lines: string[] = [];
  const localNames = new Set(local.names);
  const cloudNames = new Set(cloud.names);

  const addedInCloud = cloud.names.filter((n) => !localNames.has(n));
  const removedInCloud = local.names.filter((n) => !cloudNames.has(n));
  if (addedInCloud.length) lines.push(`雲端新增成員：${addedInCloud.join("、")}`);
  if (removedInCloud.length) lines.push(`本機有、雲端沒有：${removedInCloud.join("、")}`);

  const allNames = new Set([...localNames, ...cloudNames]);
  for (const name of allNames) {
    const l = local.winStats[name] || { wins: 0, losses: 0 };
    const c = cloud.winStats[name] || { wins: 0, losses: 0 };
    if (l.wins !== c.wins || l.losses !== c.losses) {
      lines.push(`${name} 勝率不同：本機 ${l.wins}勝${l.losses}敗 → 雲端 ${c.wins}勝${c.losses}敗`);
    }
  }
  return lines;
}
