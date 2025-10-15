/* ====================================================
   食事＆活動ログ v7（抽出食材完全版）
   過去日対応・重複カウント・コメント・1週間まとめ
   ご飯・味噌汁は1食ごと、それ以外は1日1回
   ユーザー入力からCSV登録済み食材を抽出してカウント
   ==================================================== */

/* ====================
   基本関数・LocalStorage
   ==================== */
function todayISO() { return new Date().toISOString().slice(0,10); }

const LS_LOGS='meal_logs_v7', LS_COMMENTS='meal_comments_v7', LS_GOALS='meal_goals_v7';

let defaultGoals={ gohan:2, misoshiru:2, gyokai:1, kaiso:1, mame:1, tamago:1, yasai:5, kinoko:1 };
let logs = JSON.parse(localStorage.getItem(LS_LOGS)||'[]');
let comments = JSON.parse(localStorage.getItem(LS_COMMENTS)||'{}');
let goals = JSON.parse(localStorage.getItem(LS_GOALS)||JSON.stringify(defaultGoals));

function saveLogs(){ localStorage.setItem(LS_LOGS, JSON.stringify(logs)); }
function saveComments(){ localStorage.setItem(LS_COMMENTS, JSON.stringify(comments)); }
function saveGoals(){ localStorage.setItem(LS_GOALS, JSON.stringify(goals)); }

/* ====================
   カテゴリ・正規化
   ==================== */
const categoryLabels={ 
  gohan:'ご飯', misoshiru:'味噌汁', gyokai:'魚介', kaiso:'海藻', 
  mame:'豆', tamago:'卵', yasai:'野菜', kinoko:'きのこ' 
};

function normalizeFoodName(name) {
  if (!name) return name;
  let n = name.trim().toLowerCase();

  const map = {
    'ミニトマト': 'トマト',
    'マグロ': 'まぐろ',
    'タラ': 'たら', '鱈': 'たら',
    'タケノコ': 'たけのこ',
    'ナス': 'なす',
    'しいたけ': '椎茸',
    'まいたけ': '舞茸',
    'エリンギ': 'エリンギ',
    '卵': '卵', 'タマゴ': '卵', 'たまご': '卵', '玉子': '卵', 'エッグ': '卵',
    '目玉焼き': '目玉焼き'
  };

  for (const [key, value] of Object.entries(map)) {
    if (n.includes(key)) {
      n = n.replace(new RegExp(key, 'g'), value);
    }
  }

  return n;
}

/* ====================
   CSV読み込み・カテゴリ判定
   ==================== */
let categoryRulesCSV=[];

async function loadCategoryCSV(){
  try{
    const res = await fetch('categories.csv');
    const text = await res.text();
    categoryRulesCSV = text.split('\n').map(l=>l.trim()).filter(l=>l && !l.startsWith('#'))
      .map(l=>{ const [name,cat]=l.split(',').map(s=>s.trim()); return {name,category:cat}; });
  }catch(e){ console.error('CSV読み込み失敗',e); }
}

// CSVに登録された文字列を抽出してカテゴリ判定
function detectCategories(name){
  if(!name) return [];
  const cats = [];
  const items = name.split(/[,、・，]/).map(s=>s.trim()).filter(Boolean);

  for(const item of items){
    const n = normalizeFoodName(item);
    for(const e of categoryRulesCSV){
      if(n.includes(e.name) && e.category && !cats.includes(e.category)){
        cats.push(e.category);
      }
    }
  }
  return cats;
}

/* ====================
   ユーザー入力抽出済み食材保持（累積版）
   ==================== */
let extractedFoodsByDate = {}; // { '2025-10-15': ['ネギ','わかめ','豆腐','ピーマン'] }

function addUserFoodInput(date, userInput){
  const items = userInput.split(/[,、・，]/).map(s=>s.trim()).filter(Boolean);
  const normalized = items.map(i => normalizeFoodName(i));

  if(!extractedFoodsByDate[date]) extractedFoodsByDate[date]=[];
  const extracted = extractedFoodsByDate[date]; // 既存の累積リストを取得

  normalized.forEach(name=>{
    for(const rule of categoryRulesCSV){
      if(name.includes(rule.name) && !extracted.includes(rule.name)){
        extracted.push(rule.name);
      }
    }
  });

  return extracted; // 表示用
}

/* ====================
   重複カウント（抽出食材ベース）
   ==================== */
function countExtractedFoodsPerDay(extractedFoodsArray){
  const counts = {};
  const countedFoodsByCategory = {};

  extractedFoodsArray.forEach(name=>{
    const cats = detectCategories(name);
    cats.forEach(c=>{
      if(c==='gohan'||c==='misoshiru'){
        counts[c] = (counts[c]||0)+1;
        return;
      }
      if(!countedFoodsByCategory[c]) countedFoodsByCategory[c]=new Set();
      if(!countedFoodsByCategory[c].has(name)){
        countedFoodsByCategory[c].add(name);
        counts[c] = (counts[c]||0)+1;
      }
    });
  });

  return counts;
}

