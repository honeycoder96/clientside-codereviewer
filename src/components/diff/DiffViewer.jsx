import { useMemo, useState, useEffect } from 'react'
import { Diff, Hunk, Decoration, parseDiff, getChangeKey } from 'react-diff-view'
import { useStore } from '../../store/useStore'
import { useIssueFilters } from '../../hooks/useIssueFilters'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import InlineComment from './InlineComment'

/**
 * Match our selectedFile (normalized filename) against react-diff-view's
 * parsed file entry, which uses oldPath / newPath.
 */
function findRdvFile(rdvFiles, selectedFile) {
  return rdvFiles.find(
    (f) => f.newPath === selectedFile || f.oldPath === selectedFile
  )
}

/**
 * Build widgets map: changeKey → <InlineComment /> for each issue.
 * Works identically for both unified and split viewType — react-diff-view
 * renders widget rows spanning the full width in both modes.
 */
function buildWidgets(fileReview, hunks) {
  if (!fileReview?.mergedIssues?.length || !hunks?.length) return {}
  const widgets = {}
  for (const hunk of hunks) {
    for (const change of hunk.changes) {
      const lineNum = change.lineNumber ?? change.newLineNumber ?? change.oldLineNumber
      const matchingIssues = fileReview.mergedIssues.filter(
        (i) => i.line === lineNum
      )
      if (matchingIssues.length > 0) {
        const key = getChangeKey(change)
        widgets[key] = (
          <div>
            {matchingIssues.map((issue, idx) => (
              <InlineComment key={`${issue.line}:${issue.category}:${idx}`} issue={issue} filename={fileReview.filename} />
            ))}
          </div>
        )
      }
    }
  }
  return widgets
}

export default function DiffViewer() {
  const selectedFile    = useStore((s) => s.selectedFile)
  const rawDiff         = useStore((s) => s.rawDiff)
  const fileStatuses    = useStore((s) => s.fileStatuses)
  const fileReviews     = useStore((s) => s.fileReviews)
  const diffViewMode    = useStore((s) => s.diffViewMode)
  const setDiffViewMode = useStore((s) => s.setDiffViewMode)
  const { filterIssues } = useIssueFilters()
  const { isMobile } = useBreakpoint()

  // On mobile, always use unified regardless of stored preference
  const effectiveViewType = isMobile ? 'unified' : diffViewMode

  const rdvFile = useMemo(() => {
    if (!selectedFile || !rawDiff) return null
    try {
      const parsed = parseDiff(rawDiff)
      return findRdvFile(parsed, selectedFile) ?? null
    } catch {
      return null
    }
  }, [selectedFile, rawDiff])

  const fileStatus = fileStatuses.get(selectedFile)
  const fileReview = fileReviews.get(selectedFile)
  const showComments = fileStatus === 'done' && fileReview

  const filteredFileReview = useMemo(() => {
    if (!fileReview) return null
    return { ...fileReview, mergedIssues: filterIssues(fileReview.mergedIssues ?? []) }
  }, [fileReview, filterIssues])

  // Defer widget building to idle time so the diff renders first
  const [widgets, setWidgets] = useState({})
  useEffect(() => {
    if (!showComments || !filteredFileReview || !rdvFile) {
      setWidgets({})
      return
    }
    if (typeof requestIdleCallback !== 'undefined') {
      const id = requestIdleCallback(
        () => setWidgets(buildWidgets(filteredFileReview, rdvFile.hunks)),
        { timeout: 500 }
      )
      return () => cancelIdleCallback(id)
    }
    setWidgets(buildWidgets(filteredFileReview, rdvFile.hunks))
  }, [showComments, filteredFileReview, rdvFile])

  if (!selectedFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm overflow-hidden">
        Select a file to view its diff
      </div>
    )
  }

  if (!rdvFile || rdvFile.hunks.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600 text-sm overflow-hidden">
        No diff available for this file
      </div>
    )
  }

  const fileTypeSymbol = rdvFile.type === 'add' ? '+' : rdvFile.type === 'delete' ? '−' : '~'

  return (
    <div className="flex-1 overflow-auto bg-gray-900">
      {/* File path bar with view toggle */}
      <div className="sticky top-0 z-10 px-4 py-1.5 bg-gray-800 border-b border-gray-700 font-mono text-xs text-gray-300 flex items-center gap-2 min-w-0">
        <span className="text-gray-500 flex-shrink-0">{fileTypeSymbol}</span>
        <span className="truncate flex-1">{selectedFile}</span>

        {/* View mode toggle — desktop only */}
        {!isMobile && (
          <div className="flex rounded overflow-hidden border border-gray-700 flex-shrink-0 ml-2">
            <button
              onClick={() => setDiffViewMode('unified')}
              title="Unified view (V)"
              className={`px-2 py-0.5 text-xs font-sans transition-colors ${
                effectiveViewType === 'unified'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ≡ Unified
            </button>
            <button
              onClick={() => setDiffViewMode('split')}
              title="Split view (V)"
              className={`px-2 py-0.5 text-xs font-sans border-l border-gray-700 transition-colors ${
                effectiveViewType === 'split'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ⊟ Split
            </button>
          </div>
        )}
      </div>

      <Diff
        viewType={effectiveViewType}
        diffType={rdvFile.type}
        hunks={rdvFile.hunks}
        widgets={widgets}
      >
        {(hunks) =>
          hunks.map((hunk, i) => [
            <Decoration key={`deco-${i}`}>
              <div className="diff-decoration-content">{hunk.content}</div>
            </Decoration>,
            <Hunk key={`hunk-${i}`} hunk={hunk} />,
          ])
        }
      </Diff>
    </div>
  )
}
