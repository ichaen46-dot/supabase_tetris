// 블록 낙하 퍼즐 게임 엔진 (고스트/그림자 미리보기 없음)

export const COLS = 10;
export const ROWS = 20;

const SHAPES = {
  I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  O: [[1, 1], [1, 1]],
  T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

export const COLORS = {
  I: '#5ee0c0',
  O: '#ffd166',
  T: '#c792ea',
  S: '#8bd450',
  Z: '#ff6b7a',
  J: '#5c9dff',
  L: '#ffa24c',
};

const LINE_SCORES = [0, 100, 300, 500, 800];
const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1]];

const rotateCW = (m) => m[0].map((_, i) => m.map((row) => row[i]).reverse());
const rotateCCW = (m) => m[0].map((_, i) => m.map((row) => row[row.length - 1 - i]));

export class Game {
  constructor(events = {}) {
    this.events = events; // { onSound, onUpdate, onGameOver, onClear }
    this.reset();
  }

  emit(name, ...args) {
    const fn = this.events[name];
    if (fn) fn(...args);
  }

  reset() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.bag = [];
    this.queue = [];
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.hold = null;
    this.canHold = true;
    this.over = false;
    this.paused = false;
    this.dropAcc = 0;
    this.clearing = null; // { rows, t }
    while (this.queue.length < 5) this.queue.push(this.drawFromBag());
    this.spawn();
  }

  drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = Object.keys(SHAPES);
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  makePiece(type) {
    const shape = SHAPES[type].map((r) => r.slice());
    return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: type === 'I' ? -1 : 0 };
  }

  spawn(type) {
    const t = type || this.queue.shift();
    if (!type) this.queue.push(this.drawFromBag());
    this.piece = this.makePiece(t);
    this.dropAcc = 0;
    if (this.collides(this.piece.shape, this.piece.x, this.piece.y)) {
      this.over = true;
      this.emit('onGameOver');
    }
    this.emit('onUpdate');
  }

  collides(shape, px, py) {
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (!shape[y][x]) continue;
        const gx = px + x;
        const gy = py + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && this.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  get interval() {
    // 레벨이 오를수록 빨라짐
    return Math.max(80, 900 * Math.pow(0.85, this.level - 1));
  }

  active() { return !this.over && !this.paused && !this.clearing; }

  move(dx) {
    if (!this.active()) return false;
    const p = this.piece;
    if (!this.collides(p.shape, p.x + dx, p.y)) {
      p.x += dx;
      this.emit('onSound', 'move');
      return true;
    }
    return false;
  }

  rotate(dir = 1) {
    if (!this.active()) return;
    const p = this.piece;
    if (p.type === 'O') return;
    const next = dir > 0 ? rotateCW(p.shape) : rotateCCW(p.shape);
    for (const [kx, ky] of KICKS) {
      if (!this.collides(next, p.x + kx, p.y + ky)) {
        p.shape = next;
        p.x += kx;
        p.y += ky;
        this.emit('onSound', 'rotate');
        return;
      }
    }
  }

  softDrop() {
    if (!this.active()) return;
    const p = this.piece;
    if (!this.collides(p.shape, p.x, p.y + 1)) {
      p.y++;
      this.score += 1;
      this.dropAcc = 0;
      this.emit('onSound', 'softdrop');
      this.emit('onUpdate');
    } else {
      this.lock();
    }
  }

  hardDrop() {
    if (!this.active()) return;
    const p = this.piece;
    let d = 0;
    while (!this.collides(p.shape, p.x, p.y + 1)) { p.y++; d++; }
    this.score += d * 2;
    this.emit('onSound', 'harddrop');
    this.emit('onHardDrop');
    this.lock(true);
  }

  holdPiece() {
    if (!this.active() || !this.canHold) return;
    const cur = this.piece.type;
    this.canHold = false;
    this.emit('onSound', 'hold');
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this.spawn(h);
    } else {
      this.hold = cur;
      this.spawn();
    }
  }

  lock(silent = false) {
    const p = this.piece;
    let topOut = false;
    p.shape.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const gy = p.y + y;
      if (gy < 0) { topOut = true; return; }
      this.grid[gy][p.x + x] = p.type;
    }));
    if (!silent) this.emit('onSound', 'lock');
    this.piece = null;
    if (topOut) {
      this.over = true;
      this.emit('onGameOver');
      return;
    }

    const full = [];
    for (let y = 0; y < ROWS; y++) if (this.grid[y].every(Boolean)) full.push(y);
    if (full.length) {
      this.clearing = { rows: full, t: 0 };
      this.emit('onSound', 'clear', full.length);
      this.emit('onClear', full.length);
    } else {
      this.canHold = true;
      this.spawn();
    }
  }

  finishClear() {
    const rows = this.clearing.rows;
    this.grid = this.grid.filter((_, y) => !rows.includes(y));
    while (this.grid.length < ROWS) this.grid.unshift(Array(COLS).fill(null));
    const n = rows.length;
    this.score += LINE_SCORES[n] * this.level;
    const prevLevel = this.level;
    this.lines += n;
    this.level = Math.floor(this.lines / 10) + 1;
    if (this.level > prevLevel) this.emit('onLevelUp', this.level);
    this.clearing = null;
    this.canHold = true;
    this.spawn();
  }

  update(dt) {
    if (this.over || this.paused) return;
    if (this.clearing) {
      this.clearing.t += dt;
      if (this.clearing.t > 280) this.finishClear();
      return;
    }
    this.dropAcc += dt;
    if (this.dropAcc >= this.interval) {
      this.dropAcc = 0;
      const p = this.piece;
      if (!this.collides(p.shape, p.x, p.y + 1)) p.y++;
      else this.lock();
    }
  }
}

