export { RoomDurableObject } from './RoomDurableObject';

export interface Env {
  ROOMS: DurableObjectNamespace;
  ASSETS: Fetcher;
}

/** ตัวอักษรที่อ่าน/พิมพ์/บอกปากเปล่าแล้วไม่สับสน (ตัด I, O, 0, 1 ออก) */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;

function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  return [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      return json({ code: makeCode() });
    }

    const match = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{3,12})(\/ws|\/exists)$/);
    if (match) {
      const code = match[1].toUpperCase();
      const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
      const forward = new URL(request.url);
      forward.searchParams.set('code', code);
      return stub.fetch(new Request(forward.toString(), request));
    }

    if (url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);

    // SPA fallback ทำที่ชั้น assets แล้ว (not_found_handling ใน wrangler.toml)
    return env.ASSETS.fetch(request);
  },
};
