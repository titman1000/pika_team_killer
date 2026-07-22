import { reactive, computed, watch } from "vue";
import * as logic from "../logic";
import type { TeamState } from "../logic";
import type { CloudState } from "../cloudSync";

const state = reactive<TeamState>(logic.loadState());

watch(
  state,
  () => logic.saveState(state as TeamState),
  { deep: true }
);

export function useTeamState() {
  const activeNames = computed(() =>
    state.names.filter((_, i) => !state.inactiveIndices.includes(i))
  );

  function addName(rawName: string) {
    const name = rawName.trim();
    if (!name) return;
    state.names.push(name);
  }

  function removeName(index: number) {
    if (index < 0 || index >= state.names.length) return;
    state.names.splice(index, 1);
    state.inactiveIndices = state.inactiveIndices
      .filter((i) => i !== index)
      .map((i) => (i > index ? i - 1 : i));
  }

  function toggleActive(index: number) {
    const pos = state.inactiveIndices.indexOf(index);
    if (pos >= 0) {
      state.inactiveIndices.splice(pos, 1);
    } else {
      state.inactiveIndices.push(index);
    }
  }

  function doGroup(weighted: boolean) {
    return logic.doGroup(state as TeamState, weighted);
  }

  function recordWinner(index: 0 | 1) {
    logic.recordWinner(state as TeamState, index);
  }

  function getWinRate(name: string) {
    return logic.getWinRate(state as TeamState, name);
  }

  function getTeammateStats(name: string, teammate: string) {
    return logic.getTeammateStats(state as TeamState, name, teammate);
  }

  function exportData(): string {
    return JSON.stringify(state, null, 2);
  }

  function importData(json: string) {
    const parsed = JSON.parse(json);
    Object.assign(state, logic.defaultState(), parsed);
  }

  // 用一份新名單整批取代目前名單（例如匯入 CSV）。索引會全部改變，
  // 所以順便清掉「不參與分組」跟目前分組結果，避免對到錯的人。
  function replaceNames(names: string[]) {
    state.names = names;
    state.inactiveIndices = [];
    state.currentGroups = [[], []];
    state.currentRest = [];
    state.resultRecorded = true;
  }

  function swapMembers(nameA: string, nameB: string) {
    logic.swapMembers(state as TeamState, nameA, nameB);
  }

  function swapCandidates(name: string) {
    return logic.swapCandidates(state as TeamState, name);
  }

  function getCloudSnapshot(): CloudState {
    return {
      names: [...state.names],
      winStats: JSON.parse(JSON.stringify(state.winStats)),
      teammateStats: JSON.parse(JSON.stringify(state.teammateStats)),
    };
  }

  function applyCloudState(cloud: CloudState) {
    state.names = cloud.names;
    state.winStats = cloud.winStats;
    state.teammateStats = cloud.teammateStats;
    state.inactiveIndices = [];
    state.currentGroups = [[], []];
    state.currentRest = [];
    state.resultRecorded = true;
  }

  return {
    state,
    activeNames,
    addName,
    removeName,
    toggleActive,
    doGroup,
    recordWinner,
    getWinRate,
    getTeammateStats,
    exportData,
    importData,
    replaceNames,
    swapMembers,
    swapCandidates,
    getCloudSnapshot,
    applyCloudState,
  };
}
