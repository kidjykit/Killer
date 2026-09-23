/**
 * ดนตรีประกอบของเกม — สังเคราะห์สดด้วย Web Audio API ทั้งหมด ไม่มีไฟล์เสียงแนบ
 *
 * เหตุผลที่ไม่ใช้ไฟล์ mp3: ไม่ต้องกังวลเรื่องลิขสิทธิ์ ไม่เพิ่มขนาด bundle เลย
 * และเล่นได้ทันทีแม้เน็ตช้า ถ้าอยากเปลี่ยนไปใช้เพลงจริงภายหลัง ดูหมายเหตุท้ายไฟล์
 */

export type Ambience = 'none' | 'night' | 'day' | 'vote';

export type Cue =
  | 'gameStart'
  | 'dealCard'
  | 'nightFall'
  | 'dayBreak'
  | 'death'
  | 'noDeath'
  | 'voteOpen'
  | 'eliminate'
  | 'winGood'
  | 'winEvil';

const STORAGE_KEY = 'killer.audio';

/** โน้ตในบันไดเสียง A minor — ใช้ให้เสียงทุกตัวเข้ากันเป็นดนตรีเดียว */
const A2 = 110, C3 = 130.81, E3 = 164.81, A3 = 220, C4 = 261.63, E4 = 329.63, G4 = 392, A4 = 440, C5 = 523.25, E5 = 659.25;

