import sys
import random
import os
import csv
import shutil
from PyQt5 import QtWidgets, QtGui, QtCore


def is_packaged_app():
    return getattr(sys, "frozen", False) or "__compiled__" in globals()


def get_data_dir():
    if is_packaged_app():
        for path_value in [sys.argv[0] if sys.argv else "", getattr(sys, "executable", "")]:
            if path_value and os.path.splitext(path_value)[1].lower() == ".exe":
                return os.path.dirname(os.path.abspath(path_value))
        return os.path.dirname(os.path.abspath(sys.executable))

    return os.path.dirname(os.path.abspath(__file__))


BASE_DIR = get_data_dir()
SAVE_FILE = os.path.join(BASE_DIR, "names.txt")
WINRATE_FILE = os.path.join(BASE_DIR, "winrate.csv")
TEAMMATE_WINRATE_FILE = os.path.join(BASE_DIR, "teammate_winrate.csv")
DATA_FILES = ["names.txt", "winrate.csv", "teammate_winrate.csv"]


def get_legacy_data_dirs():
    dirs = []
    appdata_root = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
    if appdata_root:
        dirs.append(os.path.join(appdata_root, "ClassificationApp"))

    for path_value in [
        getattr(sys, "executable", ""),
        globals().get("__file__", ""),
        sys.argv[0] if sys.argv else "",
        os.getcwd(),
    ]:
        if path_value:
            dirs.append(os.path.dirname(os.path.abspath(path_value)))

    unique_dirs = []
    for folder in dirs:
        if folder and folder not in unique_dirs and os.path.abspath(folder) != os.path.abspath(BASE_DIR):
            unique_dirs.append(folder)
    return unique_dirs


def migrate_existing_data_files():
    for folder in get_legacy_data_dirs():
        for filename in DATA_FILES:
            source = os.path.join(folder, filename)
            target = os.path.join(BASE_DIR, filename)
            if os.path.exists(source) and not os.path.exists(target):
                try:
                    shutil.copy2(source, target)
                except OSError:
                    pass


