import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.js';
import ErrorBoundary from './components/ErrorBoundary.js';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
