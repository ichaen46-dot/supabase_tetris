-- STACKFALL Supabase 스키마
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
-- 여러 번 실행해도 안전합니다. (DROP 문이 없어 "destructive operation" 경고가 뜨지 않습니다)

-- ===== 1. 점수 테이블 =====
create table if not exists public.scores (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  score       integer     not null check (score >= 0 and score < 100000000),
  lines       integer     not null default 0 check (lines >= 0),
  level       integer     not null default 1 check (level >= 1),
  created_at  timestamptz not null default now()
);

create index if not exists scores_rank_idx on public.scores (score desc, created_at asc);

-- ===== 2. 피드백 테이블 =====
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  nickname    text        not null check (char_length(btrim(nickname)) between 1 and 20),
  rating      smallint    not null check (rating between 1 and 5),
  message     text        not null check (char_length(btrim(message)) between 1 and 500),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);

-- ===== 3. 보안(RLS): 누구나 조회·추가만 가능, 수정·삭제는 불가 =====
alter table public.scores   enable row level security;
alter table public.feedback enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scores' and policyname = 'scores_select') then
    create policy scores_select on public.scores for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scores' and policyname = 'scores_insert') then
    create policy scores_insert on public.scores for insert to anon, authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback' and policyname = 'feedback_select') then
    create policy feedback_select on public.feedback for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'feedback' and policyname = 'feedback_insert') then
    create policy feedback_insert on public.feedback for insert to anon, authenticated with check (true);
  end if;
end $$;

-- ===== 4. API 접근 권한 =====
grant select, insert on public.scores   to anon, authenticated;
grant select, insert on public.feedback to anon, authenticated;
