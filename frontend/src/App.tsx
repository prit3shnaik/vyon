import { useState, useEffect, useRef } from 'react'
import { useScanStore } from './stores/scanStore'

type View = 'scan' | 'results' | 'settings' | 'setup'
type Theme = 'dark' | 'light'
type ToolStatus = 'checking' | 'installed' | 'missing' | 'installing' | 'error'

const T = {
  dark: {
    bg:'#0b0d14',bg2:'#111520',bg3:'#161b2e',
    card:'rgba(255,255,255,0.03)',cardHover:'rgba(255,255,255,0.06)',
    border:'rgba(255,255,255,0.07)',borderHi:'rgba(180,150,80,0.5)',
    text:'#e8e6e0',textDim:'#7a7870',textMuted:'#3a3830',
    gold:'#c9a84c',goldGlow:'rgba(201,168,76,0.15)',goldDim:'#8a6f2e',
    cyan:'#4ec9d4',red:'#e05555',amber:'#d4903a',yellow:'#c9bc4c',
    green:'#4ec97a',purple:'#8a6ed4',
    glass:'rgba(11,13,20,0.85)',shadow:'0 8px 32px rgba(0,0,0,0.4)',
    shadowGold:'0 0 30px rgba(201,168,76,0.12)',
  },
  light: {
    bg:'#f0ede8',bg2:'#e8e4dc',bg3:'#ddd8cc',
    card:'rgba(255,255,255,0.7)',cardHover:'rgba(255,255,255,0.9)',
    border:'rgba(0,0,0,0.08)',borderHi:'rgba(140,100,30,0.5)',
    text:'#1a1a14',textDim:'#6a6858',textMuted:'#aaa898',
    gold:'#8a6520',goldGlow:'rgba(140,100,30,0.1)',goldDim:'#b8922e',
    cyan:'#2a8a94',red:'#c03030',amber:'#b46820',yellow:'#8a7a10',
    green:'#2a8a4a',purple:'#5a4ea4',
    glass:'rgba(240,237,232,0.9)',shadow:'0 8px 32px rgba(0,0,0,0.12)',
    shadowGold:'0 0 30px rgba(140,100,30,0.08)',
  }
}

// ── invoke helper ─────────────────────────────────────────
async function inv<T>(cmd: string, args?: Record<string,unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

// ── run shell command via Tauri shell plugin ──────────────
async function runCmd(program: string, args: string[]): Promise<{stdout:string;stderr:string;code:number}> {
  try {
    const { Command } = await import('@tauri-apps/plugin-shell')
    const cmd = Command.create(program, args)
    const out = await cmd.execute()
    return { stdout: out.stdout, stderr: out.stderr, code: out.code ?? 0 }
  } catch(e) {
    return { stdout: '', stderr: String(e), code: 1 }
  }
}

// ── TiltCard ──────────────────────────────────────────────
function TiltCard({ children, style, theme, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; theme: Theme; onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const t = T[theme]
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX-r.left)/r.width - 0.5
    const y = (e.clientY-r.top)/r.height - 0.5
    el.style.transform = `perspective(600px) rotateY(${x*12}deg) rotateX(${-y*12}deg) scale(1.02)`
    el.style.boxShadow = `${-x*12}px ${y*12}px 40px rgba(0,0,0,0.3), ${t.shadowGold}`
  }
  const onLeave = () => {
    const el = ref.current; if (!el) return
    el.style.transform = 'perspective(600px) rotateY(0) rotateX(0) scale(1)'
    el.style.boxShadow = t.shadow
  }
  return (
    <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} onClick={onClick}
      style={{background:t.card,border:`1px solid ${t.border}`,borderRadius:12,
        backdropFilter:'blur(12px)',transition:'transform 0.15s ease, box-shadow 0.15s ease',
        boxShadow:t.shadow,...style}}>
      {children}
    </div>
  )
}

// ── Animated background ───────────────────────────────────
function Background({ theme }: { theme: Theme }) {
  const t = T[theme]
  const nodes = Array.from({length:18},(_,i)=>({x:(i*73+15)%100,y:(i*47+20)%100,size:1+(i%3),delay:i*0.4}))
  return (
    <div style={{position:'fixed',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:0}}>
      <svg width="100%" height="100%" style={{position:'absolute',inset:0,opacity:theme==='dark'?0.15:0.08}}>
        <defs>
          <pattern id="hex" x="0" y="0" width="60" height="52" patternUnits="userSpaceOnUse">
            <polygon points="30,2 58,17 58,35 30,50 2,35 2,17" fill="none" stroke={t.gold} strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hex)"/>
        {nodes.map((n,i)=>(
          <circle key={i} cx={`${n.x}%`} cy={`${n.y}%`} r={n.size} fill={t.gold} opacity="0.6">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur={`${3+n.delay}s`} repeatCount="indefinite"/>
            <animate attributeName="r" values={`${n.size};${n.size*1.8};${n.size}`} dur={`${4+n.delay}s`} repeatCount="indefinite"/>
          </circle>
        ))}
        {nodes.slice(0,10).map((n,i)=>{
          const n2=nodes[(i+5)%nodes.length]
          return <line key={i} x1={`${n.x}%`} y1={`${n.y}%`} x2={`${n2.x}%`} y2={`${n2.y}%`} stroke={t.gold} strokeWidth="0.3" opacity="0.2"/>
        })}
      </svg>
      <div style={{position:'absolute',inset:0,background:theme==='dark'
        ?'radial-gradient(ellipse at 20% 50%, rgba(201,168,76,0.04) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(78,201,212,0.04) 0%, transparent 60%)'
        :'radial-gradient(ellipse at 20% 50%, rgba(140,100,30,0.06) 0%, transparent 60%)'}}/>
    </div>
  )
}