/* ====================
   今日/過去日ログ描画
   ==================== */
function renderDateLogs(date){
  const tbody=document.querySelector('#todayTable tbody');
  tbody.innerHTML='';
  const dayLogs=logs.filter(l=>l.date===date);

  dayLogs.forEach(entry=>{
    const tr=document.createElement('tr');
    ['time','name','category','amount'].forEach(f=>{
      const td=document.createElement('td');
      if(f==='category') td.textContent=entry.category && entry.category.length ? entry.category.map(c=>categoryLabels[c]||c).join(' / ') : '-';
      else td.textContent=entry[f]||'';
      tr.appendChild(td);
    });
    // 削除
    const tdOp=document.createElement('td');
    const del=document.createElement('button'); del.textContent='削除'; del.className='delete-btn';
    del.onclick=()=>{ if(!confirm('削除しますか？')) return; logs=logs.filter(x=>x.id!==entry.id); saveLogs(); renderDateLogs(date); updateSummaryFromExtracted(date); };
    tdOp.appendChild(del); tr.appendChild(tdOp);

    tbody.appendChild(tr);
  });

  // 抽出食材表示
  const extractedDiv=document.getElementById('extractedFoodsDisplay');
  if(extractedDiv) extractedDiv.textContent=(extractedFoodsByDate[date]||[]).join('、');

  updateSummaryFromExtracted(date);

  // コメント
  document.getElementById('teacherComment').value=comments[date]||'';
}

/* ====================
   目標サマリー更新（累積食材反映）
   ==================== */
function updateSummaryFromExtracted(date){
  const extracted = extractedFoodsByDate[date] || [];
  const counts = {};
  const countedFoodsByCategory = {};

  // 今日の食事ログを取得
  const dayFoodLogs = logs.filter(l => l.date === date && l.type==='food');

  extracted.forEach(name=>{
    const cats = detectCategories(name);
    cats.forEach(c=>{
      if(c==='gohan' || c==='misoshiru'){
        // ご飯・味噌汁は「食事ログの件数分」カウント
        const logCount = dayFoodLogs.filter(l => l.name.includes(name) && detectCategories(l.name).includes(c)).length;
        counts[c] = (counts[c] || 0) + logCount;
        return;
      }
      // その他は1日1回カウント
      if(!countedFoodsByCategory[c]) countedFoodsByCategory[c] = new Set();
      if(!countedFoodsByCategory[c].has(name)){
        countedFoodsByCategory[c].add(name);
        counts[c] = (counts[c] || 0) + 1;
      }
    });
  });

  // 目標表示
  const ul = document.getElementById('goalList');
  ul.innerHTML='';
  const order=['gohan','misoshiru','gyokai','kaiso','mame','tamago','yasai','kinoko'];

  for(const key of order){
    const li = document.createElement('li');
    const lbl = categoryLabels[key] || key;
    const have = counts[key] || 0;
    const need = goals[key] || '-';
    if(goals[key] !== undefined){
      const done = have >= goals[key];
      li.innerHTML = `<strong>${lbl}</strong>：${have}/${need} ${done?'<span class="achieved">✅':'<span class="remaining">⚠️あと'+(need-have)}</span>`;
    } else li.textContent = `${lbl}：${have}`;
    ul.appendChild(li);
  }
}


/* ====================
   過去日切替
   ==================== */
document.getElementById('dateSelector').addEventListener('change', e=>{
  renderDateLogs(e.target.value);
});

/* ====================
   食事・活動追加
   ==================== */
document.getElementById('addFoodBtn').addEventListener('click', ()=>{
  const date=document.getElementById('dateSelector').value||todayISO();
  const userInput=document.getElementById('foodInput').value.trim();
  if(!userInput){ alert('食材名入力'); return; }

  // 抽出
  const extracted = addUserFoodInput(date,userInput);

  // ログにも保存（表示用）
  const cats = detectCategories(userInput);
  const newEntry={id:Date.now()+Math.random().toString(36).slice(2,6), date, time:document.getElementById('timeSelect').value, name:userInput, amount:document.getElementById('amountInput').value.trim(), category:cats, type:'food'};
  logs.push(newEntry); saveLogs();

  // 表示
  document.getElementById('foodInput').value=''; document.getElementById('amountInput').value='';
  renderDateLogs(date);
});

document.getElementById('addActivityBtn').addEventListener('click', ()=>{
  const date=document.getElementById('dateSelector').value||todayISO();
  const name=document.getElementById('activityInput').value.trim(); if(!name){ alert('活動入力'); return; }
  const newEntry={id:Date.now()+Math.random().toString(36).slice(2,6), date, time:'', name, amount:'', category:[], type:'activity'};
  logs.push(newEntry); saveLogs(); document.getElementById('activityInput').value=''; renderDateLogs(date);
});

/* ====================
   コメント保存・コピー
   ==================== */
document.getElementById('saveCommentBtn').addEventListener('click', ()=>{
  const date=document.getElementById('dateSelector').value||todayISO();
  comments[date]=document.getElementById('teacherComment').value.trim(); saveComments(); alert('保存しました');
});
document.getElementById('copyCommentBtn').addEventListener('click', ()=>navigator.clipboard.writeText(document.getElementById('teacherComment').value).then(()=>alert('コピーしました')));

