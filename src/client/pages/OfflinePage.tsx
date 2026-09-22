import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MAX_PLAYERS, MIN_PLAYERS, ROLES, buildDeck, deckFor, shuffle, validateCount } from '../../shared/roles';
import { FlipCard } from '../components/PlayingCard';
import type { RoleId } from '../../shared/types';

interface Dealt {
  name: string;
  role: RoleId;
  card: string;
}

/**
 * โหมดออฟไลน์: ใช้มือถือเครื่องเดียวแทนสำรับไพ่
 * ส่งเครื่องต่อกันไปทีละคน → แตะดูไพ่ของตัวเอง → กดปิดแล้วส่งต่อ
 */
export function OfflinePage() {
  const [names, setNames] = useState<string[]>(['', '', '', '', '', '']);
  const [dealt, setDealt] = useState<Dealt[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.mood = dealt && !showAll ? 'night' : 'day';
  }, [dealt, showAll]);

  const filled = names.map((n) => n.trim()).filter(Boolean);
  const countError = validateCount(filled.length);
  const comp = useMemo(
    () => deckFor(Math.min(Math.max(filled.length, MIN_PLAYERS), MAX_PLAYERS)),
    [filled.length],
  );

  const deal = () => {
    const deck = shuffle(buildDeck(deckFor(filled.length)));
    setDealt(filled.map((name, i) => ({ name, role: deck[i].role, card: deck[i].card })));
    setIndex(0);
    setRevealed(false);
    setShowAll(false);
  };

  const reset = () => {
    setDealt(null);
    setIndex(0);
    setRevealed(false);
    setShowAll(false);
  };

  /* ---------- หน้าตั้งค่า ---------- */
  if (!dealt) {
    return (
      <div className="wrap narrow" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
        <div className="stack">
          <div className="row">
            <Link to="/">← หน้าแรก</Link>
            <div className="spacer" />
            <Link to="/print" className="small">ตารางสรุปสำหรับพิมพ์ →</Link>
          </div>

          <h1 style={{ margin: 0 }}>แจกการ์ดออฟไลน์</h1>
          <p className="muted small" style={{ margin: 0 }}>
            ใส่ชื่อผู้เล่นที่จะ<b>รับไพ่</b> (ไม่ต้องใส่ชื่อพิธีกร) แล้วส่งมือถือต่อกันไปทีละคน
          </p>

          <div className="card-panel stack">
            {names.map((n, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                <span className="mono muted" style={{ width: '2rem' }}>{i + 1}.</span>
                <input
                  value={n}
                  maxLength={20}
                  placeholder={`ชื่อผู้เล่นคนที่ ${i + 1}`}
                  aria-label={`ชื่อผู้เล่นคนที่ ${i + 1}`}
                  onChange={(e) => setNames(names.map((v, j) => (j === i ? e.target.value : v)))}
                />
                {names.length > MIN_PLAYERS && (
                  <button className="ghost" aria-label={`ลบผู้เล่นคนที่ ${i + 1}`} onClick={() => setNames(names.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                )}
              </div>
            ))}
            {names.length < MAX_PLAYERS && (
              <button className="block ghost" onClick={() => setNames([...names, ''])}>
                + เพิ่มผู้เล่น
              </button>
            )}
          </div>

          <div className="card-panel">
            <div className="note-card">
              <h4>ไพ่ที่จะแจก ({filled.length} คน)</h4>
              <ul>
                <li>K — Killer: {comp.KILLER} ใบ</li>
                <li>A — ตำรวจ: {comp.POLICE} ใบ</li>
                <li>Q — แม่ชี: {comp.NUN} ใบ</li>
                <li>J — โจร: {comp.THIEF} ใบ</li>
                <li>ใบอื่น ๆ — ประชาชน: {comp.VILLAGER} ใบ</li>
              </ul>
            </div>
          </div>

          <button className="primary block" disabled={!!countError} onClick={deal}>
            สับไพ่และแจก
          </button>
          {countError && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{countError}</p>}
        </div>
      </div>
    );
  }

  /* ---------- หน้าเฉลยทั้งหมด (สำหรับพิธีกรเท่านั้น) ---------- */
  if (showAll) {
    return (
      <div className="wrap narrow" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
        <div className="stack">
          <h1 style={{ margin: 0 }}>🎙️ เฉลยบทบาท (พิธีกรเท่านั้น)</h1>
          <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>
            ⚠️ ห้ามให้ผู้เล่นเห็นหน้านี้เด็ดขาด
          </p>
          <div className="card-panel">
            <table>
              <thead>
                <tr><th>ผู้เล่น</th><th>ไพ่</th><th>บทบาท</th></tr>
              </thead>
              <tbody>
                {dealt.map((d) => (
                  <tr key={d.name}>
                    <td><b>{d.name}</b></td>
                    <td className="mono">{d.card}</td>
                    <td>{ROLES[d.role].name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="block" onClick={() => setShowAll(false)}>ซ่อนเฉลย</button>
          <button className="block ghost" onClick={reset}>สับไพ่ใหม่ / แก้รายชื่อ</button>
        </div>
      </div>
    );
  }

  /* ---------- หน้าส่งเครื่องต่อกัน ---------- */
  const current = dealt[index];
  const done = index >= dealt.length;

  if (done) {
    return (
      <div className="wrap narrow" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
        <div className="stack">
          <h1 style={{ margin: 0 }}>แจกไพ่ครบทุกคนแล้ว 🃏</h1>
          <p className="muted" style={{ margin: 0 }}>
            เริ่มเล่นได้เลย — พิธีกรสั่ง “ทุกคนหลับตา” แล้วเรียกตามลำดับ Killer → ตำรวจ → แม่ชี → โจร
          </p>
          <div className="card-panel">
            <div className="note-card">
              <h4>ลำดับกลางคืน (ท่องตามนี้ได้เลย)</h4>
              <ol>
                <li>“Killer ลืมตา เลือกเหยื่อ… Killer หลับตา”</li>
                <li>“ตำรวจลืมตา ชี้คนที่สงสัย” → พยักหน้า/ส่ายหน้า → “ตำรวจหลับตา”</li>
                <li>“แม่ชีลืมตา เลือกคนที่จะรักษา… แม่ชีหลับตา”</li>
                <li>“โจรลืมตา เลือกคนที่จะปี้… โจรหลับตา”</li>
                <li>“ทุกคนลืมตา” แล้วประกาศผล</li>
              </ol>
            </div>
          </div>
          <button className="primary block" onClick={() => setShowAll(true)}>
            ดูเฉลยบทบาททั้งหมด (พิธีกรเท่านั้น)
          </button>
          <Link to="/print" style={{ textDecoration: 'none' }}>
            <button className="block ghost">เปิดตารางสรุป 1 หน้า</button>
          </Link>
          <button className="block ghost" onClick={reset}>สับไพ่ใหม่</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap narrow" style={{ paddingTop: '1.5rem', paddingBottom: '3rem' }}>
      <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
        <span className="badge">
          คนที่ {index + 1} จาก {dealt.length}
        </span>
        <h1 style={{ margin: 0 }}>{current.name}</h1>

        {!revealed ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              ส่งเครื่องให้ <b>{current.name}</b> แล้วกันไม่ให้คนอื่นมองจอ
            </p>
            <FlipCard role={null} revealed={false} />
            <button className="primary block" onClick={() => setRevealed(true)}>
              ฉันคือ {current.name} — เปิดดูไพ่
            </button>
          </>
        ) : (
          <>
            <FlipCard role={current.role} card={current.card} revealed />
            <div className="card-panel" style={{ textAlign: 'left' }}>
              <h3 style={{ margin: 0 }}>{ROLES[current.role].name}</h3>
              <p className="small" style={{ margin: '0.3rem 0 0' }}>
                <b>หน้าที่:</b> {ROLES[current.role].duty}
              </p>
              {ROLES[current.role].nightAction && (
                <p className="small" style={{ margin: '0.3rem 0 0' }}>
                  <b>กลางคืน:</b> {ROLES[current.role].nightAction}
                </p>
              )}
              <p className="small muted" style={{ margin: '0.3rem 0 0' }}>💡 {ROLES[current.role].tip}</p>
            </div>
            <button
              className="primary block"
              onClick={() => {
                setRevealed(false);
                setIndex(index + 1);
              }}
            >
              จำได้แล้ว — ปิดและส่งต่อ
            </button>
          </>
        )}
      </div>
    </div>
  );
}
