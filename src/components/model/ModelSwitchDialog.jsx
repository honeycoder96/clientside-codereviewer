import { useState } from 'react'
import { useStore } from '../../store/useStore'
import ModelSelector from './ModelSelector'

/**
 * Modal dialog for switching models mid-session.
 * Switching destroys the current engine and clears all review state.
 *
 * Props:
 *   onClose — called when dialog should close (cancel or after switch)
 */
export default function ModelSwitchDialog({ onClose }) {
  const selectedModel = useStore((s) => s.selectedModel)
  const switchModel   = useStore((s) => s.switchModel)

  const [pendingModel, setPendingModel] = useState(selectedModel)

  const hasChanged = pendingModel !== selectedModel

  function handleSwitch() {
    switchModel(pendingModel)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col gap-5 p-6 max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Switch Model</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Selector */}
        <ModelSelector
          value={pendingModel}
          onChange={setPendingModel}
          disabled={false}
        />

        {/* Warning — only shown when selection differs */}
        {hasChanged && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-yellow-950/40 border border-yellow-800/50 rounded-lg text-xs text-yellow-400">
            <span className="flex-shrink-0 mt-0.5">⚠</span>
            <span>
              Switching models will clear your current review session and reload the model.
              Any unsaved results will be lost.
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSwitch}
            disabled={!hasChanged}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
          >
            Switch Model
          </button>
        </div>

      </div>
    </div>
  )
}
