/** ชนิดข้อมูลกลางที่ใช้ร่วมกันระหว่าง client (React) และ server (Cloudflare Worker / Durable Object) */

export type RoleId = 'KILLER' | 'POLICE' | 'NUN' | 'THIEF' | 'VILLAGER';

/** ฝ่ายที่ใช้ตัดสินเงื่อนไขการชนะ */
export type Faction = 'GOOD' | 'EVIL';

/** โหมดผู้ดำเนินเกม — เลือกตอนสร้างห้อง */
export type ModeratorMode =
  /** มีคนจริงเป็นพิธีกร ไม่ได้รับไพ่ และเป็นคนกดเดินเกมเอง */
  | 'HUMAN'
  /** ระบบเดินเกมให้อัตโนมัติ ทุกคนได้รับไพ่และได้เล่น */
  | 'AUTO';

export type Phase =
  | 'LOBBY'
  | 'DEALING'
  | 'NIGHT'
  | 'DAY_REPORT'
  | 'DISCUSSION'
  | 'VOTE'
  | 'VOTE_RESULT'
  | 'ENDED';

export type DeathCause = 'KILLED' | 'VOTED';

export interface RoomSettings {
  moderatorMode: ModeratorMode;
  /** แม่ชีรักษาตัวเองได้กี่ครั้งต่อเกม (0 = ห้าม, -1 = ไม่จำกัด) */
  nunSelfHealLimit: number;
  /** เปิดไพ่ของผู้เล่นที่ตาย/ถูกโหวตออกให้ทุกคนเห็นหรือไม่ */
  revealRoleOnDeath: boolean;
  /** วินาทีของช่วงอภิปราย (0 = ไม่จับเวลา) */
  discussionSeconds: number;
  /**
   * วินาทีของช่วงกลางคืนทั้งช่วง (0 = ไม่จับเวลา)
   * ทุกบทบาทลืมตาพร้อมกันและใช้เวลาชุดนี้ร่วมกัน ไม่ได้เรียกทีละบทบาท
   */
  nightSeconds: number;
}

export const DEFAULT_SETTINGS: RoomSettings = {
  moderatorMode: 'HUMAN',
  nunSelfHealLimit: 1,
  revealRoleOnDeath: false,
  discussionSeconds: 180,
  nightSeconds: 45,
};

export interface Player {
  id: string;
  name: string;
  /** เป็นเจ้าของห้อง (คนสร้าง) */
  isHost: boolean;
  /** เป็นพิธีกร — ในโหมด HUMAN คือคนที่ไม่ได้รับไพ่ */
  isModerator: boolean;
  connected: boolean;
  alive: boolean;
  /** บทบาทจริง ส่งให้เฉพาะเจ้าตัว พิธีกร และตอนจบเกมเท่านั้น */
  role: RoleId | null;
  /** ไพ่ที่จั่วได้ เช่น 'K♠' ใช้โชว์ตอนแอนิเมชันจั่วไพ่ */
  card: string | null;
  deathCause: DeathCause | null;
  deathRound: number | null;
  seat: number;
}

/** สิ่งที่แต่ละบทบาทเลือกในคืนหนึ่ง (เก็บฝั่ง server เท่านั้น) */
export interface NightActions {
  /** killerId -> targetId (คิลเลอร์ 2 คนต้องเลือกตรงกัน) */
  killVotes: Record<string, string>;
  policeTarget: string | null;
  nunTarget: string | null;
  thiefTarget: string | null;
}

/** บันทึกผลของคืน ใช้เป็น "note สรุปให้พิธีกรอ่าน" */
export interface NightReport {
  round: number;
  killTargetId: string | null;
  killTargetName: string | null;
  /** คิลเลอร์เลือกไม่ตรงกัน/ไม่ได้เลือก จึงไม่มีใครถูกลอบฆ่า */
  killersDisagreed: boolean;
  policeTargetId: string | null;
  policeTargetName: string | null;
  /** ผลที่พิธีกรพยักหน้า/ส่ายหน้าให้ตำรวจ */
  policeCorrect: boolean | null;
  nunTargetId: string | null;
  nunTargetName: string | null;
  nunHealedSelf: boolean;
  /** แม่ชีเลือกตรงกับเหยื่อของคิลเลอร์ */
  nunHealedVictim: boolean;
  thiefTargetId: string | null;
  thiefTargetName: string | null;
  /** โจรปี้โดนแม่ชี → ศีลขาด รักษาไม่ขึ้น */
  nunDisabled: boolean;
  /** คนที่ตายจริงในคืนนี้ (null = ไม่มีใครตาย) */
  deadPlayerId: string | null;
  deadPlayerName: string | null;
  /** ประโยคสรุปภาษาไทยสำหรับพิธีกรอ่าน */
  lines: string[];
}

