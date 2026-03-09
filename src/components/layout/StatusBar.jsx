import { useState } from 'react'
import { useStore } from '../../store/useStore'
import ModelSwitchDialog from '../model/ModelSwitchDialog'

const SHORTCUTS = [
  { key: 'j', desc: 'Next file' },
  { key: 'k', desc: 'Previous file' },
  { key: 'r', desc: 'Start review' },
  { key: 'n', desc: 'New review' },
  { key: 'Esc', desc: 'Deselect file' },
]

function KeyboardHelpPopover({ onClose }) {
  return (
    <div className="absolute bottom-9 right-3 z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 w-44">
      <p className="text-xs text-gray-400 font-medium mb-2 uppercase tracking-wide">Shortcuts</p>
      <div className="flex flex-col gap-1">
        {SHORTCUTS.map(({ key, desc }) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <kbd className="text-xs font-mono bg-gray-700 text-gray-200 px-1.5 py-0.5 rounded border border-gray-600">
              {key}
            </kbd>
            <span className="text-xs text-gray-400 flex-1 text-right">{desc}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onClose}
        className="mt-2 w-full text-xs text-gray-600 hover:text-gray-400 text-right"
      >
        close
      </button>
    </div>
  )
}

export default function StatusBar() {
  const selectedModel  = useStore((s) => s.selectedModel)
  const engineStatus   = useStore((s) => s.engineStatus)
  const reviewStatus   = useStore((s) => s.reviewStatus)
  const tokensPerSecond = useStore((s) => s.tokensPerSecond)
  const currentAgentId = useStore((s) => s.currentAgentId)
  const selectedFile   = useStore((s) => s.selectedFile)

  const [showHelp, setShowHelp] = useState(false)
  const [showSwitch, setShowSwitch] = useState(false)

  const modelShort = selectedModel.split('-').slice(0, 2).join('-')

  return (
    <footer className="relative flex items-center justify-between px-4 py-1.5 border-t border-gray-700 bg-gray-900 flex-shrink-0 h-8 text-xs text-gray-500">
      <div className="flex items-center gap-2">
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            engineStatus === 'ready' ? 'bg-green-500' : 'bg-gray-600'
          }`}
        />
        <button
          onClick={() => setShowSwitch(true)}
          title="Switch model"
          className="font-mono hover:text-gray-300 transition-colors"
        >
          {modelShort}
        </button>
      </div>

      <div className="flex items-center gap-3">
        {reviewStatus === 'reviewing' && currentAgentId && selectedFile && (
          <>
            <span className="truncate max-w-xs">{selectedFile}</span>
            <span className="text-gray-600">·</span>
            <span className="text-indigo-400">{currentAgentId} agent</span>
            {tokensPerSecond > 0 && (
              <>
                <span className="text-gray-600">·</span>
                <span>{tokensPerSecond} tok/s</span>
              </>
            )}
          </>
        )}
        {reviewStatus !== 'reviewing' && (
          <span className="text-gray-600">Ready</span>
        )}

        <button
          onClick={() => setShowHelp((v) => !v)}
          title="Keyboard shortcuts"
          className="ml-1 w-4 h-4 rounded-full border border-gray-700 hover:border-gray-500 hover:text-gray-300 flex items-center justify-center transition-colors"
        >
          ?
        </button>
      </div>

      {showHelp && <KeyboardHelpPopover onClose={() => setShowHelp(false)} />}
      {showSwitch && <ModelSwitchDialog onClose={() => setShowSwitch(false)} />}
    </footer>
  )
}
