import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

export const configured = Boolean(
  SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('YOUR-') && !SUPABASE_ANON_KEY.includes('YOUR-')
);

// CDN 로딩에 실패해도 게임 자체는 동작하도록 동적으로 불러옵니다.
let clientPromise = null;
function getClient() {
  if (!configured) return Promise.reject(new Error('Supabase가 설정되지 않았습니다. js/config.js를 확인하세요.'));
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(SUPABASE_URL, SUPABASE_ANON_KEY))
      .catch((e) => { clientPromise = null; throw e; });
  }
  return clientPromise;
}

let supabase = null;
async function ensure() {
  supabase = await getClient();
}

export async function fetchTopScores(limit = 10) {
  await ensure();
  const { data, error } = await supabase
    .from('scores')
    .select('nickname, score, lines, level, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data;
}

// 같은 닉네임이면 더 높은 점수일 때만 갱신 (DB 함수 submit_score)
// 반환: { bestScore: 저장된 최고 점수, isNewBest: 이번 점수로 갱신/신규 등록됐는지 }
export async function saveScore({ nickname, score, lines, level }) {
  await ensure();
  const { data, error } = await supabase.rpc('submit_score', {
    p_nickname: nickname,
    p_score: score,
    p_lines: lines,
    p_level: level,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { bestScore: row?.best_score ?? score, isNewBest: row?.is_new_best ?? true };
}

export async function fetchFeedback(limit = 20) {
  await ensure();
  const { data, error } = await supabase
    .from('feedback')
    .select('nickname, rating, message, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function saveFeedback({ nickname, rating, message }) {
  await ensure();
  const { error } = await supabase.from('feedback').insert({ nickname, rating, message });
  if (error) throw error;
}
