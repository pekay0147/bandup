// 밴드업 · 말하기 첨삭 (Supabase Edge Function)
// 1) 녹음 파일 → Groq Whisper 로 "들린 그대로" 받아쓰기
// 2) 받아쓴 문장 → Groq LLM 이 문법·단어·숙어를 고쳐서 JSON 으로 돌려줌
// 요청: multipart/form-data { audio: File, q?: 질문 }  또는  JSON { text: 학생이 고친 문장, q?: 질문 }
// 비밀값(supabase secrets set): GROQ_API_KEY  (선택: AI_USER_DAILY, AI_ANON_DAILY, AI_ORIGINS)

const GROQ_KEY = Deno.env.get("GROQ_API_KEY") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SB_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const USER_DAILY = Number(Deno.env.get("AI_USER_DAILY") ?? 80);   // 로그인한 학생 1명당 하루
const ANON_DAILY = Number(Deno.env.get("AI_ANON_DAILY") ?? 20);   // 로그인 안 한 기기(IP)당 하루
const ORIGINS = (Deno.env.get("AI_ORIGINS") ?? "https://pekay0147.github.io").split(",").map((s) => s.trim());

const STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"]; // 앞 모델 한도가 차면 다음으로
const LLM_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile"];
const MAX_AUDIO = 20 * 1024 * 1024;

// Whisper 는 prompt 의 말투를 따라 해요. 실수와 머뭇거림이 섞인 예시를 주면 학생 실수를 덜 고쳐서 적어요.
const VERBATIM_PROMPT = "Um, so, I think, uh, yesterday I go to the park with my friend and he don't like it, because it was, like, very much crowded.";

const TYPES = ["어휘", "단·복수", "주어-동사", "동사·시제", "문장 구조", "관사·전치사", "품사", "단어 선택", "표현"];

const SYSTEM = `You are an experienced IELTS Speaking examiner and English teacher for Korean learners.
You receive the exam question and a VERBATIM speech-recognition transcript of the student's spoken answer.

Your job: correct the answer so that it is grammatical and natural spoken English, keeping the student's meaning, ideas and wording wherever they are acceptable.

Fix:
- grammar: tense, subject-verb agreement, articles, prepositions, plurals, word order, missing or extra words (e.g. "as fast you can" -> "as fast as you can")
- words that are wrong or unnatural in context, and wrong collocations (e.g. "do a mistake" -> "make a mistake")
- idioms and fixed expressions used in the wrong form or the wrong situation (e.g. "it's a piece of cake for me to wake up early" is fine, but "on the other side" used to mean "on the other hand" is not)
- parts of speech (e.g. "I'm very interesting in" -> "I'm very interested in")

Do NOT:
- treat fillers (um, uh, like), repetitions or self-corrections as errors. Remove them silently in "corrected".
- treat punctuation or capitalisation as errors. It is speech: add punctuation silently.
- replace correct but simple words with fancier ones in "corrected". Put upgrades only in "better".
- change contractions or natural spoken openers ("So,", "Well,", "Actually,").
- invent content the student did not say.
If a word looks like a speech-recognition mistake rather than a learner mistake (a nonsense word, a homophone that makes no sense), do not list it as a fix; just use the most likely intended word in "corrected".
Use British spelling.

Reply with ONLY a JSON object:
{
  "corrected": "the whole answer, minimally corrected, fillers removed",
  "fixes": [
    {"from": "exact words copied from the transcript", "to": "the replacement", "type": one of ${JSON.stringify(TYPES)}, "why": "짧은 한국어 설명 (해요체, 60자 이내)"}
  ],
  "better": "a more natural Band 7+ version of the same answer with the same ideas and similar length, or \\"\\" if corrected is already excellent",
  "good": "학생이 잘한 점 한 가지 (해요체, 한 문장), 없으면 \\"\\""
}
Rules for "fixes": list them in the order they appear; make each "from" the smallest span that still shows the mistake clearly (2-6 words usually); "from" must appear in the transcript exactly; if there are no mistakes, "fixes" is [].
Type guide: 동사·시제 = tense/verb form, 주어-동사 = agreement, 단·복수 = plural/countable, 관사·전치사 = articles/prepositions, 문장 구조 = word order/missing words/sentence structure, 품사 = part of speech, 단어 선택 = wrong or unnatural word/collocation, 표현 = idiom or fixed expression, 어휘 = vocabulary range.

Example
Question: Do you like sports?
Transcript: Yes, uh, you can run as fast you can and, um, I do a lot of efforts for it.
{"corrected":"Yes, you can run as fast as you can, and I put a lot of effort into it.","fixes":[{"from":"as fast you can","to":"as fast as you can","type":"문장 구조","why":"'as + 형용사/부사 + as' 구문이라 두 번째 as가 필요해요."},{"from":"do a lot of efforts for it","to":"put a lot of effort into it","type":"표현","why":"effort는 셀 수 없고, 'put effort into'로 써요."}],"better":"Yes, I love running. I try to go as fast as I can, and I put a lot of effort into it.","good":"질문에 Yes로 바로 답하고 이유를 덧붙였어요."}`;

