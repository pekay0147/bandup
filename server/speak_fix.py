"""밴드업 말하기 첨삭 서버 (feature/mock-ai-feedback 브랜치 테스트용)

파이썬만 있으면 돼요. 따로 설치할 것도, 데이터베이스(SQL)도 없어요.
이 서버 하나가 밴드업 화면(정적 파일)과 AI 첨삭 API를 같이 제공해요.

준비:  server/.env.example 을 복사해서 server/.env 를 만들고 GROQ_API_KEY 를 넣기
실행:  python server/speak_fix.py
열기:  http://localhost:8765/u/<학생코드>/   → 모의고사

API
  POST /api/stt?s=<학생코드>   body = 녹음 파일(audio/webm, audio/mp4 …)
       → {"transcript": "...", "duration": 12.3}           답변 하나 받아쓰기 (Groq Whisper)
  POST /api/fix   body = {"s": 학생코드, "part": 1, "items": [{"q": 질문, "text": 답}]}
       → {"items": [{"corrected", "fixes", "better", "good"} | null, ...]}   Part 하나를 한 번에 첨삭 (Groq LLM)

하루 사용 횟수는 server/usage.json 에 날짜별로 세요 (서버를 껐다 켜도 유지).
"""
import datetime
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent


def load_env():
    f = HERE / ".env"
    if not f.exists():
        return
    for line in f.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8765"))
# 하루 한도. Groq 무료(2026-11 콘솔): LLM 모델마다 하루 20만 토큰·분당 8천 토큰, Whisper 모델마다 하루 음성 28,800초.
# Part 단위 첨삭 1번 ≈ 3~5천 토큰 → 모의고사 1회(Part 3개) ≈ 1만~1만5천 토큰.
STT_DAILY = int(os.environ.get("AI_STT_DAILY", "80"))      # 학생 1명당 받아쓰기 횟수 (모의고사 1회 ≈ 18번)
STT_TOTAL = int(os.environ.get("AI_STT_TOTAL", "1000"))    # 모든 학생 합계 받아쓰기 횟수 (공개 주소로 열 때 보호용)
FIX_DAILY = int(os.environ.get("AI_FIX_DAILY", "9"))       # 학생 1명당 Part 첨삭 횟수 (모의고사 1회 = 3번)
FIX_TOTAL = int(os.environ.get("AI_FIX_TOTAL", "120"))     # 모든 학생 합계 Part 첨삭 횟수
BLOCK = {s.strip() for s in os.environ.get("AI_BLOCK", "common,demo,jelly-demo").split(",")}  # 여러 사람이 같이 쓰는 링크

STT_MODELS = ["whisper-large-v3", "whisper-large-v3-turbo"]  # 앞 모델 한도가 차면 다음으로
LLM_MODELS = ["openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"]
MAX_AUDIO = 20 * 1024 * 1024
MAX_ITEMS = 20

# Whisper 는 prompt 의 말투를 따라 해요. 실수와 머뭇거림이 섞인 예시를 주면 학생 실수를 덜 고쳐서 적어요.
VERBATIM_PROMPT = "Um, so, I think, uh, yesterday I go to the park with my friend and he don't like it, because it was, like, very much crowded."

TYPES = ["어휘", "단·복수", "주어-동사", "동사·시제", "문장 구조", "관사·전치사", "품사", "단어 선택", "표현"]

SYSTEM = f"""You are an experienced IELTS Speaking examiner and English teacher for Korean learners.
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
{{"items": [
  {{"n": 1,
    "corrected": "the whole answer, minimally corrected, fillers removed",
    "fixes": [{{"from": "exact words copied from the transcript", "to": "the replacement", "type": one of {json.dumps(TYPES, ensure_ascii=False)}, "why": "짧은 한국어 설명 (해요체, 60자 이내)"}}],
    "better": "a more natural Band 7+ version with the same ideas and similar length, or \\"\\" if corrected is already excellent",
    "good": "학생이 잘한 점 한 가지 (해요체, 한 문장), 없으면 \\"\\""}}
]}}
Rules for "fixes": in the order they appear; each "from" is the smallest span that still shows the mistake clearly (usually 2-6 words) and appears in that transcript exactly; [] if there are no mistakes.
Type guide: 동사·시제 = tense/verb form, 주어-동사 = agreement, 단·복수 = plural/countable, 관사·전치사 = articles/prepositions, 문장 구조 = word order/missing words/sentence structure, 품사 = part of speech, 단어 선택 = wrong or unnatural word/collocation, 표현 = idiom or fixed expression, 어휘 = vocabulary range.

Example input:
[1] Question: Do you like sports?
Transcript: Yes, uh, you can run as fast you can and, um, I do a lot of efforts for it.
Example output:
{{"items":[{{"n":1,"corrected":"Yes, you can run as fast as you can, and I put a lot of effort into it.","fixes":[{{"from":"as fast you can","to":"as fast as you can","type":"문장 구조","why":"'as + 부사 + as' 구문이라 두 번째 as가 필요해요."}},{{"from":"do a lot of efforts for it","to":"put a lot of effort into it","type":"표현","why":"effort는 셀 수 없고, 'put effort into'로 써요."}}],"better":"Yes, I love running. I try to go as fast as I can, and I put a lot of effort into it.","good":"질문에 Yes로 바로 답하고 이유를 덧붙였어요."}}]}}"""


