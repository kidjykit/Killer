import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { gameAudio } from './audio/GameAudio';
import './styles/theme.css';

// เผื่อกรณีที่ผู้ใช้เข้าหน้าห้องตรง ๆ โดยไม่ได้กดปุ่มไหนเลย — แตะครั้งแรกที่ไหนก็ปลดล็อกเสียง
const unlockAudio = () => gameAudio.unlock();
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