// ── Setup / Auto-installer page ───────────────────────────
function SetupPage({ theme, onDone }: { theme: Theme; onDone: () => void }) {
  const t = T[theme]

  const [tools, setTools] = useState<{
    slither: ToolStatus; slitherVersion: string
    mythril: ToolStatus; mythrilVersion: string
    python:  ToolStatus; pythonVersion: string
  }>({
    slither:'checking', slitherVersion:'',
    mythril:'checking', mythrilVersion:'',
    python:'checking',  pythonVersion:'',
  })

  const [log, setLog] = useState<string[]>([])
  const [installing, setInstalling] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  const addLog = (msg: string) => setLog(l => [...l, msg])

  const checkTools = async () => {
    // Check Python
    addLog('Checking Python...')
    const py = await runCmd('python3', ['--version'])
    const pyOk = py.code === 0
    const pyVer = py.stdout.trim() || py.stderr.trim()

    // Check Slither
    addLog('Checking Slither...')
    const sl = await runCmd('slither', ['--version'])
    const slOk = sl.code === 0
    const slVer = sl.stdout.trim() || sl.stderr.trim()

    // Check Mythril
    addLog('Checking Mythril...')
    const my = await runCmd('myth', ['version'])
    const myOk = my.code === 0
    const myVer = my.stdout.trim() || my.stderr.trim()

    setTools({
      python:  pyOk ? 'installed' : 'missing',  pythonVersion:  pyVer,
      slither: slOk ? 'installed' : 'missing',  slitherVersion: slVer,
      mythril: myOk ? 'installed' : 'missing',  mythrilVersion: myVer,
    })

    addLog(pyOk  ? `✓ Python: ${pyVer}`  : '✗ Python not found')
    addLog(slOk  ? `✓ Slither: ${slVer}` : '✗ Slither not found')
    addLog(myOk  ? `✓ Mythril: ${myVer}` : '✗ Mythril not found')

    if (slOk && myOk) {
      addLog('✓ All tools ready!')
      setAllDone(true)
    }
  }

  const installTools = async () => {
    setInstalling(true)
    addLog('')
    addLog('── Starting installation ──')

    // Install Slither
    if (tools.slither === 'missing') {
      addLog('Installing Slither...')
      setTools(s => ({...s, slither:'installing'}))
      const r = await runCmd('pip3', ['install', 'slither-analyzer', '--quiet'])
      if (r.code === 0) {
        addLog('✓ Slither installed!')
        setTools(s => ({...s, slither:'installed'}))
      } else {
        addLog(`✗ Slither failed: ${r.stderr.slice(0,100)}`)
        // Try pip instead of pip3
        addLog('Retrying with pip...')
        const r2 = await runCmd('pip', ['install', 'slither-analyzer', '--quiet'])
        if (r2.code === 0) {
          addLog('✓ Slither installed!')
          setTools(s => ({...s, slither:'installed'}))
        } else {
          addLog('✗ Slither install failed')
          setTools(s => ({...s, slither:'error'}))
        }
      }
    }

    // Install Mythril
    if (tools.mythril === 'missing') {
      addLog('Installing Mythril (this takes 2-3 min)...')
      setTools(s => ({...s, mythril:'installing'}))
      const r = await runCmd('pip3', ['install', 'mythril', '--quiet'])
      if (r.code === 0) {
        addLog('✓ Mythril installed!')
        setTools(s => ({...s, mythril:'installed'}))
      } else {
        addLog(`✗ Mythril failed: ${r.stderr.slice(0,100)}`)
        const r2 = await runCmd('pip', ['install', 'mythril', '--quiet'])
        if (r2.code === 0) {
          addLog('✓ Mythril installed!')
          setTools(s => ({...s, mythril:'installed'}))
        } else {
          addLog('✗ Mythril install failed')
          setTools(s => ({...s, mythril:'error'}))
        }
      }
    }

    // Install solc-select
    addLog('Installing solc-select...')
    await runCmd('pip3', ['install', 'solc-select', '--quiet'])
    addLog('Setting Solidity compiler...')
    await runCmd('solc-select', ['install', '0.8.20'])
    await runCmd('solc-select', ['use', '0.8.20'])
    addLog('✓ Solidity compiler ready')

    addLog('')
    addLog('── Installation complete ──')
    setInstalling(false)

    // Re-check
    await checkTools()
  }

  useEffect(() => { checkTools() }, [])
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log])

  const statusIcon = (s: ToolStatus) => {
    if (s==='checking')   return { icon:'◌', color:t.textMuted }
    if (s==='installed')  return { icon:'✓', color:t.green }
    if (s==='missing')    return { icon:'✗', color:t.red }
    if (s==='installing') return { icon:'◈', color:t.gold }
    if (s==='error')      return { icon:'!', color:t.amber }
    return { icon:'?', color:t.textMuted }
  }

  const needsInstall = tools.slither==='missing' || tools.mythril==='missing'
  const hasError = tools.slither==='error' || tools.mythril==='error'

  const toolList = [
    { name:'Python 3',  desc:'Required runtime',          status:tools.python,  version:tools.pythonVersion  },
    { name:'Slither',   desc:'Static analysis engine',    status:tools.slither, version:tools.slitherVersion },
    { name:'Mythril',   desc:'Symbolic execution engine', status:tools.mythril, version:tools.mythrilVersion },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      height:'100%',gap:24,padding:40,position:'relative',zIndex:1}}>

      {/* Header */}
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:8}}>⚙</div>
        <h2 style={{margin:0,fontSize:20,fontFamily:'Orbitron,monospace',letterSpacing:4,
          background:`linear-gradient(135deg,${t.gold},${t.cyan})`,
          WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
          FIRST TIME SETUP
        </h2>
        <p style={{color:t.textDim,fontSize:12,margin:'6px 0 0'}}>
          Vyon needs two security tools to scan contracts
        </p>
      </div>

      {/* Tool status cards */}
      <div style={{display:'flex',flexDirection:'column',gap:10,width:'100%',maxWidth:480}}>
        {toolList.map(tool => {
          const s = statusIcon(tool.status)
          return (
            <TiltCard key={tool.name} theme={theme} style={{padding:'14px 18px'}}>
              <div style={{display:'flex',alignItems:'center',gap:14}}>
                <div style={{
                  width:36,height:36,borderRadius:8,flexShrink:0,
                  background:`${s.color}15`,border:`1px solid ${s.color}33`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:16,color:s.color,fontWeight:700,
                  animation: tool.status==='installing'||tool.status==='checking' ? 'spin 1s linear infinite' : 'none',
                }}>
                  {s.icon}
                </div>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{fontSize:14,fontWeight:600,color:t.text}}>{tool.name}</span>
                    {tool.version && <span style={{fontSize:9,color:t.textMuted,fontFamily:'monospace'}}>{tool.version.slice(0,30)}</span>}
                  </div>
                  <p style={{fontSize:11,color:t.textDim,margin:0}}>{tool.desc}</p>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:s.color,textTransform:'uppercase',letterSpacing:1}}>
                  {tool.status==='checking'?'Checking..':
                   tool.status==='installing'?'Installing..':
                   tool.status==='installed'?'Ready':
                   tool.status==='error'?'Failed':'Missing'}
                </span>
              </div>
            </TiltCard>
          )
        })}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div ref={logRef} style={{
          width:'100%',maxWidth:480,maxHeight:120,overflowY:'auto',
          background:t.bg2,border:`1px solid ${t.border}`,borderRadius:8,
          padding:'10px 14px',fontFamily:'monospace',fontSize:10,
          color:t.textDim,lineHeight:1.8,
        }}>
          {log.map((l,i) => (
            <div key={i} style={{color:l.startsWith('✓')?t.green:l.startsWith('✗')?t.red:t.textDim}}>
              {l || '\u00a0'}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        {allDone ? (
          <button onClick={onDone} style={{
            padding:'14px 40px',
            background:`linear-gradient(135deg,${t.goldDim},${t.gold})`,
            border:'none',borderRadius:8,color:'#0b0d14',
            fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,
            letterSpacing:3,cursor:'pointer',
            boxShadow:`0 4px 20px ${t.goldGlow}`,
          }}>
            ⬡  LAUNCH VYON
          </button>
        ) : needsInstall && !installing ? (
          <>
            <button onClick={installTools} style={{
              padding:'14px 32px',
              background:`linear-gradient(135deg,${t.goldDim},${t.gold})`,
              border:'none',borderRadius:8,color:'#0b0d14',
              fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,
              letterSpacing:2,cursor:'pointer',
              boxShadow:`0 4px 20px ${t.goldGlow}`,
            }}>
              ⚙  AUTO INSTALL TOOLS
            </button>
            <button onClick={onDone} style={{
              padding:'14px 24px',
              background:'transparent',
              border:`1px solid ${t.border}`,borderRadius:8,color:t.textDim,
              fontFamily:'monospace',fontSize:11,cursor:'pointer',letterSpacing:1,
            }}>
              Skip (tools already installed)
            </button>
          </>
        ) : installing ? (
          <div style={{display:'flex',alignItems:'center',gap:10,color:t.gold,fontFamily:'monospace',fontSize:12}}>
            <span style={{animation:'spin 1s linear infinite',display:'inline-block'}}>◈</span>
            Installing... this may take a few minutes
          </div>
        ) : hasError ? (
          <>
            <button onClick={checkTools} style={{
              padding:'12px 24px',background:`linear-gradient(135deg,${t.goldDim},${t.gold})`,
              border:'none',borderRadius:8,color:'#0b0d14',fontFamily:'monospace',
              fontSize:11,cursor:'pointer',letterSpacing:1,
            }}>
              Retry Check
            </button>
            <button onClick={onDone} style={{
              padding:'12px 20px',background:'transparent',
              border:`1px solid ${t.border}`,borderRadius:8,color:t.textDim,
              fontFamily:'monospace',fontSize:11,cursor:'pointer',
            }}>
              Skip anyway
            </button>
          </>
        ) : null}
      </div>

      {/* Manual install fallback */}
      {(needsInstall||hasError) && !installing && (
        <p style={{fontSize:10,color:t.textMuted,textAlign:'center',maxWidth:400,lineHeight:1.6}}>
          If auto-install fails, open terminal and run:<br/>
          <code style={{color:t.gold,fontFamily:'monospace'}}>pip install slither-analyzer mythril</code>
        </p>
      )}
    </div>
  )
}

// ── Severity config ───────────────────────────────────────
const SEV = (t: typeof T['dark']) => ({
  critical:      {color:t.red,    label:'CRITICAL'},
  high:          {color:t.amber,  label:'HIGH'},
  medium:        {color:t.yellow, label:'MEDIUM'},
  low:           {color:t.green,  label:'LOW'},
  informational: {color:t.textDim,label:'INFO'},
  optimization:  {color:t.purple, label:'OPT'},
})

// ── Scan page ─────────────────────────────────────────────
function ScanPage({ theme }: { theme: Theme }) {
  const t = T[theme]
  const { status, progress, message, error, filePath, setFile, setAddress } = useScanStore()
  const [tab, setTab] = useState<'file'|'address'>('file')
  const [addr, setAddr] = useState('')
  const [drag, setDrag] = useState(false)
  const scanning = status === 'scanning'

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f?.name.endsWith('.sol')) setFile((f as any).path ?? f.name)
  }

  const handleScan = async () => {
    if (tab==='address') {
      if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return
      setAddress(addr)
    }
    useScanStore.getState().setScanning()
    try {
      const result = await inv<any>('run_scan', {
        filePath: useScanStore.getState().filePath,
        contractAddress: useScanStore.getState().contractAddress,
        etherscanApiKey: null,
      })
      useScanStore.getState().setResult(result)
      const { useFindingsStore } = await import('./stores/findingsStore')
      useFindingsStore.getState().setFindings(result.findings)
    } catch(e) {
      useScanStore.getState().setError(String(e))
    }
  }

  const fileName = filePath?.split(/[/\\]/).pop()

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      height:'100%',gap:32,padding:40,position:'relative',zIndex:1}}>

      <div style={{textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
        <div style={{width:100,height:100,borderRadius:20,
          background:`linear-gradient(135deg,${t.bg3},${t.bg2})`,
          border:`1px solid ${t.border}`,
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:`0 0 40px ${t.goldGlow},${t.shadow}`,
          backdropFilter:'blur(8px)',position:'relative',overflow:'hidden'}}>
          <img src="/vyon-logo.png" alt="Vyon"
            style={{width:80,height:80,objectFit:'contain',position:'relative',zIndex:1}}
            onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
          <div style={{position:'absolute',inset:0,background:`radial-gradient(circle at 50% 50%,${t.goldGlow},transparent 70%)`}}/>
        </div>
        <div>
          <h1 style={{margin:0,fontSize:34,letterSpacing:12,fontFamily:'Orbitron,monospace',fontWeight:700,
            background:`linear-gradient(135deg,${t.gold},${t.cyan})`,
            WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>VYON</h1>
          <p style={{margin:'4px 0 0',fontSize:11,color:t.textMuted,letterSpacing:4,textTransform:'uppercase'}}>Web3 Security Scanner</p>
        </div>
      </div>

      <TiltCard theme={theme} style={{width:'100%',maxWidth:520,padding:28}}>
        <div style={{display:'flex',gap:4,marginBottom:20,background:t.bg2,padding:4,borderRadius:8}}>
          {(['file','address'] as const).map(tb=>(
            <button key={tb} onClick={()=>setTab(tb)} style={{
              flex:1,padding:'8px 0',fontSize:12,fontFamily:'monospace',
              letterSpacing:2,textTransform:'uppercase',
              background:tab===tb?`linear-gradient(135deg,${t.goldGlow},${t.bg3})`:'transparent',
              color:tab===tb?t.gold:t.textDim,
              border:tab===tb?`1px solid ${t.borderHi}`:'1px solid transparent',
              borderRadius:6,cursor:'pointer',transition:'all 0.2s',
            }}>
              {tb==='file'?'⬡  File':'◈  Address'}
            </button>
          ))}
        </div>

        {tab==='file'?(
          <div onDrop={handleDrop}
            onDragOver={e=>{e.preventDefault();setDrag(true)}}
            onDragLeave={()=>setDrag(false)}
            onClick={()=>document.getElementById('fi')?.click()}
            style={{border:`2px dashed ${drag?t.gold:t.border}`,borderRadius:10,
              padding:40,textAlign:'center',cursor:'pointer',
              background:drag?t.goldGlow:t.bg2,transition:'all 0.2s'}}>
            <input id="fi" type="file" accept=".sol" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(f)setFile((f as any).path??f.name)}}/>
            {filePath?(
              <div>
                <div style={{fontSize:32,marginBottom:8}}>📄</div>
                <p style={{color:t.gold,fontFamily:'monospace',fontSize:13,margin:0}}>{fileName}</p>
                <p style={{color:t.textMuted,fontSize:11,margin:'4px 0 0'}}>Click to replace</p>
              </div>
            ):(
              <div>
                <div style={{fontSize:40,marginBottom:8,color:t.gold,opacity:0.3}}>⬡</div>
                <p style={{color:t.textDim,fontSize:13,margin:0}}>Drop a <span style={{color:t.gold,fontWeight:600}}>.sol</span> file here</p>
                <p style={{color:t.textMuted,fontSize:11,margin:'4px 0 0'}}>or click to browse</p>
              </div>
            )}
          </div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            <p style={{fontSize:10,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:0}}>Contract Address</p>
            <input value={addr} onChange={e=>setAddr(e.target.value)} placeholder="0x..."
              style={{background:t.bg2,border:`1px solid ${t.border}`,color:t.text,
                fontFamily:'monospace',fontSize:13,padding:'12px 14px',borderRadius:8,
                outline:'none',transition:'border-color 0.2s',boxSizing:'border-box',width:'100%'}}
              onFocus={e=>e.target.style.borderColor=t.gold}
              onBlur={e=>e.target.style.borderColor=t.border}/>
          </div>
        )}

        <button onClick={handleScan}
          disabled={scanning||(tab==='file'&&!filePath)}
          style={{width:'100%',marginTop:20,padding:'14px 0',
            background:scanning?t.bg3:`linear-gradient(135deg,${t.goldDim},${t.gold})`,
            border:'none',borderRadius:8,
            color:scanning?t.textDim:'#0b0d14',
            fontFamily:'Orbitron,monospace',fontSize:12,fontWeight:700,
            letterSpacing:3,cursor:scanning?'not-allowed':'pointer',
            opacity:(scanning||(tab==='file'&&!filePath))&&!scanning?0.5:1,
            transition:'all 0.2s',
            boxShadow:scanning?'none':`0 4px 20px ${t.goldGlow}`}}>
          {scanning?'◈  SCANNING...':'⬡  RUN SECURITY SCAN'}
        </button>

        {status!=='idle'&&(
          <div style={{marginTop:16}}>
            <div style={{height:3,background:t.bg2,borderRadius:4,overflow:'hidden',marginBottom:8}}>
              <div style={{height:'100%',width:`${progress}%`,
                background:status==='error'?t.red:`linear-gradient(90deg,${t.goldDim},${t.gold},${t.cyan})`,
                borderRadius:4,transition:'width 0.5s ease',
                boxShadow:status==='error'?'none':`0 0 10px ${t.goldGlow}`}}/>
            </div>
            <p style={{textAlign:'center',fontSize:11,fontFamily:'monospace',
              color:status==='error'?t.red:t.textDim,margin:0}}>
              {status==='error'?`⚠ ${error}`:message}
            </p>
          </div>
        )}
      </TiltCard>

      <div style={{display:'flex',gap:12,flexWrap:'wrap',justifyContent:'center'}}>
        {['Slither Analysis','Mythril Execution','AI Explanations','Free & Open Source'].map(l=>(
          <span key={l} style={{fontSize:10,color:t.textDim,border:`1px solid ${t.border}`,
            padding:'4px 12px',borderRadius:20,background:t.card,
            backdropFilter:'blur(8px)',letterSpacing:1}}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// ── Results page ──────────────────────────────────────────
function ResultsPage({ theme }: { theme: Theme }) {
  const t = T[theme]
  const sev = SEV(t)
  const { result } = useScanStore()
  const [selected, setSelected] = useState<number|null>(null)
  const [explanation, setExplanation] = useState<Record<number,string>>({})
  const [aiLoading, setAiLoading] = useState(false)

  if (!result) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',
      justifyContent:'center',height:'100%',gap:16,position:'relative',zIndex:1}}>
      <div style={{fontSize:48,opacity:0.2}}>◈</div>
      <p style={{color:t.textMuted,fontFamily:'monospace',fontSize:13,margin:0}}>No results yet</p>
      <p style={{color:t.textMuted,fontSize:11,margin:0}}>Run a scan first</p>
    </div>
  )

  const { findings, risk_score, scan_duration_ms, tools_used } = result
  const rColor = risk_score.label==='Critical'?t.red:risk_score.label==='High'?t.amber:risk_score.label==='Medium'?t.yellow:t.green

  const handleAI = async (idx: number) => {
    const { useSettingsStore } = await import('./stores/settingsStore')
    const s = useSettingsStore.getState()
    const key = s.ai_provider==='openrouter'?s.openrouter_key:s.ai_provider==='gemini'?s.gemini_key:s.groq_key
    if (!key) { alert('Add API key in Settings'); return }
    setAiLoading(true)
    try {
      const r = await inv<string>('get_ai_explanation',{finding:findings[idx],provider:s.ai_provider,apiKey:key})
      setExplanation(x=>({...x,[idx]:r}))
    } catch(e) { alert(String(e)) }
    finally { setAiLoading(false) }
  }

  return (
    <div style={{display:'flex',height:'100%',overflow:'hidden',position:'relative',zIndex:1}}>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        <div style={{padding:'16px 20px',borderBottom:`1px solid ${t.border}`,
          display:'flex',gap:12,flexWrap:'wrap',
          background:t.glass,backdropFilter:'blur(12px)'}}>
          <TiltCard theme={theme} style={{padding:'12px 20px',minWidth:120}}>
            <div style={{fontSize:9,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,marginBottom:4}}>Risk</div>
            <div style={{fontSize:22,fontWeight:700,color:rColor,fontFamily:'Orbitron,monospace',
              textShadow:`0 0 20px ${rColor}66`}}>{risk_score.label}</div>
            <div style={{marginTop:6,height:2,background:t.bg2,borderRadius:2,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${risk_score.score}%`,background:rColor,borderRadius:2}}/>
            </div>
          </TiltCard>

          {([['Critical',risk_score.critical_count,t.red],['High',risk_score.high_count,t.amber],
            ['Medium',risk_score.medium_count,t.yellow],['Low',risk_score.low_count,t.green]] as const
          ).map(([l,v,c])=>(
            <TiltCard key={l} theme={theme} style={{padding:'12px 16px',minWidth:70,textAlign:'center'}}>
              <div style={{fontSize:9,color:String(c),textTransform:'uppercase',letterSpacing:1,marginBottom:2}}>{l}</div>
              <div style={{fontSize:24,fontWeight:700,color:String(c),fontFamily:'monospace'}}>{v}</div>
            </TiltCard>
          ))}

          <TiltCard theme={theme} style={{padding:'12px 16px'}}>
            <div style={{fontSize:9,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,marginBottom:4}}>Verdict</div>
            <div style={{fontSize:14,fontWeight:700,
              color:risk_score.critical_count>0||risk_score.high_count>0?t.red:t.green}}>
              {risk_score.critical_count>0||risk_score.high_count>0?'⛔ NO-GO':'✅ GO'}
            </div>
            <div style={{fontSize:10,color:t.textMuted,marginTop:2}}>
              {Math.round(scan_duration_ms/1000)}s · {tools_used.join(', ')}
            </div>
          </TiltCard>
        </div>

        <div style={{flex:1,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead style={{position:'sticky',top:0,background:t.glass,backdropFilter:'blur(12px)'}}>
              <tr>{['Severity','Issue','Location','Tool'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'10px 20px',fontSize:9,
                  color:t.textMuted,textTransform:'uppercase',letterSpacing:2,
                  borderBottom:`1px solid ${t.border}`,fontWeight:'normal'}}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {findings.map((f,i)=>{
                const sc=(sev as any)[f.severity]??sev.informational
                const isSel=selected===i
                return (
                  <tr key={i} onClick={()=>setSelected(isSel?null:i)}
                    style={{borderBottom:`1px solid ${t.border}`,cursor:'pointer',
                      background:isSel?t.goldGlow:'transparent',
                      borderLeft:isSel?`3px solid ${t.gold}`:'3px solid transparent',
                      transition:'all 0.15s'}}
                    onMouseEnter={e=>{ if(!isSel) e.currentTarget.style.background=t.cardHover }}
                    onMouseLeave={e=>{ e.currentTarget.style.background=isSel?t.goldGlow:'transparent' }}>
                    <td style={{padding:'10px 20px'}}>
                      <span style={{fontSize:9,fontWeight:700,fontFamily:'monospace',
                        padding:'3px 8px',borderRadius:3,letterSpacing:1,
                        color:sc.color,background:`${sc.color}18`,border:`1px solid ${sc.color}33`}}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{padding:'10px 20px',fontSize:12,color:t.text,maxWidth:250,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.title}</td>
                    <td style={{padding:'10px 20px',fontSize:10,color:t.textDim,fontFamily:'monospace'}}>{f.location??'-'}</td>
                    <td style={{padding:'10px 20px',fontSize:10,color:t.textDim}}>{f.tool}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selected!==null&&findings[selected]&&(()=>{
        const f=findings[selected]
        const sc=(sev as any)[f.severity]??sev.informational
        return (
          <div style={{width:300,borderLeft:`1px solid ${t.border}`,
            background:t.glass,backdropFilter:'blur(16px)',
            display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`1px solid ${t.border}`,
              display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:9,fontWeight:700,fontFamily:'monospace',
                  padding:'3px 8px',borderRadius:3,
                  color:sc.color,background:`${sc.color}18`,border:`1px solid ${sc.color}33`}}>
                  {sc.label}
                </span>
                <p style={{fontSize:13,color:t.text,margin:'8px 0 0',lineHeight:1.4,fontWeight:600}}>{f.title}</p>
                <p style={{fontSize:10,color:t.textMuted,margin:'2px 0 0',fontFamily:'monospace'}}>{f.id}</p>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'none',
                border:`1px solid ${t.border}`,color:t.textDim,
                width:28,height:28,borderRadius:6,cursor:'pointer',fontSize:14,
                display:'flex',alignItems:'center',justifyContent:'center',marginLeft:8,flexShrink:0}}>×</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'flex',flexDirection:'column',gap:14}}>
              {[['Tool',f.tool+(f.swc_id?` · ${f.swc_id}`:'')],
                ['Location',f.location??'-'],
                ['Description',f.description],
                ['Impact',f.impact],
                ['Recommendation',f.recommendation],
              ].map(([l,v])=>v?(
                <div key={String(l)}>
                  <p style={{fontSize:9,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:'0 0 4px'}}>{l}</p>
                  <p style={{fontSize:11,color:t.textDim,lineHeight:1.6,margin:0,
                    fontFamily:l==='Tool'||l==='Location'?'monospace':'inherit'}}>{v}</p>
                </div>
              ):null)}
              {f.code_snippet&&(
                <div>
                  <p style={{fontSize:9,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:'0 0 6px'}}>Code</p>
                  <pre style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:6,
                    padding:12,fontSize:9,color:t.textDim,overflow:'auto',
                    fontFamily:'monospace',margin:0,lineHeight:1.6,maxHeight:140}}>{f.code_snippet}</pre>
                </div>
              )}
              {explanation[selected]?(
                <div style={{background:t.bg3,border:`1px solid ${t.border}`,borderRadius:8,padding:12}}>
                  <p style={{fontSize:9,color:t.gold,textTransform:'uppercase',letterSpacing:2,margin:'0 0 6px'}}>⚡ AI Explanation</p>
                  <p style={{fontSize:11,color:t.textDim,lineHeight:1.6,margin:0}}>{explanation[selected]}</p>
                </div>
              ):(
                <button onClick={()=>handleAI(selected!)} disabled={aiLoading} style={{
                  padding:'10px 14px',
                  background:`linear-gradient(135deg,rgba(201,168,76,0.08),rgba(201,168,76,0.04))`,
                  border:`1px solid ${t.goldDim}55`,color:t.gold,
                  fontFamily:'monospace',fontSize:11,borderRadius:8,
                  cursor:'pointer',letterSpacing:1,opacity:aiLoading?0.5:1,transition:'all 0.2s'}}>
                  {aiLoading?'⚡ Thinking...':'⚡ Explain with AI'}
                </button>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────
function SettingsPage({ theme }: { theme: Theme }) {
  const t = T[theme]
  const [keys,setKeys] = useState({openrouter:'',gemini:'',groq:'',etherscan:''})
  const [provider,setProvider] = useState<'openrouter'|'gemini'|'groq'>('openrouter')
  const [saved,setSaved] = useState(false)

  const save = async () => {
    const { useSettingsStore } = await import('./stores/settingsStore')
    const s = useSettingsStore.getState()
    s.setProvider(provider)
    Object.entries(keys).forEach(([k,v])=>s.setKey(k,v))
    setSaved(true); setTimeout(()=>setSaved(false),2000)
  }

  const providers = [
    {id:'openrouter' as const,label:'OpenRouter',sub:'Qwen 32B · Free · openrouter.ai/keys',ph:'sk-or-v1-...'},
    {id:'gemini' as const,label:'Google Gemini',sub:'Gemini 1.5 Flash · Free · aistudio.google.com',ph:'AIza...'},
    {id:'groq' as const,label:'GroqCloud',sub:'Llama 3 70B · Free · console.groq.com',ph:'gsk_...'},
  ]

  return (
    <div style={{padding:28,maxWidth:560,margin:'0 auto',overflowY:'auto',
      height:'100%',boxSizing:'border-box',position:'relative',zIndex:1}}>
      <h2 style={{color:t.gold,fontFamily:'Orbitron,monospace',letterSpacing:4,fontSize:16,margin:'0 0 28px',
        background:`linear-gradient(135deg,${t.gold},${t.cyan})`,
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>SETTINGS</h2>

      <p style={{fontSize:10,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:'0 0 12px'}}>AI Provider</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:24}}>
        {providers.map(p=>(
          <TiltCard key={p.id} theme={theme} onClick={()=>setProvider(p.id)} style={{
            padding:'12px 16px',cursor:'pointer',
            border:`1px solid ${provider===p.id?t.borderHi:t.border}`,
            background:provider===p.id?t.goldGlow:t.card}}>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <div style={{width:16,height:16,borderRadius:'50%',
                border:`2px solid ${provider===p.id?t.gold:t.border}`,
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {provider===p.id&&<div style={{width:8,height:8,borderRadius:'50%',background:t.gold}}/>}
              </div>
              <div>
                <p style={{fontSize:13,color:t.text,margin:0,fontWeight:600}}>{p.label}</p>
                <p style={{fontSize:10,color:t.textMuted,margin:0,marginTop:2}}>{p.sub}</p>
              </div>
            </div>
          </TiltCard>
        ))}
      </div>

      <p style={{fontSize:10,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:'0 0 12px'}}>API Keys</p>
      <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:24}}>
        {[...providers,{id:'etherscan' as const,label:'Etherscan (optional)',ph:'YourApiKey'}].map(p=>(
          <div key={p.id}>
            <p style={{fontSize:9,color:t.textMuted,textTransform:'uppercase',letterSpacing:2,margin:'0 0 5px'}}>{p.label}</p>
            <input type="password" placeholder={p.ph}
              value={(keys as any)[p.id]??''}
              onChange={e=>setKeys(x=>({...x,[p.id]:e.target.value}))}
              style={{width:'100%',background:t.bg2,border:`1px solid ${t.border}`,
                color:t.text,fontFamily:'monospace',fontSize:12,
                padding:'10px 14px',borderRadius:8,outline:'none',
                boxSizing:'border-box',transition:'border-color 0.2s'}}
              onFocus={e=>e.target.style.borderColor=t.gold}
              onBlur={e=>e.target.style.borderColor=t.border}/>
          </div>
        ))}
      </div>

      <button onClick={save} style={{padding:'12px 36px',
        background:`linear-gradient(135deg,${t.goldDim},${t.gold})`,
        border:'none',borderRadius:8,color:'#0b0d14',
        fontFamily:'Orbitron,monospace',fontSize:11,fontWeight:700,
        letterSpacing:2,cursor:'pointer',
        boxShadow:`0 4px 20px ${t.goldGlow}`}}>
        {saved?'✓  SAVED':'SAVE SETTINGS'}
      </button>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────
const NAV = [
  {id:'scan'     as View,icon:'⬡',label:'Scan'},
  {id:'results'  as View,icon:'◈',label:'Results'},
  {id:'settings' as View,icon:'⚙',label:'Settings'},
]

// ── Root App ──────────────────────────────────────────────
export default function App() {
  const [view,setView]   = useState<View>('scan')
  const [theme,setTheme] = useState<Theme>('dark')
  const [setupDone,setSetupDone] = useState(false)
  const { status, result } = useScanStore()
  const t = T[theme]

  useEffect(()=>{
    if(status==='done') setTimeout(()=>setView('results'),800)
  },[status])

  // Show setup screen on first launch
  if (!setupDone) {
    return (
      <div style={{display:'flex',height:'100vh',background:t.bg,color:t.text,
        overflow:'hidden',fontFamily:'system-ui,sans-serif',transition:'background 0.3s'}}>
        <Background theme={theme}/>
        <div style={{flex:1,overflow:'auto'}}>
          <SetupPage theme={theme} onDone={()=>setSetupDone(true)}/>
        </div>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&display=swap');
          * { box-sizing:border-box; }
          @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        `}</style>
      </div>
    )
  }

  return (
    <div style={{display:'flex',height:'100vh',background:t.bg,color:t.text,
      overflow:'hidden',fontFamily:'system-ui,sans-serif',transition:'background 0.3s, color 0.3s'}}>
      <Background theme={theme}/>

      {/* Sidebar */}
      <aside style={{width:200,background:t.glass,backdropFilter:'blur(16px)',
        borderRight:`1px solid ${t.border}`,
        display:'flex',flexDirection:'column',flexShrink:0,
        position:'relative',zIndex:10}}>

        <div style={{padding:'20px 16px',borderBottom:`1px solid ${t.border}`,
          display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:36,height:36,borderRadius:8,
            background:`linear-gradient(135deg,${t.bg3},${t.bg2})`,
            border:`1px solid ${t.border}`,
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:`0 0 16px ${t.goldGlow}`,flexShrink:0}}>
            <img src="/vyon-logo.png" alt="" style={{width:28,height:28,objectFit:'contain'}}
              onError={e=>(e.target as HTMLImageElement).style.display='none'}/>
          </div>
          <div>
            <p style={{color:t.gold,fontFamily:'Orbitron,monospace',fontSize:14,
              letterSpacing:3,margin:0,fontWeight:700}}>VYON</p>
            <p style={{color:t.textMuted,fontSize:8,letterSpacing:2,margin:0,textTransform:'uppercase'}}>Web3 Security</p>
          </div>
        </div>

        <nav style={{flex:1,paddingTop:8}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{
              width:'100%',display:'flex',alignItems:'center',gap:10,
              padding:'11px 16px',
              background:view===n.id?t.goldGlow:'transparent',
              borderTop:'none',borderRight:'none',borderBottom:'none',
              borderLeft:view===n.id?`3px solid ${t.gold}`:'3px solid transparent',
              color:view===n.id?t.gold:t.textDim,
              cursor:'pointer',fontSize:13,fontFamily:'system-ui,sans-serif',
              letterSpacing:0.5,fontWeight:view===n.id?600:400,transition:'all 0.15s'}}>
              <span style={{fontSize:15}}>{n.icon}</span>
              {n.label}
              {n.id==='results'&&result&&(
                <span style={{marginLeft:'auto',fontSize:9,background:t.goldGlow,
                  color:t.gold,padding:'2px 7px',borderRadius:10,border:`1px solid ${t.borderHi}`}}>
                  {result.findings.length}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{padding:'12px 16px',borderTop:`1px solid ${t.border}`}}>
          <button onClick={()=>setTheme(th=>th==='dark'?'light':'dark')} style={{
            width:'100%',padding:'8px 12px',marginBottom:12,
            background:t.bg2,border:`1px solid ${t.border}`,
            color:t.textDim,borderRadius:8,cursor:'pointer',
            fontSize:11,display:'flex',alignItems:'center',
            justifyContent:'center',gap:8,transition:'all 0.2s'}}>
            {theme==='dark'?'☀ Light Mode':'☾ Dark Mode'}
          </button>
          <button onClick={()=>setSetupDone(false)} style={{
            width:'100%',padding:'6px 12px',marginBottom:10,
            background:'transparent',border:`1px solid ${t.border}`,
            color:t.textMuted,borderRadius:6,cursor:'pointer',
            fontSize:10,transition:'all 0.2s'}}>
            ⚙ Tool Setup
          </button>
          {['Slither','Mythril'].map(tool=>(
            <div key={tool} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
              <div style={{width:6,height:6,borderRadius:'50%',flexShrink:0,
                background:status==='scanning'?t.gold:t.textMuted,
                boxShadow:status==='scanning'?`0 0 6px ${t.gold}`:'none',transition:'all 0.3s'}}/>
              <span style={{fontSize:10,color:t.textMuted}}>{tool}</span>
            </div>
          ))}
          <p style={{fontSize:8,color:t.textMuted,margin:'8px 0 0'}}>v0.2.0 · MIT License</p>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',position:'relative'}}>
        <div style={{height:44,borderBottom:`1px solid ${t.border}`,
          display:'flex',alignItems:'center',padding:'0 20px',gap:12,
          flexShrink:0,background:t.glass,backdropFilter:'blur(12px)',
          position:'relative',zIndex:5}}>
          <span style={{fontSize:10,color:t.textMuted,textTransform:'uppercase',letterSpacing:3,flex:1}}>
            {view==='scan'?'Contract Scanner':view==='results'?`Scan Results${result?.contract_name?` · ${result.contract_name}`:'`'}`:'Settings'}
          </span>
          {status==='scanning'&&(
            <span style={{fontSize:9,color:t.gold,fontFamily:'monospace',animation:'pulse 1s ease-in-out infinite'}}>
              ● SCANNING
            </span>
          )}
          {status==='done'&&result&&view!=='results'&&(
            <button onClick={()=>setView('results')} style={{
              fontSize:10,padding:'5px 14px',
              border:`1px solid ${t.borderHi}`,color:t.gold,
              background:t.goldGlow,borderRadius:6,cursor:'pointer',
              fontFamily:'monospace',letterSpacing:1}}>
              View Results →
            </button>
          )}
        </div>

        <div style={{flex:1,overflow:'hidden'}}>
          {view==='scan'     && <ScanPage     theme={theme}/>}
          {view==='results'  && <ResultsPage  theme={theme}/>}
          {view==='settings' && <SettingsPage theme={theme}/>}
        </div>
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&display=swap');
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${t.border}; border-radius:4px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
