/**
 * แต่งเพลงประกอบเกม Killer แล้ว render เป็นไฟล์ .mp3
 *
 * เพลงทุกเพลงแต่งขึ้นใหม่ในไฟล์นี้ด้วยการสังเคราะห์เสียงล้วน ๆ ไม่ได้หยิบงานใครมา
 * จึงไม่มีปัญหาลิขสิทธิ์ และแก้เพลงได้โดยแก้ที่ไฟล์นี้แล้วรัน `npm run music`
 *
 *   node tools/compose-music.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SR, foldTail, kick, noise, normalise, note, pluck, reverb, stereoBuf, synth, toWav } from './synth.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'audio');
const TMP = join(ROOT, '.music-tmp');

const n = note;
const CHORDS = {
  Am: ['A3', 'C4', 'E4'],
  F:  ['F3', 'A3', 'C4'],
  Dm: ['D3', 'F3', 'A3'],
  E:  ['E3', 'G#3', 'B3'],
  G:  ['G3', 'B3', 'D4'],
  C:  ['C4', 'E4', 'G4'],
};
const ROOT_OF = { Am: 'A1', F: 'F1', Dm: 'D2', E: 'E1', G: 'G1', C: 'C2' };

/* ============================ เพลงคลอกลางคืน ============================
   มืด อึดอัด โดรนทุ้ม + หัวใจเต้น + พิณห่าง ๆ  |  70 BPM, Am–F–Dm–E        */
function night() {
  const bpm = 70, beat = 60 / bpm, bar = beat * 4;
  const prog = ['Am', 'F', 'Dm', 'E'];
  const bars = 8, loop = bars * bar, tail = 3;
  const out = stereoBuf(loop + tail);

  for (let b = 0; b < bars + 1; b++) {
    const t = b * bar;
    const chord = prog[Math.floor(b / 2) % prog.length];

    // เบสทุ้มยาวค้างทั้งสองห้อง
    if (b % 2 === 0) {
      synth(out, { start: t, dur: bar * 2 + 0.6, freq: n(ROOT_OF[chord]), type: 'sine',
        gain: 0.5, a: 0.5, d: 0.6, s: 0.8, r: 1.4 });
    }

    // แพดคอร์ดเสียงคล้ำ
    CHORDS[chord].forEach((name, i) => {
      synth(out, { start: t + 0.08, dur: bar - 0.1, freq: n(name), type: 'saw',
        gain: 0.075, a: 0.9, d: 0.5, s: 0.65, r: 0.9, detune: 9,
        lp: 340, lpTo: 220, pan: 0.5 + (i - 1) * 0.22 });
    });

    // หัวใจเต้น — ตุบ..ตุบ ต้นห้อง
    kick(out, { start: t, gain: 0.34, from: 96, to: 38, dur: 0.34 });
    kick(out, { start: t + 0.3, gain: 0.2, from: 86, to: 36, dur: 0.3 });

    // พิณห่าง ๆ ลอยมาเป็นระยะ
    if (b % 2 === 1) {
      const notes = CHORDS[chord];
      pluck(out, { start: t + beat * 1.5, dur: 2.2, freq: n(notes[2]) * 2, gain: 0.15, pan: 0.72 });
      pluck(out, { start: t + beat * 2.5, dur: 2.4, freq: n(notes[1]) * 2, gain: 0.11, pan: 0.3 });
    }

    // ลมหวีดคลอ
    noise(out, { start: t, dur: bar, gain: 0.05, lp: 260, shape: 'swell' });
  }

  reverb(out, { mix: 0.34, decay: 0.76 });
  return { pcm: foldTail(out, loop, tail), seconds: loop };
}

/* ============================ เพลงคลอกลางวัน ============================
   โล่งขึ้นแต่ยังไม่วางใจ  |  84 BPM, Am–G–C–F                              */
