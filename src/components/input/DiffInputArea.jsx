import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { loadSavedReview, clearSavedReview } from '../../lib/persist'
import { MAX_FILE_SIZE_BYTES } from '../../config.js'

function isValidDiff(text) {
  if (text.includes('diff --git')) return true
  const lines = text.split('\n')
  return lines.some((l) => l.startsWith('--- ')) && lines.some((l) => l.startsWith('+++ '))
}

const FEATURES = [
  {
    label: '4 specialized agents',
    sub: 'Security, logic bugs, test coverage & overall summary',
  },
  {
    label: 'Zero data egress',
    sub: 'Every token is computed locally — nothing leaves your machine',
  },
  {
    label: 'No account required',
    sub: 'Model weights are cached in your browser after first load',
  },
  {
    label: 'Offline capable',
    sub: 'Works without internet once the model is downloaded',
  },
]

function FeatureIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1L8.96 5.02L13.5 5.63L10.25 8.8L11.09 13.32L7 11.1L2.91 13.32L3.75 8.8L0.5 5.63L5.04 5.02L7 1Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export default function DiffInputArea() {
  const [text, setText]           = useState('')
  const [error, setError]         = useState('')
  const [dragging, setDragging]   = useState(false)
  const [savedReview, setSavedReview] = useState(() => loadSavedReview())
  const textareaRef = useRef(null)

  const setDiff       = useStore((s) => s.setDiff)
  const parseDiff     = useStore((s) => s.parseDiff)
  const clearDiff     = useStore((s) => s.clearDiff)
  const restoreReview = useStore((s) => s.restoreReview)

  const lineCount     = text ? text.split('\n').length : 0
  const addedLines    = text ? text.split('\n').filter((l) => l.startsWith('+')).length : 0
  const removedLines  = text ? text.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length : 0

  function handleChange(e) {
    setText(e.target.value)
    if (error) setError('')
  }

  function handleClear() {
    setText('')
    setError('')
    clearDiff()
    textareaRef.current?.focus()
  }

  function handleReview() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isValidDiff(trimmed)) {
      setError("This doesn't look like a unified diff. Try running `git diff` or `git diff --staged` in your repo.")
      return
    }
    setError('')
    setDiff(trimmed)
    try { parseDiff() }
    catch { setError('Failed to parse diff. Make sure it is a valid unified diff.') }
  }

  function readFile(file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => { setText(e.target.result); setError('') }
    reader.onerror = () => setError('Failed to read file. Please try again.')
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (name.endsWith('.diff') || name.endsWith('.patch') || file.type === 'text/plain') {
      readFile(file)
    } else {
      setError('Please drop a .diff or .patch file.')
    }
  }

  function handleDragOver(e)  { e.preventDefault(); setDragging(true) }
  function handleDragLeave()  { setDragging(false) }

  function handleRestore() {
    restoreReview(savedReview)
    clearSavedReview()
    setSavedReview(null)
  }

  function handleDismiss() {
    clearSavedReview()
    setSavedReview(null)
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: '#030712',
        backgroundImage:
          'radial-gradient(circle at 1.5px 1.5px, rgba(99,102,241,0.12) 1.5px, transparent 0)',
        backgroundSize: '28px 28px',
      }}
    >
      {/* Restored review banner */}
      {savedReview && (
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-2.5 bg-indigo-950/90 border-b border-indigo-800/60 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-indigo-400 text-base">↺</span>
            <span className="text-gray-300">
              Previous review —{' '}
              <span className="text-white font-medium">{savedReview.files.length}</span>{' '}
              file{savedReview.files.length !== 1 ? 's' : ''} ready to restore
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestore}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors"
            >
              Restore
            </button>
            <button
              onClick={handleDismiss}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main hero layout */}
      <div className="min-h-full flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">

          {/* ── Left: Hero copy ── */}
          <div className="flex flex-col gap-8">

            {/* Badge */}
            <div className="flex items-center gap-2 w-fit">
              <span
                className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border"
                style={{
                  color: '#a5b4fc',
                  borderColor: 'rgba(99,102,241,0.35)',
                  background: 'rgba(99,102,241,0.08)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                Runs entirely in your browser · WebGPU
              </span>
            </div>

            {/* Headline */}
            <div className="flex flex-col gap-3">
              <h1
                className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
                style={{ color: '#f1f5f9' }}
              >
                AI code review,{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  fully private.
                </span>
              </h1>
              <p className="text-base text-gray-400 leading-relaxed max-w-md">
                Paste a git diff and get instant analysis from 4 specialized AI agents —
                security vulnerabilities, logic bugs, test gaps, and a commit summary.
                All processed locally. No API keys. No servers.
              </p>
            </div>

            {/* Feature list */}
            <ul className="flex flex-col gap-3">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex-shrink-0"
                    style={{ color: '#6366f1' }}
                  >
                    <FeatureIcon />
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-200">{f.label}</span>
                    <span className="text-sm text-gray-500"> — {f.sub}</span>
                  </div>
                </li>
              ))}
            </ul>

            {/* How to get a diff */}
            <div
              className="flex flex-col gap-2 p-4 rounded-xl border"
              style={{
                background: 'rgba(15,23,42,0.6)',
                borderColor: 'rgba(51,65,85,0.6)',
              }}
            >
              <p className="text-[10px] font-mono tracking-widest uppercase text-gray-600">
                Get a diff
              </p>
              <div className="flex flex-col gap-1.5">
                {['git diff', 'git diff --staged', 'git diff HEAD~1'].map((cmd) => (
                  <code
                    key={cmd}
                    className="text-xs px-2.5 py-1 rounded-md font-mono w-fit"
                    style={{
                      background: 'rgba(30,41,59,0.8)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(51,65,85,0.5)',
                    }}
                  >
                    {cmd}
                  </code>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: Input area ── */}
          <div className="flex flex-col gap-3">

            {/* Input card */}
            <div
              className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 ${
                dragging
                  ? 'border-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.15)]'
                  : error
                  ? 'border-red-500/60'
                  : 'border-gray-800 focus-within:border-indigo-600/60 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.1)]'
              }`}
              style={{ background: 'rgba(8,15,28,0.9)' }}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {/* Card top bar */}
              <div
                className="flex items-center justify-between px-4 py-2.5 border-b"
                style={{ borderColor: 'rgba(30,41,59,0.8)', background: 'rgba(15,23,42,0.6)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-700" />
                </div>
                <span className="text-[10px] font-mono text-gray-600 tracking-wider">
                  unified diff
                </span>
                {text && (
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-emerald-500">
                      <PlusIcon /> {addedLines}
                    </span>
                    <span className="flex items-center gap-1 text-red-400">
                      <MinusIcon /> {removedLines}
                    </span>
                  </div>
                )}
                {!text && <span className="w-16" />}
              </div>

              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={handleChange}
                  placeholder={
                    'Paste your unified diff here...\n\nOr drag & drop a .diff / .patch file onto this area.\n\n$ git diff\n$ git diff --staged'
                  }
                  className="w-full bg-transparent text-gray-300 font-mono text-xs p-4 resize-none outline-none placeholder-gray-700 leading-relaxed"
                  style={{ minHeight: '400px' }}
                  spellCheck={false}
                />

                {dragging && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-b-2xl pointer-events-none"
                    style={{ background: 'rgba(8,15,28,0.92)' }}>
                    <div
                      className="w-12 h-12 rounded-xl border-2 border-dashed flex items-center justify-center"
                      style={{ borderColor: '#6366f1' }}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 3v10M6 9l4 4 4-4" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <p className="text-indigo-300 text-sm font-medium">Drop .diff or .patch file</p>
                  </div>
                )}
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-400 font-mono px-1 leading-relaxed">{error}</p>
            )}

            {/* Actions row */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-mono text-gray-700">
                {text ? `${lineCount.toLocaleString()} lines` : 'No content'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleClear}
                  disabled={!text}
                  className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-200 border border-gray-800 hover:border-gray-600 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
                <button
                  onClick={handleReview}
                  disabled={!text.trim()}
                  className="px-5 py-2 text-xs font-semibold rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{
                    background: text.trim()
                      ? 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)'
                      : '#1e293b',
                    color: '#fff',
                    boxShadow: text.trim()
                      ? '0 0 0 1px rgba(99,102,241,0.4), 0 4px 12px rgba(79,70,229,0.3)'
                      : 'none',
                  }}
                >
                  Analyze Diff →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
