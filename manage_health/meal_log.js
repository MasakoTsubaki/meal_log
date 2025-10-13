/* ====================================================
   食事＆活動ログ — 複数カテゴリ対応版（CSV利用）
   コメント多めで初心者向け
   ==================================================== */

/* ---------------------------
   ユーティリティ：今日の日付（YYYY-MM-DD）
   --------------------------- */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------
   初期化：今日ラベルを表示
   --------------------------- */
document.getElementById('todayDisplay').textContent = todayISO();

/* ---------------------------
   1) データ構造と保存キー（LocalStorage）
   - logs: 配列。1行＝1エントリ（食事 or 運動）
     { id, date, time, name, amount, category: [カテゴリ配列], type }
   - dailyComments: 日付ごとのコメント文字列
   - goals: 目標値オブジェクト（数値）
   --------------------------- */
const LS_KEY_LOGS = 'meal_logs_v2';
const LS_KEY_COMMENTS = 'meal_comments_v2';
const LS_KEY_GOALS = 'meal_goals_v2';

/* ---------------------------
   2) 目標のデフォルト値（編集可能）
   --------------------------- */
const defaultGoals = {
  gohan: 2,
  misoshiru: 2,
  gyokai: 1,
  kaiso: 1,
  mame: 1,
  tamago: 1,
  yasai: 5
};

/* ---------------------------
   3) CSV読み込み用カテゴリ配列
   --------------------------- */
let categoryRulesCSV = []; // CSVから読み込む配列

async function loadCategoryCSV() {
  try {
    const res = await fetch('categories.csv');
    const text = await res.text();
    categoryRulesCSV = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [name, cat] = line.split(',').map(s => s.trim());
        return { name, category: cat };
      });
  } catch (e) {
    console.error('CSV読み込みに失敗しました:', e);
  }
}

/* ---------------------------
   4) ローカルストレージの読み書き関数
   --------------------------- */
function loadLogs() {
  const raw = localStorage.getItem(LS_KEY_LOGS);
  return raw ? JSON.parse(raw) : [];
}
function saveLogs(arr) {
  localStorage.setItem(LS_KEY_LOGS, JSON.stringify(arr));
}
function loadComments() {
  return JSON.parse(localStorage.getItem(LS_KEY_COMMENTS) || '{}');
}
function saveComments(obj) {
  localStorage.setItem(LS_KEY_COMMENTS, JSON.stringify(obj));
}
function loadGoals() {
  const raw = localStorage.getItem(LS_KEY_GOALS);
  return raw ? JSON.parse(raw) : Object.assign({}, defaultGoals);
}
function saveGoals(obj) {
  localStorage.setItem(LS_KEY_GOALS, JSON.stringify(obj));
}

/* ---------------------------
   5) カテゴリ検出関数（複数カテゴリ対応）
   - 食材名に含まれるキーワードをすべて検出
   - 返り値は配列
   --------------------------- */
function detectCategories(foodName) {
  if (!foodName) return [];
  const name = foodName.toString();
  const cats = [];
  for (const entry of categoryRulesCSV) {
    if (name.includes(entry.name) && !cats.includes(entry.category)) {
      cats.push(entry.category);
    }
  }
  return cats; // 空配列もあり
}

/* ---------------------------
   6) 表示用ラベル対応（内部キー -> 表示名）
   --------------------------- */
const categoryLabels = {
  gohan: 'ご飯',
  misoshiru: '味噌汁',
  gyokai: '魚介',
  kaiso: '海藻',
  mame: '豆',
  tamago: '卵',
  yasai: '野菜'
};

/* ---------------------------
   7) ページ起動時にロードして表示
   --------------------------- */
let logs = loadLogs();
let comments = loadComments();
let goals = loadGoals();

// 目標入力欄にロード済みの目標を反映
document.getElementById('goal_gohan').value = goals.gohan;
document.getElementById('goal_misoshiru').value = goals.misoshiru;
document.getElementById('goal_gyokai').value = goals.gyokai;
document.getElementById('goal_kaiso').value = goals.kaiso;
document.getElementById('goal_mame').value = goals.mame;
document.getElementById('goal_tamago').value = goals.tamago;
document.getElementById('goal_yasai').value = goals.yasai;

// 今日のコメントがあれば表示
if (comments[todayISO()]) document.getElementById('teacherComment').value = comments[todayISO()];

/* CSVロード完了後に初回描画 */
loadCategoryCSV().then(() => {
  renderToday();
});

/* ---------------------------
   8) 今日のログをテーブル表示（複数カテゴリ対応）
   --------------------------- */
