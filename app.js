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
    doctor:{id:'doctor',label:'診療科パス責任者',role:'doctor',name:'診療科 パス責任医師',department:'診療科',ward:'',email:'path-doctor@example.local',permission:'パス責任者'},
    committee:{id:'committee',label:'委員会構成員',role:'committee',name:'クリニカルパス委員',department:'診療部',ward:'',email:'committee@example.local',permission:'委員会構成員'},
    viewer:{id:'viewer',label:'閲覧者',role:'viewer',name:'閲覧ユーザー',department:'院内',ward:'',email:'viewer@example.local',permission:'閲覧のみ'}
  };

  const DEFAULT_WARDS = [
    {id:'W5',code:'5F',name:'5階病棟',active:true,order:1},
    {id:'W6',code:'6F',name:'6階病棟',active:true,order:2},
    {id:'W7',code:'7F',name:'7階病棟',active:true,order:3},
    {id:'WICU',code:'ICU',name:'ICU',active:true,order:4}
  ];
  const DEFAULT_DEPTS = [
    '内科','呼吸器内科','消化器内科','循環器内科','糖尿病内科','小児科','外科','乳腺外科','整形外科','形成外科','脳神経外科','皮膚科','泌尿器科','産科','婦人科','眼科','耳鼻いんこう科','リハビリ','放射線科','集中治療科'
  ].map((name,i)=>({id:`D${String(i+1).padStart(2,'0')}`,code:`D${String(i+1).padStart(2,'0')}`,name,active:true,order:i+1}));
  function ensureMasters(){
    if(!store.get('wardMaster',null)) store.set('wardMaster',DEFAULT_WARDS);
    if(!store.get('deptMaster',null)) store.set('deptMaster',DEFAULT_DEPTS);
  }
  function getWardMaster(activeOnly=false){
    const rows=(store.get('wardMaster',DEFAULT_WARDS)||[]).slice().sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)||String(a.name).localeCompare(String(b.name),'ja'));
    return activeOnly?rows.filter(x=>x.active!==false):rows;
  }
  function getActiveWards(){return getWardMaster(true).map(x=>x.name)}
  function getDeptMaster(activeOnly=false){
    const rows=(store.get('deptMaster',DEFAULT_DEPTS)||[]).slice().sort((a,b)=>(Number(a.order)||999)-(Number(b.order)||999)||String(a.name).localeCompare(String(b.name),'ja'));
    return activeOnly?rows.filter(x=>x.active!==false):rows;
  }
  function getActiveDepts(){return getDeptMaster(true).map(x=>x.name)}
  function wardOptions(selected=''){
    const names=getActiveWards(); if(selected&&!names.includes(selected)) names.unshift(selected);
    return names.map(w=>`<option value="${esc(w)}" ${selected===w?'selected':''}>${esc(w)}${getActiveWards().includes(w)?'':'（無効）'}</option>`).join('');
  }
  function syncDeptMasterFromRows(rows){
    const master=getDeptMaster(false); const names=new Set(master.map(x=>x.name)); let changed=false;
    rows.forEach(r=>{const name=String(r['診療科']||r['診療科名']||r.department||'').trim();if(name&&!names.has(name)){master.push({id:uid('dept'),code:'',name,active:true,order:master.length+1});names.add(name);changed=true}});
    if(changed) store.set('deptMaster',master);
  }
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
    ['finance','💰','費用・収益',['office','doctor','committee','viewer']],
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
    ensureMasters();
    if(store.get('seeded', false)) return;
    const members = Object.values(ACCOUNTS).map(a=>({...a,active:true,title:a.role==='doctor'?'医長':a.role==='office'?'係長':'担当'}));
    store.set('members', members);
    store.set('publishedMonth','2026-07');
    store.set('notifications',[
      {id:uid('n'),title:'Pathia v0.2.3へようこそ',body:'この版は試作です。実患者情報は入力しないでください。',at:new Date().toISOString(),read:false}
    ]);
    store.set('events',[
      {id:'e1',title:'クリニカルパス委員会',date:'2026-09-03',start:'16:30',end:'17:30',type:'meeting',place:'第2会議室',notify:'committee',agenda:'1. クリニカルパスの変更について\n2. クリニカルパスの集計結果について\n3. その他',status:'予定'},
      {id:'e2',title:'8月実績入力締切',date:'2026-09-05',start:'',end:'',type:'deadline',place:'',notify:'ward',agenda:'8月分クリニカルパス実績を確定',status:'予定'},
      {id:'e3',title:'クリニカルパス研修',date:'2026-09-18',start:'14:00',end:'15:30',type:'training',place:'研修室',notify:'all',agenda:'クリニカルパス基礎・バリアンスの考え方',status:'予定'}
    ]);
    store.set('knowledge',[
      {id:'k1',date:'2026-07-12',path:'肝切除術パス',topic:'術後薬剤',source:'外科責任医師',type:'専門家意見',decision:'A薬剤を標準として継続',reason:'B薬剤では抗体保有例が多く、対象患者群ではA薬剤を優先する。',status:'有効'}
    ]);
    store.set('committeeMeetings',[
      {id:'CP202604',date:'2026-04-09',title:'令和8年度 4月クリニカルパス委員会',agenda:'年度運用確認／院内パス月次実績／継続検討事項',decisions:2,status:'開催済'},
      {id:'CP202605',date:'2026-05-14',title:'令和8年度 5月クリニカルパス委員会',agenda:'院内使用率／バリアンス逸脱内容／診療科別課題',decisions:3,status:'開催済'},
      {id:'CP202606',date:'2026-06-11',title:'令和8年度 6月クリニカルパス委員会',agenda:'院内月次実績／改訂進捗／新規検討事項',decisions:2,status:'開催済'},
      {id:'CP202607',date:'2026-07-09',title:'令和8年度 7月クリニカルパス委員会',agenda:'院内月次実績／責任医師意見／改訂状況',decisions:3,status:'開催済'},
      {id:'CP202608',date:'2026-08-13',title:'令和8年度 8月クリニカルパス委員会',agenda:'院内月次実績／バリアンス分析／前回決定事項の進捗',decisions:3,status:'開催済'},
      {id:'CP202609',sourceEventId:'e1',date:'2026-09-03',title:'令和8年度 9月クリニカルパス委員会',agenda:'1. クリニカルパスの変更について／2. クリニカルパスの集計結果について／3. その他',decisions:0,status:'予定'}
    ]);
    // demonstration records: one confirmed, one draft, two unstarted
    store.set(monthKey('2026-08','6階病棟'), sampleMonthly('2026-08','6階病棟','confirmed'));
    store.set(monthKey('2026-08','5階病棟'), sampleMonthly('2026-08','5階病棟','draft'));
    store.set('seeded', true);
  }
  function migrateScope011(){
    if(store.get('scope_v011', false)) return;
    const meetings = store.get('committeeMeetings', []);
    const monthly = [
      {id:'CP202604',date:'2026-04-09',title:'令和8年度 4月クリニカルパス委員会',agenda:'年度運用確認／院内パス月次実績／継続検討事項',decisions:2,status:'開催済'},
      {id:'CP202605',date:'2026-05-14',title:'令和8年度 5月クリニカルパス委員会',agenda:'院内使用率／バリアンス逸脱内容／診療科別課題',decisions:3,status:'開催済'},
      {id:'CP202606',date:'2026-06-11',title:'令和8年度 6月クリニカルパス委員会',agenda:'院内月次実績／改訂進捗／新規検討事項',decisions:2,status:'開催済'},
      {id:'CP202607',date:'2026-07-09',title:'令和8年度 7月クリニカルパス委員会',agenda:'院内月次実績／責任医師意見／改訂状況',decisions:3,status:'開催済'},
      {id:'CP202608',date:'2026-08-13',title:'令和8年度 8月クリニカルパス委員会',agenda:'院内月次実績／バリアンス分析／前回決定事項の進捗',decisions:3,status:'開催済'},
      {id:'CP202609',sourceEventId:'e1',date:'2026-09-03',title:'令和8年度 9月クリニカルパス委員会',agenda:'1. クリニカルパスの変更について／2. クリニカルパスの集計結果について／3. その他',decisions:0,status:'予定'}
    ];
    const byId = Object.fromEntries(meetings.map(x=>[x.id,x]));
    monthly.forEach(x=>byId[x.id]={...(byId[x.id]||{}),...x});
    store.set('committeeMeetings', Object.values(byId));
    const events = store.get('events', []);
    const i = events.findIndex(e=>e.id==='e1');
    const nextCommittee={id:'e1',title:'クリニカルパス委員会',date:'2026-09-03',start:'16:30',end:'17:30',type:'meeting',place:'第2会議室',notify:'committee',agenda:'1. クリニカルパスの変更について\n2. クリニカルパスの集計結果について\n3. その他',status:'予定'};
    if(i>=0) events[i]={...events[i],...nextCommittee}; else events.push(nextCommittee);
    store.set('events',events);
    store.set('scope_v011', true);
  }

  function monthKey(month,ward){ return `monthly_${month}_${ward}`; }
  function sampleMonthly(month,ward,status='draft'){
    const rows = (PATHS[ward]||[]).map((p,i)=>({path:p.name,dept:p.dept,cases:i===0?15:(i===1?10:8+i),variance:i===0?3:(i===1?0:1),patients:i===0?[{id:'DEMO-001',type:'入院期間延長'},{id:'DEMO-002',type:'薬剤変更'},{id:'DEMO-003',type:'患者要因'}]:(i===1?[]:[{id:`DEMO-00${i+3}`,type:'その他'}])}));
    return {month,ward,status,rows,lastSaved:new Date().toISOString(),confirmedAt:status==='confirmed'?new Date().toISOString():null,confirmedBy:status==='confirmed'?'6階病棟 担当者':null};
  }

  function login(){
    const id=$('#loginId').value, pw=$('#loginPassword').value;
    if(!ACCOUNTS[id] || pw!=='pathia0'){ alert('IDまたはパスワードが違います。'); return; }
    const savedMembers=store.get('members',[]); const saved=savedMembers.find(m=>m.id===id);
    currentUser = {...ACCOUNTS[id],...(saved||{})};
    store.set('session',id);
    $('#loginView').classList.add('hidden'); $('#appView').classList.remove('hidden');
    const activeWards=getActiveWards(); monthlyContext.ward=(currentUser.ward&&activeWards.includes(currentUser.ward))?currentUser.ward:(activeWards[0]||currentUser.ward||'');
    buildNav(); renderUser(); navigate('home');
  }
  function restore(){
    seed();
    migrateScope011();
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
    const m=MENU.find(x=>x[0]===r); $('#pageTitle').textContent=m?m[2]:(r==='help'?'使い方':'Pathia'); $('#pageEyebrow').textContent='Pathia v0.2.3';
    const renderers={home:renderHome,monthly:renderMonthly,officeMonthly:renderOfficeMonthly,analysis:renderAnalysis,finance:renderFinance,paths:renderPaths,ai:renderAI,knowledge:renderKnowledge,committee:renderCommittee,schedule:renderSchedule,reports:renderReports,import:renderImport,admin:renderAdmin,help:renderHelp};
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
    const myTask = currentUser.role==='ward' ? `<div class="notice ${getMonthlyStatus('2026-08',currentUser.ward)==='confirmed'?'success':'warning'}"><strong>${esc(currentUser.ward)}：8月実績</strong><br>${statusText(getMonthlyStatus('2026-08',currentUser.ward))}　締切：2026/09/05 <button class="btn sm primary" onclick="Pathia.go('monthly')">入力画面へ</button></div>` : currentUser.role==='office' ? `<div class="notice warning"><strong>事務局：8月実績回収状況</strong><br>${countStatuses('2026-08').confirmed}/${getActiveWards().length}部署 確定済　<button class="btn sm primary" onclick="Pathia.go('officeMonthly')">進捗を見る</button></div>` : '';
    setContent(`
      <div class="hero">
        <div><span class="pill blue">VERSION 0.2.3</span><h3>ようこそ、Pathiaへ</h3><p>院内クリニカルパスの実績、分析、委員会の判断、改訂履歴をつなぎ、よりよいパス運用を支援します。</p>${myTask}<div class="notice danger" style="margin-top:12px"><strong>試作環境</strong>：実患者情報は入力しないでください。画面上の患者IDは架空データのみ使用してください。</div></div>
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
        ${currentUser.role==='ward'?quick('📝','月次実績を登録','病棟の入力を保存・確定します','monthly'):quick('📊','パス分析','院内の病棟・診療科・パス別分析を確認します','analysis')}
        ${quick('🏥','パス委員会','会議資料・議事録・決定事項','committee')}
        ${quick('📅','スケジュール','会議・研修・締切を管理','schedule')}
        ${quick('📘','使い方を見る','権限別ガイドと用語説明','help')}
      </div>
      <div class="grid cards2" style="margin-top:18px">
        <div class="card"><div class="section-title" style="margin-top:0"><h3>近日の予定</h3><button class="btn sm outline" onclick="Pathia.go('schedule')">カレンダー</button></div>${eventList(3)}</div>
        <div class="card"><div class="section-title" style="margin-top:0"><h3>Pathiaからの気づき</h3><span class="pill blue">AI</span></div><div class="ai-box"><h4>院内パス：見直し候補があります</h4><p>使用率・前年度比較・バリアンス内容と、過去の責任医師判断や委員会決定を組み合わせて、診療科を問わず見直し候補を整理します。</p><button class="btn sm mint" onclick="Pathia.go('ai')">改善提案を見る</button></div></div>
      </div>
    `);
  }
  function quick(icon,title,sub,r){return `<button onclick="Pathia.go('${r}')"><span class="icon">${icon}</span><strong>${title}</strong><small>${sub}</small></button>`}
  function eventList(n=4){ return store.get('events',[]).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,n).map(e=>`<div class="list-row"><div><div class="maintext">${esc(e.title)}</div><div class="subtext">${fmtDate(e.date)} ${esc(e.start||'終日')} ${esc(e.place||'')}</div></div><span class="pill ${e.type==='deadline'?'red':e.type==='meeting'?'blue':e.type==='training'?'green':'yellow'}">${EVENT_TYPES[e.type]}</span></div>`).join(''); }

  function getMonthlyStatus(month,ward){ const r=store.get(monthKey(month,ward),null); return r?.status||'unstarted'; }
  function statusText(s){ return ({confirmed:'確定済',draft:'入力途中',unstarted:'未入力'})[s]||s; }
  function statusPill(s){ return `<span class="pill ${s==='confirmed'?'green':s==='draft'?'yellow':'red'}">${statusText(s)}</span>`; }
  function countStatuses(month){ const arr=getActiveWards().map(w=>getMonthlyStatus(month,w)); return {confirmed:arr.filter(x=>x==='confirmed').length,draft:arr.filter(x=>x==='draft').length,unstarted:arr.filter(x=>x==='unstarted').length}; }

  function renderMonthly(){
    const activeWards=getActiveWards();
    monthlyContext.ward = currentUser.role==='ward' ? (monthlyContext.ward||currentUser.ward) : monthlyContext.ward;
    if(!monthlyContext.ward || !activeWards.includes(monthlyContext.ward)) monthlyContext.ward=activeWards[0]||monthlyContext.ward||'';
    const rec=store.get(monthKey(monthlyContext.month,monthlyContext.ward),null) || {month:monthlyContext.month,ward:monthlyContext.ward,status:'unstarted',rows:(PATHS[monthlyContext.ward]||[]).map(p=>({path:p.name,dept:p.dept,code:p.code||'',cases:'',variance:'',patients:[],source:'preset'}))};
    setContent(`
      <div class="notice warning"><strong>試作版</strong>：患者IDは架空IDのみ入力してください。本番版では認証・DB・監査ログを実装します。</div>
      <div class="toolbar">
        <div class="left input-inline"><label style="margin:0">実績月 <input id="monthlyMonth" type="month" value="${esc(monthlyContext.month)}"></label><label style="margin:0">病棟 <select id="monthlyWard">${wardOptions(monthlyContext.ward)}</select></label></div>
        <div class="right"><button class="btn sm mint" id="addPathFromMaster">＋ パスマスタから追加</button>${statusPill(rec.status)}<span class="muted small">診療科はパスマスタから自動表示</span></div>
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
    $('#addPathFromMaster').onclick=()=>openPathMasterPicker();
    $('#saveDraft').onclick=()=>saveMonthly('draft',false);
    $('#saveLater').onclick=()=>{saveMonthly('draft',false);toast('途中保存しました。後で再開できます。');navigate('home')};
    $('#nextBtn').onclick=()=>handleNext();
    $('#confirmMonthly').onclick=()=>confirmMonthly();
  }
  function getImportedPathMaster(){
    return store.get('importedPaths',[]).map((p,i)=>({
      idx:i,
      code:String(p['CPコード']||p['パスコード']||p.path_code||'').trim(),
      io:String(p['入外区分']||p['入外']||'').trim(),
      dept:String(p['診療科']||p.department||'診療科未設定').trim(),
      name:String(p['パス項目名称']||p['パス名']||p.path_name||'名称未設定').trim()
    })).filter(p=>p.name && (p.dept==='診療科未設定'||getActiveDepts().includes(p.dept)));
  }
  function openPathMasterPicker(){
    const current=collectMonthly();
    const rec={...store.get(monthKey(current.month,current.ward),{}),...current,status:getMonthlyStatus(current.month,current.ward)==='confirmed'?'confirmed':'draft',lastSaved:new Date().toISOString()};
    store.set(monthKey(current.month,current.ward),rec);
    const master=getImportedPathMaster();
    if(!master.length){modal(`<h3>パスマスタがまだありません</h3><div class="notice warning">先に「データ取込」からパスCSVを取り込んでください。CSVはPathia用への事前変換なしで、そのまま読み込めます。</div>`,[{label:'データ取込へ',cls:'primary',fn:()=>{closeModal();navigate('import')}},{label:'閉じる',cls:'outline',fn:closeModal}]);return}
    const existing=new Set(rec.rows.map(r=>(r.code||'')+'|'+r.path));
    const rowHtml=p=>`<label class="picker-row" data-search="${esc((p.code+' '+p.dept+' '+p.name).toLowerCase())}"><input type="checkbox" class="pick-path" value="${p.idx}" ${existing.has(p.code+'|'+p.name)?'disabled':''}><span><strong>${esc(p.name)}</strong><small>${esc(p.dept)}${p.code?' ／ '+esc(p.code):''}${p.io?' ／ '+esc(p.io):''}</small></span>${existing.has(p.code+'|'+p.name)?'<span class="pill green">追加済</span>':''}</label>`;
    modal(`<h3>${esc(monthlyContext.ward)}：パスマスタから追加</h3><p class="muted small">取り込んだパスCSVから、この月に集計するパスを選択します。</p><label>検索<input id="pathPickerSearch" placeholder="CPコード・診療科・パス名で検索"></label><div id="pathPickerList" class="picker-list">${master.map(rowHtml).join('')}</div>`,[
      {label:'キャンセル',cls:'outline',fn:closeModal},
      {label:'選択したパスを追加',cls:'primary',fn:()=>{const picks=$$('.pick-path:checked',$('#modalRoot')).map(x=>master[Number(x.value)]).filter(Boolean);if(!picks.length){toast('追加するパスを選択してください。');return}const latest=store.get(monthKey(monthlyContext.month,monthlyContext.ward),rec);picks.forEach(p=>latest.rows.push({path:p.name,dept:p.dept,code:p.code,cases:'',variance:'',patients:[],source:'imported'}));latest.status=latest.status==='confirmed'?'confirmed':'draft';latest.lastSaved=new Date().toISOString();store.set(monthKey(monthlyContext.month,monthlyContext.ward),latest);closeModal();renderMonthly();toast(`${picks.length}件を月次入力対象に追加しました。`);}}
    ]);
    const q=$('#pathPickerSearch'); q.oninput=()=>{$$('.picker-row',$('#pathPickerList')).forEach(el=>el.style.display=el.dataset.search.includes(q.value.toLowerCase())?'':'none')};
  }
  function renderPathForm(rec){
    const root=$('#pathsForm'); root.innerHTML='';
    const locked=rec.status==='confirmed' && currentUser.role!=='office';
    rec.rows.forEach((row,idx)=>{
      const c=document.createElement('div'); c.className='path-card'; c.dataset.idx=idx;
      c.innerHTML=`<div class="path-head"><div><h4>${esc(row.path)}</h4><span class="muted small">診療科：${esc(row.dept)}${row.code?' ／ '+esc(row.code):''}</span></div><div class="right"><span class="pill ${Number(row.variance)>0?'yellow':'green'}">${row.variance===''?'未入力':`バリアンス ${row.variance}件`}</span>${!locked?`<button class="btn sm outline remove-monthly-path" title="この月の入力対象から外す">削除</button>`:''}</div></div>
        <div class="path-body"><div class="path-fields"><label>実施件数<input class="cases" type="number" min="0" value="${esc(row.cases)}" ${locked?'disabled':''}></label><label>うちバリアンス発生件数<input class="variance" type="number" min="0" value="${esc(row.variance)}" ${locked?'disabled':''}></label></div><div class="variance-list"></div></div>`;
      root.appendChild(c); renderVarianceRows(c,row,locked);
      const rm=$('.remove-monthly-path',c); if(rm) rm.onclick=()=>{const current=collectMonthly();current.rows.splice(idx,1);store.set(monthKey(current.month,current.ward),{...current,status:rec.status==='confirmed'?'confirmed':'draft',lastSaved:new Date().toISOString()});renderMonthly();};
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
  function goNextWard(){ const wards=getActiveWards(); if(!wards.length){toast('有効な病棟がありません。管理画面で病棟を登録してください。');return} const i=wards.indexOf(monthlyContext.ward); monthlyContext.ward=wards[(Math.max(i,0)+1)%wards.length]; renderMonthly(); }
  function confirmMonthly(){
    const v=validateMonthly(true); if(!v.ok){toast('未入力・エラー箇所を確認してください。');return}
    modal(`<h3>${esc(monthlyContext.month)} ${esc(monthlyContext.ward)} 実績を確定しますか？</h3><div class="notice warning">確定すると事務局の月次集計へ連携されます。通常利用者からは修正できなくなります。</div>`,[
      {label:'キャンセル',cls:'outline',fn:closeModal},{label:'確定する',cls:'primary',fn:()=>{const rec=saveMonthly('confirmed',false);rec.confirmedAt=new Date().toISOString();rec.confirmedBy=currentUser.name;store.set(monthKey(rec.month,rec.ward),rec);notify(`${rec.ward} ${rec.month}実績が確定しました`,`${currentUser.name} が確定しました。`,'office');closeModal();renderMonthly();}}
    ]);
  }

  function renderOfficeMonthly(){
    const month='2026-08', wards=getActiveWards(), s=countStatuses(month); const confirmedPct=wards.length?Math.round(s.confirmed/wards.length*100):0;
    setContent(`
      <div class="grid cards4"><div class="stat blue"><div class="label">対象部署</div><div class="value">${wards.length}</div></div><div class="stat mint"><div class="label">確定済</div><div class="value">${s.confirmed}</div></div><div class="stat cream"><div class="label">入力途中</div><div class="value">${s.draft}</div></div><div class="stat lav"><div class="label">未入力</div><div class="value">${s.unstarted}</div></div></div>
      <div class="card" style="margin-top:16px"><div class="toolbar"><div><h3 style="margin:0">${month} 実績 登録状況</h3><div class="muted small">締切：2026/09/05　確定率 ${confirmedPct}%</div></div><div class="right"><button class="btn cream" id="testReminder">前日通知を試す</button><button class="btn primary" id="publishMonth">月次更新・公開</button></div></div><div class="progress"><span style="width:${confirmedPct}%"></span></div></div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>部署</th><th>状態</th><th>最終保存</th><th>確定日時</th><th>確定者</th><th>操作</th></tr></thead><tbody>${wards.map(w=>{const r=store.get(monthKey(month,w),null),st=r?.status||'unstarted';return `<tr><td><strong>${esc(w)}</strong></td><td>${statusPill(st)}</td><td>${r?.lastSaved?new Date(r.lastSaved).toLocaleString('ja-JP'):'―'}</td><td>${r?.confirmedAt?new Date(r.confirmedAt).toLocaleString('ja-JP'):'―'}</td><td>${esc(r?.confirmedBy||'―')}</td><td><button class="btn sm outline" onclick="Pathia.openWard('${esc(w)}')">内容確認</button> ${st!=='confirmed'?`<button class="btn sm cream" onclick="Pathia.remindWard('${esc(w)}')">通知</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="6" class="muted">有効な病棟がありません。管理 → 病棟マスタから追加してください。</td></tr>'}</tbody></table></div>
      <div class="notice warning" style="margin-top:16px"><strong>本番想定：</strong>締切前日に「未入力」「入力途中」の部署だけへ自動通知。無効にした病棟は新しい月次回収の対象から外し、過去データは保持します。</div>
    `);
    $('#testReminder').onclick=()=>sendDeadlineReminders(month);
    $('#publishMonth').onclick=()=>publishMonthly(month);
  }

  function sendDeadlineReminders(month){ const pending=getActiveWards().filter(w=>getMonthlyStatus(month,w)!=='confirmed'); pending.forEach(w=>notify(`${month}実績の締切は明日です`,`${w}の実績が未確定です。入力内容を確認し確定してください。`,w)); notify(`事務局：明日締切 未確定${pending.length}部署`,pending.join('、')||'未確定部署はありません。','office'); toast(`${pending.length}部署への前日通知を作成しました。`); }
  function publishMonthly(month){ const wards=getActiveWards(), s=countStatuses(month); if(!wards.length){toast('有効な病棟がありません。');return} if(s.confirmed<wards.length){modal(`<h3>まだ公開できません</h3><div class="notice danger">未確定部署が ${wards.length-s.confirmed} 部署あります。</div><p>全ての部署が確定してから月次更新してください。</p>`,[{label:'閉じる',cls:'primary',fn:closeModal}]);return} store.set('publishedMonth',month); notify(`${month}実績を公開しました`,'院内ダッシュボード・分析画面へ反映されました。','all'); modal(`<div class="complete-panel"><div class="complete-icon">✓</div><h3>月次更新の処理が完了しました</h3><p><strong>${month}</strong> の確定済み実績を院内ダッシュボード・分析画面へ反映しました。</p><div class="notice success">公開後は閲覧権限のある利用者が当月結果を確認できます。</div></div>`,[{label:'分析結果を見る',cls:'outline',fn:()=>{closeModal();navigate('analysis')}},{label:'完了',cls:'primary',fn:()=>{closeModal();renderOfficeMonthly()}}]); }

  function renderAnalysis(){
    const saved=store.get('analysisFilters',{period:'2026-05',ward:'全体',dept:'全体',path:'全体'});
    const period=ANALYSIS_PERIODS[saved.period]||ANALYSIS_PERIODS['2026-05'];
    const wardNames=getActiveWards(); const wards=['全体',...new Set([...Object.keys(period.wards).filter(x=>x!=='全体'&&wardNames.includes(x)),...wardNames])];
    const deptNames=getActiveDepts(); const depts=['全体',...new Set([...Object.keys(period.depts).filter(x=>x!=='全体'&&deptNames.includes(x)),...deptNames])];
    const paths=['全体',...new Set(VARIANCE_RECORDS.map(x=>x.path))];
    const filteredVariances=VARIANCE_RECORDS.filter(v=>(saved.ward==='全体'||v.ward===saved.ward|| (saved.ward==='ICU'&&v.ward==='ICU・CCU')) && (saved.dept==='全体'||v.dept===saved.dept) && (saved.path==='全体'||v.path===saved.path));
    let stat=(saved.dept!=='全体'?period.depts[saved.dept]:null)||(saved.ward!=='全体'?period.wards[saved.ward]:null)||((saved.dept!=='全体'||saved.ward!=='全体')?{used:0,discharged:0,rate:0,prev:null}:period.wards['全体']);
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
        <div class="toolbar"><div><h3 style="margin:0">クリニカルパス分析</h3><div class="muted small">会議資料で使用している「使用率」「前年度比較」「バリアンス逸脱内容」をPathia上で確認する試作です。</div></div><span class="pill blue">VERSION 0.2.3</span></div>
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


  function getCostData(){
    const imported=store.get('costData',[]); if(imported.length)return imported;
    return [
      {'年度':'2026','月':'8','診療科':'外科','パスコード':'CP-DEMO-001','パス名':'肝切除術パス','症例数':'15','1症例当たり収益':'980000','1症例当たり原価':'730000','薬剤費':'85000','検査費':'42000','材料費':'180000','平均在院日数':'9.2','標準在院日数':'8'},
      {'年度':'2026','月':'8','診療科':'外科','パスコード':'CP-DEMO-002','パス名':'鼠径ヘルニアパス','症例数':'10','1症例当たり収益':'420000','1症例当たり原価':'260000','薬剤費':'26000','検査費':'18000','材料費':'54000','平均在院日数':'2.8','標準在院日数':'3'},
      {'年度':'2026','月':'8','診療科':'循環器内科','パスコード':'CP001108','パス名':'経皮的冠動脈インターベンション（PCI3泊4日）','症例数':'18','1症例当たり収益':'760000','1症例当たり原価':'590000','薬剤費':'98000','検査費':'46000','材料費':'210000','平均在院日数':'4.3','標準在院日数':'4'},
      {'年度':'2026','月':'8','診療科':'整形外科','パスコード':'CP001038','パス名':'【R5】腰椎手術','症例数':'12','1症例当たり収益':'1100000','1症例当たり原価':'890000','薬剤費':'72000','検査費':'52000','材料費':'360000','平均在院日数':'15.1','標準在院日数':'14'}
    ];
  }
  function renderFinance(){
    const all=getCostData();
    const saved=store.get('financeFilter',{dept:'全体',path:'全体'});
    const depts=['全体',...new Set(all.map(x=>x['診療科']).filter(Boolean))];
    const paths=['全体',...new Set(all.filter(x=>saved.dept==='全体'||x['診療科']===saved.dept).map(x=>x['パス名']).filter(Boolean))];
    const rows=all.filter(x=>(saved.dept==='全体'||x['診療科']===saved.dept)&&(saved.path==='全体'||x['パス名']===saved.path));
    const num=(x,k)=>Number(String(x[k]||0).replace(/,/g,''))||0;
    const cases=rows.reduce((s,x)=>s+num(x,'症例数'),0);
    const revenue=rows.reduce((s,x)=>s+num(x,'症例数')*num(x,'1症例当たり収益'),0);
    const cost=rows.reduce((s,x)=>s+num(x,'症例数')*num(x,'1症例当たり原価'),0);
    const margin=revenue-cost; const mr=revenue?margin/revenue*100:0;
    const yen=v=>Math.round(v).toLocaleString('ja-JP')+'円';
    const maxMargin=Math.max(1,...rows.map(x=>num(x,'1症例当たり収益')-num(x,'1症例当たり原価')));
    setContent(`
      <div class="notice warning"><strong>費用・収益はデモ：</strong>この画面の金額は架空データです。臨床的妥当性を費用だけで判断せず、責任医師・委員会の判断を優先する設計です。</div>
      <div class="card" style="margin-top:14px"><div class="toolbar"><div><h3 style="margin:0">費用対効果・収益分析</h3><div class="muted small">費用CSVを取り込むと、診療科・パス別に収益、原価、粗い収支差、在院日数を比較する想定です。</div></div><span class="pill blue">VERSION 0.2.3</span></div><div class="analysis-filter-grid"><label>診療科<select id="finDept">${depts.map(v=>`<option ${saved.dept===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label><label>パス名<select id="finPath">${paths.map(v=>`<option ${saved.path===v?'selected':''}>${esc(v)}</option>`).join('')}</select></label></div></div>
      <div class="grid cards4" style="margin-top:16px"><div class="stat blue"><div class="label">対象症例数</div><div class="value">${cases}<small> 件</small></div></div><div class="stat mint"><div class="label">推計収益</div><div class="value money">${yen(revenue)}</div></div><div class="stat cream"><div class="label">推計原価</div><div class="value money">${yen(cost)}</div></div><div class="stat lav"><div class="label">収支差（参考）</div><div class="value money">${yen(margin)}</div><div class="subtext">収支差率 ${mr.toFixed(1)}%</div></div></div>
      <div class="grid cards2" style="margin-top:16px"><div class="card"><h3>1症例当たり収支差</h3>${rows.map(x=>{const m=num(x,'1症例当たり収益')-num(x,'1症例当たり原価');return `<div class="finance-bar"><div class="finance-label"><span>${esc(x['パス名'])}</span><b>${yen(m)}</b></div><div class="bar"><i style="width:${Math.max(4,m/maxMargin*100)}%"></i></div></div>`}).join('')||'<p class="muted">該当なし</p>'}</div><div class="card"><h3>Pathia 費用対効果メモ（デモ）</h3><div class="ai-box"><p>・標準在院日数との差が大きいパスは、バリアンス内容と合わせて要因確認。</p><p>・薬剤・検査・材料費の差は「削減候補」ではなく「確認候補」として表示。</p><p>・薬剤変更等は、過去の責任医師判断・委員会決定を必ず参照して提案します。</p></div></div></div>
      <div class="table-wrap" style="margin-top:16px"><table><thead><tr><th>診療科</th><th>パス名</th><th>症例数</th><th>1症例収益</th><th>1症例原価</th><th>収支差</th><th>薬剤費</th><th>検査費</th><th>材料費</th><th>平均/標準在院日数</th></tr></thead><tbody>${rows.map(x=>{const m=num(x,'1症例当たり収益')-num(x,'1症例当たり原価');return `<tr><td>${esc(x['診療科'])}</td><td>${esc(x['パス名'])}</td><td>${num(x,'症例数')}</td><td>${yen(num(x,'1症例当たり収益'))}</td><td>${yen(num(x,'1症例当たり原価'))}</td><td><strong>${yen(m)}</strong></td><td>${yen(num(x,'薬剤費'))}</td><td>${yen(num(x,'検査費'))}</td><td>${yen(num(x,'材料費'))}</td><td>${esc(x['平均在院日数'])}日 / ${esc(x['標準在院日数'])}日</td></tr>`}).join('')}</tbody></table></div>
    `);
    $('#finDept').onchange=e=>{store.set('financeFilter',{dept:e.target.value,path:'全体'});renderFinance()};
    $('#finPath').onchange=e=>{store.set('financeFilter',{...saved,path:e.target.value});renderFinance()};
  }

  function renderPaths(){
    const all=[...Object.values(PATHS).flat(),...store.get('importedPaths',[]).map(p=>({name:p['パス項目名称']||p['パス名']||p.path_name||'名称未設定',dept:p['診療科']||p.department||'診療科未設定',code:p['CPコード']||p['パスコード']||p.path_code||'',io:p['入外区分']||'',created:p['作成日']||'',updated:p['更新日']||'',imported:true}))];
    setContent(`<div class="toolbar"><div><h3 style="margin:0">院内クリニカルパス一覧</h3><div class="muted small">正式パスの編集は別端末。Pathiaでは実績・分析・履歴を統合します。</div></div><input id="pathSearch" placeholder="パス名・診療科で検索" style="max-width:320px"></div><div id="pathList" class="grid cards3"></div>`);
    const draw=q=>{const filtered=all.filter(p=>(p.name+p.dept).includes(q||''));$('#pathList').innerHTML=filtered.map(p=>`<div class="card"><div class="toolbar"><span class="pill blue">${esc(p.dept)}</span>${p.imported?'<span class=\"pill green\">取込</span>':''}</div><h3 style="margin-top:10px">${esc(p.name)}</h3>${p.code?`<div class="muted small">${esc(p.code)}${p.io?'／'+esc(p.io):''}</div>`:''}<p class="muted small">実績／バリアンス／委員会／改訂履歴をPathiaで参照</p>${p.updated?`<div class="muted small">更新日：${esc(p.updated)}</div>`:''}<button class="btn sm outline" onclick="Pathia.pathDetail('${esc(p.name)}')">詳細を見る</button></div>`).join('')}; draw(''); $('#pathSearch').oninput=e=>draw(e.target.value);
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
    const next=ms.filter(m=>m.status!=='開催済').sort((a,b)=>a.date.localeCompare(b.date))[0];
    setContent(`
      <div class="grid cards3"><div class="stat blue"><div class="label">開催頻度</div><div class="value" style="font-size:22px">月1回</div></div><div class="stat mint"><div class="label">次回委員会</div><div class="value" style="font-size:22px">${next?fmtDate(next.date).replace(/2026年/,''):'未定'}</div></div><div class="stat cream"><div class="label">今年度会議履歴</div><div class="value">${ms.length}</div></div></div>
      <div class="toolbar"><div><h3 style="margin:0">クリニカルパス委員会</h3><div class="muted small">月1回の委員会について、院内全診療科の会議資料・議事録・決定事項・院内知識を1か所で確認</div></div><div class="right"><button class="btn outline" id="minutesTemplate">議事録CSVテンプレート</button><button class="btn primary" onclick="Pathia.go('schedule')">会議を登録</button></div></div>
      <div class="grid cards2">${ms.map(m=>`<div class="card"><span class="pill ${m.status==='開催済'?'green':'blue'}">${esc(m.status)}</span><h3 style="margin-top:10px">${esc(m.title)}</h3><p>${fmtDate(m.date)}</p><p class="muted small">${esc(m.agenda)}</p><div class="toolbar"><div class="left"><button class="btn sm outline" onclick="Pathia.printAgenda('${m.id}')">レジュメ</button><button class="btn sm primary" onclick="Pathia.printCommittee('${m.id}')">委員会資料PDF</button></div><button class="btn sm mint" onclick="Pathia.minutesImport('${m.id}')">議事録取込</button></div></div>`).join('')}</div>
      <div class="section-title"><h3>前回決定事項の進捗（院内）</h3></div><div class="table-wrap"><table><thead><tr><th>診療科・対象</th><th>決定事項</th><th>状態</th></tr></thead><tbody><tr><td>外科／肝切除術パス</td><td>A薬剤を標準として継続</td><td><span class="pill green">院内知識登録済</span></td></tr><tr><td>整形外科／腰椎手術パス</td><td>バリアンス内容を継続確認</td><td><span class="pill yellow">経過確認</span></td></tr><tr><td>産科／帝王切開パス</td><td>退院延期理由を月次で確認</td><td><span class="pill blue">今回再検討</span></td></tr></tbody></table></div>
    `);
    $('#minutesTemplate').onclick=downloadMinutesTemplate;
  }
  function downloadMinutesTemplate(){
    const csv='meeting_id,meeting_date,committee,department,path_name,topic,comment_type,speaker_role,comment,decision,decision_type,status,knowledge_register\nCP202609,2026-09-10,クリニカルパス委員会,診療科名,パス名,検討事項,責任医師意見,パス責任医師,ここに意見,ここに決定内容,正式決定,反映待ち,する\n'; downloadBlob(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),'Pathia_議事録取込テンプレート.csv');
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
    setContent(`<div class="toolbar"><div class="left"><button class="btn outline" id="prevMonth">←</button><h3 style="margin:0">${y}年 ${m+1}月</h3><button class="btn outline" id="nextMonth">→</button></div><button class="btn primary" id="addEvent">＋ 予定を登録</button></div><div class="legend"><span class="pill blue">会議</span> <span class="pill green">研修</span> <span class="pill yellow">学会</span> <span class="pill red">締切</span></div><div class="notice success" style="margin-top:12px">予定をクリックすると、内容確認・変更・削除ができます。会議はレジュメ作成も利用できます。</div><div class="calendar" id="calendar" style="margin-top:12px"></div>`);
    drawCalendar(); $('#prevMonth').onclick=()=>{calCursor=new Date(y,m-1,1);renderSchedule()}; $('#nextMonth').onclick=()=>{calCursor=new Date(y,m+1,1);renderSchedule()}; $('#addEvent').onclick=()=>eventModal();
  }
  function drawCalendar(){
    const root=$('#calendar'), y=calCursor.getFullYear(),m=calCursor.getMonth(),first=new Date(y,m,1),start=first.getDay(),days=new Date(y,m+1,0).getDate(),prevDays=new Date(y,m,0).getDate();
    root.innerHTML=['日','月','火','水','木','金','土'].map(d=>`<div class="cal-head">${d}</div>`).join(''); const events=store.get('events',[]);
    for(let i=0;i<42;i++){ let d=i-start+1, dateObj, muted=false; if(d<1){dateObj=new Date(y,m-1,prevDays+d);muted=true}else if(d>days){dateObj=new Date(y,m+1,d-days);muted=true}else dateObj=new Date(y,m,d); const ds=`${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`; const ev=events.filter(e=>e.date===ds); const cell=document.createElement('div');cell.className='day'+(muted?' mutedday':'');cell.innerHTML=`<div class="daynum">${dateObj.getDate()}</div>${ev.map(e=>`<div class="event ${e.type}" data-id="${e.id}" title="クリックで確認・変更">${esc(e.title)}</div>`).join('')}`;cell.ondblclick=()=>eventModal(ds);root.appendChild(cell);$$('.event',cell).forEach(el=>el.onclick=()=>viewEvent(el.dataset.id)); }
  }
  function eventModal(prefill=todayISO(),eventId=null){
    const existing=eventId?store.get('events',[]).find(x=>x.id===eventId):null; const e=existing||{type:'meeting',date:prefill,start:'',end:'',place:'',notify:'all',title:'',agenda:''};
    modal(`<h3>${existing?'スケジュール変更':'スケジュール登録'}</h3><div class="form-grid"><label>カテゴリー<select id="evType">${Object.entries(EVENT_TYPES).map(([k,v])=>`<option value="${k}" ${e.type===k?'selected':''}>${v}</option>`).join('')}</select></label><label>日付<input id="evDate" type="date" value="${esc(e.date||prefill)}"></label><label>開始時刻<input id="evStart" type="time" value="${esc(e.start||'')}"></label><label>終了時刻<input id="evEnd" type="time" value="${esc(e.end||'')}"></label><label>場所<input id="evPlace" value="${esc(e.place||'')}" placeholder="会議室・オンライン等"></label><label>通知<select id="evNotify"><option value="all" ${e.notify==='all'?'selected':''}>登録者全員へ通知</option><option value="none" ${e.notify==='none'?'selected':''}>通知なし</option><option value="committee" ${e.notify==='committee'?'selected':''}>委員会構成員へ通知</option><option value="ward" ${e.notify==='ward'?'selected':''}>病棟パス係へ通知</option><option value="specific" ${e.notify==='specific'?'selected':''}>特定の人へ通知</option></select></label><label class="full">件名<input id="evTitle" value="${esc(e.title||'')}" placeholder="例：クリニカルパス委員会"></label><label class="full">内容・議題<textarea id="evAgenda" placeholder="議題、目的、連絡事項">${esc(e.agenda||'')}</textarea></label><div class="full" id="resumeHint"></div></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:existing?'変更を保存':'登録',cls:'primary',fn:()=>saveEvent(eventId)}]);
    const update=()=>$('#resumeHint').innerHTML=$('#evType').value==='meeting'?'<div class="notice success">会議として登録すると、レジュメ作成・委員会ページとの連携が利用できます。</div>':''; $('#evType').onchange=update;update();
  }
  function saveEvent(eventId=null){
    const e={id:eventId||uid('e'),type:$('#evType').value,date:$('#evDate').value,start:$('#evStart').value,end:$('#evEnd').value,place:$('#evPlace').value,notify:$('#evNotify').value,title:$('#evTitle').value||EVENT_TYPES[$('#evType').value],agenda:$('#evAgenda').value,status:'予定'};
    const es=store.get('events',[]), idx=es.findIndex(x=>x.id===e.id); if(idx>=0) es[idx]={...es[idx],...e}; else es.push(e); store.set('events',es);
    if(e.notify!=='none') notify(eventId?`予定を変更：${e.title}`:`予定を登録：${e.title}`,`${fmtDate(e.date)} ${e.start||'終日'} ${e.place||''}`,e.notify);
    const meetingId=`CP${e.date.replaceAll('-','')}`; const ms=store.get('committeeMeetings',[]); const oldMeetingIndex=ms.findIndex(x=>x.sourceEventId===e.id||x.id===meetingId);
    if(e.type==='meeting'){
      const obj={id:oldMeetingIndex>=0?ms[oldMeetingIndex].id:meetingId,sourceEventId:e.id,date:e.date,title:e.title,agenda:e.agenda,decisions:oldMeetingIndex>=0?(ms[oldMeetingIndex].decisions||0):0,status:'予定'};
      if(oldMeetingIndex>=0) ms[oldMeetingIndex]={...ms[oldMeetingIndex],...obj}; else ms.push(obj);
    }else if(oldMeetingIndex>=0 && ms[oldMeetingIndex].status==='予定'){ms.splice(oldMeetingIndex,1)}
    store.set('committeeMeetings',ms); closeModal();renderSchedule();toast(eventId?'予定を変更しました。':'予定を登録しました。');
  }
  function viewEvent(id){const e=store.get('events',[]).find(x=>x.id===id);if(!e)return;modal(`<h3>${esc(e.title)}</h3><p>${fmtDate(e.date)}　${esc(e.start||'終日')}〜${esc(e.end||'')}</p><p><strong>カテゴリー：</strong>${esc(EVENT_TYPES[e.type]||e.type)}</p><p><strong>場所：</strong>${esc(e.place||'未設定')}</p><p><strong>内容：</strong>${esc(e.agenda||'未設定').replace(/\n/g,'<br>')}</p><p><strong>通知：</strong>${esc(e.notify)}</p>${e.type==='meeting'?'<div class="notice success">この予定は会議です。レジュメを作成できます。</div>':''}`,[{label:'閉じる',cls:'outline',fn:closeModal},{label:'削除',cls:'danger',fn:()=>confirmDeleteEvent(id)},{label:'変更',cls:'mint',fn:()=>{closeModal();eventModal(e.date,id)}},...(e.type==='meeting'?[{label:'レジュメ作成',cls:'primary',fn:()=>{closeModal();printGenericAgenda(e)}}]:[])]);}
  function confirmDeleteEvent(id){const e=store.get('events',[]).find(x=>x.id===id);if(!e)return;modal(`<h3>予定を削除しますか？</h3><div class="notice danger"><strong>${esc(e.title)}</strong><br>${fmtDate(e.date)} ${esc(e.start||'終日')}</div><p>削除した予定はカレンダーから消えます。</p>`,[{label:'キャンセル',cls:'outline',fn:()=>viewEvent(id)},{label:'削除する',cls:'danger',fn:()=>deleteEvent(id)}])}
  function deleteEvent(id){const es=store.get('events',[]), e=es.find(x=>x.id===id);store.set('events',es.filter(x=>x.id!==id));if(e){const ms=store.get('committeeMeetings',[]);store.set('committeeMeetings',ms.filter(x=>!(x.sourceEventId===id&&x.status==='予定')));notify(`予定を削除：${e.title}`,`${fmtDate(e.date)} の予定を削除しました。`,'office')}closeModal();renderSchedule();toast('予定を削除しました。')}


  function renderReports(){
    setContent(`
      <div class="grid cards3">
        <div class="card"><span class="pill blue">会議</span><h3>会議資料作成</h3><p class="muted small">レジュメを編集し、作成見本を確認してからPDF保存・印刷できます。</p><div class="toolbar"><button class="btn primary" onclick="Pathia.editAgenda('CP202609')">レジュメを作成・修正</button><button class="btn outline" onclick="Pathia.printCommittee('CP202609')">集計資料見本</button></div></div>
        <div class="card"><span class="pill green">月次</span><h3>院内パス月次サマリー</h3><p class="muted small">診療科・病棟別の件数、使用率、前年度比較、バリアンスを掲載。</p><button class="btn outline" onclick="Pathia.printMonthlyReport()">作成見本・印刷</button></div>
        <div class="card"><span class="pill yellow">別添</span><h3>バリアンス分析資料</h3><p class="muted small">診療科・パス・病棟・コード・逸脱内容を一覧化。委員会別添を想定。</p><button class="btn outline" onclick="Pathia.printVarianceReport()">作成見本・印刷</button></div>
        <div class="card"><span class="pill purple">費用</span><h3>費用・収益分析資料</h3><p class="muted small">費用CSVのデモデータから、収益・原価・収支差をまとめます。</p><button class="btn outline" onclick="Pathia.printFinanceReport()">作成見本・印刷</button></div>
        <div class="card"><span class="pill blue">確認用</span><h3>パス責任医師確認資料</h3><p class="muted small">AI提案・根拠・院内知識・判断欄をまとめます。</p><button class="btn outline" onclick="Pathia.printDoctorReport()">作成見本・印刷</button></div>
      </div>
      <div class="notice success" style="margin-top:16px"><strong>VERSION 0.2：</strong>「作成見本」を別画面で表示し、その画面から <strong>印刷／PDFに保存</strong> できます。レジュメはPathia内で編集・保存できます。</div>
    `);
  }

  function editAgenda(id){
    const meetings=store.get('committeeMeetings',[]); const m=meetings.find(x=>x.id===id)||{id,title:'クリニカルパス委員会',date:'2026-09-03',agenda:'1. クリニカルパスの変更について\n2. クリニカルパスの集計結果について\n3. その他'};
    const saved=store.get(`agenda_${id}`,null)||{};
    modal(`<h3>クリニカルパス委員会 レジュメ作成</h3><div class="notice success">入力内容を修正して「作成見本を表示」を押すと、印刷用レジュメを確認できます。</div><div class="form-grid"><label>開催日<input id="agDate" type="date" value="${esc(saved.date||m.date)}"></label><label>開始時刻<input id="agTime" type="time" value="${esc(saved.time||'16:30')}"></label><label>会場<input id="agPlace" value="${esc(saved.place||'第2会議室')}"></label><label>次回予定<input id="agNext" value="${esc(saved.next||'令和8年10月1日（木）16時30分～')}"></label><label class="full">議題<textarea id="agAgenda" rows="7">${esc(saved.agenda||m.agenda||'1. クリニカルパスの変更について\n2. クリニカルパスの集計結果について\n3. その他')}</textarea></label><label class="full">構成員・連絡事項<textarea id="agMembers" rows="5">${esc(saved.members||'診療部門／コメディカル部門／看護部門／事務部門の委員')}</textarea></label></div>`,[
      {label:'キャンセル',cls:'outline',fn:closeModal},
      {label:'保存',cls:'mint',fn:()=>saveAgenda(id,false)},
      {label:'作成見本を表示',cls:'primary',fn:()=>saveAgenda(id,true)}
    ]);
  }
  function saveAgenda(id,preview){const v={date:$('#agDate').value,time:$('#agTime').value,place:$('#agPlace').value,next:$('#agNext').value,agenda:$('#agAgenda').value,members:$('#agMembers').value};store.set(`agenda_${id}`,v);toast('レジュメを保存しました。');if(preview){closeModal();printEditableAgenda(id,v)}}
  function printEditableAgenda(id,v){
    const agenda=esc(v.agenda).replace(/\n/g,'<br>'); const members=esc(v.members).replace(/\n/g,'<br>');
    reportWindow('クリニカルパス委員会 レジュメ',`<div class="agenda-head"><div>${fmtDate(v.date)}</div><div>構　成　員　各　位<br>委　員　長</div></div><h2 style="text-align:center;border:0">クリニカルパス委員会</h2><table class="agenda-table"><tr><th>日　時</th><td>${fmtDate(v.date)} ${esc(v.time)}～</td></tr><tr><th>会　場</th><td>${esc(v.place)}</td></tr><tr><th>議題等</th><td>${agenda}</td></tr><tr><th>次　回</th><td>${esc(v.next)}</td></tr></table><h2>構成員</h2><div class="box">${members}</div>`)
  }

  let pendingImport={type:'',rows:[],fileName:'',periodFrom:'',periodTo:''};
  function renderImport(){
    const hist=store.get('importHistory',[]).slice().reverse();
    setContent(`
      <div class="notice danger"><strong>試作版：</strong>実患者情報・院内機密はアップロードしないでください。CSVは架空・匿名化データで試してください。</div>
      <div class="card" style="margin-top:14px"><h3>取込・出力期間</h3><div class="analysis-filter-grid"><label>開始月<input id="impFrom" type="month" value="2026-04"></label><label>終了月<input id="impTo" type="month" value="2026-08"></label></div><p class="muted small">選択した期間を取込履歴・CSV出力名に記録します。</p></div>
      <div class="grid cards2" style="margin-top:16px">
        <div class="card"><span class="pill blue">実績</span><h3>病院ダッシュボード／実績CSV</h3><p class="muted small">症例数、在院日数、使用率などの集計済み・匿名化データ。</p><input id="dashFile" type="file" accept=".csv,text/csv"><div id="dashPreview"></div></div>
        <div class="card"><span class="pill green">パスマスタ</span><h3>パスCSVをそのまま取り込む</h3><p class="muted small"><strong>CSVはPathia用への変換不要。</strong> CPコード／入外区分／診療科／パス項目名称／作成日／更新日を自動認識します。Excel（.xlsx）も対応。取り込んだパスは「院内パス」と「月次実績登録」のパスマスタ選択に反映されます。</p><input id="pathFile" type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"><div id="pathPreview"></div><div class="toolbar" style="margin-top:10px"><button class="btn sm outline" onclick="Pathia.downloadPathTemplate()">パスCSV見本を取り出す</button><span class="muted small">Excelは先頭シートを読み込みます。</span></div></div>
        <div class="card"><span class="pill yellow">費用</span><h3>費用・収益データを取り込む</h3><p class="muted small">症例数、1症例当たり収益・原価、薬剤費、検査費、材料費、在院日数など。</p><input id="costFile" type="file" accept=".csv,text/csv"><div id="costPreview"></div><button class="btn sm outline" style="margin-top:10px" onclick="Pathia.downloadCostTemplate()">費用CSV見本を取り出す</button></div>
        <div class="card"><span class="pill purple">議事録</span><h3>議事録CSV</h3><p class="muted small">議事録Excelのマクロから出力したCSVを取り込み、委員会意見・正式決定を院内知識へ整理。</p><button class="btn mint" onclick="Pathia.minutesImport('MANUAL')">議事録を取り込む</button></div>
      </div>
      <div class="section-title"><h3>CSV取り出し</h3></div><div class="card"><p class="muted small">現在の試作データをCSVとして出力できます。</p><div class="toolbar"><div class="left"><button class="btn outline" onclick="Pathia.exportData('analysis')">分析・実績CSV</button><button class="btn outline" onclick="Pathia.exportData('variance')">バリアンスCSV</button><button class="btn outline" onclick="Pathia.exportData('paths')">パス一覧CSV</button><button class="btn outline" onclick="Pathia.exportData('cost')">費用・収益CSV</button></div></div></div>
      <div class="section-title"><h3>取込履歴</h3><span class="pill blue">${hist.length}件</span></div><div class="table-wrap"><table><thead><tr><th>日時</th><th>種別</th><th>期間</th><th>ファイル</th><th>件数</th><th>結果</th></tr></thead><tbody>${hist.map(h=>`<tr><td>${new Date(h.at).toLocaleString('ja-JP')}</td><td>${esc(h.type)}</td><td>${esc(h.period)}</td><td>${esc(h.file)}</td><td>${h.rows}件</td><td><span class="pill green">完了</span></td></tr>`).join('')||'<tr><td colspan="6" class="muted">まだ取込履歴はありません。</td></tr>'}</tbody></table></div>
    `);
    $('#dashFile').onchange=e=>previewImportFile('実績CSV',e.target.files[0],'dashPreview');
    $('#pathFile').onchange=e=>previewPathFile(e.target.files[0]);
    $('#costFile').onchange=e=>previewImportFile('費用・収益CSV',e.target.files[0],'costPreview');
  }
  function importPeriod(){return {from:$('#impFrom')?.value||'2026-04',to:$('#impTo')?.value||'2026-08'}}
  function previewImportFile(type,file,targetId){if(!file)return;const r=new FileReader();r.onload=()=>{const rows=parseCSV(r.result);const p=importPeriod();pendingImport={type,rows,fileName:file.name,periodFrom:p.from,periodTo:p.to};$('#'+targetId).innerHTML=`<div class="notice success" style="margin-top:12px"><strong>${rows.length}行を読み込みました。</strong> 内容を確認して取り込みを確定してください。</div><div class="table-wrap compact"><table><tbody>${rows.slice(0,5).map(x=>`<tr>${Object.values(x).slice(0,6).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><button class="btn primary" style="margin-top:10px" onclick="Pathia.commitPendingImport()">取り込みを確定</button>`};r.readAsText(file,'UTF-8')}
  function normalizePathRows(rows){
    const dateFmt=v=>{const t=String(v??'').trim();if(/^\d{8}$/.test(t))return `${t.slice(0,4)}/${t.slice(4,6)}/${t.slice(6,8)}`;return t};
    return rows.map(r=>{const o={};Object.entries(r||{}).forEach(([k,v])=>o[String(k).trim()]=typeof v==='string'?v.trim():v);return {
      'CPコード':String(o['CPコード']??o['パスコード']??o['CPｺｰﾄﾞ']??o['コード']??o['code']??o['path_code']??'').trim(),
      '入外区分':String(o['入外区分']??o['入外']??o['入院外来区分']??o['区分']??'').trim(),
      '診療科':String(o['診療科']??o['診療科名']??o['科']??o['department']??'').trim(),
      'パス項目名称':String(o['パス項目名称']??o['パス名称']??o['パス名']??o['名称']??o['path_name']??'').trim(),
      '作成日':dateFmt(o['作成日']??o['登録日']??o['created_at']??''),
      '更新日':dateFmt(o['更新日']??o['最終更新日']??o['updated_at']??''),
      ...o
    }}).filter(x=>x['CPコード']||x['パス項目名称']);
  }
  function renderPathPreview(rows,target,fileName,type){
    pendingImport={type,rows,fileName,periodFrom:importPeriod().from,periodTo:importPeriod().to};
    const counts={all:rows.length,test:rows.filter(x=>/テスト|検証|backup|bk|temp|作成中|使用しない/i.test(x['パス項目名称']||'')).length,depts:new Set(rows.map(x=>x['診療科']).filter(Boolean)).size};
    target.innerHTML=`<div class="notice success" style="margin-top:12px"><strong>${rows.length}件のパス候補を読み込みました。</strong> 診療科 ${counts.depts}区分／テスト・旧版等の候補 ${counts.test}件。内容を確認して登録してください。</div><div class="table-wrap compact"><table><thead><tr><th>CPコード</th><th>入外区分</th><th>診療科</th><th>パス項目名称</th><th>作成日</th><th>更新日</th></tr></thead><tbody>${rows.slice(0,8).map(x=>`<tr><td>${esc(x['CPコード']||'')}</td><td>${esc(x['入外区分']||'')}</td><td>${esc(x['診療科']||'')}</td><td>${esc(x['パス項目名称']||'')}</td><td>${esc(x['作成日']||'')}</td><td>${esc(x['更新日']||'')}</td></tr>`).join('')}</tbody></table></div><div class="notice warning" style="margin-top:10px">「テスト」「検証用」「使用しない」等も元データどおり取り込みます。正式運用では有効／無効フラグを持たせて絞り込む設計がおすすめです。</div><button class="btn primary" style="margin-top:10px" onclick="Pathia.commitPendingImport()">${type.includes('Excel')?'Excel':'CSV'}のパスを登録</button>`;
  }
  function readTextSmart(file,cb){
    const r=new FileReader();r.onload=()=>{try{const buf=r.result;let text='';const decUtf=new TextDecoder('utf-8',{fatal:false});text=decUtf.decode(buf);const bad=(text.match(/�/g)||[]).length;if(bad>2){try{text=new TextDecoder('shift_jis',{fatal:false}).decode(buf)}catch(_){}}cb(text)}catch(err){cb('',err)}};r.readAsArrayBuffer(file);
  }
  function previewPathFile(file){
    if(!file)return;const target=$('#pathPreview');const p=importPeriod();const name=file.name.toLowerCase();
    if(name.endsWith('.pdf')){pendingImport={type:'パスPDF',rows:[],fileName:file.name,periodFrom:p.from,periodTo:p.to};target.innerHTML=`<div class="notice warning" style="margin-top:12px"><strong>PDFを選択しました：</strong>${esc(file.name)}<br>VERSION 0.2.3ではPDFのOCR・表構造解析は未接続です。本番版では抽出候補を表示し、担当者が確認してからパスマスタへ登録する想定です。</div><button class="btn primary" onclick="Pathia.commitPdfCandidate()">PDF取込候補として登録（デモ）</button>`;return}
    if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      if(typeof XLSX==='undefined'){target.innerHTML=`<div class="notice danger" style="margin-top:12px"><strong>Excel読込ライブラリを読み込めませんでした。</strong><br>インターネット接続を確認するか、CSVに変換して取り込んでください。</div>`;return}
      const r=new FileReader();r.onload=()=>{try{const wb=XLSX.read(r.result,{type:'array',cellDates:false});const sheet=wb.Sheets[wb.SheetNames[0]];const raw=XLSX.utils.sheet_to_json(sheet,{defval:'',raw:true});const rows=normalizePathRows(raw);renderPathPreview(rows,target,file.name,'パスマスタExcel')}catch(err){target.innerHTML=`<div class="notice danger" style="margin-top:12px">Excelの読み込みに失敗しました：${esc(err.message||err)}</div>`}};r.readAsArrayBuffer(file);return
    }
    readTextSmart(file,(text,err)=>{if(err||!text){target.innerHTML=`<div class="notice danger">CSVを読み込めませんでした。</div>`;return}const rows=normalizePathRows(parseCSV(text));renderPathPreview(rows,target,file.name,'パス内容CSV')})
  }
  function commitPendingImport(){if(!pendingImport.type){toast('ファイルを選択してください。');return}
    let detail='';
    if(pendingImport.type==='パス内容CSV'||pendingImport.type==='パスマスタExcel'){
      const old=store.get('importedPaths',[]);const byCode=new Map(old.map(x=>[String(x['CPコード']||x['パスコード']||'').trim(),x]));let added=0,updated=0;
      pendingImport.rows.forEach(x=>{const code=String(x['CPコード']||'').trim();if(code&&byCode.has(code)){byCode.set(code,{...byCode.get(code),...x});updated++}else{if(code)byCode.set(code,x);else byCode.set(uid('path'),x);added++}});
      store.set('importedPaths',[...byCode.values()]);syncDeptMasterFromRows(pendingImport.rows);detail=`新規 ${added}件／更新 ${updated}件`;
    }
    if(pendingImport.type==='費用・収益CSV')store.set('costData',pendingImport.rows);
    addImportHistory(pendingImport.type,pendingImport.fileName,pendingImport.rows.length,pendingImport.periodFrom,pendingImport.periodTo);
    modal(`<div class="complete-panel"><div class="complete-icon">✓</div><h3>取り込みが完了しました</h3><p>${esc(pendingImport.fileName)} を <strong>${pendingImport.rows.length}件</strong> 読み込みました。</p>${detail?`<div class="notice success">${esc(detail)}</div>`:''}<div class="notice success">対象期間：${esc(pendingImport.periodFrom)} ～ ${esc(pendingImport.periodTo)}</div><p class="muted small">「院内パス」で確認でき、病棟の「月次実績登録」では［＋ パスマスタから追加］から選択できます。</p></div>`,[{label:'院内パスを見る',cls:'outline',fn:()=>{pendingImport={type:'',rows:[],fileName:'',periodFrom:'',periodTo:''};closeModal();navigate('paths')}},{label:'完了',cls:'primary',fn:()=>{pendingImport={type:'',rows:[],fileName:'',periodFrom:'',periodTo:''};closeModal();renderImport()}}])}
  function commitPdfCandidate(){addImportHistory('パスPDF（確認待ち）',pendingImport.fileName,1,pendingImport.periodFrom,pendingImport.periodTo);modal(`<h3>PDFを取込候補として登録しました</h3><div class="notice warning">PDFから抽出した内容は、正式パスとして自動確定せず、担当者の確認後に登録する設計を推奨します。</div><p>ファイル：${esc(pendingImport.fileName)}</p>`,[{label:'完了',cls:'primary',fn:()=>{closeModal();renderImport()}}])}
  function addImportHistory(type,file,rows,from,to){const h=store.get('importHistory',[]);h.push({at:new Date().toISOString(),type,file,rows,period:`${from}～${to}`});store.set('importHistory',h)}
  function toCSV(rows){if(!rows.length)return '';const hs=[...new Set(rows.flatMap(r=>Object.keys(r)))];const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return [hs.map(q).join(','),...rows.map(r=>hs.map(h=>q(r[h])).join(','))].join('\r\n')}
  function exportData(type){const p=importPeriod();let rows=[],name='';if(type==='variance'){rows=VARIANCE_RECORDS;name='Pathia_バリアンス'}else if(type==='paths'){rows=[...Object.values(PATHS).flat().map(x=>({'診療科':x.dept,'パス名':x.name})),...store.get('importedPaths',[])];name='Pathia_パス一覧'}else if(type==='cost'){rows=getCostData();name='Pathia_費用収益'}else{const per=ANALYSIS_PERIODS['2026-05'];rows=Object.entries(per.depts).map(([k,v])=>({'期間':per.label,'診療科':k,'使用患者数':v.used,'退院患者数':v.discharged,'使用率':v.rate,'前年度使用率':v.prev}));name='Pathia_分析実績'}downloadBlob(new Blob(['\ufeff'+toCSV(rows)],{type:'text/csv;charset=utf-8'}),`${name}_${p.from}_${p.to}.csv`);toast('CSVを取り出しました。')}
  function downloadPathTemplate(){fetch('sample-path-master.csv').then(r=>r.blob()).then(b=>downloadBlob(b,'Pathia_パス内容取込_見本.csv'))}
  function downloadCostTemplate(){fetch('sample-cost-revenue.csv').then(r=>r.blob()).then(b=>downloadBlob(b,'Pathia_費用収益取込_見本.csv'))}

  function renderAdmin(){
    const members=store.get('members',[]), wards=getWardMaster(false), depts=getDeptMaster(false);
    setContent(`
      <div class="grid cards4"><div class="stat blue"><div class="label">登録アカウント</div><div class="value">${members.length}</div></div><div class="stat mint"><div class="label">有効病棟</div><div class="value">${wards.filter(x=>x.active!==false).length}</div></div><div class="stat cream"><div class="label">有効診療科</div><div class="value">${depts.filter(x=>x.active!==false).length}</div></div><div class="stat lav"><div class="label">無効マスタ</div><div class="value">${wards.filter(x=>x.active===false).length+depts.filter(x=>x.active===false).length}</div></div></div>
      <div class="section-title"><h3>病棟マスタ</h3><button class="btn primary" id="addWardMaster">＋ 病棟を追加</button></div>
      <div class="table-wrap"><table><thead><tr><th>病棟コード</th><th>病棟名</th><th>表示順</th><th>状態</th><th>操作</th></tr></thead><tbody>${wards.map(w=>`<tr class="${w.active===false?'master-inactive':''}"><td>${esc(w.code||'')}</td><td><strong>${esc(w.name)}</strong></td><td>${esc(w.order||'')}</td><td><span class="pill ${w.active===false?'gray':'green'}">${w.active===false?'無効':'有効'}</span></td><td><button class="btn sm outline" onclick="Pathia.editWardMaster('${w.id}')">編集</button> <button class="btn sm ${w.active===false?'mint':'danger'}" onclick="Pathia.toggleWardMaster('${w.id}')">${w.active===false?'有効に戻す':'無効にする'}</button></td></tr>`).join('')}</tbody></table></div>
      <div class="notice warning" style="margin-top:10px">病棟を無効にすると、新しい月次入力・未入力チェック・担当病棟の選択肢から外れます。過去に保存した月次データは削除しません。</div>
      <div class="section-title"><h3>診療科マスタ</h3><button class="btn primary" id="addDeptMaster">＋ 診療科を追加</button></div>
      <div class="table-wrap"><table><thead><tr><th>診療科コード</th><th>診療科名</th><th>表示順</th><th>状態</th><th>操作</th></tr></thead><tbody>${depts.map(d=>`<tr class="${d.active===false?'master-inactive':''}"><td>${esc(d.code||'')}</td><td><strong>${esc(d.name)}</strong></td><td>${esc(d.order||'')}</td><td><span class="pill ${d.active===false?'gray':'green'}">${d.active===false?'無効':'有効'}</span></td><td><button class="btn sm outline" onclick="Pathia.editDeptMaster('${d.id}')">編集</button> <button class="btn sm ${d.active===false?'mint':'danger'}" onclick="Pathia.toggleDeptMaster('${d.id}')">${d.active===false?'有効に戻す':'無効にする'}</button></td></tr>`).join('')}</tbody></table></div>
      <div class="notice success" style="margin-top:10px">パスCSVを取り込んだとき、マスタにない診療科名は自動で診療科マスタへ追加します。無効にした診療科のパスは新しい月次入力候補から外します。</div>
      <div class="section-title"><h3>役割ID・担当者・権限管理</h3><button class="btn primary" id="addMember">＋ 登録</button></div>
      <div class="table-wrap"><table><thead><tr><th>役割ID</th><th>現在担当者</th><th>部署</th><th>役職</th><th>役割</th><th>権限</th><th>病棟</th><th>メール</th><th></th></tr></thead><tbody>${members.map(m=>`<tr><td><strong>${esc(m.id)}</strong></td><td>${esc(m.name)}</td><td>${esc(m.department)}</td><td>${esc(m.title||'')}</td><td>${esc(m.label)}</td><td>${esc(m.permission)}</td><td>${esc(m.ward||'―')}</td><td>${esc(m.email)}</td><td><button class="btn sm outline" onclick="Pathia.editMember('${m.id}')">編集</button></td></tr>`).join('')}</tbody></table></div>
      <div class="notice warning" style="margin-top:16px"><strong>試作版：</strong>マスタ変更はこのブラウザのlocalStorageへ保存されます。本番版ではSharePoint Listや院内DBのマスタへ保存する想定です。</div>`);
    $('#addWardMaster').onclick=()=>editWardMaster(); $('#addDeptMaster').onclick=()=>editDeptMaster(); $('#addMember').onclick=()=>editMember();
  }
  function editWardMaster(id=null){const rows=getWardMaster(false), w=id?rows.find(x=>x.id===id):null, obj=w||{id:uid('ward'),code:'',name:'',order:rows.length+1,active:true};modal(`<h3>${w?'病棟を編集':'病棟を追加'}</h3><div class="form-grid"><label>病棟コード<input id="wardCode" value="${esc(obj.code||'')}" placeholder="例：5S"></label><label>病棟名<input id="wardName" value="${esc(obj.name||'')}" placeholder="例：5南"></label><label>表示順<input id="wardOrder" type="number" min="1" value="${esc(obj.order||rows.length+1)}"></label><label>状態<select id="wardActive"><option value="true" ${obj.active!==false?'selected':''}>有効</option><option value="false" ${obj.active===false?'selected':''}>無効</option></select></label></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:'保存',cls:'primary',fn:()=>saveWardMaster(obj.id)}])}
  function saveWardMaster(id){const rows=getWardMaster(false), name=$('#wardName').value.trim();if(!name){toast('病棟名を入力してください。');return}const duplicate=rows.find(x=>x.name===name&&x.id!==id);if(duplicate){toast('同じ病棟名が登録されています。');return}const obj={id,code:$('#wardCode').value.trim(),name,order:Number($('#wardOrder').value)||rows.length+1,active:$('#wardActive').value==='true'};const i=rows.findIndex(x=>x.id===id);if(i>=0)rows[i]={...rows[i],...obj};else rows.push(obj);store.set('wardMaster',rows);closeModal();renderAdmin();toast('病棟マスタを保存しました。')}
  function toggleWardMaster(id){const rows=getWardMaster(false),i=rows.findIndex(x=>x.id===id);if(i<0)return;rows[i].active=rows[i].active===false?true:false;store.set('wardMaster',rows);if(!getActiveWards().includes(monthlyContext.ward))monthlyContext.ward=getActiveWards()[0]||'';renderAdmin();toast(rows[i].active?'病棟を有効に戻しました。':'病棟を無効にしました。')}
  function editDeptMaster(id=null){const rows=getDeptMaster(false), d=id?rows.find(x=>x.id===id):null, obj=d||{id:uid('dept'),code:'',name:'',order:rows.length+1,active:true};modal(`<h3>${d?'診療科を編集':'診療科を追加'}</h3><div class="form-grid"><label>診療科コード<input id="deptCode" value="${esc(obj.code||'')}" placeholder="例：SURG"></label><label>診療科名<input id="deptName" value="${esc(obj.name||'')}" placeholder="例：外科"></label><label>表示順<input id="deptOrder" type="number" min="1" value="${esc(obj.order||rows.length+1)}"></label><label>状態<select id="deptActive"><option value="true" ${obj.active!==false?'selected':''}>有効</option><option value="false" ${obj.active===false?'selected':''}>無効</option></select></label></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:'保存',cls:'primary',fn:()=>saveDeptMaster(obj.id)}])}
  function saveDeptMaster(id){const rows=getDeptMaster(false), name=$('#deptName').value.trim();if(!name){toast('診療科名を入力してください。');return}const duplicate=rows.find(x=>x.name===name&&x.id!==id);if(duplicate){toast('同じ診療科名が登録されています。');return}const obj={id,code:$('#deptCode').value.trim(),name,order:Number($('#deptOrder').value)||rows.length+1,active:$('#deptActive').value==='true'};const i=rows.findIndex(x=>x.id===id);if(i>=0)rows[i]={...rows[i],...obj};else rows.push(obj);store.set('deptMaster',rows);closeModal();renderAdmin();toast('診療科マスタを保存しました。')}
  function toggleDeptMaster(id){const rows=getDeptMaster(false),i=rows.findIndex(x=>x.id===id);if(i<0)return;rows[i].active=rows[i].active===false?true:false;store.set('deptMaster',rows);renderAdmin();toast(rows[i].active?'診療科を有効に戻しました。':'診療科を無効にしました。')}
  function editMember(id){const members=store.get('members',[]),m=members.find(x=>x.id===id)||{id:'',name:'',department:'',title:'',label:'',permission:'閲覧のみ',ward:'',email:'',role:'viewer',active:true};modal(`<h3>${id?'担当者・権限を編集':'役割アカウントを登録'}</h3><div class="form-grid"><label>役割ID<input id="mId" value="${esc(m.id)}" ${id?'readonly':''}></label><label>現在担当者<input id="mName" value="${esc(m.name)}"></label><label>部署<input id="mDept" value="${esc(m.department)}"></label><label>役職<input id="mTitle" value="${esc(m.title||'')}"></label><label>役割名<input id="mLabel" value="${esc(m.label)}"></label><label>システム権限<select id="mRole"><option value="office" ${m.role==='office'?'selected':''}>事務局管理者</option><option value="ward" ${m.role==='ward'?'selected':''}>病棟パス係</option><option value="doctor" ${m.role==='doctor'?'selected':''}>パス責任者</option><option value="committee" ${m.role==='committee'?'selected':''}>委員会構成員</option><option value="viewer" ${m.role==='viewer'?'selected':''}>閲覧のみ</option></select></label><label>病棟<select id="mWard"><option value="">なし</option>${wardOptions(m.ward)}</select></label><label>メール<input id="mEmail" value="${esc(m.email)}"></label></div>`,[{label:'キャンセル',cls:'outline',fn:closeModal},{label:'保存',cls:'primary',fn:saveMember}]);}
  function saveMember(){const members=store.get('members',[]),id=$('#mId').value.trim();if(!id){toast('役割IDを入力してください。');return}const role=$('#mRole').value;const obj={id,name:$('#mName').value,department:$('#mDept').value,title:$('#mTitle').value,label:$('#mLabel').value||id,role,permission:({office:'管理者',ward:'病棟パス係',doctor:'パス責任者',committee:'委員会構成員',viewer:'閲覧のみ'})[role],ward:$('#mWard').value,email:$('#mEmail').value,active:true};const i=members.findIndex(x=>x.id===id);if(i>=0)members[i]={...members[i],...obj};else members.push(obj);store.set('members',members);if(currentUser.id===id){currentUser={...currentUser,...obj};renderUser()}closeModal();renderAdmin();toast('保存しました。');}

  function renderHelp(){
    const roleGuides={office:[['📋','月次実績管理','未入力・入力途中・確定済を確認し、月次更新します。','officeMonthly'],['📊','分析結果を見る','病棟・診療科・パス別に使用率とバリアンスを確認します。','analysis'],['💰','費用・収益を見る','費用CSVから原価・収益・在院日数を確認します。','finance'],['🏥','委員会資料の見方','会議資料・議事録・決定事項を確認します。','committee'],['📥','議事録の登録','Excelから出力したCSVを取り込みます。','committee'],['⚙️','マスタ・権限管理','病棟・診療科の追加/無効化、役割ID、担当者、権限を管理します。','admin']],ward:[['📝','月次実績の登録','実施件数、バリアンス、架空患者IDを入力し確定します。','monthly'],['📊','分析結果を見る','病棟・診療科・パス別に使用率とバリアンスを確認します。','analysis'],['📅','スケジュールの確認','会議・研修・締切を確認します。','schedule'],['📊','集計結果の見方','公開後の院内ダッシュボードを確認します。','home']],doctor:[['✨','AI改善提案への回答','医師判断と理由を院内知識として残します。','ai'],['🧠','院内知識の見方','過去の責任医師判断や委員会決定を確認します。','knowledge'],['🏥','委員会資料の見方','分析から会議資料まで確認します。','committee']],committee:[['🏥','委員会資料の見方','レジュメ・会議資料・議事録を確認します。','committee'],['🧠','決定事項の確認','会議で決まった内容を追跡します。','knowledge'],['📅','スケジュールの登録方法','会議・研修などを登録します。','schedule']],viewer:[['📊','院内ダッシュボード','公開済みパス実績を確認します。','home'],['📚','院内パスを見る','院内パスの情報を参照します。','paths']]}; const gs=roleGuides[currentUser.role]||[];
    const terms=[['クリニカルパス','特定の疾患・手術について、入院から退院までの検査・治療・看護・リハビリ等を時系列で整理した標準的な診療計画です。'],['バリアンス','パスで予定していた経過と実際の経過に差が生じたことです。差の理由を分析し、パス改善につなげます。'],['アウトカム','その時点で患者さんが到達していることを期待する目標です。'],['パス適用件数','そのパスを実際に使用した症例数です。'],['パス適用率','対象となる症例のうちパスを使用した割合です。'],['確定','病棟の月次入力を完了し、事務局の月次集計へ連携する操作です。'],['院内知識','責任医師の判断、委員会決定、改訂理由など、今後のAI提案が参照する病院内の知見です。'],['月次更新','事務局が確定済み実績を正式な当月結果として公開する作業です。'],['費用対効果','費用・収益だけで良否を決めず、診療実績・バリアンス・臨床判断と合わせて評価します。'],['PDF取込','PDFからの抽出は入力補助として使い、正式登録前に人が確認します。CSVの方が構造化されており正確に取り込みやすい形式です。']];
    setContent(`<div class="help-hero"><img src="pathia-character-sheet.png" alt="パシくま キャラクターシート"><div><span class="pill blue">${esc(currentUser.label)}向け</span><h3 style="font-size:26px;color:#245b89">パシくまと使い方を見てみよう</h3><p>権限によって必要な操作だけを優先表示します。各ガイドをクリックすると、その操作画面へ移動できます。</p><div class="notice success">わからない言葉があったら、下の「用語説明」を見てね。各画面にも「？」ヘルプを追加していく想定です。</div><div class="guide-grid" style="margin-top:14px">${gs.map(g=>`<div class="guide-card" onclick="Pathia.go('${g[3]}')"><div class="gicon">${g[0]}</div><strong>${g[1]}</strong><span class="muted small">${g[2]}</span></div>`).join('')}</div></div></div><div class="section-title"><h3>はじめてのクリニカルパス</h3></div><div class="card"><h3>クリニカルパスって何？</h3><p>入院から退院までの標準的な診療の道筋を、医師・看護師・薬剤師・リハビリ・事務など多職種で共有するための計画です。Pathiaでは「今のパスが実際の診療と合っているか」「どんなバリアンスが起きているか」「なぜ改訂されたか」を見えるようにします。</p></div><div class="section-title"><h3>用語説明</h3></div><div class="glossary">${terms.map(t=>`<div class="term"><strong>${t[0]}</strong><p>${t[1]}</p></div>`).join('')}</div><div class="section-title"><h3>よくある質問</h3></div><div class="card"><div class="list"><div class="list-row"><div><div class="maintext">0件なのに空白でいい？</div><div class="subtext">空白は「未入力」、0は「0件と確認済み」です。0件の場合も0を入力してください。</div></div></div><div class="list-row"><div><div class="maintext">確定後に間違いに気づいたら？</div><div class="subtext">本番版では事務局へ修正依頼し、確定解除後に修正する運用を想定しています。</div></div></div><div class="list-row"><div><div class="maintext">正式パスをPathiaで修正できる？</div><div class="subtext">できません。正式パスの新規作成・修正は別端末で行い、Pathiaは分析・提案・履歴管理を担当します。</div></div></div></div></div>`);
  }

  function renderProfile(){ editMember(currentUser.id); }

  function modal(html, actions=[]){ const root=$('#modalRoot'); root.innerHTML=`<div class="modal-backdrop"><div class="modal">${html}<div class="modal-actions">${actions.map((a,i)=>`<button class="btn ${a.cls||'outline'}" data-act="${i}">${a.label}</button>`).join('')}</div></div></div>`; actions.forEach((a,i)=>$(`[data-act="${i}"]`,root).onclick=a.fn); }
  function closeModal(){ $('#modalRoot').innerHTML=''; }
  function parseCSV(text){
    const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean); if(!lines.length)return[]; const parseLine=line=>{const out=[];let cur='',q=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(q&&line[i+1]==='"'){cur+='"';i++}else q=!q}else if(c===','&&!q){out.push(cur);cur=''}else cur+=c}out.push(cur);return out}; const h=parseLine(lines[0]);return lines.slice(1).map(l=>{const a=parseLine(l),o={};h.forEach((k,i)=>o[k.trim()]=a[i]?.trim()||'');return o});
  }
  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}

  function reportWindow(title,body){const w=window.open('','_blank'); w.document.write(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Yu Gothic,Meiryo,sans-serif;color:#26394b;margin:36px}h1{color:#245c8b;border-bottom:3px solid #72b9e8;padding-bottom:12px}h2{color:#2e6b9a;margin-top:28px}.meta{background:#f1f8fd;padding:12px;border-radius:10px}.box{border:1px solid #d7e6f1;border-radius:12px;padding:14px;margin:12px 0}table{width:100%;border-collapse:collapse}th,td{border:1px solid #d8e4ed;padding:8px;text-align:left}th{background:#eef6fb}.ai{background:#effaf4;border-left:5px solid #78bd92;padding:12px}.agenda-head{display:flex;justify-content:space-between;gap:20px}.agenda-table{max-width:900px;margin:20px auto}.agenda-table th{width:110px}.complete-panel{text-align:center}.complete-icon{width:64px;height:64px;border-radius:50%;background:#dff5e6;color:#267449;font-size:38px;display:grid;place-items:center;margin:0 auto 12px}.foot{margin-top:32px;font-size:11px;color:#778797}@media print{button{display:none}body{margin:18mm}}</style></head><body><button onclick="window.print()" style="float:right;padding:9px 14px">PDFに保存／印刷</button><h1>${esc(title)}</h1>${body}<div class="foot">Pathia v0.2.3 試作資料｜生成日 ${new Date().toLocaleDateString('ja-JP')}｜正式資料として使用する前に内容を確認してください。</div></body></html>`); w.document.close(); }
  function printCommittee(id){
    const m=store.get('committeeMeetings',[]).find(x=>x.id===id)||{title:'クリニカルパス委員会',date:'2026-09-10',agenda:'院内クリニカルパス月次分析'};
    reportWindow(`${m.title} 資料`,`<div class="meta">日時：${fmtDate(m.date)}<br>対象：院内クリニカルパス全体<br>開催頻度：月1回<br>議題：${esc(m.agenda)}</div><h2>1. 院内クリニカルパス使用状況</h2><table><tr><th>区分</th><th>使用患者数</th><th>退院患者数</th><th>使用率</th><th>前年度</th></tr><tr><td>全体</td><td>308</td><td>502</td><td>61%</td><td>64%</td></tr><tr><td>病棟全体</td><td>161</td><td>502</td><td>32%</td><td>39%</td></tr><tr><td>手術</td><td>126</td><td>―</td><td>―</td><td>―</td></tr><tr><td>外来</td><td>21</td><td>―</td><td>―</td><td>―</td></tr></table><h2>2. 病棟・診療科別の確認ポイント</h2><table><tr><th>区分</th><th>使用率</th><th>前年度</th><th>差</th></tr><tr><td>3東</td><td>43%</td><td>54%</td><td>-11pt</td></tr><tr><td>4階</td><td>50%</td><td>50%</td><td>0pt</td></tr><tr><td>整形外科</td><td>61%</td><td>72%</td><td>-11pt</td></tr><tr><td>循環器内科</td><td>55%</td><td>46%</td><td>+9pt</td></tr></table><h2>3. バリアンス逸脱内容</h2><table><tr><th>診療科</th><th>パス</th><th>病棟</th><th>コード</th><th>内容</th></tr><tr><td>整形外科</td><td>【R5】腰椎手術</td><td>4東</td><td>A-1-a</td><td>硬膜損傷</td></tr><tr><td>循環器内科</td><td>PCI3泊4日</td><td>ICU・CCU</td><td>A-1-a</td><td>IABP挿入、治療継続のため</td></tr><tr><td>産科</td><td>予定帝王切開術</td><td>4階</td><td>A-3</td><td>児の体重増加待ちで退院延期</td></tr></table><h2>4. AI見直し候補・院内知識</h2><div class="ai"><strong>診療科横断で抽出</strong><p>使用率の変化、反復するバリアンス、責任医師判断、委員会決定を照合し、見直し候補を提示します。外科だけではなく、整形外科・循環器内科・産科など院内全診療科を対象とします。</p></div><h2>5. 前回決定事項と今回の検討事項</h2><div class="box">□ 前回決定事項の進捗確認<br>□ 使用率が低下した病棟・診療科の要因確認<br>□ 反復するバリアンスの確認<br>□ パス改訂・新規候補の検討</div>`)
  }
  function printGenericAgenda(e){reportWindow(`${e.title} レジュメ`,`<div class="meta">日時：${fmtDate(e.date)} ${esc(e.start||'終日')}〜${esc(e.end||'')}<br>場所：${esc(e.place||'未設定')}<br>開催：月1回</div><h2>議題</h2><div class="box">${esc(e.agenda||'議題未登録').replace(/\n/g,'<br>')}</div><h2>定例確認事項</h2><div class="box">1. 院内パス月次使用状況<br>2. 病棟・診療科別使用率と前年度比較<br>3. バリアンス逸脱内容<br>4. 前回決定事項の進捗<br>5. 改訂・新規パス等の検討事項</div>`)}
  function printAgenda(id){const m=store.get('committeeMeetings',[]).find(x=>x.id===id);if(!m)return;printGenericAgenda({title:m.title,date:m.date,start:'16:30',end:'17:30',place:'第2会議室',agenda:m.agenda})}
  function printMonthlyReport(){reportWindow('院内クリニカルパス 月次サマリー','<div class="meta">対象：院内全診療科・全病棟<br>公開状態：試作データ</div><h2>全体概要</h2><table><tr><th>使用患者数</th><th>退院患者数</th><th>使用率</th><th>前年度使用率</th></tr><tr><td>308</td><td>502</td><td>61%</td><td>64%</td></tr></table><h2>病棟別</h2><div class="box">3東 43%／3南 7%／ICU 100%／4階 50%／4東 46%／5東 10%／5西 20%／5南 26%</div><h2>診療科別（一部）</h2><div class="box">呼吸器内科 30%／循環器内科 55%／外科 112%／整形外科 61%／皮膚科 280%／産科 65%／婦人科 177%</div>')}
  function printVarianceReport(){
    const rows=VARIANCE_RECORDS.map(v=>`<tr><td>${esc(v.no)}</td><td>${esc(v.dept)}</td><td>${esc(v.path)}</td><td>${esc(v.ward)}</td><td>${esc(v.month)}</td><td>${esc(v.day)}</td><td>${esc(v.code)}</td><td>${esc(v.content)}</td></tr>`).join('');
    reportWindow('クリニカルパス バリアンス逸脱内容一覧',`<div class="meta">対象：院内全診療科<br>会議資料の別添を想定</div><table><tr><th>No</th><th>診療科</th><th>パス名</th><th>病棟</th><th>発生月</th><th>病日</th><th>コード</th><th>バリアンス内容</th></tr>${rows}</table>`)
  }
  function printFinanceReport(){const rows=getCostData();const n=(x,k)=>Number(String(x[k]||0).replace(/,/g,''))||0;const yen=v=>Math.round(v).toLocaleString('ja-JP')+'円';const tr=rows.map(x=>{const m=n(x,'1症例当たり収益')-n(x,'1症例当たり原価');return `<tr><td>${esc(x['診療科'])}</td><td>${esc(x['パス名'])}</td><td>${n(x,'症例数')}</td><td>${yen(n(x,'1症例当たり収益'))}</td><td>${yen(n(x,'1症例当たり原価'))}</td><td>${yen(m)}</td><td>${esc(x['平均在院日数'])}日</td></tr>`}).join('');reportWindow('クリニカルパス 費用・収益分析資料',`<div class="meta">デモ用架空データ｜費用のみで診療内容を判断しないこと</div><table><tr><th>診療科</th><th>パス</th><th>症例数</th><th>1症例収益</th><th>1症例原価</th><th>収支差</th><th>平均在院日数</th></tr>${tr}</table><h2>確認ポイント</h2><div class="ai">コスト差は改善候補の抽出材料の一つとして使用し、責任医師・委員会の臨床判断、院内知識を優先します。</div>`) }
  function printDoctorReport(){reportWindow('パス責任医師 確認資料','<div class="meta">対象診療科・パス：分析画面から選択して出力する想定</div><h2>AI提案</h2><div class="ai">使用率、バリアンス、診療実態、院内知識を踏まえた改善候補を表示します。</div><h2>過去の院内知識</h2><div class="box">責任医師意見・委員会決定・改訂理由を対象パスに紐づけて表示。</div><h2>責任医師確認欄</h2><div class="box">□ 承認　□ 条件付き承認　□ 却下　□ 保留<br><br>理由：________________________________________</div>')}


  window.Pathia={go:navigate,openWard(w){monthlyContext.ward=w;navigate('monthly')},remindWard(w){notify('月次実績の登録をお願いします',`${w}の2026年8月実績が未確定です。` ,w)},pathDetail,editMember,editWardMaster,toggleWardMaster,editDeptMaster,toggleDeptMaster,minutesImport,printCommittee,printAgenda,editAgenda,printMonthlyReport,printVarianceReport,printFinanceReport,printDoctorReport,commitPendingImport,commitPdfCandidate,exportData,downloadPathTemplate,downloadCostTemplate};

  $('#loginBtn').onclick=login; $('#logoutBtn').onclick=logout; $('#notificationBtn').onclick=e=>{e.stopPropagation();showNotifications()}; $('#profileBtn').onclick=renderProfile;
  $$('.nav-link[data-route="help"]').forEach(b=>b.onclick=()=>navigate('help'));
  restore();
})();
