<script setup lang="ts">
import { ref, computed } from "vue";
import { useTeamState } from "../composables/useTeamState";

const { state, getTeammateStats } = useTeamState();
const dialogRef = ref<HTMLDialogElement | null>(null);
const currentName = ref("");

const rows = computed(() => {
  const name = currentName.value;
  return state.names
    .filter((person) => person !== name)
    .map((teammate) => {
      const stats = getTeammateStats(name, teammate);
      const total = stats.wins + stats.losses;
      const rate = total ? stats.wins / total : 0;
      return { teammate, wins: stats.wins, losses: stats.losses, total, rate };
    });
});

function open(name: string) {
  currentName.value = name;
  dialogRef.value?.showModal();
}
function close() {
  dialogRef.value?.close();
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialogRef" class="app-dialog">
    <h2>{{ currentName }} 的同隊勝率</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>同隊成員</th><th>勝場</th><th>敗場</th><th>同隊場次</th><th>同隊勝率</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.teammate">
            <td>{{ row.teammate }}</td>
            <td>{{ row.wins }}</td>
            <td>{{ row.losses }}</td>
            <td>{{ row.total }}</td>
            <td>{{ (row.rate * 100).toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="dialog-actions">
      <button class="btn" @click="close">關閉</button>
    </div>
  </dialog>
</template>
