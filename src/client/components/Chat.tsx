import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, RoomView } from '../../shared/types';

const LABELS: Record<ChatMessage['channel'], string> = {
  ALL: 'ห้องหลัก',
  KILLER: 'ห้อง Killer',
  DEAD: 'ห้องคนตาย',
};

export function Chat({ view, onSend }: { view: RoomView; onSend: (text: string, ch: ChatMessage['channel']) => void }) {
  const me = view.players.find((p) => p.id === view.youId);
  const channels: ChatMessage['channel'][] = ['ALL'];
  if (view.yourRole === 'KILLER' && me?.alive) channels.push('KILLER');
  if (me && (!me.alive || view.isModerator)) channels.push('DEAD');

  const [channel, setChannel] = useState<ChatMessage['channel']>('ALL');
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channels.includes(channel)) setChannel('ALL');
  }, [channels.join(','), channel]);

  const messages = view.chat.filter((m) => m.channel === channel);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, channel]);

  const blockedReason =
    channel === 'ALL' && view.privacyLock && !view.isModerator
      ? 'ช่วงกลางคืนห้ามพูดในห้องหลัก'
      : channel === 'ALL' && me && !me.alive && !view.isModerator
        ? 'ผู้เล่นที่ตายแล้วพูดในห้องหลักไม่ได้'
        : null;

  return (
    <div className="card-panel stack" style={{ gap: '0.6rem' }}>
      <div className="chat-tabs" role="tablist" aria-label="ห้องแชท">
        {channels.map((c) => (
          <button key={c} role="tab" aria-selected={channel === c} onClick={() => setChannel(c)}>
            {LABELS[c]}
          </button>
        ))}
      </div>

      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.length === 0 ? (
          <p className="muted small">ยังไม่มีข้อความใน{LABELS[channel]}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="chat-msg">
              <b>{m.name}:</b> {m.text}
            </div>
          ))
        )}
      </div>

      <form
        className="row"
        style={{ flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault();
          const t = text.trim();
          if (!t || blockedReason) return;
          onSend(t, channel);
          setText('');
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={blockedReason ?? `พิมพ์ข้อความใน${LABELS[channel]}…`}
          disabled={!!blockedReason}
          maxLength={400}
          aria-label="ข้อความ"
        />
        <button className="primary" type="submit" disabled={!!blockedReason || !text.trim()}>
          ส่ง
        </button>
      </form>
    </div>
  );
}
