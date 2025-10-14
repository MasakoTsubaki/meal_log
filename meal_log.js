/* ====================================================
   食事＆活動ログ — 複数カテゴリ対応版（きのこ対応）
   コメント多めで初心者向け
   ==================================================== */

/* ---------------------------
   今日の日付（YYYY-MM-DD）
   --------------------------- */
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------------------
   初期化：今日ラベルを表示
   --------------------------- */
document.getElementById('todayDisplay').textContent = todayISO();

/* ---------------------------
   LocalStorageキー
   --------------------------- */
const LS_KEY_LOGS = 'meal_logs_v2';
const LS_KEY_COMMENTS = 'meal_comments_v2';
const LS_KEY_GOALS = 'meal_goals_v2';

/* ---------------------------
   デフォルト目標値（編集可）
   kinoko追加
   --------------------------- */
const defaultGoals = {
  gohan: 2,
  misoshiru: 2,
  gyokai: 1,
  kaiso: 1,
  mame: 1,
  tamago: 1,
  yasai: 5,
  kinoko: 1 // 追加
};

/* ---------------------------
   CSV読み込み用カテゴリ配列
   --------------------------- */
let categoryRulesCSV = [];

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
   LocalStorage読み書き
   --------------------------- */
function loadLogs() { return JSON.parse(localStorage.getItem(LS_KEY_LOGS) || '[]'); }
function saveLogs(arr) { localStorage.setItem(LS_KEY_LOGS, JSON.stringify(arr)); }
function loadComments() { return JSON.parse(localStorage.getItem(LS_KEY_COMMENTS) || '{}'); }
function saveComments(obj) { localStorage.setItem(LS_KEY_COMMENTS, JSON.stringify(obj)); }
function loadGoals() {
  const raw = localStorage.getItem(LS_KEY_GOALS);
  return raw ? JSON.parse(raw) : Object.assign({}, defaultGoals);
}
function saveGoals(obj) { localStorage.setItem(LS_KEY_GOALS, JSON.stringify(obj)); }

/* ---------------------------
   カテゴリ検出（複数カテゴリ対応）
   --------------------------- */
function detectCategories(foodName) {
  if (!foodName) return [];
  const name = foodName.toString();
  const cats = [];
  for (const entry of categoryRulesCSV) {
    if (name.includes(entry.name) && entry.category && !cats.includes(entry.category)) {
      cats.push(entry.category);
    }
  }
  return cats;
}

/* ---------------------------
   表示ラベル対応
   --------------------------- */
const categoryLabels = {
  gohan: 'ご飯',
  misoshiru: '味噌汁',
  gyokai: '魚介',
  kaiso: '海藻',
  mame: '豆',
  tamago: '卵',
  yasai: '野菜',
  kinoko: 'きのこ'
};

/* ---------------------------
   初期ロード
   --------------------------- */
let logs = loadLogs();
let comments = loadComments();
let goals = loadGoals();

// 目標フォームに反映
for (const key in defaultGoals) {
  const el = document.getElementById(`goal_${key}`);
  if (el) el.value = goals[key];
}

// 今日のコメントを表示
if (comments[todayISO()]) document.getElementById('teacherComment').value = comments[todayISO()];

/* CSVロード後に描画 */
loadCategoryCSV().then(() => { renderToday(); });

/* ---------------------------
   今日のログ表示（食材名で重複1日1回）
   --------------------------- */
function renderToday() {
  const tbody = document.querySelector('#todayTable tbody');
  tbody.innerHTML = '';
  const date = todayISO();
  const todayLogs = logs.filter(l => l.date === date);

  // カテゴリごとの重複排除カウント
  const counts = {};
  const countedFoods = {}; // 同じ食材は1日1回のみ
  for (const l of todayLogs) {
    if (l.type === 'food' && !countedFoods[l.name]) {
      countedFoods[l.name] = true;
      if (Array.isArray(l.category)) {
        for (const c of l.category) counts[c] = (counts[c] || 0) + 1;
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
        const got = counts[c] || 0;
        if (goals[c] !== undefined) return got >= goals[c] ? '✅ 達成!' : `⚠️ あと${goals[c]-got}`;
        return '-';
      });
      tdCheck.innerHTML = checks.join('<br>');
    } else tdCheck.textContent = '-';
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

  const totalFoodItems = Object.keys(countedFoods).length;
  document.getElementById('totalItems').textContent = totalFoodItems;

  updateSummary();
}

