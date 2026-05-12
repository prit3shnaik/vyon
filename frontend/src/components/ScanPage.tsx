import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useScanStore } from '@/stores/scanStore'
import { useScan } from '@/hooks/useScan'
import { isValidAddress } from '@/lib/utils'

export function ScanPage() {
  const [tab, setTab] = useState<'file'|'address'>('file')
  const [address, setAddress] = useState('')
  const [addrError, setAddrError] = useState('')
  const { status, progress, message, error, filePath, setFile, setAddress: storeSetAddr } = useScanStore()
  const { startScan } = useScan()
  const scanning = status === 'scanning'

  const onDrop = useCallback((files: File[]) => {
    const f = files[0]; if (!f) return
    const path = (f as File & { path?: string }).path ?? f.name
    setFile(path)
  }, [setFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'text/plain': ['.sol'] }, multiple: false })

  const handleScan = () => {
    if (tab === 'address') {
      if (!isValidAddress(address)) { setAddrError('Invalid address (0x...)'); return }
      setAddrError(''); storeSetAddr(address)
    }
    startScan()
  }

  const fileName = filePath?.split(/[/\\]/).pop()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-8">
      <div className="flex flex-col items-center gap-2">
        <img src="/vyon-logo.png" alt="Vyon" className="w-20 h-20 object-contain" style={{filter:'drop-shadow(0 0 20px rgba(255,120,30,0.4))'}} />
        <h1 className="text-3xl font-display text-cyan-DEFAULT tracking-[6px]">VYON</h1>
        <p className="text-xs text-[#333] tracking-widest">WEB3 SECURITY SCANNER</p>
      </div>

      <div className="w-full max-w-xl flex flex-col gap-4">
        <div className="flex border border-[#1e1e1e] rounded p-0.5 w-fit self-center">
          {(['file','address'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-1.5 text-[11px] font-mono tracking-widest uppercase rounded transition-all ${tab===t ? 'bg-[#1a1a1a] text-cyan-DEFAULT' : 'text-[#444]'}`}>
              {t === 'file' ? '⬡ Upload File' : '◈ Address'}
            </button>
          ))}
        </div>

        {tab === 'file' ? (
          <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-all ${isDragActive ? 'border-cyan-DEFAULT bg-cyan-glow' : 'border-[#1e1e1e] hover:border-[#2a2a2a]'}`}>
            <input {...getInputProps()} />
            {filePath
              ? <div><p className="text-cyan-DEFAULT font-mono text-sm">{fileName}</p><p className="text-[11px] text-[#333] mt-1">Click to replace</p></div>
              : <div><p className="text-4xl mb-3 opacity-20 text-cyan-DEFAULT">⬡</p><p className="text-sm text-[#555]">Drop a <span className="text-cyan-DEFAULT">.sol</span> file or click to browse</p></div>
            }
          </div>
        ) : (
          <div className="flex flex-col gap-3 bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-5">
            <input
              value={address} onChange={e => { setAddress(e.target.value); setAddrError('') }}
              placeholder="0x..."
              className="bg-[#060606] border border-[#1e1e1e] text-[#e0e0e0] font-mono text-sm px-3 py-2 rounded focus:outline-none focus:border-cyan-DEFAULT/40"
            />
            {addrError && <p className="text-xs text-severity-critical">{addrError}</p>}
          </div>
        )}

        <button onClick={handleScan} disabled={scanning || (tab==='file' && !filePath)}
          className="self-center px-10 py-2.5 border border-cyan-DEFAULT text-cyan-DEFAULT font-mono text-sm tracking-widest rounded hover:bg-cyan-glow disabled:opacity-40 disabled:cursor-not-allowed transition-all">
          {scanning ? 'Scanning...' : '⬡ Run Security Scan'}
        </button>

        {status !== 'idle' && (
          <div className="flex flex-col gap-2">
            <div className="w-full h-px bg-[#1a1a1a] rounded overflow-hidden">
              <div className={`h-full transition-all duration-500 ${status==='error' ? 'bg-severity-critical' : 'shimmer-bar'}`} style={{width:`${progress}%`}} />
            </div>
            <p className="text-xs text-center text-[#444] font-mono">
              {status==='error' ? <span className="text-severity-critical">{error}</span> : <>{message}{scanning && <span className="blink ml-0.5">_</span>}</>}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
