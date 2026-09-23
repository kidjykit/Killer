import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../shared/roles';
import { gameAudio } from '../audio/GameAudio';

export function HomePage() {
  const nav = useNavigate();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.mood = 'night';
  }, []);

  const createRoom = async () => {
    gameAudio.unlock();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/rooms', { method: 'POST' });
      if (!res.ok) throw new Error('สร้างห้องไม่สำเร็จ');
      const data = (await res.json()) as { code: string };
      nav(`/room/${data.code}`);
    } catch {
      setErr('สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง (ถ้ารันแบบ dev ต้องเปิด `npm run cf:dev` ควบคู่ด้วย)');
      setBusy(false);
    }
  };

  return (
    <div className="wrap narrow" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div className="stack">
        <div style={{ textAlign: 'center' }}>
          <h1 className="display">KILLER</h1>
          <p className="muted" style={{ margin: 0 }}>
            เกมปาร์ตี้แนวจิตวิทยาแบบแจกไพ่ · {MIN_PLAYERS}–{MAX_PLAYERS} คน · 10–15 นาที
          </p>
        </div>

        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>🌐 เล่นออนไลน์</h2>
          <p className="muted small" style={{ margin: 0 }}>
            สร้างห้องแล้วแชร์ลิงก์ให้เพื่อน ๆ เข้ามาเล่นห้องเดียวกัน
          </p>
          <button className="primary block" onClick={createRoom} disabled={busy}>
            {busy ? 'กำลังสร้างห้อง…' : 'สร้างห้องใหม่'}
          </button>
          {err && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{err}</p>}

          <form
            className="row"
            style={{ flexWrap: 'nowrap' }}
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c) nav(`/room/${c}`);
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ใส่รหัสห้อง เช่น K7M2Q"
              maxLength={12}
              aria-label="รหัสห้อง"
              className="mono"
            />
            <button type="submit" disabled={!code.trim()}>
              เข้าห้อง
            </button>
          </form>
        </div>

        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>📴 เล่นออฟไลน์</h2>
          <p className="muted small" style={{ margin: 0 }}>
            ไม่ได้พกไพ่ไปด้วย? ใช้มือถือเครื่องเดียวแจกบทบาทให้ทุกคน แล้วส่งเครื่องต่อกันไปทีละคน
          </p>
          <Link to="/offline" style={{ textDecoration: 'none' }}>
            <button className="block">แจกการ์ดด้วยมือถือเครื่องเดียว</button>
          </Link>
          <Link to="/print" style={{ textDecoration: 'none' }}>
            <button className="block ghost">ตารางสรุปบทบาท 1 หน้า (สำหรับพิมพ์)</button>
          </Link>
        </div>

        <div className="card-panel stack">
          <h2 style={{ margin: 0 }}>บทบาทในเกม</h2>
          <table>
            <tbody>
              <tr><td className="mono"><b>K</b></td><td>Killer (ฆาตกร)</td><td className="muted small">ลอบฆ่าคืนละ 1 คน</td></tr>
              <tr><td className="mono"><b>A</b></td><td>ตำรวจ</td><td className="muted small">สืบได้คืนละ 1 คน</td></tr>
              <tr><td className="mono"><b>Q</b></td><td>แม่ชี</td><td className="muted small">รักษาคืนละ 1 คน</td></tr>
              <tr><td className="mono"><b>J</b></td><td>โจร</td><td className="muted small">ปี้โดนแม่ชี = ศีลขาด</td></tr>
              <tr><td className="mono"><b>2–10</b></td><td>ประชาชน</td><td className="muted small">สังเกตและโหวต</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
