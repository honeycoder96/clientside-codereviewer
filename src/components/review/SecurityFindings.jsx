import { useState } from 'react'
import { useStore } from '../../store/useStore'
import Badge from '../ui/Badge'
import Spinner from '../ui/Spinner'

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

function SecurityIssueRow({ issue }) {
  const [expanded, setExpanded] = useState(false)
  const filename = issue.filename?.split('/').pop() ?? ''

  return (
    <div className="border border-gray-700 rounded p-3 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge severity={issue.severity} />
        <span className="text-xs text-gray-400 font-mono truncate">
          {filename}{issue.line ? `:${issue.line}` : ''}
        </span>
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

export default function SecurityFindings() {
  const reviewStatus = useStore((s) => s.reviewStatus)
  const fileReviews  = useStore((s) => s.fileReviews)

  const securityIssues = [...fileReviews.values()]
    .flatMap((fr) =>
      fr.mergedIssues
        .filter((i) => i.category === 'security')
        .map((i) => ({ ...i, filename: fr.filename }))
    )
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))

  if (reviewStatus === 'reviewing' && securityIssues.length === 0) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-gray-500">
        <Spinner size="sm" />
        Scanning for security issues...
      </div>
    )
  }

  if (securityIssues.length === 0) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-green-400">
        <span>✓</span>
        No security issues found
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <span className="text-xs text-gray-500">
        {securityIssues.length} security issue{securityIssues.length !== 1 ? 's' : ''}
        {reviewStatus === 'reviewing' && <span className="ml-1 text-gray-600">(scanning...)</span>}
      </span>
      {securityIssues.map((issue, i) => (
        <SecurityIssueRow key={`${issue.filename}:${issue.line}:${i}`} issue={issue} />
      ))}
    </div>
  )
}