/* ---------------------------
   今日の目標サマリー
   --------------------------- */
function updateSummary() {
  const date = todayISO();
  const todayLogs = logs.filter(l => l.date === date && l.type==='food');
  const counts = {};
  const countedFoods = {};
  for (const l of todayLogs) {
    if (!countedFoods[l.name]) {
      countedFoods[l.name]=true;
      if (Array.isArray(l.category)) {
        for(const c of l.category) counts[c]=(counts[c]||0)+1;
      }
    }
  }

  const ul = document.getElementById('goalList');
  ul.innerHTML='';
  const order=['gohan','misoshiru','gyokai','kaiso','mame','tamago','yasai','kinoko'];
  for(const key of order){
    const li = document.createElement('li');
    const lbl = categoryLabels[key] || key;
    const have = counts[key]||0;
    const need = goals[key]!==undefined?goals[key]:'-';
    if(goals[key]!==undefined){
      const done = have>=goals[key];
      li.innerHTML=`<strong>${lbl}</strong>： ${have}/${need} ${done?'<span class="achieved">✅':'<span class="remaining">⚠️あと'+(need-have)}</span>`;
    } else {
      li.textContent=`${lbl}：${have}`;
    }
    ul.appendChild(li);
  }
}

/* ---------------------------
   食事追加
   --------------------------- */
document.getElementById('addFoodBtn').addEventListener('click',()=>{
  const time=document.getElementById('timeSelect').value;
  const name=document.getElementById('foodInput').value.trim();
  const amount=document.getElementById('amountInput').value.trim();
  if(!name){ alert('食材名を入力してください'); return; }

  const cats=detectCategories(name);
  const newEntry={
    id:Date.now()+Math.random().toString(36).slice(2,6),
    date:todayISO(),
    time:time,
    name:name,
    amount:amount,
    category:cats,
    type:'food'
  };
  logs.push(newEntry);
  saveLogs(logs);

  document.getElementById('foodInput').value='';
  document.getElementById('amountInput').value='';
  renderToday();
});

document.getElementById('clearInputs').addEventListener('click',()=>{
  document.getElementById('foodInput').value='';
  document.getElementById('amountInput').value='';
});

/* ---------------------------
   活動追加
   --------------------------- */
document.getElementById('addActivityBtn').addEventListener('click',()=>{
  const name=document.getElementById('activityInput').value.trim();
  if(!name){ alert('活動内容を入力してください'); return; }
  const newEntry={
    id:Date.now()+Math.random().toString(36).slice(2,6),
    date:todayISO(),
    time:'',
    name:name,
    amount:'',
    category:[],
    type:'activity'
  };
  logs.push(newEntry);
  saveLogs(logs);
  document.getElementById('activityInput').value='';
  renderToday();
});

/* ---------------------------
   コメント保存・コピー
   --------------------------- */
document.getElementById('saveCommentBtn').addEventListener('click',()=>{
  comments[todayISO()]=document.getElementById('teacherComment').value.trim();
  saveComments(comments);
  alert('コメントを保存しました');
});
document.getElementById('copyCommentBtn').addEventListener('click',()=>{
  navigator.clipboard.writeText(document.getElementById('teacherComment').value)
    .then(()=>alert('コメントをコピーしました'));
});

/* ---------------------------
   目標保存・リセット
   --------------------------- */
