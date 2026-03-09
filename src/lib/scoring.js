import { SEVERITY_WEIGHTS, CATEGORY_MULTIPLIERS, RISK_NORMALIZATION_DIVISOR, SECURITY_CRITICAL_BOOST } from '../config.js'

/**
 * Calculate a 0–10 risk score for a single file's merged issues.
 */
export function calculateFileRisk(mergedIssues) {
  if (!mergedIssues || mergedIssues.length === 0) return 0

  const raw = mergedIssues.reduce((sum, issue) => {
    const sev = SEVERITY_WEIGHTS[issue.severity] ?? 0.5
    const cat = CATEGORY_MULTIPLIERS[issue.category] ?? 1.0
    return sum + sev * cat
  }, 0)

  return Math.min(10, +(raw / RISK_NORMALIZATION_DIVISOR).toFixed(1))
}

/**
 * Calculate overall PR risk from all completed FileReview objects.
 * Weighted by change size; boosted +3 if any critical security issue exists.
 */
export function calculateOverallRisk(fileReviews, files = []) {
  if (!fileReviews || fileReviews.length === 0) return 0

  const sizeMap = new Map(files.map((f) => [f.filename, f.additions + f.deletions]))

  let totalWeight = 0
  let weightedSum = 0
  let hasSecurityCritical = false

  for (const fr of fileReviews) {
    const weight = sizeMap.get(fr.filename) ?? 1
    weightedSum += fr.riskScore * weight
    totalWeight += weight

    if (
      fr.mergedIssues?.some(
        (i) => i.severity === 'critical' && i.category === 'security'
      )
    ) {
      hasSecurityCritical = true
    }
  }

  const base = totalWeight > 0 ? weightedSum / totalWeight : 0
  const final = hasSecurityCritical ? Math.min(10, base + SECURITY_CRITICAL_BOOST) : base
  return +final.toFixed(1)
}

export function riskLabel(score) {
  if (score <= 3) return { label: 'Low', color: 'green' }
  if (score <= 6) return { label: 'Medium', color: 'yellow' }
  return { label: 'High', color: 'red' }
}

export function countBySeverity(issues) {
  return issues.reduce(
    (acc, i) => {
      acc[i.severity] = (acc[i.severity] ?? 0) + 1
      return acc
    },
    { info: 0, warning: 0, critical: 0 }
  )
}
