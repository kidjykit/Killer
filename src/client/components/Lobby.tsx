import { useState } from 'react';
import type { ClientMessage, RoomSettings, RoomView } from '../../shared/types';
import { MAX_PLAYERS, MIN_PLAYERS, deckFor, validateCount } from '../../shared/roles';

export function Lobby({ view, send }: { view: RoomView; send: (m: ClientMessage) => void }) {
  const me = view.players.find((p) => p.id === view.youId);
  const isHost = !!me?.isHost;
  const s = view.settings;
  const holders = view.players.filter((p) => !p.isModerator);
  const countError = validateCount(holders.length);
  const comp = deckFor(Math.min(Math.max(holders.length, MIN_PLAYERS), MAX_PLAYERS));
  const needsModerator = s.moderatorMode === 'HUMAN' && !view.players.some((p) => p.isModerator);

  const [copied, setCopied] = useState(false);
  const shareUrl = `${location.origin}/room/${view.code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* บางเบราว์เซอร์ต้องกดเอง — ผู้ใช้ยังก๊อปจากช่องข้อความได้ */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const patch = (settings: Partial<RoomSettings>) => send({ t: 'SET_SETTINGS', settings });

  return (
    <div className="stack">
      <div className="card-panel stack">
        <div className="row">
          <div>
            <div className="muted small">รหัสห้อง</div>
            <div className="display" style={{ fontSize: '2.6rem' }}>
              {view.code}
            </div>
          </div>
          <div className="spacer" />
          <div className="badge">
            ผู้เล่นที่รับไพ่ {holders.length}/{MAX_PLAYERS}
          </div>
        </div>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} aria-label="ลิงก์เชิญเพื่อน" />
          <button onClick={copy}>{copied ? 'คัดลอกแล้ว ✓' : 'คัดลอกลิงก์'}</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          ส่งลิงก์นี้ให้เพื่อน ๆ เพื่อเข้าห้องเดียวกัน
        </p>
      </div>

      <div className="card-panel stack">
        <h3 style={{ margin: 0 }}>กติกาของห้อง</h3>
        {!isHost && <p className="muted small" style={{ margin: 0 }}>เฉพาะเจ้าของห้องเท่านั้นที่แก้ได้</p>}

        <div>
          <label htmlFor="mod-mode">ผู้ดำเนินเกม</label>
          <select
            id="mod-mode"
            value={s.moderatorMode}
            disabled={!isHost}
            onChange={(e) => patch({ moderatorMode: e.target.value as RoomSettings['moderatorMode'] })}
          >
            <option value="HUMAN">คนจริงเป็นพิธีกร (ไม่ได้รับไพ่ เห็นบทบาททุกคน)</option>
            <option value="AUTO">ระบบเป็นพิธีกรอัตโนมัติ (ทุกคนได้เล่น)</option>
          </select>
        </div>

        {s.moderatorMode === 'HUMAN' && (
          <div>
            <label htmlFor="mod-pick">เลือกพิธีกร</label>
            <select
              id="mod-pick"
              value={view.players.find((p) => p.isModerator)?.id ?? ''}
              disabled={!isHost}
              onChange={(e) => send({ t: 'CLAIM_MODERATOR', playerId: e.target.value || null })}
            >
              <option value="">— ยังไม่เลือก —</option>
              {view.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="self-heal">แม่ชีรักษาตัวเอง</label>
          <select
            id="self-heal"
            value={String(s.nunSelfHealLimit)}
            disabled={!isHost}
            onChange={(e) => patch({ nunSelfHealLimit: Number(e.target.value) })}
          >
            <option value="0">ห้ามรักษาตัวเอง</option>
            <option value="1">รักษาตัวเองได้ 1 ครั้งต่อเกม (แนะนำ)</option>
            <option value="-1">รักษาตัวเองได้ไม่จำกัด</option>
          </select>
        </div>

        <div>
          <label htmlFor="reveal">เปิดไพ่ของคนที่ตาย/ถูกโหวตออก</label>
          <select
            id="reveal"
            value={s.revealRoleOnDeath ? 'yes' : 'no'}
            disabled={!isHost}
            onChange={(e) => patch({ revealRoleOnDeath: e.target.value === 'yes' })}
          >
            <option value="no">ไม่เปิด (เกมยาวขึ้น ลุ้นกว่า)</option>
            <option value="yes">เปิด (เกมจบเร็ว ฝ่ายดีได้เปรียบ)</option>
          </select>
        </div>

        <div className="row" style={{ flexWrap: 'nowrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="disc-sec">เวลาอภิปราย (วินาที, 0 = ไม่จับเวลา)</label>
            <input
              id="disc-sec"
              type="number"
              min={0}
              max={600}
              step={30}
              value={s.discussionSeconds}
              disabled={!isHost}
              onChange={(e) => patch({ discussionSeconds: Number(e.target.value) })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="night-sec">เวลาต่อบทบาทตอนกลางคืน (วินาที)</label>
            <input
              id="night-sec"
              type="number"
              min={0}
              max={120}
              step={5}
              value={s.nightStepSeconds}
              disabled={!isHost}
              onChange={(e) => patch({ nightStepSeconds: Number(e.target.value) })}
            />
          </div>
        </div>
        {s.moderatorMode === 'AUTO' && (
          <p className="muted small" style={{ margin: 0 }}>
            โหมดอัตโนมัติจะเดินครบเวลาทุกขั้นเสมอ ไม่ตัดจบเร็วแม้ทุกคนกดแล้ว — เพราะความเร็วในการจบขั้น
            จะกลายเป็นเบาะแสว่าบทบาทนั้นตายไปแล้ว
          </p>
        )}
      </div>

      <div className="card-panel stack">
        <h3 style={{ margin: 0 }}>
          ผู้เล่นในห้อง ({view.players.length})
        </h3>
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>สถานะ</th>
              {isHost && <th aria-label="จัดการ" />}
            </tr>
          </thead>
          <tbody>
            {view.players.map((p) => (
              <tr key={p.id}>
                <td>
                  <b>{p.name}</b>
                  {p.id === view.youId ? <span className="muted"> (คุณ)</span> : null}
                </td>
                <td>
                  {p.isHost && <span className="badge">เจ้าของห้อง</span>}{' '}
                  {p.isModerator && <span className="badge solid">พิธีกร</span>}{' '}
                  {!p.connected && <span className="muted small">หลุดการเชื่อมต่อ</span>}
                </td>
                {isHost && (
                  <td style={{ textAlign: 'right' }}>
                    {!p.isHost && (
                      <button className="ghost danger small" onClick={() => send({ t: 'KICK', playerId: p.id })}>
                        เตะ
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        <div className="note-card">
          <h4>ไพ่ที่จะใช้เมื่อเริ่มเกม ({holders.length} คน)</h4>
          <ul>
            <li>K — Killer: {comp.KILLER} ใบ</li>
            <li>A — ตำรวจ: {comp.POLICE} ใบ</li>
            <li>Q — แม่ชี: {comp.NUN} ใบ</li>
            <li>J — โจร: {comp.THIEF} ใบ</li>
            <li>ใบอื่น ๆ — ประชาชน: {comp.VILLAGER} ใบ</li>
          </ul>
        </div>

        {isHost ? (
          <>
            <button
              className="primary block"
              disabled={!!countError || needsModerator}
              onClick={() => send({ t: 'START_GAME' })}
            >
              เริ่มเกม — แจกไพ่
            </button>
            {(countError || needsModerator) && (
              <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>
                {countError ?? 'โหมดนี้ต้องเลือกพิธีกรก่อนเริ่มเกม'}
              </p>
            )}
          </>
        ) : (
          <p className="muted small" style={{ margin: 0 }}>รอเจ้าของห้องกดเริ่มเกม…</p>
        )}
      </div>
    </div>
  );
}
