import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'
import { isModelCached } from '../../lib/engine'
import { getModelById } from '../../lib/models'
import ModelSelector from './ModelSelector'
import ProgressBar from './ProgressBar'

export default function ModelLoader() {
  const engineStatus  = useStore((s) => s.engineStatus)
  const loadProgress  = useStore((s) => s.loadProgress)
  const loadMessage   = useStore((s) => s.loadMessage)
  const selectedModel = useStore((s) => s.selectedModel)
  const initEngine    = useStore((s) => s.initEngine)
  const resetEngine   = useStore((s) => s.resetEngine)
  const setModel      = useStore((s) => s.setModel)

  // Track { model, cached } together so that when selectedModel changes,
  // cached reads as null immediately (no synchronous setState in effect needed)
  const [cacheState, setCacheState] = useState({ model: selectedModel, cached: null })
  const cached = cacheState.model === selectedModel ? cacheState.cached : null

  useEffect(() => {
    let cancelled = false
    isModelCached(selectedModel).then((hit) => {
      if (cancelled) return
      setCacheState({ model: selectedModel, cached: hit })
      if (hit && useStore.getState().engineStatus === 'idle') initEngine()
    })
    return () => { cancelled = true }
  }, [selectedModel, initEngine])

  function handleModelChange(modelId) {
    setModel(modelId)
  }

  const modelMeta  = getModelById(selectedModel)
  const checking   = cached === null
  const isIdle     = engineStatus === 'idle'
  const isLoading  = engineStatus === 'loading'
  const isError    = engineStatus === 'error'

  return (
    <div className="h-full bg-gray-900 flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-lg flex flex-col gap-6">

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Choose a model</h1>
          <p className="text-sm text-gray-400 mt-1">
            All inference runs locally in your browser — nothing leaves your machine.
          </p>
        </div>

        {/* Model selector — shown while idle (loading or error states lock it out) */}
        {(isIdle || isError) && (
          <ModelSelector
            value={selectedModel}
            onChange={handleModelChange}
            disabled={isLoading}
          />
        )}

        {/* Not-cached idle state: show download info + load button */}
        {!checking && isIdle && !cached && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-xs text-gray-500">
              First run downloads{' '}
              <span className="text-gray-300 font-medium">{modelMeta.sizeGB} GB</span>{' '}
              of model weights — cached in your browser after that.
            </p>
            <button
              onClick={initEngine}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors"
            >
              Load Model
            </button>
          </div>
        )}

        {/* Loading — progress bar */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            <ProgressBar percent={loadProgress} label={loadMessage || 'Initializing…'} />
            <p className="text-xs text-gray-600 text-center">
              Loading <span className="text-gray-400 font-mono">{modelMeta.name}</span>…
            </p>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-red-400 text-sm">{loadMessage || 'An error occurred loading the model.'}</p>
            <button
              onClick={resetEngine}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
