import { useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { calculateOverallRisk, countBySeverity } from '../../lib/scoring'
import Badge from '../ui/Badge'

function SeverityCount({ count, label, color }) {
  if (count === 0) return null
  return (
    <span className={`${color} font-medium`}>
      {count} {label}
    </span>
  )
}

const AGENT_ICONS = { bug: '🔍', security: '🔒', performance: '⚡' }

function AgentBreakdown({ completedReviews }) {
  const agentCounts = {}
  for (const fr of completedReviews) {
    for (const chunk of fr.chunks ?? []) {
      for (const ar of chunk.agentResults ?? []) {
        if (ar.agentId !== 'summary') {
          agentCounts[ar.agentId] = (agentCounts[ar.agentId] ?? 0) + (ar.issues?.length ?? 0)
        }
      }
    }
  }
  const entries = Object.entries(agentCounts).filter(([, n]) => n > 0)
  if (entries.length === 0) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-gray-600">By agent</span>
      {entries.map(([agentId, n]) => (
        <span key={agentId} className="text-xs text-gray-500">
          {AGENT_ICONS[agentId] ?? ''} {agentId}: {n} issue{n !== 1 ? 's' : ''}
        </span>
      ))}
    </div>
  )
}

function FileBreakdown({ completedReviews }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 mb-1">Per file</span>
      {completedReviews.map((fr) => {
        const counts = countBySeverity(fr.mergedIssues)
        const total = counts.critical + counts.warning + counts.info
        return (
          <div key={fr.filename} className="flex items-center justify-between text-xs py-0.5">
            <span className="text-gray-400 truncate max-w-[60%]">
              {fr.filename.split('/').pop()}
            </span>
            <div className="flex items-center gap-1.5">
              <Badge risk={fr.riskScore} showDash />
              <span className="text-gray-600">{total} issue{total !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MiniProgressBar({ value, max }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-indigo-500 transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function ReviewSummary() {
  const reviewStatus      = useStore((s) => s.reviewStatus)
  const fileReviews       = useStore((s) => s.fileReviews)
  const files             = useStore((s) => s.files)
  const diffReview        = useStore((s) => s.diffReview)
  const selectedModel     = useStore((s) => s.selectedModel)
  const reviewWarnings    = useStore((s) => s.reviewWarnings)
  const reviewImportMeta  = useStore((s) => s.reviewImportMeta)
  const userAnnotations   = useStore((s) => s.userAnnotations)
  const clearAnnotations  = useStore((s) => s.clearAnnotations)

  // Memoize — fileReviews Map reference changes only when items are added
  const completedReviews = useMemo(() => [...fileReviews.values()], [fileReviews])

  const annotationCounts = useMemo(() => {
    let accepted = 0, dismissed = 0
    for (const v of userAnnotations.values()) {
      if (v === 'accepted')  accepted++
      if (v === 'dismissed') dismissed++
    }
    return { accepted, dismissed }
  }, [userAnnotations])

  if (reviewStatus === 'reviewing') {
    const completedCount = completedReviews.length
    const totalCount = files.length
    const allIssues = completedReviews.flatMap((fr) => fr.mergedIssues)
    const counts = countBySeverity(allIssues)
    const runningRisk = calculateOverallRisk(completedReviews, files)

    return (
      <div className="p-4 flex flex-col gap-4">
        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Reviewing files...</span>
            <span className="font-mono">{completedCount}/{totalCount}</span>
          </div>
          <MiniProgressBar value={completedCount} max={totalCount} />
        </div>

        {/* Live risk */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Risk score</span>
          <Badge risk={runningRisk} showDash />
        </div>

        {/* Issue counts */}
        {allIssues.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <SeverityCount count={counts.critical} label="critical" color="text-red-400" />
            <SeverityCount count={counts.warning}  label="warning"  color="text-yellow-400" />
            <SeverityCount count={counts.info}     label="info"     color="text-blue-400" />
          </div>
        )}

        {/* Per-agent totals */}
        {completedReviews.length > 0 && (
          <AgentBreakdown completedReviews={completedReviews} />
        )}
      </div>
    )
  }

  if (reviewStatus === 'done' && diffReview) {
    const { overallRisk, totalIssues, durationMs, totalTokens } = diffReview
    const seconds = durationMs ? (durationMs / 1000).toFixed(1) : '—'

    return (
      <div className="p-4 flex flex-col gap-4">
        {/* Heading */}
        <div className="flex items-center gap-2">
          <span className="text-green-400 font-medium text-sm">Review complete</span>
        </div>

        {/* Import provenance banner */}
        {reviewImportMeta && (
          <div className="flex items-start gap-1.5 text-xs text-indigo-300 bg-indigo-950/50 border border-indigo-800/40 rounded px-2.5 py-2 leading-relaxed">
            <span className="flex-shrink-0 mt-px">↑</span>
            <span>
              Imported review
              {reviewImportMeta.model && (
                <> · <span className="font-mono text-indigo-400">{reviewImportMeta.model.split('-').slice(0, 2).join('-')}</span></>
              )}
              {reviewImportMeta.reviewMode && (
                <> · {reviewImportMeta.reviewMode} mode</>
              )}
              {reviewImportMeta.createdAt && (
                <> · {reviewImportMeta.createdAt.slice(0, 10)}</>
              )}
            </span>
          </div>
        )}

        {/* Warnings (chunk failures, save errors) */}
        {reviewWarnings.length > 0 && (
          <div className="flex flex-col gap-1">
            {reviewWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-800/50 rounded px-2 py-1.5">
                <span className="flex-shrink-0">⚠</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Risk */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Overall risk</span>
          <Badge risk={overallRisk} showDash />
        </div>

        {/* Issue counts */}
        <div className="flex items-center gap-3 text-xs">
          <SeverityCount count={totalIssues.critical} label="critical" color="text-red-400" />
          <SeverityCount count={totalIssues.warning}  label="warning"  color="text-yellow-400" />
          <SeverityCount count={totalIssues.info}     label="info"     color="text-blue-400" />
          {(totalIssues.critical + totalIssues.warning + totalIssues.info) === 0 && (
            <span className="text-green-400">No issues found</span>
          )}
        </div>

        {/* Annotation counts */}
        {(annotationCounts.accepted > 0 || annotationCounts.dismissed > 0) && (
          <div className="flex items-center gap-3 text-xs border-t border-gray-800 pt-3">
            <span className="text-gray-600">Annotations:</span>
            {annotationCounts.accepted  > 0 && (
              <span className="text-emerald-500">{annotationCounts.accepted} accepted</span>
            )}
            {annotationCounts.dismissed > 0 && (
              <span className="text-gray-500">{annotationCounts.dismissed} dismissed</span>
            )}
            <button
              onClick={clearAnnotations}
              className="ml-auto text-gray-700 hover:text-gray-400 transition-colors text-[10px]"
              title="Clear all annotations"
            >
              clear
            </button>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-col gap-1 text-xs text-gray-500 border-t border-gray-700 pt-3">
          <span>Duration: <span className="text-gray-400">{seconds}s</span></span>
          {totalTokens > 0 && (
            <span>Tokens used: <span className="text-gray-400">{totalTokens.toLocaleString()}</span></span>
          )}
          <span className="truncate">Model: <span className="text-gray-400 font-mono">{selectedModel}</span></span>
        </div>

        {/* File-level breakdown */}
        {completedReviews.length > 0 && (
          <FileBreakdown completedReviews={completedReviews} />
        )}
      </div>
    )
  }

  return (
    <div className="p-4 text-xs text-gray-600">
      Start a review to see results here.
    </div>
  )
}