function cors(origin: string | null) {
  const ok = origin && (ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return {
    "Access-Control-Allow-Origin": ok ? origin! : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, h: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...h, "Content-Type": "application/json; charset=utf-8" } });
}

async function whoIs(req: Request): Promise<string> {
  const auth = req.headers.get("authorization") ?? "";
  const tok = auth.replace(/^Bearer\s+/i, "");
  if (tok && tok !== SB_ANON) {
    const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${tok}` } });
    if (r.ok) { const u = await r.json(); if (u?.id) return `u:${u.id}`; }
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  return `ip:${ip}`;
}

async function allow(key: string): Promise<boolean> {
  const lim = key.startsWith("u:") ? USER_DAILY : ANON_DAILY;
  const r = await fetch(`${SB_URL}/rest/v1/rpc/ai_bump`, {
    method: "POST",
    headers: { apikey: SB_SERVICE, Authorization: `Bearer ${SB_SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_k: key, p_lim: lim }),
  });
  if (!r.ok) { console.error("ai_bump", r.status, await r.text()); return true; } // 집계가 고장 나도 기능은 멈추지 않게
  return (await r.json()) === true;
}

async function transcribe(audio: File) {
  let last = "";
  for (const model of STT_MODELS) {
    const fd = new FormData();
    fd.append("file", audio, audio.name || "answer.webm");
    fd.append("model", model);
    fd.append("language", "en");
    fd.append("temperature", "0");
    fd.append("response_format", "verbose_json");
    fd.append("prompt", VERBATIM_PROMPT);
    const r = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${GROQ_KEY}` }, body: fd });
    if (r.status === 429 || r.status >= 500) { last = `${model} ${r.status}`; continue; }
    if (!r.ok) throw new Error(`stt ${r.status} ${await r.text()}`);
    const j = await r.json();
    // 소리가 거의 없는 구간은 Whisper 가 prompt 를 따라 지어내는 일이 있어서 버려요
    const segs = (j.segments ?? []).filter((s: { no_speech_prob?: number }) => (s.no_speech_prob ?? 0) < 0.7);
    const text = (segs.length ? segs.map((s: { text: string }) => s.text).join(" ") : (j.segments ? "" : j.text ?? "")).replace(/\s+/g, " ").trim();
    return { text, duration: Number(j.duration ?? 0), stt: model };
  }
  throw new Error(`busy ${last}`);
}

async function correct(text: string, q: string) {
  let last = "";
  for (const model of LLM_MODELS) {
    const body: Record<string, unknown> = {
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Question: ${q || "(free speaking)"}\nTranscript: ${text}` },
      ],
    };
    if (model.startsWith("openai/gpt-oss")) body.reasoning_effort = "medium";
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.status === 429 || r.status >= 500) { last = `${model} ${r.status}`; continue; }
    if (!r.ok) { last = `${model} ${r.status} ${await r.text()}`; continue; }
    const j = await r.json();
    try {
      const o = JSON.parse(j.choices?.[0]?.message?.content ?? "");
      const fixes = (Array.isArray(o.fixes) ? o.fixes : [])
        .filter((f: Record<string, unknown>) => typeof f?.from === "string" && typeof f?.to === "string" && f.from !== f.to)
        .map((f: Record<string, string>) => ({ from: f.from, to: f.to, type: TYPES.includes(f.type) ? f.type : "문장 구조", why: String(f.why ?? "") }));
      return { corrected: String(o.corrected ?? text), fixes, better: String(o.better ?? ""), good: String(o.good ?? ""), llm: model };
    } catch (_) { last = `${model} bad json`; continue; }
  }
  throw new Error(`busy ${last}`);
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  if (req.method !== "POST") return json({ error: "POST only" }, 405, h);
  if (!GROQ_KEY) return json({ error: "server_not_ready" }, 500, h);

  try {
    let text = "", q = "", duration = 0, stt = "";
    const ct = req.headers.get("content-type") ?? "";
    let audio: File | null = null;
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const a = fd.get("audio"); q = String(fd.get("q") ?? "").slice(0, 400);
      if (!(a instanceof File) || !a.size) return json({ error: "no_audio" }, 400, h);
      if (a.size > MAX_AUDIO) return json({ error: "too_long" }, 413, h);
      audio = a;
    } else {
      const b = await req.json().catch(() => ({}));
      text = String(b.text ?? "").trim().slice(0, 4000); q = String(b.q ?? "").slice(0, 400);
      if (!text) return json({ error: "no_text" }, 400, h);
    }

    if (!(await allow(await whoIs(req)))) return json({ error: "daily_limit" }, 429, h);

    if (audio) {
      const t = await transcribe(audio);
      text = t.text; duration = t.duration; stt = t.stt;
      if (!text || text.split(" ").length < 2) return json({ transcript: text, duration, error: "no_speech" }, 200, h);
    }
    const c = await correct(text, q);
    return json({ transcript: text, duration, stt, ...c }, 200, h);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    console.error(msg);
    return json({ error: msg.startsWith("busy") ? "busy" : "failed" }, msg.startsWith("busy") ? 503 : 500, h);
  }
});
