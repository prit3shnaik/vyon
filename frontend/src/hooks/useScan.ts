import { useCallback, useEffect, useRef } from 'react'
import { ScanProgress } from '@/types'
import { useScanStore } from '@/stores/scanStore'
import { useFindingsStore } from '@/stores/findingsStore'
import { useSettingsStore } from '@/stores/settingsStore'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export function useScan() {
  const scanStore = useScanStore()
  const findingsStore = useFindingsStore()
  const settings = useSettingsStore()
  const unlistenRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    let mounted = true
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<ScanProgress>('scan_progress', (e) => {
        if (mounted) scanStore.setProgress(e.payload)
      }).then(u => { if (mounted) unlistenRef.current = u })
    })
    return () => { mounted = false; unlistenRef.current?.() }
  }, [])

  const startScan = useCallback(async () => {
    const { filePath, contractAddress } = useScanStore.getState()
    if (!filePath && !contractAddress) { scanStore.setError('No file or address provided'); return }
    scanStore.setScanning()
    findingsStore.reset()
    try {
      const result = await invoke<ReturnType<typeof scanStore.setResult> extends void ? Parameters<typeof scanStore.setResult>[0] : never>(
        'run_scan', { filePath, contractAddress, etherscanApiKey: settings.etherscan_key || null }
      ) as Parameters<typeof scanStore.setResult>[0]
      scanStore.setResult(result)
      findingsStore.setFindings(result.findings)
    } catch (e) {
      scanStore.setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  return { startScan }
}