class Busy(Exception):
    pass


# ---------- 하루 사용 횟수 (server/usage.json) ----------
USAGE = HERE / "usage.json"
_lock = threading.Lock()

SYSTEM_V2 = SYSTEM + r"""
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
"upgrades":[{"from":"I'm jealous","to":"a bit","ko":"조금, 약간","why":"감정을 부드럽게 말할 때 자주 붙여요."}]"""  # 학생 파일 "p2rec": true (은수·기현)


def bump(key, limit):
    today = datetime.date.today().isoformat()
    with _lock:
        try:
            u = json.loads(USAGE.read_text(encoding="utf-8"))
        except Exception:
            u = {}
        if u.get("day") != today:
            u = {"day": today, "n": {}}
        n = u["n"].get(key, 0)
        if n >= limit:
            return False
        u["n"][key] = n + 1
        USAGE.write_text(json.dumps(u, ensure_ascii=False, indent=1), encoding="utf-8")
        return True


def is_student(slug):
    if not re.fullmatch(r"[a-z0-9-]{3,40}", slug or "") or slug in BLOCK:
        return False
    f = ROOT / "data" / "students" / f"{slug}.json"
    try:
        d = json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        return False
    return d.get("slug") == slug and not d.get("demo")


# ---------- Groq ----------
def groq(path, data, content_type, timeout=150):
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/" + path, data=data, method="POST",
        headers={"Authorization": "Bearer " + GROQ_KEY, "Content-Type": content_type, "User-Agent": "bandup-speak-fix/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # 네트워크 문제
        return 599, str(e).encode()


def multipart(fields, filename, content, ctype):
    b = uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode() for k, v in fields.items()]
    parts.append(f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + content + b"\r\n")
    parts.append(f"--{b}--\r\n".encode())
    return b"".join(parts), "multipart/form-data; boundary=" + b


def stt_prompt(q):
    # Whisper prompt 는 "바로 앞에 나온 말"처럼 쓰여요. 질문을 넣어 주면 주제 단어(장소·사물 이름 등)를 더 잘 알아들어요.
    q = " ".join(str(q or "").split())[:300]
    return (q + " " if q else "") + VERBATIM_PROMPT


def transcribe(audio, ctype, q=""):
    ext = "m4a" if re.search(r"mp4|m4a|aac", ctype) else "ogg" if "ogg" in ctype else "wav" if "wav" in ctype else "webm"
    last = ""
    for model in STT_MODELS:
        body, ct = multipart({"model": model, "language": "en", "temperature": "0", "response_format": "verbose_json", "prompt": stt_prompt(q)},
                             "answer." + ext, audio, ctype or "audio/webm")
        status, raw = groq("audio/transcriptions", body, ct)
        if status == 429 or status >= 500:
            last = f"{model} {status}"
            continue
        if status != 200:
            raise RuntimeError(f"stt {model} {status} {raw[:300]!r}")
        j = json.loads(raw)
        segs = j.get("segments")
        if segs is not None:  # 소리가 거의 없는 구간은 Whisper 가 prompt 를 따라 지어내는 일이 있어서 버려요
            text = " ".join(s.get("text", "") for s in segs if (s.get("no_speech_prob") or 0) < 0.7)
        else:
            text = j.get("text", "")
        return {"transcript": " ".join(text.split()), "duration": float(j.get("duration") or 0), "stt": model}
    raise Busy(last)


def clean_item(o, fallback):
    if not isinstance(o, dict):
        return None
    fixes = []
    for f in o.get("fixes") or []:
        if isinstance(f, dict) and isinstance(f.get("from"), str) and isinstance(f.get("to"), str) and f["from"] != f["to"]:
            fixes.append({"from": f["from"], "to": f["to"], "type": f.get("type") if f.get("type") in TYPES else "문장 구조", "why": str(f.get("why") or "")})
    better = str(o.get("better") or ""); ups = []
    for u in o.get("upgrades") or []:
        if isinstance(u, dict) and isinstance(u.get("to"), str) and u["to"].strip() and len(u["to"]) <= 80 and len(u["to"].split()) <= 8 and u["to"].lower() in better.lower():
            ups.append({"from": str(u.get("from") or ""), "to": u["to"], "ko": str(u.get("ko") or ""), "why": str(u.get("why") or "")})
    return {"corrected": str(o.get("corrected") or fallback), "fixes": fixes, "better": better, "upgrades": ups, "good": str(o.get("good") or "")}


