import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './features/auth/AuthContext';
import './index.css';

const rootElement = document.getElementById('root');

// 显式判空：与其让 createRoot(null) 抛一句看不懂的错，不如在这里说清楚原因
if (!rootElement) {
  throw new Error('index.html 里缺少 id="root" 的挂载节点');
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