export interface VoteReport {
  round: number;
  /** voterId -> targetId ('SKIP' = งดออกเสียง) */
  votes: Record<string, string>;
  tally: Array<{ playerId: string; name: string; count: number }>;
  eliminatedId: string | null;
  eliminatedName: string | null;
  /** คะแนนเสมอ — รอบนี้เป็นการโหวตแก้ตัวรอบสอง */
  tied: boolean;
  /** เสมอซ้ำ ไม่มีใครถูกกำจัด */
  noElimination: boolean;
  lines: string[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
  /** ข้อความจากระบบ/พิธีกร */
  system?: boolean;
  /** ห้องแชทลับ: 'ALL' | 'KILLER' | 'DEAD' */
  channel: 'ALL' | 'KILLER' | 'DEAD';
}

export interface Winner {
  faction: Faction;
  reason: string;
}

/** สถานะที่ server ส่งให้ client — ตัดข้อมูลลับตามสิทธิ์ของผู้รับแล้ว */
export interface RoomView {
  code: string;
  settings: RoomSettings;
  phase: Phase;
  round: number;
  players: Player[];
  /** id ของผู้รับ view นี้ */
  youId: string;
  /** บทบาทของผู้รับ (null ถ้ายังไม่แจกไพ่ หรือเป็นพิธีกร) */
  yourRole: RoleId | null;
  yourCard: string | null;
  /** true เมื่อผู้รับคือพิธีกร → เห็นบทบาททุกคนและปุ่มควบคุม */
  isModerator: boolean;
  /**
   * กลางคืน = ปิดกล้อง/บังคับ mute และซ่อนสถานะ "ใครกำลังทำอะไร" ของผู้เล่น
   * เพื่อไม่ให้ระบุตัวตนได้ พิธีกรเท่านั้นที่เห็น
   */
  privacyLock: boolean;
  /** ผู้รับ view นี้มีบทบาทที่ต้องทำ action ตอนกลางคืนหรือไม่ */
  youHaveNightAction: boolean;
  /** เป้าหมายที่ผู้รับเลือกไว้ในคืนนี้ (null = ยังไม่เลือก) */
  yourNightTarget: string | null;
  /** ผู้รับเลือกไปแล้วและแก้ไม่ได้อีกในรอบนี้ (ตำรวจสืบได้รอบละ 1 ครั้ง) */
  yourActionLocked: boolean;
  /** ผู้เล่นที่ส่ง action ของคืนนี้แล้ว (เห็นเฉพาะพิธีกร) */
  submittedPlayerIds: string[];
  /** ผลตรวจของตำรวจในคืนนี้ ส่งให้เฉพาะตำรวจ */
  policeResult: { targetName: string; isKiller: boolean } | null;
  /** เพื่อนคิลเลอร์ ส่งให้เฉพาะคิลเลอร์ */
  fellowKillerIds: string[];
  /** ตัวเลือกที่คิลเลอร์แต่ละคนกดไว้ ส่งให้เฉพาะคิลเลอร์ */
  killVotes: Record<string, string>;
  /** note สรุปคืน สำหรับพิธีกร (ทุกคืน) — ผู้เล่นทั่วไปได้เฉพาะบรรทัดประกาศ */
  nightReports: NightReport[];
  voteReports: VoteReport[];
  /** บรรทัดประกาศสาธารณะที่ผู้เล่นทุกคนเห็นได้ */
  publicLog: string[];
  chat: ChatMessage[];
  winner: Winner | null;
  /** เวลาหมดเขตของเฟสปัจจุบัน (epoch ms) หรือ null ถ้าไม่จับเวลา */
  deadline: number | null;
  /** ผลไพ่ทุกคน เปิดตอนจบเกม */
  finalReveal: Array<{ playerId: string; name: string; role: RoleId; card: string }> | null;
}

/* ---------- Protocol: client → server ---------- */

export type ClientMessage =
  | { t: 'JOIN'; name: string; playerId: string; wantModerator?: boolean }
  | { t: 'SET_SETTINGS'; settings: Partial<RoomSettings> }
  | { t: 'CLAIM_MODERATOR'; playerId: string | null }
  | { t: 'KICK'; playerId: string }
  | { t: 'START_GAME' }
  | { t: 'DRAW_CARD' }
  | { t: 'BEGIN_NIGHT' }
  | { t: 'NIGHT_ACTION'; targetId: string | null }
  | { t: 'END_NIGHT' }
  | { t: 'OPEN_DISCUSSION' }
  | { t: 'OPEN_VOTE' }
  | { t: 'CAST_VOTE'; targetId: string }
  | { t: 'CLOSE_VOTE' }
  | { t: 'NEXT_ROUND' }
  | { t: 'CHAT'; text: string; channel: ChatMessage['channel'] }
  | { t: 'RESTART' }
  | { t: 'PING' };

/* ---------- Protocol: server → client ---------- */

export type ServerMessage =
  | { t: 'STATE'; view: RoomView }
  | { t: 'ERROR'; message: string }
  | { t: 'PONG' };
