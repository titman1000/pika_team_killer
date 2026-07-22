<script setup lang="ts">
import { ref } from "vue";
import { useTeamState } from "./composables/useTeamState";
import {
  getCloudUrl,
  setCloudUrl,
  fetchCloudState,
  pushCloudState,
  diffCloudState,
} from "./cloudSync";
import { parseNamesCsv } from "./csv";
import WinrateDialog from "./components/WinrateDialog.vue";
import TeammateDialog from "./components/TeammateDialog.vue";

const {
  state,
  addName,
  removeName,
  toggleActive,
  doGroup,
  recordWinner,
  exportData,
  importData,
  replaceNames,
  swapMembers,
  swapCandidates,
  getCloudSnapshot,
  applyCloudState,
} = useTeamState();

const nameInput = ref("");
const weighted = ref(true);
const avoidRepeat = ref(true);
const grouped = ref(false);
const swappingName = ref<string | null>(null);

const winrateDialog = ref<InstanceType<typeof WinrateDialog> | null>(null);
const teammateDialog = ref<InstanceType<typeof TeammateDialog> | null>(null);
const importFile = ref<HTMLInputElement | null>(null);
const csvFile = ref<HTMLInputElement | null>(null);

const cloudUrl = ref(getCloudUrl());
const cloudBusy = ref(false);
const cloudError = ref("");
const pendingCloudState = ref<ReturnType<typeof getCloudSnapshot> | null>(null);
const cloudDiffLines = ref<string[]>([]);

function handleAdd() {
  addName(nameInput.value);
  nameInput.value = "";
}

function handleGroup() {
  const result = doGroup(weighted.value, avoidRepeat.value);
  if (!result) return;
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

// ---------- 手動替換隊伍成員 ----------
function candidatesFor(name: string) {
  return swapCandidates(name);
}

function toggleSwapPicker(name: string) {
  swappingName.value = swappingName.value === name ? null : name;
}

function confirmSwap(name: string, partner: string) {
  if (partner) swapMembers(name, partner);
  swappingName.value = null;
}

// ---------- 資料備份：JSON ----------
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
    } catch {
      alert("匯入失敗：檔案格式不正確");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

// ---------- 資料備份：CSV 名單 ----------
function handleCsvClick() {
  csvFile.value?.click();
}

function handleCsvChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const names = parseNamesCsv(String(reader.result));
    if (!names.length) {
      alert("CSV 裡沒有讀到任何姓名");
      return;
    }
    if (confirm(`將用 CSV 裡的 ${names.length} 個名字取代目前名單，確定嗎？`)) {
      replaceNames(names);
      grouped.value = false;
    }
  };
  reader.readAsText(file);
  input.value = "";
}

// ---------- 雲端同步（Google Sheet + Apps Script） ----------
function saveCloudUrl() {
  setCloudUrl(cloudUrl.value);
}

async function handlePull() {
  cloudError.value = "";
  if (!cloudUrl.value.trim()) {
    cloudError.value = "請先貼上 Apps Script 網址";
    return;
  }
  cloudBusy.value = true;
  try {
    const cloud = await fetchCloudState(cloudUrl.value.trim());
    const local = getCloudSnapshot();
    const diff = diffCloudState(local, cloud);
    if (!diff.length) {
      alert("本機與雲端資料相同，不需要更新");
    } else {
      cloudDiffLines.value = diff;
      pendingCloudState.value = cloud;
    }
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : String(err);
  } finally {
    cloudBusy.value = false;
  }
}

function applyPendingCloudState() {
  if (!pendingCloudState.value) return;
  applyCloudState(pendingCloudState.value);
  pendingCloudState.value = null;
  cloudDiffLines.value = [];
  grouped.value = false;
}

function cancelPendingCloudState() {
  pendingCloudState.value = null;
  cloudDiffLines.value = [];
}

