import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Book from './pages/Book';
import ErrorBoundary from './components/ErrorBoundary';

// The admin panel is loaded only when someone opens /admin.
const Admin = lazy(() => import('./pages/Admin'));

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/zakazi" element={<Book />} />
        <Route
          path="/admin/*"
          element={
            <Suspense fallback={<div className="admin-loading">…</div>}>
              <Admin />
            </Suspense>
          }
        />
        <Route path="*" element={<Home />} />
      </Routes>
    </ErrorBoundary>
  );
}
