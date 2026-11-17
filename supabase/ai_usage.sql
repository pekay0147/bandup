-- 말하기 첨삭(speak-fix) 하루 사용 횟수 기록용 (선택 사항이지만 권장)
-- Supabase 대시보드 → SQL Editor → 이 파일 내용을 전부 붙여 넣고 Run 한 번.
-- 새 표 ai_usage 와 함수 ai_bump 만 만들어요. 기존 표(progress 등)는 건드리지 않아요.
-- 이걸 안 하면 학생별 하루 제한 없이 동작해요 (Groq 무료 한도만 적용).

create table if not exists public.ai_usage (
  k   text not null,              -- 'stt:<학생코드>', 'fix:<학생코드>', 'stt:total', 'fix:total'
  day date not null default current_date,
  n   int  not null default 0,
  primary key (k, day)
);
alter table public.ai_usage enable row level security;  -- 정책 없음 = 학생 앱에서는 읽기·쓰기 불가 (서버 함수만 사용)

create or replace function public.ai_bump(p_k text, p_lim int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into ai_usage (k, day, n) values (p_k, current_date, 1)
  on conflict (k, day) do update set n = ai_usage.n + 1
  returning n into v;
  delete from ai_usage where day < current_date - 30;  -- 30일 지난 기록 정리
  return v <= p_lim;
end $$;

revoke all on function public.ai_bump(text, int) from public, anon, authenticated;
