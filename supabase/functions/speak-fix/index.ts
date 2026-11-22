// 밴드업 · 말하기 첨삭 (Supabase Edge Function "speak-fix")
// server/speak_fix.py 와 같은 기능을 Supabase 서버에서 24시간 돌리는 버전이에요. (PC를 켜 둘 필요 없음)
//
//   POST .../functions/v1/speak-fix/stt?s=<학생코드>&q=<질문>   body = 녹음 파일
//        → {"transcript": "...", "duration": 12.3}               답변 하나 받아쓰기 (Groq Whisper)
//   POST .../functions/v1/speak-fix/fix   body = {"s": 학생코드, "part": 1, "items": [{"q", "text"}]}
//        → {"items": [{"corrected", "fixes", "better", "good"} | null, ...]}   Part 하나를 한 번에 첨삭
//
// 배포 방법은 supabase/README.md 를 보세요.
// 비밀값(Edge Functions → Secrets): GROQ_API_KEY
// 선택 비밀값: AI_STT_DAILY, AI_STT_TOTAL, AI_FIX_DAILY, AI_FIX_TOTAL, AI_BLOCK, AI_STUDENTS_URL

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const num = (k: string, d: number) => Number(Deno.env.get(k) ?? d);
// Groq 무료(2026-11 콘솔): LLM 모델마다 하루 20만 토큰·분당 8천 토큰, Whisper 모델마다 하루 음성 28,800초.
const STT_DAILY = num("AI_STT_DAILY", 80);    // 학생 1명당 받아쓰기 (모의고사 1회 ≈ 18번)
const STT_TOTAL = num("AI_STT_TOTAL", 1000);  // 모든 학생 합계 받아쓰기
const FIX_DAILY = num("AI_FIX_DAILY", 9);     // 학생 1명당 Part 첨삭 (모의고사 1회 = 3번)
const FIX_TOTAL = num("AI_FIX_TOTAL", 120);   // 모든 학생 합계 Part 첨삭
const BLOCK = new Set((Deno.env.get("AI_BLOCK") ?? "common,demo,jelly-demo").split(",").map((s) => s.trim())); // 여러 사람이 같이 쓰는 링크
const STUDENTS_URL = Deno.env.get("AI_STUDENTS_URL") ?? "https://pekay0147.github.io/bandup/data/students/";

const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"]; // 앞 모델 한도가 차면 다음으로
const LLM_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];
const MAX_AUDIO = 20 * 1024 * 1024;
const MAX_ITEMS = 20;

// Whisper 는 prompt 의 말투를 따라 해요. 실수와 머뭇거림이 섞인 예시를 주면 학생 실수를 덜 고쳐서 적어요.
const VERBATIM_PROMPT = "Um, so, I think, uh, yesterday I go to the park with my friend and he don't like it, because it was, like, very much crowded.";

const TYPES = ["어휘", "단·복수", "주어-동사", "동사·시제", "문장 구조", "관사·전치사", "품사", "단어 선택", "표현"];

const SYSTEM = `You are an experienced IELTS Speaking examiner and English teacher for Korean learners.
You receive the answers a student gave in one part of an IELTS Speaking test. Each answer has the exam question and a VERBATIM speech-recognition transcript of what the student said.

For EACH answer, correct it so that it is grammatical and natural spoken English, keeping the student's meaning, ideas and wording wherever they are acceptable.

Fix:
- grammar: tense, subject-verb agreement, articles, prepositions, plurals, word order, missing or extra words (e.g. "as fast you can" -> "as fast as you can")
- words that are wrong or unnatural in context, and wrong collocations (e.g. "do a mistake" -> "make a mistake")
- idioms and fixed expressions used in the wrong form or the wrong situation (e.g. "on the other side" used to mean "on the other hand")
- parts of speech (e.g. "I'm very interesting in" -> "I'm very interested in")
- tense with since/for: a situation that started in the past and is still true needs the present perfect (e.g. "I like it since I was a child" -> "I have liked it since I was a child")

Do NOT:
- treat fillers (um, uh, like), repetitions or self-corrections as errors. Remove them silently in "corrected".
- treat punctuation, capitalisation or British/American spelling as errors. It is speech: add punctuation silently.
- replace correct but simple words with fancier ones in "corrected". Put upgrades only in "better".
- change contractions or natural spoken openers ("So,", "Well,", "Actually,").
- invent content the student did not say.
If a word looks like a speech-recognition mistake rather than a learner mistake (a nonsense word, a homophone that makes no sense), do not list it as a fix; just use the most likely intended word in "corrected".
Use British spelling.

Reply with ONLY a JSON object, one item per answer, using the same numbers:
{"items": [
  {"n": 1,
    "corrected": "the whole answer, minimally corrected, fillers removed",
    "fixes": [{"from": "exact words copied from the transcript", "to": "the replacement", "type": one of ${JSON.stringify(TYPES)}, "why": "짧은 한국어 설명 (해요체, 60자 이내)"}],
    "better": "a more natural Band 7+ version with the same ideas and similar length, or \\"\\" if corrected is already excellent",
    "good": "학생이 잘한 점 한 가지 (해요체, 한 문장), 없으면 \\"\\""}
]}
Rules for "fixes": in the order they appear; each "from" is the smallest span that still shows the mistake clearly (usually 2-6 words) and appears in that transcript exactly; [] if there are no mistakes.
Type guide: 동사·시제 = tense/verb form, 주어-동사 = agreement, 단·복수 = plural/countable, 관사·전치사 = articles/prepositions, 문장 구조 = word order/missing words/sentence structure, 품사 = part of speech, 단어 선택 = wrong or unnatural word/collocation, 표현 = idiom or fixed expression, 어휘 = vocabulary range.

Example input:
[1] Question: Do you like sports?
Transcript: Yes, uh, you can run as fast you can and, um, I do a lot of efforts for it.
Example output:
{"items":[{"n":1,"corrected":"Yes, you can run as fast as you can, and I put a lot of effort into it.","fixes":[{"from":"as fast you can","to":"as fast as you can","type":"문장 구조","why":"'as + 부사 + as' 구문이라 두 번째 as가 필요해요."},{"from":"do a lot of efforts for it","to":"put a lot of effort into it","type":"표현","why":"effort는 셀 수 없고, 'put effort into'로 써요."}],"better":"Yes, I love running. I try to go as fast as I can, and I put a lot of effort into it.","good":"질문에 Yes로 바로 답하고 이유를 덧붙였어요."}]}`;

