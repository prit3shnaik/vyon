import React from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{
      background: '#0a0a0a', color: '#00ffff',
      fontFamily: 'Orbitron, monospace', height: '100vh',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 16
    }}>
      <img src="/vyon-logo.png" style={{ width: 120, height: 120, objectFit: 'contain' }} />
      <h1 style={{ fontSize: 32, letterSpacing: 8, margin: 0 }}>VYON</h1>
      <p style={{ color: '#555', fontFamily: 'Fira Code', fontSize: 12 }}>Web3 Security Scanner — Loading...</p>
    </div>
  </React.StrictMode>
)