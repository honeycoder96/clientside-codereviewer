import { useCallback } from 'react'
import { useStore } from '../store/useStore'

const SEVERITY_RANK = { info: 1, warning: 2, critical: 3 }

export function useIssueFilters() {
  const { minSeverity, categories } = useStore((s) => s.issueFilters)

  const filterIssues = useCallback(
    (issues) =>
      issues.filter(
        (i) =>
          (SEVERITY_RANK[i.severity] ?? 1) >= (SEVERITY_RANK[minSeverity] ?? 1) &&
          categories.includes(i.category)
      ),
    [minSeverity, categories]
  )

  const isFiltered =
    minSeverity !== 'info' ||
    categories.length < 3 ||
    !['bug', 'security', 'performance'].every((c) => categories.includes(c))

  return { filterIssues, isFiltered }
}
