import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (err: any) {
    console.error('[E-RIKON] Fatal mount error:', err);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:sans-serif;">
        <div style="max-width:440px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.1);text-align:center;">
          <h2 style="color:#0f172a;font-size:18px;font-weight:800;margin:0 0 8px 0;">Workstation Display Recovery</h2>
          <p style="color:#64748b;font-size:13px;line-height:1.5;margin:0 0 20px 0;">The application encountered an issue initializing display components. Your financial database and records remain secure.</p>
          <div style="background:#fee2e2;color:#991b1b;padding:12px;border-radius:12px;font-family:monospace;font-size:11px;text-align:left;overflow-x:auto;margin-bottom:20px;">
            ${err?.message || 'Render initialization error'}
          </div>
          <button onclick="window.location.reload()" style="background:#0d9488;color:#ffffff;border:none;padding:12px 24px;border-radius:12px;font-weight:700;font-size:13px;cursor:pointer;width:100%;">Reload Workstation</button>
        </div>
      </div>
    `;
  }
}
