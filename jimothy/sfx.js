// 효과음: 패 놓는 소리(바둑돌 소리 12개 중 무작위, 없으면 합성음), animalese 음성(치·퐁·깡·리치·노텐·텐파이)
// animalese.js © Josh Simmons, animalese.wav는 CC BY 4.0 (public/vendor/animalese/LICENSE.md)
const Sfx = (() => {
  const WORDS = { chi: 'tcy', pon: 'pom', kan: 'cam', riichi: 'ryty', dbriichi: 'daboru ryty', noten: 'no ten', tenpai: 'ten pay', ron: 'rom', tsumo: 'tumo', jimothy: 'zymosy' };
  const PITCH = [1.0, 0.8, 1.25, 1.55]; // 좌석마다 목소리 높이를 다르게
  let ctx = null, master = null, synth = null, sample = null, sampleSegs = [], sampleTried = false;
  let muted = false;
  try { muted = localStorage.getItem('jimothy-mute') === '1'; } catch { /* 저장소 사용 불가 */ }
  const voices = new Map(); // `${word}|${pitchIndex}` -> AudioBuffer

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function loadVoices() {
    if (synth || typeof Animalese === 'undefined') return;
    synth = new Animalese('vendor/animalese/animalese.wav', async () => {
      const c = ensure();
      if (!c) return;
      for (const [key, text] of Object.entries(WORDS)) {
        for (let p = 0; p < PITCH.length; p++) {
          try {
            const uri = synth.Animalese(text, false, PITCH[p]).dataURI;
            const buf = await (await fetch(uri)).arrayBuffer();
            voices.set(`${key}|${p}`, await c.decodeAudioData(buf));
          } catch { /* 이 소리만 건너뜀 */ }
        }
      }
    });
  }

  // 바둑돌 소리 한 파일(baduk2.mp3)에서 무음 구간으로 잘라 둔 12개 소리(baduk2.json: 시작·길이)를 불러온다
  async function loadSample() {
    if (sampleTried) return;
    sampleTried = true;
    try {
      const [buf, segs] = await Promise.all([
        fetch('sfx/baduk2.mp3').then((r) => { if (!r.ok) throw new Error('mp3'); return r.arrayBuffer(); }),
        fetch('sfx/baduk2.json').then((r) => { if (!r.ok) throw new Error('json'); return r.json(); }),
      ]);
      sample = await ensure().decodeAudioData(buf);
      sampleSegs = segs;
    } catch { /* 없으면 합성음을 쓴다 */ }
  }

  // 잘라 둔 소리 중 하나를 무작위로, 끝은 아주 짧게 줄여서 딱 끊기는 소리가 나지 않게 한다
  function playSegment() {
    const c = ensure();
    if (!c || !sample || !sampleSegs.length) return clack();
    const seg = sampleSegs[Math.floor(Math.random() * sampleSegs.length)];
    const rate = 0.97 + Math.random() * 0.06;
    const dur = seg.dur / rate;
    const s = c.createBufferSource();
    s.buffer = sample;
    s.playbackRate.value = rate;
    const g = c.createGain();
    const t = c.currentTime;
    g.gain.setValueAtTime(0.95, t);
    g.gain.setValueAtTime(0.95, t + Math.max(0, dur - 0.02));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    s.connect(g).connect(master);
    s.start(t, seg.start, seg.dur);
  }

  function play(buf, rate = 1, gain = 1) {
    const c = ensure();
    if (!c || !buf) return;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    const g = c.createGain();
    g.gain.value = gain;
    s.connect(g).connect(master);
    s.start();
  }

  // 패를 탁 놓는 소리를 합성: 짧은 잡음(딱) + 낮은 울림(툭) + 아주 짧은 두 번째 접촉
  function clack() {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const r = 0.92 + Math.random() * 0.16;
    const hit = (at, amp, f) => {
      const len = Math.floor(c.sampleRate * 0.05);
      const nb = c.createBuffer(1, len, c.sampleRate);
      const d = nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = c.createBufferSource();
      src.buffer = nb;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f * r; bp.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(amp, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.045);
      src.connect(bp).connect(g).connect(master);
      src.start(t + at);
    };
    hit(0, 0.9, 2400);
    hit(0.011, 0.45, 3600);
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(250 * r, t);
    o.frequency.exponentialRampToValueAtTime(85, t + 0.055);
    const og = c.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.075);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.09);
  }

  return {
    unlock() { ensure(); loadVoices(); loadSample(); },
    isMuted: () => muted,
    ready: () => ({ voices: voices.size, sample: !!sample, segments: sampleSegs.length }),
    setMuted(m) { muted = m; try { localStorage.setItem('jimothy-mute', m ? '1' : '0'); } catch { /* 무시 */ } },
    tile() {
      if (muted || (typeof Settings !== 'undefined' && !Settings.tileSound)) return;
      playSegment();
    },
    // word: chi pon kan riichi dbriichi noten tenpai ron tsumo jimothy, seat: 목소리 높이를 정하는 좌석
    voice(word, seat = 0) {
      if (muted || (typeof Settings !== 'undefined' && !Settings.voice)) return;
      play(voices.get(`${word}|${seat % PITCH.length}`), 1, 1);
    },
  };
})();
