import { riskLabel } from '../../lib/scoring'

const SEVERITY_STYLES = {
  critical: 'bg-red-900 text-red-300',
  warning:  'bg-yellow-900 text-yellow-300',
  info:     'bg-blue-900 text-blue-300',
}

const RISK_STYLES = {
  green:  'bg-green-900 text-green-300',
  yellow: 'bg-yellow-900 text-yellow-300',
  red:    'bg-red-900 text-red-300',
}

/**
 * Usage:
 *   <Badge severity="critical" />       → "CRITICAL" in red
 *   <Badge severity="warning" />        → "WARNING" in yellow
 *   <Badge risk={7.2} />                → "7.2 High" in red
 *   <Badge risk={0} showDash />         → "—" in gray (when no data yet)
 */
export default function Badge({ severity, risk, showDash, className = '' }) {
  if (risk !== undefined) {
    if (risk === 0 && showDash) {
      return (
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono bg-gray-700 text-gray-400 ${className}`}>
          —
        </span>
      )
    }
    const { label, color } = riskLabel(risk)
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono ${RISK_STYLES[color]} ${className}`}>
        {risk} {label}
      </span>
    )
  }

  if (severity) {
    const cls = SEVERITY_STYLES[severity] ?? 'bg-gray-700 text-gray-300'
    return (
      <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-mono uppercase ${cls} ${className}`}>
        {severity}
      </span>
    )
  }

  return null
}
