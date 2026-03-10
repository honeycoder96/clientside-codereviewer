import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { loadHistoryEntry } from '../../lib/history'
import Badge from '../ui/Badge'

function relativeTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days  = Math.floor(hours / 24)
  if (days < 30)  return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function shortModel(modelId) {
  if (!modelId) return ''
  // e.g. "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC" → "Qwen2.5-Coder-1.5B"
  return modelId.split('-').slice(0, 3).join('-')
}

function IssueCount({ counts }) {
  const parts = []
  if (counts.critical > 0) parts.push(<span key="c" className="text-red-400">{counts.critical}C</span>)
  if (counts.warning  > 0) parts.push(<span key="w" className="text-yellow-400">{counts.warning}W</span>)
  if (counts.info     > 0) parts.push(<span key="i" className="text-blue-400">{counts.info}I</span>)
  if (parts.length === 0)  return <span className="text-green-400">clean</span>
  return (
    <span className="flex items-center gap-1">
      {parts.map((p, i) => [i > 0 && <span key={`sep-${i}`} className="text-gray-700">·</span>, p])}
    </span>
  )
}

function HistoryEntry({ entry, onRestore, onDelete, isRestoring }) {
  const title = entry.fileCount > 1
    ? `${entry.firstFilename.split('/').pop()} +${entry.fileCount - 1} more`
    : (entry.firstFilename.split('/').pop() || 'unknown')

  return (
    <div className="group flex items-start gap-3 px-4 py-3 border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
      {/* Risk badge */}
      <div className="flex-shrink-0 pt-0.5">
        <Badge risk={entry.overallRisk} showDash />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <p className="text-sm text-gray-200 truncate" title={entry.firstFilename}>
          {title}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <IssueCount counts={entry.totalIssues} />
          <span className="text-gray-700">·</span>
          <span>{entry.reviewMode}</span>
          <span className="text-gray-700">·</span>
          <span className="font-mono truncate max-w-[120px]" title={entry.selectedModel}>
            {shortModel(entry.selectedModel)}
          </span>
          <span className="text-gray-700">·</span>
          <span title={entry.createdAt}>{relativeTime(entry.createdAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRestore(entry.id)}
          disabled={isRestoring}
          className="text-xs px-2 py-1 border border-gray-600 hover:border-indigo-500 hover:text-indigo-400 text-gray-400 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isRestoring ? '…' : 'Restore'}
        </button>
        <button
          onClick={() => onDelete(entry.id)}
          className="text-gray-600 hover:text-red-400 transition-colors px-1 py-1 text-xs"
          title="Delete entry"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function HistoryPanel() {
  const historyEntries    = useStore((s) => s.historyEntries)
  const deleteEntry       = useStore((s) => s.deleteHistoryEntry)
  const clearAll          = useStore((s) => s.clearHistory)
  const restoreReview     = useStore((s) => s.restoreReview)
  const isReviewing       = useStore((s) => s.reviewStatus === 'reviewing')

  const [restoringId,   setRestoringId]   = useState(null)
  const [restoreError,  setRestoreError]  = useState(null)
  const [confirmClear,  setConfirmClear]  = useState(false)

  async function handleRestore(id) {
    if (isReviewing) return
    setRestoringId(id)
    setRestoreError(null)
    try {
      const entry = await loadHistoryEntry(id)
      if (!entry) {
        setRestoreError('Entry not found — it may have been deleted.')
        return
      }
      restoreReview({
        rawDiff:    entry.rawDiff,
        files:      entry.files,
        diffReview: entry.diffReview,
        fileReviews: new Map(entry.fileReviews),
        annotations: new Map(entry.annotations),
        importMeta: {
          model:      entry.selectedModel,
          reviewMode: entry.reviewMode,
          createdAt:  entry.createdAt,
        },
      })
    } catch {
      setRestoreError('Failed to load entry from storage.')
    } finally {
      setRestoringId(null)
    }
  }

  function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return }
    clearAll()
    setConfirmClear(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700 flex-shrink-0">
        <span className="text-xs text-gray-400 font-medium">
          {historyEntries.length > 0
            ? `${historyEntries.length} saved review${historyEntries.length !== 1 ? 's' : ''}`
            : 'Review History'}
        </span>
        {historyEntries.length > 0 && (
          <div className="flex items-center gap-2">
            {confirmClear ? (
              <>
                <span className="text-xs text-gray-500">Clear all?</span>
                <button
                  onClick={handleClear}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmClear(false)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {restoreError && (
        <div className="flex items-center gap-2 mx-4 mt-3 text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-800/50 rounded px-2.5 py-1.5">
          <span>⚠</span>
          <span className="flex-1">{restoreError}</span>
          <button onClick={() => setRestoreError(null)} className="text-yellow-600 hover:text-yellow-400">✕</button>
        </div>
      )}

      {isReviewing && (
        <div className="mx-4 mt-3 text-xs text-gray-600 bg-gray-800/50 rounded px-2.5 py-1.5">
          Restore unavailable during active review
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {historyEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-gray-600">
            <span className="text-3xl">⧗</span>
            <p className="text-xs">No past reviews yet</p>
            <p className="text-xs text-gray-700">Completed reviews are saved here automatically</p>
          </div>
        ) : (
          historyEntries.map((entry) => (
            <HistoryEntry
              key={entry.id}
              entry={entry}
              onRestore={handleRestore}
              onDelete={deleteEntry}
              isRestoring={restoringId === entry.id}
            />
          ))
        )}
      </div>
    </div>
  )
}
