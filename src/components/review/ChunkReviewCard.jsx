import { useState } from 'react'
import Badge from '../ui/Badge'
import { useIssueFilters } from '../../hooks/useIssueFilters'
import { useStore } from '../../store/useStore'
import { streamFixSuggestion, findHunkForLine, formatHunkAsText } from '../../lib/fixSuggestion'

const AGENT_ICONS = {
  bug:         '🔍',
  security:    '🔒',
  performance: '⚡',
  summary:     '📋',
}

function IssueRow({ issue, filename }) {
  const [expanded,  setExpanded]  = useState(false)
  const [showFix,   setShowFix]   = useState(false)
  const [fixStatus, setFixStatus] = useState('idle') // idle | loading | done | error
  const [fixText,   setFixText]   = useState('')
  const [copied,    setCopied]    = useState(false)

  const files           = useStore((s) => s.files)
  const engineStatus    = useStore((s) => s.engineStatus)
  const userAnnotations = useStore((s) => s.userAnnotations)
  const setAnnotation   = useStore((s) => s.setAnnotation)
  const canFix = engineStatus === 'ready' && !!filename

  const issueKey    = `${filename ?? ''}:${issue.line ?? 0}:${issue.category}`
  const annotation  = userAnnotations.get(issueKey)
  const isDismissed = annotation === 'dismissed'
  const isAccepted  = annotation === 'accepted'

  async function handleFix() {
    setShowFix(true)
    setFixStatus('loading')
    setFixText('')
    const file = files.find((f) => f.filename === filename)
    const hunk = file?.hunks?.length ? findHunkForLine(file.hunks, issue.line) : null
    if (!hunk) { setFixStatus('error'); setFixText('Could not find diff hunk for this line.'); return }
    const hunkText = formatHunkAsText(hunk)
    await streamFixSuggestion({
      issue,
      filename,
      hunkText,
      onToken:  (t) => setFixText((prev) => prev + t),
      onDone:   ()  => setFixStatus('done'),
      onError:  (m) => { setFixStatus('error'); setFixText(m) },
    })
  }

  function handleCopy() {
    navigator.clipboard.writeText(fixText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className={`flex flex-col gap-1 py-1.5 border-b border-gray-800 last:border-0 transition-opacity ${isDismissed ? 'opacity-40' : ''}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge severity={issue.severity} />
        <span className="text-xs text-gray-500 font-mono">{issue.category}</span>
        {issue.line && (
          <span className="text-xs text-gray-600 font-mono">:{issue.line}</span>
        )}
        {issue.foundBy && (
          <span title={issue.foundBy} className="text-gray-600 text-xs">
            {AGENT_ICONS[issue.foundBy] ?? ''}
          </span>
        )}
        {isAccepted  && <span className="text-[10px] font-mono text-emerald-500 bg-emerald-950/50 border border-emerald-800/50 rounded px-1">accepted</span>}
        {isDismissed && <span className="text-[10px] font-mono text-gray-600 bg-gray-800/50 border border-gray-700/50 rounded px-1">dismissed</span>}
      </div>
      <p className={`text-xs leading-relaxed ${isDismissed ? 'text-gray-500 line-through decoration-gray-600' : 'text-gray-300'}`}>{issue.message}</p>
      <div className="flex items-center gap-3 flex-wrap">
        {issue.suggestion && (
          <>
            <button
              onClick={() => setExpanded((e) => !e)}
              className="self-start text-xs text-indigo-400 hover:text-indigo-300"
            >
              {expanded ? 'Hide suggestion ▲' : 'Show suggestion ▼'}
            </button>
          </>
        )}
        {canFix && !showFix && (
          <button
            onClick={handleFix}
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
        <p className="text-xs text-gray-400 italic leading-relaxed">{issue.suggestion}</p>
      )}
      {showFix && (fixStatus === 'loading' || fixStatus === 'done') && (
        <pre className="text-[11px] font-mono text-gray-300 bg-gray-900 border border-gray-700 rounded p-2 whitespace-pre-wrap leading-relaxed overflow-x-auto mt-1">
          {fixText || <span className="text-gray-600 animate-pulse">Generating fix…</span>}
        </pre>
      )}
      {showFix && fixStatus === 'error' && (
        <p className="text-xs text-red-400 mt-1">{fixText}</p>
      )}
      {showFix && fixStatus === 'done' && fixText && (
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

export default function ChunkReviewCard({ chunkReview }) {
  const [agentExpanded, setAgentExpanded] = useState(false)
  const { filterIssues } = useIssueFilters()
  const visibleIssues = filterIssues(chunkReview.mergedIssues ?? [])
  const issueCount = visibleIssues.length
  const failed =
    (!chunkReview.agentResults || chunkReview.agentResults.length === 0) &&
    (chunkReview.mergedIssues?.length ?? 0) === 0

  if (failed) {
    return (
      <div className="border border-gray-800 rounded px-3 py-2 text-xs text-gray-700 italic">
        chunk {chunkReview.startLine}–{chunkReview.endLine} — skipped (inference failed)
      </div>
    )
  }

  return (
    <div className="border border-gray-700 rounded p-3 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400 font-mono">
          Lines {chunkReview.startLine}–{chunkReview.endLine}
        </span>
        {issueCount > 0 && (
          <span className="text-xs text-gray-500">
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Summary text */}
      {chunkReview.summary && (
        <p className="text-xs text-gray-400 leading-relaxed">{chunkReview.summary}</p>
      )}

      {/* Issues */}
      {issueCount > 0 && (
        <div className="flex flex-col">
          {visibleIssues.map((issue, i) => (
            <IssueRow key={`${issue.line}:${issue.category}:${i}`} issue={issue} filename={chunkReview.filename} />
          ))}
        </div>
      )}

      {/* Agent details toggle */}
      {chunkReview.agentResults?.length > 0 && (
        <>
          <button
            onClick={() => setAgentExpanded((e) => !e)}
            className="self-start text-xs text-gray-600 hover:text-gray-400 mt-1"
          >
            {agentExpanded ? 'Hide agent details ▲' : 'Agent details ▼'}
          </button>
          {agentExpanded && (
            <div className="flex flex-col gap-2 border-t border-gray-800 pt-2">
              {chunkReview.agentResults.map((ar) => (
                <div key={ar.agentId} className="flex flex-col gap-0.5">
                  <span className="text-xs text-gray-500 font-medium">
                    {AGENT_ICONS[ar.agentId] ?? ''} {ar.agentName}
                  </span>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {ar.summary || 'No summary'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
