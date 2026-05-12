import { Severity, SEVERITY_CONFIG } from '@/types'

export function severityColor(s: Severity) { return SEVERITY_CONFIG[s]?.color ?? '#636366' }
export function severityBg(s: Severity) { return SEVERITY_CONFIG[s]?.bg ?? 'rgba(99,99,102,0.12)' }
export function severityLabel(s: Severity) { return SEVERITY_CONFIG[s]?.label ?? s.toUpperCase() }
export function severityPriority(s: Severity) { return SEVERITY_CONFIG[s]?.priority ?? 0 }

export function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`
}

export function formatTimestamp(iso: string) {
  try { return new Date(iso).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' }) }
  catch { return iso }
}

export function isValidAddress(addr: string) { return /^0x[0-9a-fA-F]{40}$/.test(addr) }
export function isValidSolFile(name: string) { return name.toLowerCase().endsWith('.sol') }

export function riskColor(label: string) {
  switch (label.toLowerCase()) {
    case 'critical': return '#ff2d55'
    case 'high':     return '#ff6b35'
    case 'medium':   return '#ffd60a'
    default:         return '#34c759'
  }
}

export function goNoGo(critical: number, high: number) {
  if (critical > 0) return { verdict: 'NO-GO',  pass: false }
  if (high > 0)     return { verdict: 'CAUTION', pass: false }
  return                   { verdict: 'GO',      pass: true  }
}
