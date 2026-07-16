<script setup lang="ts">
import { ref, computed } from "vue";
import { useTeamState } from "../composables/useTeamState";

const emit = defineEmits<{ (e: "select-name", name: string): void }>();

const { state, getWinRate } = useTeamState();
const dialogRef = ref<HTMLDialogElement | null>(null);

const rows = computed(() =>
  state.names.map((name) => {
    const stats = state.winStats[name] || { wins: 0, losses: 0 };
    const total = stats.wins + stats.losses;
    return {
      name,
      wins: stats.wins,
      losses: stats.losses,
      total,
      rate: getWinRate(name),
    };
  })
);

function open() {
  dialogRef.value?.showModal();
}
function close() {
  dialogRef.value?.close();
}

defineExpose({ open });
</script>

<template>
  <dialog ref="dialogRef" class="app-dialog">
    <h2>勝率統計</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>姓名</th><th>勝場</th><th>敗場</th><th>總場次</th><th>勝率</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.name">
            <td class="name-cell" @click="emit('select-name', row.name)">{{ row.name }}</td>
            <td>{{ row.wins }}</td>
            <td>{{ row.losses }}</td>
            <td>{{ row.total }}</td>
            <td>{{ (row.rate * 100).toFixed(1) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="hint">點擊姓名可查看與該成員的同隊勝率</p>
    <div class="dialog-actions">
      <button class="btn" @click="close">關閉</button>
    </div>
  </dialog>
</template>
