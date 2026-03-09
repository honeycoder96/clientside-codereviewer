/**
 * Pure computation over FileDiff[] — no LLM, no async.
 * Called after diff parse in the store.
 */

const TEST_FILE_RE = /\.(test|spec)\.[cm]?[jt]sx?$|\/(__tests__|test|tests)\//

const ENTRY_POINT_RE = /^(index|main|app|routes?|router|entry)\.[cm]?[jt]sx?$/i

const CONFIG_FILE_RE = /\.(config|conf)\.[cm]?[jt]sx?$|^(vite|webpack|babel|jest|rollup|tsconfig|jsconfig)/i

function isTestFile(filename) {
  return TEST_FILE_RE.test(filename)
}

function isEntryOrConfig(filename) {
  const base = filename.split('/').pop()
  return ENTRY_POINT_RE.test(base) || CONFIG_FILE_RE.test(base)
}

/**
 * @param {object[]} files — FileDiff[] from parseDiff
 * @returns {{ churnFiles, testCoverage, blastRadiusFiles, coupledDirs } | null}
 */
export function computeDiffStats(files) {
  if (!files || files.length === 0) return null

  // ── Churn ratio ─────────────────────────────────────────────────────────
  // deletions / (additions + deletions). >0.7 = heavy rewrite.
  const churnFiles = files
    .filter((f) => f.status !== 'deleted' && f.additions + f.deletions > 0)
    .map((f) => ({
      filename: f.filename,
      churn: f.deletions / (f.additions + f.deletions),
    }))
    .filter((f) => f.churn > 0.70)
    .sort((a, b) => b.churn - a.churn)

  // ── Test coverage signal ─────────────────────────────────────────────────
  const sourceCount = files.filter((f) => !isTestFile(f.filename) && f.status !== 'deleted').length
  const testCount   = files.filter((f) => isTestFile(f.filename)).length
  const testCoverage = {
    sourceCount,
    testCount,
    // Warn when prod code changes with zero accompanying test changes
    warn: sourceCount > 0 && testCount === 0,
  }

  // ── Blast radius ─────────────────────────────────────────────────────────
  const blastRadiusFiles = files.filter((f) => isEntryOrConfig(f.filename))

  // ── Coupling clusters ────────────────────────────────────────────────────
  // Directories with ≥3 files changed together
  const dirCounts = new Map()
  for (const f of files) {
    const dir = f.filename.includes('/')
      ? f.filename.slice(0, f.filename.lastIndexOf('/'))
      : '(root)'
    dirCounts.set(dir, (dirCounts.get(dir) ?? 0) + 1)
  }
  const coupledDirs = [...dirCounts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .map(([dir, count]) => ({ dir, count }))

  return { churnFiles, testCoverage, blastRadiusFiles, coupledDirs }
}
