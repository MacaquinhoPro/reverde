import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { lockPinchZoom } from './lib/viewport';
import './index.css';

// El zoom por pellizco se desactiva antes de pintar: en el mapa, el gesto
// alejaba la aplicación entera en vez de mover el mapa.
lockPinchZoom();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
