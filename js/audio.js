// Web Audio API로 배경음과 효과음을 직접 합성합니다 (외부 음원 파일 없음).

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI 번호 → 주파수

// 오리지널 루프 (A 단조, 8분음표 단위). null = 쉼표
const LEAD = [
  76, null, 72, 74, 76, 79, 77, 76,  74, null, 71, 72, 74, 77, 76, 74,
  72, null, 69, 71, 72, 76, 74, 72,  71, 72, 74, 76, 74, null, null, null,
  81, null, 79, 77, 76, null, 72, 74, 77, null, 76, 74, 72, null, 71, 69,
  72, 71, 69, 71, 72, 74, 76, 79,  76, null, 74, null, 69, null, null, null,
];
const BASS = [
  45, 52, 45, 52, 45, 52, 45, 52,  43, 50, 43, 50, 43, 50, 43, 50,
  41, 48, 41, 48, 41, 48, 41, 48,  40, 47, 40, 47, 40, 47, 44, 47,
  45, 52, 45, 52, 45, 52, 45, 52,  41, 48, 41, 48, 41, 48, 41, 48,
  43, 50, 43, 50, 43, 50, 43, 50,  40, 47, 40, 47, 45, 45, 45, 45,
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = localStorage.getItem('sf_muted') === '1';
    this.bgmOn = false;
    this.step = 0;
    this.nextTime = 0;
    this.tempo = 132; // BPM
    this.timer = null;
  }

  // 브라우저 정책상 사용자 입력 이후에 AudioContext를 만들어야 함
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(this.ctx.destination);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.35;
    this.musicBus.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.8;
    this.sfxBus.connect(this.master);
  }

  setMuted(m) {
    this.muted = m;
    localStorage.setItem('sf_muted', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.6, this.ctx.currentTime, 0.02);
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }

  // 단일 음 재생
  tone({ freq, type = 'square', start, dur, vol = 0.3, bus, slideTo, attack = 0.005 }) {
    const ctx = this.ctx;
    const t = start ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise({ start, dur, vol = 0.3, filter = 1200 }) {
    const ctx = this.ctx;
    const t = start ?? ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
  }

  // ===== 배경음 =====
  startBgm() {
    if (!this.ctx || this.bgmOn) return;
    this.bgmOn = true;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopBgm() {
    this.bgmOn = false;
    clearInterval(this.timer);
    this.timer = null;
  }

  resetBgm() { this.step = 0; }

  setLevel(level) {
    this.tempo = Math.min(132 + (level - 1) * 6, 200);
  }

  schedule() {
    const spb = 60 / this.tempo / 2; // 8분음표 길이
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const i = this.step % LEAD.length;
      const lead = LEAD[i];
      if (lead) this.tone({ freq: NOTE(lead), type: 'square', start: this.nextTime, dur: spb * 0.9, vol: 0.12, bus: this.musicBus });
      const bass = BASS[i];
      if (bass) this.tone({ freq: NOTE(bass), type: 'triangle', start: this.nextTime, dur: spb * 0.95, vol: 0.35, bus: this.musicBus });
      // 하이햇 느낌
      if (i % 2 === 1) this.hat(this.nextTime);
      this.nextTime += spb;
      this.step++;
    }
  }

  hat(t) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.value = 0.08;
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(t);
  }

  // ===== 효과음 =====
  play(name, arg) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'move':
        this.tone({ freq: 220, type: 'square', dur: 0.035, vol: 0.08 });
        break;
      case 'rotate':
        this.tone({ freq: 520, type: 'triangle', dur: 0.06, vol: 0.18, slideTo: 780 });
        break;
      case 'softdrop':
        this.tone({ freq: 140, type: 'square', dur: 0.02, vol: 0.04 });
        break;
      case 'lock':
        this.tone({ freq: 120, type: 'sine', dur: 0.12, vol: 0.4, slideTo: 60 });
        this.noise({ dur: 0.05, vol: 0.12, filter: 900 });
        break;
      case 'harddrop':
        this.tone({ freq: 180, type: 'sine', dur: 0.18, vol: 0.5, slideTo: 45 });
        this.noise({ dur: 0.12, vol: 0.3, filter: 1500 });
        break;
      case 'hold':
        this.tone({ freq: 660, type: 'sine', dur: 0.06, vol: 0.18 });
        this.tone({ freq: 440, type: 'sine', start: t + 0.05, dur: 0.06, vol: 0.18 });
        break;
      case 'clear': {
        const n = arg || 1;
        const base = [72, 76, 79, 84, 88];
        const count = n === 4 ? 5 : n + 1;
        for (let i = 0; i < count; i++) {
          this.tone({ freq: NOTE(base[i] + (n === 4 ? 0 : -12 + n * 2)), type: n === 4 ? 'sawtooth' : 'square', start: t + i * 0.06, dur: 0.14, vol: 0.18 });
        }
        if (n === 4) this.noise({ start: t + 0.3, dur: 0.3, vol: 0.15, filter: 4000 });
        break;
      }
      case 'levelup':
        [67, 71, 74, 79].forEach((m, i) => this.tone({ freq: NOTE(m), type: 'triangle', start: t + i * 0.09, dur: 0.2, vol: 0.3 }));
        break;
      case 'gameover':
        [64, 60, 57, 52].forEach((m, i) => this.tone({ freq: NOTE(m), type: 'square', start: t + i * 0.22, dur: 0.3, vol: 0.2 }));
        this.tone({ freq: NOTE(40), type: 'sawtooth', start: t + 0.9, dur: 0.8, vol: 0.2, slideTo: NOTE(28) });
        break;
      case 'start':
        [60, 64, 67, 72].forEach((m, i) => this.tone({ freq: NOTE(m), type: 'square', start: t + i * 0.07, dur: 0.12, vol: 0.18 }));
        break;
      case 'click':
        this.tone({ freq: 880, type: 'sine', dur: 0.04, vol: 0.15 });
        break;
    }
  }
}