def correct(part, items, v2=False):
    user = f"IELTS Speaking Part {part}\n\n" + "\n\n".join(f"[{i + 1}] Question: {it['q'] or '(free speaking)'}\nTranscript: {it['text']}" for i, it in enumerate(items))
    last = ""
    for model in LLM_MODELS:
        body = {"model": model, "temperature": 0.2, "max_completion_tokens": 5000, "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": SYSTEM_V2 if v2 else SYSTEM}, {"role": "user", "content": user}]}
        if model == "openai/gpt-oss-120b":
            body["reasoning_effort"] = "medium"  # low 는 토큰이 40% 적지만 첨삭이 덜 꼼꼼해요
        elif model.startswith("openai/gpt-oss"):
            body["reasoning_effort"] = "low"
        elif model.startswith("qwen/"):
            body["reasoning_format"] = "hidden"
        status, raw = groq("chat/completions", json.dumps(body).encode(), "application/json")
        m = re.search(rb"try again in ([\d.]+)s", raw) if status == 429 else None
        if m and float(m.group(1)) <= 20:  # 분당 한도면 잠깐 기다렸다가 같은 좋은 모델로 다시
            time.sleep(float(m.group(1)) + 0.5)
            status, raw = groq("chat/completions", json.dumps(body).encode(), "application/json")
        if status != 200:
            last = f"{model} {status} {raw[:200]!r}"
            print("llm", last, file=sys.stderr)
            continue
        try:
            content = json.loads(raw)["choices"][0]["message"]["content"] or ""
            content = re.sub(r"<think>[\s\S]*?</think>", "", content)
            o = json.loads(content[content.index("{"): content.rindex("}") + 1])
            got = {int(x.get("n", 0)): x for x in o.get("items", []) if isinstance(x, dict)}
            out = [clean_item(got.get(i + 1), it["text"]) for i, it in enumerate(items)]
            if not any(out):
                raise ValueError("empty")
            return out, model
        except Exception as e:
            last = f"{model} bad json {e}"
            print("llm", last, file=sys.stderr)
    raise Busy(last)


# ---------- HTTP ----------
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=str(ROOT), **k)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def send_head(self):
        # server/ 폴더(.env 키 파일 포함)와 .git 같은 숨김 폴더는 절대 내보내지 않아요
        p = Path(self.translate_path(self.path)).resolve()
        try:
            rel = p.relative_to(ROOT)
        except ValueError:
            self.send_error(404)
            return None
        if p == HERE or HERE in p.parents or any(x.startswith(".") for x in rel.parts):
            self.send_error(404)
            return None
        return super().send_head()

    def reply(self, status, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_POST(self):
        u = urllib.parse.urlsplit(self.path)
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_AUDIO:
            return self.reply(413, {"error": "too_long"})
        body = self.rfile.read(n)
        if u.path not in ("/api/stt", "/api/fix"):
            return self.reply(404, {"error": "not_found"})
        if not GROQ_KEY:
            return self.reply(500, {"error": "server_not_ready"})
        try:
            if u.path == "/api/stt":
                slug = urllib.parse.parse_qs(u.query).get("s", [""])[0]
                if not body:
                    return self.reply(400, {"error": "no_audio"})
                if not is_student(slug):
                    return self.reply(403, {"error": "not_student"})
                if not bump(f"stt:{slug}", STT_DAILY):
                    return self.reply(429, {"error": "daily_limit"})
                if not bump("stt:total", STT_TOTAL):
                    return self.reply(503, {"error": "busy"})
                q = urllib.parse.parse_qs(u.query).get("q", [""])[0]
                r = transcribe(body, (self.headers.get("Content-Type") or "audio/webm").split(";")[0].strip(), q)
                if len(r["transcript"].split()) < 2:
                    r["error"] = "no_speech"
                return self.reply(200, r)

            b = json.loads(body or b"{}")
            slug = str(b.get("s") or "")
            part = int(b.get("part") or 1)
            items = [{"q": str(x.get("q") or "")[:400], "text": str(x.get("text") or "").strip()[:4000]}
                     for x in (b.get("items") or [])[:MAX_ITEMS] if isinstance(x, dict)]
            if not items or not all(x["text"] for x in items):
                return self.reply(400, {"error": "no_text"})
            if not is_student(slug):
                return self.reply(403, {"error": "not_student"})
            if not bump(f"fix:{slug}", FIX_DAILY):
                return self.reply(429, {"error": "daily_limit"})
            if not bump("fix:total", FIX_TOTAL):
                return self.reply(503, {"error": "busy"})
            out, model = correct(part, items, b.get("v") == 2)
            return self.reply(200, {"items": out, "llm": model})
        except Busy as e:
            print("busy", e, file=sys.stderr)
            return self.reply(503, {"error": "busy"})
        except Exception as e:
            print("failed", repr(e), file=sys.stderr)
            return self.reply(500, {"error": "failed"})


if __name__ == "__main__":
    if not GROQ_KEY:
        print("※ GROQ_API_KEY 가 없어요. server/.env 를 만들어 주세요. (화면은 열리지만 첨삭은 안 돼요)", file=sys.stderr)
    print(f"밴드업 + 말하기 첨삭: http://localhost:{PORT}/u/<학생코드>/", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
