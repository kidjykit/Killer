import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { OfflinePage } from './pages/OfflinePage';
import { PrintPage } from './pages/PrintPage';
import { RoomPage } from './pages/RoomPage';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/room/:code" element={<RoomPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/print" element={<PrintPage />} />
        <Route path="*" element={<HomePage />} />
      </Routes>
    </Router>
  );
}