document.getElementById('saveGoals').addEventListener('click',()=>{
  for(const key in defaultGoals){
    const val=parseInt(document.getElementById(`goal_${key}`).value);
    goals[key]=isNaN(val)?defaultGoals[key]:val;
  }
  saveGoals(goals);
  updateSummary();
  alert('目標を保存しました');
});
document.getElementById('resetGoals').addEventListener('click',()=>{
  goals=Object.assign({},defaultGoals);
  saveGoals(goals);
  for(const key in defaultGoals){
    const el=document.getElementById(`goal_${key}`);
    if(el) el.value=defaultGoals[key];
  }
  updateSummary();
});

/* ---------------------------
   1週間集計表示・コピー
   --------------------------- */
function generateWeekSummary(){
  const end=new Date();
  const out=[];
  for(let d=0;d<7;d++){
    const dateObj=new Date();
    dateObj.setDate(end.getDate()-d);
    const iso=dateObj.toISOString().slice(0,10);
    const dayLogs=logs.filter(l=>l.date===iso);
    const foodLogs=dayLogs.filter(l=>l.type==='food');
    const activityLogs=dayLogs.filter(l=>l.type==='activity');

    // 重複1日1回でカウント
    const counts={};
    const countedFoods={};
    for(const l of foodLogs){
      if(!countedFoods[l.name]){
        countedFoods[l.name]=true;
        if(l.category){
          for(const c of l.category) counts[c]=(counts[c]||0)+1;
        }
      }
    }

    out.push(`${iso}（朝〜夜）`);

    if(foodLogs.length){
      out.push('  食事：');
      for(const l of foodLogs){
        const lbls=[];
        if(l.category){
          for(const c of l.category){
            const done=counts[c]>=goals[c];
            lbls.push(`${categoryLabels[c]||c}${done?'✅':'⚠️'}`);
          }
        }
        out.push(`    - ${l.time||'?'}：${l.name}${l.amount?'（'+l.amount+'）':''} → ${lbls.join(' / ')||'-'}`);
      }
    } else out.push('  食事：記録なし');

    if(activityLogs.length){
      out.push('  運動：');
      for(const l of activityLogs) out.push(`    - ${l.name}`);
    }

    if(comments[iso]){
      out.push('  コメント：');
      out.push(`    ${comments[iso]}`);
    }

    out.push('');
  }
  return out.join('\n');
}

document.getElementById('showWeekBtn').addEventListener('click',()=>{
  const txt=generateWeekSummary();
  document.getElementById('weekArea').textContent=txt;
});
document.getElementById('copyWeekBtn').addEventListener('click',()=>{
  const txt=document.getElementById('weekArea').textContent||generateWeekSummary();
  if(!txt){ alert('1週間のまとめが空です。まず「1週間集計を表示」を押してください。'); return; }
  navigator.clipboard?.writeText(txt).then(()=>alert('1週間まとめをコピーしました'),()=>alert('コピーに失敗しました'));
});

/* ---------------------------
   CSV出力・全データクリア
   --------------------------- */
document.getElementById('exportCsv').addEventListener('click',()=>{
  const csv=['id,date,time,name,amount,category,type'];
  for(const l of logs){
    csv.push(`${l.id},${l.date},${l.time},${l.name},${l.amount},"${l.category.join(' / ')}",${l.type}`);
  }
  const blob=new Blob([csv.join('\n')],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`meal_logs_${todayISO()}.csv`;
  a.click();
});
document.getElementById('clearAll').addEventListener('click',()=>{
  if(!confirm('本当に全データを削除しますか？')) return;
  localStorage.removeItem(LS_KEY_LOGS);
  localStorage.removeItem(LS_KEY_COMMENTS);
  localStorage.removeItem(LS_KEY_GOALS);
  logs=[];
  comments={};
  goals=Object.assign({},defaultGoals);
  for(const key in defaultGoals){
    const el=document.getElementById(`goal_${key}`);
    if(el) el.value=defaultGoals[key];
  }
  renderToday();
});
