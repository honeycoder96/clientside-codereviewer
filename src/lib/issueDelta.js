const FUZZ = 3  // ±N lines — tolerates diff churn between reviews

function issueMatches(a, b) {
  return a.category === b.category && Math.abs(a.line - b.line) <= FUZZ
}

function toMap(fileReviews) {
  if (fileReviews instanceof Map) return fileReviews
  return new Map(Array.isArray(fileReviews) ? fileReviews.map((fr) => [fr.filename, fr]) : [])
}

/**
 * Compare two sets of file reviews and classify issues as introduced, resolved, or unchanged.
 *
 * Accepts Map<filename, FileReview> or FileReview[] for both arguments.
 *
 * Returns null when the two reviews share no filenames — prevents misleading deltas
 * when the user reviews a completely different codebase.
 *
 * Returns { introduced: Issue[], resolved: Issue[], unchanged: Issue[] } otherwise.
 */
export function computeDelta(currentFileReviews, previousFileReviews) {
  const currMap = toMap(currentFileReviews)
  const prevMap = toMap(previousFileReviews)

  // Require at least one shared filename
  const hasOverlap = [...currMap.keys()].some((f) => prevMap.has(f))
  if (!hasOverlap) return null

  const introduced = []
  const resolved   = []
  const unchanged  = []

  // Classify current issues as introduced or unchanged
  for (const [filename, currFr] of currMap) {
    const prevIssues = prevMap.get(filename)?.mergedIssues ?? []
    for (const issue of currFr.mergedIssues ?? []) {
      if (prevIssues.some((prev) => issueMatches(issue, prev))) {
        unchanged.push({ ...issue, filename })
      } else {
        introduced.push({ ...issue, filename })
      }
    }
  }

  // Classify previous issues that no longer appear as resolved
  for (const [filename, prevFr] of prevMap) {
    const currIssues = currMap.get(filename)?.mergedIssues ?? []
    for (const issue of prevFr.mergedIssues ?? []) {
      if (!currIssues.some((curr) => issueMatches(issue, curr))) {
        resolved.push({ ...issue, filename })
      }
    }
  }

  return { introduced, resolved, unchanged }
}
