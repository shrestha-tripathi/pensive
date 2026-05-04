import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { Landing } from './components/Landing';

function isAppRoute() {
  return window.location.hash.startsWith('#/app');
}

function Root() {
  const [appRoute, setAppRoute] = useState(isAppRoute());
  useEffect(() => {
    const onHash = () => setAppRoute(isAppRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  // Scroll to top when switching surfaces
  useEffect(() => { window.scrollTo(0, 0); }, [appRoute]);
  return appRoute ? <App /> : <Landing />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
