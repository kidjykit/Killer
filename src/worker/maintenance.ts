import type { Phase } from '../shared/types';

/** สิ่งที่ต้องทำกับห้องที่ถูกทิ้งร้าง */
export type Maintenance =
  /** ยังไม่ต้องทำอะไร */
  | 'none'
  /** เกมค้างอยู่และไม่มีใครแตะมานาน → เด้งกลับล็อบบี้เพื่อให้เข้าเล่นใหม่ได้ */
  | 'reset'
  /** ร้างจนถึงกำหนด → ลบห้องทิ้งทั้งห้อง */
  | 'delete';

export interface IdlePolicy {
  /** เกมค้างเกินกี่มิลลิวินาที ให้เด้งกลับล็อบบี้ */
  resetMs: number;
  /** ร้างเกินกี่มิลลิวินาที ให้ลบทิ้ง */
  deleteMs: number;
}

/** ค่าเริ่มต้น: เกมค้าง 30 นาทีเด้งกลับล็อบบี้, ร้าง 1 ชั่วโมงลบทิ้ง */
export const DEFAULT_IDLE_POLICY: IdlePolicy = {
  resetMs: 30 * 60_000,
  deleteMs: 60 * 60_000,
};

/** อ่านนโยบายจากตัวแปรใน wrangler.toml (ตั้งค่าใหม่ได้โดยไม่ต้องแก้โค้ด) */
export function policyFromEnv(env: { ROOM_IDLE_RESET_SECONDS?: unknown; ROOM_IDLE_DELETE_SECONDS?: unknown }): IdlePolicy {
  const secs = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n * 1000 : fallback;
  };
  return {
    resetMs: secs(env.ROOM_IDLE_RESET_SECONDS, DEFAULT_IDLE_POLICY.resetMs),
    deleteMs: secs(env.ROOM_IDLE_DELETE_SECONDS, DEFAULT_IDLE_POLICY.deleteMs),
  };
}

/**
 * ตัดสินว่าห้องที่ไม่มีใครแตะมา idleMs มิลลิวินาที ควรโดนอะไร
 * การลบมาก่อนการรีเซ็ตเสมอ ถ้าถึงกำหนดลบแล้วก็ไม่ต้องรีเซ็ตให้เสียเวลา
 */
export function maintenanceDue(phase: Phase, idleMs: number, policy: IdlePolicy): Maintenance {
  if (idleMs >= policy.deleteMs) return 'delete';
  // ล็อบบี้ที่ว่างอยู่แล้วไม่มีอะไรให้รีเซ็ต รอโดนลบอย่างเดียว
  if (phase !== 'LOBBY' && idleMs >= policy.resetMs) return 'reset';
  return 'none';
}

/**
 * ครั้งต่อไปที่ต้องตื่นมาตรวจห้องนี้ (epoch ms)
 * ห้องที่กำลังเล่นอยู่ต้องตื่นมาตรวจตอนถึงกำหนดรีเซ็ตก่อน ห้องในล็อบบี้รอกำหนดลบได้เลย
 */
export function nextMaintenanceAt(phase: Phase, lastActivity: number, policy: IdlePolicy): number {
  const deleteAt = lastActivity + policy.deleteMs;
  if (phase === 'LOBBY') return deleteAt;
  return Math.min(lastActivity + policy.resetMs, deleteAt);
}
