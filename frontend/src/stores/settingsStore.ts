import { create } from 'zustand'
import { AIProvider, AppSettings } from '@/types'

interface SettingsState extends AppSettings {
  setProvider: (p: AIProvider) => void
  setKey: (provider: string, key: string) => void
  getActiveKey: () => string
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ai_provider: 'openrouter',
  openrouter_key: '',
  gemini_key: '',
  groq_key: '',
  etherscan_key: '',
  setProvider: (p) => set({ ai_provider: p }),
  setKey: (provider, key) => {
    if (provider === 'openrouter') set({ openrouter_key: key })
    else if (provider === 'gemini') set({ gemini_key: key })
    else if (provider === 'groq') set({ groq_key: key })
    else if (provider === 'etherscan') set({ etherscan_key: key })
  },
  getActiveKey: () => {
    const s = get()
    if (s.ai_provider === 'openrouter') return s.openrouter_key
    if (s.ai_provider === 'gemini') return s.gemini_key
    if (s.ai_provider === 'groq') return s.groq_key
    return ''
  },
}))
