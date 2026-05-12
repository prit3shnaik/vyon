import { create } from 'zustand'
import { ScanResult, ScanProgress } from '@/types'

type Status = 'idle' | 'scanning' | 'done' | 'error'

interface ScanState {
  status: Status
  progress: number
  message: string
  result: ScanResult | null
  error: string | null
  filePath: string | null
  contractAddress: string | null
  setFile: (p: string) => void
  setAddress: (a: string) => void
  setProgress: (p: ScanProgress) => void
  setScanning: () => void
  setResult: (r: ScanResult) => void
  setError: (e: string) => void
  reset: () => void
}

export const useScanStore = create<ScanState>((set) => ({
  status: 'idle', progress: 0, message: '',
  result: null, error: null, filePath: null, contractAddress: null,
  setFile: (p) => set({ filePath: p, contractAddress: null }),
  setAddress: (a) => set({ contractAddress: a, filePath: null }),
  setProgress: (p) => set({ progress: p.percentage, message: p.message }),
  setScanning: () => set({ status: 'scanning', progress: 0, message: 'Starting...', error: null, result: null }),
  setResult: (r) => set({ status: 'done', result: r, progress: 100 }),
  setError: (e) => set({ status: 'error', error: e, progress: 0 }),
  reset: () => set({ status: 'idle', progress: 0, message: '', result: null, error: null }),
}))
