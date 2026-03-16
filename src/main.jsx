import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingScreen from './components/LoadingScreen';
import { validateEnv } from './utils/envValidator';
import './index.css';

// Validate environment on startup
validateEnv();

// Lazy-load main App for faster initial paint
const App = lazy(() => import('./App.jsx'));

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <App />
      </Suspense>
    </ErrorBoundary>
  </React.StrictMode>,
);
