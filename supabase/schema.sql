-- STACKFALL Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (여러 번 실행해도 안전)

-- ===== 점수 =====
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  score       integer     not null check (score >= 0 and score < 100000000),
  lines       integer     not null default 0 check (lines >= 0),
  level       integer     not null default 1 check (level >= 1),
  created_at  timestamptz not null default now()
);

create index if not exists scores_rank_idx on public.scores (score desc, created_at asc);

-- ===== 피드백 =====
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  rating      smallint    not null check (rating between 1 and 5),
  message     text        not null check (char_length(btrim(message)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

-- ===== RLS: 조회와 추가만 허용 (수정/삭제 정책 없음 = 차단) =====
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

drop policy if exists "scores_select" on public.scores;
drop policy if exists "scores_insert" on public.scores;
drop policy if exists "feedback_select" on public.feedback;
drop policy if exists "feedback_insert" on public.feedback;

create policy "scores_select"   on public.scores   for select to anon, authenticated using (true);
create policy "scores_insert"   on public.scores   for insert to anon, authenticated with check (true);
create policy "feedback_select" on public.feedback for select to anon, authenticated using (true);
create policy "feedback_insert" on public.feedback for insert to anon, authenticated with check (true);

-- 테이블 권한 (Data API 노출)
grant select, insert on public.scores   to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
