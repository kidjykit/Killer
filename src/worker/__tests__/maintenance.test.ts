import { describe, expect, it } from 'vitest';
import {
  DEFAULT_IDLE_POLICY,
  maintenanceDue,
  nextMaintenanceAt,
  policyFromEnv,
} from '../maintenance';
import type { Phase } from '../../shared/types';

const MIN = 60_000;
const p = DEFAULT_IDLE_POLICY;

describe('maintenanceDue — ห้องที่ยังมีคนเล่นต้องไม่โดนแตะ', () => {
  it.each<Phase>(['LOBBY', 'DEALING', 'NIGHT', 'DAY_REPORT', 'DISCUSSION', 'VOTE', 'VOTE_RESULT', 'ENDED'])(
    'เฟส %s ที่เพิ่งมีความเคลื่อนไหว → ไม่ทำอะไร',
    (phase) => {
      expect(maintenanceDue(phase, 0, p)).toBe('none');
      expect(maintenanceDue(phase, 5 * MIN, p)).toBe('none');
      expect(maintenanceDue(phase, 29 * MIN, p)).toBe('none');
    },
  );

  it('เกมค้างครบ 30 นาที → เด้งกลับล็อบบี้', () => {
    expect(maintenanceDue('NIGHT', 30 * MIN, p)).toBe('reset');
    expect(maintenanceDue('VOTE', 45 * MIN, p)).toBe('reset');
    expect(maintenanceDue('ENDED', 59 * MIN, p)).toBe('reset');
  });

  it('ล็อบบี้ไม่ถูกรีเซ็ต รอโดนลบอย่างเดียว', () => {
    expect(maintenanceDue('LOBBY', 30 * MIN, p)).toBe('none');
    expect(maintenanceDue('LOBBY', 59 * MIN, p)).toBe('none');
    expect(maintenanceDue('LOBBY', 60 * MIN, p)).toBe('delete');
  });

  it('ร้างครบ 1 ชั่วโมง → ลบทิ้ง ไม่ว่าอยู่เฟสไหน', () => {
    for (const phase of ['LOBBY', 'NIGHT', 'VOTE', 'ENDED'] as Phase[]) {
      expect(maintenanceDue(phase, 60 * MIN, p)).toBe('delete');
      expect(maintenanceDue(phase, 3 * 60 * MIN, p)).toBe('delete');
    }
  });

  it('ถึงกำหนดลบแล้วต้องลบ ไม่ใช่รีเซ็ต', () => {
    expect(maintenanceDue('NIGHT', 60 * MIN, p)).toBe('delete');
  });
});

describe('nextMaintenanceAt — ตื่นมาตรวจตอนไหน', () => {
  const t0 = 1_000_000;

  it('ห้องที่กำลังเล่น ตื่นตอนถึงกำหนดรีเซ็ตก่อน', () => {
    expect(nextMaintenanceAt('NIGHT', t0, p)).toBe(t0 + 30 * MIN);
  });

  it('ห้องในล็อบบี้ ตื่นตอนถึงกำหนดลบ', () => {
    expect(nextMaintenanceAt('LOBBY', t0, p)).toBe(t0 + 60 * MIN);
  });

  it('ถ้าตั้งเวลารีเซ็ตไว้นานกว่าเวลาลบ ให้ยึดเวลาลบ', () => {
    const odd = { resetMs: 90 * MIN, deleteMs: 60 * MIN };
    expect(nextMaintenanceAt('NIGHT', t0, odd)).toBe(t0 + 60 * MIN);
  });
});

describe('policyFromEnv', () => {
  it('ไม่ได้ตั้งค่า → ใช้ค่าเริ่มต้น 30 นาที / 1 ชั่วโมง', () => {
    expect(policyFromEnv({})).toEqual(DEFAULT_IDLE_POLICY);
  });

  it('อ่านค่าเป็นวินาทีจาก env (รับทั้ง string และ number)', () => {
    expect(policyFromEnv({ ROOM_IDLE_RESET_SECONDS: '3', ROOM_IDLE_DELETE_SECONDS: 6 })).toEqual({
      resetMs: 3000,
      deleteMs: 6000,
    });
  });

  it('ค่าที่ใช้ไม่ได้ → ตกกลับไปใช้ค่าเริ่มต้น', () => {
    expect(policyFromEnv({ ROOM_IDLE_RESET_SECONDS: 'abc', ROOM_IDLE_DELETE_SECONDS: -5 })).toEqual(
      DEFAULT_IDLE_POLICY,
    );
  });
});
