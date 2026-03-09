import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { toMarkdown, toCSV, toJSON, toSARIF, triggerDownload } from '../../lib/export'
import { serializeReviewFile, deserializeReviewFile } from '../../lib/reviewFile'
import { MAX_FILE_SIZE_BYTES } from '../../config'

const FORMATS = [
  { id: 'md',     label: 'Markdown report',    ext: '.md',     mime: 'text/markdown'    },
  { id: 'json',   label: 'JSON data',           ext: '.json',   mime: 'application/json' },
  { id: 'csv',    label: 'CSV issues',          ext: '.csv',    mime: 'text/csv'         },
  { id: 'sarif',  label: 'SARIF (GitHub)',      ext: '.sarif',  mime: 'application/json' },
  { id: 'review', label: 'Review snapshot',     ext: '.review', mime: 'application/json' },
]

function isoDate() {
  return new Date().toISOString().slice(0, 10)
}

export default function ExportMenu() {
  const reviewStatus    = useStore((s) => s.reviewStatus)
  const diffReview      = useStore((s) => s.diffReview)
  const fileReviews     = useStore((s) => s.fileReviews)
  const files           = useStore((s) => s.files)
  const rawDiff         = useStore((s) => s.rawDiff)
  const selectedModel   = useStore((s) => s.selectedModel)
  const reviewMode      = useStore((s) => s.reviewMode)
  const restoreReview   = useStore((s) => s.restoreReview)
  const userAnnotations = useStore((s) => s.userAnnotations)

  const [open,        setOpen]        = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [importError, setImportError] = useState('')

  const menuRef       = useRef(null)
  const fileInputRef  = useRef(null)
  const copyTimerRef  = useRef(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function onMouseDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown',   onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown',   onKeyDown)
    }
  }, [open])

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  if (reviewStatus !== 'done' || !diffReview) return null

  function handleDownload(fmt) {
    setOpen(false)
    const filename = `code-review-${isoDate()}${fmt.ext}`
    let content
    if (fmt.id === 'md')     content = toMarkdown(diffReview, fileReviews, files)
    if (fmt.id === 'json')   content = toJSON(diffReview, fileReviews, files)
    if (fmt.id === 'csv')    content = toCSV(fileReviews)
    if (fmt.id === 'sarif')  content = toSARIF(fileReviews)
    if (fmt.id === 'review') content = serializeReviewFile({
      rawDiff, files, diffReview, fileReviews, selectedModel, reviewMode,
      annotations: userAnnotations,
    })
    triggerDownload(filename, content, fmt.mime)
  }

  function handleCopyMarkdown() {
    setOpen(false)
    const md = toMarkdown(diffReview, fileReviews, files)
    navigator.clipboard.writeText(md).then(() => {
      setCopied(true)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleImportClick() {
    setImportError('')
    fileInputRef.current?.click()
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so the same file can be re-selected if needed
    e.target.value = ''

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setImportError('File is too large.')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = deserializeReviewFile(ev.target.result)
      if (!result.ok) {
        setImportError(result.error)
        return
      }
      setOpen(false)
      setImportError('')
      restoreReview({
        rawDiff:     result.data.rawDiff,
        files:       result.data.files,
        diffReview:  result.data.diffReview,
        fileReviews: result.data.fileReviews,
        annotations: result.data.annotations,
        importMeta:  result.data.meta,
      })
    }
    reader.onerror = () => setImportError('Failed to read file. Please try again.')
    reader.readAsText(file)
  }

  return (
    <div ref={menuRef} className="relative">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".review"
        className="sr-only"
        onChange={handleImportFile}
      />

      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-xs px-3 py-1.5 border rounded transition-colors flex items-center gap-1.5 ${
          copied
            ? 'border-green-700 text-green-400'
            : open
            ? 'border-gray-500 text-white'
            : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
        }`}
      >
        {copied ? (
          'Copied!'
        ) : (
          <>
            <span>↓</span>
            <span>Export</span>
            <span className="text-gray-600 text-[10px]">▾</span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[190px]">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleDownload(fmt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left"
            >
              <span className="text-gray-500 flex-shrink-0">⬇</span>
              {fmt.label}
              {fmt.id === 'sarif' && (
                <span className="ml-auto text-[10px] font-mono text-indigo-500 bg-indigo-950/60 border border-indigo-800/50 rounded px-1">GH</span>
              )}
              {fmt.id === 'review' && (
                <span className="ml-auto text-gray-600 font-mono text-[10px]">.review</span>
              )}
            </button>
          ))}

          <div className="h-px bg-gray-800 mx-2 my-0.5" />

          <button
            onClick={handleCopyMarkdown}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left"
          >
            <span className="text-gray-500 flex-shrink-0">⎘</span>
            Copy Markdown
          </button>

          <div className="h-px bg-gray-800 mx-2 my-0.5" />

          <button
            onClick={handleImportClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left"
          >
            <span className="text-gray-500 flex-shrink-0">↑</span>
            Import .review file
          </button>

          {importError && (
            <p className="px-3 py-2 text-[10px] text-red-400 leading-relaxed border-t border-gray-800">
              {importError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