function renderToday() {
  const tbody = document.querySelector('#todayTable tbody');
  tbody.innerHTML = '';
  const date = todayISO();
  const todayLogs = logs.filter(l => l.date === date);

  // カウント集計（カテゴリごとに達成判定）
  const counts = {};
  for (const l of todayLogs) {
    if (Array.isArray(l.category)) {
      for (const c of l.category) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
  }

  for (const entry of todayLogs) {
    const tr = document.createElement('tr');

    const tdTime = document.createElement('td'); tdTime.textContent = entry.time || ''; tr.appendChild(tdTime);
    const tdName = document.createElement('td'); tdName.textContent = entry.name || ''; tr.appendChild(tdName);

    const tdCat = document.createElement('td');
    if (Array.isArray(entry.category) && entry.category.length) {
      tdCat.textContent = entry.category.map(c => categoryLabels[c] || c).join(' / ');
    } else {
      tdCat.textContent = '-';
    }
    tr.appendChild(tdCat);

    const tdAmt = document.createElement('td'); tdAmt.textContent = entry.amount || ''; tr.appendChild(tdAmt);

    const tdCheck = document.createElement('td');
    if (Array.isArray(entry.category) && entry.category.length) {
      const checks = entry.category.map(c => {
        const got = counts[c];
        if (goals[c] !== undefined) {
          return got >= goals[c] ? '✅ 達成!' : `⚠️ あと${goals[c] - got}`;
        } else return '-';
      });
      tdCheck.innerHTML = checks.join('<br>');
    } else {
      tdCheck.textContent = '-';
    }
    tr.appendChild(tdCheck);

    const tdOp = document.createElement('td');
    const del = document.createElement('button');
    del.textContent = '削除';
    del.className = 'delete-btn';
    del.onclick = () => {
      if (!confirm('この項目を削除しますか？')) return;
      logs = logs.filter(x => x.id !== entry.id);
      saveLogs(logs);
      renderToday();
      updateSummary();
    };
    tdOp.appendChild(del);
    tr.appendChild(tdOp);

    tbody.appendChild(tr);
  }

  const totalFoodItems = todayLogs.filter(x => x.type === 'food').length;
  document.getElementById('totalItems').textContent = totalFoodItems;

  updateSummary();
}

/* ---------------------------
   9) 今日の目標一覧を表示（複数カテゴリ対応）
   --------------------------- */
function updateSummary() {
  const date = todayISO();
  const todayLogs = logs.filter(l => l.date === date && l.type === 'food');
  const counts = {};
  for (const l of todayLogs) {
    if (Array.isArray(l.category)) {
      for (const c of l.category) counts[c] = (counts[c] || 0) + 1;
    }
  }

  const ul = document.getElementById('goalList');
  ul.innerHTML = '';
  const order = ['gohan','misoshiru','gyokai','kaiso','mame','tamago','yasai'];
  for (const key of order) {
    const li = document.createElement('li');
    const lbl = categoryLabels[key] || key;
    const have = counts[key] || 0;
    const need = goals[key] !== undefined ? goals[key] : '-';
    if (goals[key] !== undefined) {
      const done = have >= goals[key];
      li.innerHTML = `<strong>${lbl}</strong>： ${have}/${need} ${done ? '<span class="achieved">✅' : '<span class="remaining">⚠️あと'+(need-have) }</span>`;
    } else {
      li.textContent = `${lbl}：${have}`;
    }
    ul.appendChild(li);
  }
}

/* ---------------------------
   10) 食事エントリ追加（複数カテゴリ対応）
   --------------------------- */
document.getElementById('addFoodBtn').addEventListener('click', () => {
  const time = document.getElementById('timeSelect').value;
  const name = document.getElementById('foodInput').value.trim();
  const amount = document.getElementById('amountInput').value.trim();
  if (!name) { alert('食材名を入力してください'); return; }

  const cats = detectCategories(name); // 複数カテゴリ判定
  const newEntry = {
    id: Date.now() + Math.random().toString(36).slice(2,6),
    date: todayISO(),
    time: time,
    name: name,
    amount: amount,
    category: cats,
    type: 'food'
  };
  logs.push(newEntry);
  saveLogs(logs);

  document.getElementById('foodInput').value = '';
  document.getElementById('amountInput').value = '';
  renderToday();
});

/* 入力クリア */
document.getElementById('clearInputs').addEventListener('click', () => {
  document.getElementById('foodInput').value = '';
  document.getElementById('amountInput').value = '';
});

/* ---------------------------
   11) 活動（運動）追加
   --------------------------- */
document.getElementById('addActivityBtn').addEventListener('click', () => {
  const name = document.getElementById('activityInput').value.trim();
  if (!name) { alert('活動内容を入力してください'); return; }
  const newEntry = {
    id: Date.now() + Math.random().toString(36).slice(2,6),
    date: todayISO(),
    time: '',
    name: name,
    amount: '',
    category: [],
    type: 'activity'
  };
  logs.push(newEntry);
  saveLogs(logs);
  document.getElementById('activityInput').value = '';
  renderToday();
});

/* ---------------------------
   12) コメント保存・コピー
   --------------------------- */
document.getElementById('saveCommentBtn').addEventListener('click', () => {
  comments[todayISO()] = document.getElementById('teacherComment').value.trim();
  saveComments(comments);
  alert('コメントを保存しました');
});
document.getElementById('copyCommentBtn').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('teacherComment').value).then(() => {
    alert('コメントをコピーしました');
  });
});

