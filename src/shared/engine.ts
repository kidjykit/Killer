import type { NightActions, NightReport, Player, VoteReport, Winner } from './types';

const nameOf = (players: Player[], id: string | null) =>
  (id && players.find((p) => p.id === id)?.name) || null;

/** คิลเลอร์ทุกคนที่ยังมีชีวิตต้องเลือกตรงกัน มิฉะนั้นคืนนั้นไม่มีใครถูกลอบฆ่า (rule.md §1) */
export function resolveKillTarget(players: Player[], killVotes: Record<string, string>) {
  const aliveKillers = players.filter((p) => p.alive && p.role === 'KILLER');
  if (aliveKillers.length === 0) return { targetId: null, disagreed: false };
  const picks = aliveKillers.map((k) => killVotes[k.id]).filter(Boolean);
  if (picks.length < aliveKillers.length) return { targetId: null, disagreed: true };
  const allSame = picks.every((p) => p === picks[0]);
  return allSame ? { targetId: picks[0], disagreed: false } : { targetId: null, disagreed: true };
}

/**
 * คิดผลของคืนตามลำดับใน rule.md §3:
 *   1) โจรปี้โดนแม่ชีหรือไม่ → ถ้าโดน การรักษาคืนนั้นเป็นโมฆะทั้งหมด
 *   2) เหยื่อของ Killer ตรงกับคนที่แม่ชีรักษาหรือไม่
 */
export function resolveNight(players: Player[], actions: NightActions, round: number): NightReport {
  const nun = players.find((p) => p.alive && p.role === 'NUN') ?? null;
  const { targetId: killTargetId, disagreed } = resolveKillTarget(players, actions.killVotes);

  const nunDisabled = !!(actions.thiefTarget && nun && actions.thiefTarget === nun.id);
  const healTarget = nunDisabled ? null : actions.nunTarget;
  const nunHealedVictim = !!(killTargetId && healTarget && killTargetId === healTarget);
  const deadPlayerId = killTargetId && !nunHealedVictim ? killTargetId : null;

  const policeTargetRole = actions.policeTarget
    ? players.find((p) => p.id === actions.policeTarget)?.role ?? null
    : null;
  const policeCorrect = actions.policeTarget ? policeTargetRole === 'KILLER' : null;

  const report: NightReport = {
    round,
    killTargetId,
    killTargetName: nameOf(players, killTargetId),
    killersDisagreed: disagreed,
    policeTargetId: actions.policeTarget,
    policeTargetName: nameOf(players, actions.policeTarget),
    policeCorrect,
    nunTargetId: actions.nunTarget,
    nunTargetName: nameOf(players, actions.nunTarget),
    nunHealedSelf: !!(actions.nunTarget && nun && actions.nunTarget === nun.id),
    nunHealedVictim,
    thiefTargetId: actions.thiefTarget,
    thiefTargetName: nameOf(players, actions.thiefTarget),
    nunDisabled,
    deadPlayerId,
    deadPlayerName: nameOf(players, deadPlayerId),
    lines: [],
  };
  report.lines = describeNight(report);
  return report;
}

/** สรุปคืนเป็นภาษาไทยสำหรับ "note ของพิธีกร" — พิธีกรจะได้ไม่ต้องจำเอง */
export function describeNight(r: NightReport): string[] {
  const lines: string[] = [];

  if (r.killersDisagreed) {
    lines.push('🔪 Killer: เลือกเป้าหมายไม่ตรงกัน / ไม่ได้เลือกทันเวลา → คืนนี้ไม่มีการลอบฆ่า');
  } else if (r.killTargetName) {
    lines.push(`🔪 Killer เลือกฆ่า: ${r.killTargetName}`);
  } else {
    lines.push('🔪 Killer: ไม่ได้เลือกเป้าหมาย');
  }

  if (r.policeTargetName) {
    lines.push(
      `🔍 ตำรวจสืบ: ${r.policeTargetName} → ${r.policeCorrect ? 'ชี้ถูก! คนนี้คือ Killer' : 'ชี้ผิด คนนี้ไม่ใช่ Killer'}`,
    );
  } else {
    lines.push('🔍 ตำรวจ: ไม่ได้สืบใครในคืนนี้');
  }

  if (r.nunTargetName) {
    lines.push(
      `🕯️ แม่ชีรักษา: ${r.nunTargetName}${r.nunHealedSelf ? ' (รักษาตัวเอง)' : ''}` +
        (r.nunDisabled
          ? ' → ❌ เป็นโมฆะ เพราะแม่ชีศีลขาด'
          : r.nunHealedVictim
            ? ' → ✅ รักษาถูกคน เหยื่อรอดตาย'
            : ' → รักษาผิดคน ไม่มีผล'),
    );
  } else {
    lines.push('🕯️ แม่ชี: ไม่ได้รักษาใครในคืนนี้');
  }

  if (r.thiefTargetName) {
    lines.push(
      `🥷 โจรปี้: ${r.thiefTargetName} → ${r.nunDisabled ? '⚠️ โดนตัวแม่ชี! แม่ชีศีลขาด รักษาไม่ขึ้นทั้งคืน' : 'ไม่ใช่แม่ชี ไม่มีอะไรเกิดขึ้น'}`,
    );
  } else {
    lines.push('🥷 โจร: ไม่ได้เลือกใครในคืนนี้');
  }

  lines.push(
    r.deadPlayerName
      ? `📣 ผลสรุป: คืนนี้ ${r.deadPlayerName} เสียชีวิต`
      : '📣 ผลสรุป: คืนนี้ไม่มีใครเสียชีวิต',
  );
  return lines;
}

