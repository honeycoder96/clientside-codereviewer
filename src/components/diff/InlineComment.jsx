import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { streamFixSuggestion, findHunkForLine, formatHunkAsText } from '../../lib/fixSuggestion'
import Badge from '../ui/Badge'

const AGENT_ICONS = {
  bug:         '🔍',
  security:    '🔒',
  performance: '⚡',
  summary:     '📋',
}

const BORDER_COLORS = {
  critical: 'border-red-500',
  warning:  'border-yellow-500',
  info:     'border-blue-500',
}

function FixPanel({ issue, filename }) {
  const [status, setStatus] = useState('idle') // idle | loading | done | error
  const [text,   setText]   = useState('')
  const [copied, setCopied] = useState(false)
  const files = useStore((s) => s.files)

  function getHunkText() {
    const file = files.find((f) => f.filename === filename)
    if (!file?.hunks?.length) return null
    const hunk = findHunkForLine(file.hunks, issue.line)
    return hunk ? formatHunkAsText(hunk) : null
  }

  async function handleFix() {
    const hunkText = getHunkText()
    if (!hunkText) { setStatus('error'); setText('Could not find diff hunk for this line.'); return }
    setStatus('loading')
    setText('')
    await streamFixSuggestion({
      issue,
      filename,
      hunkText,
      onToken:  (t) => setText((prev) => prev + t),
      onDone:   ()  => setStatus('done'),
      onError:  (m) => { setStatus('error'); setText(m) },
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (status === 'idle') return null

  return (
    <div className="mt-2 flex flex-col gap-1">
      {(status === 'loading' || status === 'done') && (
        <pre className="text-[11px] font-mono text-gray-300 bg-gray-900 border border-gray-700 rounded p-2 whitespace-pre-wrap leading-relaxed overflow-x-auto">
          {text || <span className="text-gray-600 animate-pulse">Generating fix…</span>}
        </pre>
      )}
      {status === 'error' && (
        <p className="text-xs text-red-400">{text}</p>
      )}
      {status === 'done' && text && (
        <button
          onClick={handleCopy}
          className="self-start text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          {copied ? 'Copied!' : '⎘ Copy fix'}
        </button>
      )}
    </div>
  )
}

export default function InlineComment({ issue, filename }) {
  const [expanded,    setExpanded]    = useState(false)
  const [showFix,     setShowFix]     = useState(false)
  const [fixLoading,  setFixLoading]  = useState(false)
  const [visible,     setVisible]     = useState(false)
  const ref = useRef(null)

  // Fade-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const border    = BORDER_COLORS[issue.severity] ?? 'border-gray-500'
  const agentIcon = AGENT_ICONS[issue.foundBy] ?? ''
  const engineStatus    = useStore((s) => s.engineStatus)
  const userAnnotations = useStore((s) => s.userAnnotations)
  const setAnnotation   = useStore((s) => s.setAnnotation)
  const canFix = engineStatus === 'ready' && !!filename

  const issueKey   = `${filename ?? ''}:${issue.line ?? 0}:${issue.category}`
  const annotation = userAnnotations.get(issueKey)
  const isDismissed = annotation === 'dismissed'
  const isAccepted  = annotation === 'accepted'

  function handleFixClick() {
    setShowFix(true)
    setFixLoading(true)
  }

  return (
    <div
      ref={ref}
      className={`
        border-l-2 ${border} pl-3 pr-4 py-2 bg-gray-850 text-xs
        transition-opacity duration-200
        ${!visible ? 'opacity-0' : isDismissed ? 'opacity-40' : 'opacity-100'}
      `}
      style={{ backgroundColor: 'rgb(17, 22, 30)' }}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <Badge severity={issue.severity} />
        <span className="text-gray-500 font-mono">{issue.category}</span>
        {issue.line && (
          <span className="text-gray-600 font-mono">line {issue.line}</span>
        )}
        {agentIcon && (
          <span className="text-gray-500" title={issue.foundBy}>{agentIcon}</span>
        )}
        {/* Annotation badges */}
        {isAccepted  && <span className="text-[10px] font-mono text-emerald-500 bg-emerald-950/50 border border-emerald-800/50 rounded px-1">accepted</span>}
        {isDismissed && <span className="text-[10px] font-mono text-gray-600 bg-gray-800/50 border border-gray-700/50 rounded px-1">dismissed</span>}
      </div>
      <p className={`mt-1 leading-relaxed ${isDismissed ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'}`}>{issue.message}</p>

      <div className="mt-1 flex items-center gap-3 flex-wrap">
        {issue.suggestion && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="text-indigo-400 hover:text-indigo-300 text-xs"
          >
            {expanded ? 'Hide suggestion ▲' : 'Show suggestion ▼'}
          </button>
        )}
        {canFix && !showFix && (
          <button
            onClick={handleFixClick}
            className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            ✦ Fix
          </button>
        )}
        {/* Accept / Dismiss toggles */}
        <button
          onClick={() => setAnnotation(issueKey, 'accepted')}
          title={isAccepted ? 'Remove accepted mark' : 'Mark as accepted'}
          className={`text-xs transition-colors ${isAccepted ? 'text-emerald-400' : 'text-gray-600 hover:text-emerald-500'}`}
        >
          ✓
        </button>
        <button
          onClick={() => setAnnotation(issueKey, 'dismissed')}
          title={isDismissed ? 'Restore issue' : 'Dismiss issue'}
          className={`text-xs transition-colors ${isDismissed ? 'text-gray-400' : 'text-gray-600 hover:text-gray-400'}`}
        >
          ✕
        </button>
      </div>

      {expanded && issue.suggestion && (
        <p className="mt-1 text-gray-400 italic leading-relaxed">{issue.suggestion}</p>
      )}

      {showFix && (
        <FixPanel issue={issue} filename={filename} />
      )}
    </div>
  )
}
