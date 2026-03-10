import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import AgentStatusRow from './AgentStatusRow'
import StreamingText from '../ui/StreamingText'

// Label/icon registry for all possible agent IDs (unified + deep-mode agents)
const AGENT_META = {
  unified:     { name: 'Unified Reviewer',      icon: '🔎' },
  bug:         { name: 'Bug Reviewer',           icon: '🔍' },
  security:    { name: 'Security Auditor',       icon: '🔒' },
  performance: { name: 'Performance Reviewer',   icon: '⚡' },
}

function isValidDiff(text) {
  if (text.includes('diff --git')) return true
  const lines = text.split('\n')
  return lines.some((l) => l.startsWith('--- ')) && lines.some((l) => l.startsWith('+++ '))
}

function relativeTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  return `${Math.floor(mins / 60)}h ago`
}

function QueueDrawer({ queue, enqueueReview, removeFromQueue }) {
  const [text,   setText]   = useState('')
  const [msg,    setMsg]    = useState(null)   // { type: 'ok'|'error', text }
  const [busy,   setBusy]   = useState(false)

  async function handleQueue() {
    const trimmed = text.trim()
    if (!trimmed) return
    if (!isValidDiff(trimmed)) {
      setMsg({ type: 'error', text: "Doesn't look like a unified diff" })
      return
    }
    setBusy(true)
    setMsg(null)
    const result = await enqueueReview(trimmed)
    setBusy(false)
    if (result.ok) {
      setText('')
      setMsg({ type: 'ok', text: result.position > 0 ? `Added at position ${result.position}` : 'Started immediately' })
      setTimeout(() => setMsg(null), 3000)
    } else {
      setMsg({ type: 'error', text: result.error })
    }
  }

  return (
    <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-gray-700">
      {/* Queued items list */}
      {queue.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {queue.map((item, i) => (
            <div key={item.id} className="flex items-center gap-2 text-xs text-gray-500 py-0.5">
              <span className="text-gray-700 font-mono w-3">{i + 1}.</span>
              <span className="flex-1 truncate text-gray-400">{item.label}</span>
              <span className="text-gray-700">{relativeTime(item.queuedAt)}</span>
              <button
                onClick={() => removeFromQueue(item.id)}
                className="text-gray-700 hover:text-red-400 transition-colors ml-1"
                title="Remove from queue"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Paste area */}
      <div className="flex flex-col gap-1.5">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg(null) }}
          placeholder="Paste next diff here..."
          rows={3}
          className="w-full bg-gray-900 border border-gray-700 rounded text-xs font-mono text-gray-300 p-2 resize-none outline-none placeholder-gray-700 focus:border-indigo-600/60 transition-colors"
          spellCheck={false}
        />
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`flex-1 text-xs ${msg.type === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
              {msg.text}
            </span>
          )}
          {!msg && <span className="flex-1" />}
          <button
            onClick={handleQueue}
            disabled={!text.trim() || busy}
            className="text-xs px-3 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? '…' : 'Queue'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AgentProgress() {
  const reviewStatus    = useStore((s) => s.reviewStatus)
  const agentStatuses   = useStore((s) => s.agentStatuses)
  const fileStatuses    = useStore((s) => s.fileStatuses)
  const files           = useStore((s) => s.files)
  const tokensPerSecond = useStore((s) => s.tokensPerSecond)
  const cancelReview    = useStore((s) => s.cancelReview)
  const fileReviews     = useStore((s) => s.fileReviews)
  const reviewQueue     = useStore((s) => s.reviewQueue)
  const enqueueReview   = useStore((s) => s.enqueueReview)
  const removeFromQueue = useStore((s) => s.removeFromQueue)

  const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-open drawer when first item is queued
  useEffect(() => {
    if (reviewQueue.length > 0) setDrawerOpen(true)
  }, [reviewQueue.length > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalFiles      = files.length
  const completedFiles  = [...fileStatuses.values()].filter((s) => s === 'done').length
  const reviewingFile   = [...fileStatuses.entries()].find(([, s]) => s === 'reviewing')?.[0]
  const reviewingFilename = reviewingFile ? reviewingFile.split('/').pop() : null

  // Collapsed summary bar when done
  if (reviewStatus === 'done') {
    const totalIssues = [...fileReviews.values()].reduce(
      (s, fr) => s + (fr.mergedIssues?.length ?? 0), 0
    )
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-xs text-gray-400">
        <span className="text-green-400 font-medium">Review complete</span>
        <span>{totalFiles} file{totalFiles !== 1 ? 's' : ''} · {totalIssues} issue{totalIssues !== 1 ? 's' : ''} found</span>
      </div>
    )
  }

  // Render agent rows dynamically from agentStatuses — works for fast, deep, and escalation
  const agentRows = [...agentStatuses.entries()]
    .map(([agentId, status]) => {
      const meta = AGENT_META[agentId]
      if (!meta) return null
      return (
        <AgentStatusRow
          key={agentId}
          agent={{ id: agentId, ...meta }}
          status={status}
        />
      )
    })
    .filter(Boolean)

  return (
    <div className="flex flex-col gap-2 p-3 border-b border-gray-700 bg-gray-850">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          {reviewingFilename ? (
            <>
              <span className="text-indigo-400 font-medium">{reviewingFilename}</span>
              <span className="text-gray-600 mx-1">·</span>
              <span>{completedFiles}/{totalFiles} files</span>
            </>
          ) : (
            <span>Preparing review...</span>
          )}
          {tokensPerSecond > 0 && (
            <span className="text-gray-600 ml-2">{tokensPerSecond} tok/s</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Queue badge — toggles drawer */}
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className={`text-xs px-2 py-1 rounded transition-colors border ${
              reviewQueue.length > 0
                ? 'text-indigo-300 border-indigo-800 bg-indigo-950/60 hover:bg-indigo-900/60'
                : 'text-gray-600 border-gray-700 hover:text-gray-400'
            }`}
            title={drawerOpen ? 'Hide queue' : 'Queue another diff'}
          >
            {reviewQueue.length > 0 ? `Queue: ${reviewQueue.length}` : '+ Queue'}
          </button>

          <button
            onClick={cancelReview}
            className="text-xs px-2 py-1 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Agent rows — dynamic: unified in fast mode, bug/security/perf in deep mode */}
      <div className="flex flex-col">
        {agentRows}
      </div>

      {/* Live streaming output */}
      <StreamingText />

      {/* Queue drawer */}
      {drawerOpen && (
        <QueueDrawer
          queue={reviewQueue}
          enqueueReview={enqueueReview}
          removeFromQueue={removeFromQueue}
        />
      )}
    </div>
  )
}
