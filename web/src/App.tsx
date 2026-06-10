import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LiveVoiceSessionPage } from './pages/LiveVoiceSessionPage';
import { ShadowingPage } from './pages/ShadowingPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/live-voice" element={<LiveVoiceSessionPage />} />
        <Route path="/shadowing" element={<ShadowingPage />} />
        <Route path="*" element={<Navigate to="/live-voice" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
