import { useStore } from '../../store/useStore'

const CHURN_THRESHOLD = 0.70

function StatChip({ icon, label, color, title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${color} cursor-default select-none`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
  )
}

/**
 * Compact stat strip rendered above the file list.
 * Only shows when there is something noteworthy — renders null otherwise.
 */
export default function DiffStats() {
  const diffStats    = useStore((s) => s.diffStats)
  const reviewStatus = useStore((s) => s.reviewStatus)

  // Only show before/during review — not after (summary panel takes over)
  if (!diffStats || reviewStatus === 'done') return null

  const { churnFiles, testCoverage, blastRadiusFiles, coupledDirs } = diffStats

  const chips = []

  if (blastRadiusFiles.length > 0) {
    chips.push(
      <StatChip
        key="blast"
        icon="💥"
        label={`${blastRadiusFiles.length} entry point${blastRadiusFiles.length !== 1 ? 's' : ''}`}
        color="border-red-800/60 text-red-400 bg-red-950/30"
        title={`Entry-point files changed: ${blastRadiusFiles.map((f) => f.filename.split('/').pop()).join(', ')}`}
      />
    )
  }

  if (churnFiles.length > 0) {
    chips.push(
      <StatChip
        key="churn"
        icon="⚡"
        label={`${churnFiles.length} high churn`}
        color="border-yellow-800/60 text-yellow-400 bg-yellow-950/30"
        title={`Files with >${Math.round(CHURN_THRESHOLD * 100)}% deletions (heavy rewrites): ${churnFiles.map((f) => f.filename.split('/').pop()).join(', ')}`}
      />
    )
  }

  if (testCoverage.warn) {
    chips.push(
      <StatChip
        key="tests"
        icon="⚠"
        label="no test changes"
        color="border-orange-800/60 text-orange-400 bg-orange-950/30"
        title={`${testCoverage.sourceCount} source file${testCoverage.sourceCount !== 1 ? 's' : ''} changed with no corresponding test file changes`}
      />
    )
  }

  if (coupledDirs.length > 0) {
    chips.push(
      <StatChip
        key="coupling"
        icon="🔗"
        label={`${coupledDirs[0].count} files in ${coupledDirs[0].dir.split('/').pop() || coupledDirs[0].dir}`}
        color="border-blue-800/60 text-blue-400 bg-blue-950/30"
        title={`Coupled directories (≥3 files changed together): ${coupledDirs.map((d) => `${d.dir} (${d.count})`).join(', ')}`}
      />
    )
  }

  if (chips.length === 0) return null

  return (
    <div className="px-3 py-1.5 border-b border-gray-800 flex flex-wrap gap-1.5">
      {chips}
    </div>
  )
}
