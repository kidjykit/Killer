import { useEffect, useRef, useSyncExternalStore } from 'react';
import { gameAudio } from '../audio/GameAudio';
import type { Ambience } from '../audio/GameAudio';
import type { RoomView } from '../../shared/types';

/** เพลงคลอของแต่ละช่วงในเกม */
const AMBIENCE_BY_PHASE: Record<RoomView['phase'], Ambience> = {
  LOBBY: 'none',
  DEALING: 'night',
  NIGHT: 'night',
  DAY_REPORT: 'day',
  DISCUSSION: 'day',
  VOTE: 'vote',
  VOTE_RESULT: 'day',
  ENDED: 'none',
};

/**
 * ผูกเสียงเข้ากับสถานะเกม — เล่นเสียงตอนเปลี่ยนช่วง และคลอเพลงพื้นหลังตามกลางวัน/กลางคืน
 * เรียกครั้งเดียวในหน้าห้องเล่นเกม
 */
export function useGameAudio(view: RoomView | null) {
  const lastKey = useRef<string | null>(null);
  const prevAlive = useRef<number | null>(null);
  const hadCard = useRef(false);

  useEffect(() => {
    if (!view) return;
    const aliveNow = view.players.filter((p) => p.alive && !p.isModerator).length;

    // กันเสียงซ้ำจาก re-render และจาก StrictMode ที่รัน effect สองรอบในโหมด dev
    const key = `${view.phase}:${view.round}`;
    if (lastKey.current !== key) {
      const first = lastKey.current === null;
      lastKey.current = key;
      gameAudio.setAmbience(AMBIENCE_BY_PHASE[view.phase]);

      // เข้าห้องมากลางเกมไม่ต้องยิงเสียงย้อนหลัง เล่นแค่เพลงคลอพอ
      if (!first) {
        switch (view.phase) {
          case 'DEALING':
            gameAudio.play('gameStart');
            break;
          case 'NIGHT':
            gameAudio.play('nightFall');
            break;
          case 'DAY_REPORT': {
            gameAudio.play('dayBreak');
            const died = prevAlive.current !== null && aliveNow < prevAlive.current;
            window.setTimeout(() => gameAudio.play(died ? 'death' : 'noDeath'), 900);
            break;
          }
          case 'VOTE':
            gameAudio.play('voteOpen');
            break;
          case 'VOTE_RESULT':
            if (view.voteReports.at(-1)?.eliminatedId) gameAudio.play('eliminate');
            break;
          case 'ENDED':
            gameAudio.play(view.winner?.faction === 'GOOD' ? 'winGood' : 'winEvil');
            break;
        }
      }
    }

    // เสียงจั่วไพ่ของตัวเอง
    if (view.yourCard && !hadCard.current) gameAudio.play('dealCard');
    hadCard.current = !!view.yourCard;

    prevAlive.current = aliveNow;
  }, [view]);

  // ดึงไฟล์เพลงมาเตรียมไว้ตั้งแต่เข้าห้อง จะได้ทันจังหวะเริ่มเกม
  useEffect(() => {
    gameAudio.preload();
    return () => gameAudio.stopAll();
  }, []);
}

/** อ่านสถานะเปิด/ปิดเสียงให้ React re-render ตาม */
export function useAudioSettings() {
  return useSyncExternalStore(
    (fn) => gameAudio.subscribe(fn),
    () => (gameAudio.isMuted() ? `m:${gameAudio.getVolume()}` : `s:${gameAudio.getVolume()}`),
    () => 's:0.35',
  );
}