interface ToneOptions {
  freq: number;
  /** ความยาวเสียงเป็นวินาที */
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** เริ่มเล่นหลังจากนี้กี่วินาที */
  delay?: number;
  attack?: number;
  /** ไถ่เสียงไปที่ความถี่นี้ (ใช้ทำเสียงหวูด/ทุ้มตก) */
  slideTo?: number;
  filter?: number;
}

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private stopAmbience: (() => void) | null = null;
  private ambience: Ambience = 'none';
  private noiseBuffer: AudioBuffer | null = null;
  private listeners = new Set<() => void>();
  private muted: boolean;
  private volume: number;

  constructor() {
    let muted = false;
    let volume = 0.35;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
        muted?: boolean;
        volume?: number;
      };
      if (typeof saved.muted === 'boolean') muted = saved.muted;
      if (typeof saved.volume === 'number') volume = Math.min(1, Math.max(0, saved.volume));
    } catch {
      /* โหมดส่วนตัว/บล็อก storage — ใช้ค่าเริ่มต้นไป */
    }
    this.muted = muted;
    this.volume = volume;
  }

  /* ---------------- สถานะที่ UI อ่านได้ ---------------- */

  isMuted() {
    return this.muted;
  }

  getVolume() {
    return this.volume;
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: this.muted, volume: this.volume }));
    } catch {
      /* บันทึกไม่ได้ก็ไม่เป็นไร เสียงยังทำงานปกติในรอบนี้ */
    }
    for (const fn of this.listeners) fn();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMasterGain();
    // ปิดเสียงแล้วหยุด ambience ไปเลย จะได้ไม่กิน CPU ทิ้งไว้เฉย ๆ
    if (muted) this.teardownAmbience();
    else if (this.ambience !== 'none') this.startAmbience(this.ambience);
    this.emit();
  }

  toggleMuted() {
    this.setMuted(!this.muted);
  }

  setVolume(volume: number) {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyMasterGain();
    this.emit();
  }

  /* ---------------- เครื่องเสียง ---------------- */

  /**
   * เบราว์เซอร์ห้ามเล่นเสียงก่อนผู้ใช้แตะจอ — ต้องเรียกอันนี้จากใน event ของการกดปุ่ม
   * เรียกซ้ำได้ ไม่มีผลข้างเคียง
   */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyMasterGain();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private applyMasterGain() {
    if (!this.ctx || !this.master) return;
    const target = this.muted ? 0 : this.volume;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private ready(): { ctx: AudioContext; master: GainNode } | null {
    if (this.muted || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return { ctx: this.ctx, master: this.master };
  }

  /** เสียงโน้ตเดี่ยว พร้อม envelope แบบ pluck (ดังเร็ว จางช้า) */
  private tone(o: ToneOptions) {
    const ready = this.ready();
    if (!ready) return;
    const { ctx, master } = ready;
    const t0 = ctx.currentTime + (o.delay ?? 0);
    const attack = o.attack ?? 0.012;
    const peak = o.gain ?? 0.2;

    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t0 + o.dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

    let tail: AudioNode = env;
    if (o.filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(o.filter, t0);
      env.connect(lp);
      tail = lp;
    }

    osc.connect(env);
    tail.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }

  /** เสียงลมหวีด/ซ่า ใช้ทำบรรยากาศและเสียงกระแทก */
  private noise(dur: number, cutoff: number, gain: number, delay = 0) {
    const ready = this.ready();
    if (!ready) return;
    const { ctx, master } = ready;
    const t0 = ctx.currentTime + delay;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(cutoff, t0);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(lp).connect(env).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  private getNoiseBuffer(ctx: AudioContext) {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // brown noise — นุ่มกว่า white noise ฟังนานแล้วไม่ล้าหู
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  /* ---------------- เสียงเฉพาะจังหวะของเกม ---------------- */

  play(cue: Cue) {
    if (this.muted) return;
    this.unlock();
    switch (cue) {
      // เริ่มเกม — อาร์เพจจิโอไต่ขึ้นแล้วลงคอร์ด A minor
      case 'gameStart':
        [A3, C4, E4, A4].forEach((f, i) =>
          this.tone({ freq: f, dur: 0.5, type: 'triangle', gain: 0.22, delay: i * 0.11 }),
        );
        [A3, C4, E4].forEach((f) =>
          this.tone({ freq: f, dur: 2.2, type: 'sine', gain: 0.16, delay: 0.46, attack: 0.05 }),
        );
        this.tone({ freq: A2, dur: 2.6, type: 'sine', gain: 0.22, delay: 0.46, attack: 0.08 });
        break;

      case 'dealCard':
        this.noise(0.16, 2600, 0.14);
        this.tone({ freq: E5, dur: 0.14, type: 'triangle', gain: 0.1, delay: 0.02 });
        break;

      // เข้าสู่กลางคืน — เสียงทุ้มไถ่ลง
      case 'nightFall':
        this.tone({ freq: A3, dur: 1.6, type: 'sine', gain: 0.24, slideTo: A2, attack: 0.06 });
        this.tone({ freq: E3, dur: 1.8, type: 'triangle', gain: 0.12, slideTo: C3, delay: 0.1 });
        this.noise(1.4, 700, 0.09);
        break;

      // เช้าแล้ว — คอร์ดสว่างไต่ขึ้น
      case 'dayBreak':
        [C4, E4, G4, C5].forEach((f, i) =>
          this.tone({ freq: f, dur: 1.1, type: 'triangle', gain: 0.17, delay: i * 0.07, attack: 0.03 }),
        );
        break;

      case 'death':
        this.tone({ freq: 90, dur: 1.3, type: 'sine', gain: 0.4, slideTo: 38, attack: 0.005 });
        this.noise(0.7, 420, 0.22);
        break;

      case 'noDeath':
        this.tone({ freq: E4, dur: 0.8, type: 'sine', gain: 0.16, attack: 0.04 });
        this.tone({ freq: A4, dur: 0.9, type: 'sine', gain: 0.12, delay: 0.09, attack: 0.04 });
        break;

      case 'voteOpen':
        this.tone({ freq: C5, dur: 0.16, type: 'square', gain: 0.07 });
        this.tone({ freq: C5, dur: 0.16, type: 'square', gain: 0.07, delay: 0.16 });
        break;

      case 'eliminate':
        this.tone({ freq: 160, dur: 0.9, type: 'triangle', gain: 0.3, slideTo: 60 });
        this.noise(0.5, 900, 0.16);
        break;

      // ฝ่ายประชาชนชนะ — คอร์ดเมเจอร์
      case 'winGood':
        [C4, E4, G4].forEach((f, i) =>
          this.tone({ freq: f, dur: 1.9, type: 'triangle', gain: 0.2, delay: i * 0.1, attack: 0.03 }),
        );
        this.tone({ freq: C5, dur: 2.1, type: 'sine', gain: 0.16, delay: 0.34 });
        break;

      // ฝ่าย Killer ชนะ — คอร์ดไมเนอร์ทุ้ม
      case 'winEvil':
        [A2, C3, E3].forEach((f, i) =>
          this.tone({ freq: f, dur: 2.4, type: 'sawtooth', gain: 0.13, delay: i * 0.12, attack: 0.05, filter: 700 }),
        );
        this.tone({ freq: A3, dur: 2.4, type: 'sine', gain: 0.14, delay: 0.36, slideTo: A2 });
        break;
    }
  }

  /* ---------------- เพลงคลอพื้นหลัง ---------------- */

  /** เปลี่ยนเพลงคลอตามช่วงเวลาในเกม เรียกซ้ำด้วยค่าเดิมได้ ไม่เริ่มใหม่ */
  setAmbience(next: Ambience) {
    if (next === this.ambience) return;
    this.ambience = next;
    this.startAmbience(next);
  }

  private startAmbience(mood: Ambience) {
    this.teardownAmbience();
    if (mood === 'none' || this.muted) return;
    this.unlock();
    const ready = this.ready();
    if (!ready) return;
    const { ctx, master } = ready;

    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, ctx.currentTime);
    bus.gain.exponentialRampToValueAtTime(mood === 'day' ? 0.09 : 0.16, ctx.currentTime + 1.2);
    bus.connect(master);

    const nodes: Array<OscillatorNode | AudioBufferSourceNode> = [];
    const timers: number[] = [];

    const drone = (freq: number, type: OscillatorType, gain: number) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, ctx.currentTime);
      osc.connect(g).connect(bus);
      osc.start();
      nodes.push(osc);
    };

    if (mood === 'night' || mood === 'vote') {
      // โดรนทุ้มสองตัวเพี้ยนกันเล็กน้อย ให้เกิดคลื่นเต้นช้า ๆ ฟังแล้วอึดอัด
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, ctx.currentTime);
      lp.connect(bus);

      for (const [f, g] of [[A2, 0.5] as const, [A2 * 1.004, 0.5] as const, [E3, 0.22] as const]) {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(g, ctx.currentTime);
        osc.connect(gn).connect(lp);
        osc.start();
        nodes.push(osc);
      }

      // LFO ขยับ cutoff ช้า ๆ ให้เสียงไม่นิ่งตาย
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.07, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(120, ctx.currentTime);
      lfo.connect(lfoGain).connect(lp.frequency);
      lfo.start();
      nodes.push(lfo);

      // ลมหวีดเบา ๆ วนไปเรื่อย
      const wind = ctx.createBufferSource();
      wind.buffer = this.getNoiseBuffer(ctx);
      wind.loop = true;
      const windLp = ctx.createBiquadFilter();
      windLp.type = 'lowpass';
      windLp.frequency.setValueAtTime(260, ctx.currentTime);
      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.05, ctx.currentTime);
      wind.connect(windLp).connect(windGain).connect(bus);
      wind.start();
      nodes.push(wind);

      // เสียงหัวใจเต้น — ตอนโหวตเต้นเร็วขึ้นเพื่อเร่งความกดดัน
      const period = mood === 'vote' ? 1100 : 2400;
      const beat = () => {
        this.tone({ freq: 58, dur: 0.3, type: 'sine', gain: 0.16, attack: 0.008 });
        this.tone({ freq: 52, dur: 0.26, type: 'sine', gain: 0.1, attack: 0.008, delay: 0.19 });
      };
      timers.push(window.setInterval(beat, period));
    } else if (mood === 'day') {
      // แพดอุ่น ๆ คอร์ด A minor ค้างไว้เบา ๆ
      drone(A3, 'triangle', 0.22);
      drone(C4, 'triangle', 0.16);
      drone(E4, 'sine', 0.12);

      const trem = ctx.createOscillator();
      trem.type = 'sine';
      trem.frequency.setValueAtTime(0.13, ctx.currentTime);
      const tremGain = ctx.createGain();
      tremGain.gain.setValueAtTime(0.03, ctx.currentTime);
      trem.connect(tremGain).connect(bus.gain);
      trem.start();
      nodes.push(trem);
    }

    this.stopAmbience = () => {
      const t = ctx.currentTime;
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      for (const id of timers) window.clearInterval(id);
      for (const n of nodes) {
        try {
          n.stop(t + 0.8);
        } catch {
          /* บางโหนดถูกหยุดไปแล้ว */
        }
      }
      window.setTimeout(() => bus.disconnect(), 1200);
    };
  }

  private teardownAmbience() {
    this.stopAmbience?.();
    this.stopAmbience = null;
  }

  /** หยุดทุกอย่าง ใช้ตอนออกจากห้อง */
  stopAll() {
    this.ambience = 'none';
    this.teardownAmbience();
  }
}

export const gameAudio = new GameAudio();

/*
 * อยากเปลี่ยนไปใช้ไฟล์เพลงจริงแทน?
 * วางไฟล์ไว้ใน public/audio/ แล้วแก้แค่ในไฟล์นี้ไฟล์เดียว:
 *   - play(cue)      → new Audio('/audio/<cue>.mp3').play()
 *   - setAmbience()  → <audio loop> ต่อเข้ากับ master gain เดิม
 * ส่วนที่เหลือของแอป (useGameAudio, ปุ่มเปิด/ปิดเสียง) ไม่ต้องแก้เลย
 */
