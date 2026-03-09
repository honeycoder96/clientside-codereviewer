import { useState, useEffect, useRef } from 'react'
import Badge from '../ui/Badge'

const AGENT_ICONS = {
  bug:         '🔍',
  security:    '🔒',
  performance: '⚡',
  summary:     '📋',
}

const BORDER_COLORS = {
  critical: 'border-red-500',
  warning:  'border-yellow-500',
  info:     'border-blue-500',
}

export default function InlineComment({ issue }) {
  const [expanded, setExpanded] = useState(false)
  const [visible, setVisible] = useState(false)
  const ref = useRef(null)

  // Fade-in on mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  const border = BORDER_COLORS[issue.severity] ?? 'border-gray-500'
  const agentIcon = AGENT_ICONS[issue.foundBy] ?? ''

  return (
    <div
      ref={ref}
      className={`
        border-l-2 ${border} pl-3 pr-4 py-2 bg-gray-850 text-xs
        transition-opacity duration-200
        ${visible ? 'opacity-100' : 'opacity-0'}
      `}
      style={{ backgroundColor: 'rgb(17, 22, 30)' }}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <Badge severity={issue.severity} />
        <span className="text-gray-500 font-mono">{issue.category}</span>
        {issue.line && (
          <span className="text-gray-600 font-mono">line {issue.line}</span>
        )}
        {agentIcon && (
          <span className="text-gray-500" title={issue.foundBy}>{agentIcon}</span>
        )}
      </div>
      <p className="mt-1 text-gray-300 leading-relaxed">{issue.message}</p>
      {issue.suggestion && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 text-indigo-400 hover:text-indigo-300 text-xs"
        >
          {expanded ? 'Hide suggestion ▲' : 'Show suggestion ▼'}
        </button>
      )}
      {expanded && issue.suggestion && (
        <p className="mt-1 text-gray-400 italic leading-relaxed">{issue.suggestion}</p>
      )}
    </div>
  )
}
