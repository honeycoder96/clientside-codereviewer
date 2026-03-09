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

export default function AgentProgress() {
  const reviewStatus    = useStore((s) => s.reviewStatus)
  const agentStatuses   = useStore((s) => s.agentStatuses)
  const fileStatuses    = useStore((s) => s.fileStatuses)
  const files           = useStore((s) => s.files)
  const tokensPerSecond = useStore((s) => s.tokensPerSecond)
  const cancelReview    = useStore((s) => s.cancelReview)
  const fileReviews     = useStore((s) => s.fileReviews)

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
        <button
          onClick={cancelReview}
          className="text-xs px-2 py-1 text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800 rounded transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Agent rows — dynamic: unified in fast mode, bug/security/perf in deep mode */}
      <div className="flex flex-col">
        {agentRows}
      </div>

      {/* Live streaming output */}
      <StreamingText />
    </div>
  )
}
