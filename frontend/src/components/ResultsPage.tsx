import { useState } from 'react'
import { useScanStore } from '@/stores/scanStore'
import { useFindingsStore, useFilteredFindings } from '@/stores/findingsStore'
import { useAI } from '@/hooks/useAI'
import { SEVERITY_CONFIG, Finding, Severity } from '@/types'
import { riskColor, goNoGo, formatDuration, severityLabel, severityColor, severityBg } from '@/lib/utils'
import { SyntaxHighlighter } from './CodeViewer'

export function ResultsPage() {
  const { result } = useScanStore()
  const { selected, select, setSeverityFilter, severityFilter, setSearch, search } = useFindingsStore()
  const findings = useFilteredFindings()

  if (!result) return (
    <div className="flex items-center justify-center h-full text-[#333] font-mono text-sm">
      No scan results yet — go to Scan to analyze a contract
    </div>
  )

  const { risk_score, scan_duration_ms, tools_used } = result
  const { verdict, pass } = goNoGo(risk_score.critical_count, risk_score.high_count)
  const rColor = riskColor(risk_score.label)

  const SEVS: Severity[] = ['critical','high','medium','low','informational']

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Metrics */}
        <div className="p-4 border-b border-[#1a1a1a] flex gap-3 flex-wrap">
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded px-4 py-2 flex flex-col gap-0.5" style={{borderColor:`${rColor}22`}}>
            <span className="text-[9px] text-[#333] uppercase tracking-widest">Risk</span>
            <span className="text-lg font-display font-bold" style={{color:rColor}}>{risk_score.label}</span>
          </div>
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded px-4 py-2 flex flex-col gap-0.5">
            <span className="text-[9px] text-[#333] uppercase tracking-widest">Verdict</span>
            <span className="text-sm font-bold font-mono" style={{color: pass ? '#34c759' : '#ff2d55'}}>{pass?'✅':'⛔'} {verdict}</span>
          </div>
          {([['critical','#ff2d55'],['high','#ff6b35'],['medium','#ffd60a'],['low','#34c759']] as const).map(([k,c]) => (
            <div key={k} className="bg-[#0d0d0d] border border-[#1e1e1e] rounded px-3 py-2 flex flex-col gap-0.5">
              <span className="text-[9px] uppercase tracking-widest" style={{color:c}}>{k}</span>
              <span className="text-lg font-bold font-mono" style={{color:c}}>{k === 'critical' ? risk_score.critical_count : k === 'high' ? risk_score.high_count : k === 'medium' ? risk_score.medium_count : risk_score.low_count}</span>
            </div>
          ))}
          <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded px-3 py-2 flex flex-col gap-0.5">
            <span className="text-[9px] text-[#333] uppercase tracking-widest">Duration</span>
            <span className="text-sm font-mono text-[#555]">{formatDuration(scan_duration_ms)}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-2 border-b border-[#1a1a1a] flex gap-2 flex-wrap items-center">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search findings..."
            className="bg-[#0d0d0d] border border-[#1e1e1e] text-[#888] text-xs font-mono px-3 py-1.5 rounded focus:outline-none focus:border-cyan-DEFAULT/30 w-44" />
          {SEVS.map(s => {
            const cfg = SEVERITY_CONFIG[s]
            const active = severityFilter.includes(s)
            return (
              <button key={s} onClick={() => setSeverityFilter(active ? severityFilter.filter(x=>x!==s) : [...severityFilter,s])}
                className="text-[9px] font-mono px-2 py-1 rounded border transition-all"
                style={{color:cfg.color, borderColor: active ? cfg.color : '#1e1e1e', background: active ? cfg.bg : 'transparent'}}>
                {cfg.label}
              </button>
            )
          })}
          <span className="text-[10px] text-[#333] ml-auto">{findings.length} findings · {tools_used.join(', ')}</span>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="sticky top-0 bg-[#080808]">
              <tr>
                {['Severity','Issue','Location','Tool'].map(h => (
                  <th key={h} className="text-left text-[9px] text-[#2a2a2a] uppercase tracking-widest px-4 py-2 border-b border-[#111]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {findings.map(f => (
                <tr key={f.id} onClick={()=>select(selected?.id===f.id ? null : f)}
                  className="cursor-pointer border-b border-[#0f0f0f] hover:bg-[#0d0d0d] transition-colors"
                  style={selected?.id===f.id ? {background:'rgba(0,255,255,0.03)', borderLeft:'2px solid #00ffff'} : {}}>
                  <td className="px-4 py-2">
                    <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded"
                      style={{color:severityColor(f.severity), background:severityBg(f.severity)}}>
                      {severityLabel(f.severity)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-[#bbb] max-w-xs truncate">{f.title}</td>
                  <td className="px-4 py-2 text-[10px] text-[#444] font-mono">{f.location ?? '-'}</td>
                  <td className="px-4 py-2 text-[10px] text-[#444]">{f.tool}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail panel */}
      {selected && <DetailPanel finding={selected} onClose={()=>select(null)} />}
    </div>
  )
}

function DetailPanel({ finding, onClose }: { finding: Finding; onClose: () => void }) {
  const [explanation, setExplanation] = useState<string|null>(null)
  const { explain, loading, error, hasKey } = useAI()

  const handleExplain = async () => {
    const result = await explain(finding)
    if (result) setExplanation(result)
  }

  return (
    <div className="w-72 border-l border-[#1a1a1a] bg-[#080808] flex flex-col overflow-hidden slide-in-right">
      <div className="px-4 py-3 border-b border-[#111] flex items-start justify-between">
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded"
              style={{color:severityColor(finding.severity), background:severityBg(finding.severity)}}>
              {severityLabel(finding.severity)}
            </span>
            <span className="text-[9px] text-[#2a2a2a]">{finding.id}</span>
          </div>
          <p className="text-xs text-[#e0e0e0] leading-snug">{finding.title}</p>
        </div>
        <button onClick={onClose} className="text-[#333] hover:text-[#666] ml-2 text-lg leading-none">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <Field label="Tool">{finding.tool}{finding.swc_id && <span className="ml-2 text-[#333]">{finding.swc_id}</span>}</Field>
        <Field label="Location"><span className="font-mono">{finding.location ?? '-'}</span></Field>
        <Field label="Description"><span className="text-[10px] text-[#555] leading-relaxed">{finding.description}</span></Field>
        {finding.code_snippet && (
          <Field label="Code">
            <SyntaxHighlighter code={finding.code_snippet} />
          </Field>
        )}
        {finding.impact && <Field label="Impact"><span className="text-[10px] text-[#555] leading-relaxed">{finding.impact}</span></Field>}
        {finding.recommendation && <Field label="Fix"><span className="text-[10px] text-[#555] leading-relaxed">{finding.recommendation}</span></Field>}

        {/* AI Explain */}
        {explanation ? (
          <Field label="⚡ AI Explanation">
            <p className="text-[10px] text-[#555] leading-relaxed">{explanation}</p>
          </Field>
        ) : (
          <div className="flex flex-col gap-2">
            <button onClick={handleExplain} disabled={loading || !hasKey}
              className="w-full py-2 border border-[rgba(255,0,255,0.2)] text-[#cc00cc] text-[11px] font-mono rounded hover:bg-[rgba(255,0,255,0.05)] disabled:opacity-40 transition-all">
              {loading ? '⚡ Thinking...' : '⚡ Explain with AI'}
            </button>
            {!hasKey && <p className="text-[9px] text-[#333] text-center">Configure AI provider in Settings</p>}
            {error && <p className="text-[9px] text-severity-critical">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] text-[#2a2a2a] uppercase tracking-widest">{label}</span>
      <div>{children}</div>
    </div>
  )
}
