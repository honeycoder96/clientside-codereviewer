import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import StreamingText from '../ui/StreamingText'
import Spinner from '../ui/Spinner'

export default function CommitMessage() {
  const reviewStatus   = useStore((s) => s.reviewStatus)
  const diffReview     = useStore((s) => s.diffReview)
  const streamingText  = useStore((s) => s.streamingText)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)

  useEffect(() => {
    return () => { clearTimeout(copyTimerRef.current) }
  }, [])

  const commitMessage = diffReview?.commitMessage ?? ''

  function handleCopy() {
    navigator.clipboard.writeText(commitMessage).then(() => {
      setCopied(true)
      clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  if (reviewStatus === 'reviewing' || (reviewStatus === 'done' && !commitMessage)) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Spinner size="sm" />
          Generating commit message...
        </div>
        {streamingText && <StreamingText />}
      </div>
    )
  }

  if (!commitMessage) {
    return (
      <div className="p-4 text-xs text-gray-600">
        Start a review to generate a commit message.
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Suggested commit message</span>
        <button
          onClick={handleCopy}
          className={`text-xs px-2 py-1 rounded border transition-colors ${
            copied
              ? 'border-green-700 text-green-400'
              : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white'
          }`}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
        {commitMessage}
      </pre>
    </div>
  )
}
