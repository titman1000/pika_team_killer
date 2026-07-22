// 把這個檔案的內容貼到 Google Sheet 的「擴充功能 → Apps Script」，
// 部署成 Web App 後，靜態網站就能用這個網址讀寫這份表單。
// 詳細部署步驟見 web/README.md「雲端同步設定」。

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const payload = {
    names: readNames(ss),
    winStats: readWinStats(ss),
    teammateStats: readTeammateStats(ss),
  };
  return jsonResponse(payload);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const body = JSON.parse(e.postData.contents);
  writeNames(ss, body.names || []);
  writeWinStats(ss, body.winStats || {});
  writeTeammateStats(ss, body.teammateStats || {});
  return jsonResponse({ ok: true });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clearContents();
  sheet.appendRow(headers);
  return sheet;
}

function readNames(ss) {
  const sheet = ss.getSheetByName("Names");
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  return values
    .slice(1)
    .map((row) => String(row[0] || "").trim())
    .filter(Boolean);
}

function readWinStats(ss) {
  const sheet = ss.getSheetByName("WinStats");
  const result = {};
  if (!sheet) return result;
  const values = sheet.getDataRange().getValues();
  values.slice(1).forEach((row) => {
    const name = String(row[0] || "").trim();
    if (!name) return;
    result[name] = { wins: Number(row[1]) || 0, losses: Number(row[2]) || 0 };
  });
  return result;
}

function readTeammateStats(ss) {
  const sheet = ss.getSheetByName("TeammateStats");
  const result = {};
  if (!sheet) return result;
  const values = sheet.getDataRange().getValues();
  values.slice(1).forEach((row) => {
    const name = String(row[0] || "").trim();
    const teammate = String(row[1] || "").trim();
    if (!name || !teammate) return;
    result[name + "|||" + teammate] = {
      wins: Number(row[2]) || 0,
      losses: Number(row[3]) || 0,
    };
  });
  return result;
}

function writeNames(ss, names) {
  const sheet = getOrCreateSheet(ss, "Names", ["name"]);
  if (names.length) {
    sheet.getRange(2, 1, names.length, 1).setValues(names.map((n) => [n]));
  }
}

function writeWinStats(ss, winStats) {
  const sheet = getOrCreateSheet(ss, "WinStats", ["name", "wins", "losses"]);
  const rows = Object.keys(winStats).map((name) => [
    name,
    winStats[name].wins,
    winStats[name].losses,
  ]);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
}

function writeTeammateStats(ss, teammateStats) {
  const sheet = getOrCreateSheet(ss, "TeammateStats", [
    "name",
    "teammate",
    "wins",
    "losses",
  ]);
  const rows = Object.keys(teammateStats).map((key) => {
    const [name, teammate] = key.split("|||");
    const s = teammateStats[key];
    return [name, teammate, s.wins, s.losses];
  });
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 4).setValues(rows);
  }
}
