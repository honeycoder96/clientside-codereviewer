import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { toMarkdown, toCSV, toJSON, triggerDownload } from '../../lib/export'

const FORMATS = [
  { id: 'md',   label: 'Markdown report', ext: '.md',   mime: 'text/markdown'      },
  { id: 'json', label: 'JSON data',        ext: '.json', mime: 'application/json'   },
  { id: 'csv',  label: 'CSV issues',       ext: '.csv',  mime: 'text/csv'           },
]

function isoDate() {
  return new Date().toISOString().slice(0, 10)  // YYYY-MM-DD
}

export default function ExportMenu() {
  const reviewStatus = useStore((s) => s.reviewStatus)
  const diffReview   = useStore((s) => s.diffReview)
  const fileReviews  = useStore((s) => s.fileReviews)
  const files        = useStore((s) => s.files)

  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)

  const menuRef      = useRef(null)
  const copyTimerRef = useRef(null)

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

  // Cleanup copy timer on unmount
  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  if (reviewStatus !== 'done' || !diffReview) return null

  function handleDownload(fmt) {
    setOpen(false)
    const filename = `code-review-${isoDate()}${fmt.ext}`
    let content
    if (fmt.id === 'md')   content = toMarkdown(diffReview, fileReviews, files)
    if (fmt.id === 'json') content = toJSON(diffReview, fileReviews, files)
    if (fmt.id === 'csv')  content = toCSV(fileReviews)
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

  return (
    <div ref={menuRef} className="relative">
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
        <div className="absolute right-0 top-full mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[160px]">
          {FORMATS.map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => handleDownload(fmt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 hover:text-white transition-colors text-left"
            >
              <span className="text-gray-500 flex-shrink-0">⬇</span>
              {fmt.label}
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
        </div>
      )}
    </div>
  )
}