async function handlePush() {
  cloudError.value = "";
  if (!cloudUrl.value.trim()) {
    cloudError.value = "請先貼上 Apps Script 網址";
    return;
  }
  if (!confirm("這會覆蓋雲端 Google Sheet 上的資料，確定要上傳嗎？")) return;
  cloudBusy.value = true;
  try {
    await pushCloudState(cloudUrl.value.trim(), getCloudSnapshot());
    alert("已上傳到雲端");
  } catch (err) {
    cloudError.value = err instanceof Error ? err.message : String(err);
  } finally {
    cloudBusy.value = false;
  }
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
        <div class="checkbox-group">
          <label class="checkbox-label">
            <input v-model="weighted" type="checkbox" />
            依勝率加權分組（強弱搭配）
          </label>
          <label class="checkbox-label">
            <input v-model="avoidRepeat" type="checkbox" />
            避免與上一輪隊友重複
          </label>
        </div>
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
          <div v-for="name in state.currentGroups[0]" :key="name" class="member-row">
            <span>{{ name }}</span>
            <div class="swap-wrap">
              <button class="swap-btn" title="替換成員" @click="toggleSwapPicker(name)">⇄</button>
              <select
                v-if="swappingName === name"
                class="swap-select"
                @change="confirmSwap(name, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">換成…</option>
                <option v-for="candidate in candidatesFor(name)" :key="candidate" :value="candidate">
                  {{ candidate }}
                </option>
              </select>
            </div>
          </div>
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
          <div v-for="name in state.currentGroups[1]" :key="name" class="member-row">
            <span>{{ name }}</span>
            <div class="swap-wrap">
              <button class="swap-btn" title="替換成員" @click="toggleSwapPicker(name)">⇄</button>
              <select
                v-if="swappingName === name"
                class="swap-select"
                @change="confirmSwap(name, ($event.target as HTMLSelectElement).value)"
              >
                <option value="">換成…</option>
                <option v-for="candidate in candidatesFor(name)" :key="candidate" :value="candidate">
                  {{ candidate }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="grouped && state.currentRest.length" class="card">
      <h2>休息區（若超過 10 人）</h2>
      <div class="chip-list rest-list">
        <div v-for="name in state.currentRest" :key="name" class="member-row rest-member">
          <span>{{ name }}</span>
          <div class="swap-wrap">
            <button class="swap-btn" title="替換成員" @click="toggleSwapPicker(name)">⇄</button>
            <select
              v-if="swappingName === name"
              class="swap-select"
              @change="confirmSwap(name, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">換成…</option>
              <option v-for="candidate in candidatesFor(name)" :key="candidate" :value="candidate">
                {{ candidate }}
              </option>
            </select>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>資料備份</h2>
      <p class="hint">資料只存在這個瀏覽器裡。換裝置或分享資料給隊友時，請用匯出／匯入，或下方的雲端同步。</p>
      <div class="controls-buttons">
        <button class="btn" @click="handleExport">匯出資料（下載 JSON）</button>
        <button class="btn" @click="handleImportClick">匯入 JSON</button>
        <button class="btn" @click="handleCsvClick">匯入 CSV 名單</button>
        <input ref="importFile" type="file" accept="application/json" hidden @change="handleImportChange" />
        <input ref="csvFile" type="file" accept=".csv,text/csv" hidden @change="handleCsvChange" />
      </div>
    </section>

    <section class="card">
      <h2>雲端同步（Google Sheet）</h2>
      <p class="hint">
        把名單／勝率同步到共用的 Google Sheet，讓不同裝置、不同隊友看到一樣的資料。
        設定方式見 <code>web/README.md</code>。
      </p>
      <div class="input-row">
        <input
          v-model="cloudUrl"
          type="text"
          placeholder="貼上 Apps Script Web App 網址"
          @change="saveCloudUrl"
        />
      </div>
      <div class="controls-buttons">
        <button class="btn" :disabled="cloudBusy" @click="handlePull">從雲端下載</button>
        <button class="btn" :disabled="cloudBusy" @click="handlePush">上傳到雲端</button>
      </div>
      <p v-if="cloudError" class="cloud-error">{{ cloudError }}</p>

      <div v-if="cloudDiffLines.length" class="diff-panel">
        <h3>雲端與本機的差異</h3>
        <ul>
          <li v-for="line in cloudDiffLines" :key="line">{{ line }}</li>
        </ul>
        <div class="controls-buttons">
          <button class="btn primary" @click="applyPendingCloudState">套用雲端資料</button>
          <button class="btn" @click="cancelPendingCloudState">取消</button>
        </div>
      </div>
    </section>
  </main>

  <WinrateDialog ref="winrateDialog" @select-name="onSelectName" />
  <TeammateDialog ref="teammateDialog" />
</template>
