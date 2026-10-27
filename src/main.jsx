import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

function initTurniej() {
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTurniej);
} else {
  initTurniej();
}

window.turniej_init = initTurniej;
