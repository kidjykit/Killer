import { describe, expect, it } from 'vitest';
import { checkWinner, resolveNight, tallyVotes } from '../engine';
import { buildDeck, deckFor } from '../roles';
import type { NightActions, Player, RoleId } from '../types';

const mk = (id: string, role: RoleId, alive = true): Player => ({
  id,
  name: id,
  isHost: false,
  isModerator: false,
  connected: true,
  alive,
  role,
  card: null,
  deathCause: null,
  deathRound: null,
  seat: 0,
});

const actions = (over: Partial<NightActions> = {}): NightActions => ({
  killVotes: {},
  policeTarget: null,
  nunTarget: null,
  thiefTarget: null,
  ...over,
});

const base = () => [mk('k1', 'KILLER'), mk('pol', 'POLICE'), mk('nun', 'NUN'), mk('thief', 'THIEF'), mk('v1', 'VILLAGER'), mk('v2', 'VILLAGER')];

describe('resolveNight — ตารางผลลัพธ์กลางคืนใน rule.md', () => {
  it('รักษาถูกคน + โจรไม่โดนแม่ชี → ไม่มีใครตาย', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'v1' }, nunTarget: 'v1', thiefTarget: 'v2' }), 1);
    expect(r.deadPlayerId).toBeNull();
    expect(r.nunHealedVictim).toBe(true);
    expect(r.nunDisabled).toBe(false);
  });

  it('รักษาถูกคน แต่โจรปี้โดนแม่ชี → เหยื่อตาย', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'v1' }, nunTarget: 'v1', thiefTarget: 'nun' }), 1);
    expect(r.nunDisabled).toBe(true);
    expect(r.deadPlayerId).toBe('v1');
  });

  it('รักษาผิดคน → เหยื่อตาย', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'v1' }, nunTarget: 'v2' }), 1);
    expect(r.deadPlayerId).toBe('v1');
  });

  it('แม่ชีไม่ใช้สิทธิ์ → เหยื่อตาย', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'v1' } }), 1);
    expect(r.deadPlayerId).toBe('v1');
  });

  it('แม่ชีรักษาตัวเองสำเร็จ', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'nun' }, nunTarget: 'nun' }), 1);
    expect(r.nunHealedSelf).toBe(true);
    expect(r.deadPlayerId).toBeNull();
  });

  it('Killer 2 คนเลือกไม่ตรงกัน → ไม่มีใครตาย', () => {
    const players = [...base(), mk('k2', 'KILLER')];
    const r = resolveNight(players, actions({ killVotes: { k1: 'v1', k2: 'v2' } }), 1);
    expect(r.killersDisagreed).toBe(true);
    expect(r.deadPlayerId).toBeNull();
  });

  it('Killer 2 คนเลือกตรงกัน → เหยื่อตาย', () => {
    const players = [...base(), mk('k2', 'KILLER')];
    const r = resolveNight(players, actions({ killVotes: { k1: 'v1', k2: 'v1' } }), 1);
    expect(r.killersDisagreed).toBe(false);
    expect(r.deadPlayerId).toBe('v1');
  });

  it('Killer คนที่สองยังไม่เลือก → ถือว่าตกลงกันไม่ได้', () => {
    const players = [...base(), mk('k2', 'KILLER')];
    const r = resolveNight(players, actions({ killVotes: { k1: 'v1' } }), 1);
    expect(r.killersDisagreed).toBe(true);
    expect(r.deadPlayerId).toBeNull();
  });

  it('บอกผลการสืบของตำรวจถูกต้อง', () => {
    expect(resolveNight(base(), actions({ policeTarget: 'k1' }), 1).policeCorrect).toBe(true);
    expect(resolveNight(base(), actions({ policeTarget: 'v1' }), 1).policeCorrect).toBe(false);
  });

  it('สรุปคืนมีครบทั้ง 5 บรรทัดให้พิธีกรอ่าน', () => {
    const r = resolveNight(base(), actions({ killVotes: { k1: 'v1' }, policeTarget: 'k1', nunTarget: 'v2', thiefTarget: 'nun' }), 1);
    expect(r.lines).toHaveLength(5);
    expect(r.lines.join('\n')).toContain('ศีลขาด');
  });
});

describe('tallyVotes', () => {
  it('เสียงข้างมากถูกกำจัด', () => {
    const r = tallyVotes(base(), { pol: 'k1', nun: 'k1', v1: 'v2' }, 1, false);
    expect(r.eliminatedId).toBe('k1');
    expect(r.tied).toBe(false);
  });

  it('เสมอรอบแรก → ให้โหวตใหม่', () => {
    const r = tallyVotes(base(), { pol: 'k1', nun: 'v2' }, 1, false);
    expect(r.tied).toBe(true);
    expect(r.eliminatedId).toBeNull();
    expect(r.noElimination).toBe(false);
  });

  it('เสมอซ้ำในรอบแก้ตัว → ไม่มีใครถูกกำจัด', () => {
    const r = tallyVotes(base(), { pol: 'k1', nun: 'v2' }, 1, true);
    expect(r.noElimination).toBe(true);
  });

  it('งดออกเสียงไม่ถูกนับเป็นคะแนน', () => {
    const r = tallyVotes(base(), { pol: 'SKIP', nun: 'SKIP', v1: 'k1' }, 1, false);
    expect(r.eliminatedId).toBe('k1');
    expect(r.tally).toHaveLength(1);
  });
});

describe('checkWinner', () => {
  it('กำจัด Killer ครบ → ฝ่ายประชาชนชนะ', () => {
    const players = base().map((p) => (p.role === 'KILLER' ? { ...p, alive: false } : p));
    expect(checkWinner(players)?.faction).toBe('GOOD');
  });

  it('ฝ่ายดีเหลือเท่ากับ Killer → ฝ่าย Killer ชนะ', () => {
    const players = [mk('k1', 'KILLER'), mk('v1', 'VILLAGER'), mk('v2', 'VILLAGER', false), mk('v3', 'VILLAGER', false)];
    expect(checkWinner(players)?.faction).toBe('EVIL');
  });

  it('ยังไม่จบเมื่อฝ่ายดีมากกว่า', () => {
    expect(checkWinner(base())).toBeNull();
  });
});

describe('deckFor — ตารางจำนวนไพ่ 6–12 คน', () => {
  it.each([
    [6, 1, 2],
    [8, 1, 4],
    [9, 2, 4],
    [12, 2, 7],
  ])('%i คน → Killer %i ใบ, ประชาชน %i ใบ', (n, killers, villagers) => {
    const c = deckFor(n);
    expect(c.KILLER).toBe(killers);
    expect(c.VILLAGER).toBe(villagers);
    expect(c.KILLER + c.POLICE + c.NUN + c.THIEF + c.VILLAGER).toBe(n);
  });

  it('กองไพ่ที่สร้างมีจำนวนใบเท่าผู้เล่นและไม่ซ้ำกัน', () => {
    for (let n = 6; n <= 12; n++) {
      const deck = buildDeck(deckFor(n));
      expect(deck).toHaveLength(n);
      expect(new Set(deck.map((d) => d.card)).size).toBe(n);
    }
  });
});
