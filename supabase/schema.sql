-- =====================================================================
-- STACKFALL Supabase 스키마 (초기화 후 재설치)
-- ---------------------------------------------------------------------
-- ⚠️ 주의: 실행하면 기존 scores / feedback 테이블과 그 안의 데이터(랭킹, 피드백)가
--          모두 삭제된 뒤 새로 만들어집니다. 되돌릴 수 없습니다.
--
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
--         "destructive operation" 경고가 뜨면 "Run this query"를 눌러 진행하세요.
-- =====================================================================

-- ===== 0. 기존 테이블 삭제 (정책·인덱스도 함께 삭제됨) =====
drop table if exists public.scores   cascade;
drop table if exists public.feedback cascade;

-- ===== 1. 점수 테이블 =====
create table public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  score       integer     not null check (score >= 0 and score < 100000000),
  lines       integer     not null default 0 check (lines >= 0),
  level       integer     not null default 1 check (level >= 1),
  created_at  timestamptz not null default now()
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

-- ===== 3. 보안(RLS): 누구나 조회·추가만 가능, 수정·삭제는 불가 =====
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

create policy scores_select   on public.scores   for select to anon, authenticated using (true);
create policy scores_insert   on public.scores   for insert to anon, authenticated with check (true);
create policy feedback_select on public.feedback for select to anon, authenticated using (true);
create policy feedback_insert on public.feedback for insert to anon, authenticated with check (true);
-- update / delete 정책은 만들지 않음 → 브라우저(publishable 키)에서는 수정·삭제 불가

-- ===== 4. API 접근 권한 =====
grant select, insert on public.scores   to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
