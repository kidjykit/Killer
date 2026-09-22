import { ROLES } from '../../shared/roles';
import type { ClientMessage, RoleId, RoomView } from '../../shared/types';
import { RoleCard } from './PlayingCard';

/** บทพูดของพิธีกรตอนเปิดกลางคืน — ทุกบทบาทลืมตาพร้อมกัน ไม่ได้เรียกทีละคน */
export const NIGHT_CALL = '“ทุกคนหลับตา… Killer ตำรวจ แม่ชี และโจร ลืมตาพร้อมกัน แล้วเลือกเป้าหมายของตัวเองได้เลย”';

/** คำสั่งที่ผู้เล่นแต่ละบทบาทเห็นตอนกลางคืน */
const ROLE_CALL: Partial<Record<RoleId, string>> = {
  KILLER: 'เลือกเหยื่อที่ต้องการฆ่า',
  POLICE: 'เลือกคนที่สงสัย — สืบได้รอบละ 1 ครั้งเท่านั้น',
  NUN: 'เลือกคนที่ต้องการรักษา',
  THIEF: 'เลือกคนที่ต้องการปี้',
};

export function NightPanel({
  view,
  send,
  secondsLeft,
}: {
  view: RoomView;
  send: (m: ClientMessage) => void;
  secondsLeft: number | null;
}) {
  const nameOf = (id: string | null) => (id ? view.players.find((p) => p.id === id)?.name ?? '—' : null);
  const actors = view.players.filter(
    (p) => p.alive && p.role && p.role !== 'VILLAGER' && !p.isModerator,
  );
  const pickName = nameOf(view.yourNightTarget);

  return (
    <div className="card-panel stack">
      <div className="row">
        <span className="badge solid">🌙 คืนที่ {view.round}</span>
        <span className="badge">เลือกพร้อมกัน</span>
        <div className="spacer" />
        {secondsLeft !== null && (
          <span className="mono" style={{ fontSize: '1.3rem' }}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>

      {view.isModerator ? (
        <>
          <h3 style={{ margin: 0 }}>{NIGHT_CALL}</h3>
          <p className="muted small" style={{ margin: 0 }}>
            ไม่ต้องเรียกทีละบทบาท ทุกคนกดของตัวเองได้พร้อมกันภายในเวลาเดียว
          </p>
          <div className="note-card">
            <h4>สถานะ (เห็นเฉพาะพิธีกร)</h4>
            <ul>
              {actors.length === 0 ? (
                <li>ไม่มีผู้เล่นที่ยังมีชีวิตในบทบาทพิเศษ</li>
              ) : (
                actors.map((a) => (
                  <li key={a.id}>
                    {a.name} ({a.role ? ROLES[a.role].name : '—'}):{' '}
                    {view.submittedPlayerIds.includes(a.id) ? '✅ เลือกแล้ว' : '⏳ ยังไม่เลือก'}
                  </li>
                ))
              )}
            </ul>
          </div>
          <button className="primary block" onClick={() => send({ t: 'END_NIGHT' })}>
            จบกลางคืน → ประกาศผล
          </button>
        </>
      ) : view.youHaveNightAction ? (
        <>
          <h3 style={{ margin: 0 }}>
            {view.yourActionLocked ? 'คุณเลือกไปแล้วในรอบนี้' : 'เลือกได้เลย — แตะที่ตัวผู้เล่นบนโต๊ะ'}
          </h3>
          <p className="muted small" style={{ margin: 0 }}>
            {view.yourRole ? ROLE_CALL[view.yourRole] : ''}
          </p>
          <div className="note-card">
            <h4>ตัวเลือกของคุณ</h4>
            <p style={{ margin: 0 }}>
              {pickName ? (
                <>
                  <b>{pickName}</b>
                  {view.yourActionLocked ? ' (ล็อกแล้ว แก้ไม่ได้)' : ' — แตะคนอื่นเพื่อเปลี่ยนใจได้จนหมดเวลา'}
                </>
              ) : (
                'ยังไม่ได้เลือก'
              )}
            </p>
          </div>
          {view.policeResult && (
            <div className="note-card">
              <h4>ผลการสืบคืนนี้</h4>
              <p style={{ margin: 0 }}>
                {view.policeResult.targetName} —{' '}
                <b>{view.policeResult.isKiller ? '✅ คือ Killer!' : '❌ ไม่ใช่ Killer'}</b>
              </p>
            </div>
          )}
          {view.yourRole === 'KILLER' && view.fellowKillerIds.length > 0 && (
            <div className="note-card">
              <h4>เพื่อน Killer ของคุณ</h4>
              <ul>
                {view.players
                  .filter((p) => view.fellowKillerIds.includes(p.id))
                  .map((p) => (
                    <li key={p.id}>
                      {p.name} — {view.killVotes[p.id] ? `เลือก ${nameOf(view.killVotes[p.id])}` : 'ยังไม่เลือก'}
                    </li>
                  ))}
              </ul>
              <p className="small" style={{ margin: '0.4rem 0 0' }}>ต้องเลือกตรงกัน ไม่งั้นคืนนี้ไม่มีใครตาย</p>
            </div>
          )}
        </>
      ) : (
        <>
          <h3 style={{ margin: 0 }}>😴 หลับตา…</h3>
          <p className="muted small" style={{ margin: 0 }}>
            บทบาทของคุณไม่มีอะไรต้องทำตอนกลางคืน รอจนถึงเช้า และห้ามพูดในห้องหลัก
          </p>
        </>
      )}

      <div className="privacy-note">
        🔒 ช่วงกลางคืน ไมค์และกล้องของทุกคนถูกปิด และซ่อนสถานะทั้งหมดจากผู้เล่นคนอื่น
        มีเพียงพิธีกรที่เห็นว่าใครกำลังทำอะไร
      </div>
    </div>
  );
}

export function DayPanel({ view, send }: { view: RoomView; send: (m: ClientMessage) => void }) {
  const last = view.publicLog.slice(-4);
  const canControl = view.isModerator || (view.settings.moderatorMode === 'AUTO' && !!view.players.find((p) => p.id === view.youId)?.isHost);
  return (
    <div className="card-panel stack">
      <div className="row">
        <span className="badge solid">☀️ กลางวัน รอบที่ {view.round}</span>
      </div>
      <h3 style={{ margin: 0 }}>ประกาศผลของคืนที่ผ่านมา</h3>
      <div className="log">
        {last.map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      {canControl && (
        <div className="row">
          <button className="primary" onClick={() => send({ t: 'OPEN_DISCUSSION' })}>
            เปิดช่วงอภิปราย
          </button>
          <button onClick={() => send({ t: 'OPEN_VOTE' })}>ข้ามไปโหวตเลย</button>
        </div>
      )}
    </div>
  );
}

export function DiscussionPanel({
  view,
  send,
  secondsLeft,
}: {
  view: RoomView;
  send: (m: ClientMessage) => void;
  secondsLeft: number | null;
}) {
  const canControl = view.isModerator || (view.settings.moderatorMode === 'AUTO' && !!view.players.find((p) => p.id === view.youId)?.isHost);
  return (
    <div className="card-panel stack">
      <div className="row">
        <span className="badge solid">💬 อภิปราย</span>
        <div className="spacer" />
        {secondsLeft !== null && (
          <span className="mono" style={{ fontSize: '1.3rem' }}>
            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        พูดคุย จับผิด และกล่าวหากันได้เต็มที่ — ทุกคนโกหกได้ ไม่ถือว่าโกง
      </p>
      {canControl && (
        <button className="primary block" onClick={() => send({ t: 'OPEN_VOTE' })}>
          ปิดการอภิปราย → เปิดโหวต
        </button>
      )}
    </div>
  );
}

export function VotePanel({ view, send }: { view: RoomView; send: (m: ClientMessage) => void }) {
  const me = view.players.find((p) => p.id === view.youId);
  const canVote = !!me?.alive && !me.isModerator;
  const canControl = view.isModerator || (view.settings.moderatorMode === 'AUTO' && !!me?.isHost);
  return (
    <div className="card-panel stack">
      <span className="badge solid">🗳️ โหวต รอบที่ {view.round}</span>
      {canVote ? (
        <>
          <h3 style={{ margin: 0 }}>แตะที่ตัวผู้เล่นบนโต๊ะเพื่อโหวต</h3>
          <button className="block" onClick={() => send({ t: 'CAST_VOTE', targetId: 'SKIP' })}>
            งดออกเสียง
          </button>
        </>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>คุณไม่มีสิทธิ์โหวตในรอบนี้</p>
      )}
      {canControl && (
        <button className="primary block" onClick={() => send({ t: 'CLOSE_VOTE' })}>
          ปิดโหวต → ประกาศผล
        </button>
      )}
    </div>
  );
}

export function VoteResultPanel({ view, send }: { view: RoomView; send: (m: ClientMessage) => void }) {
  const report = view.voteReports[view.voteReports.length - 1];
  const canControl = view.isModerator || (view.settings.moderatorMode === 'AUTO' && !!view.players.find((p) => p.id === view.youId)?.isHost);
  return (
    <div className="card-panel stack">
      <span className="badge solid">⚖️ ผลโหวต</span>
      {report && (
        <div className="log">
          {report.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}
      {canControl && (
        <button className="primary block" onClick={() => send({ t: 'NEXT_ROUND' })}>
          {report?.tied && !report.noElimination ? 'เปิดโหวตแก้ตัวรอบสอง' : `เข้าสู่คืนที่ ${view.round + 1}`}
        </button>
      )}
    </div>
  );
}

export function EndPanel({ view, send }: { view: RoomView; send: (m: ClientMessage) => void }) {
  const me = view.players.find((p) => p.id === view.youId);
  return (
    <div className="card-panel stack">
      <span className="badge solid">🏁 จบเกม</span>
      <h2 style={{ margin: 0 }}>{view.winner?.faction === 'GOOD' ? 'ฝ่ายประชาชนชนะ!' : 'ฝ่าย Killer ชนะ!'}</h2>
      <p style={{ margin: 0 }}>{view.winner?.reason}</p>
      <table>
        <thead>
          <tr>
            <th>ผู้เล่น</th>
            <th>ไพ่</th>
            <th>บทบาท</th>
          </tr>
        </thead>
        <tbody>
          {view.finalReveal?.map((r) => (
            <tr key={r.playerId}>
              <td>{r.name}</td>
              <td className="mono">{r.card}</td>
              <td>{ROLES[r.role].name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {me?.isHost && (
        <button className="primary block" onClick={() => send({ t: 'RESTART' })}>
          เล่นอีกรอบ (กลับไปล็อบบี้)
        </button>
      )}
    </div>
  );
}

export function YourCardPanel({ view }: { view: RoomView }) {
  if (view.isModerator) {
    return (
      <div className="card-panel stack">
        <h3 style={{ margin: 0 }}>🎙️ คุณคือพิธีกร</h3>
        <p className="muted small" style={{ margin: 0 }}>คุณไม่ได้รับไพ่ และเห็นบทบาทของทุกคนบนโต๊ะ</p>
      </div>
    );
  }
  if (!view.yourRole) return null;
  const info = ROLES[view.yourRole];
  return (
    <div className="card-panel stack" style={{ alignItems: 'center' }}>
      <RoleCard role={view.yourRole} card={view.yourCard} />
      <p className="small" style={{ margin: 0, textAlign: 'center' }}>
        <b>หน้าที่:</b> {info.duty}
      </p>
      <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>
        💡 {info.tip}
      </p>
    </div>
  );
}
