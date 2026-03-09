import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { getModelById } from '../../lib/models'
import ModelSwitchDialog from '../model/ModelSwitchDialog'

const GITHUB_URL = 'https://github.com/honeycoder96/clientside-codereviewer'

function GitHubIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

export default function Navbar() {
  const selectedModel = useStore((s) => s.selectedModel)
  const engineStatus  = useStore((s) => s.engineStatus)
  const [showDialog, setShowDialog] = useState(false)

  const model     = getModelById(selectedModel)
  const canSwitch = engineStatus !== 'loading'

  return (
    <>
      <nav className="flex items-center justify-between px-4 h-10 bg-gray-950 border-b border-gray-800 flex-shrink-0">
        {/* Branding */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase select-none">
            WebGPU
          </span>
          <span className="text-gray-700 text-xs select-none">/</span>
          <span className="text-[10px] font-mono text-gray-400 tracking-widest uppercase select-none">
            LLM
          </span>
        </div>

        {/* Center: model badge */}
        <button
          onClick={() => canSwitch && setShowDialog(true)}
          disabled={!canSwitch}
          title={canSwitch ? 'Switch model' : 'Cannot switch while model is loading'}
          className={`flex items-center gap-1.5 text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
            canSwitch
              ? 'border-gray-700 text-gray-500 hover:border-indigo-500 hover:text-indigo-300 cursor-pointer'
              : 'border-gray-800 text-gray-700 cursor-not-allowed'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              engineStatus === 'ready'   ? 'bg-green-500'  :
              engineStatus === 'loading' ? 'bg-yellow-500' :
              engineStatus === 'error'   ? 'bg-red-500'    :
              'bg-gray-600'
            }`}
          />
          {model.name}
          {canSwitch && <span className="text-gray-700">↕</span>}
        </button>

        {/* GitHub link */}
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-gray-500 hover:text-white transition-colors duration-150 text-xs"
          aria-label="View source on GitHub"
        >
          <GitHubIcon />
          <span className="hidden sm:inline font-mono text-[10px] tracking-wide">GitHub</span>
        </a>
      </nav>

      {showDialog && <ModelSwitchDialog onClose={() => setShowDialog(false)} />}
    </>
  )
}
