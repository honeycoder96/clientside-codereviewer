import { useState, useRef, useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { toPRDescription } from '../../lib/export'

const TABS = [
  { id: 'commit', label: 'Commit msg' },
  { id: 'pr',     label: 'PR description' },
]

export default function CommitMessage() {
  const reviewStatus = useStore((s) => s.reviewStatus)
  const diffReview   = useStore((s) => s.diffReview)
  const fileReviews  = useStore((s) => s.fileReviews)
  const files        = useStore((s) => s.files)

  const [tab,    setTab]    = useState('commit')
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => {
    return () => { clearTimeout(copyTimerRef.current) }
  }, [])

  const commitMessage = diffReview?.commitMessage ?? ''

  const prDescription = useMemo(() => {
    if (!diffReview || !fileReviews.size) return ''
    return toPRDescription(diffReview, fileReviews, files)
  }, [diffReview, fileReviews, files])

  const activeContent = tab === 'commit' ? commitMessage : prDescription

  function handleCopy() {
    if (!activeContent) return
    navigator.clipboard.writeText(activeContent).then(() => {
      setCopied(true)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  if (reviewStatus === 'reviewing') {
    return (
      <div className="p-4 text-xs text-gray-500">
        Commit message will appear when the review completes.
      </div>
    )
  }

  if (!commitMessage && reviewStatus !== 'done') {
    return (
      <div className="p-4 text-xs text-gray-600">
        Start a review to generate a commit message.
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-gray-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setCopied(false) }}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              tab === t.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={handleCopy}
          disabled={!activeContent}
          className={`ml-auto text-xs px-2 py-1 rounded border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
            copied
              ? 'border-green-700 text-green-400'
              : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
          }`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {tab === 'commit' && (
        commitMessage
          ? (
            <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {commitMessage}
            </pre>
          ) : (
            <p className="text-xs text-gray-600">No commit message generated.</p>
          )
      )}

      {tab === 'pr' && (
        prDescription
          ? (
            <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto max-h-[60vh] overflow-y-auto">
              {prDescription}
            </pre>
          ) : (
            <p className="text-xs text-gray-600">No PR description available.</p>
          )
      )}
    </div>
  )
}
