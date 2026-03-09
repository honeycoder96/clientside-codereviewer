import { useMemo } from 'react'
import { Diff, Hunk, Decoration, parseDiff, getChangeKey } from 'react-diff-view'
import { useStore } from '../../store/useStore'
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
 * Widgets render between diff rows where the line number matches.
 */
function buildWidgets(fileReview, hunks) {
  if (!fileReview?.mergedIssues?.length || !hunks?.length) return {}
  const widgets = {}
  for (const hunk of hunks) {
    for (const change of hunk.changes) {
      // Match on new line number (insert/normal) or old line number (delete)
      const lineNum = change.lineNumber ?? change.newLineNumber ?? change.oldLineNumber
      const matchingIssues = fileReview.mergedIssues.filter(
        (i) => i.line === lineNum
      )
      if (matchingIssues.length > 0) {
        const key = getChangeKey(change)
        widgets[key] = (
          <div>
            {matchingIssues.map((issue, idx) => (
              <InlineComment key={`${issue.line}:${issue.category}:${idx}`} issue={issue} />
            ))}
          </div>
        )
      }
    }
  }
  return widgets
}

export default function DiffViewer() {
  const selectedFile  = useStore((s) => s.selectedFile)
  const rawDiff       = useStore((s) => s.rawDiff)
  const fileStatuses  = useStore((s) => s.fileStatuses)
  const fileReviews   = useStore((s) => s.fileReviews)

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

  return (
    <div className="flex-1 overflow-auto bg-gray-900">
      {/* File path bar */}
      <div className="sticky top-0 z-10 px-4 py-1.5 bg-gray-800 border-b border-gray-700 font-mono text-xs text-gray-300 flex items-center gap-2">
        <span className="text-gray-500">
          {rdvFile.type === 'add' ? '+' : rdvFile.type === 'delete' ? '−' : '~'}
        </span>
        <span>{selectedFile}</span>
      </div>

      <Diff
        viewType="unified"
        diffType={rdvFile.type}
        hunks={rdvFile.hunks}
        widgets={showComments ? buildWidgets(fileReview, rdvFile.hunks) : {}}
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
