import { reactive, computed, watch } from "vue";
import * as logic from "../logic";
import type { TeamState } from "../logic";

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
  };
}
