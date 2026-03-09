import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { calculateOverallRisk } from '../../lib/scoring'
import { estimateTotalChunks } from '../../lib/chunker'
import { LARGE_FILE_THRESHOLD, LARGE_CHUNK_THRESHOLD } from '../../config.js'
import Badge from '../ui/Badge'
import LargeDiffWarning from '../input/LargeDiffWarning'

export default function Header() {
  const files         = useStore((s) => s.files)
  const clearDiff     = useStore((s) => s.clearDiff)
  const reviewStatus  = useStore((s) => s.reviewStatus)
  const initReview    = useStore((s) => s.initReview)
  const fileReviews   = useStore((s) => s.fileReviews)
  const diffReview    = useStore((s) => s.diffReview)
  const selectedFiles = useStore((s) => s.selectedFiles)

  const [showWarning, setShowWarning] = useState(false)

  const risk =
    reviewStatus === 'done'
      ? diffReview?.overallRisk ?? 0
      : calculateOverallRisk([...fileReviews.values()], files)

  const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)
  const isReviewing    = reviewStatus === 'reviewing'
  const canStart       = files.length > 0 && reviewStatus === 'idle' && selectedFiles.size > 0

  function handleStartReview() {
    const filesToReview =
      selectedFiles.size > 0 ? files.filter((f) => selectedFiles.has(f.filename)) : files
    const totalChunks = estimateTotalChunks(filesToReview)
    if (filesToReview.length >= LARGE_FILE_THRESHOLD || totalChunks >= LARGE_CHUNK_THRESHOLD) {
      setShowWarning(true)
    } else {
      initReview()
    }
  }

  return (
    <>
      <header className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-900 flex-shrink-0 h-11">
        <span className="text-sm font-semibold text-white tracking-tight">
          WebGPU Code Reviewer
        </span>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
          <span className="text-gray-600">·</span>
          <span className="text-green-400">+{totalAdditions}</span>
          <span className="text-red-400">-{totalDeletions}</span>
          <Badge risk={risk} showDash />
        </div>

        <div className="flex items-center gap-2">
          {(canStart || isReviewing) && (
            <button
              onClick={handleStartReview}
              disabled={isReviewing}
              className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded transition-colors"
            >
              {isReviewing ? 'Reviewing...' : 'Start Review'}
            </button>
          )}
          <button
            onClick={clearDiff}
            disabled={isReviewing}
            className="text-xs px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            New Review
          </button>
        </div>
      </header>

      {showWarning && (
        <LargeDiffWarning
          files={
            selectedFiles.size > 0
              ? files.filter((f) => selectedFiles.has(f.filename))
              : files
          }
          onProceed={() => { setShowWarning(false); initReview() }}
          onCancel={() => setShowWarning(false)}
        />
      )}
    </>
  )
}
