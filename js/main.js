import { Game, renderBoard, renderMini } from './game.js';
import { Sound } from './audio.js';
import * as db from './db.js';

const $ = (id) => document.getElementById(id);

const boardCtx = $('board').getContext('2d');
const nextCtx = $('next').getContext('2d');
const holdCtx = $('hold').getContext('2d');
const boardWrap = document.querySelector('.board-wrap');

const sound = new Sound();
let state = 'idle'; // idle | playing | paused | over
let scoreSaved = false;

const game = new Game({
  onSound: (name, arg) => sound.play(name, arg),
  // 생성자 안에서도 호출되므로(game 초기화 전) 다음 틱으로 미룸
  onUpdate: () => queueMicrotask(updateHud),
  onHardDrop: () => {
    boardWrap.classList.remove('shake');
    void boardWrap.offsetWidth; // 애니메이션 재시작
    boardWrap.classList.add('shake');
  },
  onLevelUp: (lv) => {
    sound.play('levelup');
    sound.setLevel(lv);
  },
  onGameOver: () => endGame(),
});

// ===== HUD =====
function updateHud() {
  $('score').textContent = game.score.toLocaleString();
  $('lines').textContent = game.lines;
  $('level').textContent = game.level;
  renderMini(nextCtx, game.queue);
  renderMini(holdCtx, game.hold, 8, 12);
}

function showOverlay(which) {
  $('overlay').classList.toggle('hidden', !which);
  ['start', 'pause', 'over'].forEach((k) => $(`overlay-${k}`).classList.toggle('hidden', k !== which));
}

// ===== 게임 흐름 =====
function startGame() {
  sound.init();
  game.reset();
  sound.resetBgm();
  sound.setLevel(1);
  sound.play('start');
  sound.startBgm();
  state = 'playing';
  scoreSaved = false;
  showOverlay(null);
  updateHud();
  last = performance.now();
}

function togglePause() {
  if (state === 'playing') {
    state = 'paused';
    game.paused = true;
    sound.stopBgm();
    showOverlay('pause');
  } else if (state === 'paused') {
    state = 'playing';
    game.paused = false;
    sound.startBgm();
    showOverlay(null);
    last = performance.now();
  }
}

function endGame() {
  state = 'over';
  sound.stopBgm();
  sound.play('gameover');
  $('final-score').textContent = game.score.toLocaleString();
  $('save-msg').textContent = '';
  $('save-msg').className = 'msg';
  $('btn-save').disabled = !db.configured;
  if (!db.configured) setMsg($('save-msg'), 'Supabase 설정 후 점수를 저장할 수 있습니다.', 'err');
  $('nickname').value = localStorage.getItem('sf_nick') || '';
  showOverlay('over');
  setTimeout(() => $('nickname').focus(), 50);
}

// ===== 루프 =====
let last = performance.now();
function loop(now) {
  const dt = Math.min(now - last, 100);
  last = now;
  if (state === 'playing') {
    game.update(dt);
    handleRepeat(dt);
  }
  renderBoard(boardCtx, game);
  requestAnimationFrame(loop);
}

// ===== 입력 (DAS: 길게 누르면 반복 이동) =====
const held = {};
const DAS = 160;
const ARR = 45;
function handleRepeat(dt) {
  for (const key of ['left', 'right', 'down']) {
    const h = held[key];
    if (!h) continue;
    h.t += dt;
    const delay = key === 'down' ? 40 : DAS;
    if (h.t >= delay) {
      h.acc += dt;
      const rate = key === 'down' ? 35 : ARR;
      while (h.acc >= rate) {
        h.acc -= rate;
        act(key);
      }
    }
  }
}

function act(a) {
  if (state !== 'playing') return;
  switch (a) {
    case 'left': game.move(-1); break;
    case 'right': game.move(1); break;
    case 'down': game.softDrop(); break;
    case 'rotate': game.rotate(1); break;
    case 'rotateCCW': game.rotate(-1); break;
    case 'drop': game.hardDrop(); break;
    case 'hold': game.holdPiece(); break;
  }
  updateHud();
}

const KEYMAP = {
  ArrowLeft: 'left', ArrowRight: 'right', ArrowDown: 'down',
  ArrowUp: 'rotate', KeyX: 'rotate', KeyZ: 'rotateCCW',
  Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold',
};

document.addEventListener('keydown', (e) => {
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;

  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (e.code === 'Enter' && state === 'idle') { startGame(); return; }

  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (e.repeat) return;
  act(a);
  if (a === 'left' || a === 'right' || a === 'down') {
    held[a] = { t: 0, acc: 0 };
    if (a === 'left') delete held.right;
    if (a === 'right') delete held.left;
  }
});

document.addEventListener('keyup', (e) => {
  const a = KEYMAP[e.code];
  if (a) delete held[a];
});

window.addEventListener('blur', () => {
  Object.keys(held).forEach((k) => delete held[k]);
  if (state === 'playing') togglePause();
});

// 터치 버튼
document.querySelectorAll('.touch button').forEach((btn) => {
  const a = btn.dataset.act;
  const start = (e) => {
    e.preventDefault();
    sound.init();
    if (state === 'idle' || state === 'over') return;
    act(a);
    if (a === 'left' || a === 'right' || a === 'down') held[a] = { t: 0, acc: 0 };
  };
  const end = () => delete held[a];
  btn.addEventListener('touchstart', start, { passive: false });
  btn.addEventListener('touchend', end);
  btn.addEventListener('touchcancel', end);
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
});

// ===== 소리 =====
function renderMute() {
  $('btn-mute').textContent = sound.muted ? '🔇 음소거' : '🔊 소리';
}
function toggleMute() {
  sound.init();
  sound.toggleMute();
  renderMute();
}
$('btn-mute').addEventListener('click', (e) => { toggleMute(); e.currentTarget.blur(); });
renderMute();