migrate_existing_data_files()
class GroupApp(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.names = []
        self.inactive_indices = set()
        self.current_groups = [[], []]
        self.win_stats = {}
        self.teammate_stats = {}
        self.result_recorded = False
        self.rest_history = []  # 記錄最近兩輪休息的人
        self.initUI()
        self.load_names()
        self.load_win_stats()
        self.load_teammate_stats()

    def initUI(self):
        self.setWindowTitle("隨機分組工具（含輪休 + Enter新增）")
        self.setGeometry(200, 200, 750, 600)

        # ----------- 輸入區 -----------
        input_label = QtWidgets.QLabel("請輸入人名：")
        self.input_box = QtWidgets.QLineEdit()
        self.input_box.setPlaceholderText("輸入後按新增或Enter")
        add_btn = QtWidgets.QPushButton("新增")
        add_btn.clicked.connect(self.add_name)
        remove_btn = QtWidgets.QPushButton("刪除選取")
        remove_btn.clicked.connect(self.remove_selected)

        # 按 Enter 也能新增
        self.input_box.returnPressed.connect(self.add_name)

        input_layout = QtWidgets.QHBoxLayout()
        input_layout.addWidget(input_label)
        input_layout.addWidget(self.input_box)
        input_layout.addWidget(add_btn)

        # ----------- 名字列表（多列） -----------
        self.name_list = QtWidgets.QListWidget()
        self.name_list.setViewMode(QtWidgets.QListView.IconMode)
        self.name_list.setFlow(QtWidgets.QListView.LeftToRight)
        self.name_list.setWrapping(True)
        self.name_list.setGridSize(QtCore.QSize(120, 30))
        self.name_list.setResizeMode(QtWidgets.QListWidget.Adjust)
        self.name_list.itemDoubleClicked.connect(self.toggle_name_active)

        # 人數顯示
        self.count_label = QtWidgets.QLabel("目前人數：0")
        self.count_label.setAlignment(QtCore.Qt.AlignLeft)

        # 按鈕區
        btn_layout = QtWidgets.QHBoxLayout()
        btn_layout.addWidget(remove_btn)
        group_btn = QtWidgets.QPushButton("開始分組")
        group_btn.clicked.connect(self.do_group)
        btn_layout.addWidget(group_btn)
        winrate_btn = QtWidgets.QPushButton("查看勝率")
        winrate_btn.clicked.connect(self.show_winrate_window)
        btn_layout.addWidget(winrate_btn)

        self.weight_checkbox = QtWidgets.QCheckBox("依勝率加權分組")
        self.weight_checkbox.setChecked(True)
        self.weight_checkbox.setToolTip("勾選：依個人勝率平衡兩隊實力（強弱搭配）\n取消勾選：完全隨機分組")
        btn_layout.addWidget(self.weight_checkbox)

        # ----------- 分組區 -----------
        self.group1_label = QtWidgets.QLabel("Group 1")
        self.group2_label = QtWidgets.QLabel("Group 2")
        title_font = QtGui.QFont()
        title_font.setPointSize(14)
        title_font.setBold(True)
        self.group1_label.setFont(title_font)
        self.group2_label.setFont(title_font)

        self.group1_btn = QtWidgets.QPushButton("記錄勝利")
        self.group2_btn = QtWidgets.QPushButton("記錄勝利")
        self.group1_btn.clicked.connect(lambda: self.handle_group_button(0))
        self.group2_btn.clicked.connect(lambda: self.handle_group_button(1))
        self.group1_btn.hide()
        self.group2_btn.hide()

        text_font = QtGui.QFont()
        text_font.setPointSize(12)
        self.group1_text = QtWidgets.QTextEdit()
        self.group2_text = QtWidgets.QTextEdit()
        self.group1_text.setReadOnly(True)
        self.group2_text.setReadOnly(True)
        self.group1_text.setFont(text_font)
        self.group2_text.setFont(text_font)
        self.group1_text.setMinimumHeight(200)
        self.group2_text.setMinimumHeight(200)

        group_layout = QtWidgets.QHBoxLayout()
        left_layout = QtWidgets.QVBoxLayout()
        left_title_layout = QtWidgets.QHBoxLayout()
        left_title_layout.addWidget(self.group1_label)
        left_title_layout.addStretch()
        left_title_layout.addWidget(self.group1_btn)
        left_layout.addLayout(left_title_layout)
        left_layout.addWidget(self.group1_text)
        right_layout = QtWidgets.QVBoxLayout()
        right_title_layout = QtWidgets.QHBoxLayout()
        right_title_layout.addWidget(self.group2_label)
        right_title_layout.addStretch()
        right_title_layout.addWidget(self.group2_btn)
        right_layout.addLayout(right_title_layout)
        right_layout.addWidget(self.group2_text)
        group_layout.addLayout(left_layout)
        group_layout.addLayout(right_layout)

        # ----------- 休息區 -----------
        self.rest_title = QtWidgets.QLabel("休息區（若超過10人）")
        rest_font = QtGui.QFont()
        rest_font.setPointSize(12)
        rest_font.setBold(True)
        self.rest_title.setFont(rest_font)

        self.rest_list = QtWidgets.QListWidget()
        self.rest_list.setViewMode(QtWidgets.QListView.IconMode)
        self.rest_list.setFlow(QtWidgets.QListView.LeftToRight)
        self.rest_list.setWrapping(True)
        self.rest_list.setGridSize(QtCore.QSize(120, 30))
        self.rest_list.setResizeMode(QtWidgets.QListWidget.Adjust)

        rest_layout = QtWidgets.QVBoxLayout()
        rest_layout.addWidget(self.rest_title)
        rest_layout.addWidget(self.rest_list)

        # ----------- Main Layout -----------
        main_layout = QtWidgets.QVBoxLayout()
        main_layout.addLayout(input_layout)
        main_layout.addWidget(self.name_list)
        main_layout.addWidget(self.count_label)
        main_layout.addLayout(btn_layout)
        main_layout.addLayout(group_layout)
        main_layout.addLayout(rest_layout)

        self.setLayout(main_layout)

    # -------------------------------
    #           功能
    # -------------------------------
    def add_name(self):
        name = self.input_box.text().strip()
        if not name:
            return
        self.names.append(name)
        self.name_list.addItem(name)
        self.apply_name_item_style(self.name_list.item(self.name_list.count() - 1), False)
        self.input_box.clear()
        self.update_count()
        self.save_names()

    def remove_selected(self):
        selected = self.name_list.currentRow()
        if selected >= 0:
            self.name_list.takeItem(selected)
            del self.names[selected]
            self.inactive_indices = {
                index - 1 if index > selected else index
                for index in self.inactive_indices
                if index != selected
            }
            self.update_count()
            self.save_names()

    def update_count(self):
        active_count = len(self.names) - len(self.inactive_indices)
        self.count_label.setText(f"目前人數：{len(self.names)}，參與分組：{active_count}")

    def apply_name_item_style(self, item, inactive):
        if inactive:
            item.setBackground(QtGui.QBrush(QtCore.Qt.black))
            item.setForeground(QtGui.QBrush(QtCore.Qt.white))
            item.setToolTip("不參與分組")
        else:
            item.setBackground(QtGui.QBrush())
            item.setForeground(QtGui.QBrush())
            item.setToolTip("")

    def toggle_name_active(self, item):
        row = self.name_list.row(item)
        if row < 0:
            return

        if row in self.inactive_indices:
            self.inactive_indices.remove(row)
            self.apply_name_item_style(item, False)
        else:
            self.inactive_indices.add(row)
            self.apply_name_item_style(item, True)

        self.update_count()

    def show_save_error(self, path, error):
        QtWidgets.QMessageBox.critical(
            self,
            "Save failed",
            f"Cannot write file:\n{path}\n\nError:\n{error}\n\nPlease make sure the exe folder is writable. For example, put the exe on Desktop or another normal user folder."
        )

    def save_names(self):
        try:
            with open(SAVE_FILE, "w", encoding="utf-8") as f:
                for name in self.names:
                    f.write(name + "\n")
        except OSError as error:
            self.show_save_error(SAVE_FILE, error)

    def load_names(self):
        if os.path.exists(SAVE_FILE):
            with open(SAVE_FILE, "r", encoding="utf-8") as f:
                self.names = [line.strip() for line in f if line.strip()]
            self.name_list.addItems(self.names)
            self.update_count()

    def load_win_stats(self):
        if not os.path.exists(WINRATE_FILE):
            return

        with open(WINRATE_FILE, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("name", "").strip()
                if not name:
                    continue
                self.win_stats[name] = {
                    "wins": int(row.get("wins", 0) or 0),
                    "losses": int(row.get("losses", 0) or 0),
                }

    def save_win_stats(self):
        try:
            with open(WINRATE_FILE, "w", encoding="utf-8", newline="") as f:
                fieldnames = ["name", "wins", "losses", "total", "win_rate"]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for name in sorted(self.win_stats):
                    wins = self.win_stats[name]["wins"]
                    losses = self.win_stats[name]["losses"]
                    total = wins + losses
                    win_rate = wins / total if total else 0
                    writer.writerow({
                        "name": name,
                        "wins": wins,
                        "losses": losses,
                        "total": total,
                        "win_rate": f"{win_rate:.2%}",
                    })
        except OSError as error:
            self.show_save_error(WINRATE_FILE, error)

    def load_teammate_stats(self):
        if not os.path.exists(TEAMMATE_WINRATE_FILE):
            return

        with open(TEAMMATE_WINRATE_FILE, "r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("name", "").strip()
                teammate = row.get("teammate", "").strip()
                if not name or not teammate:
                    continue
                self.teammate_stats[(name, teammate)] = {
                    "wins": int(row.get("wins", 0) or 0),
                    "losses": int(row.get("losses", 0) or 0),
                }

    def save_teammate_stats(self):
        try:
            with open(TEAMMATE_WINRATE_FILE, "w", encoding="utf-8", newline="") as f:
                fieldnames = ["name", "teammate", "wins", "losses", "total", "win_rate"]
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                for name, teammate in sorted(self.teammate_stats):
                    stats = self.teammate_stats[(name, teammate)]
                    wins = stats["wins"]
                    losses = stats["losses"]
                    total = wins + losses
                    win_rate = wins / total if total else 0
                    writer.writerow({
                        "name": name,
                        "teammate": teammate,
                        "wins": wins,
                        "losses": losses,
                        "total": total,
                        "win_rate": f"{win_rate:.2%}",
                    })
        except OSError as error:
            self.show_save_error(TEAMMATE_WINRATE_FILE, error)

    def record_teammate_result(self, group, is_win):
        result_key = "wins" if is_win else "losses"

        for name in group:
            for teammate in group:
                if name == teammate:
                    continue
                stats = self.teammate_stats.setdefault(
                    (name, teammate),
                    {"wins": 0, "losses": 0}
                )
                stats[result_key] += 1

    def handle_group_button(self, group_index):
        if self.result_recorded:
            self.do_group()
            return

        self.record_winner(group_index)
        self.result_recorded = True
        self.group1_btn.setText("再次分組")
        self.group2_btn.setText("再次分組")

    def record_winner(self, winner_index):
        loser_index = 1 - winner_index

        for name in self.current_groups[winner_index]:
            stats = self.win_stats.setdefault(name, {"wins": 0, "losses": 0})
            stats["wins"] += 1

        for name in self.current_groups[loser_index]:
            stats = self.win_stats.setdefault(name, {"wins": 0, "losses": 0})
            stats["losses"] += 1

        self.record_teammate_result(self.current_groups[winner_index], True)
        self.record_teammate_result(self.current_groups[loser_index], False)
        self.save_win_stats()
        self.save_teammate_stats()

    def get_win_rate(self, name):
        stats = self.win_stats.get(name)
        if not stats:
            return 0.5
        total = stats["wins"] + stats["losses"]
        return stats["wins"] / total if total else 0.5

    def balanced_split(self, people):
        """依勝率將名單分成兩隊，讓兩隊總實力盡量接近（強弱搭配）。"""
        rated = sorted(people, key=lambda name: -self.get_win_rate(name))
        max_size1 = (len(rated) + 1) // 2
        max_size2 = len(rated) // 2

        group1, group2 = [], []
        sum1 = sum2 = 0.0
        for name in rated:
            rate = self.get_win_rate(name)
            room1 = len(group1) < max_size1
            room2 = len(group2) < max_size2
            if room1 and (not room2 or sum1 <= sum2):
                group1.append(name)
                sum1 += rate
            else:
                group2.append(name)
                sum2 += rate
        return group1, group2

    def show_winrate_window(self):
        self.win_stats = {}
        self.load_win_stats()

        dialog = QtWidgets.QDialog(self)
        dialog.setWindowTitle("勝率統計")
        dialog.resize(520, 420)

        table = QtWidgets.QTableWidget()
        table.setColumnCount(5)
        table.setHorizontalHeaderLabels(["姓名", "勝場", "敗場", "總場次", "勝率"])
        table.setRowCount(len(self.names))
        table.verticalHeader().setVisible(False)
        table.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
        table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)
        table.cellDoubleClicked.connect(
            lambda row, col: self.show_teammate_winrate_window(table.item(row, 0).text()) if col == 0 and table.item(row, 0) else None
        )

        for row, name in enumerate(self.names):
            stats = self.win_stats.get(name, {"wins": 0, "losses": 0})
            wins = stats["wins"]
            losses = stats["losses"]
            total = wins + losses
            win_rate = wins / total if total else 0
            values = [name, str(wins), str(losses), str(total), f"{win_rate:.2%}"]

            for col, value in enumerate(values):
                item = QtWidgets.QTableWidgetItem(value)
                item.setTextAlignment(QtCore.Qt.AlignCenter)
                table.setItem(row, col, item)

        table.horizontalHeader().setSectionResizeMode(QtWidgets.QHeaderView.Stretch)

        close_btn = QtWidgets.QPushButton("關閉")
        close_btn.clicked.connect(dialog.accept)

        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(table)
        layout.addWidget(close_btn)
        dialog.setLayout(layout)
        dialog.exec_()

    def show_teammate_winrate_window(self, name):
        self.teammate_stats = {}
        self.load_teammate_stats()

        dialog = QtWidgets.QDialog(self)
        dialog.setWindowTitle(f"{name} 的同隊勝率")
        dialog.resize(560, 420)

        teammates = [person for person in self.names if person != name]
        table = QtWidgets.QTableWidget()
        table.setColumnCount(5)
        table.setHorizontalHeaderLabels(["同隊成員", "勝場", "敗場", "同隊場次", "同隊勝率"])
        table.setRowCount(len(teammates))
        table.verticalHeader().setVisible(False)
        table.setEditTriggers(QtWidgets.QAbstractItemView.NoEditTriggers)
        table.setSelectionBehavior(QtWidgets.QAbstractItemView.SelectRows)

        for row, teammate in enumerate(teammates):
            stats = self.teammate_stats.get((name, teammate), {"wins": 0, "losses": 0})
            wins = stats["wins"]
            losses = stats["losses"]
            total = wins + losses
            win_rate = wins / total if total else 0
            values = [teammate, str(wins), str(losses), str(total), f"{win_rate:.2%}"]

            for col, value in enumerate(values):
                item = QtWidgets.QTableWidgetItem(value)
                item.setTextAlignment(QtCore.Qt.AlignCenter)
                table.setItem(row, col, item)

        table.horizontalHeader().setSectionResizeMode(QtWidgets.QHeaderView.Stretch)

        close_btn = QtWidgets.QPushButton("關閉")
        close_btn.clicked.connect(dialog.accept)

        layout = QtWidgets.QVBoxLayout()
        layout.addWidget(table)
        layout.addWidget(close_btn)
        dialog.setLayout(layout)
        dialog.exec_()

    def do_group(self):
        active_names = [
            name for index, name in enumerate(self.names)
            if index not in self.inactive_indices
        ]
        if len(active_names) < 2:
            return

        people = active_names.copy()
        random.shuffle(people)

        # ---------------- 輪休機制修正版 ----------------
        # 取得最近兩輪休息人
        recent_rest = set([name for sublist in self.rest_history for name in sublist])
        rest = []
        if len(people) > 10:
            rest_needed = len(people) - 10
            rest_candidates = [p for p in people if p not in recent_rest]

            # 如果候選人不足，從其他人補齊
            if len(rest_candidates) < rest_needed:
                extra_needed = rest_needed - len(rest_candidates)
                remaining = [p for p in people if p not in rest_candidates]
                rest = rest_candidates + remaining[:extra_needed]
            else:
                rest = random.sample(rest_candidates, rest_needed)

            group_people = [p for p in people if p not in rest]
        else:
            group_people = people

        # 更新輪休歷史（保留最近兩輪）
        self.rest_history.append(rest)
        if len(self.rest_history) > 2:
            self.rest_history.pop(0)

        # 分組
        if self.weight_checkbox.isChecked():
            group1, group2 = self.balanced_split(group_people)
        else:
            half = len(group_people) // 2
            group1 = group_people[:half]
            group2 = group_people[half:]
        self.current_groups = [group1, group2]
        self.result_recorded = False

        self.group1_text.setText("\n".join(group1))
        self.group2_text.setText("\n".join(group2))
        self.group1_btn.setText("記錄勝利")
        self.group2_btn.setText("記錄勝利")
        self.group1_btn.show()
        self.group2_btn.show()

        # 更新休息區多列顯示
        self.rest_list.clear()
        self.rest_list.addItems(rest)


# -------------------------------
#             Main
# -------------------------------
if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    window = GroupApp()
    window.show()
    sys.exit(app.exec_())
