// src/DebugVerify.jsx
// USE THIS TEMPORARILY TO DEBUG THE ISSUE
// Replace VerifyEmail import in App.jsx with this temporarily

import { useEffect, useState } from "react";
import VerifyEmail from "./VerifyEmail";

export default function DebugVerify({ onVerified }) {
  const [debugInfo, setDebugInfo] = useState({});

  useEffect(() => {
    const info = {
      hay_token: localStorage.getItem('hay_token') ? 'EXISTS' : 'MISSING',
      access_token: localStorage.getItem('access_token') ? 'EXISTS' : 'MISSING',
      user_email: localStorage.getItem('user_email') || 'MISSING',
      hay_user: localStorage.getItem('hay_user') ? 'EXISTS' : 'MISSING',
      dev_code: sessionStorage.getItem('dev_verification_code') || 'NONE',
      email_sent: sessionStorage.getItem('email_sent') || 'NONE',
      currentUrl: window.location.href,
    };
    setDebugInfo(info);
    console.log('=== DEBUG INFO ===', info);
  }, []);

  return (
    <div>
      {/* Debug Panel */}
      <div style={{
        position: 'fixed',
        top: 10,
        right: 10,
        background: '#000',
        color: '#0f0',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '11px',
        fontFamily: 'monospace',
        maxWidth: '300px',
        zIndex: 9999,
        border: '2px solid #0f0',
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#ff0' }}>
          🐛 DEBUG PANEL
        </div>
        {Object.entries(debugInfo).map(([key, value]) => (
          <div key={key} style={{ marginBottom: '5px' }}>
            <span style={{ color: '#0ff' }}>{key}:</span>{' '}
            <span style={{ color: '#fff' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Actual VerifyEmail Component */}
      <VerifyEmail onVerified={onVerified} />
    </div>
  );
}