/** ประโยคเดียวที่พิธีกรประกาศให้ผู้เล่นทุกคนฟัง (ไม่หลุดข้อมูลลับ) */
export function publicNightAnnouncement(r: NightReport): string {
  return r.deadPlayerName
    ? `☀️ คืนที่ ${r.round}: ${r.deadPlayerName} ถูกฆ่าเสียชีวิต`
    : `☀️ คืนที่ ${r.round}: ไม่มีใครเสียชีวิต`;
}

/**
 * นับคะแนนโหวต เสียงข้างมากถูกกำจัด
 * เสมอรอบแรก → โหวตใหม่ (tied), เสมอซ้ำ → ไม่มีใครถูกกำจัด (noElimination)
 */
export function tallyVotes(
  players: Player[],
  votes: Record<string, string>,
  round: number,
  isRevote: boolean,
): VoteReport {
  const counts = new Map<string, number>();
  for (const target of Object.values(votes)) {
    if (target === 'SKIP') continue;
    counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  const tally = [...counts.entries()]
    .map(([playerId, count]) => ({
      playerId,
      name: players.find((p) => p.id === playerId)?.name ?? '—',
      count,
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));

  const top = tally[0]?.count ?? 0;
  const leaders = tally.filter((t) => t.count === top);
  const tied = top > 0 && leaders.length > 1;

  const report: VoteReport = {
    round,
    votes,
    tally,
    eliminatedId: !tied && top > 0 ? tally[0].playerId : null,
    eliminatedName: !tied && top > 0 ? tally[0].name : null,
    tied,
    noElimination: (tied && isRevote) || top === 0,
    lines: [],
  };

  const skips = Object.values(votes).filter((v) => v === 'SKIP').length;
  report.lines = [
    `🗳️ ผลโหวตรอบที่ ${round}${isRevote ? ' (โหวตแก้ตัวรอบสอง)' : ''}`,
    ...tally.map((t) => `   • ${t.name}: ${t.count} เสียง`),
    ...(skips ? [`   • งดออกเสียง: ${skips}`] : []),
    report.eliminatedName
      ? `   → ${report.eliminatedName} ถูกโหวตออกจากเกม`
      : report.noElimination
        ? '   → ไม่มีใครถูกกำจัดในรอบนี้'
        : `   → คะแนนเท่ากัน (${leaders.map((l) => l.name).join(', ')}) ให้พูดแก้ตัวคนละ 30 วินาที แล้วโหวตใหม่`,
  ];
  return report;
}

/** ตรวจเงื่อนไขการชนะ ตาม rule.md §4 — เรียกทุกครั้งหลังมีคนตายหรือถูกโหวตออก */
export function checkWinner(players: Player[]): Winner | null {
  const alive = players.filter((p) => p.alive && p.role !== null);
  const killers = alive.filter((p) => p.role === 'KILLER').length;
  const good = alive.length - killers;

  if (killers === 0) {
    return { faction: 'GOOD', reason: 'กำจัด Killer ได้ครบทุกคน — ฝ่ายประชาชนชนะ! 🎉' };
  }
  if (killers >= good) {
    return {
      faction: 'EVIL',
      reason: `ฝ่ายดีเหลือ ${good} คน เทียบกับ Killer ${killers} คน — ฝ่าย Killer คุมเกมได้สำเร็จ 🔪`,
    };
  }
  return null;
}
