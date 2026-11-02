/* 밴드업 아이엘츠 — per-student IELTS speaking cue cards, spaced review and error notes.
   Data: data/students/<slug>.json + data/glossary.json. Progress lives in this phone's localStorage. */
(function(){
"use strict";
const TCOL = {"어휘":"#4457e8","단·복수":"#8b5cf6","주어-동사":"#3d5afe","동사·시제":"#0f9e8f","문장 구조":"#e07a2e","관사·전치사":"#d6437f",
  "품사":"#b88a00","단어 선택":"#2a9a55","발음·철자":"#7c7f99","표현":"#d99a00","잘한 표현":"#1d9a68"};
const INTERVALS=[0,1,3,7,14,30], MASTER=5, DAILY=15;
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e;};
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const addD=(s,n)=>{const [y,m,d]=s.split("-").map(Number);const t=new Date(y,m-1,d+n);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");};
const mmdd=s=>s? s.slice(5).replace("-","/") : "";
const store={ get(k,f){ try{ const v=localStorage.getItem(k); return v==null? f : JSON.parse(v);}catch(_){ return f; } },
              set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } };

let D=null, G={}, P1=null, P1Q=null, P3=null, P2X=null, P2=null, LS=null, WB=null, slug=null;
let srs={}, marks={}, days=[];
let view={tab:"home"};   // home | cards(deck?) | review | notes
let deckState=null, reviewState=null, picked=null, flipped=false, noteFilter="전체", noteSession="all", cardMode="session", selSession=null, randCount=10, randKind="all";

/* ---------- boot ---------- */
const DATA=window.BANDUP_DATA||"data/";
async function boot(){
  slug=window.BANDUP_SLUG || (location.hash||"").replace(/^#/,"") || new URLSearchParams(location.search).get("s") || store.get("bandup-slug",null) || window.BANDUP_DEFAULT || null;
  // old links (…/bandup/#slug) move to the student's own page, so 'Add to Home Screen' keeps the student
  if(!window.BANDUP_SLUG && !window.BANDUP_DEFAULT && slug && /^[a-z0-9-]{3,40}$/.test(slug) && /\/bandup\/(index\.html)?$/.test(location.pathname)){
    location.replace(`u/${slug}/`); return;
  }
  if(slug && !/^[a-z0-9-]{3,40}$/.test(slug)) slug=null;
  const app=$("#app");
  if(!slug){ app.textContent=""; const e=el("div","empty"); e.append(el("h2",null,"내 카드를 찾지 못했어요"), el("p",null,"홈 화면에 예전 아이콘이 있다면 길게 눌러 삭제한 뒤, 선생님께 받은 새 링크를 Safari(또는 Chrome)로 열어 '홈 화면에 추가'를 다시 해 주세요. 한 번만 하면 다음부터는 아이콘만 누르면 바로 열려요.")); app.append(e); return; }
  try{
    const [s,g]=await Promise.all([fetch(`${DATA}students/${slug}.json`,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }),
                                   fetch(DATA+"glossary.json",{cache:"no-cache"}).then(r=>r.ok? r.json():{}).catch(()=>({}))]);
    D=s; G=g||{};
    [P1,P2,LS,WB,P1Q,P3,P2X]=await Promise.all(["part1.json","part2.json","listening.json","words.json","part1q.json","part3.json","part2x.json"].map(u=>fetch(DATA+u,{cache:"no-cache"}).then(r=>r.ok? r.json():null).catch(()=>null)));
  }catch(e){ app.textContent=""; const x=el("div","empty"); x.append(el("h2",null,"카드를 불러오지 못했어요"), el("p",null,"인터넷 연결을 확인하고 다시 열어 주세요. 계속 안 되면 선생님께 링크를 다시 받아 주세요.")); app.append(x); return; }
  store.set("bandup-slug",slug);
  srs=store.get(`bandup-srs-${slug}`,{}); marks=store.get(`bandup-marks-${slug}`,{}); days=store.get(`bandup-days-${slug}`,[]);
  document.title=`${D.name}님 · 밴드업 아이엘츠`;
  $("#who").textContent=new Date().toLocaleDateString("ko-KR",{month:"long",day:"numeric",weekday:"long"}); const br=document.querySelector(".brand"); if(br) br.innerHTML="Band<span>up</span>";
  addKakao();
  buildTabs(); render();
}
function addKakao(){
  const top=document.querySelector(".top"); if(!top || top.querySelector(".kakao")) return;
  const android=/android/i.test(navigator.userAgent);
  const a=el("a","kakao"); a.href= android? "intent://main#Intent;scheme=kakaotalk;package=com.kakao.talk;end" : "kakaotalk://";
  a.setAttribute("aria-label","카카오톡으로 선생님께 질문하기");
  a.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4C7 4 3 7.1 3 11c0 2.5 1.7 4.7 4.2 6l-.9 3.3c-.1.4.3.7.6.5l3.9-2.6c.4 0 .8.1 1.2.1 5 0 9-3.1 9-7s-4-7.3-9-7.3z" fill="currentColor"/></svg><span>질문하기</span>';
  top.append(a);
}
function save(){ store.set(`bandup-srs-${slug}`,srs); store.set(`bandup-marks-${slug}`,marks); store.set(`bandup-days-${slug}`,days); }
function touchDay(){ const t=today(); if(!days.includes(t)){ days.push(t); days=days.slice(-120); save(); } }
function streak(){ let n=0, d=today(); const set=new Set(days); if(!set.has(d)) d=addD(d,-1); while(set.has(d)){ n++; d=addD(d,-1); } return n; }

/* ---------- card helpers ---------- */
const typeOf=c=> c.kind==="ko" && !c.type ? "표현" : c.type;
const col=c=>TCOL[typeOf(c)]||"#4457e8";
const rep=c=>(c.sessions||[]).length>1;
const sessLabel=c=>c.vtopic? c.vtopic : (c.sessions||[]).join("·")+"회차";
const VCARDS={};
const getCard=id=>D.cards.find(c=>c.id===id) || VCARDS[id];
const isWriting=c=>!(c.type==="발음·철자" && /발음/.test(c.ko||""));
function dueCards(){ const t=today(); return D.cards.filter(c=>{ if(!isWriting(c)) return false; const s=srs[c.id]||{}; return (s.box||0)<MASTER && (s.due||t)<=t; }); }
function mastered(){ return D.cards.filter(c=>((srs[c.id]||{}).box||0)>=MASTER).length; }
function grade(c,ok){
  const t=today(), s=srs[c.id]||{box:0,reviews:0,correct:0};
  const box=ok? Math.min(MASTER,(s.box||0)+1) : 0;
  let gap=INTERVALS[Math.min(box,INTERVALS.length-1)]; if(rep(c)) gap=Math.max(1,Math.ceil(gap/2));
  srs[c.id]={box,due: ok? addD(t,gap) : addD(t,1), reviews:(s.reviews||0)+1, correct:(s.correct||0)+(ok?1:0), last:t};
  touchDay(); save();
}

/* ---------- tabs ---------- */
const ICONS={
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/></svg>',
  cards:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="14" height="13" rx="2"/><path d="M7 4h12a2 2 0 0 1 2 2v11"/></svg>',
  bm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>',
  review:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  wordsOld:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z"/><path d="M4 20a2 2 0 0 0 2 2h13v-4"/><path d="M8 7h7M8 11h5"/></svg>',
  words:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>',
  listen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>',
  ideas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>'
};
function buildTabs(){
  const nav=$("#tabs nav"); nav.textContent="";
  for(const [k,label] of [["home","홈"],["cards","큐카드"],["ideas","아이디어"],["words","철자"]]){
    const b=el("button"); b.type="button"; b.dataset.tab=k; b.innerHTML=ICONS[k]; b.append(el("span",null,label));
    if(k==="review"){ const bd=el("span","badge"); bd.id="dueBadge"; b.append(bd); }
    b.onclick=()=>{ go(k); };
    nav.append(b);
  }
}
function go(tab, extra){ if(typeof stopMockTimer==="function") stopMockTimer(); QZ=null; if(tab!=="words" && typeof LD!=="undefined"){ LD=null; try{ speechSynthesis.cancel(); }catch(_){} } view={tab, ...(extra||{})}; flipped=false; picked=null; if(tab!=="cards") deckState=null; if(tab!=="review") reviewState=null; render(); window.scrollTo(0,0); }
function updateTabs(){
  document.querySelectorAll("#tabs button").forEach(b=>{ if(b.dataset.tab===view.tab) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  const n=Math.min(dueCards().length,DAILY), bd=$("#dueBadge"); if(bd){ bd.textContent=String(n); bd.hidden=!n; }
}

/* ---------- render ---------- */
function lessonBar(onClose, i, n){
  const w=el("div","lbar"); const x=el("button","lx","✕"); x.type="button"; x.setAttribute("aria-label","그만하고 나가기"); x.onclick=onClose;
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=(n? i/n*100 : 0)+"%"; bar.append(bi);
  w.append(x, bar, el("span","lcount",`${Math.min(i+1,n)}/${n}`)); return w;
}
function pageHead(app, title, lead){ const h=el("div","phead"); h.append(el("h1",null,title)); if(lead) h.append(el("p","lead",lead)); app.append(h); }
function render(){
  const app=$("#app"); app.textContent="";
  if(QZ){ renderQuiz(app); updateTabs(); document.body.classList.add("lesson"); return; }
  if(view.tab==="home") renderHome(app);
  if(view.tab==="cards") (view.deck!=null? renderDeck(app) : renderDecks(app));
  if(view.tab==="review") renderReview(app);
  if(view.tab==="ideas") renderIdeas(app);
  if(view.tab==="words") renderWords(app);
  if(view.tab==="mock") renderMock(app);
  if(view.tab==="bm") renderBmTab(app);
  if(view.tab==="idioms") renderIdioms(app);
  updateTabs();
  document.body.classList.toggle("lesson", !!app.querySelector(".lbar"));
}

/* ---------- daily podcast reminder ---------- */
const POD_URL="https://podcasts.apple.com/nz/podcast/6-minute-english/id262026947";
const LIC={
  pod:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="10" r="2.2"/><path d="M12 13.5v7"/><path d="M8.2 14a5 5 0 1 1 7.6 0"/><path d="M5.6 16.6a8.5 8.5 0 1 1 12.8 0"/></svg>',
  mock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  bm:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>'
};
const BADGES=[3,7,14,30,50,100];
function bestStreak(){ const ds=[...new Set(days)].sort(); let best=0, run=0, prev=null; for(const d of ds){ run = (prev && addD(prev,1)===d)? run+1 : 1; best=Math.max(best,run); prev=d; } return best; }
function badgeSection(){
  const best=Math.max(bestStreak(), streak()); const st=streak();
  const earned=BADGES.filter(n=>best>=n); const next=BADGES.find(n=>best<n);
  const sec=el("section","sec"); sec.append(secHead("연속 기록 배지", `${earned.length} / ${BADGES.length}`));
  const box=el("div","box badges");
  const row=el("div","bdg-row");
  for(const n of BADGES){ const on=best>=n; const b=el("div","bdg"+(on?" on":"")); const m=el("div","bdg-m"); m.append(el("b",null,String(n)), el("span",null,"일")); b.append(m, el("span","bdg-l", on? "획득" : "잠김")); row.append(b); }
  box.append(row);
  const studied=days.includes(today()); box.append(el("p","bdg-next", next? `다음 배지(${next}일)까지 ${Math.max(1,next-st)}일 남았어요` + (studied? "" : " · 오늘 공부하면 연속 기록이 이어져요") : "모든 배지를 모았어요!"));
  sec.append(box);
  try{ const key=`bandup-badges-${slug}`; const seen=store.get(key,[]); const fresh=earned.filter(n=>!seen.includes(n)); if(fresh.length){ store.set(key,earned); if(seen.length || fresh.some(n=>n>3) || earned.length) setTimeout(()=>badgeToast(fresh[fresh.length-1]),400); } }catch(_){}
  return sec;
}
function badgeToast(n){ const t=el("div","bdg-toast"); const m=el("div","bdg-m"); m.append(el("b",null,String(n)), el("span",null,"일")); const tx=el("div"); tx.append(el("b",null,`${n}일 연속 배지 획득!`), el("span",null,"꾸준함이 실력이에요. 계속 가 봐요.")); t.append(m,tx); document.body.append(t); setTimeout(()=>t.classList.add("out"),2600); setTimeout(()=>t.remove(),3100); }
function secHead(title, right){ const h=el("div","sec-h"); h.append(el("b",null,title)); if(right) h.append(el("span",null,right)); return h; }
function listRow(icon, title, sub, onClick, href){
  const r=el(href? "a":"button","lrow2"); if(href){ r.href=href; r.target="_blank"; r.rel="noopener"; } else { r.type="button"; r.onclick=onClick; }
  const ic=el("span","lic"); ic.innerHTML=icon; const t=el("span","lt"); t.append(el("b",null,title), el("span",null,sub));
  r.append(ic,t,el("span","lchev","›")); return r;
}
function renderHome(app){
  const due=dueCards().length;
  const doneToday=Object.values(srs).filter(x=>x&&x.last===today()).length;
  const goalDone = doneToday>=DAILY;
  const h1=el("h1","h-title"); h1.append(document.createTextNode(`${D.name}님,`), el("br"));
  if(!D.cards.length || (due && !goalDone)){ h1.append(document.createTextNode("오늘도 화이팅!")); }
  else h1.append(document.createTextNode("꾸준함이 실력이 돼요. 오늘도 완료! 👏"));
  app.append(h1);
  app.append(quoteBox()); startIdiomTimer();
  // 오늘의 복습
  const s1=el("section","sec"); s1.append(secHead("오늘의 복습"));
  const rv=el("div","box rv"); const n=el("div","rv-n"); n.append(document.createTextNode(String(Math.min(doneToday,DAILY))), el("small",null,` / ${DAILY}`));
  rv.append(n, el("div","rv-l","오늘 목표"));
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=Math.min(100,doneToday/DAILY*100)+"%"; bar.append(bi); rv.append(bar);
  if(!D.cards.length){ rv.append(el("p","muted small","첫 수업이 끝나면 수업에서 나온 문장으로 복습이 시작돼요.")); s1.append(rv); app.append(s1); }
  else {
  const queue=reviewQueue(!due);
  const b=el("button","btn primary", !due? "약한 카드 연습하기" : goalDone? "더 복습하기" : doneToday? "이어서 복습하기" : "복습 시작하기"); b.type="button"; b.onclick=()=>go("review",{extra:!due, ids:queue}); rv.append(b);
  s1.append(rv); app.append(s1);
  }
  // 학습
  const s2=el("section","sec"); s2.append(secHead("학습"));
  const list=el("div","box list2");
  { const pr=listRow(LIC.pod,"오늘의 팟캐스트","BBC 6 Minute English",null,POD_URL); pr.classList.add("podrow"); list.append(pr); }
  list.append(listRow(LIC.mock,"모의고사","Part 1·2·3 랜덤 · 약 12분",()=>{ MT=null; go("mock"); }));
  list.append(listRow(LIC.bm,"북마크",`${cbmList().filter(id=>getCard(id)).length+qbmList().length}개`,()=>go("bm")));
  s2.append(list); app.append(s2);
  // 이번 주
  const st=streak(); const s3=el("section","sec"); const h3=secHead("이번 달"); if(st){ const fl=el("span","streak"); fl.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f-out" d="M12 2c.5 3.2 3 4.6 4.4 7 1.3 2.2 1.6 4.6.8 6.8A6 6 0 0 1 6 14.6c0-2.2 1-3.6 2.3-4.8.2 1.5.9 2.6 2 3.1-.6-3.5.4-7.6 1.7-10.9z" fill="#ff7a1a"/><path class="f-in" d="M12.2 11.5c1.3 1.4 2.3 2.7 2.3 4.4a2.5 2.5 0 0 1-5 0c0-1.3.7-2.3 1.6-3 .1.8.5 1.3 1.1 1.5-.3-1-.3-1.9 0-2.9z" fill="#ffc94a"/></svg>'; fl.append(document.createTextNode(`${st}일 연속`)); h3.append(fl); } s3.append(h3); s3.append(weekCard()); app.append(s3);
}

function podcastBox(){
  const key=`bandup-pod-${slug}`; const listened=store.get(key,[]); const done=listened.includes(today());
  const w=el("div","pod"+(done?" done":""));
  const top=el("div","pod-top"); const ic=el("span","pod-ic"); ic.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="10" r="2.2"/><path d="M12 13.5v7"/><path d="M8.2 14a5 5 0 1 1 7.6 0"/><path d="M5.6 16.6a8.5 8.5 0 1 1 12.8 0"/></svg>'; top.append(ic, (()=>{ const t=el("div"); t.append(el("b",null, "오늘의 팟캐스트"), el("span",null,"BBC 6 Minute English")); return t; })());
  w.append(top);
  const a=el("a","btn primary","듣기"); a.href=POD_URL; a.target="_blank"; a.rel="noopener";
  w.append(a);
  return w;
}
/* ---------- IELTS mock test (Part 1 → 2 → 3, random) ---------- */
let MT=null, mtTimer=null;
const qbmKey=()=>`bandup-qbm-${slug}`;
const qbmList=()=>store.get(qbmKey(),[]);
const isQbm=q=>qbmList().some(x=>x.q===q);
function toggleQbm(item){ let l=qbmList(); if(l.some(x=>x.q===item.q)) l=l.filter(x=>x.q!==item.q); else l=[...l,{part:item.part,topic:item.topic,q:item.q}]; store.set(qbmKey(),l); }
function qbmBtn(item, onChange){ const b=el("button","cstar"); b.type="button"; const set=()=>{ const on=isQbm(item.q); b.textContent=on? "★" : "☆"; b.setAttribute("aria-pressed",String(on)); b.setAttribute("aria-label", on? "모아두기 해제" : "질문 모아두기"); }; set(); b.onclick=e=>{ e.stopPropagation(); toggleQbm(item); set(); if(onChange) onChange(); }; return b; }
let todayQShift=0;
let calOpen=false;
function weekCard(){
  const w=el("button","box weekcard calcard"+(calOpen?" open":"")); w.type="button"; w.setAttribute("aria-expanded",String(calOpen));
  const set=new Set(days); const now=new Date(); const y=now.getFullYear(), m=now.getMonth(), td=now.getDate(); const t0=new Date(y,m,td);
  const isoOf=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const hd=el("div","cal-hd"); hd.append(el("b",null,`${y}년 ${m+1}월`)); const cnt=[...set].filter(s=>s.startsWith(`${y}-${String(m+1).padStart(2,"0")}-`)).length;
  const rt=el("span",null,`이번 달 ${cnt}일 공부`); rt.append(el("i","cal-chev",calOpen?"▴":"▾")); hd.append(rt); w.append(hd);
  const g=el("div","cal-grid");
  ["일","월","화","수","목","금","토"].forEach(n=>g.append(el("span","cal-wd",n)));
  const cell=d=>{ const iso=isoOf(d); return el("span","cal-d"+(set.has(iso)?" done":"")+(d.getTime()===t0.getTime()?" today":"")+(d>t0?" future":"")+(d.getMonth()!==m?" other":""),String(d.getDate())); };
  if(calOpen){ const first=new Date(y,m,1).getDay(), last=new Date(y,m+1,0).getDate();
    for(let i=0;i<first;i++) g.append(el("span","cal-d empty"));
    for(let d=1;d<=last;d++) g.append(cell(new Date(y,m,d))); }
  else { const s=new Date(t0); s.setDate(td-t0.getDay()); for(let k=0;k<7;k++){ const d=new Date(s); d.setDate(s.getDate()+k); g.append(cell(d)); } }
  w.append(g);
  w.onclick=()=>{ calOpen=!calOpen; w.replaceWith(weekCard()); };
  return w;
}
let bmHomeOpen=false;
function bmHomeCard(){
  const list=cbmList().map(getCard).filter(Boolean);
  const w=el("div","bmhome");
  const h=el("button","bmh"); h.type="button"; h.setAttribute("aria-expanded",String(bmHomeOpen));
  h.append(el("b",null,"★ 북마크"), el("span",null,`${list.length}장`), el("span","bmchev",bmHomeOpen?"▴":"▾")); w.append(h);
  const body=el("div","bmbody"); body.hidden=!bmHomeOpen;
  if(!list.length) body.append(el("p","muted small","큐카드에서 카드의 ☆를 누르면 여기 모여요."));
  else {
    const ul=el("div","bmprev"); list.forEach(c=>{ const r=el("div","bmrow2"); const t=el("div"); t.append(el("b",null,c.en), el("span",null,c.ko||"")); const x=el("button","cstar","★"); x.type="button"; x.setAttribute("aria-pressed","true"); x.setAttribute("aria-label","북마크 해제"); x.onclick=()=>{ toggleCbm(c.id); render(); }; r.append(t,x); ul.append(r); }); body.append(ul);
    const a=el("button","btn primary vstart","카드로 연습"); a.type="button"; a.onclick=()=>{ deckState=null; go("cards",{deck:"bm", ids:list.map(c=>c.id)}); }; body.append(a);
  }
  w.append(body);
  h.onclick=()=>{ bmHomeOpen=!bmHomeOpen; body.hidden=!bmHomeOpen; h.setAttribute("aria-expanded",String(bmHomeOpen)); h.querySelector(".bmchev").textContent=bmHomeOpen?"▴":"▾"; };
  return w;
}
/* ---------- home cat (orange tabby, white chest & paws) that wanders ---------- */
const CAT_SVG='<svg viewBox="0 0 160 120" aria-hidden="true"><defs><linearGradient id="fur" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0a95e"/><stop offset="1" stop-color="#e3914a"/></linearGradient></defs><g class="c-tail"><path d="M34 70 C18 66 10 50 14 34 C16 26 24 22 28 28" fill="none" stroke="#e3914a" stroke-width="10" stroke-linecap="round"/><path d="M14 34 C16 26 24 22 28 28" fill="none" stroke="#f6c894" stroke-width="10" stroke-linecap="round"/></g><g class="c-leg c-lb"><path d="M40 78 v24" stroke="#d9853f" stroke-width="12" stroke-linecap="round"/><ellipse cx="40" cy="104" rx="8" ry="5" fill="#fffaf3"/></g><g class="c-leg c-lf"><path d="M96 80 v22" stroke="#d9853f" stroke-width="12" stroke-linecap="round"/><ellipse cx="96" cy="104" rx="8" ry="5" fill="#fffaf3"/></g><path d="M30 74 C30 54 50 46 72 46 C96 46 112 54 112 72 C112 88 96 92 72 92 C48 92 30 90 30 74Z" fill="url(#fur)"/><path d="M50 50 q4 10 0 22 M62 47 q4 12 0 26 M74 47 q4 12 0 26 M86 49 q4 10 0 22" stroke="#c97436" stroke-width="3.5" fill="none" stroke-linecap="round" opacity=".35"/><g class="c-leg c-lb2"><path d="M52 80 v22" stroke="#e3914a" stroke-width="12" stroke-linecap="round"/><ellipse cx="52" cy="104" rx="8" ry="5" fill="#fffaf3"/></g><g class="c-leg c-lf2"><path d="M108 78 v24" stroke="#e3914a" stroke-width="12" stroke-linecap="round"/><ellipse cx="108" cy="104" rx="8" ry="5" fill="#fffaf3"/></g><g class="c-head"><path d="M98 30 L100 6 L118 20 Z" fill="#e3914a"/><path d="M102 20 L104 10 L112 18 Z" fill="#f4b9a6"/><path d="M150 30 L148 6 L130 20 Z" fill="#e3914a"/><path d="M146 20 L144 10 L136 18 Z" fill="#f4b9a6"/><ellipse cx="124" cy="42" rx="31" ry="27" fill="url(#fur)"/><path d="M118 19 q1.5 5 0 9 M124 17 q1.5 6 0 10 M130 19 q1.5 5 0 9" stroke="#d07b3a" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".45"/><ellipse cx="124" cy="54" rx="13" ry="9" fill="#f9dfc2"/><ellipse cx="106" cy="52" rx="6.5" ry="4" fill="#f59fa3" opacity=".55"/><ellipse cx="142" cy="52" rx="6.5" ry="4" fill="#f59fa3" opacity=".55"/><g class="c-eyes"><ellipse cx="112.5" cy="42" rx="6" ry="7" fill="#2b1a10"/><ellipse cx="135.5" cy="42" rx="6" ry="7" fill="#2b1a10"/><circle cx="114.5" cy="39" r="2.4" fill="#fff"/><circle cx="137.5" cy="39" r="2.4" fill="#fff"/><circle cx="111" cy="45" r="1.1" fill="#fff" opacity=".8"/><circle cx="134" cy="45" r="1.1" fill="#fff" opacity=".8"/></g><path d="M121 50.5 q3 -1.5 6 0 q-1 2.6 -3 3.2 q-2 -0.6 -3 -3.2z" fill="#f08a96"/><path d="M124 53.5 v1.5 M124 55 q-2.5 2.6 -5 0.4 M124 55 q2.5 2.6 5 0.4" stroke="#7a4a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M102 52 l-13 -1.5 M102 55 l-13 1.5 M146 52 l13 -1.5 M146 55 l13 1.5" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".85"/></g></svg>';
const CAT_LINES=["냥! 오늘도 왔네","한 문장만 말해 봐도 충분해냥","천천히 해도 괜찮아냥 🐾","Practice makes progress!","{name} 최고다냥","오늘 복습 같이 하자냥","졸리지만 응원 중… 냥","틀려도 괜찮아냥, 그게 연습이야"];
let catRAF=null;
function homeCat(){
  if(catRAF){ cancelAnimationFrame(catRAF); catRAF=null; }
  const old=document.querySelector(".cat-walk"); if(old) old.remove();
  const svg=CAT_SVG.replace('</g></svg>','<g class="c-sleepeyes"><path d="M106 42 q6.5 4 13 0 M129 42 q6.5 4 13 0" stroke="#3b2414" stroke-width="2.6" fill="none" stroke-linecap="round"/></g><ellipse class="c-mouth" cx="124" cy="57.5" rx="3.6" ry="4" fill="#9a3b45"/></g></svg>');
  const w=el("button","cat-walk"); w.type="button"; w.setAttribute("aria-label","고양이 쓰다듬기"); w.innerHTML=svg;
  const bub=el("span","cat-bub"); bub.hidden=true;
  const bowl=el("span","cat-prop cat-bowl"); bowl.innerHTML='<svg viewBox="0 0 40 20"><path d="M2 6h36c-2 9-8 13-18 13S4 15 2 6z" fill="#5a7be8"/><ellipse cx="20" cy="6" rx="18" ry="4" fill="#8a5a33"/><circle cx="14" cy="5" r="2" fill="#a8703f"/><circle cx="22" cy="4" r="2" fill="#a8703f"/><circle cx="27" cy="6" r="1.8" fill="#a8703f"/></svg>';
  const zz=el("span","cat-prop cat-zz","Zz");
  const sweat=el("span","cat-prop cat-sweat","💦");
  w.append(bub,bowl,zz,sweat);
  const og=document.querySelector(".cat-grass"); if(og) og.remove();
  const grass=el("div","cat-grass"); grass.setAttribute("aria-hidden","true"); document.body.append(grass, w);
  const reduce=window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let x=20, dir=1, last=performance.now(), bt=null, state="walk", until=0;
  const STATES=["walk","walk","walk","sit","meow","stretch","eat","exercise","sleep","groom"];
  const LINES={meow:["야옹~","냐아앙","냥냥!"],eat:["냠냠","츄르 최고","밥 먹는 중이다냥"],exercise:["운동 중! 하나 둘","점프 점프!","다이어트 중이다냥"],sleep:["쿨쿨…","5분만 더…"],stretch:["으아아 기지개~","쭉쭉"],groom:["단장 중","털 고르는 중"]};
  const say=(txt)=>{ bub.textContent=txt; bub.hidden=false; clearTimeout(bt); bt=setTimeout(()=>{ bub.hidden=true; },2400); };
  const sayCheer=()=>say(CAT_LINES[Math.floor(Math.random()*CAT_LINES.length)].replace("{name}",D.name+"님"));
  const setState=(s,t)=>{
    state=s; w.className="cat-walk st-"+s+(dir<0?" left":"");
    const dur={walk:3000+Math.random()*4000,sit:2000+Math.random()*2000,meow:2200,stretch:2600,eat:4200,exercise:3200,sleep:5000+Math.random()*3000,groom:3200}[s];
    until=t+dur;
    if(LINES[s] && Math.random()<.85) say(LINES[s][Math.floor(Math.random()*LINES[s].length)]);
    if(s==="walk" && Math.random()<.4) dir*=-1;
  };
  w.onclick=()=>{ const t=performance.now(); if(state==="sleep"){ say("앗 깼다냥!"); setState("sit",t); return; } setState(Math.random()<.5? "meow":"sit",t); sayCheer(); };
  const place=()=>{ w.style.transform=`translateX(${x}px)`; w.classList.toggle("left",dir<0); };
  const step=t=>{
    if(!document.body.contains(w) || view.tab!=="home"){ w.remove(); grass.remove(); catRAF=null; return; }
    const dt=Math.min(50,t-last); last=t;
    const maxX=Math.max(0,window.innerWidth-w.offsetWidth-8);
    if(state==="walk"){ x+=dir*0.55*dt/16; if(x<=8){ x=8; dir=1; } if(x>=maxX){ x=maxX; dir=-1; } }
    if(t>=until){ let n; do{ n=STATES[Math.floor(Math.random()*STATES.length)]; }while(n===state && n!=="walk"); setState(n,t); }
    place(); catRAF=requestAnimationFrame(step);
  };
  place(); setState("walk",performance.now()); setTimeout(sayCheer,600);
  if(!reduce) catRAF=requestAnimationFrame(step); else w.className="cat-walk st-sit";
}
function mockCard(){
  const w=el("div","mockcard");
  const t=el("div"); t.append(el("b",null,"아이엘츠 모의고사"), el("span",null,"Part 1·2·3 랜덤"));
  const b=el("button","btn primary","시작하기"); b.type="button"; b.onclick=()=>{ MT=null; go("mock"); };
  w.append(t,b); return w;
}
/* Part 1 intro: always Home/Hometown or Study/Work (as in the real test) */
const INTRO_EXTRA={
  home:["Where are you from?","Which city are you living in?","Do you know any history about your hometown?","Do you prefer to live in an apartment or in a house?","Who do you live with?","Are there many rooms in your home?","What is your favourite room?","What would you change about your home?","How are the walls decorated?","How could your hometown be improved?","Is there good public transport in your hometown?","What's your neighbourhood like?","Do you think your hometown is a good place to bring up children?"],
  study:["What do you study?","Why did you choose that subject?","Is it a popular subject in your country?","Do you get on with your classmates?","Do you plan to get a job in the same field as your subject?"],
  work:["Why did you choose that job?","Do you like your job?","Where do you work?","Do you plan to continue with your job in the future?","What responsibilities do you have at work?","Do you get on with your colleagues?"]};
function introPool(kind){
  const names={home:["Hometown","Home"],study:["Study"],work:["Work"]}[kind];
  const qs=[...(P1Q? P1Q.topics.filter(t=>names.includes(t.en)).flatMap(t=>t.qs) : []), ...INTRO_EXTRA[kind]];
  const seen=new Set(); return qs.filter(q=>{ const k=q.toLowerCase().replace(/[^a-z ]/g,"").trim(); if(seen.has(k)) return false; seen.add(k); return true; });
}
function chooseIntro(kind){
  const st=MT.steps[MT.i]; if(st.chosen) return; st.chosen=kind;
  const open=kind==="work"? ["What do you do?","Where do you work?"] : ["What do you study?","What are you studying?"]; const o=open[Math.floor(Math.random()*open.length)];
  const qs=[o,...introPool(kind).filter(q=>!open.includes(q)).sort(()=>Math.random()-.5).slice(0,2)].map(q=>({part:1,topic:kind==="work"?"일":"공부",q}));
  MT.steps.splice(MT.i+1,0,...qs); render();
}
function buildMock(){
  const pick=(a,n)=>[...a].sort(()=>Math.random()-.5).slice(0,n);
  const steps=[];
  if(P1Q){ const core=["Work","Study","Hometown","Home"]; const rest=P1Q.topics.filter(t=>!core.includes(t.en));
    if(Math.random()<.5){ const open=["Where are you from?","Where is your hometown?","Which city are you living in?","Do you live in a house or an apartment?"]; const o=pick(open,1)[0]; [o,...pick(introPool("home").filter(q=>!open.includes(q)),3)].forEach(q=>steps.push({part:1,topic:"집·고향",q})); }
    else steps.push({part:1,topic:"일·공부",q:"Do you work or are you a student?",choose:true});
    for(const tp of pick(rest,2)) pick(tp.qs,4).forEach(q=>steps.push({part:1,topic:tp.ko,q})); }
  const p2=[...(P2?P2.items:[]),...(P2X?P2X.items:[])]; const c=p2[Math.floor(Math.random()*p2.length)];
  if(c){ steps.push({part:2,topic:"Part 2",q:c.topic,say:c.say||[],no:c.no});
    const p3=P3&&P3.items.find(x=>x.no===c.no); if(p3) p3.qs.slice(0,5).forEach(q=>steps.push({part:3,topic:c.topic,q})); }
  return {steps,i:0,phase:null,left:0};
}
function stopMockTimer(){ if(mtTimer){ clearInterval(mtTimer); mtTimer=null; } if(typeof stopRec==="function") stopRec(); }
/* ---------- answer recorder (mock test) ---------- */
let REC=null; // {mr, stream, chunks, t0, timer, key, rc}
const SR=window.SpeechRecognition||window.webkitSpeechRecognition||null;
/* clean up a speech transcript: drop fillers, stutters and self-corrections */
function cleanSpeech(raw){
  const fill=/^(um+|uh+|er+|erm+|ah+|hmm+|mm+|uhm+)$/i;
  let w=String(raw||"").replace(/\s+/g," ").trim().split(" ").filter(x=>x && !fill.test(x.replace(/[.,!?]/g,"")));
  const k=x=>x.toLowerCase().replace(/[^a-z0-9']/g,"");
  const lev=(a,b)=>{ const d=Array.from({length:a.length+1},(_,i)=>[i]); for(let j=1;j<=b.length;j++) d[0][j]=j; for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[a.length][b.length]; };
  let changed=true;
  while(changed){ changed=false;
    // repeated phrases of 1-4 words: "I went I went to" -> "I went to"
    for(let n=4;n>=1 && !changed;n--) for(let i=0;i+2*n<=w.length;i++){ let same=true; for(let j=0;j<n;j++) if(k(w[i+j])!==k(w[i+n+j])){ same=false; break; } if(same && k(w[i])){ w.splice(i,n); changed=true; break; } }
    // self-correction of one word: "soul Seoul" -> "Seoul"
    if(!changed) for(let i=0;i+1<w.length;i++){ const a=k(w[i]), b=k(w[i+1]); if(a.length>=3 && b.length>=3 && a!==b && a[0]===b[0] && lev(a,b)<=Math.max(1,Math.floor(Math.max(a.length,b.length)/3))){ w.splice(i,1); changed=true; break; } }
  }
  let s=w.join(" ").replace(/\s+([.,!?])/g,"$1");
  return s? s[0].toUpperCase()+s.slice(1) : s;
}

const canRecord=()=>!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder);
function stopRec(){ if(REC){ const rc=REC.rc; if(rc){ rc.onend=null; try{ rc.stop(); }catch(_){} } try{ if(REC.mr.state!=="inactive") REC.mr.stop(); }catch(_){} } }
function recBox(key){
  MT.rec=MT.rec||{}; MT.txt=MT.txt||{};
  const w=el("div","recbox");
  const draw=()=>{ w.textContent="";
    const url=MT.rec[key];
    if(REC && REC.key===key){
      const b=el("button","btn rec on"); b.type="button"; const sec=Math.floor((Date.now()-REC.t0)/1000);
      b.append(el("i","recdot"), document.createTextNode(` 녹음 중 ${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")} · 멈추기`)); b.onclick=stopRec; w.append(b); txtBox(true); return; }
    const r=el("button","btn rec"); r.type="button"; r.append(el("i","recdot"), document.createTextNode(url? " 다시 녹음" : " 질문 녹음")); r.onclick=start; w.append(r);
    if(url){ const a=el("audio"); a.controls=true; a.src=url; a.className="recaudio"; w.append(a); }
    txtBox(false);
  };
  const txtBox=live=>{ if(!SR) return; const t=cleanSpeech(MT.txt[key]); if(!t && !live) return; const d=el("div","rectxt"); d.append(el("span","rectxt-lab","내가 한 말"), el("p",null, t || "듣는 중…")); w.append(d); };
  const start=async()=>{
    try{ speechSynthesis.cancel(); }catch(_){}
    let stream; try{ stream=await navigator.mediaDevices.getUserMedia({audio:true}); }catch(_){ w.textContent=""; w.append(el("p","muted small","마이크를 쓸 수 없어요. 브라우저 설정에서 마이크를 허용해 주세요.")); return; }
    const mr=new MediaRecorder(stream); const chunks=[];
    REC={mr,stream,chunks,t0:Date.now(),key,timer:setInterval(()=>{ if(document.body.contains(w)) draw(); },1000)};
    mr.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
    mr.onstop=()=>{ clearInterval(REC&&REC.timer); stream.getTracks().forEach(t=>t.stop()); if(MT){ if(MT.rec[key]) URL.revokeObjectURL(MT.rec[key]); MT.rec[key]=URL.createObjectURL(new Blob(chunks,{type:mr.mimeType||"audio/webm"})); } REC=null; if(document.body.contains(w)) draw(); };
    MT.txt[key]="";
    if(SR){ try{ const rc=new SR(); rc.lang="en-GB"; rc.continuous=true; rc.interimResults=false; let fin="";
      rc.onresult=e=>{ for(let i=e.resultIndex;i<e.results.length;i++){ const r=e.results[i]; if(r.isFinal) fin+=r[0].transcript+" "; } if(MT) MT.txt[key]=fin; const p=w.querySelector(".rectxt p"); if(p) p.textContent=cleanSpeech(fin)||"듣는 중…"; else if(document.body.contains(w)) draw(); };
      rc.onend=()=>{ if(REC && REC.key===key && REC.mr.state==="recording"){ try{ rc.start(); }catch(_){} } };
      rc.onerror=()=>{};
      REC.rc=rc; rc.start(); }catch(_){} }
    mr.start(); draw();
  };
  draw(); return w;
}

function renderMock(app){
  stopMockTimer();
  if(!MT){
    const back=el("button","back","‹ 홈"); back.type="button"; back.onclick=()=>go("home"); app.append(back);
    pageHead(app,"아이엘츠 모의고사","실제 시험처럼 Part 1 → 2 → 3 순서로 랜덤 질문이 나와요.");
    const info=el("div","panel mockinfo");
    for(const [k,v] of [["Part 1","주제 3개 · 질문 12개 (4~5분)"],["Part 2","큐카드 1장 · 준비 1분 + 말하기 2분"],["Part 3","Part 2 주제 심화 질문 5개 (4~5분)"]]){ const r=el("div","mrow2"); r.append(el("b",null,k), el("span",null,v)); info.append(r); }
    app.append(info);
    const st=el("button","btn primary vstart","모의고사 시작"); st.type="button"; st.onclick=()=>{ MT=buildMock(); render(); window.scrollTo(0,0); }; app.append(st);
    const bms=qbmList(); const bp=el("div","panel"); const bh=el("div","ghead"); bh.append(el("b",null,"질문 모아두기"), el("span",null,`${bms.length}개`)); bp.append(bh);
    if(!bms.length) bp.append(el("p","gtip","모의고사를 보다가 다시 연습하고 싶은 질문에 ☆를 누르면 여기 모여요."));
    for(const part of [1,2,3]){ const list=bms.filter(x=>x.part===part); if(!list.length) continue; bp.append(el("span","idea-lab",`Part ${part}`));
      for(const it of list){ const r=el("div","qbmrow"); const t=el("div"); t.append(el("span","from2",it.topic), el("p",null,it.q)); r.append(t, qbmBtn(it,()=>render())); bp.append(r); } }
    app.append(bp); return;
  }
  const S=MT.steps, st=S[MT.i];
  if(!st){
    const e=el("div","empty"); e.append(el("div","big","✓"), el("h2",null,"모의고사 끝!"), el("p",null,`Part 1 ${S.filter(x=>x.part===1).length}문제 · Part 2 1문제 · Part 3 ${S.filter(x=>x.part===3).length}문제를 풀었어요.`));
    const again=el("button","btn primary","새 모의고사 보기"); again.type="button"; again.onclick=()=>{ MT=buildMock(); render(); window.scrollTo(0,0); };
    const bm=el("button","btn",`모아둔 질문 보기 (${qbmList().length}개)`); bm.type="button"; bm.onclick=()=>{ MT=null; render(); };
    const home=el("button","btn","홈으로"); home.type="button"; home.onclick=()=>{ MT=null; go("home"); };
    e.append(again,bm,home); app.append(e); return;
  }
  app.append(lessonBar(()=>{ MT=null; stopMockTimer(); try{ speechSynthesis.cancel(); }catch(_){} render(); }, MT.i, S.length));
  const box=el("div","mockq");
  box.append(el("span","mpart",`Part ${st.part}`+(st.part===1? ` · ${st.topic}` : "")));
  box.append(el("p","mq",st.q));
  if(st.part===2 && st.say.length){ box.append(el("span","idea-lab","You should say")); const ul=el("ul","say"); st.say.forEach(x=>ul.append(el("li",null,x))); box.append(ul); }
  const tools=el("div","mtools");
  if(canRecord()) tools.append(recBox(MT.i));
  tools.append(qbmBtn(st)); box.append(tools);
  if(st.part===2){
    const tm=el("div","mtimer"); const lab=el("b",null,""); const btn=el("button","btn"); btn.type="button"; tm.append(lab,btn);
    const show=()=>{ const m=Math.floor(MT.left/60), s2=String(MT.left%60).padStart(2,"0");
      if(MT.phase===null){ lab.textContent="준비 1분 → 말하기 2분"; btn.textContent="1분 준비 시작"; }
      else if(MT.phase==="prep"){ lab.textContent=`준비 중 ${m}:${s2}`; btn.textContent="바로 말하기 시작"; }
      else if(MT.phase==="talk"){ lab.textContent=`말하는 중 ${m}:${s2}`; btn.textContent="말하기 끝"; }
      else { lab.textContent="시간 끝! 다음으로 넘어가세요"; btn.hidden=true; } };
    const run=(phase,sec)=>{ stopMockTimer(); MT.phase=phase; MT.left=sec; show(); mtTimer=setInterval(()=>{ MT.left--; if(MT.left<=0){ if(MT.phase==="prep") run("talk",120); else { stopMockTimer(); MT.phase="done"; show(); } } else show(); },1000); };
    btn.onclick=()=>{ if(MT.phase===null) run("prep",60); else if(MT.phase==="prep") run("talk",120); else { stopMockTimer(); MT.phase="done"; show(); } };
    show(); if(MT.phase==="prep"||MT.phase==="talk") run(MT.phase,MT.left);
    box.append(tm);
  }
  app.append(box);
  if(st.choose){ const ch=el("div","introch"); for(const [k,lab,en] of [["study","학생이에요","I'm a student."],["work","일해요","I work."]]){ const b=el("button","btn"+(st.chosen===k?" on":"")); b.type="button"; b.append(el("b",null,lab), el("span",null,en)); b.disabled=!!st.chosen; b.onclick=()=>chooseIntro(k); ch.append(b); } app.append(ch); if(!st.chosen){ app.append(el("p","muted small introhint","답하고 나서 해당하는 쪽을 누르면 그에 맞는 질문이 이어져요.")); return; } }
  const nx=el("button","btn primary vstart", MT.i+1<S.length? (S[MT.i+1].part!==st.part? `Part ${S[MT.i+1].part}로 넘어가기` : "다음 질문") : "모의고사 끝내기"); nx.type="button";
  nx.onclick=()=>{ stopMockTimer(); MT.i++; MT.phase=null; MT.left=0; render(); window.scrollTo(0,0); const n=MT.steps[MT.i]; if(n && canSpeak()) setTimeout(()=>speak(n.q),250); };
  app.append(nx);
}
function menuGuide(){
  const nWB = WB? WB.sections.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.words.length,0),0) : 0;
  const nLS = LS? LS.categories.reduce((a,c)=>a+c.words.length,0) : 0;
  const nP2 = P2? P2.items.length : 0;
  const w=el("div","menu"); w.append(el("h2","sec-t","무엇을 공부할까요?"));
  for(const [k,name,desc] of [
    ["cards","큐카드","수업 문장 연습하기"],
    ["ideas","아이디어","Part 1·2·3 답변 재료"],
    ["words","철자","리스닝 철자 받아쓰기"]]){
    const b=el("button","mrow"); b.type="button";
    const ic=el("span","mic"); ic.innerHTML=ICONS[k];
    const t=el("div","t"); t.append(el("b",null,name), el("span",null,desc));
    b.append(ic,t,el("span","go","›")); b.onclick=()=>go(k); w.append(b);
  }
  return w;
}
function deckTile(s){
  const n=D.cards.filter(c=>(c.sessions||[]).includes(s.no)).length;
  const t=el("button","tile"); t.type="button";
  const tt=el("div","t"); tt.append(el("b",null,`${s.no}회차 큐카드`), el("span",null,`${n}장`));
  t.append(el("span","no",String(s.no)), tt, el("span","go","›"));
  t.onclick=()=>go("cards",{deck:s.no});
  return t;
}

function renderDecks(app){
  pageHead(app,"큐카드","수업 시간에 나온 문장을 카드로 연습해요.");
  if(!D.sessions.length || !D.cards.length){ const e=el("div","empty"); e.append(el("p",null,"아직 수업 기록이 없어요. 첫 수업이 끝나면 수업에서 나온 문장이 여기에 큐카드로 생겨요.")); app.append(e); return; }
  const seg=el("div","modeseg two"); seg.setAttribute("role","tablist");
  if(cardMode!=="session" && cardMode!=="random") cardMode="session";
  for(const [k,label,sub] of [["session","회차별",`1~${D.sessions[D.sessions.length-1].no}회차`],["random","랜덤 퀴즈","섞어서 풀기"]]){
    const b=el("button"); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(cardMode===k));
    b.append(el("b",null,label), el("span",null,sub)); b.onclick=()=>{ cardMode=k; openKey=null; render(); }; seg.append(b);
  }
  app.append(seg);
  let key, list, empty="카드가 없어요.";
  if(cardMode==="session"){
    if(selSession==null) selSession=D.sessions[D.sessions.length-1].no;
    app.append(sessionPicker(selSession, v=>{ selSession=v; render(); }, false));
    key="s"+selSession; list=D.cards.filter(c=>(c.sessions||[]).includes(selSession));
  } else if(cardMode==="wrong"){
    const all=D.cards.filter(isWrong); key="wrong"; list=[...all.filter(rep),...all.filter(c=>!rep(c))];
  } else if(cardMode==="random"){
    key="rand"; list=(deckState&&deckState.key==="rand")? deckState.ids.map(getCard) : [...D.cards].sort(()=>Math.random()-.5);
  } else {
    key="bm"; list=cbmList().map(getCard).filter(Boolean); empty="카드 아래 ☆ 북마크에 추가를 누르면 여기에 모여요.";
  }
  inlineDeck(app,key,list,empty);
}
function renderBmTab(app){
  pageHead(app,"북마크","큐카드와 모의고사에서 ☆를 누른 것들이 모여요.");
  const cards=cbmList().map(getCard).filter(Boolean);
  const h=el("h2","sec-t",`큐카드 ${cards.length}장`); app.append(h);
  inlineDeck(app,"bm",cards,"큐카드에서 ☆ 북마크에 추가를 누르면 여기에 모여요.");
  const qs=qbmList(); const bp=el("div","panel"); const bh=el("div","ghead"); bh.append(el("b",null,"질문 모아두기"), el("span",null,`${qs.length}개`)); bp.append(bh);
  if(!qs.length) bp.append(el("p","gtip","모의고사에서 ☆를 눌러 모아둔 질문이 여기 모여요."));
  for(const part of [1,2,3]){ const list=qs.filter(x=>x.part===part); if(!list.length) continue; bp.append(el("span","idea-lab",`Part ${part}`));
    for(const it of list){ const r=el("div","qbmrow"); const t=el("div"); t.append(el("span","from2",it.topic), el("p",null,it.q)); r.append(t, qbmBtn(it,()=>render())); bp.append(r); } }
  app.append(bp);
}
function inlineDeck(app,key,list,empty){
  if(!deckState || deckState.key!==key || (key==="bm" && deckState.ids.length!==list.length)) deckState={key, ids:list.map(c=>c.id), i:0};
  const ids=deckState.ids;
  if(!ids.length){ const e=el("div","empty"); e.append(el("p",null,empty)); app.append(e); return; }
  if(deckState.i>=ids.length) deckState.i=ids.length-1;
  const c=getCard(ids[deckState.i]);
  const pg=el("div","prog"); pg.append(el("span",null,`${deckState.i+1} / ${ids.length}`));
  if(key==="rand"){ const sh=el("button","linkbtn","다시 섞기"); sh.type="button"; sh.onclick=()=>{ deckState=null; render(); }; pg.append(sh); }
  app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=((deckState.i+1)/ids.length*100)+"%"; bar.append(bi); app.append(bar);
  const sc=flipCard(c); sc.onswipe=d=>move(d); app.append(sc);
  const acts=el("div","acts arrows");
  const prev=el("button","nav","‹ 이전"); prev.type="button"; prev.disabled=deckState.i===0; prev.onclick=()=>move(-1);
  const next=el("button","nav","다음 ›"); next.type="button"; next.disabled=deckState.i>=ids.length-1; next.onclick=()=>move(1);
  acts.append(prev,next); app.append(acts);
}
function keepRow(c){
  const r=el("div","m");
  r.append(el("span","kk", c.ko || ""));
  const rt=el("div","rt"); rt.append(el("span",null,c.en)); r.append(rt);
  const sd=el("div","sd"); sd.append(el("span","sess",sessLabel(c))); r.append(sd);
  return r;
}
const isWrong=c=>c.kind==="fix" || (c.mine && !c.good);
function renderWrongList(app){
  const all=D.cards.filter(isWrong);
  const repeated=all.filter(rep).sort((a,b)=>b.sessions.length-a.sessions.length);
  const weak=all.filter(c=>marks[c.id]==="again" || ((srs[c.id]||{}).reviews && (srs[c.id].correct||0)<(srs[c.id].reviews||0)));
  const p=el("div","panel randbox");
  p.append(el("p","muted small",`1회차부터 지금까지 수업에서 틀렸던 문장 ${all.length}개예요. 반복한 실수와 헷갈린 문장이 먼저 나와요.`));
  const row=el("div","btnrow");
  const order=()=>{ const first=[...new Set([...repeated,...weak])]; const rest=all.filter(c=>!first.includes(c)); return [...first,...rest]; };
  const b1=el("button","btn primary",`전부 연습 ${all.length}장`); b1.type="button"; b1.onclick=()=>{ deckState=null; go("cards",{deck:"wrong", ids:order().map(c=>c.id)}); };
  const b2=el("button","btn","섞어서 연습"); b2.type="button"; b2.onclick=()=>{ deckState=null; go("cards",{deck:"wrong", ids:[...all].sort(()=>Math.random()-.5).map(c=>c.id)}); };
  row.append(b1); p.append(row); app.append(p);
  const sec=(title,list,sub)=>{ if(!list.length) return; const hd=el("div","boxh"); hd.append(el("b",null,title), el("span",null,(sub||`${list.length}개`)+" · 눌러서 보기"));
    app.append(fold("w-"+title, hd, b=>{ const w=el("div","boxlist"); list.forEach(c=>w.append(noteRow(c))); b.append(w); })); };
  sec("여러 번 반복한 실수", repeated);
  sec("헷갈렸던 문장", weak.filter(c=>!rep(c)));
  for(const s of [...D.sessions].reverse()){
    const list=all.filter(c=>c.sessions[0]===s.no && !rep(c));
    sec(`${s.no}회차`, list);
  }
}
const cbmKey=()=>`bandup-cbm-${slug}`;
const cbmList=()=>store.get(cbmKey(),[]);
const isCbm=id=>cbmList().includes(id);
function toggleCbm(id){ let l=cbmList(); l= l.includes(id)? l.filter(x=>x!==id) : [...l,id]; store.set(cbmKey(),l); }
function renderBmCards(app){
  const list=cbmList().map(getCard).filter(Boolean);
  const p=el("div","panel randbox");
  if(!list.length){ p.append(el("p","muted small","카드를 연습하다가 ☆ 북마크에 추가를 누르면 여기에 모여요.")); app.append(p); return; }
  p.append(el("p","muted small",`북마크한 카드 ${list.length}장이에요.`));
  const b=el("button","btn primary",`북마크 카드 연습 ${list.length}장`); b.type="button"; b.onclick=()=>{ deckState=null; go("cards",{deck:"bm", ids:list.map(c=>c.id)}); };
  p.append(b); app.append(p);
  const q=el("div","panel"); const gh=el("div","ghead"); gh.append(el("b",null,"북마크한 문장"), el("span",null,`${list.length}개`)); q.append(gh);
  for(const c of list){ const r=(isWrong(c)? noteRow(c) : keepRow(c)); const x=el("button","cbmx","★"); x.type="button"; x.setAttribute("aria-label","북마크 해제"); x.onclick=()=>{ toggleCbm(c.id); render(); }; const sd=r.querySelector(".sd"); (sd||r).append(x); q.append(r); }
  app.append(q);
}
function renderRandomSetup(app){
  const last=D.sessions[D.sessions.length-1].no;
  const p=el("div","panel randbox");
  p.append(el("p","muted small",`1회차부터 ${last}회차까지 모든 카드에서 무작위로 뽑아요. 카드마다 몇 회차 문장인지 표시돼요.`));
  const grp=(label,opts,cur,set)=>{ const w=el("div","picker"); w.append(el("span","picker-lab",label)); const r=el("div","pchips");
    for(const [v,l] of opts){ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(cur===v)); b.onclick=()=>{ set(v); render(); }; r.append(b); }
    w.append(r); return w; };
  p.append(grp("몇 장", [[10,"10장"],[20,"20장"],[0,"전체"]], randCount, v=>randCount=v));
  const pool=randPool();
  const n = randCount? Math.min(randCount,pool.length) : pool.length;
  const b=el("button","btn primary",`랜덤 퀴즈 시작 · ${n}장`); b.type="button"; b.disabled=!n;
  b.onclick=()=>{ const ids=[...pool].sort(()=>Math.random()-.5).slice(0,n).map(c=>c.id); deckState=null; go("cards",{deck:"rand", ids}); };
  p.append(b); app.append(p);
}
function randPool(){
  const isWrong=c=>c.kind==="fix" || (c.mine && !c.good);
  return D.cards.filter(c=> randKind==="all" || (randKind==="wrong"? isWrong(c) : !isWrong(c)));
}


/* ---------- session picker ---------- */
function sessionPicker(current, onPick, withAll=true){
  const wrap=el("div","picker");
  wrap.append(el("span","picker-lab","회차 선택"));
  const row=el("div","pchips"); row.setAttribute("role","group"); row.setAttribute("aria-label","회차 선택");
  const opts=[...(withAll?[["all","전체"]]:[]), ...D.sessions.map(x=>[x.no, `${x.no}회`])];
  for(const [v,label] of opts){
    const n = v==="all"? D.cards.length : D.cards.filter(c=>(c.sessions||[]).includes(v)).length;
    const b=el("button",null,label); b.type="button"; b.setAttribute("aria-pressed",String(current===v));
    b.append(el("small",null,String(n)));
    b.onclick=()=>onPick(v); row.append(b);
  }
  wrap.append(row);
  setTimeout(()=>{ const on=row.querySelector('[aria-pressed="true"]'); if(on) on.scrollIntoView({block:"nearest",inline:"center"}); },0);
  return wrap;
}

/* ---------- flip card ---------- */
function flipCard(c, onFlip){
  const scene=el("div","scene");
  const card=el("div","card"+(flipped?" flipped":"")); card.style.setProperty("--c",col(c));
  card.tabIndex=0; card.setAttribute("role","button"); card.setAttribute("aria-label", flipped?"카드 앞면으로 뒤집기":"카드 뒤집기");
  const chipsFor=()=>el("div","chips");
  // front
  const f=el("div","face front"); f.setAttribute("aria-hidden",String(flipped));
  const starBtn=()=>{ const b=el("button","cstar"); b.type="button"; const set=()=>{ const on=isCbm(c.id); b.textContent= on? "★" : "☆"; b.setAttribute("aria-pressed",String(on)); b.setAttribute("aria-label", on? "북마크 해제" : "북마크에 추가"); }; set(); b.onclick=e=>{ e.stopPropagation(); toggleCbm(c.id); document.querySelectorAll(".cstar").forEach(x=>{ const on=isCbm(c.id); x.textContent=on?"★":"☆"; x.setAttribute("aria-pressed",String(on)); }); }; return b; };
  const sideFor=()=>{ const w=el("div","fside"); w.append(el("span","sess",sessLabel(c)), starBtn()); return w; };
  const fh=el("div","fhead"); fh.append(chipsFor(), sideFor()); f.append(fh);
  const fb=el("div","body");
  if(c.vtopic){ fb.append(el("span","from",`${c.vlabel||"주제별 어휘"} · ${c.vtopic}`)); }
  if(c.kind==="fix"){ fb.append(el("span","lab","틀린 문장이에요. 바르게 고쳐 보세요"), el("p","wrong",c.wrong)); }
  else { fb.append(el("p","ko",c.ko));
    const hint = c.hint || (c.vtopic? (()=>{ const ws=c.en.split(/\s+/).filter(w=>w.replace(/[^A-Za-z]/g,"").length>2); const k=ws.sort((x,y)=>y.length-x.length)[0]||c.en.split(" ")[0]; return ws.length>1? k.replace(/[^A-Za-z'-]/g,"") : k.replace(/[A-Za-z]+/g,m=>m[0]+"_".repeat(m.length-1)); })() : "");
    if(hint){ const hb=el("p","hint"); hb.append(el("span","hint-tag","힌트"), document.createTextNode(hint)); fb.append(hb); }
  }
  fb.append(el("span","tap","터치해서 정답 보기")); f.append(fb);
  // back
  const b=el("div","face back"); b.setAttribute("aria-hidden",String(!flipped));
  const bh=el("div","fhead"); bh.append(chipsFor(), sideFor()); b.append(bh);
  const bb=el("div","body");
  bb.append(el("span","lab", c.kind==="fix"? "이렇게 고쳐요" : "영어로는"));
  const sent=el("div","sent");
  for(const tok of c.en.split(" ")){
    const m=tok.match(/^([A-Za-z'-]+)([.,!?…]*)$/); const word=m?m[1]:tok, punct=m?m[2]:""; const key=word.toLowerCase();
    const tk=el("span","tok");
    if(G[key]){ const w=el("button","w"+(picked===key?" on":""),word); w.type="button"; w.tabIndex=flipped?0:-1;
      w.onclick=e=>{ e.stopPropagation(); picked=key; render(); }; tk.append(w); }
    else tk.append(el("span","p",word));
    if(punct) tk.append(el("span","p",punct));
    sent.append(tk);
  }
  bb.append(sent);
  const wb=el("div","wbox"); const inSent=picked && c.en.toLowerCase().split(/[^a-z'-]+/).includes(picked);
  if(inSent && G[picked]){ const [pos,mean,note]=G[picked]; const wt=el("div","wt"); wt.append(el("b",null,picked==="i"?"I":picked), el("span","pos",pos)); wb.append(wt, el("span","mean",mean)); if(note) wb.append(el("span","wn",note)); }
  else { wb.classList.add("empty"); wb.append(el("span","hint","단어를 누르면 뜻이 나와요")); }
  bb.append(wb);
  const gtext = c.gram || [c.note, (D.tips||{})[typeOf(c)]].filter(Boolean).join(" · ");
  if(gtext){ const g=el("div","gram"); g.append(el("b",null, c.vtopic? "예문" : "포인트")); const p=el("p"); if(c.gram) p.innerHTML=c.gram; else p.textContent=gtext; g.append(p); bb.append(g); }
  const fbk=el("button","flipback","↺ 앞면 다시 보기"); fbk.type="button"; fbk.tabIndex=flipped?0:-1; fbk.onclick=e=>{ e.stopPropagation(); setFlip(card,false,onFlip); };
  bb.append(fbk); b.append(bb);
  card.append(f,b);
  card.onclick=()=>{ if(!flipped) setFlip(card,true,onFlip); };
  card.onkeydown=e=>{ if((e.key==="Enter"||e.key===" ") && e.target===card){ e.preventDefault(); setFlip(card,!flipped,onFlip); } };
  scene.append(card);
  // swipe between cards
  let sx=null, sy=null;
  scene.addEventListener("touchstart",e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; },{passive:true});
  scene.addEventListener("touchend",e=>{ if(sx==null) return; const t=e.changedTouches[0]; const dx=t.clientX-sx, dy=t.clientY-sy; sx=null;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5 && scene.onswipe) scene.onswipe(dx<0?1:-1); },{passive:true});
  return scene;
}
function setFlip(card,v,cb){
  flipped=v; card.classList.toggle("flipped",v);
  card.setAttribute("aria-label", v?"카드 앞면으로 뒤집기":"카드 뒤집기");
  card.querySelector(".front").setAttribute("aria-hidden",String(v));
  card.querySelector(".back").setAttribute("aria-hidden",String(!v));
  card.querySelectorAll(".back button").forEach(b=>b.tabIndex=v?0:-1);
  if(!v){ picked=null; setTimeout(()=>{ if(!flipped) render(); },560); }
  if(cb) cb(v);
}


/* ---------- an IELTS idiom a day ---------- */
const IDIOMS=[
 ["once in a blue moon","아주 가끔","I eat fast food once in a blue moon."],
 ["a piece of cake","식은 죽 먹기, 아주 쉬운 일","Making pasta is a piece of cake for me."],
 ["hit the books","열심히 공부하다","I have to hit the books before my IELTS test."],
 ["under the weather","몸이 좀 안 좋은","I was a bit under the weather last week."],
 ["in my element","물 만난 물고기 같은","I'm in my element when I do yoga."],
 ["food for thought","생각할 거리","That documentary gave me a lot of food for thought."],
 ["cost an arm and a leg","엄청 비싸다","Flights to Hawaii cost an arm and a leg in summer."],
 ["go the extra mile","한 발 더 노력하다","My favourite teacher always went the extra mile for us."],
 ["a breath of fresh air","신선한 변화, 기분 전환","Moving to a new city was a breath of fresh air."],
 ["make ends meet","빠듯하게 생활비를 맞추다","Many students work part-time to make ends meet."],
 ["the best of both worlds","두 가지 장점을 다 누리는 것","Living near the city gives me the best of both worlds."],
 ["get the hang of","요령을 터득하다","It took me a while to get the hang of driving."],
 ["on the go","바쁘게 돌아다니는","I'm always on the go, so I often eat quick meals."],
 ["a couch potato","집에서 TV만 보는 사람","On rainy weekends I turn into a couch potato."],
 ["out of the blue","갑자기, 난데없이","Out of the blue, an old friend called me."],
 ["break the ice","어색함을 깨다","Talking about the weather is a good way to break the ice."],
 ["call it a day","오늘은 그만하다","After three hours of studying, I called it a day."],
 ["a blessing in disguise","전화위복","Missing that bus was a blessing in disguise."],
 ["sleep on it","하룻밤 더 생각해 보다","When I have a big decision to make, I usually sleep on it."],
 ["ring a bell","어디서 들어 본 것 같다","That name rings a bell, but I can't remember where I heard it."],
 ["learn the ropes","일의 요령을 배우다","It took me a month to learn the ropes at my new job."],
 ["take it easy","쉬엄쉬엄하다, 푹 쉬다","On Sundays I just take it easy at home."],
 ["not my cup of tea","내 취향이 아니다","Horror movies aren't really my cup of tea."],
 ["broaden my horizons","시야를 넓히다","Travelling abroad really broadened my horizons."],
 ["keep in touch","연락하고 지내다","I still keep in touch with my friends from school."],
 ["bite off more than I can chew","감당 못 할 만큼 일을 벌이다","I bit off more than I could chew this semester."],
 ["from scratch","처음부터, 맨손으로","My aunt started her bakery from scratch."],
 ["beat the traffic","차 막히는 걸 피하다","I leave home early to beat the traffic."],
 ["have a sweet tooth","단 걸 좋아하다","I have a sweet tooth, so I can't resist chocolate."],
 ["all of a sudden","갑자기","All of a sudden, my mind went blank."],
 ["add insult to injury","엎친 데 덮친 격","I missed the bus, and to add insult to injury, it started to rain."],
 ["at the drop of a hat","망설임 없이 바로","My best friend would help me at the drop of a hat."],
 ["bark up the wrong tree","헛다리 짚다","If you think I broke it, you're barking up the wrong tree."],
 ["by the skin of my teeth","간신히, 아슬아슬하게","I caught the last train by the skin of my teeth."],
 ["cut corners","대충 하다, 날림으로 하다","Good restaurants never cut corners with their ingredients."],
 ["get my act together","정신 차리고 제대로 하다","I need to get my act together before my IELTS test."],
 ["hit the nail on the head","정확히 핵심을 찌르다","My teacher hit the nail on the head about my grammar mistakes."],
 ["jump on the bandwagon","유행에 편승하다","Lots of people jumped on the bandwagon and started running."],
 ["kill two birds with one stone","일석이조","I walk to work, so I kill two birds with one stone: I save money and exercise."],
 ["let the cat out of the bag","비밀을 무심코 말해 버리다","My sister let the cat out of the bag about the surprise party."],
 ["let it slide","(잘못을) 그냥 넘어가다","My manager let it slide when I was late once."],
 ["like two peas in a pod","붕어빵처럼 똑 닮은","My cousin and I are like two peas in a pod."],
 ["sit on the fence","어느 편도 들지 않다, 결정을 미루다","I usually sit on the fence when my friends argue."],
 ["take it with a pinch of salt","걸러서 듣다","I take online reviews with a pinch of salt."],
 ["make a living", "생계를 꾸리다", "My uncle makes a living as a taxi driver."],
 ["be cut out for", "~에 소질이 있다, 체질이다", "I'm not cut out for working night shifts."],
 ["wet behind the ears", "풋내기의, 경험이 없는", "When I started my first job, I was still wet behind the ears."],
 ["put all my eggs in one basket", "한 가지에 모든 걸 걸다", "I applied to three universities so I didn't put all my eggs in one basket."],
 ["beat the clock", "마감 전에 해내다", "I beat the clock and finished my essay before midnight."],
 ["burn the candle at both ends", "밤낮없이 무리하다", "Before my exams, I was burning the candle at both ends."],
 ["back to the drawing board", "처음부터 다시", "My first plan failed, so it was back to the drawing board."],
 ["keep my nose to the grindstone", "꾸준히 열심히 일하다", "I'm keeping my nose to the grindstone until my IELTS test."],
 ["hunt for bargains", "싸게 파는 걸 찾아다니다", "I love hunting for bargains at street markets."],
 ["go window-shopping", "아이쇼핑하다", "On weekends I often go window-shopping with my friends."],
 ["take back", "(산 물건을) 반품하다", "The shoes were too small, so I took them back."],
 ["pour money down the drain", "돈을 낭비하다", "Buying clothes I never wear is pouring money down the drain."],
 ["fit like a glove", "꼭 맞다", "This jacket fits like a glove."],
 ["the in thing", "유행하는 것", "Running clubs are the in thing in Seoul right now."],
 ["let my hair down", "긴장을 풀고 즐기다", "On holiday I can finally let my hair down."],
 ["give someone a lift", "차로 태워 주다", "My dad gave me a lift to the station."],
 ["hit the road", "길을 나서다, 출발하다", "We hit the road early to beat the traffic."],
 ["at the crack of dawn", "꼭두새벽에", "I got up at the crack of dawn to catch my flight."],
 ["off the beaten track", "인적이 드문, 잘 알려지지 않은", "I prefer quiet places off the beaten track."],
 ["live out of a suitcase", "여기저기 떠돌며 지내다", "When I travel for work, I live out of a suitcase."],
 ["have itchy feet", "여행을 떠나고 싶어 근질근질하다", "After a few months at home, I get itchy feet."],
 ["love at first sight", "첫눈에 반함", "When I saw this city, it was love at first sight."],
 ["fall head over heels", "홀딱 반하다", "I fell head over heels for Canada on my first visit."],
 ["on cloud nine", "날아갈 듯 기쁜", "I was on cloud nine when I got my visa."],
 ["break someone's heart", "마음을 아프게 하다", "It broke my heart to leave my dog in Korea."],
 ["wear my heart on my sleeve", "감정을 숨기지 않고 드러내다", "I wear my heart on my sleeve, so people know when I'm upset."],
 ["a long face", "시무룩한 얼굴", "Why the long face? Did something happen?"],
 ["put myself in someone's shoes", "남의 입장이 되어 보다", "Good teachers put themselves in their students' shoes."],
 ["green with envy", "몹시 부러운", "My friends were green with envy when I moved to Canada."],
 ["down in the dumps", "울적한, 기분이 처진", "I feel down in the dumps on rainy days."],
 ["feel like two cents", "창피하다, 하찮게 느껴지다", "I felt like two cents when I forgot her name."],
 ["the apple of my eye", "아주 소중한 사람", "My little niece is the apple of my eye."],
 ["pass with flying colours", "아주 좋은 성적으로 통과하다", "I hope to pass my IELTS test with flying colours."],
 ["learn by heart", "외우다", "I learned my Part 2 template by heart."],
 ["rack my brain", "머리를 쥐어짜다", "I racked my brain, but I couldn't remember the word."],
 ["no pain, no gain", "고생 없이는 얻는 것도 없다", "Studying every day is hard, but no pain, no gain."],
 ["not do things by halves", "뭐든 대충 하지 않다", "My mum never does things by halves."],
 ["think outside the box", "틀에서 벗어나 생각하다", "My job requires me to think outside the box."],
 ["brush up on", "(실력을) 다시 다듬다", "I want to brush up on my English before the test."],
 ["teacher's pet", "선생님이 아끼는 학생", "I was never the teacher's pet at school."],
 ["born with a silver spoon in my mouth", "금수저로 태어나다", "He was born with a silver spoon in his mouth."],
 ["flesh and blood", "피붙이, 가족", "I'd do anything for my own flesh and blood."],
 ["run in the family", "집안 내력이다", "Being tall runs in my family."],
 ["the black sheep", "골칫덩이, 이단아", "My cousin is the black sheep of the family."],
 ["eat like a horse", "엄청 많이 먹다", "My brother is thin, but he eats like a horse."],
 ["make my mouth water", "군침이 돌게 하다", "The smell of fresh bread makes my mouth water."],
 ["spoil my appetite", "입맛을 떨어뜨리다", "Don't eat snacks now. They'll spoil your appetite."],
 ["have my cake and eat it", "두 마리 토끼를 다 잡으려 하다", "I want to save money and travel a lot, but I can't have my cake and eat it."],
 ["take a rain check", "다음으로 미루다", "Can I take a rain check on dinner tonight?"],
 ["ill at ease", "불편한, 불안한", "I feel ill at ease in big crowds."],
 ["pull my socks up", "분발하다", "I need to pull my socks up if I want a band 7."],
 ["at death's door", "다 죽어 가는, 몹시 아픈", "I had a bad flu and felt like I was at death's door."],
 ["safe and sound", "무사히", "We got home safe and sound after the storm."],
 ["kick the bucket", "죽다 (가볍게 하는 말)", "My old laptop finally kicked the bucket."],
 ["fight for my life", "사투를 벌이다", "The patient was fighting for his life in hospital."],
 ["set alarm bells ringing", "경각심을 불러일으키다", "Rising temperatures have set alarm bells ringing."],
 ["do wonders for", "~에 아주 좋다", "Yoga has done wonders for my back."],
 ["get back to nature", "자연으로 돌아가다", "Camping is a great way to get back to nature."],
 ["a drop in the ocean", "새 발의 피", "One plastic bag is a drop in the ocean, but it all adds up."],
 ["a hot potato", "뜨거운 감자, 민감한 문제", "Climate change is a political hot potato."],
 ["rain cats and dogs", "비가 억수같이 오다", "It was raining cats and dogs, so I stayed home."],
 ["none of my business", "내가 상관할 일이 아닌", "What my neighbours do is none of my business."],
 ["plain sailing", "순조로운", "Moving to Canada wasn't all plain sailing."],
 ["pressed for time", "시간에 쫓기는", "I'm always pressed for time in the morning."],
 ["better late than never", "늦더라도 안 하는 것보다 낫다", "I started studying English at 30, but better late than never."],
 ["tighten my belt", "허리띠를 졸라매다", "Prices went up, so I had to tighten my belt."],
 ["save for a rainy day", "만일을 대비해 저축하다", "I try to save some money for a rainy day."],
 ["a dog-eat-dog world", "치열한 경쟁 사회", "The job market is a dog-eat-dog world."],
 ["an even playing field", "공정한 경쟁의 장", "Online classes can create an even playing field for students."],
 ["it never rains but it pours", "안 좋은 일은 겹쳐서 온다", "I lost my phone and then my wallet. It never rains but it pours."],
 ["have a whale of a time", "아주 즐거운 시간을 보내다", "We had a whale of a time in Hawaii."],
 ["fight like cat and dog", "만나기만 하면 싸우다", "My sister and I used to fight like cat and dog."],
 ["a friend in need is a friend indeed", "어려울 때 친구가 진짜 친구", "She helped me move house. A friend in need is a friend indeed."],
 ["get on like a house on fire", "금방 친해지다", "My Brazilian friend and I got on like a house on fire."],
 ["birds of a feather flock together", "유유상종", "We all love yoga. Birds of a feather flock together."],
 ["know someone inside out", "속속들이 알다", "My best friend knows me inside out."],
 ["go back a long way", "오래 알고 지내다", "My best friend and I go back a long way."],
 ["have a man-to-man talk", "터놓고 진지하게 이야기하다", "My dad had a man-to-man talk with my brother about his future."]
];
let idiomShift=0, idiomTimer=null;
function nextIdiom(x){ idiomShift++; const n=quoteBox(); n.classList.add("slidein"); x.replaceWith(n); return n; }
function stopIdiomTimer(){ if(idiomTimer){ clearInterval(idiomTimer); idiomTimer=null; } }
function startIdiomTimer(){ if(idiomTimer) clearInterval(idiomTimer); idiomTimer=setInterval(()=>{ const x=document.querySelector(".quote.notice"); if(!x){ clearInterval(idiomTimer); idiomTimer=null; return; } if(document.hidden) return; nextIdiom(x); },5000); }
function quoteBox(){
  const d=new Date(); const dayNo=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  const i=((dayNo+idiomShift)%IDIOMS.length+IDIOMS.length)%IDIOMS.length;
  const [idiom,ko,ex]=IDIOMS[i];
  const x=el("button","quote notice"); x.type="button"; x.setAttribute("aria-label",`오늘의 아이엘츠 idiom: ${idiom}. 누르면 전체 idiom 보기`);
  const top=el("span","q-top"); top.append(el("span","q-lab",idiomShift? "아이엘츠 idiom" : "오늘의 아이엘츠 idiom"), el("span","q-next","터치하면 다음 ›"));
  const line=el("span","n-line"); line.append(el("span","n-tag","오늘의 idiom"), el("b","n-idiom",idiom));
  const more=el("span","n-more"); more.append(el("span","n-mean",ko), el("span","n-ex",ex)); more.hidden=true;
  x.append(line, el("span","n-next","›"));
  x.onclick=()=>{ stopIdiomTimer(); idState=null; idMode="list"; go("idioms",{start:i}); };
  return x;
}

/* ---------- idiom study page ---------- */
let idMode="list", idState=null, idOpen=new Set();
function idiomToday(){ const d=new Date(); const dayNo=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000); return ((dayNo+idiomShift)%IDIOMS.length+IDIOMS.length)%IDIOMS.length; }
function renderIdioms(app){
  const back=el("button","back","‹ 홈"); back.type="button"; back.onclick=()=>go("home"); app.append(back);
  pageHead(app,"Idiom",`${IDIOMS.length}개 · 누르면 예시가 나와요`);
  const seg=el("div","modeseg two"); seg.setAttribute("role","tablist");
  for(const [k,label] of [["list","전체 보기"],["card","카드로 공부"]]){ const b=el("button"); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(idMode===k)); b.append(el("b",null,label)); b.onclick=()=>{ idMode=k; render(); }; seg.append(b); }
  app.append(seg);
  const start=view.start!=null? view.start : idiomToday();
  if(idMode==="list"){
    const box=el("div","idlist");
    const order=[start, ...IDIOMS.map((_,i)=>i).filter(i=>i!==start)];
    order.forEach((i,n)=>{ const [en,ko,ex]=IDIOMS[i];
      const r=el("button","idrow"+(n===0?" today":"")); r.type="button"; const open=idOpen.has(i); r.setAttribute("aria-expanded",String(open));
      const t=el("div","idt"); if(n===0) t.append(el("span","idtag","오늘의 idiom")); t.append(el("b",null,en), el("span","idko",ko));
      const exl=el("p","idex",ex); exl.hidden=!open; t.append(exl);
      r.append(t, el("span","idchev",open?"▴":"▾"));
      r.onclick=()=>{ if(idOpen.has(i)) idOpen.delete(i); else idOpen.add(i); exl.hidden=!idOpen.has(i); r.setAttribute("aria-expanded",String(idOpen.has(i))); r.querySelector(".idchev").textContent=idOpen.has(i)?"▴":"▾"; };
      box.append(r); });
    app.append(box); return;
  }
  if(!idState){ const rest=IDIOMS.map((_,i)=>i).filter(i=>i!==start).sort(()=>Math.random()-.5); idState={ids:[start,...rest], i:0, show:false}; }
  const S=idState, [en,ko,ex]=IDIOMS[S.ids[S.i]];
  const pg=el("div","prog"); pg.append(el("span",null,`${S.i+1} / ${S.ids.length}`)); const sh=el("button","linkbtn","다시 섞기"); sh.type="button"; sh.onclick=()=>{ idState=null; view.start=null; render(); }; pg.append(sh); app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=((S.i+1)/S.ids.length*100)+"%"; bar.append(bi); app.append(bar);
  const c=el("button","idcard"); c.type="button";
  const top=el("div","idc-top"); top.append(el("b",null,en)); c.append(top);
  if(S.show){ c.append(el("p","idc-ko",ko), el("p","idc-ex",ex)); } else c.append(el("p","idc-hint","무슨 뜻일까요? 눌러서 뜻과 예시 보기"));
  c.onclick=()=>{ S.show=!S.show; render(); }; app.append(c);
  const mv=d=>{ S.i=Math.max(0,Math.min(S.ids.length-1,S.i+d)); S.show=false; render(); };
  const acts=el("div","acts arrows");
  const prev=el("button","nav","‹ 이전"); prev.type="button"; prev.disabled=S.i===0; prev.onclick=()=>mv(-1);
  const next=el("button","nav","다음 ›"); next.type="button"; next.disabled=S.i>=S.ids.length-1; next.onclick=()=>mv(1);
  acts.append(prev,next); app.append(acts);
}

/* ---------- deck (browse by session) ---------- */
function renderDeck(app){
  if(!deckState || deckState.key!==view.deck){
    const list = (view.deck==="rand"||view.deck==="wrong"||view.deck==="vocab"||view.deck==="bm") ? (view.ids||[]).map(getCard).filter(Boolean)
               : view.deck==="all" ? [...D.cards].sort(()=>Math.random()-.5) : D.cards.filter(c=>(c.sessions||[]).includes(view.deck));
    deckState={key:view.deck, ids:list.map(c=>c.id), i:0};
  }
  const back=el("button","back", view.deck==="vocab"? (view.backTo==="words"? "‹ 단어 공부" : "‹ 아이디어 · Part 1") : view.deck==="bm"? "‹ 북마크" : view.deck==="rand"? "‹ 랜덤 퀴즈 설정" : view.deck==="wrong"? "‹ 틀린 문장 모음" : "‹ 회차별"); back.type="button"; back.onclick=()=>{ if(view.deck==="vocab"){ if(view.backTo==="words"){ go("words"); return; } ideaPart="p1"; go("ideas"); return; } if(view.deck==="bm") cardMode="bm"; else if(view.deck==="rand") cardMode="random"; else if(view.deck==="wrong") cardMode="wrong"; else { cardMode="session"; if(typeof view.deck==="number") selSession=view.deck; } go("cards"); };
  const s=D.sessions.find(x=>x.no===view.deck);
  const ids=deckState.ids; if(!ids.length){ app.append(back); const e=el("div","empty"); e.append(el("p",null,"카드가 없어요.")); app.append(e); return; }
  const c=getCard(ids[deckState.i]);
  app.append(lessonBar(back.onclick, deckState.i+1, ids.length));
  const sc=flipCard(c); sc.onswipe=d=>move(d); app.append(sc);
  const acts=el("div","acts");
  const prev=el("button","nav","‹"); prev.type="button"; prev.setAttribute("aria-label","이전 카드"); prev.disabled=deckState.i===0; prev.onclick=()=>move(-1);
  const again=el("button","again","헷갈려요"); again.type="button"; again.setAttribute("aria-pressed",String(marks[c.id]==="again")); again.onclick=()=>markDeck(c,"again");
  const know=el("button","know","알았어요"); know.type="button"; know.setAttribute("aria-pressed",String(marks[c.id]==="know")); know.onclick=()=>markDeck(c,"know");
  const next=el("button","nav","›"); next.type="button"; next.setAttribute("aria-label","다음 카드"); next.disabled=deckState.i>=ids.length-1; next.onclick=()=>move(1);
  acts.classList.add("arrows"); acts.append(prev,next); app.append(acts);
  app.append(el("p","hint2","카드를 누르면 뒤집혀요 · 옆으로 밀어서 넘기기"));
}
function move(d){ const n=deckState.i+d; if(n<0||n>=deckState.ids.length) return; deckState.i=n; flipped=false; picked=null; render(); }
function markDeck(c,kind){
  marks[c.id] = marks[c.id]===kind ? undefined : kind; if(!marks[c.id]) delete marks[c.id];
  touchDay(); save();
  const last=deckState.i>=deckState.ids.length-1;
  if(marks[c.id] && !last){ deckState.i++; flipped=false; picked=null; render(); }
  else { render(); }
}

/* ---------- spaced review ---------- */
function reviewQueue(extra){
  let pool = extra ? D.cards.filter(c=>isWriting(c) && ((srs[c.id]||{}).box||0)<MASTER) : dueCards();
  pool.sort((a,b)=>(rep(b)-rep(a)) || (((srs[a.id]||{}).box||0)-((srs[b.id]||{}).box||0)) || (marks[b.id]==="again")-(marks[a.id]==="again") || Math.random()-.5);
  return pool.slice(0, extra?10:DAILY).map(c=>c.id);
}
function sessRange(nums){
  const n=[...new Set(nums)].filter(x=>x!=null).sort((a,b)=>a-b); const out=[];
  for(let i=0;i<n.length;){ let j=i; while(j+1<n.length && n[j+1]===n[j]+1) j++; out.push(j-i>=2? `${n[i]}~${n[j]}` : n.slice(i,j+1).join("·")); i=j+1; }
  return out.join("·");
}
function renderReview(app){
  if(!reviewState){
    const ids = (view.ids && view.ids.length) ? view.ids : reviewQueue(view.extra);
    reviewState={ids, i:0, res:[]};
  }
  const R=reviewState;
  const c=R.ids[R.i] && D.cards.find(x=>x.id===R.ids[R.i]);
  if(!c){
  pageHead(app, view.extra? "약한 카드 연습" : "오늘의 복습", view.extra? "헷갈렸던 카드 10장을 다시 봐요." : `하루 ${DAILY}장씩, 다시 볼 때가 된 카드가 자동으로 나와요.`);
    const e=el("div","empty");
    if(R.res.length){ e.append(el("div","big","✓"), el("h2",null,"오늘 복습 끝!"), el("p",null,`${R.res.length}장을 복습했어요. 다음 복습 때 다시 나와요.`)); }
    else { e.append(el("div","big","✓"), el("h2",null,"오늘 복습할 카드가 없어요"), el("p",null,"내일 다시 열어 보세요.")); }
    const more=el("button","btn", dueCards().length? `남은 카드 이어서 하기 (${dueCards().length}장)` : "약한 카드 10장 더 하기"); more.type="button";
    more.onclick=()=>{ reviewState=null; view.extra=!dueCards().length; render(); };
    e.append(more); app.append(e); return;
  }
  app.append(lessonBar(()=>go("home"), R.i, R.ids.length));
  const sc=flipCard(c); sc.onswipe=d=>reviewMove(d); app.append(sc);
  const acts=el("div","acts arrows");
  const prev=el("button","nav","‹ 이전"); prev.type="button"; prev.disabled=R.i===0; prev.onclick=()=>reviewMove(-1);
  const next=el("button","nav", R.i+1<R.ids.length? "다음 ›" : "복습 끝내기"); next.type="button"; next.onclick=()=>reviewMove(1);
  acts.append(prev,next); app.append(acts);
  app.append(el("p","hint2","카드를 누르면 정답이 보여요 · 옆으로 밀어서 넘기기"));
}
function toast(msg,ok){ const t=el("div","toast "+(ok?"ok":"no"),msg); document.body.append(t); setTimeout(()=>t.remove(),1300); }
function reviewMove(d){ const R=reviewState; if(d<0){ if(R.i>0){ R.i--; flipped=false; picked=null; render(); } return; }
  const c=D.cards.find(x=>x.id===R.ids[R.i]); if(c && !R.res.some(r=>r.c.id===c.id)){ grade(c,true); R.res.push({ok:true,c}); }
  R.i++; flipped=false; picked=null; render(); window.scrollTo(0,0); }
function answer(c,ok){ toast(ok? "좋아요! 며칠 뒤에 다시 나와요" : "괜찮아요, 내일 다시 나와요", ok); grade(c,ok); reviewState.res.push({ok,c}); reviewState.i++; flipped=false; picked=null; render(); }

/* ---------- notes ---------- */
function noteRow(c){
  const r=el("div","m");
  r.append(el("span","wr", c.wrong || c.mine || c.ko));
  const rt=el("div","rt"); rt.append(el("span",null,c.en)); r.append(rt);
  const tp=c.note || (c.kind==="ko"? c.ko : ""); if(tp) r.append(el("span","tp",tp));
  const sd=el("div","sd"); sd.append(rep(c)? el("span","rep",`반복 ${c.sessions.join("·")}회`) : el("span","sess",sessLabel(c))); r.append(sd);
  return r;
}

/* ---------- ideas: Part 1 / Part 2 / Part 3 ---------- */
let ideaPart="p2", openKey=null, p2Query="", p2Lesson=false;
function renderIdeas(app){
  pageHead(app,"아이디어","스피킹 답변에 쓸 재료를 Part별로 모았어요.");
  const seg=el("div","modeseg"); seg.setAttribute("role","tablist");
  const n1=P1Q? P1Q.topics.reduce((b,t)=>b+t.qs.length,0) : 0;
  const n2=(P2? P2.items.length : 0)+(P2X? P2X.items.length : 0), n3=P3? P3.items.reduce((a,s)=>a+s.qs.length,0) : 0;
  for(const [k,label,sub] of [["p1","Part 1",`질문 ${n1}개`],["p2","Part 2",`주제 ${n2}개`],["p3","Part 3",`질문 ${n3}개`]]){
    const b=el("button"); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(ideaPart===k));
    b.append(el("b",null,label), el("span",null,sub)); b.onclick=()=>{ ideaPart=k; openKey=null; render(); }; seg.append(b);
  }
  app.append(seg);
  if(ideaPart==="p1") return renderP1(app);
  if(ideaPart==="p3") return renderP3(app);
  renderP2(app);
}
function fold(key, head, bodyFn){
  const open=openKey===key;
  const card=el("div","idea"+(open?" open":""));
  const h=el("button","idea-h"); h.type="button"; h.setAttribute("aria-expanded",String(open));
  h.append(head, el("span","chev",open?"−":"+"));
  h.onclick=()=>{ openKey= open? null : key; render(); };
  card.append(h); if(open){ const b=el("div","idea-b"); bodyFn(b); card.append(b); }
  return card;
}
function renderP1(app){
  if(!P1Q){ const e=el("div","empty"); e.append(el("p",null,"질문을 불러오지 못했어요.")); app.append(e); return; }
  const jump=el("div","pchips p1jump");
  P1Q.topics.forEach((tp,i)=>{ const b=el("button",null,tp.ko); b.type="button"; b.onclick=()=>{ const t=document.getElementById("p1t"+i); if(t) t.scrollIntoView({behavior:"smooth",block:"start"}); }; jump.append(b); });
  app.append(jump);
  P1Q.topics.forEach((tp,i)=>{
    const p=el("div","panel p1sec"); p.id="p1t"+i;
    const h=el("div","p1h"); const ht=el("div"); ht.append(el("b",null,tp.ko), el("span",null,tp.en)); h.append(ht, el("span","p1n",`${tp.qs.length}개`)); p.append(h);
    const ol=el("ol","p1q"); tp.qs.forEach(q=>ol.append(el("li",null,q))); p.append(ol);
    if(tp.vocab && tp.vocab.length){
      const vb=el("button","p1vbtn",`관련 어휘 ${tp.vocab.length}개 보기 ▾`); vb.type="button"; vb.setAttribute("aria-expanded","false");
      const vl=el("div","p1vocab"); vl.hidden=true;
      for(const [en,ko,ex] of tp.vocab){ const r=el("div","vrow"); const top=el("div","vtop"); top.append(el("b",null,en), el("span",null,ko)); r.append(top); if(ex) r.append(el("p","vex",ex)); vl.append(r); }
      vb.onclick=()=>{ const open=vl.hidden; vl.hidden=!open; vb.setAttribute("aria-expanded",String(open)); vb.textContent= open? `관련 어휘 접기 ▴` : `관련 어휘 ${tp.vocab.length}개 보기 ▾`; };
      p.append(vb, vl);
    }
    app.append(p);
  });
  app.append(el("p","muted small","참고: "+P1Q.source));
}
function startVocab(topics, title, shuffle, backTo, limit=20){
  let ids=[];
  for(const tp of topics){ tp.words.forEach(([en,ko,ex],i)=>{ const id=`v-${tp.topic}-${i}`.replace(/[^\w-]/g,"_");
    VCARDS[id]={id,kind:"ko",type:"어휘",vlabel: backTo==="words"? "아이엘츠 단어" : "주제별 어휘",vtopic:tp.ko,ko,en,gram:ex? ex.replace(/[<>&]/g,""):"",sessions:[]}; ids.push(id); }); }
  if(shuffle) ids=ids.sort(()=>Math.random()-.5).slice(0,limit);
  deckState=null; go("cards",{deck:"vocab", ids, title, backTo});
}

/* ---------- 4-choice word quiz (말해보카 style) ---------- */
let QZ=null;
const shuffle=a=>{ const x=[...a]; for(let i=x.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; } return x; };
function allWords(){ const out=[]; if(WB) WB.sections.forEach(s=>s.groups.forEach(g=>g.words.forEach(w=>out.push(w)))); if(P1) P1.topics.forEach(t=>t.words.forEach(w=>out.push(w))); return out; }
function startQuiz(words, title, n=10, back){
  const pool=words.length>=4? words : allWords();
  const qs=shuffle(words).slice(0,n).map(w=>{
    const wc=x=>Math.min(3,x[0].trim().split(/\s+/).length);
    const lw=w[0].toLowerCase(); const others=shuffle(pool.filter(o=>{ const lo=o[0].toLowerCase(); return lo!==lw && o[1]!==w[1] && !lo.includes(lw) && !lw.includes(lo); })).sort((a,b)=>Math.abs(wc(a)-wc(w))-Math.abs(wc(b)-wc(w)));
    const seen=new Set([w[0].toLowerCase()]); const opts=[w];
    for(const o of others){ if(opts.length>=4) break; if(!seen.has(o[0].toLowerCase())){ seen.add(o[0].toLowerCase()); opts.push(o); } }
    return {w, opts:shuffle(opts)};
  });
  QZ={qs, i:0, res:[], chosen:null, title, back: back||(()=>{ QZ=null; render(); })};
  render(); window.scrollTo(0,0);
}
function renderQuiz(app){
  const Q=QZ;
  if(Q.i>=Q.qs.length){
    const ok=Q.res.filter(r=>r.ok).length, wrong=Q.res.filter(r=>!r.ok);
    const e=el("div","empty"); e.append(el("div","big",`${ok}/${Q.res.length}`), el("h2",null, ok===Q.res.length? "전부 맞혔어요!" : "퀴즈 끝!"));
    if(wrong.length){ const ul=el("div","wronglist qwl"); wrong.forEach(r=>{ const row=el("div"); row.append(el("b",null,r.w[0]), el("span",null,r.w[1])); ul.append(row); }); e.append(ul);
      const again=el("button","btn primary","틀린 단어 다시 풀기"); again.type="button"; again.onclick=()=>startQuiz(wrong.map(r=>r.w), Q.title+" (다시)", wrong.length, Q.back); e.append(again); }
    const send=el("button","btn","선생님께 결과 보내기"); send.type="button";
    send.onclick=()=>{ const d=new Date(); let t=`[${D.name} · 단어 퀴즈 ${Q.title} · ${d.getMonth()+1}/${d.getDate()}]\n맞힘 ${ok} / ${Q.res.length}개`; if(wrong.length) t+=`\n틀린 단어:\n`+wrong.map(r=>`- ${r.w[0]} (${r.w[1]})`).join("\n"); reportSheet(`단어 퀴즈 ${Q.title}`, ok, Q.res.length, t); };
    const done=el("button","btn","끝내기"); done.type="button"; done.onclick=()=>Q.back();
    e.append(send, done); app.append(e); return;
  }
  const q=Q.qs[Q.i];
  app.append(lessonBar(()=>Q.back(), Q.i, Q.qs.length));
  const box=el("div","qz");
  box.append(el("p","qz-ask","이 뜻의 영어는?"), el("p","qz-ko",q.w[1].replace(/\s*\([^)]*[A-Za-z][^)]*\)/g,"").trim()||q.w[1]));
  const list=el("div","qz-opts");
  q.opts.forEach((o,k)=>{
    const b=el("button","qz-opt"); b.type="button"; b.append(el("span","qz-n",String(k+1)), el("span",null,o[0]));
    if(Q.chosen!=null){ b.disabled=true; if(o===q.w) b.classList.add("right"); else if(o===Q.chosen) b.classList.add("wrong"); }
    b.onclick=()=>{ if(Q.chosen!=null) return; Q.chosen=o; const ok=o===q.w; Q.res.push({w:q.w, ok}); speak(q.w[0]); render(); };
    list.append(b);
  });
  box.append(list); app.append(box);
  if(Q.chosen!=null){
    const ok=Q.chosen===q.w;
    const fb=el("div","qz-fb "+(ok?"ok":"no"));
    fb.append(el("b",null, ok? "정답이에요!" : "아쉬워요"));
    const ans=el("p","qz-ans"); ans.append(el("b",null,q.w[0]), document.createTextNode(" · "+q.w[1])); fb.append(ans);
    if(!ok) fb.append(el("p","qz-ex",`고른 단어 ${Q.chosen[0]} = ${Q.chosen[1]}`));
    if(q.w[2]) fb.append(el("p","qz-ex",q.w[2]));
    const nx=el("button","btn primary", Q.i+1<Q.qs.length? "다음" : "결과 보기"); nx.type="button"; nx.onclick=()=>{ Q.i++; Q.chosen=null; render(); window.scrollTo(0,0); };
    fb.append(nx); app.append(fb);
    setTimeout(()=>{ try{ nx.scrollIntoView({block:"nearest",behavior:"smooth"}); }catch(_){} },50);
  } else app.append(el("p","hint2","알맞은 단어를 눌러 주세요"));
}
function renderP2X(app){
  app.append(el("p","muted small",`추가 주제 ${P2X.items.length}개 · Part 3 탭에 심화 질문도 있어요.`));
  for(const it of P2X.items){
    const sec=el("div","panel p3sec");
    sec.append(el("span","from2",`#${it.no}`), el("b","p3t",it.topic), el("span","idea-lab","You should say"));
    const ul=el("ul","say"); it.say.forEach(x=>ul.append(el("li",null,x))); sec.append(ul);
    app.append(sec);
  }
}
function renderP3(app){
  const t=el("div","focus p3tips"); t.append(el("b",null,"Part 3 답변 요령"));
  const ol=el("ol","steps4");
  for(const [n,k,ex] of [["1","명확한 대답","Yes, I think…"],["2","근거","That's because…"],["3","예시","For example, …"],["4","다시 한 번 정리","So that's why…"]]){ const li=el("li"); li.append(el("b",null,`${n}. ${k}`), el("span",null,ex)); ol.append(li); }
  t.append(ol); app.append(t);
  if(!P3) return;
  const inp=el("input"); inp.type="search"; inp.placeholder="주제 검색 (예: friend, 옥스포드, technology)"; inp.setAttribute("aria-label","Part 3 주제 검색"); inp.className="p3search";
  const cnt=el("p","muted small",`Part 2 주제 ${P3.items.length}개 · 주제마다 심화 질문`);
  const apply=()=>{ const q=inp.value.trim().toLowerCase(); let n=0; document.querySelectorAll(".p3sec").forEach(c=>{ const ok=!q||c.dataset.search.includes(q); c.hidden=!ok; if(ok) n++; }); cnt.textContent=`${n}개 주제`; };
  inp.addEventListener("input",e=>{ if(e.isComposing) return; apply(); }); inp.addEventListener("compositionend",apply);
  cnt.textContent=`Part 2 주제 ${P3.items.length}개 · 주제마다 심화 질문`; app.append(cnt);
  for(const it of P3.items){
    const p2=P2&&P2.items.find(x=>x.no===it.no);
    const sec=el("div","panel p3sec"); sec.dataset.search=(it.topic+" "+(p2? p2.answer+" "+p2.points.join(" "):"")+" "+it.qs.join(" ")).toLowerCase();
    sec.append(el("span","from2",(it.no>=70? `Part 2 추가 #${it.no}` : `Part 2 #${it.no}`)+(it.lesson? ` · ${it.lesson}회차 수업 질문`:"")), el("b","p3t",it.topic));
    const ol=el("ol","p1q"); it.qs.forEach(q=>ol.append(el("li",null,q))); sec.append(ol);
    app.append(sec);
  }
}
let p2Set="main";
function renderP2(app){
  if(P2X){ const sw=el("div","pchips");
    for(const [k,l,n] of [["main","기출 문제",P2?P2.items.length:0],["extra","추가 주제",P2X.items.length]]){ const b=el("button",null,l); b.type="button"; b.append(el("small",null,String(n))); b.setAttribute("aria-pressed",String(p2Set===k)); b.onclick=()=>{ p2Set=k; openKey=null; render(); }; sw.append(b); }
    app.append(sw);
    if(p2Set==="extra") return renderP2X(app);
  }
  if(!P2){ const e=el("div","empty"); e.append(el("p",null,"Part 2 자료를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.")); app.append(e); return; }
  const tools=el("div","p2tools");
  const inp=el("input"); inp.id="p2search"; inp.type="search"; inp.placeholder="주제 검색 (예: friend, 옥스포드, technology)"; inp.value=p2Query; inp.setAttribute("aria-label","Part 2 주제 검색");
  // filter in place (no full re-render), so typing Korean on a phone keeps working
  const applyFilter=()=>{ p2Query=inp.value; const q=p2Query.trim().toLowerCase(); let n=0;
    document.querySelectorAll(".idea[data-search]").forEach(c=>{ const ok=!q || c.dataset.search.includes(q); c.hidden=!ok; if(ok) n++; });
    const cnt=document.getElementById("p2count"); if(cnt) cnt.textContent=`${n}개 주제`;
    const em=document.getElementById("p2empty"); if(em) em.hidden = n>0; };
  inp.addEventListener("input",e=>{ if(e.isComposing) return; applyFilter(); });
  inp.addEventListener("compositionend",applyFilter);
  const chip=el("button",null,"수업에서 다룬 주제만"); chip.type="button"; chip.className="lessonchip"; chip.setAttribute("aria-pressed",String(p2Lesson)); chip.onclick=()=>{ p2Lesson=!p2Lesson; render(); };
  p2Query="";
  const q=p2Query.trim().toLowerCase();
  const hay=it=>(it.topic+" "+it.answer+" "+it.points.join(" ")+" "+(it.alts||[]).join(" ")).toLowerCase();
  const list=P2.items.filter(it=>(!p2Lesson || it.lesson));
  const shown=list.filter(it=>!q || hay(it).includes(q)).length;
  const cnt=el("p","muted small",`기출 ${shown}개 주제`); cnt.id="p2count"; app.append(cnt);
  for(const it of list){
    const hd=el("div");
    const top=el("span","from2", `#${it.no}`+(it.lesson? ` · ${it.lesson}회차 수업에서 다룸`:""));
    hd.append(top, el("b",null,it.topic));
    if(it.answer) hd.append(el("span","ans-chip",`답변: ${it.answer}`));
    const card=fold("p2-"+it.no, hd, b=>{
      if(it.intro) b.append(el("p","p2intro",it.intro));
      if(it.points.length){ b.append(el("span","idea-lab","말할 거리")); const ol=el("ol","pts"); it.points.forEach(x=>{ const li=el("li"); li.append(el("span","pe2",x)); ol.append(li); }); b.append(ol); }
      if(it.alts&&it.alts.length){ b.append(el("span","idea-lab","다른 답변 아이디어")); const ex=el("div","alts"); it.alts.forEach(x=>ex.append(el("span",null,x))); b.append(ex); }
    });
    card.dataset.search=hay(it); card.hidden = !!q && !hay(it).includes(q);
    app.append(card);
  }
  const e=el("div","empty"); e.id="p2empty"; e.append(el("p",null,"검색 결과가 없어요. 검색어를 지우면 다시 보여요.")); e.hidden = shown>0; app.append(e);
}



/* ---------- IELTS word study ---------- */
let wbSec="all", wordMode="vocab";
function wordsTile(){
  const n = WB? WB.sections.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.words.length,0),0) : 0;
  const t=el("button","tile wtile"); t.type="button";
  const tt=el("div","t"); tt.append(el("b",null,"아이엘츠 단어 공부하기"), el("span",null, n? `리스닝 · 스피킹 · 리딩·라이팅 단어 ${n}개` : "단어를 불러오는 중…"));
  t.append(el("span","no","Aa"), tt, el("span","go","›")); t.onclick=()=>go("words");
  return t;
}
function wbTopics(secs){ return secs.flatMap(s=>s.groups.map(g=>({topic:`${s.key}-${g.name}`, ko:`${s.ko} · ${g.name}`, words:g.words}))); }
function renderWords(app){
  if(LD) return renderDictation(app);
  pageHead(app,"철자","리스닝에서 자주 틀리는 단어를 듣고 써 봐요.");
  return renderListen(app);
}
function renderWordsOld(app){
  if(wordMode==="spell") return renderListen(app);
  if(!WB){ const e=el("div","empty"); e.append(el("p",null,"단어를 불러오지 못했어요.")); app.append(e); return; }
  const chips=el("div","pchips"); chips.setAttribute("role","group");
  for(const [k,l] of [["all","전체"],...WB.sections.map(s=>[s.key,s.ko])]){ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(wbSec===k)); b.onclick=()=>{ wbSec=k; openKey=null; render(); }; chips.append(b); }
  app.append(chips);
  const secs = wbSec==="all"? WB.sections : WB.sections.filter(s=>s.key===wbSec);
  const total=secs.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.words.length,0),0);
  const ttl = wbSec==="all"? "아이엘츠 단어" : secs[0].ko+" 단어";
  const row0=el("div","btnrow two");
  const qz=el("button","btn primary","퀴즈 10문제"); qz.type="button"; qz.onclick=()=>startQuiz(secs.flatMap(s=>s.groups.flatMap(g=>g.words)), ttl, 10);
  const start=el("button","btn",`카드 20장`); start.type="button"; start.onclick=()=>startVocab(wbTopics(secs), ttl, true, "words", 20);
  row0.append(qz,start); app.append(row0);
  for(const s of secs){
    if(wbSec==="all") app.append(el("h2","wsec",`${s.ko} · ${s.en}`));
    for(const g of s.groups){
      const hd=el("div"); hd.append(el("span","from2",`${s.ko} · ${g.words.length}개`), el("b",null,g.name));
      app.append(fold(`wb-${s.key}-${g.name}`, hd, b=>{
        const r1=el("div","btnrow two");
        const q1=el("button","btn primary",`퀴즈 ${Math.min(10,g.words.length)}문제`); q1.type="button"; q1.onclick=()=>startQuiz(g.words, g.name, 10);
        const go1=el("button","btn",`카드 ${g.words.length}장`); go1.type="button"; go1.onclick=()=>startVocab([{topic:`${s.key}-${g.name}`, ko:`${s.ko} · ${g.name}`, words:g.words}], g.name, false, "words");
        r1.append(q1,go1); b.append(r1);
        for(const [en,ko,ex] of g.words){ const r=el("div","vrow"); const top=el("div","vtop"); top.append(el("b",null,en), el("span",null,ko)); r.append(top); if(ex) r.append(el("p","vex",ex)); b.append(r); }
      }));
    }
  }
  app.append(el("p","muted small","참고: "+WB.sources.join(" · ")+". 뜻과 예문은 수업용으로 새로 썼어요."));
}

