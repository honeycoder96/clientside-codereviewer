import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { countBySeverity } from '../../lib/scoring'
import Badge from '../ui/Badge'
import ChunkReviewCard from './ChunkReviewCard'

function FileReviewItem({ fileReview }) {
  const [expanded, setExpanded] = useState(false)
  const selectFile = useStore((s) => s.selectFile)
  const counts = countBySeverity(fileReview.mergedIssues)
  const basename = fileReview.filename.split('/').pop()

  return (
    <div className="border border-gray-700 rounded overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-750 text-left transition-colors"
        style={{ backgroundColor: expanded ? 'rgb(30,34,42)' : undefined }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-300 truncate font-mono">{basename}</span>
          <Badge risk={fileReview.riskScore} showDash />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {counts.critical > 0 && (
            <span className="text-xs text-red-400">{counts.critical}C</span>
          )}
          {counts.warning > 0 && (
            <span className="text-xs text-yellow-400">{counts.warning}W</span>
          )}
          {counts.info > 0 && (
            <span className="text-xs text-blue-400">{counts.info}I</span>
          )}
          <span className="text-gray-600 text-xs ml-1">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="p-2 flex flex-col gap-2 bg-gray-900">
          <button
            onClick={() => selectFile(fileReview.filename)}
            className="self-start text-xs text-indigo-400 hover:text-indigo-300"
          >
            View diff →
          </button>
          {fileReview.chunks?.length > 0 ? (
            fileReview.chunks.map((chunk) => (
              <ChunkReviewCard key={chunk.chunkId} chunkReview={chunk} />
            ))
          ) : (
            <p className="text-xs text-gray-600 px-1">No issues detected in this file.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function FileReviewList() {
  const fileReviews  = useStore((s) => s.fileReviews)
  const reviewStatus = useStore((s) => s.reviewStatus)

  const reviews = [...fileReviews.values()].sort(
    (a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0)
  )

  if (reviews.length === 0) {
    if (reviewStatus === 'reviewing') {
      return (
        <div className="p-4 text-xs text-gray-600">
          File reviews will appear here as each file completes...
        </div>
      )
    }
    return null
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <span className="text-xs text-gray-500">
        {reviews.length} file{reviews.length !== 1 ? 's' : ''} reviewed
      </span>
      {reviews.map((fr) => (
        <FileReviewItem key={fr.filename} fileReview={fr} />
      ))}
    </div>
  )
}
