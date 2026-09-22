import { ROLES } from '../../shared/roles';
import type { RoleId } from '../../shared/types';

export function CardBack({ label = 'KILLER' }: { label?: string }) {
  return (
    <div className="playing-card" style={{ display: 'grid', placeItems: 'center' }} aria-hidden>
      <div
        style={{
          fontFamily: 'var(--display)',
          fontSize: '1.4rem',
          letterSpacing: '0.2em',
          border: '2px solid var(--fg)',
          borderRadius: 10,
          padding: '1.6rem 0.9rem',
          writingMode: 'vertical-rl',
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function RoleCard({ role, card }: { role: RoleId; card?: string | null }) {
  const info = ROLES[role];
  const rank = card ? card.replace(/[♠♥♦♣]/g, '') : info.rank;
  const suit = card ? card.replace(/[^♠♥♦♣]/g, '') : info.glyph;
  return (
    <div className="playing-card">
      <div className="corner">
        {rank}
        <div style={{ fontSize: '1rem', marginTop: -6 }}>{suit}</div>
      </div>
      <div className="pip" aria-hidden>
        {suit || info.glyph}
      </div>
      <div className="role-name">{info.name}</div>
      <div className="role-short">{info.short}</div>
      <div className="corner br" aria-hidden>
        {rank}
        <div style={{ fontSize: '1rem', marginTop: -6 }}>{suit}</div>
      </div>
    </div>
  );
}

/** การ์ดที่พลิกได้ — ใช้ตอนจั่วไพ่และตอนออฟไลน์ */
export function FlipCard({ role, card, revealed }: { role: RoleId | null; card?: string | null; revealed: boolean }) {
  return (
    <div className={`flip${revealed && role ? ' revealed' : ''}`}>
      <div className="flip-inner">
        <div className="flip-face">
          <CardBack />
        </div>
        <div className="flip-face back">{role ? <RoleCard role={role} card={card} /> : <CardBack />}</div>
      </div>
    </div>
  );
}

export function DeckStack({ onDraw, disabled }: { onDraw?: () => void; disabled?: boolean }) {
  const inner = (
    <div className={`deck-stack${onDraw && !disabled ? ' drawable' : ''}`}>
      <div className="deck-card" />
      <div className="deck-card" />
      <div className="deck-card" />
    </div>
  );
  if (!onDraw) return inner;
  return (
    <button
      onClick={onDraw}
      disabled={disabled}
      style={{ all: 'unset', cursor: disabled ? 'not-allowed' : 'pointer', display: 'block' }}
      aria-label="จั่วไพ่จากกอง"
    >
      {inner}
    </button>
  );
}
