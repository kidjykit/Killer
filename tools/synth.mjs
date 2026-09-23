/**
 * เครื่องสังเคราะห์เสียงเล็ก ๆ สำหรับแต่งเพลงประกอบเกม (รันบน Node ล้วน ไม่ต้องใช้เบราว์เซอร์)
 * ใช้โดย tools/compose-music.mjs
 */

export const SR = 44100;

export const buf = (seconds) => new Float32Array(Math.ceil(SR * seconds));

/* ---------------- โน้ต ---------------- */

const SEMITONE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** 'A3' -> 220 Hz */
export function note(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`โน้ตไม่ถูกต้อง: ${name}`);
  const semi = SEMITONE.indexOf(m[1]) + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((semi - 69) / 12);
}

/* ---------------- envelope ---------------- */

function adsr(i, n, a, d, s, r) {
  const A = a * SR, D = d * SR, R = r * SR;
  const body = Math.max(0, n - R);
  if (i < A) return i / Math.max(1, A);
  if (i < A + D) return 1 - (1 - s) * ((i - A) / Math.max(1, D));
  if (i < body) return s;
  return s * Math.max(0, 1 - (i - body) / Math.max(1, R));
}

/* ---------------- oscillators ---------------- */

function wave(type, phase) {
  switch (type) {
    case 'saw': return 2 * (phase - Math.floor(phase + 0.5));
    case 'square': return phase % 1 < 0.5 ? 1 : -1;
    case 'triangle': return 4 * Math.abs(phase - Math.floor(phase + 0.75) + 0.25) - 1;
    default: return Math.sin(2 * Math.PI * phase);
  }
}

/**
 * โน้ตหนึ่งตัว พร้อม lowpass ที่ขยับตาม envelope ได้
 * detune = จำนวน cent ที่ซ้อนอีกชั้นให้เสียงหนาขึ้น
 */
export function synth(out, {
  start, dur, freq, freqTo = null, type = 'sine', gain = 0.2,
  a = 0.01, d = 0.12, s = 0.7, r = 0.25, detune = 0, lp = null, lpTo = null, pan = 0.5,
}) {
  const n = Math.ceil(dur * SR);
  const i0 = Math.floor(start * SR);
  const voices = detune ? [0, detune, -detune] : [0];
  let ph = voices.map(() => 0), lpState = 0;
  const vg = gain / voices.length;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const f = freqTo ? freq * (freqTo / freq) ** t : freq;
    let v = 0;
    for (let k = 0; k < voices.length; k++) {
      ph[k] += (f * 2 ** (voices[k] / 1200)) / SR;
      v += wave(type, ph[k]);
    }
    v *= vg * adsr(i, n, a, d, s, r);

    if (lp) {
      const cut = lpTo ? lp * (lpTo / lp) ** t : lp;
      const k = 1 - Math.exp((-2 * Math.PI * cut) / SR);
      lpState += k * (v - lpState);
      v = lpState;
    }
    writeStereo(out, i0 + i, v, pan);
  }
}

/** สายดีด Karplus–Strong — ให้เสียงคล้ายพิณ/กีตาร์ ใช้ทำอาร์เพจจิโอ */
export function pluck(out, { start, dur, freq, gain = 0.25, damp = 0.5, pan = 0.5 }) {
  const n = Math.ceil(dur * SR);
  const i0 = Math.floor(start * SR);
  const len = Math.max(2, Math.round(SR / freq));
  const line = new Float32Array(len);
  for (let i = 0; i < len; i++) line[i] = Math.random() * 2 - 1;
  let p = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const cur = line[p];
    const avg = (cur + prev) * 0.5 * (1 - damp * 0.02);
    line[p] = avg;
    prev = cur;
    p = (p + 1) % len;
    const decay = Math.exp((-3.2 * i) / n);
    writeStereo(out, i0 + i, avg * gain * decay, pan);
  }
}

export function kick(out, { start, gain = 0.6, from = 130, to = 42, dur = 0.42 }) {
  synth(out, { start, dur, freq: from, freqTo: to, type: 'sine', gain, a: 0.002, d: dur, s: 0, r: 0.02 });
}

