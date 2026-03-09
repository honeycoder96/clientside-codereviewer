import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { loadSavedReview, clearSavedReview } from '../../lib/persist'
import { MAX_FILE_SIZE_BYTES } from '../../config.js'
import { isModelCached } from '../../lib/engine'
import { getModelById } from '../../lib/models'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { deserializeReviewFile } from '../../lib/reviewFile'
import ModelSelector from '../model/ModelSelector'
import ProgressBar from '../model/ProgressBar'
import HeroSection from '../layout/HeroSection'

function isValidDiff(text) {
  if (text.includes('diff --git')) return true
  const lines = text.split('\n')
  return lines.some((l) => l.startsWith('--- ')) && lines.some((l) => l.startsWith('+++ '))
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
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [savedReview, setSavedReview] = useState(() => loadSavedReview())
  const textareaRef  = useRef(null)
  const importInputRef = useRef(null)
  const { isMobile } = useBreakpoint()

  const setDiff = useStore((s) => s.setDiff)
  const parseDiff = useStore((s) => s.parseDiff)
  const clearDiff = useStore((s) => s.clearDiff)
  const restoreReview = useStore((s) => s.restoreReview)

  // Engine state
  const engineStatus = useStore((s) => s.engineStatus)
  const loadProgress = useStore((s) => s.loadProgress)
  const loadMessage = useStore((s) => s.loadMessage)
  const selectedModel = useStore((s) => s.selectedModel)
  const initEngine = useStore((s) => s.initEngine)
  const resetEngine = useStore((s) => s.resetEngine)
  const setModel = useStore((s) => s.setModel)

  const engineReady = engineStatus === 'ready'
  const isIdle = engineStatus === 'idle'
  const isLoading = engineStatus === 'loading'
  const isError = engineStatus === 'error'

  // Model cache state
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

  const modelMeta = getModelById(selectedModel)
  const checking = cached === null

  const lineCount = text ? text.split('\n').length : 0
  const addedLines = text ? text.split('\n').filter((l) => l.startsWith('+')).length : 0
  const removedLines = text ? text.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length : 0

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

  async function handleReview() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isValidDiff(trimmed)) {
      setError("This doesn't look like a unified diff. Try running `git diff` or `git diff --staged` in your repo.")
      return
    }
    setError('')
    setDiff(trimmed)
    try { await parseDiff() }
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

  function readReviewFile(file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = deserializeReviewFile(e.target.result)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setError('')
      restoreReview({
        rawDiff:     result.data.rawDiff,
        files:       result.data.files,
        diffReview:  result.data.diffReview,
        fileReviews: result.data.fileReviews,
        annotations: result.data.annotations,
        importMeta: result.data.meta,
      })
    }
    reader.onerror = () => setError('Failed to read .review file. Please try again.')
    reader.readAsText(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const name = file.name.toLowerCase()
    if (name.endsWith('.review')) {
      readReviewFile(file)
    } else if (name.endsWith('.diff') || name.endsWith('.patch') || file.type === 'text/plain') {
      readFile(file)
    } else {
      setError('Please drop a .diff, .patch, or .review file.')
    }
  }

  function handleImportReviewFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    readReviewFile(file)
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true) }
  function handleDragLeave() { setDragging(false) }

  function handleRestore() {
    restoreReview(savedReview)
    clearSavedReview()
    setSavedReview(null)
  }

  function handleDismiss() {
    clearSavedReview()
    setSavedReview(null)
  }

  /* ── Right-pane: model selector card (when engine not ready) ── */
  const modelSelectorPane = (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-col rounded-2xl border overflow-hidden border-gray-800"
        style={{ background: 'rgba(8,15,28,0.9)' }}
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
            select model
          </span>
          <span className="w-16" />
        </div>

        {/* Model content area */}
        <div className="p-4 flex flex-col gap-4" style={{ minHeight: '400px' }}>
          {(isIdle || isError) && (
            <ModelSelector
              value={selectedModel}
              onChange={(id) => setModel(id)}
              disabled={isLoading}
            />
          )}

          {!checking && isIdle && !cached && (
            <div className="flex flex-col items-center gap-3 text-center pt-2">
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

          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-sm">
                <ProgressBar percent={loadProgress} label={loadMessage || 'Initializing…'} />
              </div>
              <p className="text-xs text-gray-600 text-center">
                Loading <span className="text-gray-400 font-mono">{modelMeta.name}</span>…
              </p>
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-3 text-center pt-2">
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
    </div>
  )

  /* ── Right-pane: diff textarea card (when engine is ready) ── */
  const textareaPane = (
    <div className="flex flex-col gap-3">
      <div
        className={`flex flex-col rounded-2xl border overflow-hidden transition-all duration-200 ${dragging
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

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            placeholder={
              'Paste your unified diff here...\n\nOr drag & drop a .diff / .patch file onto this area.\n\n$ git diff\n$ git diff --staged'
            }
            className="w-full bg-transparent text-gray-300 font-mono text-xs p-4 resize-none outline-none placeholder-gray-700 leading-relaxed"
            style={{ minHeight: isMobile ? '40vh' : '400px' }}
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
                  <path d="M10 3v10M6 9l4 4 4-4" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-indigo-300 text-sm font-medium">Drop .diff, .patch, or .review file</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 font-mono px-1 leading-relaxed">{error}</p>
      )}

      <p className="text-[11px] text-gray-600 px-1 leading-relaxed">
        After loading the diff you can choose which files to review and configure focus context, agent toggles, and issue filters via the <span className="text-gray-500">⚙</span> settings panel before starting.
      </p>
      <p className="text-[11px] text-gray-600 px-1">
        Have a saved review?{' '}
        <label className="text-indigo-400 hover:text-indigo-300 cursor-pointer transition-colors">
          Import a .review file
          <input
            ref={importInputRef}
            type="file"
            accept=".review"
            className="sr-only"
            onChange={handleImportReviewFile}
          />
        </label>
        {' '}to restore it instantly — no inference needed.
      </p>

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
  )

  return (
    <>
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

      <HeroSection>
        {engineReady ? textareaPane : modelSelectorPane}
      </HeroSection>
    </>
  )
}