// ===== 렌더링 =====
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amt));
  const b = Math.min(255, Math.max(0, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

export function drawCell(ctx, x, y, size, color, alpha = 1) {
  ctx.globalAlpha = alpha;
  const px = x * size;
  const py = y * size;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, size - 2, size - 2);
  ctx.fillStyle = shade(color, 45);
  ctx.fillRect(px + 1, py + 1, size - 2, 4);
  ctx.fillStyle = shade(color, -50);
  ctx.fillRect(px + 1, py + size - 5, size - 2, 4);
  ctx.globalAlpha = 1;
}

export function renderBoard(ctx, game) {
  const size = ctx.canvas.width / COLS;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // 격자
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    ctx.beginPath(); ctx.moveTo(x * size + 0.5, 0); ctx.lineTo(x * size + 0.5, ROWS * size); ctx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    ctx.beginPath(); ctx.moveTo(0, y * size + 0.5); ctx.lineTo(COLS * size, y * size + 0.5); ctx.stroke();
  }

  const clearRows = game.clearing ? game.clearing.rows : [];
  const flash = game.clearing ? game.clearing.t / 280 : 0;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = game.grid[y][x];
      if (!t) continue;
      if (clearRows.includes(y)) {
        drawCell(ctx, x, y, size, '#ffffff', 1 - flash);
      } else {
        drawCell(ctx, x, y, size, COLORS[t]);
      }
    }
  }

  const p = game.piece;
  if (p) {
    p.shape.forEach((row, y) => row.forEach((v, x) => {
      if (v && p.y + y >= 0) drawCell(ctx, p.x + x, p.y + y, size, COLORS[p.type]);
    }));
  }
}

export function renderMini(ctx, types, size = 24, gap = 12) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const list = Array.isArray(types) ? types : [types];
  let oy = gap;
  list.forEach((type, idx) => {
    if (!type) return;
    const shape = SHAPES[type];
    // 실제로 채워진 영역만 계산해 가운데 정렬
    let minX = 9, maxX = -1, minY = 9, maxY = -1;
    shape.forEach((r, y) => r.forEach((v, x) => {
      if (v) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    }));
    const s = idx === 0 ? size : size * 0.75;
    const w = (maxX - minX + 1) * s;
    const h = (maxY - minY + 1) * s;
    const ox = (ctx.canvas.width - w) / 2;
    ctx.save();
    ctx.translate(ox, oy);
    shape.forEach((r, y) => r.forEach((v, x) => {
      if (v) drawCell(ctx, x - minX, y - minY, s, COLORS[type]);
    }));
    ctx.restore();
    oy += h + gap;
  });
}
