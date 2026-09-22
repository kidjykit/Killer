import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientMessage, RoomView, ServerMessage } from '../../shared/types';

const ID_KEY = 'killer.playerId';
const NAME_KEY = 'killer.playerName';

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export const getSavedName = () => localStorage.getItem(NAME_KEY) ?? '';
export const saveName = (name: string) => localStorage.setItem(NAME_KEY, name);

export type ConnStatus = 'connecting' | 'open' | 'closed';

export function useRoom(code: string | undefined, name: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const closedRef = useRef(false);

  const send = useCallback((msg: ClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  useEffect(() => {
    if (!code || !name) return;
    closedRef.current = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keepAlive: ReturnType<typeof setInterval> | undefined;

    const connect = () => {
      if (closedRef.current) return;
      setStatus('connecting');
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${code}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setStatus('open');
        ws.send(JSON.stringify({ t: 'JOIN', name, playerId: getPlayerId() } satisfies ClientMessage));
        keepAlive = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send('{"t":"PING"}'), 25_000);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(String(event.data)) as ServerMessage;
        if (msg.t === 'STATE') {
          setView(msg.view);
          setError(null);
        } else if (msg.t === 'ERROR') {
          setError(msg.message);
        }
      };

      ws.onclose = () => {
        clearInterval(keepAlive);
        if (closedRef.current) return;
        setStatus('closed');
        // ต่อใหม่แบบถอยหลังทีละขั้น สูงสุด 10 วินาที
        const delay = Math.min(10_000, 800 * 2 ** retryRef.current++);
        timer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();
    return () => {
      closedRef.current = true;
      clearTimeout(timer);
      clearInterval(keepAlive);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [code, name]);

  return { view, status, error, send, clearError: () => setError(null) };
}

/** นับเวลาถอยหลังถึง deadline (epoch ms) */
export function useCountdown(deadline: number | null): number | null {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!deadline) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [deadline]);
  return left;
}
