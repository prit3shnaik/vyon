import { create } from 'zustand'
import { Finding, Severity } from '@/types'
import { severityPriority } from '@/lib/utils'

interface FindingsState {
  findings: Finding[]
  selected: Finding | null
  severityFilter: Severity[]
  search: string
  setFindings: (f: Finding[]) => void
  select: (f: Finding | null) => void
  setSeverityFilter: (s: Severity[]) => void
  setSearch: (q: string) => void
  reset: () => void
}

export const useFindingsStore = create<FindingsState>((set) => ({
  findings: [], selected: null, severityFilter: [], search: '',
  setFindings: (f) => set({ findings: f, selected: null }),
  select: (f) => set({ selected: f }),
  setSeverityFilter: (s) => set({ severityFilter: s }),
  setSearch: (q) => set({ search: q }),
  reset: () => set({ findings: [], selected: null, severityFilter: [], search: '' }),
}))

export function useFilteredFindings() {
  const { findings, severityFilter, search } = useFindingsStore()
  let result = [...findings]
  if (severityFilter.length > 0) result = result.filter(f => severityFilter.includes(f.severity))
  if (search.trim()) {
    const q = search.toLowerCase()
    result = result.filter(f => f.title.toLowerCase().includes(q) || f.description.toLowerCase().includes(q))
  }
  return result.sort((a, b) => severityPriority(b.severity) - severityPriority(a.severity))
}
