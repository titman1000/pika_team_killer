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

// 產生一次候選分組，純粹依賴 state.restHistory（唯讀），不會修改 state。
// 這樣才能在 doGroup() 裡重骰好幾次，只有最後選中的那次才真正寫回 state。
function generateGrouping(state: TeamState, weighted: boolean): GroupResult | null {
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

  let group1: string[];
  let group2: string[];
  if (weighted) {
    [group1, group2] = balancedSplit(state, groupPeople);
  } else {
    const half = Math.floor(groupPeople.length / 2);
    group1 = groupPeople.slice(0, half);
    group2 = groupPeople.slice(half);
  }

  return { group1, group2, rest };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|||${b}` : `${b}|||${a}`;
}

// 兩隊「同隊過」的所有兩人配對（跟哪一隊無關，只在意誰跟誰同隊）。
function teammatePairs(groups: [string[], string[]]): Set<string> {
  const pairs = new Set<string>();
  for (const group of groups) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.add(pairKey(group[i], group[j]));
      }
    }
  }
  return pairs;
}

// Jaccard 相似度：兩組配對的重疊程度，0 = 完全不同，1 = 完全一樣。
function pairSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const pair of a) {
    if (b.has(pair)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const MAX_GROUP_ATTEMPTS = 30;
export const SIMILARITY_THRESHOLD = 0.6;

// 分組時盡量跟「上一輪顯示的分組」不要太像：先亂數產生一次分組，
// 跟上一輪比對同隊配對的重疊比例，太像就重骰，最多骰 MAX_GROUP_ATTEMPTS 次，
// 都不滿足門檻就採用重骰過程中最不像的那一次（保底：至少比純隨機好，不會無窮迴圈）。
export function doGroup(
  state: TeamState,
  weighted: boolean,
  avoidRepeat: boolean = true
): GroupResult | null {
  const previousPairs = teammatePairs(state.currentGroups);
  const shouldAvoidRepeat = avoidRepeat && previousPairs.size > 0;

  let best: GroupResult | null = null;
  let bestScore = Infinity;
  const attempts = shouldAvoidRepeat ? MAX_GROUP_ATTEMPTS : 1;

  for (let i = 0; i < attempts; i++) {
    const candidate = generateGrouping(state, weighted);
    if (!candidate) return null;

    if (!shouldAvoidRepeat) {
      best = candidate;
      break;
    }

    const score = pairSimilarity(previousPairs, teammatePairs([candidate.group1, candidate.group2]));
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
    if (score <= SIMILARITY_THRESHOLD) break;
  }

  if (!best) return null;

  state.restHistory.push(best.rest);
  if (state.restHistory.length > 2) state.restHistory.shift();
  state.currentGroups = [best.group1, best.group2];
  state.currentRest = best.rest;
  state.resultRecorded = false;
  return best;
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
