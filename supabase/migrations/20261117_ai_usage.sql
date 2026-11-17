-- 말하기 첨삭(speak-fix) 하루 사용 횟수 집계. Edge Function 이 service role 로만 호출해요.
create table if not exists public.ai_usage (
  k   text not null,              -- 's:<학생 코드>' 또는 'total'(전체 합계)
  day date not null default current_date,
  n   int  not null default 0,
  primary key (k, day)
);
alter table public.ai_usage enable row level security;  -- 정책 없음 = 학생 앱에서는 읽기/쓰기 불가

create or replace function public.ai_bump(p_k text, p_lim int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v int;
begin
  insert into ai_usage (k, day, n) values (p_k, current_date, 1)
  on conflict (k, day) do update set n = ai_usage.n + 1
  returning n into v;
  delete from ai_usage where day < current_date - 30;  -- 오래된 집계 정리
  return v <= p_lim;
end $$;

revoke all on function public.ai_bump(text, int) from public, anon, authenticated;