/* ---------- listening spelling ---------- */
const ALT={centre:["center"],theatre:["theater"],licence:["license"],civilisation:["civilization"],behaviour:["behavior"],organisation:["organization"],aluminum:["aluminium"],airplane:["aeroplane"],cooperation:["co-operation"],mathematics:["maths","math"],"physical education":["pe"],"check up":["check-up","checkup"],"bachelor's":["bachelors"],"master's":["masters"],"bush fires":["bushfires"],"hydro electrical power":["hydroelectric power"],"united kingdom":["the united kingdom","uk"],colour:["color"]};
let lsPart="Part 1", lsCat=null, LD=null;
const SPEAK_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const canSpeak = ()=> "speechSynthesis" in window && typeof SpeechSynthesisUtterance!=="undefined";
let enVoice=null;
function pickVoice(){ try{ const vs=speechSynthesis.getVoices(); enVoice = vs.find(v=>/en-GB/i.test(v.lang)) || vs.find(v=>/^en/i.test(v.lang)) || null; }catch(_){} }
if(canSpeak()){ pickVoice(); try{ speechSynthesis.onvoiceschanged=pickVoice; }catch(_){} }
function speak(word, slow){
  if(!canSpeak()) return false;
  try{ speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(word); u.lang="en-GB"; if(enVoice) u.voice=enVoice; u.rate= slow? .55 : .85; speechSynthesis.speak(u); return true; }catch(_){ return false; }
}
function speakBtn(word, label){ const b=el("button","spk"); b.type="button"; b.innerHTML=SPEAK_ICON; b.setAttribute("aria-label",label||`${word} 듣기`); b.onclick=e=>{ e.stopPropagation(); speak(word); }; return b; }
function renderListen(app){
  if(!LS){ const e=el("div","empty"); e.append(el("p",null,"자료를 불러오지 못했어요.")); app.append(e); return; }
  const all=LS.categories.flatMap(c=>c.words);
  const t=el("div","focus"); t.append(el("b",null,"철자 하나 틀려도 오답이에요"), document.createTextNode("리스닝에서 철자 때문에 자주 틀리는 단어예요. 듣고 직접 써 보세요. 영국식·미국식 철자는 둘 다 정답이에요.")); app.append(t);
  const row=el("div","btnrow");
  const s20=el("button","btn primary",`받아쓰기`); s20.type="button"; s20.onclick=()=>startDictation([...all].sort(()=>Math.random()-.5).slice(0,20),"받아쓰기");
  const sAll=el("button","btn",`전체 ${all.length}개`); sAll.type="button"; sAll.onclick=()=>startDictation([...all].sort(()=>Math.random()-.5),`전체 ${all.length}개`);
  row.append(s20); app.append(row);
  if(!canSpeak()) app.append(el("p","muted small","이 기기에서는 소리 재생이 안 돼요. 뜻을 보고 철자를 써 보세요."));
  const p=el("div","panel"); const h=el("div","ghead"); h.append(el("b",null,"단어 목록"), el("span",null,`${all.length}개 · 눌러서 듣기`)); p.append(h);
  for(const [w,ko,tip] of all){
    const r=el("div","lrow"); r.append(speakBtn(w));
    const t2=el("div"); const top=el("div","vtop"); top.append(el("b",null,w), el("span",null,ko)); t2.append(top); if(tip) t2.append(el("p","ltip",tip));
    r.append(t2); p.append(r);
  }
  app.append(p);
}
function startDictation(words, title){ LD={words, title, i:0, res:[], checked:false, typed:""}; wordMode="spell"; go("words"); setTimeout(()=>speak(words[0][0]),250); }
function norm(x){ return String(x||"").trim().toLowerCase().replace(/\s+/g," "); }
function isRight(word, typed){ const t=norm(typed); return t===word.toLowerCase() || (ALT[word.toLowerCase()]||[]).includes(t); }
function diffSpans(correct, typed){
  // align typed to correct (edit distance) and mark letters of the correct word that were missed or wrong
  const a=correct.toLowerCase(), b=norm(typed); const n=a.length, m=b.length;
  const d=Array.from({length:n+1},(_,i)=>Array.from({length:m+1},(_,j)=> i===0? j : j===0? i : 0));
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  const bad=new Set(); let i=n, j=m;
  while(i>0 && j>0){ if(a[i-1]===b[j-1] && d[i][j]===d[i-1][j-1]){ i--; j--; } else if(d[i][j]===d[i-1][j-1]+1){ bad.add(i-1); i--; j--; } else if(d[i][j]===d[i-1][j]+1){ bad.add(i-1); i--; } else { if(i<n) bad.add(i); else bad.add(i-1); j--; } }
  while(i>0){ bad.add(i-1); i--; }
  const w=el("span","dword"); [...correct].forEach((ch,k)=>{ const sp=el("span", bad.has(k)? "bad" : null, ch); w.append(sp); }); return w;
}
function renderDictation(app){
  const L=LD;
  const back=el("button","back","‹ 철자 받아쓰기"); back.type="button"; back.onclick=()=>{ LD=null; try{ speechSynthesis.cancel(); }catch(_){} render(); };
  if(L.i>=L.words.length){
    app.append(back, el("h1",null,L.title));
    const ok=L.res.filter(r=>r.ok).length; const wrong=L.res.filter(r=>!r.ok);
    const e=el("div","empty"); e.append(el("div","big",`${ok}/${L.res.length}`), el("h2",null, ok===L.res.length? "전부 맞혔어요!" : "받아쓰기 끝!"));
    if(wrong.length){ const ul=el("div","wronglist"); wrong.forEach(r=>{ const row=el("div"); row.append(speakBtn(r.w[0]), el("b",null,r.w[0]), el("s",null,r.typed||"(빈칸)")); ul.append(row); }); e.append(ul);
      const again=el("button","btn primary","틀린 단어 다시 하기"); again.type="button"; again.onclick=()=>startDictation(wrong.map(r=>r.w), L.title+" (다시)"); e.append(again); }
    const send=el("button","btn","선생님께 결과 보내기"); send.type="button";
    send.onclick=()=>{ const d=new Date(); let t=`[${D.name} · 철자 연습 ${L.title} · ${d.getMonth()+1}/${d.getDate()}]\n맞힘 ${ok} / ${L.res.length}개`; if(wrong.length) t+=`\n틀린 철자:\n`+wrong.map(r=>`- ${r.w[0]} (쓴 답: ${r.typed||"빈칸"})`).join("\n"); reportSheet(`철자 연습 ${L.title}`, ok, L.res.length, t); };
    e.append(send); app.append(e); return;
  }
  const [w,ko,tip]=L.words[L.i];
  app.append(lessonBar(back.onclick, L.i, L.words.length));
  const card=el("div","dict");
  if(canSpeak()){
    const row=el("div","playrow");
    const p1=el("button","btn primary play"); p1.type="button"; p1.innerHTML=SPEAK_ICON; p1.append(document.createTextNode(" 듣기")); p1.onclick=()=>speak(w);
    if(ko) card.append(el("p","dko",ko));
    row.append(p1); card.append(row);
    card.append(el("p","muted small", L.checked? "" : "뜻을 보고, 들리는 단어의 철자를 써 보세요"));
  } else { card.append(el("p","dko",ko), el("p","muted small","뜻을 보고 영어 철자를 써 보세요")); }
  const inp=el("input","dinput"); inp.id="dinput"; inp.type="text"; inp.value=L.typed; inp.placeholder="철자 입력";
  ["autocomplete","autocorrect","autocapitalize"].forEach(k=>inp.setAttribute(k,"off")); inp.spellcheck=false; inp.setAttribute("aria-label","들은 단어 철자"); inp.readOnly=L.checked;
  inp.oninput=()=>{ L.typed=inp.value; };
  const check=()=>{ if(L.checked) return next(); L.checked=true; L.res.push({w:L.words[L.i], typed:L.typed, ok:isRight(w,L.typed)}); render(); };
  const next=()=>{ L.i++; L.checked=false; L.typed=""; render(); if(L.i<L.words.length) setTimeout(()=>speak(L.words[L.i][0]),200); };
  inp.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); check(); } };
  card.append(inp);
  if(L.checked){
    const r=L.res[L.res.length-1];
    const res=el("div","dres "+(r.ok?"ok":"no"));
    res.append(el("b",null, r.ok? "정답!" : "아쉬워요"));
    const ans=el("div","dans"); ans.append(diffSpans(w, r.ok? w : L.typed), el("span",null,ko)); res.append(ans);
    if(!r.ok && L.typed) res.append(el("p","mine2",`내 답: ${L.typed}`));
    if(tip) res.append(el("p","ltip",tip));
    card.append(res);
  }
  const btn=el("button","btn primary vstart", L.checked? (L.i+1<L.words.length? "다음 단어" : "결과 보기") : "확인"); btn.type="button"; btn.onclick=check; card.append(btn);
  app.append(card);
  if(!L.checked) setTimeout(()=>{ try{ document.getElementById("dinput").focus({preventScroll:true}); }catch(_){} },0);
}

