/**
 * เทสต์ว่าห้องหมดอายุ/รีเซ็ต/ถูกลบจริงไหม  (ใช้เวลารันราว 45 วินาที)
 *
 *   node tools/test-room-expiry.mjs
 *
 * ของจริงตั้งไว้ 30 นาที/1 ชั่วโมง ซึ่งรอไม่ไหวในเทสต์
 * สคริปต์นี้จึงสลับ wrangler.toml เป็นค่าสั้น ๆ ชั่วคราว แล้วคืนค่าเดิมให้เสมอ
 */
import { spawn } from 'node:child_process';
import { copyFileSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = join(ROOT, 'wrangler.toml');
const BACKUP = join(ROOT, 'wrangler.toml.expiry-test-backup');
const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const WS = `ws://127.0.0.1:${PORT}`;
const RESET_S = 4;
const DELETE_S = 12;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✅' : '❌'} ${msg}`);
  if (!ok) fail++;
};

copyFileSync(CONFIG, BACKUP);
let server;
try {
  writeFileSync(
    CONFIG,
    readFileSync(CONFIG, 'utf8')
      .replace(/ROOM_IDLE_RESET_SECONDS = \d+/, `ROOM_IDLE_RESET_SECONDS = ${RESET_S}`)
      .replace(/ROOM_IDLE_DELETE_SECONDS = \d+/, `ROOM_IDLE_DELETE_SECONDS = ${DELETE_S}`),
  );

  console.log(`กำลังเปิด wrangler dev (รีเซ็ต ${RESET_S} วิ / ลบ ${DELETE_S} วิ)…`);
  server = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--local'], {
    cwd: ROOT,
    stdio: 'ignore',
  });

  let up = false;
  for (let i = 0; i < 60 && !up; i++) {
    await wait(2000);
    up = await fetch(BASE + '/').then((r) => r.ok).catch(() => false);
  }
  if (!up) throw new Error('เปิดเซิร์ฟเวอร์ไม่สำเร็จ');

  const newRoom = async () => (await (await fetch(BASE + '/api/rooms', { method: 'POST' })).json()).code;
  const connect = (code, name, id = crypto.randomUUID()) =>
    new Promise((res, rej) => {
      const ws = new WebSocket(`${WS}/api/rooms/${code}/ws`);
      const c = { name, id, ws, view: null, errors: [], closed: false };
      ws.onopen = () => ws.send(JSON.stringify({ t: 'JOIN', name, playerId: id }));
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.t === 'STATE') { c.view = m.view; res(c); }
        if (m.t === 'ERROR') { c.errors.push(m.message); res(c); }
      };
      ws.onclose = () => { c.closed = true; };
      setTimeout(() => rej(new Error('เชื่อมต่อไม่ได้')), 5000);
    });
  const send = (c, m) => c.ws.send(JSON.stringify(m));
  const seat = async (code, names) => {
    const cs = [];
    for (const n of names) { cs.push(await connect(code, n)); await wait(60); }
    await wait(250);
    return cs;
  };
  const startGame = async (cs) => {
    const [host, ...rest] = cs;
    send(host, { t: 'SET_SETTINGS', settings: { moderatorMode: 'HUMAN', nightSeconds: 0, discussionSeconds: 0 } });
    await wait(200);
    send(host, { t: 'CLAIM_MODERATOR', playerId: host.id });
    await wait(200);
    send(host, { t: 'START_GAME' });
    await wait(250);
    for (const p of rest) { send(p, { t: 'DRAW_CARD' }); await wait(80); }
    await wait(250);
    send(host, { t: 'BEGIN_NIGHT' });
    await wait(300);
    return host;
  };
  const NAMES = ['พิธีกร', 'เอ', 'บี', 'ซี', 'ดี', 'อี', 'เอฟ'];

  console.log(`\n[A] ห้องที่ยังเล่นอยู่ (ping ตลอด) — รอ ${DELETE_S + 4} วิ ต้องไม่โดนแตะ`);
  {
    const cs = await seat(await newRoom(), NAMES);
    const host = await startGame(cs);
    const ping = setInterval(() => cs.forEach((c) => !c.closed && send(c, { t: 'PING' })), 1200);
    await wait((DELETE_S + 4) * 1000);
    clearInterval(ping);
    check(host.view.phase === 'NIGHT', `ห้องยังอยู่เฟสเดิม (phase=${host.view.phase})`);
    check(host.view.players.length === NAMES.length, `ผู้เล่นยังครบ ${host.view.players.length} คน`);
    check(!cs.some((c) => c.closed), 'ไม่มีใครถูกตัดการเชื่อมต่อ');
    cs.forEach((c) => c.ws.close());
  }

  console.log(`\n[B] เกมค้างแล้วทุกคนหลุด — รอ ${RESET_S + 3} วิ ต้องเด้งกลับล็อบบี้`);
  {
    const code = await newRoom();
    const cs = await seat(code, NAMES);
    await startGame(cs);
    const stranger = await connect(code, 'คนใหม่');
    check(
      stranger.errors.some((e) => e.includes('เกมเริ่มไปแล้ว')),
      'ระหว่างเล่นอยู่ คนใหม่ยังเข้าไม่ได้ (ถูกต้อง)',
    );
    stranger.ws.close();
    cs.forEach((c) => c.ws.close());
    await wait((RESET_S + 3) * 1000);

    const after = await connect(code, 'คนใหม่หลังรีเซ็ต');
    check(after.view?.phase === 'LOBBY', `หลังรีเซ็ต คนใหม่เข้าได้ (phase=${after.view?.phase ?? after.errors[0]})`);
    check(after.view?.settings.discussionSeconds === 0, 'ยังจำกติกาของห้องไว้ ไม่ใช่ห้องใหม่');
    check(after.view?.players.length === 1, `ผู้เล่นที่หลุดถูกเอาออกหมด (เหลือ ${after.view?.players.length})`);
    after.ws.close();
  }

  console.log(`\n[C] ห้องร้าง — รอ ${DELETE_S + 3} วิ ต้องถูกลบทิ้ง`);
  {
    const code = await newRoom();
    const cs = await seat(code, ['เจ้าของห้อง', 'เพื่อน']);
    send(cs[0], { t: 'SET_SETTINGS', settings: { discussionSeconds: 77 } });
    await wait(300);
    check(cs[0].view.settings.discussionSeconds === 77, 'ตั้งค่าเฉพาะห้องไว้ก่อนทิ้งร้าง (77 วิ)');
    cs.forEach((c) => c.ws.close());
    await wait((DELETE_S + 3) * 1000);

    const fresh = await connect(code, 'คนมาใหม่');
    check(
      fresh.view?.settings.discussionSeconds === 180,
      `เปิดลิงก์เดิมได้ห้องใหม่เอี่ยม (${fresh.view?.settings.discussionSeconds} วิ)`,
    );
    check(fresh.view?.players.length === 1 && fresh.view.players[0].isHost, 'คนมาใหม่กลายเป็นเจ้าของห้อง');
    fresh.ws.close();
  }

  console.log(fail === 0 ? '\n✅ ผ่านทั้งหมด' : `\n❌ ไม่ผ่าน ${fail} ข้อ`);
} finally {
  server?.kill('SIGTERM');
  renameSync(BACKUP, CONFIG);
  console.log('คืนค่า wrangler.toml เดิมแล้ว');
}
process.exit(fail === 0 ? 0 : 1);
