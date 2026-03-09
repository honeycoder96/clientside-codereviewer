import { useState } from 'react'
import Badge from '../ui/Badge'

const AGENT_ICONS = {
  bug:         '🔍',
  security:    '🔒',
  performance: '⚡',
  summary:     '📋',
}

function IssueRow({ issue }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="flex flex-col gap-1 py-1.5 border-b border-gray-800 last:border-0">
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
      </div>
      <p className="text-xs text-gray-300 leading-relaxed">{issue.message}</p>
      {issue.suggestion && (
        <>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="self-start text-xs text-indigo-400 hover:text-indigo-300"
          >
            {expanded ? 'Hide suggestion ▲' : 'Show suggestion ▼'}
          </button>
          {expanded && (
            <p className="text-xs text-gray-400 italic leading-relaxed">{issue.suggestion}</p>
          )}
        </>
      )}
    </div>
  )
}

export default function ChunkReviewCard({ chunkReview }) {
  const [agentExpanded, setAgentExpanded] = useState(false)
  const issueCount = chunkReview.mergedIssues?.length ?? 0
  const failed =
    (!chunkReview.agentResults || chunkReview.agentResults.length === 0) && issueCount === 0

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
          {chunkReview.mergedIssues.map((issue, i) => (
            <IssueRow key={`${issue.line}:${issue.category}:${i}`} issue={issue} />
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
