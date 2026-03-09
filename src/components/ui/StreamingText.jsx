import { useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'

export default function StreamingText() {
  const streamingText = useStore((s) => s.streamingText)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [streamingText])

  if (!streamingText) return null

  return (
    <div className="overflow-y-auto max-h-32 bg-gray-950 rounded border border-gray-700 p-2">
      <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
        {streamingText}
        <span className="animate-pulse text-indigo-400">▋</span>
      </pre>
      <div ref={bottomRef} />
    </div>
  )
}
