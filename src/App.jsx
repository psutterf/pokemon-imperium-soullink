import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import RunLayout from './pages/RunLayout.jsx';

// Route-level code splitting: the Board pulls in the save parser + 84 KB species
// table, and the Boss pages pull in the 378 KB boss dataset. Lazy-loading keeps
// each off the initial bundle so a page only downloads the data it actually uses.
const Board = lazy(() => import('./pages/Board.jsx'));
const BossGuide = lazy(() => import('./pages/BossGuide.jsx'));
const BossDetail = lazy(() => import('./pages/BossDetail.jsx'));

export default function App() {
  return (
    <Suspense fallback={<div className="route-loading">Loading…</div>}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/run/:runId" element={<RunLayout />}>
          <Route index element={<Board />} />
          <Route path="bosses" element={<BossGuide />} />
          <Route path="bosses/:order" element={<BossDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
