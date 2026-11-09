-- =====================================================================
-- 마이그레이션 001: 닉네임당 점수 1개 (최고 점수만 유지)
-- ---------------------------------------------------------------------
-- 이미 운영 중인 DB에 실행하세요. 기존 데이터는 유지됩니다.
-- 단, 같은 닉네임의 기록이 여러 개면 가장 높은 점수 1개만 남기고 나머지는 삭제됩니다.
--
-- 사용법: Supabase 대시보드 → SQL Editor → New query → 전체 붙여넣기 → Run
--         "destructive operation" 경고가 뜨면 "Run this query"를 눌러 진행하세요.
-- =====================================================================

begin;

-- 1. 중복 닉네임 정리: 최고 점수(같으면 먼저 기록한 것) 1개만 남김
delete from public.scores a
using public.scores b
where a.nickname = b.nickname
  and (a.score < b.score or (a.score = b.score and a.id > b.id));

-- 2. 닉네임 중복 금지
alter table public.scores drop constraint if exists scores_nickname_key;
alter table public.scores add constraint scores_nickname_key unique (nickname);

-- 3. 점수 등록 함수: 처음이면 추가, 이미 있으면 더 높을 때만 갱신
create or replace function public.submit_score(
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
        created_at = now()          -- 최고 기록을 세운 시각
    where excluded.score > public.scores.score;

  return query
    select s.score, (v_old is null or p_score > v_old)
    from public.scores s
    where s.nickname = v_name;
end;
$$;

grant execute on function public.submit_score(text, integer, integer, integer) to anon, authenticated;

-- 4. 브라우저에서 scores에 직접 INSERT 하는 것은 막고, 위 함수로만 등록
drop policy if exists scores_insert on public.scores;
revoke insert on public.scores from anon, authenticated;

commit;
