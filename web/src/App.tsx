import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LiveVoiceSessionPage } from './pages/LiveVoiceSessionPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/live-voice" element={<LiveVoiceSessionPage />} />
        <Route path="*" element={<Navigate to="/live-voice" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