/* ---------------------------
   13) 目標保存・リセット
   --------------------------- */
document.getElementById('saveGoals').addEventListener('click', () => {
  for (const key in defaultGoals) {
    const val = parseInt(document.getElementById(`goal_${key}`).value);
    goals[key] = isNaN(val) ? defaultGoals[key] : val;
  }
  saveGoals(goals);
  updateSummary();
  alert('目標を保存しました');
});
document.getElementById('resetGoals').addEventListener('click', () => {
  goals = Object.assign({}, defaultGoals);
  saveGoals(goals);
  for (const key in defaultGoals) document.getElementById(`goal_${key}`).value = defaultGoals[key];
  updateSummary();
});

/* ---------------------------
   14) 1週間集計表示・コピー
   --------------------------- */
/* ---------------------------
   13) 1週間（過去7日）集計関数 — 改良版
   --------------------------- */
function generateWeekSummary(){
  const end = new Date();
  const out = [];

  for(let d=0; d<7; d++){
    const dateObj = new Date();
    dateObj.setDate(end.getDate() - d);
    const iso = dateObj.toISOString().slice(0,10);
    const dayLogs = logs.filter(l => l.date === iso);
    const foodLogs = dayLogs.filter(l => l.type==='food');
    const activityLogs = dayLogs.filter(l => l.type==='activity');

    // カテゴリごとのカウント
    const counts = {};
    for(const l of foodLogs){
      if(l.category) counts[l.category] = (counts[l.category]||0)+1;
    }

    // 日付見出し
    out.push(`${iso}（朝〜夜）`);

    // 食事内容
    if(foodLogs.length){
      out.push('  食事：');
      for(const l of foodLogs){
        const lbls = [];
        if(l.category && goals[l.category]!==undefined){
          const done = counts[l.category] >= goals[l.category];
          lbls.push(`${categoryLabels[l.category]||l.category}${done ? '✅' : '⚠️'}`);
        }
        out.push(`    - ${l.time || '?'}：${l.name}${l.amount? '（'+l.amount+'）' : ''} → ${lbls.join(' / ') || '-'}`);
      }
    } else {
      out.push('  食事：記録なし');
    }

    // 活動内容
    if(activityLogs.length){
      out.push('  運動：');
      for(const l of activityLogs){
        out.push(`    - ${l.name}`);
      }
    }

    // コメント
    if(comments[iso]){
      out.push('  コメント：');
      out.push(`    ${comments[iso]}`);
    }

    // 空行で区切る
    out.push('');
  }

  return out.join('\n');
}

// ボタンとの連携
document.getElementById('showWeekBtn').addEventListener('click', ()=>{
  const txt = generateWeekSummary();
  document.getElementById('weekArea').textContent = txt;
});

document.getElementById('copyWeekBtn').addEventListener('click', ()=>{
  const txt = document.getElementById('weekArea').textContent || generateWeekSummary();
  if(!txt) { alert('1週間のまとめが空です。まず「1週間集計を表示」を押してください。'); return; }
  navigator.clipboard?.writeText(txt).then(()=> alert('1週間まとめをコピーしました'), ()=> alert('コピーに失敗しました'));
});

/* ---------------------------
   15) CSV出力・全データクリア
   --------------------------- */
document.getElementById('exportCsv').addEventListener('click', () => {
  const csv = ['id,date,time,name,amount,category,type'];
  for (const l of logs) {
    csv.push(`${l.id},${l.date},${l.time},${l.name},${l.amount},"${l.category.join(' / ')}",${l.type}`);
  }
  const blob = new Blob([csv.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `meal_logs_${todayISO()}.csv`;
  a.click();
});
document.getElementById('clearAll').addEventListener('click', () => {
  if (!confirm('本当に全データを削除しますか？')) return;
  localStorage.removeItem(LS_KEY_LOGS);
  localStorage.removeItem(LS_KEY_COMMENTS);
  localStorage.removeItem(LS_KEY_GOALS);
  logs = [];
  comments = {};
  goals = Object.assign({}, defaultGoals);
  for (const key in defaultGoals) document.getElementById(`goal_${key}`).value = defaultGoals[key];
  renderToday();
});
