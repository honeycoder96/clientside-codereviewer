import { useState, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { loadSavedReview, clearSavedReview } from '../../lib/persist'
import { MAX_FILE_SIZE_BYTES } from '../../config.js'

function isValidDiff(text) {
  if (text.includes('diff --git')) return true
  // Require '--- ' and '+++ ' at the start of lines, not just anywhere in the text
  const lines = text.split('\n')
  return lines.some((l) => l.startsWith('--- ')) && lines.some((l) => l.startsWith('+++ '))
}

export default function DiffInputArea() {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  // Lazy initializer reads localStorage once at mount, avoiding setState-in-effect
  const [savedReview, setSavedReview] = useState(() => loadSavedReview())
  const textareaRef = useRef(null)

  const setDiff        = useStore((s) => s.setDiff)
  const parseDiff      = useStore((s) => s.parseDiff)
  const clearDiff      = useStore((s) => s.clearDiff)
  const restoreReview  = useStore((s) => s.restoreReview)

  const lineCount = text ? text.split('\n').length : 0

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
    try {
      parseDiff()
    } catch {
      setError('Failed to parse diff. Make sure it is a valid unified diff.')
    }
  }

  function readFile(file) {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB).`)
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result
      setText(content)
      setError('')
    }
    reader.onerror = () => {
      setError('Failed to read file. Please try again.')
    }
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

  function handleDragOver(e) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() {
    setDragging(false)
  }

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
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl flex flex-col gap-4">
        {savedReview && (
          <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border border-indigo-700 rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-indigo-400">↺</span>
              <span className="text-gray-300">
                Previous review available —{' '}
                <span className="text-white font-medium">{savedReview.files.length}</span>{' '}
                file{savedReview.files.length !== 1 ? 's' : ''} reviewed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestore}
                className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
              >
                Restore
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">Paste your diff</h1>
          <p className="text-sm text-gray-400 mt-1">
            Output of <code className="bg-gray-800 px-1 rounded text-indigo-300">git diff</code>,{' '}
            <code className="bg-gray-800 px-1 rounded text-indigo-300">git diff --staged</code>, or a{' '}
            <code className="bg-gray-800 px-1 rounded text-indigo-300">.diff</code> / <code className="bg-gray-800 px-1 rounded text-indigo-300">.patch</code> file
          </p>
        </div>

        <div
          className={`relative rounded-lg border-2 transition-colors ${
            dragging
              ? 'border-indigo-400 bg-indigo-950'
              : error
              ? 'border-red-500 bg-gray-800'
              : 'border-gray-700 bg-gray-800 focus-within:border-indigo-500'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            placeholder={"Paste your unified diff here (git diff, git diff --staged, or .diff file)...\n\nOr drag and drop a .diff / .patch file onto this area."}
            className="w-full bg-transparent text-gray-200 font-mono text-sm p-4 resize-none outline-none rounded-lg placeholder-gray-600"
            style={{ minHeight: '60vh' }}
            spellCheck={false}
          />
          {dragging && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
              <p className="text-indigo-300 font-semibold text-lg">Drop .diff or .patch file here</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {text ? `${lineCount.toLocaleString()} lines` : 'No content'}
          </span>
          {error && <p className="text-sm text-red-400 flex-1 mx-4">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleClear}
              disabled={!text}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear
            </button>
            <button
              onClick={handleReview}
              disabled={!text.trim()}
              className="px-5 py-2 text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Review
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
