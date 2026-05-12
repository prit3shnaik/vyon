import { useState } from 'react'
import { useScanStore } from './stores/scanStore'

type View = 'scan' | 'results' | 'settings'

function ScanPage() {
  const { status, progress, message, error, filePath, setFile, setAddress } = useScanStore()
  const [tab, setTab] = useState<'file'|'address'>('file')
  const [addr, setAddr] = useState('')
  const scanning = status === 'scanning'

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.sol')) setFile((f as any).path ?? f.name)
  }

  const handleScan = async () => {
    if (tab === 'address') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return
      setAddress(addr)
    }
    useScanStore.getState().setScanning()
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke('run_scan', {
        filePath: useScanStore.getState().filePath,
        contractAddress: useScanStore.getState().contractAddress,
        etherscanApiKey: null
      }) as any
      useScanStore.getState().setResult(result)
      const { useFindingsStore } = await import('./stores/findingsStore')
      useFindingsStore.getState().setFindings(result.findings)
    } catch(e) {
      useScanStore.getState().setError(String(e))
    }
  }

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:32,padding:32}}>
      <div style={{textAlign:'center'}}>
        <img src="/vyon-logo.png" alt="Vyon" style={{width:80,height:80,objectFit:'contain',filter:'drop-shadow(0 0 20px rgba(255,120,30,0.4))'}} />
        <h1 style={{color:'#00ffff',fontFamily:'Orbitron,monospace',letterSpacing:8,margin:'8px 0 4px',fontSize:28}}>VYON</h1>
        <p style={{color:'#333',fontSize:11,letterSpacing:3,margin:0}}>WEB3 SECURITY SCANNER</p>
      </div>

      <div style={{width:'100%',maxWidth:480,display:'flex',flexDirection:'column',gap:16}}>
        <div style={{display:'flex',border:'1px solid #1e1e1e',borderRadius:4,padding:2,alignSelf:'center'}}>
          {(['file','address'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'6px 20px',fontSize:11,fontFamily:'monospace',
              letterSpacing:2,textTransform:'uppercase' as const,
              background:tab===t?'#1a1a1a':'transparent',
              color:tab===t?'#00ffff':'#444',
              border:'none',borderRadius:3,cursor:'pointer'
            }}>
              {t==='file' ? '⬡ File' : '◈ Address'}
            </button>
          ))}
        </div>

        {tab==='file' ? (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            style={{border:'2px dashed #1e1e1e',borderRadius:8,padding:48,textAlign:'center',cursor:'pointer',background:'#0d0d0d'}}
            onClick={() => document.getElementById('fileInput')?.click()}
          >
            <input
              id="fileInput" type="file" accept=".sol"
              style={{display:'none'}}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) setFile((f as any).path ?? f.name)
              }}
            />
            {filePath
              ? <p style={{color:'#00ffff',fontFamily:'monospace',fontSize:13,margin:0}}>{filePath.split(/[/\\]/).pop()}</p>
              : <>
                  <p style={{fontSize:32,opacity:0.2,color:'#00ffff',margin:'0 0 8px'}}>⬡</p>
                  <p style={{color:'#555',fontSize:13,margin:0}}>Drop a <span style={{color:'#00ffff'}}>.sol</span> file or click to browse</p>
                </>
            }
          </div>
        ) : (
          <input
            value={addr}
            onChange={e => setAddr(e.target.value)}
            placeholder="0x..."
            style={{background:'#0d0d0d',border:'1px solid #1e1e1e',color:'#e0e0e0',fontFamily:'monospace',fontSize:13,padding:'10px 12px',borderRadius:4,outline:'none',width:'100%',boxSizing:'border-box' as const}}
          />
        )}

        <button
          onClick={handleScan}
          disabled={scanning || (tab==='file' && !filePath)}
          style={{
            alignSelf:'center',padding:'10px 40px',
            border:'1px solid #00ffff',color:'#00ffff',
            background:'transparent',fontFamily:'monospace',
            fontSize:12,letterSpacing:3,borderRadius:4,cursor:'pointer',
            opacity: scanning||(tab==='file'&&!filePath) ? 0.4 : 1
          }}
        >
          {scanning ? 'Scanning...' : '⬡ Run Scan'}
        </button>

        {status !== 'idle' && (
          <div>
            <div style={{height:1,background:'#1a1a1a',borderRadius:4,overflow:'hidden'}}>
              <div style={{
                height:'100%',
                width:`${progress}%`,
                background: status==='error' ? '#ff2d55' : '#00ffff',
                transition:'width 0.5s'
              }} />
            </div>
            <p style={{textAlign:'center',color:status==='error'?'#ff2d55':'#444',fontSize:11,fontFamily:'monospace',marginTop:8}}>
              {status==='error' ? error : message}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultsPage() {
  const { result } = useScanStore()
  const [selected, setSelected] = useState<number|null>(null)
  const [explanation, setExplanation] = useState<Record<number,string>>({})
  const [aiLoading, setAiLoading] = useState(false)

  if (!result) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',color:'#333',fontFamily:'monospace',fontSize:13}}>
      No results — run a scan first
    </div>
  )

  const { findings, risk_score, scan_duration_ms } = result
  const colors: Record<string,string> = {
    critical:'#ff2d55', high:'#ff6b35', medium:'#ffd60a',
    low:'#34c759', informational:'#636366', optimization:'#5e5ce6'
  }

  const handleAI = async (idx: number) => {
    const { useSettingsStore } = await import('./stores/settingsStore')
    const s = useSettingsStore.getState()
    const key = s.ai_provider==='openrouter' ? s.openrouter_key : s.ai_provider==='gemini' ? s.gemini_key : s.groq_key
    if (!key) { alert('Add an API key in Settings first'); return }
    setAiLoading(true)
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const r = await invoke('get_ai_explanation', {
        finding: findings[idx],
        provider: s.ai_provider,
        apiKey: key
      }) as string
      setExplanation(x => ({...x, [idx]: r}))
    } catch(e) {
      alert(String(e))
    } finally {
      setAiLoading(false)
    }
  }

  const metrics = [
    ['Risk', risk_score.label, colors[risk_score.label.toLowerCase()] ?? '#00ffff'],
    ['Critical', String(risk_score.critical_count), '#ff2d55'],
    ['High', String(risk_score.high_count), '#ff6b35'],
    ['Medium', String(risk_score.medium_count), '#ffd60a'],
    ['Low', String(risk_score.low_count), '#34c759'],
    ['Total', String(findings.length), '#00ffff'],
    ['Time', `${Math.round(scan_duration_ms/1000)}s`, '#555'],
  ]

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden'}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>

        <div style={{padding:'12px 16px',borderBottom:'1px solid #1a1a1a',display:'flex',gap:10,flexWrap:'wrap' as const}}>
          {metrics.map(([l,v,c]) => (
            <div key={l} style={{background:'#0d0d0d',border:`1px solid ${c}22`,borderRadius:4,padding:'8px 12px'}}>
              <div style={{fontSize:9,color:'#333',textTransform:'uppercase' as const,letterSpacing:2}}>{l}</div>
              <div style={{fontSize:16,fontWeight:'bold',color:c,fontFamily:'monospace'}}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto' as const}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead style={{position:'sticky' as const,top:0,background:'#080808'}}>
              <tr>
                {['Severity','Issue','Location','Tool'].map(h => (
                  <th key={h} style={{textAlign:'left' as const,padding:'8px 16px',fontSize:9,color:'#2a2a2a',textTransform:'uppercase' as const,letterSpacing:2,borderBottom:'1px solid #111',fontWeight:'normal'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i}
                  onClick={() => setSelected(selected===i ? null : i)}
                  style={{
                    borderBottom:'1px solid #0f0f0f',
                    cursor:'pointer',
                    background: selected===i ? 'rgba(0,255,255,0.03)' : 'transparent',
                    borderLeft: selected===i ? '2px solid #00ffff' : '2px solid transparent'
                  }}
                >
                  <td style={{padding:'8px 16px'}}>
                    <span style={{
                      fontSize:9,fontWeight:'bold',fontFamily:'monospace',
                      padding:'2px 6px',borderRadius:2,
                      color: colors[f.severity] ?? '#636366',
                      background: `${colors[f.severity] ?? '#636366'}20`
                    }}>
                      {f.severity.toUpperCase()}
                    </span>
                  </td>
                  <td style={{padding:'8px 16px',fontSize:12,color:'#bbb',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{f.title}</td>
                  <td style={{padding:'8px 16px',fontSize:10,color:'#444',fontFamily:'monospace'}}>{f.location ?? '-'}</td>
                  <td style={{padding:'8px 16px',fontSize:10,color:'#444'}}>{f.tool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected !== null && findings[selected] && (
        <div style={{width:280,borderLeft:'1px solid #1a1a1a',background:'#080808',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #111',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0}}>
              <span style={{
                fontSize:9,fontWeight:'bold',fontFamily:'monospace',
                padding:'2px 6px',borderRadius:2,
                color: colors[findings[selected].severity],
                background: `${colors[findings[selected].severity]}20`
              }}>
                {findings[selected].severity.toUpperCase()}
              </span>
              <p style={{fontSize:12,color:'#e0e0e0',marginTop:6,marginBottom:0}}>{findings[selected].title}</p>
            </div>
            <button onClick={() => setSelected(null)} style={{background:'none',border:'none',color:'#333',fontSize:18,cursor:'pointer',marginLeft:8}}>×</button>
          </div>

          <div style={{flex:1,overflowY:'auto' as const,padding:16,display:'flex',flexDirection:'column',gap:12}}>
            {[
              ['Tool', findings[selected].tool],
              ['Location', findings[selected].location ?? '-'],
              ['Description', findings[selected].description],
              ['Impact', findings[selected].impact],
              ['Recommendation', findings[selected].recommendation],
            ].map(([l, v]) => v ? (
              <div key={l}>
                <p style={{fontSize:9,color:'#2a2a2a',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:4,marginTop:0}}>{l}</p>
                <p style={{fontSize:10,color:'#555',lineHeight:1.6,fontFamily:'monospace',margin:0}}>{v}</p>
              </div>
            ) : null)}

            {findings[selected].code_snippet && (
              <div>
                <p style={{fontSize:9,color:'#2a2a2a',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:4,marginTop:0}}>Code</p>
                <pre style={{background:'#050505',border:'1px solid #111',borderRadius:3,padding:10,fontSize:9,color:'#444',overflow:'auto',fontFamily:'monospace',margin:0}}>
                  {findings[selected].code_snippet}
                </pre>
              </div>
            )}

            {explanation[selected] ? (
              <div>
                <p style={{fontSize:9,color:'#cc00cc',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:4,marginTop:0}}>⚡ AI Explanation</p>
                <p style={{fontSize:10,color:'#555',lineHeight:1.6,margin:0}}>{explanation[selected]}</p>
              </div>
            ) : (
              <button
                onClick={() => handleAI(selected)}
                disabled={aiLoading}
                style={{
                  padding:'8px 12px',border:'1px solid rgba(255,0,255,0.2)',
                  color:'#cc00cc',background:'transparent',
                  fontFamily:'monospace',fontSize:11,borderRadius:3,
                  cursor:'pointer',opacity:aiLoading?0.5:1
                }}
              >
                {aiLoading ? '⚡ Thinking...' : '⚡ Explain with AI'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPage() {
  const [keys, setKeys] = useState({openrouter:'',gemini:'',groq:'',etherscan:''})
  const [provider, setProvider] = useState<'openrouter'|'gemini'|'groq'>('openrouter')
  const [saved, setSaved] = useState(false)

  const save = async () => {
    const { useSettingsStore } = await import('./stores/settingsStore')
    const s = useSettingsStore.getState()
    s.setProvider(provider)
    s.setKey('openrouter', keys.openrouter)
    s.setKey('gemini', keys.gemini)
    s.setKey('groq', keys.groq)
    s.setKey('etherscan', keys.etherscan)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const providers = [
    {id:'openrouter' as const, label:'OpenRouter', sub:'Qwen 32B — Free · openrouter.ai/keys', ph:'sk-or-v1-...'},
    {id:'gemini' as const, label:'Google Gemini', sub:'Gemini 1.5 Flash — Free · aistudio.google.com', ph:'AIza...'},
    {id:'groq' as const, label:'GroqCloud', sub:'Llama 3 70B — Free · console.groq.com', ph:'gsk_...'},
  ]

  return (
    <div style={{padding:24,maxWidth:500,margin:'0 auto',overflowY:'auto' as const,height:'100%',boxSizing:'border-box' as const}}>
      <h2 style={{color:'#00ffff',fontFamily:'Orbitron,monospace',letterSpacing:4,fontSize:14,marginTop:0,marginBottom:24}}>SETTINGS</h2>

      <p style={{fontSize:10,color:'#333',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:12}}>AI Provider (All Free)</p>
      {providers.map(p => (
        <div key={p.id} onClick={() => setProvider(p.id)} style={{
          padding:'10px 14px',marginBottom:8,borderRadius:4,cursor:'pointer',
          display:'flex',alignItems:'center',gap:10,
          border: `1px solid ${provider===p.id ? 'rgba(0,255,255,0.3)' : '#1e1e1e'}`,
          background: provider===p.id ? 'rgba(0,255,255,0.03)' : '#0d0d0d'
        }}>
          <div style={{width:10,height:10,borderRadius:'50%',border:`2px solid ${provider===p.id?'#00ffff':'#2a2a2a'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            {provider===p.id && <div style={{width:5,height:5,borderRadius:'50%',background:'#00ffff'}} />}
          </div>
          <div>
            <p style={{fontSize:12,color:'#bbb',fontFamily:'monospace',margin:0}}>{p.label}</p>
            <p style={{fontSize:9,color:'#333',margin:0,marginTop:2}}>{p.sub}</p>
          </div>
        </div>
      ))}

      <p style={{fontSize:10,color:'#333',textTransform:'uppercase' as const,letterSpacing:2,margin:'20px 0 12px'}}>API Keys</p>
      {[...providers, {id:'etherscan' as const, label:'Etherscan (optional)', ph:'YourApiKey'}].map(p => (
        <div key={p.id} style={{marginBottom:12}}>
          <p style={{fontSize:9,color:'#444',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:4,marginTop:0}}>{p.label}</p>
          <input
            type="password"
            placeholder={p.ph}
            value={(keys as any)[p.id] ?? ''}
            onChange={e => setKeys(x => ({...x, [p.id]: e.target.value}))}
            style={{width:'100%',background:'#0d0d0d',border:'1px solid #1e1e1e',color:'#888',fontFamily:'monospace',fontSize:12,padding:'8px 12px',borderRadius:4,outline:'none',boxSizing:'border-box' as const}}
          />
        </div>
      ))}

      <button onClick={save} style={{marginTop:8,padding:'10px 32px',border:'1px solid #00ffff',color:'#00ffff',background:'transparent',fontFamily:'monospace',fontSize:12,letterSpacing:2,borderRadius:4,cursor:'pointer'}}>
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>

      <div style={{marginTop:24,padding:16,background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:4}}>
        <p style={{fontSize:9,color:'#333',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:8,marginTop:0}}>Install Security Tools</p>
        <pre style={{fontSize:10,color:'#555',fontFamily:'monospace',lineHeight:1.8,margin:0}}>
          {'pip install slither-analyzer mythril\npip install solc-select\nsolc-select install 0.8.20'}
        </pre>
      </div>
    </div>
  )
}

const NAV = [
  {id:'scan' as View, icon:'⬡', label:'Scan'},
  {id:'results' as View, icon:'◈', label:'Results'},
  {id:'settings' as View, icon:'⚙', label:'Settings'},
]

export default function App() {
  const [view, setView] = useState<View>('scan')
  const { status, result } = useScanStore()

  return (
    <div style={{display:'flex',height:'100vh',background:'#0a0a0a',color:'#c8c8d4',overflow:'hidden'}}>

      <aside style={{width:180,background:'#080808',borderRight:'1px solid #1a1a1a',display:'flex',flexDirection:'column',flexShrink:0}}>
        <div style={{padding:'16px 12px',borderBottom:'1px solid #111',display:'flex',alignItems:'center',gap:10}}>
          <img src="/vyon-logo.png" alt="" style={{width:32,height:32,objectFit:'contain',filter:'drop-shadow(0 0 8px rgba(255,120,30,0.5))'}} />
          <div>
            <p style={{color:'#00ffff',fontFamily:'Orbitron,monospace',fontSize:13,letterSpacing:3,margin:0}}>VYON</p>
            <p style={{color:'#1a1a1a',fontSize:8,letterSpacing:2,margin:0}}>WEB3 SECURITY</p>
          </div>
        </div>

        <nav style={{flex:1,paddingTop:8}}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,
              padding:'10px 16px',
              background: view===n.id ? 'rgba(0,255,255,0.03)' : 'transparent',
              borderTop:'none',borderRight:'none',borderBottom:'none',
              borderLeft: view===n.id ? '2px solid #00ffff' : '2px solid transparent',
              color: view===n.id ? '#00ffff' : '#444',
              cursor:'pointer',fontSize:12,fontFamily:'monospace',letterSpacing:1
            }}>
              <span>{n.icon}</span>
              {n.label}
              {n.id==='results' && result && (
                <span style={{marginLeft:'auto',fontSize:9,background:'rgba(0,255,255,0.08)',color:'#00ffff',padding:'1px 6px',borderRadius:2}}>
                  {result.findings.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{padding:'12px 16px',borderTop:'1px solid #111'}}>
          <p style={{fontSize:8,color:'#1a1a1a',textTransform:'uppercase' as const,letterSpacing:2,marginBottom:6,marginTop:0}}>Engine</p>
          {['Slither','Mythril'].map(t => (
            <div key={t} style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:status==='scanning'?'#00ffff':'#1e1e1e'}} />
              <span style={{fontSize:9,color:'#222'}}>{t}</span>
            </div>
          ))}
          <p style={{fontSize:8,color:'#111',marginTop:6,marginBottom:0}}>v0.2.0 · MIT</p>
        </div>
      </aside>

      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{height:40,borderBottom:'1px solid #111',display:'flex',alignItems:'center',padding:'0 16px',gap:12,flexShrink:0}}>
          <span style={{fontSize:10,color:'#2a2a2a',textTransform:'uppercase' as const,letterSpacing:2,flex:1}}>
            {view==='scan' ? 'Contract Scanner' : view==='results' ? `Results${result?.contract_name ? ` · ${result.contract_name}` : ''}` : 'Settings'}
          </span>
          {status==='scanning' && <span style={{fontSize:9,color:'#00ffff',fontFamily:'monospace'}}>● SCANNING</span>}
          {status==='done' && result && (
            <button onClick={() => setView('results')} style={{fontSize:9,padding:'4px 12px',border:'1px solid rgba(0,255,255,0.3)',color:'#00ffff',background:'transparent',borderRadius:3,cursor:'pointer',fontFamily:'monospace'}}>
              View Results →
            </button>
          )}
        </div>

        <div style={{flex:1,overflow:'hidden'}}>
          {view==='scan' && <ScanPage />}
          {view==='results' && <ResultsPage />}
          {view==='settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}