// ===== 버튼 =====
$('btn-start').addEventListener('click', startGame);
$('btn-resume').addEventListener('click', togglePause);
$('btn-restart').addEventListener('click', startGame);

// ===== DB: 랭킹 =====
function setMsg(el, text, type = '') {
  el.textContent = text;
  el.className = `msg ${type}`;
}

function cleanName(v) {
  return v.replace(/\s+/g, ' ').trim().slice(0, 20);
}

async function loadLeaderboard() {
  const ol = $('leaderboard');
  if (!db.configured) {
    ol.innerHTML = '<li class="empty">Supabase 미설정</li>';
    return;
  }
  try {
    const rows = await db.fetchTopScores(10);
    ol.innerHTML = '';
    if (!rows.length) {
      ol.innerHTML = '<li class="empty">아직 기록이 없어요. 첫 기록의 주인공이 되어보세요!</li>';
      return;
    }
    for (const r of rows) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = r.nickname;
      name.title = `${r.nickname} · Lv.${r.level} · ${r.lines}줄`;
      const pts = document.createElement('span');
      pts.className = 'pts';
      pts.textContent = r.score.toLocaleString();
      li.append(name, pts);
      ol.append(li);
    }
  } catch (err) {
    console.error(err);
    ol.innerHTML = '<li class="empty">랭킹을 불러오지 못했습니다.</li>';
  }
}

$('score-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (scoreSaved) return;
  const nickname = cleanName($('nickname').value);
  if (!nickname) return setMsg($('save-msg'), '닉네임을 입력해 주세요.', 'err');
  const btn = $('btn-save');
  btn.disabled = true;
  setMsg($('save-msg'), '저장 중…');
  try {
    await db.saveScore({ nickname, score: game.score, lines: game.lines, level: game.level });
    scoreSaved = true;
    localStorage.setItem('sf_nick', nickname);
    setMsg($('save-msg'), '저장되었습니다! 🎉', 'ok');
    sound.play('click');
    loadLeaderboard();
  } catch (err) {
    console.error(err);
    btn.disabled = false;
    setMsg($('save-msg'), `저장 실패: ${err.message || err}`, 'err');
  }
});

$('btn-refresh').addEventListener('click', loadLeaderboard);

// ===== DB: 피드백 =====
let rating = 5;
function renderRating() {
  document.querySelectorAll('#fb-rating button').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.v) <= rating);
    b.setAttribute('aria-pressed', Number(b.dataset.v) === rating);
  });
}
document.querySelectorAll('#fb-rating button').forEach((b) => {
  b.addEventListener('click', () => { rating = Number(b.dataset.v); renderRating(); });
});
renderRating();

$('fb-message').addEventListener('input', (e) => {
  $('fb-count').textContent = `${e.target.value.length} / 500`;
});
$('fb-name').value = localStorage.getItem('sf_nick') || '';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadFeedback() {
  const ul = $('feedback-list');
  if (!db.configured) {
    ul.innerHTML = '<li class="empty">Supabase 미설정</li>';
    return;
  }
  try {
    const rows = await db.fetchFeedback(20);
    ul.innerHTML = '';
    if (!rows.length) {
      ul.innerHTML = '<li class="empty">첫 피드백을 남겨주세요!</li>';
      return;
    }
    for (const r of rows) {
      const li = document.createElement('li');
      const meta = document.createElement('div');
      meta.className = 'meta';
      const left = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = r.nickname;
      const stars = document.createElement('span');
      stars.className = 'stars';
      stars.textContent = ' ' + '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      left.append(b, stars);
      const date = document.createElement('span');
      date.textContent = formatDate(r.created_at);
      meta.append(left, date);
      const p = document.createElement('p');
      p.textContent = r.message;
      li.append(meta, p);
      ul.append(li);
    }
  } catch (err) {
    console.error(err);
    ul.innerHTML = '<li class="empty">피드백을 불러오지 못했습니다.</li>';
  }
}

$('feedback-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const nickname = cleanName($('fb-name').value);
  const message = $('fb-message').value.trim().slice(0, 500);
  if (!nickname || !message) return setMsg($('fb-msg'), '닉네임과 내용을 입력해 주세요.', 'err');
  if (!db.configured) return setMsg($('fb-msg'), 'Supabase가 설정되지 않았습니다.', 'err');
  const btn = $('btn-fb');
  btn.disabled = true;
  setMsg($('fb-msg'), '등록 중…');
  try {
    await db.saveFeedback({ nickname, rating, message });
    localStorage.setItem('sf_nick', nickname);
    $('fb-message').value = '';
    $('fb-count').textContent = '0 / 500';
    setMsg($('fb-msg'), '소중한 의견 감사합니다!', 'ok');
    loadFeedback();
  } catch (err) {
    console.error(err);
    setMsg($('fb-msg'), `등록 실패: ${err.message || err}`, 'err');
  } finally {
    btn.disabled = false;
  }
});

// ===== DB 상태 표시 =====
async function checkDb() {
  const chip = $('db-status');
  if (!db.configured) {
    chip.textContent = 'DB 미설정';
    chip.className = 'chip err';
    return;
  }
  try {
    await db.fetchTopScores(1);
    chip.textContent = '● DB 연결됨';
    chip.className = 'chip ok';
  } catch {
    chip.textContent = '● DB 연결 실패';
    chip.className = 'chip err';
  }
}

// ===== 시작 =====
showOverlay('start');
updateHud();
requestAnimationFrame(loop);
checkDb();
loadLeaderboard();
loadFeedback();
