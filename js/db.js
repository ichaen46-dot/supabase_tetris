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

export async function saveScore({ nickname, score, lines, level }) {
  await ensure();
  const { error } = await supabase.from('scores').insert({ nickname, score, lines, level });
  if (error) throw error;
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