/* ---------- report to teacher ---------- */
function openReport(kind){
  let title, lines=[], okN=0, total=0, again=[];
  const d=new Date(), md=(d.getMonth()+1)+"/"+d.getDate();
  if(kind==="review" && reviewState){
    total=reviewState.res.length; okN=reviewState.res.filter(r=>r.ok).length; again=reviewState.res.filter(r=>!r.ok).map(r=>r.c);
    title=`오늘의 복습`; lines.push(`맞힘 ${okN} / ${total}장`);
  } else {
    const ids=deckState? deckState.ids : []; total=ids.length;
    okN=ids.filter(id=>marks[id]==="know").length; again=ids.filter(id=>marks[id]==="again").map(getCard);
    title = !deckState ? "큐카드" : deckState.key==="vocab" ? `${view.title||"주제별 어휘"} 어휘 카드` : deckState.key==="rand" ? "랜덤 퀴즈" : deckState.key==="wrong" ? "틀린 문장 연습" : deckState.key==="all" ? "전체 큐카드" : `${deckState.key}회차 큐카드`;
    lines.push(`알았어요 ${okN} / ${total}장`);
    const rest=total-okN-again.length; if(rest>0) lines.push(`아직 표시 안 한 카드 ${rest}장`);
  }
  let text=`[${D.name} · ${title} · ${md}]\n`+lines.join("\n");
  if(again.length) text+=`\n다시 볼 문장 ${again.length}개:\n`+again.map(c=>"- "+c.en).join("\n");
  text+=`\n연속 공부 ${streak()}일`;
  reportSheet(title, okN, total, text);
}
function reportSheet(title, okN, total, text){
  const bg=el("div","sheet-bg"); const sh=el("div","sheet"); sh.setAttribute("role","dialog"); sh.setAttribute("aria-label","선생님께 결과 보내기");
  sh.append(el("div","big",`${okN}/${total}`), el("h2",null, `${title} 끝!`), el("p","muted small","아래 내용이 선생님께 전달돼요."));
  const ta=el("textarea"); ta.id="reportText"; ta.readOnly=true; ta.value=text; ta.setAttribute("aria-label","보낼 내용"); sh.append(ta);
  const row=el("div","row");
  if(D.form && D.form.url){
    const a=el("a","btn primary","선생님께 완료 알림 보내기");
    a.href=D.form.url.replace("NAME_X",encodeURIComponent(D.name)).replace("SESSION_X",encodeURIComponent(title)).replace("RESULT_X",encodeURIComponent(text));
    a.target="_blank"; a.rel="noopener"; row.append(a);
  }
  const cp=el("button","btn kakao","복사해서 카톡으로 보내기"); cp.type="button";
  const note=el("p","note");
  cp.onclick=()=>{ const fb=()=>{ ta.focus(); ta.select(); note.textContent="글자를 길게 눌러 복사한 뒤 카톡에 붙여 넣어 주세요."; };
    try{ navigator.clipboard.writeText(text).then(()=>{ note.textContent="복사했어요! 카톡 선생님 채팅방에 붙여 넣어 주세요."; }, fb); }catch(_){ fb(); } };
  const close=el("button","btn","닫기"); close.type="button"; close.onclick=()=>bg.remove();
  row.append(cp, close); sh.append(row, note);
  bg.append(sh); bg.onclick=e=>{ if(e.target===bg) bg.remove(); };
  document.body.append(bg);
}

document.addEventListener("keydown",e=>{
  if(view.tab==="cards" && view.deck!=null && deckState && !/INPUT|TEXTAREA/.test(e.target.tagName)){
    if(e.key==="ArrowRight") move(1); if(e.key==="ArrowLeft") move(-1);
  }
});
window.addEventListener("hashchange",()=>{ if(window.BANDUP_SLUG) return; const h=location.hash.replace(/^#/,""); if(h && h!==slug){ location.reload(); } });
if("serviceWorker" in navigator && location.protocol==="https:" && !/claude|claudeusercontent/.test(location.hostname)){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
boot();
})();
