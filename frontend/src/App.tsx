import { useState } from 'react'
import { View } from '@/types'
import { useScanStore } from './stores/scanStore'
import { ScanPage } from './components/ScanPage'
import { ResultsPage } from './components/ResultsPage'
import { SettingsPage } from './components/SettingsPage'

const NAV: { id: View; icon: string; label: string }[] = [
  { id: 'scan',     icon: '⬡', label: 'Scan'     },
  { id: 'results',  icon: '◈', label: 'Results'  },
  { id: 'settings', icon: '⚙', label: 'Settings' },
]

export default function App() {
  const [view, setView] = useState<View>('scan')
  const { status, result } = useScanStore()

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-[#c8c8d4] font-body overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 bg-[#080808] border-r border-[#1a1a1a] flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-[#111] flex items-center gap-3">
          <img src="/vyon-logo.png" alt="Vyon" className="w-8 h-8 object-contain" style={{filter:'drop-shadow(0 0 8px rgba(255,120,30,0.5))'}} />
          <div>
            <p className="text-sm font-display text-cyan-DEFAULT tracking-[3px]">VYON</p>
            <p className="text-[8px] text-[#2a2a2a] tracking-widest">WEB3 SECURITY</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-xs tracking-wide transition-all"
              style={{
                color: view===n.id ? '#00ffff' : '#444',
                borderLeft: view===n.id ? '2px solid #00ffff' : '2px solid transparent',
                background: view===n.id ? 'rgba(0,255,255,0.03)' : 'transparent',
              }}>
              <span className="text-sm">{n.icon}</span>
              {n.label}
              {n.id==='results' && result && (
                <span className="ml-auto text-[8px] px-1.5 py-0.5 rounded font-mono"
                  style={{background:'rgba(0,255,255,0.08)',color:'#00ffff'}}>
                  {result.findings.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className="p-3 border-t border-[#111]">
          <p className="text-[8px] text-[#222] uppercase tracking-widest mb-1.5">Scan Engine</p>
          {(['Slither','Mythril'] as const).map(t => (
            <div key={t} className="flex items-center gap-2 py-0.5">
              <div className={`w-1.5 h-1.5 rounded-full ${status==='scanning' ? 'bg-cyan-DEFAULT animate-pulse' : 'bg-[#1e1e1e]'}`} />
              <span className="text-[9px] text-[#2a2a2a]">{t}</span>
            </div>
          ))}
          <p className="text-[8px] text-[#1a1a1a] mt-2">v0.1.9 · MIT</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-10 border-b border-[#111] flex items-center px-4 gap-3 shrink-0">
          <span className="text-[10px] text-[#2a2a2a] uppercase tracking-widest flex-1">
            {view === 'scan' ? 'Contract Scanner' : view === 'results' ? `Results${result?.contract_name ? ` · ${result.contract_name}` : ''}` : 'Settings'}
          </span>
          {status === 'scanning' && (
            <span className="text-[9px] text-cyan-DEFAULT font-mono animate-pulse">● SCANNING</span>
          )}
          {status === 'done' && result && (
            <button onClick={() => setView('results')}
              className="text-[9px] px-3 py-1 border border-cyan-DEFAULT/30 text-cyan-DEFAULT rounded hover:bg-cyan-glow transition-all font-mono">
              View Results →
            </button>
          )}
        </div>

        {/* View */}
        <div className="flex-1 overflow-hidden">
          {view === 'scan'     && <ScanPage />}
          {view === 'results'  && <ResultsPage />}
          {view === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}