/* ====================
   目標保存・リセット
   ==================== */
document.getElementById('saveGoals').addEventListener('click', ()=>{
  for(const k in defaultGoals){ const v=parseInt(document.getElementById(`goal_${k}`).value); goals[k]=isNaN(v)?defaultGoals[k]:v; }
  saveGoals(); updateSummaryFromExtracted(document.getElementById('dateSelector').value||todayISO()); alert('目標保存');
});
document.getElementById('resetGoals').addEventListener('click', ()=>{
  goals=Object.assign({},defaultGoals); saveGoals();
  for(const k in defaultGoals){ const el=document.getElementById(`goal_${k}`); if(el) el.value=defaultGoals[k]; }
  updateSummaryFromExtracted(document.getElementById('dateSelector').value||todayISO());
});

/* ====================
   1週間まとめ（HTML表示版）
   ==================== */
function generateWeekSummaryHTML(){
  const end=new Date(); const container=document.createElement('div');
  for(let d=0; d<7; d++){
    const dateObj=new Date(); dateObj.setDate(end.getDate()-d); const iso=dateObj.toISOString().slice(0,10);
    const dayLogs=logs.filter(l=>l.date===iso); const foodLogs=dayLogs.filter(l=>l.type==='food'); const activityLogs=dayLogs.filter(l=>l.type==='activity');
    const counts=countExtractedFoodsPerDay(extractedFoodsByDate[iso]||[]);

    const dayDiv=document.createElement('div'); dayDiv.className='week-day-block'; dayDiv.style.marginBottom='16px';
    const h3=document.createElement('h3'); h3.textContent=iso; dayDiv.appendChild(h3);

    if(foodLogs.length){
      const table=document.createElement('table'); table.className='week-summary-table'; table.style.width='100%'; table.style.borderCollapse='collapse';
      table.innerHTML=`<thead><tr><th>時間</th><th>食材</th><th>カテゴリ</th><th>量 / 備考</th></tr></thead><tbody></tbody>`;
      const tbody=table.querySelector('tbody');
      foodLogs.forEach(l=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`<td>${l.time||''}</td><td>${l.name}</td><td>${l.category.length?l.category.map(c=>categoryLabels[c]||c).join(' / '):'-'}</td><td>${l.amount||''}</td>`;
        tbody.appendChild(tr);
      });
      dayDiv.appendChild(table);
    }else{ const p=document.createElement('p'); p.textContent='食事：記録なし'; dayDiv.appendChild(p); }

    if(activityLogs.length){ const act=document.createElement('div'); act.style.marginTop='6px'; act.innerHTML='<strong>運動：</strong> '+activityLogs.map(a=>a.name).join(' / '); dayDiv.appendChild(act); }
    if(comments[iso]){ const com=document.createElement('div'); com.style.marginTop='6px'; com.style.background='#fff8cc'; com.style.padding='6px'; com.style.borderRadius='4px'; com.style.fontSize='0.95rem'; com.innerHTML='<strong>コメント：</strong> '+comments[iso]; dayDiv.appendChild(com); }

    container.appendChild(dayDiv);
  }
  return container;
}
document.getElementById('showWeekBtn').addEventListener('click', ()=>{
  const weekArea=document.getElementById('weekArea'); weekArea.innerHTML=''; weekArea.appendChild(generateWeekSummaryHTML());
});
document.getElementById('copyWeekBtn').addEventListener('click', ()=>{
  const txt=document.getElementById('weekArea').textContent||generateWeekSummaryHTML().textContent;
  if(!txt){ alert('1週間まとめが空です'); return; }
  navigator.clipboard?.writeText(txt).then(()=>alert('コピーしました'));
});

/* ====================
   CSV出力・全データクリア
   ==================== */
document.getElementById('exportCsv').addEventListener('click', ()=>{
  const csv=['id,date,time,name,amount,category,type'];
  logs.forEach(l=>csv.push(`${l.id},${l.date},${l.time},${l.name},${l.amount},"${l.category.join(' / ')}",${l.type}`));
  const blob=new Blob([csv.join('\n')],{type:'text/csv'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='meal_logs.csv'; a.click();
});
document.getElementById('clearAll').addEventListener('click', ()=>{
  if(!confirm('全データ削除しますか？')) return;
  logs=[]; comments={}; goals=Object.assign({},defaultGoals); extractedFoodsByDate={};
  saveLogs(); saveComments(); saveGoals();
  renderDateLogs(document.getElementById('dateSelector').value||todayISO()); alert('全データ削除しました');
});

/* ====================
   初期描画
   ==================== */
loadCategoryCSV().then(()=>{
  const sel=document.getElementById('dateSelector'); sel.value=todayISO();
  renderDateLogs(todayISO());
  // 目標フォーム初期反映
  for(const k in defaultGoals){ const el=document.getElementById(`goal_${k}`); if(el) el.value=goals[k]; }
});