function day() {
  const bpm = 84, beat = 60 / bpm, bar = beat * 4;
  const prog = ['Am', 'G', 'C', 'F'];
  const bars = 8, loop = bars * bar, tail = 2.5;
  const out = stereoBuf(loop + tail);

  for (let b = 0; b < bars + 1; b++) {
    const t = b * bar;
    const chord = prog[b % prog.length];

    synth(out, { start: t, dur: bar + 0.4, freq: n(ROOT_OF[chord]) * 2, type: 'triangle',
      gain: 0.26, a: 0.06, d: 0.5, s: 0.42, r: 0.5 });

    CHORDS[chord].forEach((name, i) => {
      synth(out, { start: t + 0.04, dur: bar - 0.06, freq: n(name), type: 'triangle',
        gain: 0.085, a: 0.35, d: 0.4, s: 0.6, r: 0.6, detune: 6,
        lp: 1500, pan: 0.5 + (i - 1) * 0.26 });
    });

    // ทำนองพิณเบา ๆ
    const mel = CHORDS[chord];
    pluck(out, { start: t + beat * 0.5, dur: 1.5, freq: n(mel[2]) * 2, gain: 0.13, pan: 0.62 });
    pluck(out, { start: t + beat * 2, dur: 1.4, freq: n(mel[0]) * 2, gain: 0.1, pan: 0.38 });
    if (b % 2 === 1) pluck(out, { start: t + beat * 3.5, dur: 1.2, freq: n(mel[1]) * 2, gain: 0.09, pan: 0.55 });

    // ไม้เขย่าเบา ๆ ทุกครึ่งจังหวะ
    for (let k = 0; k < 8; k++) {
      noise(out, { start: t + k * beat * 0.5, dur: 0.07, gain: k % 2 ? 0.035 : 0.055, lp: 9000, hp: 3500 });
    }
  }

  reverb(out, { mix: 0.22, decay: 0.66 });
  return { pcm: foldTail(out, loop, tail), seconds: loop };
}

/* ============================ เพลงคลอช่วงโหวต ============================
   กดดัน เร่งเร้า เบสกระแทกเป็นเขบ็ต + เข็มนาฬิกา  |  100 BPM               */
function vote() {
  const bpm = 100, beat = 60 / bpm, bar = beat * 4;
  const bars = 8, loop = bars * bar, tail = 2;
  const out = stereoBuf(loop + tail);
  const walk = ['A1', 'A1', 'A1', 'C2', 'A1', 'A1', 'G1', 'E1'];

  for (let b = 0; b < bars + 1; b++) {
    const t = b * bar;
    const root = walk[b % walk.length];

    // เบสเขบ็ตกระแทกตลอด
    for (let k = 0; k < 8; k++) {
      synth(out, { start: t + k * beat * 0.5, dur: beat * 0.42, freq: n(root), type: 'square',
        gain: k % 2 ? 0.11 : 0.19, a: 0.004, d: 0.1, s: 0.25, r: 0.08, lp: 420 });
    }

    // แพดค้างสร้างความอึดอัด
    ['A3', 'C4', 'E4'].forEach((name, i) => {
      synth(out, { start: t, dur: bar, freq: n(name), type: 'saw',
        gain: 0.055, a: 0.5, d: 0.4, s: 0.7, r: 0.4, detune: 12, lp: 620, pan: 0.5 + (i - 1) * 0.24 });
    });

    // เข็มนาฬิกาทุกจังหวะ
    for (let k = 0; k < 4; k++) {
      noise(out, { start: t + k * beat, dur: 0.045, gain: 0.1, lp: 11000, hp: 4500, pan: k % 2 ? 0.66 : 0.34 });
    }

    // หัวใจเต้นเร็วกว่ากลางคืน
    kick(out, { start: t, gain: 0.4, from: 104, to: 40, dur: 0.3 });
    kick(out, { start: t + beat * 0.55, gain: 0.26, from: 92, to: 38, dur: 0.26 });
    kick(out, { start: t + beat * 2, gain: 0.4, from: 104, to: 40, dur: 0.3 });
    kick(out, { start: t + beat * 2.55, gain: 0.26, from: 92, to: 38, dur: 0.26 });
  }

  reverb(out, { mix: 0.18, decay: 0.6 });
  return { pcm: foldTail(out, loop, tail), seconds: loop };
}

/* ============================ เพลงเปิดเกม ============================
   ตูม → เสียงไต่ขึ้น → อาร์เพจจิโอ → ลงคอร์ด Am                          */
