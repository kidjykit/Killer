import type { RoomView } from '../../shared/types';

/**
 * "note ของพิธีกร" — สรุปทุกอย่างที่เกิดขึ้นในแต่ละคืนและผลโหวต
 * ผู้เล่นทั่วไปจะไม่ได้รับข้อมูลนี้จาก server เลย (กรองตั้งแต่ viewFor)
 */
export function ModeratorNotes({ view }: { view: RoomView }) {
  const items = [
    ...view.nightReports.map((r) => ({ round: r.round, kind: 'night' as const, lines: r.lines })),
    ...view.voteReports.map((r) => ({ round: r.round, kind: 'vote' as const, lines: r.lines })),
  ].sort((a, b) => b.round - a.round || (a.kind === 'vote' ? -1 : 1));

  if (items.length === 0) {
    return (
      <div className="card-panel">
        <h3 style={{ margin: 0 }}>📓 สมุดบันทึกพิธีกร</h3>
        <p className="muted small" style={{ margin: '0.4rem 0 0' }}>
          พอจบคืนแรก สรุปจะขึ้นที่นี่ — ใครฆ่าใคร ตำรวจชี้ถูกไหม แม่ชีรักษาใคร โจรปี้โดนแม่ชีหรือเปล่า
          จะได้ไม่ต้องจำเอง
        </p>
      </div>
    );
  }

  return (
    <div className="card-panel stack" style={{ gap: '0.6rem' }}>
      <h3 style={{ margin: 0 }}>📓 สมุดบันทึกพิธีกร</h3>
      {items.map((it, i) => (
        <div className="note-card" key={`${it.kind}-${it.round}-${i}`}>
          <h4>
            {it.kind === 'night' ? `🌙 สรุปคืนที่ ${it.round}` : `🗳️ สรุปการโหวตรอบที่ ${it.round}`}
          </h4>
          <ul>
            {it.lines.map((line, j) => (
              <li key={j}>{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
