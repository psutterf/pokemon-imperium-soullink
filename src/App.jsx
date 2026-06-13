import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import RunLayout from './pages/RunLayout.jsx';
import Board from './pages/Board.jsx';
import BossGuide from './pages/BossGuide.jsx';
import BossDetail from './pages/BossDetail.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/run/:runId" element={<RunLayout />}>
        <Route index element={<Board />} />
        <Route path="bosses" element={<BossGuide />} />
        <Route path="bosses/:order" element={<BossDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