const SYSTEM_V2 = SYSTEM + `
IMPORTANT - this student sees two separate boxes. These rules override the ones above:
1) "corrected" and "fixes" are ONLY for things that are clearly WRONG:
   - grammar mistakes: verb tense and form, subject-verb agreement, articles, prepositions, singular/plural and countable nouns, comparatives, word order, missing or extra words, parts of speech;
   - wrong words, collocations, idioms and fixed expressions: a native speaker would not say it, or it means something different from what the student meant (e.g. "on top of my head" -> "off the top of my head", "do a mistake" -> "make a mistake").
   Anything that is correct but plain, awkward, repetitive or could be said more naturally keeps the student's words in "corrected" and is NOT listed in "fixes". Those go only to "better" and "upgrades".
   Still remove fillers (um, uh, yeah, so, like, you know) and repetitions silently in "corrected".
   Each fix must make that part fully correct in one go (e.g. "I did a lot of efforts to decorate it" -> "I put a lot of effort into decorating it", not a half fix).
   "type" in "fixes" is one of ["동사·시제", "주어-동사", "단·복수", "관사·전치사", "문장 구조", "품사", "단어 선택", "표현"].
2) "better": copy "corrected" and change ONLY a few words (at most 3 places) that clearly make the answer more natural (a more natural word, collocation, idiom or phrase). Keep every other word, the sentence order and the sentence structure exactly as in "corrected": do not rewrite, shorten, merge or reorder sentences, do not add ideas.
   Words that mean almost the same and are both natural are CORRECT - do not swap them (e.g. several -> many, big -> large, very -> really, like -> love, good -> nice, I think -> I believe, actually -> honestly, have lived -> have been living).
   "better" must stay fully grammatical and keep every grammar correction from "corrected". If nothing is worth changing, "better" is "".
3) Add "upgrades" to every item, one entry per change in "better": [{"from": "only the student's words that were replaced", "to": "only the new words, copied EXACTLY from better", "ko": "'to'의 한국어 뜻 (짧게, 20자 이내)", "why": "왜 더 자연스러운지 (해요체, 40자 이내)"}]
   "to" is just the changed words, usually 1-3 words - never include unchanged words around them (e.g. "I can go there easily" -> "I can get there easily": "to" is "get", "from" is "go"). Only when the change sits inside an idiom or collocation, "to" is the whole short idiom so it makes sense in a wordbook (e.g. "on the fence"). [] if "better" is "".
Example: the student said "Actually, I can think of my father on top of my head. He is much more taller than me, so I'm jealous of him."
"corrected":"Actually, I can think of my father off the top of my head. He is much taller than me, so I'm jealous of him.",
"fixes":[{"from":"on top of my head","to":"off the top of my head","type":"표현","why":"'off the top of my head'가 '바로 떠오르는 대로'라는 관용구예요."},{"from":"much more taller","to":"much taller","type":"문장 구조","why":"taller가 이미 비교급이라 more를 빼요."}],
"better":"Actually, I can think of my father off the top of my head. He is much taller than me, so I'm a bit jealous of him.",
"upgrades":[{"from":"I'm jealous","to":"a bit","ko":"조금, 약간","why":"감정을 부드럽게 말할 때 자주 붙여요."}]`; // 학생 파일 "p2rec": true (은수·기현): 어색한 표현은 빨간 줄 대신 더 자연스럽게 말하면(형광)으로

