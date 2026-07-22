// 純邏輯層：不依賴 Vue / DOM，方便單獨測試。

export interface WinLoss {
  wins: number;
  losses: number;
}

export interface TeamState {
  names: string[];
  inactiveIndices: number[];
  winStats: Record<string, WinLoss>;
  teammateStats: Record<string, WinLoss>; // key: "name|||teammate"
  restHistory: string[][]; // 最近兩輪的休息名單
  currentGroups: [string[], string[]];
  currentRest: string[];
  resultRecorded: boolean;
}

export const STORAGE_KEY = "pika_team_killer_state_v1";

export function defaultState(): TeamState {
  return {
    names: [],
    inactiveIndices: [],
    winStats: {},
    teammateStats: {},
    restHistory: [],
    currentGroups: [[], []],
    currentRest: [],
    resultRecorded: true,
  };
}

export function loadState(): TeamState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return Object.assign(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export function saveState(state: TeamState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function teammateKey(a: string, b: string): string {
  return `${a}|||${b}`;
}

export function getWinRate(state: TeamState, name: string): number {
  const stats = state.winStats[name];
  if (!stats) return 0.5;
  const total = stats.wins + stats.losses;
  return total ? stats.wins / total : 0.5;
}

export function getTeammateStats(state: TeamState, name: string, teammate: string): WinLoss {
  return state.teammateStats[teammateKey(name, teammate)] || { wins: 0, losses: 0 };
}

export function shuffle<T>(list: T[]): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// 依勝率將名單分成兩隊，讓兩隊總實力盡量接近（強弱搭配）。
export function balancedSplit(state: TeamState, people: string[]): [string[], string[]] {
  const rated = [...people].sort((a, b) => getWinRate(state, b) - getWinRate(state, a));
  const maxSize1 = Math.ceil(rated.length / 2);
  const maxSize2 = Math.floor(rated.length / 2);

  const group1: string[] = [];
  const group2: string[] = [];
  let sum1 = 0;
  let sum2 = 0;

  for (const name of rated) {
    const rate = getWinRate(state, name);
    const room1 = group1.length < maxSize1;
    const room2 = group2.length < maxSize2;
    if (room1 && (!room2 || sum1 <= sum2)) {
      group1.push(name);
      sum1 += rate;
    } else {
      group2.push(name);
      sum2 += rate;
    }
  }
  return [group1, group2];
}

export interface GroupResult {
  group1: string[];
  group2: string[];
  rest: string[];
}

export function doGroup(state: TeamState, weighted: boolean): GroupResult | null {
  const activeNames = state.names.filter((_, i) => !state.inactiveIndices.includes(i));
  if (activeNames.length < 2) return null;

  const people = shuffle(activeNames);

  const recentRest = new Set(state.restHistory.flat());
  let rest: string[] = [];
  let groupPeople: string[];

  if (people.length > 10) {
    const restNeeded = people.length - 10;
    const restCandidates = people.filter((p) => !recentRest.has(p));

    if (restCandidates.length < restNeeded) {
      const extraNeeded = restNeeded - restCandidates.length;
      const remaining = people.filter((p) => !restCandidates.includes(p));
      rest = restCandidates.concat(remaining.slice(0, extraNeeded));
    } else {
      rest = shuffle(restCandidates).slice(0, restNeeded);
    }
    groupPeople = people.filter((p) => !rest.includes(p));
  } else {
    groupPeople = people;
  }

  state.restHistory.push(rest);
  if (state.restHistory.length > 2) state.restHistory.shift();

  let group1: string[];
  let group2: string[];
  if (weighted) {
    [group1, group2] = balancedSplit(state, groupPeople);
  } else {
    const half = Math.floor(groupPeople.length / 2);
    group1 = groupPeople.slice(0, half);
    group2 = groupPeople.slice(half);
  }

  state.currentGroups = [group1, group2];
  state.currentRest = rest;
  state.resultRecorded = false;
  return { group1, group2, rest };
}

type GroupSlot = "group1" | "group2" | "rest";

function getSlotArray(state: TeamState, slot: GroupSlot): string[] {
  if (slot === "group1") return state.currentGroups[0];
  if (slot === "group2") return state.currentGroups[1];
  return state.currentRest;
}

function locateMember(state: TeamState, name: string): { slot: GroupSlot; index: number } | null {
  const slots: GroupSlot[] = ["group1", "group2", "rest"];
  for (const slot of slots) {
    const index = getSlotArray(state, slot).indexOf(name);
    if (index >= 0) return { slot, index };
  }
  return null;
}

// 讓使用者手動把某人跟另一組/休息區的人互換位置，不用整個重新分組。
export function swapMembers(state: TeamState, nameA: string, nameB: string): boolean {
  const locA = locateMember(state, nameA);
  const locB = locateMember(state, nameB);
  if (!locA || !locB || locA.slot === locB.slot) return false;

  const arrA = getSlotArray(state, locA.slot);
  const arrB = getSlotArray(state, locB.slot);
  arrA[locA.index] = nameB;
  arrB[locB.index] = nameA;
  return true;
}

// 回傳目前在「其他組別／休息區」的人，作為某人的可替換對象清單。
export function swapCandidates(state: TeamState, name: string): string[] {
  const loc = locateMember(state, name);
  if (!loc) return [];
  const slots: GroupSlot[] = ["group1", "group2", "rest"];
  return slots
    .filter((slot) => slot !== loc.slot)
    .flatMap((slot) => getSlotArray(state, slot));
}

function recordTeammateResult(state: TeamState, group: string[], isWin: boolean): void {
  const key = isWin ? "wins" : "losses";
  for (const name of group) {
    for (const teammate of group) {
      if (name === teammate) continue;
      const k = teammateKey(name, teammate);
      const stats = state.teammateStats[k] || { wins: 0, losses: 0 };
      stats[key] += 1;
      state.teammateStats[k] = stats;
    }
  }
}

export function recordWinner(state: TeamState, winnerIndex: 0 | 1): void {
  const loserIndex = winnerIndex === 0 ? 1 : 0;
  const winners = state.currentGroups[winnerIndex] || [];
  const losers = state.currentGroups[loserIndex] || [];

  for (const name of winners) {
    const stats = state.winStats[name] || { wins: 0, losses: 0 };
    stats.wins += 1;
    state.winStats[name] = stats;
  }
  for (const name of losers) {
    const stats = state.winStats[name] || { wins: 0, losses: 0 };
    stats.losses += 1;
    state.winStats[name] = stats;
  }

  recordTeammateResult(state, winners, true);
  recordTeammateResult(state, losers, false);
  state.resultRecorded = true;
}
