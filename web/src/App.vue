<script setup lang="ts">
import { ref } from "vue";
import { useTeamState } from "./composables/useTeamState";
import WinrateDialog from "./components/WinrateDialog.vue";
import TeammateDialog from "./components/TeammateDialog.vue";

const { state, addName, removeName, toggleActive, doGroup, recordWinner, exportData, importData } =
  useTeamState();

const nameInput = ref("");
const weighted = ref(true);
const rest = ref<string[]>([]);
const grouped = ref(false);

const winrateDialog = ref<InstanceType<typeof WinrateDialog> | null>(null);
const teammateDialog = ref<InstanceType<typeof TeammateDialog> | null>(null);
const importFile = ref<HTMLInputElement | null>(null);

function handleAdd() {
  addName(nameInput.value);
  nameInput.value = "";
}

function handleGroup() {
  const result = doGroup(weighted.value);
  if (!result) return;
  rest.value = result.rest;
  grouped.value = true;
}

function handleWin(index: 0 | 1) {
  if (state.resultRecorded) {
    handleGroup();
    return;
  }
  recordWinner(index);
}

function openWinrate() {
  winrateDialog.value?.open();
}

function onSelectName(name: string) {
  teammateDialog.value?.open(name);
}

function handleExport() {
  const blob = new Blob([exportData()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-killer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleImportClick() {
  importFile.value?.click();
}

function handleImportChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      importData(String(reader.result));
      grouped.value = false;
      rest.value = [];
    } catch {
      alert("匯入失敗：檔案格式不正確");
    }
  };
  reader.readAsText(file);
  input.value = "";
}
</script>

<template>
  <header class="app-header">
    <h1>隨機分組工具</h1>
    <p class="subtitle">輸入名單、一鍵分組、記錄勝率 — 資料保存在你的瀏覽器裡</p>
  </header>

  <main class="container">
    <section class="card">
      <h2>名單</h2>
      <div class="input-row">
        <input
          v-model="nameInput"
          type="text"
          placeholder="輸入姓名後按新增或 Enter"
          @keyup.enter="handleAdd"
        />
        <button class="btn primary" @click="handleAdd">新增</button>
      </div>
      <div class="chip-list">
        <span
          v-for="(name, index) in state.names"
          :key="index"
          class="chip"
          :class="{ inactive: state.inactiveIndices.includes(index) }"
          :title="state.inactiveIndices.includes(index) ? '不參與分組（點擊恢復）' : '點擊設為不參與分組'"
          @click="toggleActive(index)"
        >
          {{ name }}
          <button class="chip-remove" title="刪除" @click.stop="removeName(index)">×</button>
        </span>
      </div>
      <p class="count-label">
        目前人數：{{ state.names.length }}，參與分組：{{ state.names.length - state.inactiveIndices.length }}
      </p>
    </section>

    <section class="card">
      <div class="controls-row">
        <label class="checkbox-label">
          <input v-model="weighted" type="checkbox" />
          依勝率加權分組（強弱搭配）
        </label>
        <div class="controls-buttons">
          <button class="btn primary" @click="handleGroup">開始分組</button>
          <button class="btn" @click="openWinrate">查看勝率</button>
        </div>
      </div>
    </section>

    <section v-if="grouped" class="groups-row">
      <div class="card group-card">
        <div class="group-header">
          <h2>Group 1</h2>
          <button
            class="btn"
            :class="state.resultRecorded ? 'again-btn' : 'win-btn'"
            @click="handleWin(0)"
          >
            {{ state.resultRecorded ? "再次分組" : "記錄勝利" }}
          </button>
        </div>
        <div class="group-list">
          <p v-for="name in state.currentGroups[0]" :key="name">{{ name }}</p>
        </div>
      </div>
      <div class="card group-card">
        <div class="group-header">
          <h2>Group 2</h2>
          <button
            class="btn"
            :class="state.resultRecorded ? 'again-btn' : 'win-btn'"
            @click="handleWin(1)"
          >
            {{ state.resultRecorded ? "再次分組" : "記錄勝利" }}
          </button>
        </div>
        <div class="group-list">
          <p v-for="name in state.currentGroups[1]" :key="name">{{ name }}</p>
        </div>
      </div>
    </section>

    <section v-if="grouped && rest.length" class="card">
      <h2>休息區（若超過 10 人）</h2>
      <div class="chip-list rest-list">
        <span v-for="name in rest" :key="name" class="chip">{{ name }}</span>
      </div>
    </section>

    <section class="card">
      <h2>資料備份</h2>
      <p class="hint">資料只存在這個瀏覽器裡。換裝置或分享資料給隊友時，請用匯出／匯入。</p>
      <div class="controls-buttons">
        <button class="btn" @click="handleExport">匯出資料（下載 JSON）</button>
        <button class="btn" @click="handleImportClick">匯入資料</button>
        <input
          ref="importFile"
          type="file"
          accept="application/json"
          hidden
          @change="handleImportChange"
        />
      </div>
    </section>
  </main>

  <WinrateDialog ref="winrateDialog" @select-name="onSelectName" />
  <TeammateDialog ref="teammateDialog" />
</template>
