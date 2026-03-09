import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { isModelCached } from '../../lib/engine'
import ProgressBar from './ProgressBar'

export default function ModelLoader() {
  const engineStatus = useStore((s) => s.engineStatus)
  const loadProgress = useStore((s) => s.loadProgress)
  const loadMessage  = useStore((s) => s.loadMessage)
  const selectedModel = useStore((s) => s.selectedModel)
  const initEngine   = useStore((s) => s.initEngine)
  const resetEngine  = useStore((s) => s.resetEngine)

  // null = still checking, true = cached, false = not cached
  const [cached, setCached] = useState(null)

  useEffect(() => {
    isModelCached(selectedModel).then((hit) => {
      setCached(hit)
      if (hit && useStore.getState().engineStatus === 'idle') initEngine()
    })
  }, [selectedModel, initEngine])

  // While we're checking the cache, show nothing (avoids button flash)
  const checking = cached === null

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        <h1 className="text-3xl font-bold text-white">WebGPU Code Reviewer</h1>
        <p className="text-sm text-gray-400 font-mono">{selectedModel}</p>

        {/* Not-cached idle state: show explicit Load button */}
        {!checking && engineStatus === 'idle' && !cached && (
          <>
            <p className="text-gray-300">
              Run a local LLM entirely in your browser using WebGPU.
            </p>
            <p className="text-xs text-gray-500">
              First run downloads ~2.1 GB of model weights (cached after that).
            </p>
            <button
              onClick={initEngine}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
            >
              Load Model
            </button>
          </>
        )}

        {/* Loading (either manual or auto from cache) */}
        {engineStatus === 'loading' && (
          <div className="w-full flex flex-col gap-4">
            <ProgressBar percent={loadProgress} label={loadMessage || 'Initializing…'} />
          </div>
        )}

        {engineStatus === 'error' && (
          <>
            <p className="text-red-400 text-sm">{loadMessage || 'An error occurred.'}</p>
            <button
              onClick={resetEngine}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
          </>
        )}
      </div>
    </div>
  )
}