function start() {
  const out = stereoBuf(8);

  kick(out, { start: 0, gain: 0.85, from: 150, to: 32, dur: 1.5 });
  noise(out, { start: 0, dur: 1.1, gain: 0.3, lp: 700 });
  // เสียงไต่ขึ้นก่อนเข้าคอร์ด
  noise(out, { start: 0.5, dur: 2.0, gain: 0.12, lp: 4200, hp: 900, shape: 'swell' });
  synth(out, { start: 0.4, dur: 2.2, freq: n('A2'), freqTo: n('A3'), type: 'saw',
    gain: 0.1, a: 1.5, d: 0.3, s: 0.8, r: 0.4, detune: 14, lp: 300, lpTo: 1100 });

  // อาร์เพจจิโอไต่ขึ้น
  ['A3', 'C4', 'E4', 'A4', 'C5', 'E5'].forEach((name, i) => {
    pluck(out, { start: 1.25 + i * 0.135, dur: 2.4, freq: n(name), gain: 0.3, pan: 0.32 + i * 0.07 });
  });

  // คอร์ด Am ลงหนัก
  kick(out, { start: 2.5, gain: 0.7, from: 140, to: 34, dur: 1.6 });
  ['A2', 'A3', 'C4', 'E4'].forEach((name, i) => {
    synth(out, { start: 2.5, dur: 4.2, freq: n(name), type: i === 0 ? 'sine' : 'saw',
      gain: i === 0 ? 0.42 : 0.1, a: 0.02, d: 1.2, s: 0.45, r: 2.2, detune: i ? 10 : 0,
      lp: i === 0 ? null : 900, pan: 0.5 + (i - 1.5) * 0.16 });
  });
  pluck(out, { start: 2.52, dur: 3.6, freq: n('A5'), gain: 0.22, pan: 0.5 });

  reverb(out, { mix: 0.3, decay: 0.74 });
  return { pcm: out, seconds: 8 };
}

/* ============================ เสียงสั้น ๆ ตามจังหวะเกม ============================ */

function daybreak() {
  const out = stereoBuf(3.4);
  ['C4', 'E4', 'G4', 'C5'].forEach((name, i) => {
    synth(out, { start: 0.02 + i * 0.075, dur: 2.4, freq: n(name), type: 'triangle',
      gain: 0.16, a: 0.03, d: 0.5, s: 0.4, r: 1.3, pan: 0.34 + i * 0.11 });
    pluck(out, { start: 0.02 + i * 0.075, dur: 1.8, freq: n(name) * 2, gain: 0.12, pan: 0.5 });
  });
  noise(out, { start: 0, dur: 1.2, gain: 0.05, lp: 9000, hp: 3000, shape: 'swell' });
  reverb(out, { mix: 0.26, decay: 0.7 });
  return { pcm: out, seconds: 3.4 };
}

function death() {
  const out = stereoBuf(3.8);
  kick(out, { start: 0, gain: 0.9, from: 120, to: 28, dur: 2.0 });
  noise(out, { start: 0, dur: 1.4, gain: 0.26, lp: 420 });
  // คอร์ดลดเสียงลง ให้รู้สึกหนัก
  ['A2', 'C3', 'D#3'].forEach((name, i) => {
    synth(out, { start: 0.1, dur: 3.2, freq: n(name), freqTo: n(name) * 0.97, type: 'saw',
      gain: 0.1, a: 0.08, d: 0.9, s: 0.4, r: 1.8, detune: 16, lp: 520, pan: 0.5 + (i - 1) * 0.2 });
  });
  reverb(out, { mix: 0.34, decay: 0.78 });
  return { pcm: out, seconds: 3.8 };
}

function eliminate() {
  const out = stereoBuf(2.6);
  kick(out, { start: 0, gain: 0.7, from: 170, to: 45, dur: 1.1 });
  noise(out, { start: 0, dur: 0.6, gain: 0.2, lp: 1400 });
  synth(out, { start: 0.04, dur: 1.8, freq: n('E3'), freqTo: n('A2'), type: 'triangle',
    gain: 0.2, a: 0.01, d: 0.6, s: 0.3, r: 1.0, lp: 900 });
  reverb(out, { mix: 0.24, decay: 0.68 });
  return { pcm: out, seconds: 2.6 };
}