/** เสียงซ่า/ลม/ไม้เขย่า */
export function noise(out, { start, dur, gain = 0.15, lp = 6000, hp = 0, pan = 0.5, shape = 'decay' }) {
  const n = Math.ceil(dur * SR);
  const i0 = Math.floor(start * SR);
  let lpS = 0, hpS = 0, brown = 0;
  const klp = 1 - Math.exp((-2 * Math.PI * lp) / SR);
  const khp = hp ? 1 - Math.exp((-2 * Math.PI * hp) / SR) : 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    let v = lp < 900 ? brown * 3.5 : white;
    lpS += klp * (v - lpS);
    v = lpS;
    if (hp) { hpS += khp * (v - hpS); v -= hpS; }
    const env = shape === 'decay' ? Math.exp((-4 * i) / n) : Math.sin((Math.PI * i) / n);
    writeStereo(out, i0 + i, v * gain * env, pan);
  }
}

/* ---------------- mixing ---------------- */

/** out เป็น stereo interleaved [L,R,L,R,...] */
function writeStereo(out, frame, v, pan) {
  const i = frame * 2;
  if (i < 0 || i + 1 >= out.length) return;
  out[i] += v * Math.cos((pan * Math.PI) / 2);
  out[i + 1] += v * Math.sin((pan * Math.PI) / 2);
}

export const stereoBuf = (seconds) => new Float32Array(Math.ceil(SR * seconds) * 2);

/* ---------------- reverb (Schroeder) ---------------- */

export function reverb(out, { mix = 0.25, decay = 0.72 } = {}) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({
    d, buf: new Float32Array(d * 2), p: 0,
  }));
  const allpass = [225, 556].map((d) => ({ d, buf: new Float32Array(d * 2), p: 0 }));
  const frames = out.length / 2;

  for (let ch = 0; ch < 2; ch++) {
    for (const c of combs) { c.buf.fill(0); c.p = 0; }
    for (const ap of allpass) { ap.buf.fill(0); ap.p = 0; }
    for (let f = 0; f < frames; f++) {
      const idx = f * 2 + ch;
      const dry = out[idx];
      let wet = 0;
      for (const c of combs) {
        const o = c.buf[c.p];
        wet += o;
        c.buf[c.p] = dry + o * decay;
        c.p = (c.p + 1) % c.d;
      }
      wet /= combs.length;
      for (const ap of allpass) {
        const o = ap.buf[ap.p];
        const v = -wet + o;
        ap.buf[ap.p] = wet + o * 0.5;
        ap.p = (ap.p + 1) % ap.d;
        wet = v;
      }
      out[idx] = dry * (1 - mix) + wet * mix;
    }
  }
}

/* ---------------- loop ให้ต่อเนียน ---------------- */

/**
 * พับหางเสียง (reverb ที่ยังค้าง) กลับไปทบหัวเพลง
 * ทำให้วนลูปแล้วไม่มีรอยต่อ ไม่มีช่องเงียบ
 */
export function foldTail(out, loopSeconds, tailSeconds) {
  const loopFrames = Math.floor(loopSeconds * SR);
  const tailFrames = Math.floor(tailSeconds * SR);
  for (let f = 0; f < tailFrames; f++) {
    const src = (loopFrames + f) * 2;
    const dst = f * 2;
    if (src + 1 >= out.length) break;
    // จางหางลงขณะทบ เพื่อไม่ให้หัวเพลงดังผิดปกติ
    const w = 1 - f / tailFrames;
    out[dst] += out[src] * w;
    out[dst + 1] += out[src + 1] * w;
  }
  return out.subarray(0, loopFrames * 2);
}

/* ---------------- normalise + WAV ---------------- */

export function normalise(out, peakTarget = 0.89) {
  let peak = 0;
  for (const v of out) { const a = Math.abs(v); if (a > peak) peak = a; }
  if (peak === 0) return { peak: 0, gain: 1 };
  const g = peakTarget / peak;
  for (let i = 0; i < out.length; i++) out[i] *= g;
  return { peak, gain: g };
}

export function toWav(samples, channels = 2) {
  const n = samples.length;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(channels, 22); b.writeUInt32LE(SR, 24);
  b.writeUInt32LE(SR * channels * 2, 28); b.writeUInt16LE(channels * 2, 32);
  b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    b.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return b;
}
