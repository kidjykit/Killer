import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MAX_PLAYERS, MIN_PLAYERS, deckFor } from '../../shared/roles';

const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

/** ตารางสรุปบทบาท 1 หน้า A4 สำหรับพิมพ์แจก */
export function PrintPage() {
  useEffect(() => {
    document.documentElement.dataset.mood = 'day';
  }, []);

  return (
    <div style={{ padding: '1rem 0' }}>
      <div className="wrap no-print row" style={{ justifyContent: 'space-between' }}>
        <Link to="/">← หน้าแรก</Link>
        <button className="primary" onClick={() => window.print()}>
          🖨️ พิมพ์ / บันทึกเป็น PDF
        </button>
      </div>

      <div className="sheet">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4mm', borderBottom: '1.5pt solid #000', paddingBottom: '2mm' }}>
          <h1 style={{ fontFamily: 'var(--display)', letterSpacing: '0.06em' }}>KILLER</h1>
          <div style={{ fontSize: '9pt' }}>
            เกมปาร์ตี้แนวจิตวิทยาแบบแจกไพ่ · {MIN_PLAYERS}–{MAX_PLAYERS} คน · 10–15 นาที · ตารางสรุป 1 หน้า
          </div>
        </div>

        <h2>1 · บทบาทจากไพ่</h2>
        <table>
          <thead>
            <tr>
              <th style={{ width: '10mm' }}>ไพ่</th>
              <th style={{ width: '28mm' }}>บทบาท</th>
              <th style={{ width: '14mm' }}>ฝ่าย</th>
              <th>หน้าที่</th>
              <th style={{ width: '55mm' }}>ทำอะไรตอนกลางคืน</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>K</b></td><td><b>Killer (ฆาตกร)</b></td><td>ฝ่ายร้าย</td>
              <td>ลอบกำจัดผู้เล่นคนอื่นคืนละ 1 คน แล้วกลืนไปกับชาวบ้านตอนกลางวัน</td>
              <td>ชี้เลือกเหยื่อ 1 คน (ถ้ามี 2 คนต้องเลือกตรงกัน)</td>
            </tr>
            <tr>
              <td><b>A</b></td><td><b>ตำรวจ (นักสืบ)</b></td><td>ฝ่ายดี</td>
              <td>สืบหาตัว Killer แล้วนำข้อมูลมาปกป้องประชาชน</td>
              <td>ชี้คนที่สงสัย พิธีกรพยักหน้า = ใช่ / ส่ายหน้า = ไม่ใช่</td>
            </tr>
            <tr>
              <td><b>Q</b></td><td><b>แม่ชี</b></td><td>ฝ่ายดี</td>
              <td>ชุบชีวิต/รักษาผู้เล่น 1 คน ถ้าตรงกับเหยื่อ คนนั้นไม่ตาย</td>
              <td>ชี้เลือกคนที่จะรักษา (เลือกตัวเองได้ตามกติกาที่ตกลง)</td>
            </tr>
            <tr>
              <td><b>J</b></td><td><b>โจร</b></td><td>ฝ่ายดี</td>
              <td>ถ้าปี้โดนตัวแม่ชี แม่ชีจะศีลขาดและรักษาใครไม่ได้ในคืนนั้น</td>
              <td>ชี้เลือกคนที่จะปี้ (ไม่โดนแม่ชี = ไม่มีอะไรเกิดขึ้น)</td>
            </tr>
            <tr>
              <td><b>2–10</b></td><td><b>ประชาชน</b></td><td>ฝ่ายดี</td>
              <td>ไม่มีพลังพิเศษ ใช้การสังเกต พูดคุย และโหวต</td>
              <td>— (หลับตาตลอดคืน)</td>
            </tr>
          </tbody>
        </table>

        <div className="cols" style={{ marginTop: '3mm' }}>
          <div>
            <h2>2 · จำนวนไพ่ตามจำนวนผู้เล่น</h2>
            <table>
              <thead>
                <tr><th>ผู้เล่น</th><th>K</th><th>A</th><th>Q</th><th>J</th><th>ประชาชน</th></tr>
              </thead>
              <tbody>
                {COUNTS.map((n) => {
                  const c = deckFor(n);
                  return (
                    <tr key={n}>
                      <td><b>{n} คน</b></td><td>{c.KILLER}</td><td>{c.POLICE}</td><td>{c.NUN}</td><td>{c.THIEF}</td><td>{c.VILLAGER}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p style={{ fontSize: '7.2pt', margin: '1.2mm 0 0' }}>
              * ไม่นับพิธีกรที่เป็นคนจริง (พิธีกรไม่รับไพ่) · Killer 2 คนต้องตกลงเหยื่อร่วมกัน
              ตกลงไม่ได้ใน 10 วินาที = คืนนั้นไม่มีใครตาย
            </p>
          </div>

          <div>
            <h2>3 · ลำดับกลางคืน (บทพิธีกร)</h2>
            <div className="box">
              <ol>
                <li>“ทุกคนหลับตา” (ให้ทุกคนเคาะโต๊ะกลบเสียง)</li>
                <li>“<b>Killer</b> ลืมตา เลือกเหยื่อ… Killer หลับตา”</li>
                <li>“<b>ตำรวจ</b> ลืมตา ชี้คนที่สงสัย” → พยักหน้า/ส่ายหน้า → “ตำรวจหลับตา”</li>
                <li>“<b>แม่ชี</b> ลืมตา เลือกคนที่จะรักษา… แม่ชีหลับตา”</li>
                <li>“<b>โจร</b> ลืมตา เลือกคนที่จะปี้… โจรหลับตา”</li>
                <li>“ทุกคนลืมตา” → ประกาศผล → อภิปราย → โหวต</li>
              </ol>
            </div>
            <div className="box" style={{ marginTop: '2.5mm' }}>
              <h3>เริ่มเล่นใน 30 วินาที</h3>
              <ol>
                <li>เลือกพิธีกร 1 คน (ไม่รับไพ่)</li>
                <li>คัดไพ่ตามตารางซ้าย สับให้ทั่ว แจกคนละ 1 ใบคว่ำหน้า</li>
                <li>เปิดดูไพ่ตัวเองเงียบ ๆ แล้วคว่ำเก็บไว้</li>
                <li>นั่งเป็นวงกลม พิธีกรเริ่มจากข้อ 1 ด้านบน</li>
              </ol>
            </div>
          </div>
        </div>

        <h2>4 · ตารางคิดผลกลางคืน (สำหรับพิธีกร)</h2>
        <table>
          <thead>
            <tr><th style={{ width: '28mm' }}>Killer ฆ่า</th><th style={{ width: '32mm' }}>แม่ชีรักษา</th><th style={{ width: '32mm' }}>โจรปี้โดนแม่ชี</th><th>ผลลัพธ์</th></tr>
          </thead>
          <tbody>
            <tr><td>A</td><td>A (คนเดียวกัน)</td><td>ไม่โดน</td><td><b>A รอด</b> — คืนนี้ไม่มีใครตาย</td></tr>
            <tr><td>A</td><td>A (คนเดียวกัน)</td><td><b>โดน</b></td><td><b>A ตาย</b> — แม่ชีศีลขาด รักษาไม่ขึ้น</td></tr>
            <tr><td>A</td><td>B (คนละคน)</td><td>ไม่โดน / โดน</td><td><b>A ตาย</b> — รักษาผิดคน</td></tr>
            <tr><td>A</td><td>ไม่ใช้สิทธิ์</td><td>ใดก็ตาม</td><td><b>A ตาย</b></td></tr>
            <tr><td>ไม่ได้เลือก / เลือกไม่ตรงกัน</td><td>ใดก็ตาม</td><td>ใดก็ตาม</td><td><b>ไม่มีใครตาย</b></td></tr>
          </tbody>
        </table>

        <div className="cols" style={{ marginTop: '3mm' }}>
          <div className="box">
            <h3>5 · เงื่อนไขการชนะ</h3>
            <ul>
              <li><b>ฝ่ายประชาชนชนะ</b> — กำจัด Killer ออกได้ครบทุกคน</li>
              <li><b>ฝ่าย Killer ชนะ</b> — ฝ่ายดีที่เหลือ ≤ จำนวน Killer (เช่น เหลือฝ่ายดีคนเดียว)</li>
            </ul>
            <p style={{ margin: '1.5mm 0 0' }}>ตรวจเงื่อนไขทุกครั้งที่มีคนตายหรือถูกโหวตออก</p>
          </div>
          <div className="box">
            <h3>6 · มารยาทการเล่น</h3>
            <ul>
              <li>ห้ามเปิดไพ่ของตัวเองให้ใครดู แม้ตายแล้ว</li>
              <li>คนตายพูดไม่ได้ ห้ามใบ้ด้วยวิธีใด ๆ</li>
              <li>โกหกได้ทุกคน ไม่ถือว่าโกง</li>
              <li>กลางคืนห้ามส่งเสียงและห้ามแอบมอง</li>
              <li>คะแนนโหวตเท่ากัน → แก้ตัวคนละ 30 วิ แล้วโหวตใหม่ เสมอซ้ำ = ไม่มีใครออก</li>
              <li>คำตัดสินของพิธีกรถือเป็นที่สิ้นสุด</li>
            </ul>
          </div>
        </div>

        <p style={{ fontSize: '7.2pt', marginTop: '3mm', borderTop: '0.5pt solid #999', paddingTop: '1.2mm' }}>
          กติกาฉบับเต็มอยู่ในไฟล์ rule.md · เล่นออนไลน์และแจกการ์ดออฟไลน์ได้ที่เว็บแอปเดียวกัน
        </p>
      </div>
    </div>
  );
}
