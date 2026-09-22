import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSavedName, saveName, useCountdown, useRoom } from '../hooks/useRoom';
import { CardTable, type SeatDecor } from '../components/CardTable';
import { Chat } from '../components/Chat';
import { Lobby } from '../components/Lobby';
import { ModeratorNotes } from '../components/ModeratorNotes';
import { DeckStack, FlipCard } from '../components/PlayingCard';
import {
  DayPanel,
  DiscussionPanel,
  EndPanel,
  NightPanel,
  VotePanel,
  VoteResultPanel,
  YourCardPanel,
} from '../components/PhasePanels';
import { ROLES } from '../../shared/roles';
import type { Player, RoomView } from '../../shared/types';

function NameGate({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState(getSavedName());
  return (
    <div className="wrap narrow" style={{ paddingTop: '3rem' }}>
      <form
        className="card-panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          const n = name.trim();
          if (!n) return;
          saveName(n);
          onSubmit(n);
        }}
      >
        <h2 style={{ margin: 0 }}>ใส่ชื่อเล่นก่อนเข้าห้อง</h2>
        <input
          autoFocus
          value={name}
          maxLength={20}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ต้นไม้"
          aria-label="ชื่อเล่น"
        />
        <button className="primary block" type="submit" disabled={!name.trim()}>
          เข้าห้อง
        </button>
      </form>
    </div>
  );
}

/** ข้อความกลางโต๊ะ + ปุ่มจั่วไพ่ตอนเฟส DEALING */
function TableCenter({ view, onDraw }: { view: RoomView; onDraw: () => void }) {
  if (view.phase === 'DEALING') {
    const holders = view.players.filter((p) => !p.isModerator);
    // เห็นได้แค่ว่าเหลืออีกกี่คน ไม่บอกว่าเป็นใคร
    const waiting = holders.filter((p) => !p.role && p.id !== view.youId).length + (view.yourRole ? 0 : 1);
    if (view.isModerator) {
      return (
        <div className="stack" style={{ alignItems: 'center' }}>
          <DeckStack />
          <p className="small muted" style={{ margin: 0 }}>รอผู้เล่นจั่วไพ่ให้ครบ…</p>
        </div>
      );
    }
    if (!view.yourRole) {
      return (
        <div className="stack" style={{ alignItems: 'center' }}>
          <DeckStack onDraw={onDraw} />
          <p style={{ margin: 0, fontWeight: 700 }}>แตะกองไพ่เพื่อจั่วการ์ดของคุณ</p>
          <p className="small muted" style={{ margin: 0 }}>ห้ามให้คนอื่นเห็นไพ่ของคุณเด็ดขาด</p>
        </div>
      );
    }
    return (
      <div className="stack" style={{ alignItems: 'center' }}>
        <FlipCard role={view.yourRole} card={view.yourCard} revealed />
        <p className="small muted" style={{ margin: 0 }}>
          {waiting > 0 ? `รออีก ${waiting} คนจั่วไพ่…` : 'ทุกคนจั่วครบแล้ว รอพิธีกรเริ่มคืนแรก'}
        </p>
      </div>
    );
  }

  if (view.phase === 'NIGHT') {
    return (
      <div>
        <div style={{ fontSize: '2.6rem' }} aria-hidden>🌙</div>
        <p style={{ margin: 0, fontWeight: 700 }}>คืนที่ {view.round}</p>
        <p className="small muted" style={{ margin: 0 }}>ทุกคนหลับตา</p>
      </div>
    );
  }

  if (view.phase === 'LOBBY') {
    return (
      <div>
        <div style={{ fontSize: '2.6rem' }} aria-hidden>🃏</div>
        <p style={{ margin: 0, fontWeight: 700 }}>ห้อง {view.code}</p>
        <p className="small muted" style={{ margin: 0 }}>รอเพื่อน ๆ เข้ามาให้ครบ</p>
      </div>
    );
  }

  const alive = view.players.filter((p) => p.alive && !p.isModerator).length;
  return (
    <div>
      <div style={{ fontSize: '2.6rem' }} aria-hidden>☀️</div>
      <p style={{ margin: 0, fontWeight: 700 }}>รอบที่ {view.round}</p>
      <p className="small muted" style={{ margin: 0 }}>เหลือผู้เล่น {alive} คน</p>
    </div>
  );
}

