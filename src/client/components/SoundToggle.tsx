import { gameAudio } from '../audio/GameAudio';
import { useAudioSettings } from '../hooks/useGameAudio';

/** ปุ่มเปิด/ปิดเสียง + แถบปรับความดัง (จำค่าไว้ในเครื่องผู้ใช้) */
export function SoundToggle() {
  useAudioSettings();
  const muted = gameAudio.isMuted();

  return (
    <span className="sound-toggle">
      <button
        className="ghost"
        aria-pressed={!muted}
        title={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
        onClick={() => {
          gameAudio.unlock();
          gameAudio.toggleMuted();
        }}
      >
        <span aria-hidden>{muted ? '🔇' : '🔊'}</span>
        <span className="sr-only">{muted ? 'เปิดเสียง' : 'ปิดเสียง'}</span>
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(gameAudio.getVolume() * 100)}
        disabled={muted}
        aria-label="ความดังเสียง"
        onChange={(e) => {
          gameAudio.unlock();
          gameAudio.setVolume(Number(e.target.value) / 100);
        }}
      />
    </span>
  );
}
