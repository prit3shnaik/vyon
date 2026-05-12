import { useState, useRef, useCallback } from 'react'
import { Finding } from '@/types'
import { useSettingsStore } from '@/stores/settingsStore'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export function useAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cache = useRef<Map<string, string>>(new Map())
  const settings = useSettingsStore()

  const explain = useCallback(async (finding: Finding): Promise<string | null> => {
    const key = `${finding.id}_${settings.ai_provider}`
    if (cache.current.has(key)) return cache.current.get(key)!
    const apiKey = settings.getActiveKey()
    if (!apiKey) { setError('No API key. Go to Settings.'); return null }
    setLoading(true); setError(null)
    try {
      const result = await invoke<string>('get_ai_explanation', { finding, provider: settings.ai_provider, apiKey })
      cache.current.set(key, result)
      return result
    } catch (e) {
      const msg = String(e)
      setError(msg.includes('429') ? 'Rate limit. Wait 60s.' : msg.includes('401') ? 'Invalid API key.' : `Error: ${msg}`)
      return null
    } finally { setLoading(false) }
  }, [settings.ai_provider])

  return { explain, loading, error, hasKey: !!settings.getActiveKey() }
}
