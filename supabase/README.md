# 말하기 첨삭 서버를 Supabase에 올리기

밴드업이 이미 쓰는 Supabase 프로젝트(`qbqttaqipapmeutdrvdc`)에 **함수 하나**를 추가해요.
기존 기능(로그인, 기록 저장)과 기존 표는 건드리지 않아요. 모두 대시보드에서 클릭과 붙여넣기로 끝나요. (약 10분)

> 이 프로젝트 소유자 계정으로 로그인해야 해요. 다른 사람이 하려면 소유자가
> **Organization → Team → Invite**로 초대해 주면 돼요.

## 1. Groq 키 넣기 (비밀값)
1. supabase.com → 밴드업 프로젝트 → 왼쪽 **Edge Functions** → **Secrets**
2. **Add new secret**
   - Name: `GROQ_API_KEY`
   - Value: Groq 키 (`gsk_…`)
3. **Save**

## 2. 함수 만들기
1. **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름: `speak-fix` (정확히 이 이름)
3. 편집기에 있는 기본 코드를 모두 지우고, 이 저장소의
   `supabase/functions/speak-fix/index.ts` 내용을 전부 붙여 넣기
4. **Deploy function**
5. 배포가 끝나면 함수 **Details/Settings**에서 **Enforce JWT Verification(Verify JWT)** 를 **끄기**
   (학생 확인은 함수가 학생 코드로 직접 해요)

## 3. 하루 사용 횟수 기록 (선택, 권장)
학생 한 명이 하루 무료 한도를 다 쓰지 않게 막는 기능이에요. 안 해도 첨삭은 동작해요.
1. 왼쪽 **SQL Editor** → **New query**
2. `supabase/ai_usage.sql` 내용을 전부 붙여 넣고 **Run**
3. "Success. No rows returned" 가 나오면 끝

## 4. 확인
배포 후 Claude에게 "배포했어"라고 알려 주면 함수가 잘 도는지 시험해요.
잘 되면 `app.js` 의 `AI_LIVE` 를 `true` 로 바꾸고 main 에 합치면 학생 앱에 첨삭 버튼이 나타나요.

## 하루 한도 바꾸기 (선택)
**Edge Functions → Secrets** 에 아래 이름으로 숫자를 넣으면 돼요. 넣지 않으면 기본값.

| 이름 | 기본값 | 뜻 |
|---|---|---|
| `AI_STT_DAILY` | 80 | 학생 1명당 하루 받아쓰기 횟수 (모의고사 1회 ≈ 18번) |
| `AI_FIX_DAILY` | 9 | 학생 1명당 하루 Part 첨삭 횟수 (모의고사 1회 = 3번) |
| `AI_STT_TOTAL` | 1000 | 전체 학생 합계 하루 받아쓰기 |
| `AI_FIX_TOTAL` | 120 | 전체 학생 합계 하루 Part 첨삭 |

하루는 한국 시간 오전 9시(UTC 0시)에 새로 시작돼요.
