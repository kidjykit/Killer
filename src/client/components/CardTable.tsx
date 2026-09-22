import type { Player, RoomView } from '../../shared/types';
import { ROLES } from '../../shared/roles';

export interface SeatDecor {
  /** แสดงว่าเลือกคนนี้อยู่ */
  selected?: boolean;
  /** กดเลือกได้ */
  onSelect?: () => void;
  /** ป้ายเล็กใต้ชื่อ (พิธีกรเห็นบทบาท ฯลฯ) */
  tag?: string;
}

interface Props {
  view: RoomView;
  /** ฟังก์ชันตกแต่งที่นั่งรายคน */
  decorate?: (p: Player) => SeatDecor;
  center?: React.ReactNode;
}

export function CardTable({ view, decorate, center }: Props) {
  const seats = [...view.players].sort((a, b) => a.seat - b.seat);
  return (
    <div className="table-felt">
      <div className="stack" style={{ width: '100%', alignItems: 'center' }}>
        <div className="seat-ring">
          {seats.map((p) => {
            const d = decorate?.(p) ?? {};
            const initial = p.name.trim().slice(0, 2).toUpperCase() || '??';
            const roleInfo = p.role ? ROLES[p.role] : null;
            const classes = [
              'seat',
              !p.alive ? 'dead' : '',
              d.onSelect ? 'selectable' : '',
              d.selected ? 'selected' : '',
            ]
              .filter(Boolean)
              .join(' ');

            const body = (
              <>
                <div className="seat-avatar" aria-hidden>
                  {p.isModerator ? '🎙️' : initial}
                </div>
                <div className="seat-name" title={p.name}>
                  {p.name}
                  {p.id === view.youId ? ' (คุณ)' : ''}
                </div>
                <div className="seat-tag">
                  {d.tag ??
                    (p.isModerator
                      ? 'พิธีกร'
                      : !p.alive
                        ? p.deathCause === 'VOTED'
                          ? 'ถูกโหวตออก'
                          : 'ถูกฆ่า'
                        : roleInfo
                          ? roleInfo.name
                          : p.isHost
                            ? 'เจ้าของห้อง'
                            : ' ')}
                </div>
              </>
            );

            return (
              <div key={p.id} className={classes}>
                {/* กลางคืนซ่อนไฟ online ของคนอื่นทั้งหมด ยกเว้นพิธีกร — กันการระบุตัวตน */}
                {(!view.privacyLock || view.isModerator) && (
                  <span className={`seat-dot${p.connected ? ' on' : ''}`} title={p.connected ? 'ออนไลน์' : 'หลุดการเชื่อมต่อ'} />
                )}
                {d.onSelect ? (
                  <button className="seat-hit" onClick={d.onSelect}>
                    {body}
                  </button>
                ) : (
                  body
                )}
              </div>
            );
          })}
        </div>
        {center ? <div className="table-center">{center}</div> : null}
      </div>
    </div>
  );
}
