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

let D=null, G={}, P1=null, P2=null, LS=null, WB=null, slug=null;
let srs={}, marks={}, days=[];
let view={tab:"home"};   // home | cards(deck?) | review | notes
let deckState=null, reviewState=null, picked=null, flipped=false, noteFilter="전체", noteSession="all", cardMode="session", selSession=null, randCount=10, randKind="all";

/* ---------- boot ---------- */
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
    const [s,g]=await Promise.all([fetch(`data/students/${slug}.json`,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }),
                                   fetch("data/glossary.json",{cache:"no-cache"}).then(r=>r.ok? r.json():{}).catch(()=>({}))]);
    D=s; G=g||{};
    [P1,P2,LS,WB]=await Promise.all(["data/part1.json","data/part2.json","data/listening.json","data/words.json"].map(u=>fetch(u,{cache:"no-cache"}).then(r=>r.ok? r.json():null).catch(()=>null)));
  }catch(e){ app.textContent=""; const x=el("div","empty"); x.append(el("h2",null,"카드를 불러오지 못했어요"), el("p",null,"인터넷 연결을 확인하고 다시 열어 주세요. 계속 안 되면 선생님께 링크를 다시 받아 주세요.")); app.append(x); return; }
  store.set("bandup-slug",slug);
  srs=store.get(`bandup-srs-${slug}`,{}); marks=store.get(`bandup-marks-${slug}`,{}); days=store.get(`bandup-days-${slug}`,[]);
  document.title=`${D.name}님 · 밴드업 아이엘츠`;
  $("#who").textContent=`${D.name}님`;
  buildTabs(); render();
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
function dueCards(){ const t=today(); return D.cards.filter(c=>{ const s=srs[c.id]||{}; return (s.box||0)<MASTER && (s.due||t)<=t; }); }
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
  review:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  listen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>',
  ideas:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>'
};
function buildTabs(){
  const nav=$("#tabs nav"); nav.textContent="";
  for(const [k,label] of [["home","홈"],["cards","큐카드"],["review","복습"],["ideas","아이디어"],["listen","철자"]]){
    const b=el("button"); b.type="button"; b.dataset.tab=k; b.innerHTML=ICONS[k]; b.append(el("span",null,label));
    if(k==="review"){ const bd=el("span","badge"); bd.id="dueBadge"; b.append(bd); }
    b.onclick=()=>{ go(k); };
    nav.append(b);
  }
}
function go(tab, extra){ if(tab!=="listen" && typeof LD!=="undefined"){ LD=null; try{ speechSynthesis.cancel(); }catch(_){} } view={tab, ...(extra||{})}; flipped=false; picked=null; if(tab!=="cards") deckState=null; if(tab!=="review") reviewState=null; render(); window.scrollTo(0,0); }
function updateTabs(){
  document.querySelectorAll("#tabs button").forEach(b=>{ if(b.dataset.tab===view.tab) b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current"); });
  const n=dueCards().length, bd=$("#dueBadge"); if(bd){ bd.textContent=n>99?"99+":String(n); bd.hidden=!n; }
}

/* ---------- render ---------- */
function render(){
  const app=$("#app"); app.textContent="";
  if(view.tab==="home") renderHome(app);
  if(view.tab==="cards") (view.deck!=null? renderDeck(app) : renderDecks(app));
  if(view.tab==="review") renderReview(app);
  if(view.tab==="notes") renderNotes(app);
  if(view.tab==="ideas") renderIdeas(app);
  if(view.tab==="listen") renderListen(app);
  if(view.tab==="words") renderWords(app);
  updateTabs();
}

function renderHome(app){
  const due=dueCards().length;
  const h=el("div","hello"); const h1=el("h1"); h1.append(document.createTextNode(`${D.name}님, `), el("b",null,due? `오늘 ${Math.min(due,DAILY)}장`: "오늘 복습 끝!"));
  h.append(h1); app.append(h);
  const st=el("div","stats");
  for(const [cls,n,l] of [["due",due,"복습할 카드"],["streak",streak(),"연속 공부일"]]){
    const s=el("div","stat "+cls); s.append(el("b",null,String(n)), el("span",null,l)); st.append(s);
  }
  app.append(st);
  const hero=el("div","hero");
  hero.append(el("h2",null, due? "오늘의 복습을 시작해요" : "더 연습하고 싶다면"), el("p",null, due? "반복해서 틀린 문장부터 먼저 나와요." : "헷갈렸던 카드 10장을 다시 볼 수 있어요."));
  const b=el("button",null, due? `복습 시작 (${Math.min(due,DAILY)}장)` : "약한 카드 연습"); b.type="button"; b.onclick=()=>go("review",{extra:!due}); hero.append(b);
  app.append(hero);
  const last=D.sessions[D.sessions.length-1];
  if(last){
    app.append(wordsTile());
    app.append(quoteBox());
  }
  if(false){
    const ins=el("div","install"); ins.append(el("b",null,"앱처럼 쓰려면 홈 화면에 추가하세요"),
      el("span",null,"아이폰: Safari 아래 공유 버튼 → '홈 화면에 추가'"), el("span",null,"안드로이드: Chrome 오른쪽 위 ⋮ → '홈 화면에 추가'"));
    app.append(ins);
  }
}
function deckTile(s){
  const n=D.cards.filter(c=>(c.sessions||[]).includes(s.no)).length;
  const t=el("button","tile"); t.type="button";
  const tt=el("div","t"); tt.append(el("b",null,`${s.no}회차 큐카드`), el("span",null,`${mmdd(s.date)} · ${s.title} · ${n}장`));
  t.append(el("span","no",String(s.no)), tt, el("span","go","›"));
  t.onclick=()=>go("cards",{deck:s.no});
  return t;
}

function renderDecks(app){
  app.append(el("h1",null,"큐카드"));
  const seg=el("div","modeseg"); seg.setAttribute("role","tablist");
  for(const [k,label,sub] of [["session","회차별 정리","회차마다 모아 보기"],["wrong","틀린 문장",`${D.cards.filter(isWrong).length}개 모아 보기`],["random","랜덤 퀴즈",`1~${D.sessions[D.sessions.length-1].no}회차 섞어서`]]){
    const b=el("button"); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(cardMode===k));
    b.append(el("b",null,label), el("span",null,sub)); b.onclick=()=>{ cardMode=k; render(); }; seg.append(b);
  }
  app.append(seg);
  if(cardMode==="random") return renderRandomSetup(app);
  if(cardMode==="wrong") return renderWrongList(app);
  if(selSession==null) selSession=D.sessions[D.sessions.length-1].no;
  app.append(sessionPicker(selSession, v=>{ selSession=v; render(); }, false));
  const s=D.sessions.find(x=>x.no===selSession);
  const inS=D.cards.filter(c=>(c.sessions||[]).includes(selSession));
  const wrong=inS.filter(c=>c.kind==="fix" || (c.mine && !c.good));
  const keep=inS.filter(c=>!(c.kind==="fix" || (c.mine && !c.good)));
  const head=el("div","sess-head");
  const ht=el("div"); ht.append(el("h2",null,`${selSession}회차`), el("span","muted small",`${mmdd(s&&s.date)} · ${s?s.title:""}`));
  const startB=el("button","btn primary",`카드로 연습 ${inS.length}장`); startB.type="button"; startB.onclick=()=>go("cards",{deck:selSession});
  head.append(ht,startB); app.append(head);
  const f=D.focus&&D.focus[String(selSession)];
  if(f){ const x=el("div","focus"); x.append(el("b",null,"이 회차 포인트"), document.createTextNode(f)); app.append(x); }
  const p1=el("div","panel"); { const gh=el("div","ghead"); gh.append(el("b",null,"틀렸던 문장"), el("span",null,`${wrong.length}개`)); p1.append(gh); }
  if(!wrong.length) p1.append(el("p","gtip","이 회차에는 고친 문장이 없어요."));
  wrong.forEach(c=>p1.append(noteRow(c))); app.append(p1);
  const p2=el("div","panel"); { const gh=el("div","ghead"); gh.append(el("b",null,"외워 둘 문장"), el("span",null,`${keep.length}개`)); p2.append(gh); }
  if(!keep.length) p2.append(el("p","gtip","이 회차에는 따로 외울 문장이 없어요."));
  keep.forEach(c=>p2.append(keepRow(c))); app.append(p2);
}
function keepRow(c){
  const r=el("div","m");
  r.append(el("span","kk", c.ko || ""));
  const rt=el("div","rt"); rt.append(el("span",null,c.en)); r.append(rt);
  const sd=el("div","sd"); if(c.good) sd.append(el("span","goodtag","잘했어요")); else sd.append(el("span","sess",sessLabel(c))); r.append(sd);
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
  row.append(b1,b2); p.append(row); app.append(p);
  const sec=(title,list,sub)=>{ if(!list.length) return; const q=el("div","panel"); const gh=el("div","ghead"); gh.append(el("b",null,title), el("span",null,sub||`${list.length}개`)); q.append(gh); list.forEach(c=>q.append(noteRow(c))); app.append(q); };
  sec("여러 번 반복한 실수", repeated, `${repeated.length}개 · 복습에 2배 자주 나와요`);
  sec("헷갈렸던 문장", weak.filter(c=>!rep(c)));
  for(const s of [...D.sessions].reverse()){
    const list=all.filter(c=>c.sessions[0]===s.no && !rep(c));
    sec(`${s.no}회차 · ${mmdd(s.date)}`, list);
  }
}
function renderRandomSetup(app){
  const last=D.sessions[D.sessions.length-1].no;
  const p=el("div","panel randbox");
  p.append(el("p","muted small",`1회차부터 ${last}회차까지 모든 카드에서 무작위로 뽑아요. 카드마다 몇 회차 문장인지 표시돼요.`));
  const grp=(label,opts,cur,set)=>{ const w=el("div","picker"); w.append(el("span","picker-lab",label)); const r=el("div","pchips");
    for(const [v,l] of opts){ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(cur===v)); b.onclick=()=>{ set(v); render(); }; r.append(b); }
    w.append(r); return w; };
  p.append(grp("몇 장", [[10,"10장"],[20,"20장"],[0,"전체"]], randCount, v=>randCount=v));
  p.append(grp("어떤 문장", [["all","전부"],["wrong","틀렸던 문장만"],["keep","외울 문장만"]], randKind, v=>randKind=v));
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
  const chipsFor=()=>{ const w=el("div","chips"); const ch=el("span","chip",typeOf(c)); ch.style.setProperty("--c",col(c)); w.append(ch); if(rep(c)) w.append(el("span","rep",`반복 ×${c.sessions.length}`)); return w; };
  // front
  const f=el("div","face front"); f.setAttribute("aria-hidden",String(flipped));
  const fh=el("div","fhead"); fh.append(chipsFor(), el("span","sess",sessLabel(c))); f.append(fh);
  const fb=el("div","body");
  if(c.vtopic){ fb.append(el("span","from",`${c.vlabel||"주제별 어휘"} · ${c.vtopic}`)); }
  else { const ss=(c.sessions||[]); const first=D.sessions.find(x=>x.no===ss[0]);
    fb.append(el("span","from", ss.length>1? `${ss.join("·")}회차 수업에서 반복` : `${ss[0]}회차 수업${first&&first.date? " · "+mmdd(first.date):""}`)); }
  if(c.kind==="fix"){ fb.append(el("span","lab","틀린 문장이에요. 바르게 고쳐 보세요"), el("p","wrong",c.wrong)); }
  else { fb.append(el("p","ko",c.ko));
    const hint = c.hint || (c.vtopic? (()=>{ const ws=c.en.split(/\s+/).filter(w=>w.replace(/[^A-Za-z]/g,"").length>2); const k=ws.sort((x,y)=>y.length-x.length)[0]||c.en.split(" ")[0]; return ws.length>1? k.replace(/[^A-Za-z'-]/g,"") : k.replace(/[A-Za-z]+/g,m=>m[0]+"_".repeat(m.length-1)); })() : "");
    if(hint){ const hb=el("p","hint"); hb.append(el("span","hint-tag","힌트"), document.createTextNode(hint)); fb.append(hb); }
    if(c.good) fb.append(el("span","lab","수업 때 잘했던 문장"));
  }
  fb.append(el("span","tap","터치해서 정답 보기")); f.append(fb);
  // back
  const b=el("div","face back"); b.setAttribute("aria-hidden",String(!flipped));
  const bh=el("div","fhead"); bh.append(chipsFor(), el("span","sess",sessLabel(c))); b.append(bh);
  const bb=el("div","body");
  bb.append(el("span","lab", c.kind==="fix"? "이렇게 고쳐요" : "영어로는"));
  const sent=el("div","sent");
  for(const tok of c.en.split(" ")){
    const m=tok.match(/^([A-Za-z'-]+)([.,!?…]*)$/); const word=m?m[1]:tok, punct=m?m[2]:""; const key=word.toLowerCase();
    if(G[key]){ const w=el("button","w"+(picked===key?" on":""),word); w.type="button"; w.tabIndex=flipped?0:-1;
      w.onclick=e=>{ e.stopPropagation(); picked=key; render(); }; sent.append(w); }
    else sent.append(el("span","p",word));
    if(punct) sent.append(el("span","p",punct));
  }
  bb.append(sent);
  const wb=el("div","wbox"); const inSent=picked && c.en.toLowerCase().split(/[^a-z'-]+/).includes(picked);
  if(inSent && G[picked]){ const [pos,mean,note]=G[picked]; const wt=el("div","wt"); wt.append(el("b",null,picked==="i"?"I":picked), el("span","pos",pos)); wb.append(wt, el("span","mean",mean)); if(note) wb.append(el("span","wn",note)); }
  else { wb.classList.add("empty"); wb.append(el("span","hint","단어를 누르면 뜻이 나와요")); }
  bb.append(wb);
  const gtext = c.gram || [c.note, (D.tips||{})[typeOf(c)]].filter(Boolean).join(" · ");
  if(gtext){ const g=el("div","gram"); g.append(el("b",null, c.vtopic? "예문" : "포인트")); const p=el("p"); if(c.gram) p.innerHTML=c.gram; else p.textContent=gtext; g.append(p); bb.append(g); }
  if(c.mine){ const mi=el("div","mine"+(c.good?" good":"")); if(c.good){ mi.append(document.createTextNode("수업 때 이렇게 말했어요 ·"), el("b",null,c.mine)); } else { mi.append(document.createTextNode(c.example? "이렇게 틀리기 쉬워요" : "수업 때 한 말"), el("s",null,c.mine)); } bb.append(mi); }
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
 ["all of a sudden","갑자기","All of a sudden, my mind went blank."]
];
let idiomShift=0;
function quoteBox(){
  const d=new Date(); const dayNo=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);
  const i=((dayNo+idiomShift)%IDIOMS.length+IDIOMS.length)%IDIOMS.length;
  const [idiom,ko,ex]=IDIOMS[i];
  const x=el("button","quote"); x.type="button"; x.setAttribute("aria-label",`오늘의 아이엘츠 idiom: ${idiom}. 누르면 다음 idiom`);
  const top=el("span","q-top"); top.append(el("span","q-lab",idiomShift? "아이엘츠 idiom" : "오늘의 아이엘츠 idiom"), el("span","q-next","터치하면 다음 ›"));
  x.append(top, el("span","q-idiom",idiom), el("span","q-mean",ko), el("span","q-ex",ex));
  x.onclick=()=>{ idiomShift++; const n=quoteBox(); x.replaceWith(n); n.focus({preventScroll:true}); };
  return x;
}

/* ---------- deck (browse by session) ---------- */
function renderDeck(app){
  if(!deckState || deckState.key!==view.deck){
    const list = (view.deck==="rand"||view.deck==="wrong"||view.deck==="vocab") ? (view.ids||[]).map(getCard).filter(Boolean)
               : view.deck==="all" ? [...D.cards].sort(()=>Math.random()-.5) : D.cards.filter(c=>(c.sessions||[]).includes(view.deck));
    deckState={key:view.deck, ids:list.map(c=>c.id), i:0};
  }
  const back=el("button","back", view.deck==="vocab"? (view.backTo==="words"? "‹ 아이엘츠 단어 공부" : "‹ 주제별 어휘") : view.deck==="rand"? "‹ 랜덤 퀴즈 설정" : view.deck==="wrong"? "‹ 틀린 문장 모음" : "‹ 회차별 정리"); back.type="button"; back.onclick=()=>{ if(view.deck==="vocab"){ if(view.backTo==="words"){ go("words"); return; } ideaPart="p1"; go("ideas"); return; } if(view.deck==="rand") cardMode="random"; else if(view.deck==="wrong") cardMode="wrong"; else { cardMode="session"; if(typeof view.deck==="number") selSession=view.deck; } go("cards"); }; app.append(back);
  if(!["rand","wrong","vocab"].includes(view.deck)) app.append(sessionPicker(view.deck, v=>{ if(v!==view.deck){ if(typeof v==="number") selSession=v; go("cards",{deck:v}); } }, false));
  const s=D.sessions.find(x=>x.no===view.deck);
  app.append(el("h1",null, view.deck==="vocab"? `${view.title||"주제별 어휘"} 카드` : view.deck==="rand"? "랜덤 퀴즈" : view.deck==="wrong"? "틀린 문장 연습" : view.deck==="all"? "전체 큐카드" : `${view.deck}회차 큐카드`));
  if(s) app.append(el("p","muted small",`${mmdd(s.date)} · ${s.title}`));
  const ids=deckState.ids; if(!ids.length){ const e=el("div","empty"); e.append(el("p",null,"카드가 없어요.")); app.append(e); return; }
  const c=getCard(ids[deckState.i]);
  const pg=el("div","prog"); pg.append(el("span",null,`${deckState.i+1} / ${ids.length}`), el("span",null,`알았어요 ${ids.filter(id=>marks[id]==="know").length}`)); app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=((deckState.i+1)/ids.length*100)+"%"; bar.append(bi); app.append(bar);
  const sc=flipCard(c); sc.onswipe=d=>move(d); app.append(sc);
  const acts=el("div","acts");
  const prev=el("button","nav","‹"); prev.type="button"; prev.setAttribute("aria-label","이전 카드"); prev.disabled=deckState.i===0; prev.onclick=()=>move(-1);
  const again=el("button","again","헷갈려요"); again.type="button"; again.setAttribute("aria-pressed",String(marks[c.id]==="again")); again.onclick=()=>markDeck(c,"again");
  const know=el("button","know","알았어요"); know.type="button"; know.setAttribute("aria-pressed",String(marks[c.id]==="know")); know.onclick=()=>markDeck(c,"know");
  const next=el("button","nav","›"); next.type="button"; next.setAttribute("aria-label","다음 카드"); next.disabled=deckState.i>=ids.length-1; next.onclick=()=>move(1);
  acts.append(prev,again,know,next); app.append(acts);
  const fin=el("button","btn primary",(["all","rand","wrong","vocab"].includes(view.deck))?"다 했어요! 선생님께 결과 보내기":`${view.deck}회차 끝! 선생님께 결과 보내기`); fin.type="button"; fin.onclick=()=>openReport("deck"); app.append(fin);
  app.append(el("p","hint2","카드를 누르면 뒤집혀요 · 옆으로 밀어서 넘기기"));
}
function move(d){ const n=deckState.i+d; if(n<0||n>=deckState.ids.length) return; deckState.i=n; flipped=false; picked=null; render(); }
function markDeck(c,kind){
  marks[c.id] = marks[c.id]===kind ? undefined : kind; if(!marks[c.id]) delete marks[c.id];
  touchDay(); save();
  const last=deckState.i>=deckState.ids.length-1;
  if(marks[c.id] && !last){ deckState.i++; flipped=false; picked=null; render(); }
  else { render(); if(marks[c.id] && last) openReport("deck"); }
}

/* ---------- spaced review ---------- */
function renderReview(app){
  if(!reviewState){
    let pool = view.extra ? D.cards.filter(c=>((srs[c.id]||{}).box||0)<MASTER) : dueCards();
    pool.sort((a,b)=>(rep(b)-rep(a)) || (((srs[a.id]||{}).box||0)-((srs[b.id]||{}).box||0)) || (marks[b.id]==="again")-(marks[a.id]==="again") || Math.random()-.5);
    reviewState={ids:pool.slice(0, view.extra?10:DAILY).map(c=>c.id), i:0, res:[]};
  }
  app.append(el("h1",null, view.extra? "약한 카드 연습" : "오늘의 복습"));
  const R=reviewState;
  const c=R.ids[R.i] && D.cards.find(x=>x.id===R.ids[R.i]);
  if(!c){
    const e=el("div","empty");
    if(R.res.length){ const ok=R.res.filter(r=>r.ok).length; e.append(el("div","big",`${ok}/${R.res.length}`), el("h2",null, ok===R.res.length?"전부 맞혔어요!":"오늘 복습 끝!"), el("p",null,"틀린 카드는 내일, 맞힌 카드는 며칠 뒤에 다시 나와요."));
      const send=el("button","btn primary","선생님께 결과 보내기"); send.type="button"; send.onclick=()=>openReport("review"); e.append(send); }
    else { e.append(el("div","big","✓"), el("h2",null,"오늘 복습할 카드가 없어요"), el("p",null,"내일 다시 열어 보세요.")); }
    const more=el("button","btn", dueCards().length? `남은 카드 이어서 하기 (${dueCards().length}장)` : "약한 카드 10장 더 하기"); more.type="button";
    more.onclick=()=>{ reviewState=null; view.extra=!dueCards().length; render(); };
    e.append(more); app.append(e); return;
  }
  const pg=el("div","prog"); pg.append(el("span",null,`${R.i+1} / ${R.ids.length}`), el("span",null,`맞힘 ${R.res.filter(r=>r.ok).length}`)); app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=(R.i/R.ids.length*100)+"%"; bar.append(bi); app.append(bar);
  const acts=el("div","acts review");
  const sc=flipCard(c, v=>{ acts.hidden=!v; tip.hidden=v; });
  app.append(sc);
  const no=el("button","again","다시 볼래요"); no.type="button"; no.onclick=()=>answer(c,false);
  const ok=el("button","know","맞혔어요"); ok.type="button"; ok.onclick=()=>answer(c,true);
  acts.append(no,ok); acts.hidden=!flipped; app.append(acts);
  const tip=el("p","hint2","카드를 눌러 정답을 확인하세요"); tip.hidden=flipped; app.append(tip);
}
function answer(c,ok){ grade(c,ok); reviewState.res.push({ok,c}); reviewState.i++; flipped=false; picked=null; render(); }

/* ---------- notes ---------- */
function renderNotes(app){
  app.append(el("h1",null,"오답노트"));
  app.append(sessionPicker(noteSession, v=>{ noteSession=v; render(); }));
  const inSess=c=> noteSession==="all" || (c.sessions||[]).includes(noteSession);
  const fixes=D.cards.filter(c=>(c.kind==="fix" || c.mine && !c.good) && inSess(c));
  const types=[...new Set(fixes.map(typeOf))];
  const f=el("div","filters");
  for(const t of ["전체","헷갈려요",...types]){ const b=el("button",null,t); b.type="button"; b.setAttribute("aria-pressed",String(noteFilter===t)); b.onclick=()=>{ noteFilter=t; render(); }; f.append(b); }
  app.append(f);
  const pick = noteFilter==="전체"? types : noteFilter==="헷갈려요"? null : [noteFilter];
  if(pick===null){
    const list=D.cards.filter(c=>inSess(c)).filter(c=>marks[c.id]==="again" || ((srs[c.id]||{}).reviews && (srs[c.id].correct||0)<(srs[c.id].reviews||0)));
    const p=el("div","panel"); { const gh=el("div","ghead"); gh.append(el("b",null,`헷갈리는 카드 ${list.length}장`)); p.append(gh); }
    if(!list.length) p.append(el("p","gtip","큐카드에서 '헷갈려요'를 누르거나 복습에서 틀린 카드가 여기 모여요."));
    list.forEach(c=>p.append(noteRow(c))); app.append(p);
  } else {
    for(const t of pick){
      const items=fixes.filter(c=>typeOf(c)===t); if(!items.length) continue;
      const p=el("div","panel"); p.style.setProperty("--c",TCOL[t]||"#4457e8");
      const h=el("div","ghead"); h.append(el("i","dot"), el("b",null,t), el("span",null,`${items.length}개`)); p.append(h);
      if(D.tips && D.tips[t]) p.append(el("p","gtip",D.tips[t]));
      items.forEach(c=>p.append(noteRow(c))); app.append(p);
    }
  }
  if(!fixes.length && pick!==null){ const e=el("div","empty"); e.append(el("p",null,"이 회차에는 고친 문장이 없어요. 표현 카드는 큐카드 탭에서 볼 수 있어요.")); app.append(e); }
  if(D.compare && noteFilter==="전체" && noteSession==="all"){
    const p=el("div","panel"); { const gh=el("div","ghead"); gh.append(el("b",null,"헷갈리는 단어 정리")); p.append(gh); }
    const cm=el("div","cmp"); for(const [t,h] of D.compare){ const d=el("div"); d.append(el("b",null,t)); const s=el("span"); s.innerHTML=h; d.append(s); cm.append(d); }
    p.append(cm); app.append(p);
  }
}
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
  app.append(el("h1",null,"아이디어"));
  const seg=el("div","modeseg"); seg.setAttribute("role","tablist");
  const n1=P1? P1.topics.length : 0;
  const n2=P2? P2.items.length : 0, n3=(D.part3||[]).reduce((a,s)=>a+s.qs.length,0);
  for(const [k,label,sub] of [["p1","Part 1",`주제별 어휘 ${n1}개`],["p2","Part 2",`예상 기출 ${n2}개`],["p3","Part 3",`질문 ${n3}개`]]){
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
  if(!P1){ const e=el("div","empty"); e.append(el("p",null,"어휘 자료를 불러오지 못했어요.")); app.append(e); return; }
  const total=P1.topics.reduce((a,t)=>a+t.words.length,0);
  app.append(el("p","muted small",`Part 1 단골 주제 ${P1.topics.length}개, 표현 ${total}개예요. 주제를 눌러서 펼쳐 보세요.`));
  const allB=el("button","btn vstart",`전체 섞어서 외우기 ${total}장 중 20장`); allB.type="button"; allB.onclick=()=>startVocab(P1.topics,"전체 주제",true); app.append(allB);
  const grid=el("div","vgrid");
  for(const tp of P1.topics){
    const b=el("button","vchip"+(openKey==="v-"+tp.topic?" on":"")); b.type="button";
    b.append(el("b",null,tp.ko), el("span",null,tp.topic));
    b.setAttribute("aria-pressed",String(openKey==="v-"+tp.topic));
    b.onclick=()=>{ openKey = openKey==="v-"+tp.topic? null : "v-"+tp.topic; render(); setTimeout(()=>{ const t=document.getElementById("vopen"); if(t) t.scrollIntoView({behavior:"smooth",block:"start"}); },0); };
    grid.append(b);
  }
  app.append(grid);
  const tp=P1.topics.find(t=>openKey==="v-"+t.topic);
  if(tp){
    const p=el("div","panel vpanel"); p.id="vopen";
    const h=el("div","ghead"); h.append(el("b",null,`${tp.ko} · ${tp.topic}`), el("span",null,`${tp.words.length}개`)); p.append(h);
    const go1=el("button","btn primary vstart",`카드로 외우기 ${tp.words.length}장`); go1.type="button";
    go1.onclick=()=>startVocab([tp], tp.ko, false); p.append(go1);
    for(const [en,ko,ex] of tp.words){
      const r=el("div","vrow"); const top=el("div","vtop"); top.append(el("b",null,en), el("span",null,ko)); r.append(top);
      if(ex) r.append(el("p","vex",ex)); p.append(r);
    }
    app.append(p);
  }
}
function startVocab(topics, title, shuffle, backTo, limit=20){
  let ids=[];
  for(const tp of topics){ tp.words.forEach(([en,ko,ex],i)=>{ const id=`v-${tp.topic}-${i}`.replace(/[^\w-]/g,"_");
    VCARDS[id]={id,kind:"ko",type:"어휘",vlabel: backTo==="words"? "아이엘츠 단어" : "주제별 어휘",vtopic:tp.ko,ko,en,gram:ex? ex.replace(/[<>&]/g,""):"",sessions:[]}; ids.push(id); }); }
  if(shuffle) ids=ids.sort(()=>Math.random()-.5).slice(0,limit);
  deckState=null; go("cards",{deck:"vocab", ids, title, backTo});
}
function renderP3(app){
  const t=el("div","focus"); t.append(el("b",null,"Part 3 답변 요령"));
  const ol=el("ol","steps4");
  for(const [k,ex] of [["명확한 대답","Yes, I think… / I'd say…"],["근거","That's because… / The main reason is…"],["예시","For example, … / In my case, …"],["대답 다시 언급","So that's why I think… / Overall, …"]]){ const li=el("li"); li.append(el("b",null,k), el("span",null,ex)); ol.append(li); }
  t.append(ol); app.append(t);
  for(const s of D.part3||[]){
    const ses=D.sessions.find(x=>x.no===s.session);
    const hd=el("div"); hd.append(el("span","from2",`${s.session}회차 수업${ses&&ses.date?" · "+mmdd(ses.date):""} · Part 2 이어서`), el("b",null,s.topic));
    app.append(fold("p3-"+s.session, hd, b=>{ const ul=el("ul","p3"); s.qs.forEach(q=>ul.append(el("li",null,q))); b.append(ul); }));
  }
}
function renderP2(app){
  if(!P2){ const e=el("div","empty"); e.append(el("p",null,"Part 2 자료를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.")); app.append(e); return; }
  const tools=el("div","p2tools");
  const inp=el("input"); inp.id="p2search"; inp.type="search"; inp.placeholder="주제 검색 (예: friend, 옥스포드, technology)"; inp.value=p2Query; inp.setAttribute("aria-label","Part 2 주제 검색");
  // filter in place (no full re-render), so typing Korean on a phone keeps working
  const applyFilter=()=>{ p2Query=inp.value; const q=p2Query.trim().toLowerCase(); let n=0;
    document.querySelectorAll(".idea[data-search]").forEach(c=>{ const ok=!q || c.dataset.search.includes(q); c.hidden=!ok; if(ok) n++; });
    const cnt=document.getElementById("p2count"); if(cnt) cnt.textContent=`${n}개 주제 · 출처: ${P2.source}`;
    const em=document.getElementById("p2empty"); if(em) em.hidden = n>0; };
  inp.addEventListener("input",e=>{ if(e.isComposing) return; applyFilter(); });
  inp.addEventListener("compositionend",applyFilter);
  const chip=el("button",null,"수업에서 다룬 주제만"); chip.type="button"; chip.className="lessonchip"; chip.setAttribute("aria-pressed",String(p2Lesson)); chip.onclick=()=>{ p2Lesson=!p2Lesson; render(); };
  tools.append(inp, chip); app.append(tools);
  const q=p2Query.trim().toLowerCase();
  const hay=it=>(it.topic+" "+it.answer+" "+it.points.join(" ")+" "+(it.alts||[]).join(" ")).toLowerCase();
  const list=P2.items.filter(it=>(!p2Lesson || it.lesson));
  const shown=list.filter(it=>!q || hay(it).includes(q)).length;
  const cnt=el("p","muted small",`${shown}개 주제 · 출처: ${P2.source}`); cnt.id="p2count"; app.append(cnt);
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
let wbSec="all";
function wordsTile(){
  const n = WB? WB.sections.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.words.length,0),0) : 0;
  const t=el("button","tile wtile"); t.type="button";
  const tt=el("div","t"); tt.append(el("b",null,"아이엘츠 단어 공부하기"), el("span",null, n? `리스닝 · 스피킹 · 리딩·라이팅 단어 ${n}개` : "단어를 불러오는 중…"));
  t.append(el("span","no","Aa"), tt, el("span","go","›")); t.onclick=()=>go("words");
  return t;
}
function wbTopics(secs){ return secs.flatMap(s=>s.groups.map(g=>({topic:`${s.key}-${g.name}`, ko:`${s.ko} · ${g.name}`, words:g.words}))); }
function renderWords(app){
  const back=el("button","back","‹ 홈"); back.type="button"; back.onclick=()=>go("home"); app.append(back);
  app.append(el("h1",null,"아이엘츠 단어 공부"));
  if(!WB){ const e=el("div","empty"); e.append(el("p",null,"단어를 불러오지 못했어요.")); app.append(e); return; }
  const chips=el("div","pchips"); chips.setAttribute("role","group");
  for(const [k,l] of [["all","전체"],...WB.sections.map(s=>[s.key,s.ko])]){ const b=el("button",null,l); b.type="button"; b.setAttribute("aria-pressed",String(wbSec===k)); b.onclick=()=>{ wbSec=k; openKey=null; render(); }; chips.append(b); }
  app.append(chips);
  const secs = wbSec==="all"? WB.sections : WB.sections.filter(s=>s.key===wbSec);
  const total=secs.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.words.length,0),0);
  const start=el("button","btn primary vstart",`랜덤 단어 카드 20장 (${total}개 중)`); start.type="button";
  start.onclick=()=>startVocab(wbTopics(secs), wbSec==="all"? "아이엘츠 단어" : secs[0].ko+" 단어", true, "words", 20); app.append(start);
  for(const s of secs){
    if(wbSec==="all") app.append(el("h2","wsec",`${s.ko} · ${s.en}`));
    for(const g of s.groups){
      const hd=el("div"); hd.append(el("span","from2",`${s.ko} · ${g.words.length}개`), el("b",null,g.name));
      app.append(fold(`wb-${s.key}-${g.name}`, hd, b=>{
        const go1=el("button","btn vstart",`이 묶음 카드로 외우기 ${g.words.length}장`); go1.type="button";
        go1.onclick=()=>startVocab([{topic:`${s.key}-${g.name}`, ko:`${s.ko} · ${g.name}`, words:g.words}], g.name, false, "words"); b.append(go1);
        for(const [en,ko,ex] of g.words){ const r=el("div","vrow"); const top=el("div","vtop"); top.append(el("b",null,en), el("span",null,ko)); r.append(top); if(ex) r.append(el("p","vex",ex)); b.append(r); }
      }));
    }
  }
  app.append(el("p","muted small","참고: "+WB.sources.join(" · ")+". 뜻과 예문은 수업용으로 새로 썼어요."));
}

/* ---------- listening spelling ---------- */
const ALT={centre:["center"],theatre:["theater"],licence:["license"],civilisation:["civilization"],behaviour:["behavior"]};
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
  if(LD) return renderDictation(app);
  app.append(el("h1",null,"철자 연습"));
  if(!LS){ const e=el("div","empty"); e.append(el("p",null,"자료를 불러오지 못했어요.")); app.append(e); return; }
  const all=LS.categories.flatMap(c=>c.words);
  const t=el("div","focus"); t.append(el("b",null,"철자 하나 틀려도 오답이에요"), document.createTextNode("리스닝에서 철자 때문에 자주 틀리는 단어예요. 듣고 직접 써 보세요. 영국식·미국식 철자는 둘 다 정답이에요.")); app.append(t);
  const row=el("div","btnrow");
  const s20=el("button","btn primary",`받아쓰기 20개`); s20.type="button"; s20.onclick=()=>startDictation([...all].sort(()=>Math.random()-.5).slice(0,20),"받아쓰기 20개");
  const sAll=el("button","btn",`전체 ${all.length}개`); sAll.type="button"; sAll.onclick=()=>startDictation([...all].sort(()=>Math.random()-.5),`전체 ${all.length}개`);
  row.append(s20,sAll); app.append(row);
  if(!canSpeak()) app.append(el("p","muted small","이 기기에서는 소리 재생이 안 돼요. 뜻을 보고 철자를 써 보세요."));
  const p=el("div","panel"); const h=el("div","ghead"); h.append(el("b",null,"단어 목록"), el("span",null,`${all.length}개 · 🔊 눌러서 듣기`)); p.append(h);
  for(const [w,ko,tip] of all){
    const r=el("div","lrow"); r.append(speakBtn(w));
    const t2=el("div"); const top=el("div","vtop"); top.append(el("b",null,w), el("span",null,ko)); t2.append(top); if(tip) t2.append(el("p","ltip",tip));
    r.append(t2); p.append(r);
  }
  app.append(p);
}
function startDictation(words, title){ LD={words, title, i:0, res:[], checked:false, typed:""}; go("listen"); setTimeout(()=>speak(words[0][0]),250); }
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
  const back=el("button","back","‹ 철자 연습"); back.type="button"; back.onclick=()=>{ LD=null; try{ speechSynthesis.cancel(); }catch(_){} render(); }; app.append(back);
  app.append(el("h1",null,L.title));
  if(L.i>=L.words.length){
    const ok=L.res.filter(r=>r.ok).length; const wrong=L.res.filter(r=>!r.ok);
    const e=el("div","empty"); e.append(el("div","big",`${ok}/${L.res.length}`), el("h2",null, ok===L.res.length? "전부 맞혔어요!" : "받아쓰기 끝!"));
    if(wrong.length){ const ul=el("div","wronglist"); wrong.forEach(r=>{ const row=el("div"); row.append(speakBtn(r.w[0]), el("b",null,r.w[0]), el("s",null,r.typed||"(빈칸)")); ul.append(row); }); e.append(ul);
      const again=el("button","btn primary","틀린 단어 다시 하기"); again.type="button"; again.onclick=()=>startDictation(wrong.map(r=>r.w), L.title+" (다시)"); e.append(again); }
    const send=el("button","btn","선생님께 결과 보내기"); send.type="button";
    send.onclick=()=>{ const d=new Date(); let t=`[${D.name} · 철자 연습 ${L.title} · ${d.getMonth()+1}/${d.getDate()}]\n맞힘 ${ok} / ${L.res.length}개`; if(wrong.length) t+=`\n틀린 철자:\n`+wrong.map(r=>`- ${r.w[0]} (쓴 답: ${r.typed||"빈칸"})`).join("\n"); reportSheet(`철자 연습 ${L.title}`, ok, L.res.length, t); };
    e.append(send); app.append(e); return;
  }
  const [w,ko,tip]=L.words[L.i];
  const pg=el("div","prog"); pg.append(el("span",null,`${L.i+1} / ${L.words.length}`), el("span",null,`맞힘 ${L.res.filter(r=>r.ok).length}`)); app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=(L.i/L.words.length*100)+"%"; bar.append(bi); app.append(bar);
  const card=el("div","dict");
  if(canSpeak()){
    const row=el("div","playrow");
    const p1=el("button","btn primary play"); p1.type="button"; p1.innerHTML=SPEAK_ICON; p1.append(document.createTextNode(" 듣기")); p1.onclick=()=>speak(w);
    const p2=el("button","btn play"); p2.type="button"; p2.textContent="천천히"; p2.onclick=()=>speak(w,true);
    row.append(p1,p2); card.append(row);
    card.append(el("p","muted small", L.checked? "" : "들리는 단어의 철자를 써 보세요"));
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
