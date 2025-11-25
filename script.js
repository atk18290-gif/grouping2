let nextRowId = 2;
let teamsGlobal = [];
let dragSrcEl = null;

function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/[&<>"']/g,c=>(
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

function addGroupInput(prefName='', prefSize=''){
  const area = document.getElementById('groupInputsArea');
  const row = document.createElement('div');
  row.className='group-row';
  row.id=`group-row-${nextRowId}`;
  row.innerHTML=`
    <input id="name-${nextRowId}" type="text" placeholder="グループ名（空可）" value="${escapeHtml(prefName)}" />
    <input id="size-${nextRowId}" type="number" min="1" placeholder="人数（空は1）" style="width:110px" value="${escapeHtml(prefSize)}" />
    <button class="btn" onclick="removeGroupInput(${nextRowId})">削除</button>
  `;
  area.appendChild(row);
  nextRowId++;
}

function removeGroupInput(id){
  const el=document.getElementById(`group-row-${id}`);
  if(el) el.remove();
}

function clearInputs(){
  const area=document.getElementById('groupInputsArea');
  area.innerHTML=`
    <div class="group-row" id="group-row-1">
      <input id="name-1" type="text" placeholder="グループ名（空可）" />
      <input id="size-1" type="number" min="1" placeholder="人数（空は1）" style="width:110px" />
      <button class="btn btn-add" onclick="addGroupInput()">＋ 追加行</button>
    </div>
  `;
  nextRowId=2;
  document.getElementById('results').innerHTML='';
}

/* ============================================
   チーム分けロジック
============================================ */
function createTeams(){
  const teamCount = Math.max(1, parseInt(document.getElementById('teamCount').value)||1);
  const colsCount = Math.max(1, parseInt(document.getElementById('columnsCount').value)||3);
  const rows = document.querySelectorAll('[id^="group-row-"]');

  const groups = [];
  for(const row of rows){
    const id=row.id.split('-').pop();
    const nameEl=document.getElementById(`name-${id}`);
    const sizeEl=document.getElementById(`size-${id}`);
    if(!nameEl||!sizeEl) continue;
    const name=(nameEl.value||'').trim()||`グループ${id}`;
    const size=Math.max(1,parseInt(sizeEl.value)||1);
    groups.push({name,size});
  }

  if(groups.length===0){ alert('グループを1つ以上追加してください'); return; }

  const totalPeople = groups.reduce((s,g)=>s+g.size,0);
  const averageB = Math.floor(totalPeople/groups.length);

  const divided=[];
  for(const g of groups){

    /* ------------------------------
       ★ 3人以下は絶対に分割しない
    ------------------------------ */
    if(g.size <= 3){
      divided.push({name:g.name, base:g.name, size:g.size, isSplit:false});
      continue;
    }

    // ★ ここで “分割した事実” を保存するため isSplit:true を付ける

    if(g.size <= averageB/4){
      divided.push({name:g.name, base:g.name, size:g.size, isSplit:false});

    } else if(g.size <= averageB){
      const half=Math.floor(g.size/2);
      divided.push({name:g.name + "A", base:g.name, size:half, isSplit:true});
      divided.push({name:g.name + "B", base:g.name, size:g.size-half, isSplit:true});

    } else {
      const base=Math.floor(g.size/4);
      let remainder=g.size-base*4;
      for(let i=0;i<4;i++){
        const part=base+(remainder>0?1:0);
        remainder=Math.max(0,remainder-1);
        if(part>0){
          divided.push({
            name:g.name + String.fromCharCode(65+i),
            base:g.name,
            size:part,
            isSplit:true
          });
        }
      }
    }
  }

  /* --------------------------
     チーム構築
  --------------------------- */
  let teams=Array.from({length:teamCount}, (_,i)=>({
    id:i,
    name:`チーム${i+1}`,
    members:[],
    total:0
  }));

  // 大きい順で割り当て
  divided.sort((a,b)=>b.size-b.size);

  for(const piece of divided){
    teams.sort((a,b)=>a.total-b.total);
    teams[0].members.push(piece);
    teams[0].total += piece.size;
  }

  /* ----------------------------------------
     ★ 同じ base のものを「統合するが」
       → ここで再分割しないようにする
  ---------------------------------------- */
  for(const t of teams){
    const merged = {};
    for(const m of t.members){
      if(!merged[m.base]){
        merged[m.base] = {name:m.base, size:0, wasSplit:m.isSplit};
      }
      merged[m.base].size += m.size;
    }

    // 統合された後も “分割済み” は保持
    t.members = Object.values(merged);
    t.total = t.members.reduce((s,m)=>s+m.size,0);
  }

  teamsGlobal = teams;
  renderTeams(colsCount);
}


/* ---------------------------------------------------------
   結果表示・ドラッグ移動・編集
---------------------------------------------------------- */
function renderTeams(colsCount){
  const container=document.getElementById('results');
  container.innerHTML='';
  container.style.gridTemplateColumns=`repeat(${colsCount},1fr)`;
  teamsGlobal.sort((a,b)=>a.id-b.id);

  teamsGlobal.forEach((team,idx)=>{
    const card=document.createElement('div');
    card.className='team-card';
    card.setAttribute('draggable','true');
    card.dataset.index=idx;

    // タイトル
    const title=document.createElement('div');
    title.className='team-title';
    title.textContent=`${team.name}（${team.total}人）`;
    title.contentEditable='true';

    // メンバー一覧
    const membersDiv=document.createElement('div');
    membersDiv.className='members';

    team.members.forEach((m)=>{
      const div=document.createElement('div');
      div.contentEditable='true';
      div.innerText=`${m.name}：${m.size}人`;

      div.addEventListener('input',()=>{
        const parts=div.innerText.split('：');
        if(parts.length>=2){
          m.name=parts[0].trim();
          m.size=parseInt(parts[1])||1;
          team.total=team.members.reduce((s,m)=>s+m.size,0);
          title.textContent=`${team.name}（${team.total}人）`;
        }
      });

      membersDiv.appendChild(div);
    });

    title.addEventListener('input',()=>{
      team.name = title.innerText.replace(/（\d+人）$/,'').trim();
      title.textContent=`${team.name}（${team.total}人）`;
    });

    // ドラッグ
    card.addEventListener('dragstart',e=>{
      dragSrcEl=card;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed='move';
    });
    card.addEventListener('dragend',()=>{
      card.classList.remove('dragging');
    });
    card.addEventListener('dragover',e=>{
      e.preventDefault();
      e.dataTransfer.dropEffect='move';
    });
    card.addEventListener('drop',e=>{
      e.preventDefault();
      if(dragSrcEl!==card){
        const parent=card.parentNode;
        const srcIndex=[...parent.children].indexOf(dragSrcEl);
        const tgtIndex=[...parent.children].indexOf(card);
        if(srcIndex<tgtIndex) parent.insertBefore(dragSrcEl, card.nextSibling);
        else parent.insertBefore(dragSrcEl, card);
      }
    });

    card.appendChild(title);
    card.appendChild(membersDiv);
    container.appendChild(card);
  });
}