class Busy extends Error {}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, obj: unknown) =>
  new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

// ---------- 하루 사용 횟수 (ai_usage 표, supabase/ai_usage.sql) ----------
// 표가 없거나 오류가 나면 제한 없이 통과시켜요 (기능이 멈추지 않게). Groq 자체 한도는 그대로 적용돼요.
async function bump(key: string, limit: number): Promise<boolean> {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/rpc/ai_bump`, {
      method: "POST",
      headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_k: key, p_lim: limit }),
    });
    if (!r.ok) { console.error("ai_bump", r.status, await r.text()); return true; }
    return (await r.json()) === true;
  } catch (e) { console.error("ai_bump", e); return true; }
}

// 학생 코드가 GitHub Pages 의 학생 명단(data/students/)에 있는지 확인 (10분 동안 기억)
const known = new Map<string, { ok: boolean; at: number }>();
async function isStudent(slug: string): Promise<boolean> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || BLOCK.has(slug)) return false;
  const c = known.get(slug);
  if (c && Date.now() - c.at < 600_000) return c.ok;
  let ok = false;
  try {
    const r = await fetch(`${STUDENTS_URL}${slug}.json`, { cache: "no-store" });
    if (r.ok) { const d = await r.json(); ok = d?.slug === slug && !d?.demo; }
  } catch (_) { ok = c?.ok ?? false; }
  known.set(slug, { ok, at: Date.now() });
  return ok;
}

// ---------- Groq ----------
function sttPrompt(q: string) {
  // Whisper prompt 는 "바로 앞에 나온 말"처럼 쓰여요. 질문을 넣어 주면 주제 단어를 더 잘 알아들어요.
  q = String(q || "").split(/\s+/).join(" ").trim().slice(0, 300);
  return (q ? q + " " : "") + VERBATIM_PROMPT;
}

async function transcribe(audio: Blob, ctype: string, q: string) {
  const ext = /mp4|m4a|aac/.test(ctype) ? "m4a" : ctype.includes("ogg") ? "ogg" : ctype.includes("wav") ? "wav" : "webm";
  let last = "";
  for (const model of STT_MODELS) {
    const fd = new FormData();
    fd.append("file", new File([audio], `answer.${ext}`, { type: ctype || "audio/webm" }));
    fd.append("model", model);
    fd.append("language", "en");
    fd.append("temperature", "0");
    fd.append("response_format", "verbose_json");
    fd.append("prompt", sttPrompt(q));
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: fd });
    if (r.status === 429 || r.status >= 500) { last = `${model} ${r.status}`; continue; }
    if (!r.ok) throw new Error(`stt ${model} ${r.status} ${(await r.text()).slice(0, 300)}`);
    const j = await r.json();
    // 소리가 거의 없는 구간은 Whisper 가 prompt 를 따라 지어내는 일이 있어서 버려요
    const text = Array.isArray(j.segments)
      ? j.segments.filter((s: { no_speech_prob?: number }) => (s.no_speech_prob ?? 0) < 0.7).map((s: { text: string }) => s.text).join(" ")
      : String(j.text ?? "");
    return { transcript: text.split(/\s+/).join(" ").trim(), duration: Number(j.duration ?? 0), stt: model };
  }
  throw new Busy(last);
}

type Fix = { from: string; to: string; type: string; why: string };
type Up = { from: string; to: string; ko: string; why: string };
function cleanItem(o: Record<string, unknown> | undefined, fallback: string) {
  if (!o || typeof o !== "object") return null;
  const fixes: Fix[] = [];
  for (const f of (Array.isArray(o.fixes) ? o.fixes : []) as Record<string, unknown>[]) {
    if (f && typeof f.from === "string" && typeof f.to === "string" && f.from !== f.to) {
      fixes.push({ from: f.from, to: f.to, type: TYPES.includes(String(f.type)) ? String(f.type) : "문장 구조", why: String(f.why ?? "") });
    }
  }
  const better = String(o.better ?? ""), lb = better.toLowerCase(), upgrades: Up[] = [];
  for (const u of (Array.isArray(o.upgrades) ? o.upgrades : []) as Record<string, unknown>[]) {
    if (u && typeof u.to === "string" && u.to.trim() && u.to.length <= 80 && u.to.trim().split(/\s+/).length <= 8 && lb.includes(u.to.toLowerCase())) {
      upgrades.push({ from: String(u.from ?? ""), to: u.to, ko: String(u.ko ?? ""), why: String(u.why ?? "") });
    }
  }
  return { corrected: String(o.corrected || fallback), fixes, better, upgrades, good: String(o.good ?? "") };
}

async function correct(part: number, items: { q: string; text: string }[], v2 = false) {
  const user = `IELTS Speaking Part ${part}\n\n` + items.map((it, i) => `[${i + 1}] Question: ${it.q || "(free speaking)"}\nTranscript: ${it.text}`).join("\n\n");
  let last = "";
  for (const model of LLM_MODELS) {
    const body: Record<string, unknown> = {
      model, temperature: 0.2, max_completion_tokens: 5000, response_format: { type: "json_object" },
      messages: [{ role: "system", content: v2 ? SYSTEM_V2 : SYSTEM }, { role: "user", content: user }],
    };
    if (model === "openai/gpt-oss-120b") body.reasoning_effort = "medium"; // low 는 토큰이 40% 적지만 첨삭이 덜 꼼꼼해요
    else if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "low";
    else if (model.startsWith("qwen/")) body.reasoning_format = "hidden";
    const call = () => fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    let r = await call();
    if (r.status === 429) {
      // 분당 한도(8천 토큰)에 걸리면 Groq 가 "몇 초 뒤 다시"라고 알려 줘요. 짧으면 기다렸다가 같은 좋은 모델로 다시 해요.
      const t = await r.text(), m = t.match(/try again in ([\d.]+)s/);
      if (m && Number(m[1]) <= 20) { await new Promise((ok) => setTimeout(ok, Number(m[1]) * 1000 + 500)); r = await call(); }
      else { last = `${model} 429 ${t.slice(0, 200)}`; console.error("llm", last); continue; }
    }
    if (!r.ok) { last = `${model} ${r.status} ${(await r.text()).slice(0, 200)}`; console.error("llm", last); continue; }
    try {
      const j = await r.json();
      const content = String(j.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
      const o = JSON.parse(content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1));
      const got = new Map<number, Record<string, unknown>>();
      for (const x of (Array.isArray(o.items) ? o.items : [])) if (x && typeof x === "object") got.set(Number(x.n), x);
      const out = items.map((it, i) => cleanItem(got.get(i + 1), it.text));
      if (!out.some(Boolean)) throw new Error("empty");
      return { items: out, llm: model };
    } catch (e) { last = `${model} bad json ${e}`; console.error("llm", last); }
  }
  throw new Busy(last);
}

// ---------- HTTP ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply(405, { error: "POST only" });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  const isStt = path.endsWith("/stt"), isFix = path.endsWith("/fix");
  if (!isStt && !isFix) return reply(404, { error: "not_found" });
  if (!GROQ_KEY) return reply(500, { error: "server_not_ready" });

  try {
    if (isStt) {
      const slug = url.searchParams.get("s") ?? "";
      const audio = await req.blob();
      if (!audio.size) return reply(400, { error: "no_audio" });
      if (audio.size > MAX_AUDIO) return reply(413, { error: "too_long" });
      if (!(await isStudent(slug))) return reply(403, { error: "not_student" });
      if (!(await bump(`stt:${slug}`, STT_DAILY))) return reply(429, { error: "daily_limit" });
      if (!(await bump("stt:total", STT_TOTAL))) return reply(503, { error: "busy" });
      const ctype = (req.headers.get("content-type") ?? "audio/webm").split(";")[0].trim();
      const r: Record<string, unknown> = await transcribe(audio, ctype, url.searchParams.get("q") ?? "");
      if (String(r.transcript).split(" ").filter(Boolean).length < 2) r.error = "no_speech";
      return reply(200, r);
    }

    const b = await req.json().catch(() => ({}));
    const slug = String(b.s ?? "");
    const part = Number(b.part) || 1;
    const items = (Array.isArray(b.items) ? b.items : []).slice(0, MAX_ITEMS)
      .filter((x: unknown) => x && typeof x === "object")
      .map((x: Record<string, unknown>) => ({ q: String(x.q ?? "").slice(0, 400), text: String(x.text ?? "").trim().slice(0, 4000) }));
    if (!items.length || !items.every((x: { text: string }) => x.text)) return reply(400, { error: "no_text" });
    if (!(await isStudent(slug))) return reply(403, { error: "not_student" });
    if (!(await bump(`fix:${slug}`, FIX_DAILY))) return reply(429, { error: "daily_limit" });
    if (!(await bump("fix:total", FIX_TOTAL))) return reply(503, { error: "busy" });
    return reply(200, await correct(part, items, b.v === 2));
  } catch (e) {
    console.error("failed", e);
    return e instanceof Busy ? reply(503, { error: "busy" }) : reply(500, { error: "failed" });
  }
});
