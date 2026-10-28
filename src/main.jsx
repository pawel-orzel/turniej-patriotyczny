import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function initTurniej() {
  try {
    const container = document.getElementById('turniej-root') || document.getElementById('root');
    if (container) {
      if (!window.__turniej_react_root) {
        window.__turniej_react_root = createRoot(container);
      }
      window.__turniej_react_root.render(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    }
  } catch (err) {
    console.error('Błąd montowania Turnieju 2.0:', err);
  }
}

// Sprawdź czy użytkownik wszedł bezpośrednio do turnieju (np. z kodu QR stacji lub bezpośredniego linku)
function isTurniejRequestedDirectly() {
  try {
    const search = (typeof window !== 'undefined' && window.location && window.location.search) ? window.location.search : '';
    if (search.includes('modul=turniej') || search.includes('turniej=') || search.includes('station=')) {
      return true;
    }
    if (typeof window !== 'undefined' && window.initialParams) {
      const p = window.initialParams;
      if (p.modul === 'turniej' || p.turniej || p.station) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

if (isTurniejRequestedDirectly()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTurniej);
  } else {
    initTurniej();
  }
}

window.turniej_init = initTurniej;