function winGood() {
  const out = stereoBuf(6);
  // C – G – Am – C เมเจอร์ สว่าง
  [['C3', 'E4', 'G4'], ['G3', 'D4', 'B4'], ['A3', 'E4', 'C5'], ['C4', 'G4', 'E5']].forEach((chord, b) => {
    const t = b * 0.75;
    chord.forEach((name, i) => {
      synth(out, { start: t, dur: b === 3 ? 3.4 : 0.95, freq: n(name), type: 'triangle',
        gain: 0.13, a: 0.02, d: 0.35, s: 0.55, r: b === 3 ? 2.2 : 0.35, pan: 0.36 + i * 0.14 });
      pluck(out, { start: t, dur: 1.6, freq: n(name) * 2, gain: 0.11, pan: 0.5 });
    });
    kick(out, { start: t, gain: 0.34, from: 130, to: 45, dur: 0.4 });
  });
  reverb(out, { mix: 0.28, decay: 0.72 });
  return { pcm: out, seconds: 6 };
}

function winEvil() {
  const out = stereoBuf(6.5);
  kick(out, { start: 0, gain: 0.85, from: 140, to: 30, dur: 1.8 });
  noise(out, { start: 0, dur: 1.6, gain: 0.2, lp: 500 });
  // Am – F – Dm – E ทุ้มหนัก จบด้วย Am
  [['A2', 'C3', 'E3'], ['F2', 'A2', 'C3'], ['D2', 'F2', 'A2'], ['E2', 'G#2', 'B2'], ['A1', 'A2', 'C3', 'E3']]
    .forEach((chord, b) => {
      const t = b * 0.85;
      const last = b === 4;
      chord.forEach((name, i) => {
        synth(out, { start: t, dur: last ? 3.6 : 1.0, freq: n(name), type: 'saw',
          gain: last && i === 0 ? 0.34 : 0.085, a: 0.03, d: 0.4, s: 0.6, r: last ? 2.4 : 0.4,
          detune: 14, lp: last && i === 0 ? null : 620, pan: 0.5 + (i - 1) * 0.2 });
      });
      if (last) kick(out, { start: t, gain: 0.7, from: 130, to: 28, dur: 2.0 });
    });
  reverb(out, { mix: 0.32, decay: 0.78 });
  return { pcm: out, seconds: 6.5 };
}

/* ============================ render ============================ */

const TRACKS = {
  'start': { make: start, kbps: 112 },
  'night': { make: night, kbps: 112 },
  'day': { make: day, kbps: 112 },
  'vote': { make: vote, kbps: 112 },
  'daybreak': { make: daybreak, kbps: 96 },
  'death': { make: death, kbps: 96 },
  'eliminate': { make: eliminate, kbps: 96 },
  'win-good': { make: winGood, kbps: 112 },
  'win-evil': { make: winEvil, kbps: 112 },
};

let ffmpeg;
try {
  ffmpeg = (await import('@ffmpeg-installer/ffmpeg')).default.path;
} catch {
  console.error(
    'ต้องมี ffmpeg ก่อนจึงจะ render เพลงได้ — ติดตั้งชั่วคราวด้วย:\n' +
      '  npm i --no-save @ffmpeg-installer/ffmpeg\n' +
      '(ไม่ได้ใส่ไว้ใน devDependencies เพราะใช้เฉพาะตอนแต่งเพลงใหม่ และไฟล์ใหญ่ ~30 MB)',
  );
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

console.log('ชื่อไฟล์        ยาว(วิ)  peak  ขนาด');
for (const [name, { make, kbps }] of Object.entries(TRACKS)) {
  const { pcm, seconds } = make();
  const { peak } = normalise(pcm, 0.89);
  const wav = join(TMP, `${name}.wav`);
  const mp3 = join(OUT, `${name}.mp3`);
  writeFileSync(wav, toWav(pcm));
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame',
    '-b:a', `${kbps}k`, '-ar', String(SR), mp3]);
  const size = (await import('node:fs')).statSync(mp3).size;
  console.log(
    `${name.padEnd(14)} ${seconds.toFixed(1).padStart(6)}  ${peak.toFixed(2).padStart(4)}  ${(size / 1024).toFixed(0).padStart(4)} KB`,
  );
}
rmSync(TMP, { recursive: true, force: true });
console.log('\nเขียนไฟล์ลง public/audio/ เรียบร้อย');
