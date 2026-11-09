-- =====================================================================
-- STACKFALL Supabase 스키마 (초기화 후 재설치)
-- ---------------------------------------------------------------------
-- ⚠️ 주의: 실행하면 기존 scores / feedback 테이블과 그 안의 데이터(랭킹, 피드백)가
--          모두 삭제된 뒤 새로 만들어집니다. 되돌릴 수 없습니다.
--          이미 운영 중인 DB를 업데이트하려면 migrations/ 폴더의 파일을 실행하세요.
--
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
--         "destructive operation" 경고가 뜨면 "Run this query"를 눌러 진행하세요.
-- =====================================================================

-- ===== 0. 기존 테이블/함수 삭제 (정책·인덱스도 함께 삭제됨) =====
drop function if exists public.submit_score(text, integer, integer, integer);
drop table if exists public.scores   cascade;
drop table if exists public.feedback cascade;

-- ===== 1. 점수 테이블 (닉네임당 최고 점수 1개) =====
create table public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  score       integer     not null check (score >= 0 and score < 100000000),
  lines       integer     not null default 0 check (lines >= 0),
  level       integer     not null default 1 check (level >= 1),
  created_at  timestamptz not null default now(),   -- 최고 기록을 세운 시각
  constraint scores_nickname_key unique (nickname)
);

-- 랭킹 조회용 (점수 높은 순, 같은 점수면 먼저 기록한 순)
create index scores_rank_idx on public.scores (score desc, created_at asc);

-- ===== 2. 피드백 테이블 =====
create table public.feedback (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  rating      smallint    not null check (rating between 1 and 5),
  message     text        not null check (char_length(btrim(message)) between 1 and 500),
  created_at  timestamptz not null default now()
);

-- 최신순 조회용
create index feedback_created_idx on public.feedback (created_at desc);

-- ===== 3. 점수 등록 함수: 처음이면 추가, 이미 있으면 더 높을 때만 갱신 =====
create function public.submit_score(
  p_nickname text,
  p_score    integer,
  p_lines    integer,
  p_level    integer
)
returns table (best_score integer, is_new_best boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(p_nickname);
  v_old  integer;
begin
  select s.score into v_old from public.scores s where s.nickname = v_name;

  insert into public.scores (nickname, score, lines, level)
  values (v_name, p_score, p_lines, p_level)
  on conflict (nickname) do update
    set score = excluded.score,
        lines = excluded.lines,
        level = excluded.level,
        created_at = now()
    where excluded.score > public.scores.score;

  return query
    select s.score, (v_old is null or p_score > v_old)
    from public.scores s
    where s.nickname = v_name;
end;
$$;

grant execute on function public.submit_score(text, integer, integer, integer) to anon, authenticated;

-- ===== 4. 보안(RLS) =====
-- scores  : 누구나 조회 가능, 등록은 submit_score 함수로만 (직접 추가/수정/삭제 불가)
-- feedback: 누구나 조회·추가 가능, 수정·삭제 불가
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

create policy scores_select   on public.scores   for select to anon, authenticated using (true);
create policy feedback_select on public.feedback for select to anon, authenticated using (true);
create policy feedback_insert on public.feedback for insert to anon, authenticated with check (true);

-- ===== 5. API 접근 권한 =====
grant select         on public.scores   to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