export function RoomPage() {
  const { code = '' } = useParams();
  const [name, setName] = useState(getSavedName());
  const { view, status, error, send, clearError } = useRoom(name ? code.toUpperCase() : undefined, name);
  const secondsLeft = useCountdown(view?.deadline ?? null);

  // ธีมขาว–ดำสลับตามช่วงเวลาในเกม
  useEffect(() => {
    const night = view?.phase === 'NIGHT' || view?.phase === 'DEALING' || !view;
    document.documentElement.dataset.mood = night ? 'night' : 'day';
    return () => {
      document.documentElement.dataset.mood = 'day';
    };
  }, [view?.phase, view]);

  useEffect(() => {
    if (!error) return;
    const id = setTimeout(clearError, 4000);
    return () => clearTimeout(id);
  }, [error, clearError]);

  const [myVote, setMyVote] = useState<string | null>(null);
  useEffect(() => setMyVote(null), [view?.phase, view?.round]);

  const myNightPick = useMemo(() => {
    if (!view) return null;
    if (view.yourRole === 'KILLER') return view.killVotes[view.youId] ?? null;
    return null;
  }, [view]);
  const [localPick, setLocalPick] = useState<string | null>(null);
  useEffect(() => setLocalPick(null), [view?.nightStep, view?.round]);

  if (!name) return <NameGate onSubmit={setName} />;

  if (!view) {
    return (
      <div className="wrap narrow" style={{ paddingTop: '3rem' }}>
        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>{status === 'closed' ? 'กำลังต่อใหม่…' : 'กำลังเข้าห้อง…'}</h2>
          <p className="muted small" style={{ margin: 0 }}>รหัสห้อง {code.toUpperCase()}</p>
          {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
          <Link to="/">← กลับหน้าแรก</Link>
        </div>
      </div>
    );
  }

  const me = view.players.find((p) => p.id === view.youId);

  const decorate = (p: Player): SeatDecor => {
    const modTag =
      view.isModerator && p.role ? `${ROLES[p.role].rank} · ${ROLES[p.role].name}` : undefined;

    // กลางคืน: ถึงตาเราแล้วให้เลือกเป้าหมายได้
    if (view.phase === 'NIGHT' && view.actingPlayerIds.includes(view.youId) && !view.isModerator) {
      const selectable =
        p.alive &&
        !p.isModerator &&
        !(view.yourRole === 'KILLER' && view.fellowKillerIds.concat(view.youId).includes(p.id)) &&
        !(view.yourRole === 'POLICE' && p.id === view.youId);
      return {
        tag: modTag,
        selected: (localPick ?? myNightPick) === p.id,
        onSelect: selectable
          ? () => {
              setLocalPick(p.id);
              send({ t: 'NIGHT_ACTION', targetId: p.id });
            }
          : undefined,
      };
    }

    // โหวตกลางวัน
    if (view.phase === 'VOTE' && me?.alive && !me.isModerator) {
      return {
        tag: modTag,
        selected: myVote === p.id,
        onSelect:
          p.alive && !p.isModerator
            ? () => {
                setMyVote(p.id);
                send({ t: 'CAST_VOTE', targetId: p.id });
              }
            : undefined,
      };
    }

    return { tag: modTag };
  };

  const canBeginNight =
    (view.isModerator || (view.settings.moderatorMode === 'AUTO' && me?.isHost)) &&
    (view.phase === 'DEALING' || view.phase === 'DISCUSSION');

  return (
    <div className="wrap">
      {view.phase === 'NIGHT' && <div className="night-veil" aria-hidden />}

      <header className="row" style={{ marginBottom: '1rem' }}>
        <Link to="/" style={{ textDecoration: 'none', fontFamily: 'var(--display)', fontSize: '1.6rem' }}>
          KILLER
        </Link>
        <span className="badge mono">ห้อง {view.code}</span>
        <div className="spacer" />
        {status !== 'open' && <span className="badge">⚠️ กำลังต่อใหม่…</span>}
        {view.isModerator && <span className="badge solid">พิธีกร</span>}
      </header>

      {error && (
        <div className="card-panel" style={{ borderColor: 'var(--danger)', marginBottom: '1rem' }} role="alert">
          <span style={{ color: 'var(--danger)' }}>{error}</span>
        </div>
      )}

      <div className="room-grid">
        <div className="area-action stack">
          {view.phase === 'NIGHT' && <NightPanel view={view} send={send} secondsLeft={secondsLeft} />}
          {view.phase === 'DAY_REPORT' && <DayPanel view={view} send={send} />}
          {view.phase === 'DISCUSSION' && <DiscussionPanel view={view} send={send} secondsLeft={secondsLeft} />}
          {view.phase === 'VOTE' && <VotePanel view={view} send={send} />}
          {view.phase === 'VOTE_RESULT' && <VoteResultPanel view={view} send={send} />}
          {view.phase === 'ENDED' && <EndPanel view={view} send={send} />}
          {canBeginNight && (
            <button className="primary block" onClick={() => send({ t: 'BEGIN_NIGHT' })}>
              🌙 เข้าสู่คืนที่ {view.round + 1} — สั่งให้ทุกคนหลับตา
            </button>
          )}
        </div>

        <div className="area-table stack">
          <CardTable view={view} decorate={decorate} center={<TableCenter view={view} onDraw={() => send({ t: 'DRAW_CARD' })} />} />
          <div className="card-panel">
            <h3 style={{ margin: '0 0 0.4rem' }}>📜 บันทึกเหตุการณ์</h3>
            <div className="log">
              {view.publicLog.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        </div>

        <div className="area-side stack">
          {view.phase === 'LOBBY' && <Lobby view={view} send={send} />}
          <YourCardPanel view={view} />
          {view.isModerator && <ModeratorNotes view={view} />}
          <Chat view={view} onSend={(text, channel) => send({ t: 'CHAT', text, channel })} />
        </div>
      </div>
    </div>
  );
}

export { NameGate };
