import type { Faction, RoleId } from './types';

export interface RoleInfo {
  id: RoleId;
  /** ตัวไพ่ที่แทนบทบาท */
  rank: string;
  name: string;
  faction: Faction;
  /** หน้าที่แบบสั้น ใช้บนการ์ด */
  short: string;
  /** คำอธิบายเต็ม ใช้ในตารางสรุป/หน้าพิมพ์ */
  duty: string;
  /** สิ่งที่ต้องทำตอนกลางคืน (null = ไม่มี action) */
  nightAction: string | null;
  /** เคล็ดลับสั้น ๆ */
  tip: string;
  /** ตัวอักษรย่อบนหลังการ์ด */
  glyph: string;
}

export const ROLES: Record<RoleId, RoleInfo> = {
  KILLER: {
    id: 'KILLER',
    rank: 'K',
    name: 'Killer (ฆาตกร)',
    faction: 'EVIL',
    short: 'ลอบฆ่าคืนละ 1 คน',
    duty: 'ลอบกำจัดผู้เล่นคนอื่นคืนละ 1 คน และกลืนไปกับชาวบ้านตอนกลางวัน',
    nightAction: 'ชี้เลือกเหยื่อ 1 คนที่ต้องการฆ่า',
    tip: 'อย่าเงียบเกินไปและอย่ากล่าวหาคนอื่นแรงเกินไป ลองเก็บคนที่น่าจะเป็นตำรวจก่อน',
    glyph: '♠',
  },
  POLICE: {
    id: 'POLICE',
    rank: 'A',
    name: 'ตำรวจ (นักสืบ)',
    faction: 'GOOD',
    short: 'สืบได้คืนละ 1 คน',
    duty: 'สืบว่าคนที่สงสัยเป็น Killer หรือไม่ แล้วนำข้อมูลมาปกป้องประชาชน',
    nightAction: 'ชี้ตัวคนที่สงสัย จะได้คำตอบว่า "ใช่ / ไม่ใช่" Killer',
    tip: 'อย่ารีบเปิดตัววันแรก เก็บข้อมูล 2–3 คืนแล้วค่อยเปิดตอนจำเป็น',
    glyph: '♦',
  },
  NUN: {
    id: 'NUN',
    rank: 'Q',
    name: 'แม่ชี',
    faction: 'GOOD',
    short: 'รักษาคืนละ 1 คน',
    duty: 'ชุบชีวิต/รักษาผู้เล่น 1 คน ถ้าตรงกับเหยื่อของ Killer คนนั้นจะไม่ตาย',
    nightAction: 'ชี้เลือกคนที่ต้องการรักษา (เลือกตัวเองได้ตามกติกาห้อง)',
    tip: 'สังเกตว่าใครกำลังจะเป็นเป้า เช่น คนที่เพิ่งอ้างตัวเป็นตำรวจ',
    glyph: '♥',
  },
  THIEF: {
    id: 'THIEF',
    rank: 'J',
    name: 'โจร',
    faction: 'GOOD',
    short: 'ปี้ 1 คน — โดนแม่ชี = ศีลขาด',
    duty: 'เลือก "ปี้" ผู้เล่น 1 คน ถ้าโดนตัวแม่ชี แม่ชีจะศีลขาดและรักษาใครไม่ได้ในคืนนั้น',
    nightAction: 'ชี้เลือกคนที่ต้องการปี้ (ถ้าไม่โดนแม่ชี จะไม่มีอะไรเกิดขึ้น)',
    tip: 'คนที่เงียบและดูปลอดภัยมักเป็นแม่ชี เลี่ยงชี้กลุ่มนั้น และอย่าเปิดเผยตัวเอง',
    glyph: '♣',
  },
  VILLAGER: {
    id: 'VILLAGER',
    rank: '2–10',
    name: 'ประชาชน (ชาวบ้าน)',
    faction: 'GOOD',
    short: 'ไม่มีพลังพิเศษ ใช้การโหวต',
    duty: 'สังเกต พูดคุย จับผิด และโหวตเสียงข้างมากเพื่อกำจัดคนที่น่าสงสัย',
    nightAction: null,
    tip: 'จำให้ได้ว่าใครโหวตใคร รูปแบบการโหวตมักเปิดเผยตัว Killer ได้ดีกว่าคำพูด',
    glyph: '✦',
  },
};

export const ROLE_ORDER: RoleId[] = ['KILLER', 'POLICE', 'NUN', 'THIEF', 'VILLAGER'];

export const MIN_PLAYERS = 6;
export const MAX_PLAYERS = 12;

export interface DeckComposition {
  KILLER: number;
  POLICE: number;
  NUN: number;
  THIEF: number;
  VILLAGER: number;
}

/**
 * จำนวนไพ่ตามจำนวน "ผู้เล่นที่ได้รับไพ่" (ไม่นับพิธีกรที่เป็นคนจริง) ตาม rule.md
 * 6–8 คน → Killer 1 ใบ, 9–12 คน → Killer 2 ใบ
 */
export function deckFor(playerCount: number): DeckComposition {
  const killers = playerCount >= 9 ? 2 : 1;
  const special = killers + 3; // killer(s) + police + nun + thief
  return {
    KILLER: killers,
    POLICE: 1,
    NUN: 1,
    THIEF: 1,
    VILLAGER: Math.max(0, playerCount - special),
  };
}

/** ตรวจว่าจำนวนผู้เล่นที่รับไพ่นี้เล่นได้ไหม */
export function validateCount(playerCount: number): string | null {
  if (playerCount < MIN_PLAYERS) return `ต้องมีผู้เล่นที่รับไพ่อย่างน้อย ${MIN_PLAYERS} คน (ตอนนี้ ${playerCount} คน)`;
  if (playerCount > MAX_PLAYERS) return `ผู้เล่นที่รับไพ่ได้สูงสุด ${MAX_PLAYERS} คน (ตอนนี้ ${playerCount} คน)`;
  return null;
}

const SUITS = ['♠', '♥', '♦', '♣'];
const VILLAGER_RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10'];

/** สร้างกอง "ไพ่จริง" ให้ตรงกับ composition เพื่อใช้แสดงตอนจั่วการ์ด */
export function buildDeck(comp: DeckComposition): Array<{ role: RoleId; card: string }> {
  const deck: Array<{ role: RoleId; card: string }> = [];
  const push = (role: RoleId, rank: string, i: number) => deck.push({ role, card: `${rank}${SUITS[i % SUITS.length]}` });
  for (let i = 0; i < comp.KILLER; i++) push('KILLER', 'K', i);
  for (let i = 0; i < comp.POLICE; i++) push('POLICE', 'A', i);
  for (let i = 0; i < comp.NUN; i++) push('NUN', 'Q', i);
  for (let i = 0; i < comp.THIEF; i++) push('THIEF', 'J', i);
  for (let i = 0; i < comp.VILLAGER; i++) {
    push('VILLAGER', VILLAGER_RANKS[i % VILLAGER_RANKS.length], Math.floor(i / VILLAGER_RANKS.length) + i);
  }
  return deck;
}

/** Fisher–Yates — รับ rng เข้ามาเพื่อให้ทดสอบซ้ำได้ */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
