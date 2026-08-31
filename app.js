(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const uid = (p='id') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const todayISO = () => new Date().toISOString().slice(0,10);
  const fmtDate = s => s ? new Date(`${s}T00:00:00`).toLocaleDateString('ja-JP',{year:'numeric',month:'long',day:'numeric'}) : '';
  const store = {
    get(k, fallback){ try { const v=localStorage.getItem(`pathia_${k}`); return v?JSON.parse(v):fallback; } catch { return fallback; } },
    set(k,v){ localStorage.setItem(`pathia_${k}`, JSON.stringify(v)); }
  };

  const ACCOUNTS = {
    office:{id:'office',label:'事務局管理者',role:'office',name:'山村 亜理沙',department:'経営企画室',ward:'',email:'pathia-office@example.local',permission:'管理者'},
    ward5:{id:'ward5',label:'5階病棟パス係',role:'ward',name:'5階病棟 担当者',department:'看護部',ward:'5階病棟',email:'ward5@example.local',permission:'病棟パス係'},
    ward6:{id:'ward6',label:'6階病棟パス係',role:'ward',name:'6階病棟 担当者',department:'看護部',ward:'6階病棟',email:'ward6@example.local',permission:'病棟パス係'},
    surgery:{id:'surgery',label:'外科パス責任者',role:'doctor',name:'外科 パス責任医師',department:'外科',ward:'',email:'surgery-path@example.local',permission:'パス責任者'},
    committee:{id:'committee',label:'委員会構成員',role:'committee',name:'クリニカルパス委員',department:'診療部',ward:'',email:'committee@example.local',permission:'委員会構成員'},
    viewer:{id:'viewer',label:'閲覧者',role:'viewer',name:'閲覧ユーザー',department:'院内',ward:'',email:'viewer@example.local',permission:'閲覧のみ'}
  };

  const WARDS = ['5階病棟','6階病棟','7階病棟','ICU'];
  const PATHS = {
    '5階病棟':[
      {name:'肝切除術パス',dept:'外科'},{name:'鼠径ヘルニアパス',dept:'外科'},{name:'胃切除術パス',dept:'外科'},{name:'胆嚢摘出術パス',dept:'外科'}
    ],
    '6階病棟':[
      {name:'結腸切除術パス',dept:'外科'},{name:'直腸切除術パス',dept:'外科'},{name:'乳房切除術パス',dept:'外科'},{name:'虫垂切除術パス',dept:'外科'}
    ],
    '7階病棟':[
      {name:'人工膝関節置換術パス',dept:'整形外科'},{name:'腰椎固定術パス',dept:'整形外科'},{name:'腹腔鏡下子宮全摘術パス',dept:'婦人科'}
    ],
    'ICU':[
      {name:'人工呼吸器離脱支援パス',dept:'集中治療科'},{name:'心臓カテーテル術後パス',dept:'循環器内科'}
    ]
  };
  const VARIANCE_TYPES = ['入院期間延長','予定より早期退院','検査変更','薬剤変更','処置変更','手術・治療変更','患者要因','合併症','その他'];
  const EVENT_TYPES = {meeting:'会議',training:'研修',conference:'学会',deadline:'集計締切',other:'その他'};
  const ANALYSIS_PERIODS = {
    '2026-05': {
      label:'令和8年5月',
      wards:{
        '3東':{used:34,discharged:80,rate:43,prev:54},'3南':{used:2,discharged:28,rate:7,prev:22},'ICU':{used:3,discharged:3,rate:100,prev:0},
        '4階':{used:52,discharged:104,rate:50,prev:50},'4東':{used:30,discharged:65,rate:46,prev:52},'5東':{used:8,discharged:79,rate:10,prev:8},
        '5西':{used:16,discharged:81,rate:20,prev:35},'5南':{used:16,discharged:62,rate:26,prev:28},'病棟全体':{used:161,discharged:502,rate:32,prev:39},
        '手術':{used:126,discharged:null,rate:null,prev:null},'外来':{used:21,discharged:null,rate:null,prev:null},'全体':{used:308,discharged:502,rate:61,prev:64}
      },
      depts:{
        '内科':{used:1,discharged:40,rate:3,prev:11},'呼吸器内科':{used:10,discharged:33,rate:30,prev:20},'消化器内科':{used:4,discharged:83,rate:5,prev:0},
        '循環器内科':{used:21,discharged:38,rate:55,prev:46},'糖尿病内科':{used:3,discharged:6,rate:50,prev:null},'小児科':{used:9,discharged:35,rate:26,prev:20},
        '外科':{used:58,discharged:52,rate:112,prev:89},'乳腺外科':{used:0,discharged:2,rate:0,prev:0},'整形外科':{used:65,discharged:107,rate:61,prev:72},
        '形成外科':{used:0,discharged:11,rate:0,prev:null},'脳神経外科':{used:0,discharged:11,rate:0,prev:0},'皮膚科':{used:14,discharged:5,rate:280,prev:50},
        '泌尿器科':{used:4,discharged:4,rate:100,prev:68},'産科':{used:11,discharged:17,rate:65,prev:79},'婦人科':{used:53,discharged:30,rate:177,prev:160},
        '眼科':{used:51,discharged:27,rate:189,prev:280},'耳鼻いんこう科':{used:1,discharged:1,rate:100,prev:null},'リハビリ':{used:0,discharged:0,rate:null,prev:null},
        '放射線科':{used:3,discharged:0,rate:null,prev:null},'全体':{used:308,discharged:502,rate:61,prev:64}
      }
    },
    '2026-05-cum': {
      label:'令和8年度累計（5月迄）',
      wards:{
        '3東':{used:79,discharged:164,rate:48,prev:54},'3南':{used:7,discharged:61,rate:11,prev:20},'ICU':{used:9,discharged:5,rate:180,prev:0},
        '4階':{used:122,discharged:228,rate:54,prev:56},'4東':{used:56,discharged:127,rate:44,prev:53},'5東':{used:17,discharged:162,rate:10,prev:6},
        '5西':{used:38,discharged:152,rate:25,prev:36},'5南':{used:46,discharged:141,rate:33,prev:31},'病棟全体':{used:374,discharged:1040,rate:36,prev:40},
        '手術':{used:226,discharged:null,rate:null,prev:null},'外来':{used:43,discharged:null,rate:null,prev:null},'全体':{used:643,discharged:1040,rate:61,prev:64}
      },
      depts:{
        '内科':{used:2,discharged:80,rate:3,prev:6},'呼吸器内科':{used:13,discharged:62,rate:21,prev:23},'消化器内科':{used:11,discharged:174,rate:6,prev:1},
        '循環器内科':{used:55,discharged:99,rate:56,prev:51},'糖尿病内科':{used:6,discharged:9,rate:67,prev:null},'小児科':{used:25,discharged:78,rate:32,prev:15},
        '外科':{used:115,discharged:101,rate:114,prev:85},'乳腺外科':{used:0,discharged:5,rate:0,prev:0},'整形外科':{used:118,discharged:205,rate:58,prev:74},
        '形成外科':{used:0,discharged:23,rate:0,prev:0},'脳神経外科':{used:2,discharged:24,rate:8,prev:17},'皮膚科':{used:27,discharged:9,rate:300,prev:56},
        '泌尿器科':{used:17,discharged:14,rate:121,prev:78},'産科':{used:26,discharged:35,rate:74,prev:88},'婦人科':{used:115,discharged:68,rate:169,prev:166},
        '眼科':{used:104,discharged:51,rate:204,prev:262},'耳鼻いんこう科':{used:2,discharged:3,rate:67,prev:null},'リハビリ':{used:0,discharged:0,rate:null,prev:null},
        '放射線科':{used:5,discharged:0,rate:null,prev:null},'全体':{used:643,discharged:1040,rate:61,prev:64}
      }
    }
  };
  const MONTHLY_TRENDS = {r8:{'4月':62,'5月':61},r7:{'4月':63,'5月':63,'6月':55,'7月':54,'8月':51,'9月':51,'10月':58,'11月':52,'12月':40,'1月':54,'2月':64,'3月':65}};
  const VARIANCE_RECORDS = [
    {no:'CP000838',dept:'外科',path:'腹腔鏡下虫垂切除術（2022/02/01）',ward:'3東',month:'5月',day:'1日目',code:'A-1-a',content:'ドレーン留置のため'},
    {no:'CP000979',dept:'産科',path:'○120正常分娩',ward:'4階',month:'5月',day:'5日目',code:'A-3',content:'児が搬送になり1日早く退院'},
    {no:'CP000979',dept:'産科',path:'○120正常分娩',ward:'4階',month:'5月',day:'6日目',code:'A-3',content:'児の体重増加待ちで1日退院延期'},
    {no:'CP000882',dept:'産婦人科',path:'○TC療法2泊3日',ward:'4階',month:'5月',day:'3日目',code:'A-1-a',content:'CARTのため退院延期'},
    {no:'CP001029',dept:'整形外科',path:'【R5】頚椎手術',ward:'4東',month:'5月',day:'13日目',code:'A-2-C',content:'早期退院'},
    {no:'CP001029',dept:'整形外科',path:'【R5】頚椎手術',ward:'4東',month:'5月',day:'18日目',code:'C1',content:'転院調整'},
    {no:'CP001038',dept:'整形外科',path:'【R5】腰椎手術',ward:'4東',month:'5月',day:'6日目',code:'A-1-a',content:'硬膜損傷'},
    {no:'CP001038',dept:'整形外科',path:'【R5】腰椎手術',ward:'4東',month:'5月',day:'9日目',code:'A-1-a',content:'リオペ'},
    {no:'CP001038',dept:'整形外科',path:'【R5】腰椎手術',ward:'4東',month:'5月',day:'18日目',code:'C-1',content:'転院調整'},
    {no:'CP000865',dept:'皮膚科',path:'115帯状疱疹',ward:'5西',month:'5月',day:'8日目',code:'A-1-a',content:'治療継続のため'},
    {no:'CP001108',dept:'循環器内科',path:'経皮的冠動脈インターベンション（PCI3泊4日）★2025年改訂版',ward:'ICU・CCU',month:'5月',day:'2日目',code:'A-1-a',content:'IABP挿入、治療継続のため'},
    {no:'CP001122',dept:'循環器内科',path:'★AMI急性心臓リハビリテーションプログラム（10.13日間コース）',ward:'ICU・CCU',month:'5月',day:'18日目',code:'A-1-a',content:'退院日が予定より遅延　原疾患治療継続'},
    {no:'CP001124',dept:'産科',path:'予定帝王切開術（GBS陰性破水なし）',ward:'4階',month:'5月',day:'8日目',code:'A-3',content:'児の体重増加待ちで退院延期'},
    {no:'CP001127',dept:'産科',path:'緊急帝王切開術（GBS陰性破水なし）',ward:'4階',month:'5月',day:'8日目',code:'A-3',content:'児の体重増加待ちで退院延期'}
  ];

  const MENU = [
    ['home','🏠','ホーム',['office','ward','doctor','committee','viewer']],
    ['monthly','📝','月次実績登録',['office','ward']],
    ['officeMonthly','📋','月次実績管理',['office']],
    ['analysis','📊','分析',['office','ward','doctor','committee','viewer']],
    ['paths','📚','院内パス',['office','doctor','committee','viewer']],
    ['ai','✨','AI改善提案',['office','doctor','committee']],
    ['knowledge','🧠','院内知識',['office','doctor','committee']],
    ['committee','🏥','パス委員会',['office','doctor','committee']],
    ['schedule','📅','スケジュール',['office','ward','doctor','committee','viewer']],
    ['reports','📄','レポート',['office','doctor','committee','viewer']],
    ['import','📥','データ取込',['office']],
    ['admin','⚙️','管理',['office']]
  ];

  let currentUser = null;
  let route = 'home';
  let monthlyContext = {month:'2026-08', ward:'5階病棟'};
  let calCursor = new Date(2026,8,1);

  function seed(){
    if(store.get('seeded', false)) return;
    const members = Object.values(ACCOUNTS).map(a=>({...a,active:true,title:a.role==='doctor'?'医長':a.role==='office'?'係長':'担当'}));
    store.set('members', members);
    store.set('publishedMonth','2026-07');
    store.set('notifications',[
      {id:uid('n'),title:'Pathia v0.1へようこそ',body:'この版は試作です。実患者情報は入力しないでください。',at:new Date().toISOString(),read:false}
    ]);
    store.set('events',[
      {id:'e1',title:'クリニカルパス委員会',date:'2026-09-10',start:'15:00',end:'16:00',type:'meeting',place:'大会議室',notify:'committee',agenda:'外科パス分析結果／前回決定事項の進捗／新規検討事項',status:'予定'},
      {id:'e2',title:'8月実績入力締切',date:'2026-09-05',start:'',end:'',type:'deadline',place:'',notify:'ward',agenda:'8月分クリニカルパス実績を確定',status:'予定'},
      {id:'e3',title:'クリニカルパス研修',date:'2026-09-18',start:'14:00',end:'15:30',type:'training',place:'研修室',notify:'all',agenda:'クリニカルパス基礎・バリアンスの考え方',status:'予定'}
    ]);
    store.set('knowledge',[
      {id:'k1',date:'2026-07-12',path:'肝切除術パス',topic:'術後薬剤',source:'外科責任医師',type:'専門家意見',decision:'A薬剤を標準として継続',reason:'B薬剤では抗体保有例が多く、対象患者群ではA薬剤を優先する。',status:'有効'}
    ]);
    store.set('committeeMeetings',[
      {id:'CP202607',date:'2026-07-12',title:'令和8年度 第2回クリニカルパス委員会',agenda:'外科パス見直し／月次実績／薬剤提案',decisions:3,status:'開催済'},
      {id:'CP202609',date:'2026-09-10',title:'令和8年度 第3回クリニカルパス委員会',agenda:'外科試作分析／前回決定事項／今後のPathia運用',decisions:0,status:'予定'}
    ]);
    // demonstration records: one confirmed, one draft, two unstarted
    store.set(monthKey('2026-08','6階病棟'), sampleMonthly('2026-08','6階病棟','confirmed'));
    store.set(monthKey('2026-08','5階病棟'), sampleMonthly('2026-08','5階病棟','draft'));
    store.set('seeded', true);
  }
  function monthKey(month,ward){ return `monthly_${month}_${ward}`; }
  function sampleMonthly(month,ward,status='draft'){
    const rows = PATHS[ward].map((p,i)=>({path:p.name,dept:p.dept,cases:i===0?15:(i===1?10:8+i),variance:i===0?3:(i===1?0:1),patients:i===0?[{id:'DEMO-001',type:'入院期間延長'},{id:'DEMO-002',type:'薬剤変更'},{id:'DEMO-003',type:'患者要因'}]:(i===1?[]:[{id:`DEMO-00${i+3}`,type:'その他'}])}));
    return {month,ward,status,rows,lastSaved:new Date().toISOString(),confirmedAt:status==='confirmed'?new Date().toISOString():null,confirmedBy:status==='confirmed'?'6階病棟 担当者':null};
  }

  function login(){
    const id=$('#loginId').value, pw=$('#loginPassword').value;
    if(!ACCOUNTS[id] || pw!=='pathia0'){ alert('IDまたはパスワードが違います。'); return; }
    const savedMembers=store.get('members',[]); const saved=savedMembers.find(m=>m.id===id);
    currentUser = {...ACCOUNTS[id],...(saved||{})};
    store.set('session',id);
    $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    monthlyContext.ward=currentUser.ward||'5階病棟';
    buildNav(); renderUser(); navigate('home');
  }
  function restore(){
    seed();
    const id=store.get('session',null);
    if(id&&ACCOUNTS[id]){ $('#loginId').value=id; $('#loginPassword').value='pathia0'; login(); }
  }
  function logout(){ store.set('session',null); currentUser=null; $('#appView').classList.add('hidden'); $('#loginView').classList.remove('hidden'); }

  function buildNav(){
    const nav=$('#nav'); nav.innerHTML='';
    MENU.filter(m=>m[3].includes(currentUser.role)).forEach(([r,icon,label])=>{
      const b=document.createElement('button'); b.className='nav-link'; b.dataset.route=r; b.innerHTML=`<span>${icon}</span>${label}`; b.onclick=()=>navigate(r); nav.appendChild(b);
    });
  }
  function renderUser(){
    $('#userMini').innerHTML=`<strong>${esc(currentUser.label)}</strong><div>${esc(currentUser.name)}</div><div class="muted">${esc(currentUser.department)}${currentUser.ward?'／'+esc(currentUser.ward):''}</div>`;
    $('#profileBtn').textContent=`${currentUser.name} ▾`;
    updateNotificationCount();
  }
  function navigate(r){
    route=r; $$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.route===r));
    const m=MENU.find(x=>x[0]===r); $('#pageTitle').textContent=m?m[2]:(r==='help'?'使い方':'Pathia'); $('#pageEyebrow').textContent='Pathia v0.1';
    const renderers={home:renderHome,monthly:renderMonthly,officeMonthly:renderOfficeMonthly,analysis:renderAnalysis,paths:renderPaths,ai:renderAI,knowledge:renderKnowledge,committee:renderCommittee,schedule:renderSchedule,reports:renderReports,import:renderImport,admin:renderAdmin,help:renderHelp};
    (renderers[r]||renderHome)(); window.scrollTo({top:0,behavior:'smooth'});
  }
  function setContent(html){ $('#content').innerHTML=html; }
  function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.remove('hidden'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.add('hidden'),2800); }
  function notify(title,body,target='self'){
    const ns=store.get('notifications',[]); ns.unshift({id:uid('n'),title,body,target,at:new Date().toISOString(),read:false}); store.set('notifications',ns); updateNotificationCount(); toast(title);
  }
  function updateNotificationCount(){ const ns=store.get('notifications',[]); const n=ns.filter(x=>!x.read).length; $('#notificationCount').textContent=n; $('#notificationCount').classList.toggle('hidden',n===0); }
  function showNotifications(){
    $('.notification-panel')?.remove(); const ns=store.get('notifications',[]);
    const p=document.createElement('div'); p.className='notification-panel'; p.innerHTML=`<div class="toolbar"><h4>通知</h4><button class="btn sm outline" id="markAllRead">すべて既読</button></div>${ns.length?ns.slice(0,20).map(n=>`<div class="notification-item"><strong>${esc(n.title)}</strong>${esc(n.body)}<div class="muted small">${new Date(n.at).toLocaleString('ja-JP')}</div></div>`).join(''):'<p class="muted">通知はありません。</p>'}`; document.body.appendChild(p);
    $('#markAllRead').onclick=()=>{store.set('notifications',ns.map(x=>({...x,read:true})));updateNotificationCount();p.remove();};
    setTimeout(()=>document.addEventListener('click',function close(e){if(!p.contains(e.target)&&e.target!==$('#notificationBtn')){p.remove();document.removeEventListener('click',close)}}, {once:false}),0);
  }

  function renderHome(){
    const pub=store.get('publishedMonth','2026-07');
    const stats={paths:128,cases:1256,variance:12.4,ai:86};
    const myTask = currentUser.role==='ward' ? `<div class="notice ${getMonthlyStatus('2026-08',currentUser.ward)==='confirmed'?'success':'warning'}"><strong>${esc(currentUser.ward)}：8月実績</strong><br>${statusText(getMonthlyStatus('2026-08',currentUser.ward))}　締切：2026/09/05 <button class="btn sm primary" onclick="Pathia.go('monthly')">入力画面へ</button></div>` : currentUser.role==='office' ? `<div class="notice warning"><strong>事務局：8月実績回収状況</strong><br>${countStatuses('2026-08').confirmed}/${WARDS.length}部署 確定済　<button class="btn sm primary" onclick="Pathia.go('officeMonthly')">進捗を見る</button></div>` : '';
    setContent(`
      <div class="hero">
        <div><span class="pill blue">VERSION 0</span><h3>ようこそ、Pathiaへ</h3><p>院内クリニカルパスの実績、分析、委員会の判断、改訂履歴をつなぎ、よりよいパス運用を支援します。</p>${myTask}<div class="notice danger" style="margin-top:12px"><strong>試作環境</strong>：実患者情報は入力しないでください。画面上の患者IDは架空データのみ使用してください。</div></div>
        <div class="hero-bear"><img src="pathia-bear.png" alt="パシくま"></div>
      </div>
      <div class="section-title"><h3>院内ダッシュボード</h3><span class="pill green">公開実績：${esc(pub)}</span></div>
      <div class="grid cards4">
        <div class="stat blue"><div class="label">登録パス数</div><div class="value">${stats.paths}<small> 件</small></div></div>
        <div class="stat mint"><div class="label">パス適用件数</div><div class="value">${stats.cases.toLocaleString()}<small> 件</small></div></div>
        <div class="stat cream"><div class="label">バリアンス発生率</div><div class="value">${stats.variance}<small> %</small></div></div>
        <div class="stat lav"><div class="label">AI分析・相談件数</div><div class="value">${stats.ai}<small> 件</small></div></div>
      </div>
      <div class="section-title"><h3>クイックメニュー</h3></div>
      <div class="quick">
        ${currentUser.role==='ward'?quick('📝','月次実績を登録','病棟の入力を保存・確定します','monthly'):quick('📊','パス分析','外科の試作分析を確認します','analysis')}
        ${quick('🏥','パス委員会','会議資料・議事録・決定事項','committee')}
        ${quick('📅','スケジュール','会議・研修・締切を管理','schedule')}
        ${quick('📘','使い方を見る','権限別ガイドと用語説明','help')}
      </div>
      <div class="grid cards2" style="margin-top:18px">
        <div class="card"><div class="section-title" style="margin-top:0"><h3>近日の予定</h3><button class="btn sm outline" onclick="Pathia.go('schedule')">カレンダー</button></div>${eventList(3)}</div>
        <div class="card"><div class="section-title" style="margin-top:0"><h3>Pathiaからの気づき</h3><span class="pill blue">AI</span></div><div class="ai-box"><h4>外科：見直し候補があります</h4><p>肝切除術パスでは、過去の責任医師判断として「A薬剤を標準として継続」が登録されています。新しい提案時にはこの院内知識を優先して参照します。</p><button class="btn sm mint" onclick="Pathia.go('ai')">改善提案を見る</button></div></div>
      </div>
    `);
  }
  function quick(icon,title,sub,r){return `<button onclick="Pathia.go('${r}')"><span class="icon">${icon}</span><strong>${title}</strong><small>${sub}</small></button>`}
  function eventList(n=4){ return store.get('events',[]).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,n).map(e=>`<div class="list-row"><div><div class="maintext">${esc(e.title)}</div><div class="subtext">${fmtDate(e.date)} ${esc(e.start||'終日')} ${esc(e.place||'')}</div></div><span class="pill ${e.type==='deadline'?'red':e.type==='meeting'?'blue':e.type==='training'?'green':'yellow'}">${EVENT_TYPES[e.type]}</span></div>`).join(''); }

  function getMonthlyStatus(month,ward){ const r=store.get(monthKey(month,ward),null); return r?.status||'unstarted'; }
  function statusText(s){ return ({confirmed:'確定済',draft:'入力途中',unstarted:'未入力'})[s]||s; }
  function statusPill(s){ return `<span class="pill ${s==='confirmed'?'green':s==='draft'?'yellow':'red'}">${statusText(s)}</span>`; }
  function countStatuses(month){ const arr=WARDS.map(w=>getMonthlyStatus(month,w)); return {confirmed:arr.filter(x=>x==='confirmed').length,draft:arr.filter(x=>x==='draft').length,unstarted:arr.filter(x=>x==='unstarted').length}; }

  function renderMonthly(){
    monthlyContext.ward = currentUser.role==='ward' ? (monthlyContext.ward||currentUser.ward) : monthlyContext.ward;
    const rec=store.get(monthKey(monthlyContext.month,monthlyContext.ward),null) || {month:monthlyContext.month,ward:monthlyContext.ward,status:'unstarted',rows:PATHS[monthlyContext.ward].map(p=>({path:p.name,dept:p.dept,cases:'',variance:'',patients:[]}))};
    setContent(`
      <div class="notice warning"><strong>試作版</strong>：患者IDは架空IDのみ入力してください。本番版では認証・DB・監査ログを実装します。</div>
      <div class="toolbar">
        <div class="left input-inline"><label style="margin:0">実績月 <input id="monthlyMonth" type="month" value="${esc(monthlyContext.month)}"></label><label style="margin:0">病棟 <select id="monthlyWard">${WARDS.map(w=>`<option ${w===monthlyContext.ward?'selected':''}>${w}</option>`).join('')}</select></label></div>
        <div class="right">${statusPill(rec.status)}<span class="muted small">診療科はパスマスタから自動表示</span></div>
      </div>
      <div id="pathsForm"></div>
      <div class="statusbar">
        <div><strong>${esc(monthlyContext.month)}／${esc(monthlyContext.ward)}</strong><div class="muted small">保存は途中状態、確定で事務局へ連携します。</div></div>
        <div class="actions"><button class="btn outline" id="saveDraft">保存</button><button class="btn cream" id="saveLater">後で登録</button><button class="btn secondary" id="nextBtn">次へ</button><button class="btn primary" id="confirmMonthly">確定する</button></div>
      </div>
    `);
    renderPathForm(rec);
    $('#monthlyMonth').onchange=e=>{monthlyContext.month=e.target.value;renderMonthly()};
    $('#monthlyWard').onchange=e=>{monthlyContext.ward=e.target.value;renderMonthly()};
    $('#saveDraft').onclick=()=>saveMonthly('draft',false);
    $('#saveLater').onclick=()=>{saveMonthly('draft',false);toast('途中保存しました。後で再開できます。');navigate('home')};
    $('#nextBtn').onclick=()=>handleNext();
    $('#confirmMonthly').onclick=()=>confirmMonthly();
  }
  function renderPathForm(rec){
    const root=$('#pathsForm'); root.innerHTML='';
    const locked=rec.status==='confirmed' && currentUser.role!=='office';
    rec.rows.forEach((row,idx)=>{
      const c=document.createElement('div'); c.className='path-card'; c.dataset.idx=idx;
      c.innerHTML=`<div class="path-head"><div><h4>${esc(row.path)}</h4><span class="muted small">診療科：${esc(row.dept)}</span></div><span class="pill ${Number(row.variance)>0?'yellow':'green'}">${row.variance===''?'未入力':`バリアンス ${row.variance}件`}</span></div>
        <div class="path-body"><div class="path-fields"><label>実施件数<input class="cases" type="number" min="0" value="${esc(row.cases)}" ${locked?'disabled':''}></label><label>うちバリアンス発生件数<input class="variance" type="number" min="0" value="${esc(row.variance)}" ${locked?'disabled':''}></label></div><div class="variance-list"></div></div>`;
      root.appendChild(c); renderVarianceRows(c,row,locked);
      $('.variance',c).oninput=e=>{ const n=Math.max(0,parseInt(e.target.value||0)); row.variance=e.target.value; while(row.patients.length<n) row.patients.push({id:'',type:''}); row.patients=row.patients.slice(0,n); renderVarianceRows(c,row,locked); };
      $('.cases',c).oninput=e=>row.cases=e.target.value;
      c._row=row;
    });
  }
  function renderVarianceRows(card,row,locked){
    const root=$('.variance-list',card), n=Math.max(0,parseInt(row.variance||0));
    if(!n){root.innerHTML='';return}
    root.innerHTML=`<div class="notice ${n?'warning':''}">バリアンス患者 ${n}件を登録してください（種別ごとに1件）。</div>` + Array.from({length:n},(_,i)=>{
      const p=row.patients[i]||{id:'',type:''};
      return `<div class="variance-item" data-pidx="${i}"><strong>患者 ${i+1}</strong><label>患者ID<input class="pid" value="${esc(p.id)}" placeholder="例：DEMO-001" ${locked?'disabled':''}></label><label>バリアンス種別<select class="ptype" ${locked?'disabled':''}><option value="">選択してください</option>${VARIANCE_TYPES.map(v=>`<option ${p.type===v?'selected':''}>${v}</option>`).join('')}</select></label></div>`;
    }).join('');
    $$('.variance-item',root).forEach((el,i)=>{ $('.pid',el).oninput=e=>row.patients[i].id=e.target.value; $('.ptype',el).onchange=e=>row.patients[i].type=e.target.value; });
  }
  function collectMonthly(){
    const rows=$$('.path-card').map(card=>{
      const row=card._row; row.cases=$('.cases',card).value; row.variance=$('.variance',card).value;
      $$('.variance-item',card).forEach((el,i)=>{row.patients[i]={id:$('.pid',el).value.trim(),type:$('.ptype',el).value}}); return row;
    });
    return {month:monthlyContext.month,ward:monthlyContext.ward,rows};
  }
  function validateMonthly(mark=true){
    let ok=true; const errors=[]; $$('.invalid').forEach(e=>e.classList.remove('invalid')); $$('.field-error').forEach(e=>e.remove());
    $$('.path-card').forEach(card=>{
      const cases=$('.cases',card), variance=$('.variance',card); const cv=cases.value, vv=variance.value;
      const bad=(el,msg)=>{ok=false;errors.push(msg);if(mark){el.classList.add('invalid');const d=document.createElement('div');d.className='field-error';d.textContent=msg;el.parentElement.appendChild(d)}};
      if(cv==='') bad(cases,'実施件数が未入力です（0件の場合は0を入力）。');
      if(vv==='') bad(variance,'バリアンス件数が未入力です（0件の場合は0を入力）。');
      if(cv!==''&&vv!==''&&Number(vv)>Number(cv)) bad(variance,'バリアンス件数が実施件数を超えています。');
      const ids=[]; $$('.variance-item',card).forEach(el=>{const pid=$('.pid',el),ptype=$('.ptype',el); if(!pid.value.trim()) bad(pid,'患者IDを入力してください。'); if(!ptype.value) bad(ptype,'種別を選択してください。'); if(pid.value.trim()){if(ids.includes(pid.value.trim())) bad(pid,'同じ患者IDが重複しています。');ids.push(pid.value.trim())}});
    });
    return {ok,errors};
  }
  function saveMonthly(status='draft',doNotify=false){
    const d=collectMonthly(); const old=store.get(monthKey(d.month,d.ward),{}); const rec={...old,...d,status,lastSaved:new Date().toISOString()};
    store.set(monthKey(d.month,d.ward),rec); if(doNotify) notify(`${d.ward} ${d.month}実績が保存されました`,'事務局で進捗を確認できます。','office'); toast('保存しました。'); return rec;
  }
  function handleNext(){
    const v=validateMonthly(true); const existing=getMonthlyStatus(monthlyContext.month,monthlyContext.ward);
    if(existing!=='confirmed'){
      modal(`<h3>登録が完了していません。</h3><p>この病棟の実績はまだ確定されていません。</p>${!v.ok?'<div class="notice danger">未入力・エラー箇所に色を付けました。</div>':''}`, [
        {label:'いいえ、登録内容へ戻る',cls:'outline',fn:closeModal},
        {label:'OK、次へ進む',cls:'primary',fn:()=>{closeModal();goNextWard()}}
      ]);
    }else goNextWard();
  }
  function goNextWard(){ const i=WARDS.indexOf(monthlyContext.ward); monthlyContext.ward=WARDS[(i+1)%WARDS.length]; renderMonthly(); }
  function confirmMonthly(){
    const v=validateMonthly(true); if(!v.ok){toast('未入力・エラー箇所を確認してください。');return}
    modal(`<h3>${esc(monthlyContext.month)} ${esc(monthlyContext.ward)} 実績を確定しますか？</h3><div class="notice warning">確定すると事務局の月次集計へ連携されます。通常利用者からは修正できなくなります。</div>`,[
      {label:'キャンセル',cls:'outline',fn:closeModal},{label:'確定する',cls:'primary',fn:()=>{const rec=saveMonthly('confirmed',false);rec.confirmedAt=new Date().toISOString();rec.confirmedBy=currentUser.name;store.set(monthKey(rec.month,rec.ward),rec);notify(`${rec.ward} ${rec.month}実績が確定しました`,`${currentUser.name} が確定しました。`,'office');closeModal();renderMonthly();}}
    ]);
  }

  function renderOfficeMonthly(){
    const month='2026-08', s=countStatuses(month); const confirmedPct=Math.round(s.confirmed/WARDS.length*100);
    setContent(`
      <div class="grid cards4"><div class="stat blue"><div class="label">対象部署</div><div class="value">${WARDS.length}</div></div><div class="stat mint"><div class="label">確定済</div><div class="value">${s.confirmed}</div></div><div class="stat cream"><div class="label">入力途中</div><div class="value">${s.draft}</div></div><div class="stat lav"><div class="label">未入力</div><div class="value">${s.unstarted}</div></div></div>
      <div class="card" style="margin-top:16px"><div class="toolbar"><div><h3 style="margin:0">${month} 実績 登録状況</h3><div class="muted small">締切：2026/09/05　確定率 ${confirmedPct}%</div></div><div class="right"><button class="btn cream" id="testReminder">前日通知を試す</button><button class="btn primary" id="publishMonth">月次更新・公開</button></div></div><div class="progress"><span style="width:${confirmedPct}%"></span></div></div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>部署</th><th>状態</th><th>最終保存</th><th>確定日時</th><th>確定者</th><th>操作</th></tr></thead><tbody>${WARDS.map(w=>{const r=store.get(monthKey(month,w),null),st=r?.status||'unstarted';return `<tr><td><strong>${w}</strong></td><td>${statusPill(st)}</td><td>${r?.lastSaved?new Date(r.lastSaved).toLocaleString('ja-JP'):'―'}</td><td>${r?.confirmedAt?new Date(r.confirmedAt).toLocaleString('ja-JP'):'―'}</td><td>${esc(r?.confirmedBy||'―')}</td><td><button class="btn sm outline" onclick="Pathia.openWard('${w}')">内容確認</button> ${st!=='confirmed'?`<button class="btn sm cream" onclick="Pathia.remindWard('${w}')">通知</button>`:''}</td></tr>`}).join('')}</tbody></table></div>
      <div class="notice warning" style="margin-top:16px"><strong>本番想定：</strong>締切前日に「未入力」「入力途中」の部署だけへ自動通知。事務局には未確定部署一覧を通知します。v0では通知ログで動作を再現します。</div>
    `);
    $('#testReminder').onclick=()=>sendDeadlineReminders(month);
    $('#publishMonth').onclick=()=>publishMonthly(month);
  }
  function sendDeadlineReminders(month){ const pending=WARDS.filter(w=>getMonthlyStatus(month,w)!=='confirmed'); pending.forEach(w=>notify(`${month}実績の締切は明日です`,`${w}の実績が未確定です。入力内容を確認し確定してください。`,w)); notify(`事務局：明日締切 未確定${pending.length}部署`,pending.join('、')||'未確定部署はありません。','office'); toast(`${pending.length}部署への前日通知を作成しました。`); }
  function publishMonthly(month){ const s=countStatuses(month); if(s.confirmed<WARDS.length){modal(`<h3>まだ公開できません</h3><div class="notice danger">未確定部署が ${WARDS.length-s.confirmed} 部署あります。</div><p>全ての部署が確定してから月次更新してください。</p>`,[{label:'閉じる',cls:'primary',fn:closeModal}]);return} store.set('publishedMonth',month); notify(`${month}実績を公開しました`,'院内ダッシュボード・分析画面へ反映されました。','all'); toast('月次更新が完了しました。'); renderOfficeMonthly(); }

  function renderAnalysis(){
    const saved=store.get('analysisFilters',{period:'2026-05',ward:'全体',dept:'全体',path:'全体'});
    const period=ANALYSIS_PERIODS[saved.period]||ANALYSIS_PERIODS['2026-05'];
    const wards=['全体',...Object.keys(period.wards).filter(x=>x!=='全体')];
    const depts=['全体',...Object.keys(period.depts).filter(x=>x!=='全体')];
    const paths=['全体',...new Set(VARIANCE_RECORDS.map(x=>x.path))];
    const filteredVariances=VARIANCE_RECORDS.filter(v=>(saved.ward==='全体'||v.ward===saved.ward|| (saved.ward==='ICU'&&v.ward==='ICU・CCU')) && (saved.dept==='全体'||v.dept===saved.dept) && (saved.path==='全体'||v.path===saved.path));
    let stat=period.depts[saved.dept]||period.wards[saved.ward]||period.wards['全体'];
    if(saved.dept==='全体' && saved.ward!=='全体') stat=period.wards[saved.ward]||period.wards['全体'];
    if(saved.dept!=='全体') stat=period.depts[saved.dept]||period.depts['全体'];
    const fmt=v=>v===null||v===undefined?'―':v.toLocaleString('ja-JP');
    const rate=v=>v===null||v===undefined?'―':`${v}%`;
    const delta=(stat.rate!=null&&stat.prev!=null)?stat.rate-stat.prev:null;
    const varianceByCode={}; filteredVariances.forEach(v=>varianceByCode[v.code]=(varianceByCode[v.code]||0)+1);
    const varianceByContent={}; filteredVariances.forEach(v=>varianceByContent[v.content]=(varianceByContent[v.content]||0)+1);
    const rowsByWard=Object.entries(period.wards).filter(([k])=>!['手術','外来','病棟全体'].includes(k));
    const rowsByDept=Object.entries(period.depts);
    setContent(`
      <div class="notice success"><strong>共通分析画面</strong>：事務局・病棟パス係・責任医師・委員・閲覧者の全権限から参照できます。病棟・診療科・パスを自由に切り替えてください。</div>
      <div class="card" style="margin-top:14px">
        <div class="toolbar"><div><h3 style="margin:0">クリニカルパス分析</h3><div class="muted small">会議資料で使用している「使用率」「前年度比較」「バリアンス逸脱内容」をPathia上で確認する試作です。</div></div><span class="pill blue">VERSION 0.1</span></div>
        <div class="analysis-filter-grid">
          <label>集計期間<select id="anaPeriod">${Object.entries(ANALYSIS_PERIODS).map(([k,v])=>`<option value="${k}" ${saved.period===k?'selected':''}>${v.label}</option>`).join('')}</select></label>
          <label>病棟<select id="anaWard">${wards.map(v=>`<option ${saved.ward===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>診療科<select id="anaDept">${depts.map(v=>`<option ${saved.dept===v?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>パス名<select id="anaPath">${paths.map(v=>`<option ${saved.path===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label>
        </div>
      </div>
      <div class="grid cards4" style="margin-top:16px">
        <div class="stat blue"><div class="label">使用患者数</div><div class="value">${fmt(stat.used)}<small> 件</small></div></div>
        <div class="stat mint"><div class="label">退院患者数</div><div class="value">${fmt(stat.discharged)}<small> 件</small></div></div>
        <div class="stat cream"><div class="label">使用率</div><div class="value">${rate(stat.rate)}</div></div>
        <div class="stat lav"><div class="label">前年度使用率</div><div class="value">${rate(stat.prev)}</div><div class="subtext">${delta===null?'比較不可':`前年差 ${delta>0?'+':''}${delta}pt`}</div></div>
      </div>
      <div class="grid cards2" style="margin-top:16px">
        <div class="card"><div class="section-title" style="margin-top:0"><h3>病棟別 使用率</h3><span class="pill blue">${period.label}</span></div><div class="table-wrap compact"><table><thead><tr><th>病棟</th><th>使用患者数</th><th>退院患者数</th><th>使用率</th><th>前年度</th></tr></thead><tbody>${rowsByWard.map(([k,v])=>`<tr class="${saved.ward===k?'selected-row':''}"><td><strong>${k}</strong></td><td>${fmt(v.used)}</td><td>${fmt(v.discharged)}</td><td>${rate(v.rate)}</td><td>${rate(v.prev)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="section-title" style="margin-top:0"><h3>診療科別 使用率</h3><span class="pill green">選択可</span></div><div class="table-wrap compact analysis-scroll"><table><thead><tr><th>診療科</th><th>使用患者数</th><th>退院患者数</th><th>使用率</th><th>前年度</th></tr></thead><tbody>${rowsByDept.map(([k,v])=>`<tr class="${saved.dept===k?'selected-row':''}"><td><strong>${k}</strong></td><td>${fmt(v.used)}</td><td>${fmt(v.discharged)}</td><td>${rate(v.rate)}</td><td>${rate(v.prev)}</td></tr>`).join('')}</tbody></table></div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="section-title" style="margin-top:0"><h3>月別使用率推移</h3><span class="muted small">令和8年度と前年度を比較</span></div><div class="trend-grid"><div><strong>令和8年度</strong>${Object.entries(MONTHLY_TRENDS.r8).map(([m,v])=>`<div class="trend-row"><span>${m}</span><div class="bar"><i style="width:${Math.min(100,v)}%"></i></div><b>${v}%</b></div>`).join('')}</div><div><strong>令和7年度</strong>${Object.entries(MONTHLY_TRENDS.r7).map(([m,v])=>`<div class="trend-row"><span>${m}</span><div class="bar"><i style="width:${Math.min(100,v)}%"></i></div><b>${v}%</b></div>`).join('')}</div></div></div>
      <div class="section-title"><h3>バリアンス逸脱内容</h3><div><span class="pill yellow">${filteredVariances.length}件</span> <button class="btn sm outline" id="anaReset">絞り込み解除</button></div></div>
      <div class="grid cards2">
        <div class="card"><h3>コード別</h3><div class="list">${Object.entries(varianceByCode).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="list-row"><span>${esc(k)}</span><strong>${v}件</strong></div>`).join('')||'<p class="muted">該当なし</p>'}</div></div>
        <div class="card"><h3>主な内容</h3><div class="list">${Object.entries(varianceByContent).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([k,v])=>`<div class="list-row"><span>${esc(k)}</span><strong>${v}件</strong></div>`).join('')||'<p class="muted">該当なし</p>'}</div></div>
      </div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>No</th><th>診療科</th><th>パス名</th><th>病棟</th><th>発生月</th><th>病日</th><th>コード</th><th>バリアンス内容</th></tr></thead><tbody>${filteredVariances.map(v=>`<tr><td>${esc(v.no)}</td><td>${esc(v.dept)}</td><td>${esc(v.path)}</td><td>${esc(v.ward)}</td><td>${esc(v.month)}</td><td>${esc(v.day)}</td><td><span class="pill yellow">${esc(v.code)}</span></td><td>${esc(v.content)}</td></tr>`).join('')||'<tr><td colspan="8" class="muted">条件に一致するバリアンスはありません。</td></tr>'}</tbody></table></div>
      <div class="notice warning" style="margin-top:16px"><strong>V0.1の追加項目：</strong> 使用患者数、退院患者数、使用率、前年度使用率、前年差、年度累計、月別推移、病棟別・診療科別比較、パス別絞り込み、バリアンスコード・内容一覧。今後は平均在院日数、適用率、診療行為、コスト、改訂前後比較などを追加できる構造にします。</div>
    `);
    const update=()=>{store.set('analysisFilters',{period:$('#anaPeriod').value,ward:$('#anaWard').value,dept:$('#anaDept').value,path:$('#anaPath').value});renderAnalysis()};
    ['anaPeriod','anaWard','anaDept','anaPath'].forEach(id=>$('#'+id).onchange=update);
    $('#anaReset').onclick=()=>{store.set('analysisFilters',{period:'2026-05',ward:'全体',dept:'全体',path:'全体'});renderAnalysis()};
  }

  function renderPaths(){
    const all=Object.values(PATHS).flat();
    setContent(`<div class="toolbar"><div><h3 style="margin:0">院内クリニカルパス一覧</h3><div class="muted small">正式パスの編集は別端末。Pathiaでは実績・分析・履歴を統合します。</div></div><input id="pathSearch" placeholder="パス名・診療科で検索" style="max-width:320px"></div><div id="pathList" class="grid cards3"></div>`);
    const draw=q=>{const filtered=all.filter(p=>(p.name+p.dept).includes(q||''));$('#pathList').innerHTML=filtered.map(p=>`<div class="card"><span class="pill blue">${esc(p.dept)}</span><h3 style="margin-top:10px">${esc(p.name)}</h3><p class="muted small">実績／バリアンス／委員会／改訂履歴をPathiaで参照</p><button class="btn sm outline" onclick="Pathia.pathDetail('${esc(p.name)}')">詳細を見る</button></div>`).join('')}; draw(''); $('#pathSearch').oninput=e=>draw(e.target.value);
  }
  function pathDetail(name){
    const ks=store.get('knowledge',[]).filter(k=>k.path===name);
    modal(`<h3>${esc(name)}</h3><div class="grid cards2"><div class="stat blue"><div class="label">8月使用件数</div><div class="value">${name.includes('肝')?15:12}</div></div><div class="stat cream"><div class="label">バリアンス率</div><div class="value">${name.includes('肝')?'20.0':'8.3'}<small>%</small></div></div></div><div class="section-title"><h3>院内知識・履歴</h3></div>${ks.length?ks.map(k=>`<div class="knowledge"><strong>${esc(k.decision)}</strong><p>${esc(k.reason)}</p><span class="muted small">${esc(k.date)}／${esc(k.source)}</span></div>`).join(''):'<p class="muted">登録なし</p>'}<div class="notice warning">正式パスの修正・新規作成は別端末で行います。</div>`,[{label:'閉じる',cls:'primary',fn:closeModal}]);
  }

  function renderAI(){
    const latest=store.get('knowledge',[]).filter(k=>k.path==='肝切除術パス').slice(-1)[0];
    setContent(`
      <div class="ai-box"><h4>AI改善提案：肝切除術パス／術後薬剤</h4><p><strong>データだけを見る場合：</strong>B薬剤への変更でコスト低減余地があります。</p><p><strong>院内知識：</strong>${latest?esc(latest.reason):'登録なし'}</p><p><strong>Pathia提案：</strong>現時点ではA薬剤継続を推奨。抗体保有率や新しい実績に変化があれば再検討候補とします。</p></div>
      <div class="card" style="margin-top:16px"><h3>責任医師の判断を登録</h3><div class="form-grid"><label>対象パス<input id="fbPath" value="肝切除術パス" readonly></label><label>判断区分<select id="fbDecision"><option>承認</option><option>条件付き承認</option><option selected>却下</option><option>保留</option></select></label><label class="full">医師・委員の判断理由<textarea id="fbReason">B薬剤では抗体を持っている患者が多いため、当院外科ではA薬剤を優先したい。</textarea></label><label>知識区分<select id="fbType"><option>責任医師意見</option><option>委員会正式決定</option><option>参考意見</option><option>継続検討</option></select></label><label>今後のAI提案に反映<select id="fbReflect"><option>する</option><option>しない</option></select></label></div><div class="toolbar"><span class="muted small">登録後は「院内知識」で履歴を確認できます。</span><button class="btn primary" id="saveFeedback">院内知識として登録</button></div></div>
    `);
    $('#saveFeedback').onclick=()=>{const k={id:uid('k'),date:todayISO(),path:$('#fbPath').value,topic:'術後薬剤',source:currentUser.name,type:$('#fbType').value,decision:$('#fbDecision').value,reason:$('#fbReason').value,status:$('#fbReflect').value==='する'?'有効':'参考'};const ks=store.get('knowledge',[]);ks.push(k);store.set('knowledge',ks);notify('院内知識を登録しました',`${k.path}：${k.decision}`,'office');toast('登録しました。次回の提案で参照します。');renderAI()};
  }

  function renderKnowledge(){
    const ks=store.get('knowledge',[]).slice().reverse();
    setContent(`<div class="toolbar"><div><h3 style="margin:0">院内知識・判断履歴</h3><div class="muted small">AI提案、責任医師意見、委員会決定の根拠を追跡</div></div><span class="pill green">${ks.filter(k=>k.status==='有効').length}件 有効</span></div><div class="timeline">${ks.map(k=>`<div class="timeline-item"><strong>${esc(k.path)}｜${esc(k.decision)}</strong><p>${esc(k.reason)}</p><div><span class="pill blue">${esc(k.type)}</span> <span class="pill ${k.status==='有効'?'green':'gray'}">${esc(k.status)}</span></div><div class="muted small">${esc(k.date)}／${esc(k.source)}</div></div>`).join('')}</div>`);
  }

  function renderCommittee(){
    const ms=store.get('committeeMeetings',[]).slice().sort((a,b)=>b.date.localeCompare(a.date));
    setContent(`
      <div class="grid cards3"><div class="stat blue"><div class="label">次回委員会</div><div class="value" style="font-size:22px">9/10</div></div><div class="stat mint"><div class="label">前回決定事項</div><div class="value">3</div></div><div class="stat cream"><div class="label">継続検討</div><div class="value">2</div></div></div>
      <div class="toolbar"><div><h3 style="margin:0">パス委員会</h3><div class="muted small">会議資料・議事録・決定事項・院内知識を1か所で確認</div></div><div class="right"><button class="btn outline" id="minutesTemplate">議事録CSVテンプレート</button><button class="btn primary" onclick="Pathia.go('schedule')">会議を登録</button></div></div>
      <div class="grid cards2">${ms.map(m=>`<div class="card"><span class="pill ${m.status==='開催済'?'green':'blue'}">${esc(m.status)}</span><h3 style="margin-top:10px">${esc(m.title)}</h3><p>${fmtDate(m.date)}</p><p class="muted small">${esc(m.agenda)}</p><div class="toolbar"><div class="left"><button class="btn sm outline" onclick="Pathia.printAgenda('${m.id}')">レジュメ</button><button class="btn sm primary" onclick="Pathia.printCommittee('${m.id}')">委員会資料PDF</button></div><button class="btn sm mint" onclick="Pathia.minutesImport('${m.id}')">議事録取込</button></div></div>`).join('')}</div>
      <div class="section-title"><h3>前回決定事項の進捗</h3></div><div class="table-wrap"><table><thead><tr><th>対象</th><th>決定事項</th><th>状態</th></tr></thead><tbody><tr><td>肝切除術パス</td><td>A薬剤を標準として継続</td><td><span class="pill green">院内知識登録済</span></td></tr><tr><td>胃切除術パス</td><td>Day3採血を必要時へ</td><td><span class="pill yellow">正式パス反映待ち</span></td></tr><tr><td>外科全体</td><td>新規パス候補の症例数を確認</td><td><span class="pill blue">今回再検討</span></td></tr></tbody></table></div>
    `);
    $('#minutesTemplate').onclick=downloadMinutesTemplate;
  }
  function downloadMinutesTemplate(){
    const csv='meeting_id,meeting_date,committee,department,path_name,topic,comment_type,speaker_role,comment,decision,decision_type,status,knowledge_register\nCP202609,2026-09-10,クリニカルパス委員会,外科,肝切除術パス,術後薬剤の見直し,責任医師意見,外科パス責任医師,ここに意見,ここに決定内容,正式決定,反映待ち,する\n'; downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'Pathia_議事録取込テンプレート.csv');
  }
  function minutesImport(meetingId){
    modal(`<h3>議事録CSVを取り込む</h3><p>${esc(meetingId)}</p><div class="notice warning">普通の議事録Excelから「Pathia取込CSV作成」マクロで出力したCSVを想定しています。</div><label>CSVファイル<input id="minutesFile" type="file" accept=".csv,text/csv"></label><div id="minutesPreview"></div>`,[{label:'閉じる',cls:'outline',fn:closeModal},{label:'確認して院内知識へ登録',cls:'primary',fn:importMinutesFile}]);
    $('#minutesFile').onchange=e=>previewMinutes(e.target.files[0]);
  }
  let pendingMinutes=[];
  function previewMinutes(file){ if(!file)return; const r=new FileReader(); r.onload=()=>{pendingMinutes=parseCSV(r.result); const rows=pendingMinutes.slice(0,5); $('#minutesPreview').innerHTML=`<div class="notice success" style="margin-top:12px">${pendingMinutes.length}件を読み込みました。</div><div class="table-wrap"><table><tbody>${rows.map(x=>`<tr><td>${esc(x.path_name||'')}</td><td>${esc(x.decision||x.comment||'')}</td><td>${esc(x.decision_type||'')}</td></tr>`).join('')}</tbody></table></div>`}; r.readAsText(file,'UTF-8'); }
  function importMinutesFile(){ if(!pendingMinutes.length){toast('CSVを選択してください。');return} const ks=store.get('knowledge',[]); pendingMinutes.filter(x=>x.knowledge_register!=='しない').forEach(x=>ks.push({id:uid('k'),date:x.meeting_date||todayISO(),path:x.path_name||'関連パス未指定',topic:x.topic||'議事録',source:`${x.committee||'委員会'}／${x.speaker_role||''}`,type:x.decision_type||x.comment_type||'委員会意見',decision:x.decision||x.comment||'議事録記録',reason:x.comment||x.decision||'',status:x.decision_type==='正式決定'?'有効':'参考'})); store.set('knowledge',ks); notify('議事録を取り込みました',`${pendingMinutes.length}件を解析し院内知識へ登録しました。`,'office');pendingMinutes=[];closeModal();toast('議事録を登録しました。'); }

  function renderSchedule(){
    const y=calCursor.getFullYear(),m=calCursor.getMonth();
    setContent(`<div class="toolbar"><div class="left"><button class="btn outline" id="prevMonth">←</button><h3 style="margin:0">${y}年 ${m+1}月</h3><button class="btn outline" id="nextMonth">→</button></div><button class="btn primary" id="addEvent">＋ 予定を登録</button></div><div class="legend"><span class="pill blue">会議</span> <span class="pill green">研修</span> <span class="pill yellow">学会</span> <span class="pill red">締切</span></div><div class="calendar" id="calendar" style="margin-top:12px"></div>`);
    drawCalendar(); $('#prevMonth').onclick=()=>{calCursor=new Date(y,m-1,1);renderSchedule()}; $('#nextMonth').onclick=()=>{calCursor=new Date(y,m+1,1);renderSchedule()}; $('#addEvent').onclick=()=>eventModal();
  }
  function drawCalendar(){
    const root=$('#calendar'), y=calCursor.getFullYear(),m=calCursor.getMonth(),first=new Date(y,m,1),start=first.getDay(),days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
    root.innerHTML=['日','月','火','水','木','金','土'].map(d=>`<div class="cal-head">${d}</div>`).join(''); const events=store.get('events',[]);
    for(let i=0;i<42;i++){ let d=i-start+1, dateObj, muted=false; if(d<1){dateObj=new Date(y,m-1,prevDays+d);muted=true}else if(d>days){dateObj=new Date(y,m+1,d-days);muted=true}else dateObj=new Date(y,m,d); const ds=`${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`; const ev=events.filter(e=>e.date===ds); const cell=document.createElement('div');cell.className='day'+(muted?' mutedday':'');cell.innerHTML=`<div class="daynum">${dateObj.getDate()}</div>${ev.map(e=>`<div class="event ${e.type}" data-id="${e.id}">${esc(e.title)}</div>`).join('')}`;cell.ondblclick=()=>eventModal(ds);root.appendChild(cell);$$('.event',cell).forEach(el=>el.onclick=()=>viewEvent(el.dataset.id)); }
  }
  function eventModal(prefill=todayISO()){
    modal(`<h3>スケジュール登録</h3><div class="form-grid"><label>カテゴリー<select id="evType">${Object.entries(EVENT_TYPES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>日付<input id="evDate" type="date" value="${prefill}"></label><label>開始時刻<input id="evStart" type="time"></label><label>終了時刻<input id="evEnd" type="time"></label><label>場所<input id="evPlace" placeholder="会議室・オンライン等"></label><label>通知<select id="evNotify"><option value="all">登録者全員へ通知</option><option value="none">通知なし</option><option value="committee">委員会構成員へ通知</option><option value="ward">病棟パス係へ通知</option><option value="specific">特定の人へ通知</option></select></label><label class="full">件名<input id="evTitle" placeholder="例：クリニカルパス委員会"></label><label class="full">内容・議題<textarea id="evAgenda" placeholder="議題、目的、連絡事項"></textarea></label><div class="full" id="resumeHint"></div></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:'登録',cls:'primary',fn:saveEvent}]);
    const update=()=>$('#resumeHint').innerHTML=$('#evType').value==='meeting'?'<div class="notice success">会議として登録すると、レジュメ作成・委員会ページとの連携が利用できます。</div>':''; $('#evType').onchange=update;update();
  }
  function saveEvent(){ const e={id:uid('e'),type:$('#evType').value,date:$('#evDate').value,start:$('#evStart').value,end:$('#evEnd').value,place:$('#evPlace').value,notify:$('#evNotify').value,title:$('#evTitle').value||EVENT_TYPES[$('#evType').value],agenda:$('#evAgenda').value,status:'予定'};const es=store.get('events',[]);es.push(e);store.set('events',es); if(e.notify!=='none') notify(`予定を登録：${e.title}`,`${fmtDate(e.date)} ${e.start||'終日'} ${e.place||''}`,e.notify); if(e.type==='meeting'){const ms=store.get('committeeMeetings',[]);ms.push({id:`CP${e.date.replaceAll('-','')}`,date:e.date,title:e.title,agenda:e.agenda,decisions:0,status:'予定'});store.set('committeeMeetings',ms)} closeModal();renderSchedule();toast('予定を登録しました。'); }
  function viewEvent(id){const e=store.get('events',[]).find(x=>x.id===id);if(!e)return;modal(`<h3>${esc(e.title)}</h3><p>${fmtDate(e.date)}　${esc(e.start||'終日')}〜${esc(e.end||'')}</p><p><strong>場所：</strong>${esc(e.place||'未設定')}</p><p><strong>内容：</strong>${esc(e.agenda||'未設定')}</p><p><strong>通知：</strong>${esc(e.notify)}</p>${e.type==='meeting'?'<div class="notice success">この予定は会議です。レジュメを作成できます。</div>':''}`,[{label:'閉じる',cls:'outline',fn:closeModal},...(e.type==='meeting'?[{label:'レジュメ作成',cls:'primary',fn:()=>{closeModal();printGenericAgenda(e)}}]:[])]);}

  function renderReports(){
    setContent(`<div class="grid cards3"><div class="card"><span class="pill blue">委員会</span><h3>外科パス委員会資料</h3><p class="muted small">月次実績、バリアンス、AI見直し候補、責任医師判断をまとめます。</p><button class="btn primary" onclick="Pathia.printCommittee('CP202609')">PDF保存画面を開く</button></div><div class="card"><span class="pill green">月次</span><h3>院内パス月次サマリー</h3><p class="muted small">診療科・病棟別の件数、適用率、バリアンスを掲載。</p><button class="btn outline" onclick="Pathia.printMonthlyReport()">PDF保存画面を開く</button></div><div class="card"><span class="pill yellow">確認用</span><h3>責任医師確認資料</h3><p class="muted small">AI提案・根拠・院内知識・判断欄をまとめます。</p><button class="btn outline" onclick="Pathia.printDoctorReport()">PDF保存画面を開く</button></div></div><div class="notice warning" style="margin-top:16px"><strong>v0のPDF：</strong>ブラウザの印刷画面を開き「PDFに保存」を選ぶ方式です。本番版では生成PDFを会議履歴へ保存して後日ダウンロードできる設計にします。</div>`);
  }

  function renderImport(){
    setContent(`<div class="notice danger"><strong>実データ禁止：</strong>このGitHub Pages試作版へ患者情報・院内機密をアップロードしないでください。</div><div class="grid cards2" style="margin-top:16px"><div class="card"><h3>病院ダッシュボード／実績CSV</h3><p class="muted small">症例数、在院日数、パス適用率などの集計済み・匿名化データを想定。</p><input id="dashFile" type="file" accept=".csv"><div id="dashPreview"></div></div><div class="card"><h3>議事録CSV</h3><p class="muted small">議事録Excelのマクロから出力したCSVを取り込み、委員会意見・正式決定を院内知識へ整理します。</p><button class="btn mint" onclick="Pathia.minutesImport('MANUAL')">議事録を取り込む</button></div></div>`);
    $('#dashFile').onchange=e=>previewDashboard(e.target.files[0]);
  }
  function previewDashboard(file){if(!file)return;const r=new FileReader();r.onload=()=>{const rows=parseCSV(r.result);$('#dashPreview').innerHTML=`<div class="notice success" style="margin-top:12px">${rows.length}行を読み込みました（v0はプレビューのみ）。</div><div class="table-wrap"><table><tbody>${rows.slice(0,6).map(x=>`<tr>${Object.values(x).slice(0,6).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`};r.readAsText(file,'UTF-8')}

  function renderAdmin(){
    const members=store.get('members',[]);
    setContent(`<div class="grid cards3"><div class="stat blue"><div class="label">登録アカウント</div><div class="value">${members.length}</div></div><div class="stat mint"><div class="label">病棟パス係</div><div class="value">${members.filter(m=>m.role==='ward').length}</div></div><div class="stat cream"><div class="label">委員会構成員</div><div class="value">${members.filter(m=>['committee','doctor','office'].includes(m.role)).length}</div></div></div><div class="section-title"><h3>役割ID・担当者・権限管理</h3><button class="btn primary" id="addMember">＋ 登録</button></div><div class="table-wrap"><table><thead><tr><th>役割ID</th><th>現在担当者</th><th>部署</th><th>役職</th><th>役割</th><th>権限</th><th>病棟</th><th>メール</th><th></th></tr></thead><tbody>${members.map(m=>`<tr><td><strong>${esc(m.id)}</strong></td><td>${esc(m.name)}</td><td>${esc(m.department)}</td><td>${esc(m.title||'')}</td><td>${esc(m.label)}</td><td>${esc(m.permission)}</td><td>${esc(m.ward||'―')}</td><td>${esc(m.email)}</td><td><button class="btn sm outline" onclick="Pathia.editMember('${m.id}')">編集</button></td></tr>`).join('')}</tbody></table></div><div class="notice warning" style="margin-top:16px"><strong>設計方針：</strong>IDは個人ではなく役割に付与し、担当交代時は「現在担当者名」「メール」「必要な権限」を更新。操作履歴には役割IDとその時点の担当者名を残します。</div>`);
    $('#addMember').onclick=()=>editMember();
  }
  function editMember(id){const members=store.get('members',[]),m=members.find(x=>x.id===id)||{id:'',name:'',department:'',title:'',label:'',permission:'閲覧のみ',ward:'',email:'',role:'viewer',active:true};modal(`<h3>${id?'担当者・権限を編集':'役割アカウントを登録'}</h3><div class="form-grid"><label>役割ID<input id="mId" value="${esc(m.id)}" ${id?'readonly':''}></label><label>現在担当者<input id="mName" value="${esc(m.name)}"></label><label>部署<input id="mDept" value="${esc(m.department)}"></label><label>役職<input id="mTitle" value="${esc(m.title||'')}"></label><label>役割名<input id="mLabel" value="${esc(m.label)}"></label><label>システム権限<select id="mRole"><option value="office" ${m.role==='office'?'selected':''}>事務局管理者</option><option value="ward" ${m.role==='ward'?'selected':''}>病棟パス係</option><option value="doctor" ${m.role==='doctor'?'selected':''}>パス責任者</option><option value="committee" ${m.role==='committee'?'selected':''}>委員会構成員</option><option value="viewer" ${m.role==='viewer'?'selected':''}>閲覧のみ</option></select></label><label>病棟<select id="mWard"><option value="">なし</option>${WARDS.map(w=>`<option ${m.ward===w?'selected':''}>${w}</option>`).join('')}</select></label><label>メール<input id="mEmail" value="${esc(m.email)}"></label></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:'保存',cls:'primary',fn:saveMember}]);}
  function saveMember(){const members=store.get('members',[]),id=$('#mId').value.trim();if(!id){toast('役割IDを入力してください。');return}const role=$('#mRole').value;const obj={id,name:$('#mName').value,department:$('#mDept').value,title:$('#mTitle').value,label:$('#mLabel').value||id,role,permission:({office:'管理者',ward:'病棟パス係',doctor:'パス責任者',committee:'委員会構成員',viewer:'閲覧のみ'})[role],ward:$('#mWard').value,email:$('#mEmail').value,active:true};const i=members.findIndex(x=>x.id===id);if(i>=0)members[i]={...members[i],...obj};else members.push(obj);store.set('members',members);if(currentUser.id===id){currentUser={...currentUser,...obj};renderUser()}closeModal();renderAdmin();toast('保存しました。');}

  function renderHelp(){
    const roleGuides={office:[['📋','月次実績管理','未入力・入力途中・確定済を確認し、月次更新します。','officeMonthly'],['📊','分析結果を見る','病棟・診療科・パス別に使用率とバリアンスを確認します。','analysis'],['🏥','委員会資料の見方','会議資料・議事録・決定事項を確認します。','committee'],['📥','議事録の登録','Excelから出力したCSVを取り込みます。','committee'],['⚙️','委員・権限管理','役割ID、担当者名、部署、メール、権限を管理します。','admin']],ward:[['📝','月次実績の登録','実施件数、バリアンス、架空患者IDを入力し確定します。','monthly'],['📊','分析結果を見る','病棟・診療科・パス別に使用率とバリアンスを確認します。','analysis'],['📅','スケジュールの確認','会議・研修・締切を確認します。','schedule'],['📊','集計結果の見方','公開後の院内ダッシュボードを確認します。','home']],doctor:[['✨','AI改善提案への回答','医師判断と理由を院内知識として残します。','ai'],['🧠','院内知識の見方','過去の責任医師判断や委員会決定を確認します。','knowledge'],['🏥','委員会資料の見方','分析から会議資料まで確認します。','committee']],committee:[['🏥','委員会資料の見方','レジュメ・会議資料・議事録を確認します。','committee'],['🧠','決定事項の確認','会議で決まった内容を追跡します。','knowledge'],['📅','スケジュールの登録方法','会議・研修などを登録します。','schedule']],viewer:[['📊','院内ダッシュボード','公開済みパス実績を確認します。','home'],['📚','院内パスを見る','院内パスの情報を参照します。','paths']]}; const gs=roleGuides[currentUser.role]||[];
    const terms=[['クリニカルパス','特定の疾患・手術について、入院から退院までの検査・治療・看護・リハビリ等を時系列で整理した標準的な診療計画です。'],['バリアンス','パスで予定していた経過と実際の経過に差が生じたことです。差の理由を分析し、パス改善につなげます。'],['アウトカム','その時点で患者さんが到達していることを期待する目標です。'],['パス適用件数','そのパスを実際に使用した症例数です。'],['パス適用率','対象となる症例のうちパスを使用した割合です。'],['確定','病棟の月次入力を完了し、事務局の月次集計へ連携する操作です。'],['院内知識','責任医師の判断、委員会決定、改訂理由など、今後のAI提案が参照する病院内の知見です。'],['月次更新','事務局が確定済み実績を正式な当月結果として公開する作業です。']];
    setContent(`<div class="help-hero"><img src="pathia-character-sheet.png" alt="パシくま キャラクターシート"><div><span class="pill blue">${esc(currentUser.label)}向け</span><h3 style="font-size:26px;color:#245b89">パシくまと使い方を見てみよう</h3><p>権限によって必要な操作だけを優先表示します。各ガイドをクリックすると、その操作画面へ移動できます。</p><div class="notice success">わからない言葉があったら、下の「用語説明」を見てね。各画面にも「？」ヘルプを追加していく想定です。</div><div class="guide-grid" style="margin-top:14px">${gs.map(g=>`<div class="guide-card" onclick="Pathia.go('${g[3]}')"><div class="gicon">${g[0]}</div><strong>${g[1]}</strong><span class="muted small">${g[2]}</span></div>`).join('')}</div></div></div><div class="section-title"><h3>はじめてのクリニカルパス</h3></div><div class="card"><h3>クリニカルパスって何？</h3><p>入院から退院までの標準的な診療の道筋を、医師・看護師・薬剤師・リハビリ・事務など多職種で共有するための計画です。Pathiaでは「今のパスが実際の診療と合っているか」「どんなバリアンスが起きているか」「なぜ改訂されたか」を見えるようにします。</p></div><div class="section-title"><h3>用語説明</h3></div><div class="glossary">${terms.map(t=>`<div class="term"><strong>${t[0]}</strong><p>${t[1]}</p></div>`).join('')}</div><div class="section-title"><h3>よくある質問</h3></div><div class="card"><div class="list"><div class="list-row"><div><div class="maintext">0件なのに空白でいい？</div><div class="subtext">空白は「未入力」、0は「0件と確認済み」です。0件の場合も0を入力してください。</div></div></div><div class="list-row"><div><div class="maintext">確定後に間違いに気づいたら？</div><div class="subtext">本番版では事務局へ修正依頼し、確定解除後に修正する運用を想定しています。</div></div></div><div class="list-row"><div><div class="maintext">正式パスをPathiaで修正できる？</div><div class="subtext">できません。正式パスの新規作成・修正は別端末で行い、Pathiaは分析・提案・履歴管理を担当します。</div></div></div></div></div>`);
  }

  function renderProfile(){ editMember(currentUser.id); }

  function modal(html, actions=[]){ const root=$('#modalRoot'); root.innerHTML=`<div class="modal-backdrop"><div class="modal">${html}<div class="modal-actions">${actions.map((a,i)=>`<button class="btn ${a.cls||'outline'}" data-act="${i}">${a.label}</button>`).join('')}</div></div></div>`; actions.forEach((a,i)=>$(`[data-act="${i}"]`,root).onclick=a.fn); }
  function closeModal(){ $('#modalRoot').innerHTML=''; }
  function parseCSV(text){
    const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean); if(!lines.length)return[]; const parseLine=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}; const h=parseLine(lines[0]);return lines.slice(1).map(l=>{const a=parseLine(l),o={};h.forEach((k,i)=>o[k.trim()]=a[i]?.trim()||'');return o});
  }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

  function reportWindow(title,body){const w=window.open('','_blank'); w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Yu Gothic,Meiryo,sans-serif;color:#26394b;margin:36px}h1{color:#245c8b;border-bottom:3px solid #72b9e8;padding-bottom:12px}h2{color:#2e6b9a;margin-top:28px}.meta{background:#f1f8fd;padding:12px;border-radius:10px}.box{border:1px solid #d7e6f1;border-radius:12px;padding:14px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8e4ed;padding:8px;text-align:left}th{background:#eef6fb}.ai{background:#effaf4;border-left:5px solid #78bd92;padding:12px}.foot{margin-top:32px;font-size:11px;color:#778797}@media print{button{display:none}body{margin:18mm}}</style></head><body><button onclick="window.print()" style="float:right;padding:9px 14px">PDFに保存／印刷</button><h1>${esc(title)}</h1>${body}<div class="foot">Pathia v0.1 試作資料｜生成日 ${new Date().toLocaleDateString('ja-JP')}｜正式資料として使用する前に内容を確認してください。</div></body></html>`); w.document.close(); }
  function printCommittee(id){const m=store.get('committeeMeetings',[]).find(x=>x.id===id)||{title:'クリニカルパス委員会',date:'2026-09-10',agenda:'外科パス分析'};reportWindow(`${m.title} 資料`,`<div class="meta">日時：${fmtDate(m.date)}<br>対象：外科試作版<br>議題：${esc(m.agenda)}</div><h2>1. 外科パス運用状況</h2><table><tr><th>パス</th><th>件数</th><th>バリアンス</th><th>発生率</th></tr><tr><td>肝切除術パス</td><td>15</td><td>3</td><td>20.0%</td></tr><tr><td>鼠径ヘルニアパス</td><td>10</td><td>0</td><td>0%</td></tr><tr><td>胃切除術パス</td><td>12</td><td>2</td><td>16.7%</td></tr></table><h2>2. AI見直し候補</h2><div class="ai"><strong>肝切除術パス／術後薬剤</strong><p>データ上はB薬剤への変更余地がありますが、過去の外科責任医師判断として、抗体保有例の観点からA薬剤を標準として継続する院内知識が登録されています。PathiaはA薬剤継続を優先提案します。</p></div><h2>3. 前回決定事項</h2><table><tr><th>項目</th><th>決定</th><th>進捗</th></tr><tr><td>術後薬剤</td><td>A薬剤継続</td><td>院内知識登録済</td></tr><tr><td>Day3採血</td><td>必要時へ</td><td>正式パス反映待ち</td></tr></table><h2>4. 今回の検討事項</h2><div class="box">□ 肝切除術パスのバリアンス3件の確認<br>□ 胃切除術パスのDay3採血改訂状況<br>□ 新規パス候補の症例数確認</div>`)}
  function printGenericAgenda(e){reportWindow(`${e.title} レジュメ`,`<div class="meta">日時：${fmtDate(e.date)} ${esc(e.start||'終日')}〜${esc(e.end||'')}<br>場所：${esc(e.place||'未設定')}</div><h2>議題</h2><div class="box">${esc(e.agenda||'議題未登録').replace(/\n/g,'<br>')}</div><h2>前回決定事項</h2><div class="box">1. A薬剤を標準として継続<br>2. Day3採血を必要時へ変更<br>3. 新規パス候補の症例数を次回確認</div>`)}
  function printAgenda(id){const m=store.get('committeeMeetings',[]).find(x=>x.id===id);if(!m)return;printGenericAgenda({title:m.title,date:m.date,start:'15:00',end:'16:00',place:'大会議室',agenda:m.agenda})}
  function printMonthlyReport(){reportWindow('院内クリニカルパス 月次サマリー（2026年8月）','<div class="meta">対象月：2026年8月<br>公開状態：試作データ</div><h2>全体概要</h2><table><tr><th>登録パス数</th><th>適用件数</th><th>バリアンス率</th></tr><tr><td>128</td><td>1,256</td><td>12.4%</td></tr></table><h2>外科</h2><div class="box">肝切除術 15件／鼠径ヘルニア 10件／胃切除術 12件／胆嚢摘出術 18件</div>')}
  function printDoctorReport(){reportWindow('外科責任医師 確認資料','<div class="meta">対象：肝切除術パス／術後薬剤</div><h2>AI提案</h2><div class="ai">B薬剤への変更余地あり。ただし院内知識を踏まえるとA薬剤継続を優先。</div><h2>過去の院内知識</h2><div class="box">B薬剤では抗体保有例が多く、対象患者群ではA薬剤を優先する。</div><h2>責任医師確認欄</h2><div class="box">□ 承認　□ 条件付き承認　□ 却下　□ 保留<br><br>理由：________________________________________</div>')}

  window.Pathia={go:navigate,openWard(w){monthlyContext.ward=w;navigate('monthly')},remindWard(w){notify('月次実績の登録をお願いします',`${w}の2026年8月実績が未確定です。` ,w)},pathDetail,editMember,minutesImport,printCommittee,printAgenda,printMonthlyReport,printDoctorReport};

  $('#loginBtn').onclick=login; $('#logoutBtn').onclick=logout; $('#notificationBtn').onclick=e=>{e.stopPropagation();showNotifications()}; $('#profileBtn').onclick=renderProfile;
  $$('.nav-link[data-route="help"]').forEach(b=>b.onclick=()=>navigate('help'));
  restore();
})();
