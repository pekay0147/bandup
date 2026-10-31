/* 밴드업 아이엘츠 — per-student IELTS speaking cue cards, spaced review and error notes.
   Data: data/students/<slug>.json + data/glossary.json. Progress lives in this phone's localStorage. */
(function(){
"use strict";
const TCOL = {"단·복수":"#8b5cf6","주어-동사":"#3d5afe","동사·시제":"#0f9e8f","문장 구조":"#e07a2e","관사·전치사":"#d6437f",
  "품사":"#b88a00","단어 선택":"#2a9a55","발음·철자":"#7c7f99","표현":"#d99a00","잘한 표현":"#1d9a68"};
const INTERVALS=[0,1,3,7,14,30], MASTER=5, DAILY=15;
const $=s=>document.querySelector(s);
const el=(t,c,x)=>{const e=document.createElement(t); if(c) e.className=c; if(x!=null) e.textContent=x; return e;};
const today=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");};
const addD=(s,n)=>{const [y,m,d]=s.split("-").map(Number);const t=new Date(y,m-1,d+n);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0");};
const mmdd=s=>s? s.slice(5).replace("-","/") : "";
const store={ get(k,f){ try{ const v=localStorage.getItem(k); return v==null? f : JSON.parse(v);}catch(_){ return f; } },
              set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(_){} } };

let D=null, G={}, slug=null;
let srs={}, marks={}, days=[];
let view={tab:"home"};   // home | cards(deck?) | review | notes
let deckState=null, reviewState=null, picked=null, flipped=false, noteFilter="전체";

/* ---------- boot ---------- */
async function boot(){
  slug=(location.hash||"").replace(/^#/,"") || new URLSearchParams(location.search).get("s") || store.get("bandup-slug",null) || window.BANDUP_DEFAULT || null;
  if(slug && !/^[a-z0-9-]{3,40}$/.test(slug)) slug=null;
  const app=$("#app");
  if(!slug){ app.textContent=""; const e=el("div","empty"); e.append(el("h2",null,"선생님께 받은 링크로 열어 주세요"), el("p",null,"링크 끝에 학생 이름표(#…)가 붙어 있어야 내 카드가 보여요.")); app.append(e); return; }
  try{
    const [s,g]=await Promise.all([fetch(`data/students/${slug}.json`,{cache:"no-cache"}).then(r=>{ if(!r.ok) throw new Error(r.status); return r.json(); }),
                                   fetch("data/glossary.json",{cache:"no-cache"}).then(r=>r.ok? r.json():{}).catch(()=>({}))]);
    D=s; G=g||{};
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
const sessLabel=c=>(c.sessions||[]).join("·")+"회차";
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
  notes:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h5"/></svg>'
};
function buildTabs(){
  const nav=$("#tabs nav"); nav.textContent="";
  for(const [k,label] of [["home","홈"],["cards","큐카드"],["review","복습"],["notes","오답노트"]]){
    const b=el("button"); b.type="button"; b.dataset.tab=k; b.innerHTML=ICONS[k]; b.append(el("span",null,label));
    if(k==="review"){ const bd=el("span","badge"); bd.id="dueBadge"; b.append(bd); }
    b.onclick=()=>{ go(k); };
    nav.append(b);
  }
}
function go(tab, extra){ view={tab, ...(extra||{})}; flipped=false; picked=null; if(tab!=="cards") deckState=null; if(tab!=="review") reviewState=null; render(); window.scrollTo(0,0); }
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
  updateTabs();
}

function renderHome(app){
  const due=dueCards().length;
  const h=el("div","hello"); const h1=el("h1"); h1.append(document.createTextNode(`${D.name}님, `), el("b",null,due? `오늘 ${Math.min(due,DAILY)}장`: "오늘 복습 끝!"));
  h.append(el("span","muted small",`${D.course} · ${D.sessions.length}회차 수업`), h1); app.append(h);
  const st=el("div","stats");
  for(const [cls,n,l] of [["due",due,"복습할 카드"],["streak",streak(),"연속 공부일"],["mast",mastered(),`마스터 / ${D.cards.length}`]]){
    const s=el("div","stat "+cls); s.append(el("b",null,String(n)), el("span",null,l)); st.append(s);
  }
  app.append(st);
  const hero=el("div","hero");
  hero.append(el("h2",null, due? "오늘의 복습을 시작해요" : "더 연습하고 싶다면"), el("p",null, due? "반복해서 틀린 문장부터 먼저 나와요. 소리 내어 말한 뒤 정답을 확인하세요." : "헷갈렸던 카드 10장을 다시 볼 수 있어요."));
  const b=el("button",null, due? `복습 시작 (${Math.min(due,DAILY)}장)` : "약한 카드 연습"); b.type="button"; b.onclick=()=>go("review",{extra:!due}); hero.append(b);
  app.append(hero);
  const last=D.sessions[D.sessions.length-1];
  if(last){
    { const sh=el("div","sec-h"); sh.append(el("h2",null,"최근 수업")); app.append(sh); }
    app.append(deckTile(last));
    const f=D.focus&&D.focus[String(last.no)];
    if(f){ const x=el("div","focus"); x.append(el("b",null,`${last.no}회차 포인트`), document.createTextNode(f)); app.append(x); }
  }
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if(!standalone){
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
  app.append(el("p","muted small",`수업마다 나온 실수와 표현이에요. 회차를 골라 넘겨 보세요.`));
  const l=el("div","list");
  const all=el("button","tile"); all.type="button";
  const at=el("div","t"); at.append(el("b",null,"전체 섞어서 보기"), el("span",null,`카드 ${D.cards.length}장`));
  all.append(el("span","no","∞"), at, el("span","go","›")); all.onclick=()=>go("cards",{deck:"all"}); l.append(all);
  for(const s of [...D.sessions].reverse()) l.append(deckTile(s));
  app.append(l);
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
  if(c.kind==="fix"){ fb.append(el("span","lab","틀린 문장이에요. 고쳐서 소리 내어 말해 보세요"), el("p","wrong",c.wrong)); }
  else { fb.append(el("span","lab", c.good? "이 말을 영어로 · 수업 때 잘했던 문장" : "이 말을 영어로 소리 내어 말해 보세요"), el("p","ko",c.ko)); }
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
  else wb.append(el("span","hint","밑줄 친 단어를 누르면 뜻이 나와요"));
  bb.append(wb);
  const gtext = c.gram || [c.note, (D.tips||{})[typeOf(c)]].filter(Boolean).join(" · ");
  if(gtext){ const g=el("div","gram"); g.append(el("b",null,"문법 포인트")); const p=el("p"); if(c.gram) p.innerHTML=c.gram; else p.textContent=gtext; g.append(p); bb.append(g); }
  if(c.mine){ const mi=el("div","mine"+(c.good?" good":"")); if(c.good){ mi.append(document.createTextNode("수업 때 이렇게 말했어요 ·"), el("b",null,c.mine)); } else { mi.append(document.createTextNode("수업 때 한 말"), el("s",null,c.mine)); } bb.append(mi); }
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

/* ---------- deck (browse by session) ---------- */
function renderDeck(app){
  if(!deckState || deckState.key!==view.deck){
    const list = view.deck==="all" ? [...D.cards].sort(()=>Math.random()-.5) : D.cards.filter(c=>(c.sessions||[]).includes(view.deck));
    deckState={key:view.deck, ids:list.map(c=>c.id), i:0};
  }
  const back=el("button","back","‹ 큐카드 목록"); back.type="button"; back.onclick=()=>go("cards"); app.append(back);
  const s=D.sessions.find(x=>x.no===view.deck);
  app.append(el("h1",null, view.deck==="all"? "전체 큐카드" : `${view.deck}회차 큐카드`));
  if(s) app.append(el("p","muted small",`${mmdd(s.date)} · ${s.title}`));
  const ids=deckState.ids; if(!ids.length){ const e=el("div","empty"); e.append(el("p",null,"카드가 없어요.")); app.append(e); return; }
  const c=D.cards.find(x=>x.id===ids[deckState.i]);
  const pg=el("div","prog"); pg.append(el("span",null,`${deckState.i+1} / ${ids.length}`), el("span",null,`알았어요 ${ids.filter(id=>marks[id]==="know").length}`)); app.append(pg);
  const bar=el("div","bar"); const bi=el("i"); bi.style.width=((deckState.i+1)/ids.length*100)+"%"; bar.append(bi); app.append(bar);
  const sc=flipCard(c); sc.onswipe=d=>move(d); app.append(sc);
  const acts=el("div","acts");
  const prev=el("button","nav","‹"); prev.type="button"; prev.setAttribute("aria-label","이전 카드"); prev.disabled=deckState.i===0; prev.onclick=()=>move(-1);
  const again=el("button","again","헷갈려요"); again.type="button"; again.setAttribute("aria-pressed",String(marks[c.id]==="again")); again.onclick=()=>markDeck(c,"again");
  const know=el("button","know","알았어요"); know.type="button"; know.setAttribute("aria-pressed",String(marks[c.id]==="know")); know.onclick=()=>markDeck(c,"know");
  const next=el("button","nav","›"); next.type="button"; next.setAttribute("aria-label","다음 카드"); next.disabled=deckState.i>=ids.length-1; next.onclick=()=>move(1);
  acts.append(prev,again,know,next); app.append(acts);
  const fin=el("button","btn primary",view.deck==="all"?"다 했어요! 선생님께 결과 보내기":`${view.deck}회차 끝! 선생님께 결과 보내기`); fin.type="button"; fin.onclick=()=>openReport("deck"); app.append(fin);
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
  const tip=el("p","hint2","소리 내어 말한 다음 카드를 눌러 정답을 확인하세요"); tip.hidden=flipped; app.append(tip);
}
function answer(c,ok){ grade(c,ok); reviewState.res.push({ok,c}); reviewState.i++; flipped=false; picked=null; render(); }

/* ---------- notes ---------- */
function renderNotes(app){
  app.append(el("h1",null,"오답노트"));
  const fixes=D.cards.filter(c=>c.kind==="fix" || c.mine && !c.good);
  const types=[...new Set(fixes.map(typeOf))];
  const f=el("div","filters");
  for(const t of ["전체","헷갈려요",...types]){ const b=el("button",null,t); b.type="button"; b.setAttribute("aria-pressed",String(noteFilter===t)); b.onclick=()=>{ noteFilter=t; render(); }; f.append(b); }
  app.append(f);
  const pick = noteFilter==="전체"? types : noteFilter==="헷갈려요"? null : [noteFilter];
  if(pick===null){
    const list=D.cards.filter(c=>marks[c.id]==="again" || ((srs[c.id]||{}).reviews && (srs[c.id].correct||0)<(srs[c.id].reviews||0)));
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
  if(D.compare && noteFilter==="전체"){
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

/* ---------- report to teacher ---------- */
function openReport(kind){
  let title, lines=[], okN=0, total=0, again=[];
  const d=new Date(), md=(d.getMonth()+1)+"/"+d.getDate();
  if(kind==="review" && reviewState){
    total=reviewState.res.length; okN=reviewState.res.filter(r=>r.ok).length; again=reviewState.res.filter(r=>!r.ok).map(r=>r.c);
    title=`오늘의 복습`; lines.push(`맞힘 ${okN} / ${total}장`);
  } else {
    const ids=deckState? deckState.ids : []; total=ids.length;
    okN=ids.filter(id=>marks[id]==="know").length; again=ids.filter(id=>marks[id]==="again").map(id=>D.cards.find(c=>c.id===id));
    title = deckState && deckState.key!=="all" ? `${deckState.key}회차 큐카드` : "전체 큐카드";
    lines.push(`알았어요 ${okN} / ${total}장`);
    const rest=total-okN-again.length; if(rest>0) lines.push(`아직 표시 안 한 카드 ${rest}장`);
  }
  let text=`[${D.name} · ${title} · ${md}]\n`+lines.join("\n");
  if(again.length) text+=`\n다시 볼 문장 ${again.length}개:\n`+again.map(c=>"- "+c.en).join("\n");
  text+=`\n연속 공부 ${streak()}일`;

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
window.addEventListener("hashchange",()=>{ const h=location.hash.replace(/^#/,""); if(h && h!==slug){ location.reload(); } });
if("serviceWorker" in navigator && location.protocol==="https:" && !/claude|claudeusercontent/.test(location.hostname)){
  navigator.serviceWorker.register("sw.js").catch(()=>{});
}
boot();
})();
