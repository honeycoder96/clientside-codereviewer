import { TARGET_TOKENS, MAX_TOKENS } from '../config.js'

export function estimateTokens(text) {
  return Math.ceil(text.length / 4)
}

// Regex for logical code boundaries worth splitting at
const BOUNDARY_RE =
  /^[+\- ] *(function |class |const |let |var |export |async function|def |pub fn |interface |type |describe\(|it\(|test\()/

function formatChanges(header, changes) {
  return [header, ...changes.map((c) => c.content)].join('\n')
}

function makeChunk(fileDiff, hunk, hunkIndex, subIndex, changes) {
  const content = formatChanges(hunk.header, changes)
  const nonDelChanges = changes.filter((c) => c.type !== 'del')
  const startLine =
    nonDelChanges.length > 0
      ? nonDelChanges[0].lineNumber
      : hunk.newStart
  const endLine =
    nonDelChanges.length > 0
      ? nonDelChanges[nonDelChanges.length - 1].lineNumber
      : hunk.newStart + hunk.newLines

  return {
    id: `${fileDiff.filename}:chunk-${hunkIndex}-${subIndex}`,
    filename: fileDiff.filename,
    language: fileDiff.language,
    hunkIndex,
    content,
    startLine,
    endLine,
    tokenCount: estimateTokens(content),
  }
}

function splitAtBoundaries(fileDiff, hunk, hunkIndex) {
  const chunks = []
  let current = []
  let subIndex = 0

  for (let i = 0; i < hunk.changes.length; i++) {
    const change = hunk.changes[i]
    current.push(change)

    const tokens = estimateTokens(
      formatChanges(hunk.header, current)
    )

    const atBoundary =
      tokens > TARGET_TOKENS && i < hunk.changes.length - 1 &&
      BOUNDARY_RE.test(hunk.changes[i + 1]?.content ?? '')

    const hardLimit = tokens > MAX_TOKENS

    if ((atBoundary || hardLimit) && current.length > 1) {
      chunks.push(makeChunk(fileDiff, hunk, hunkIndex, subIndex, current))
      current = []
      subIndex++
    }
  }

  if (current.length > 0) {
    chunks.push(makeChunk(fileDiff, hunk, hunkIndex, subIndex, current))
  }

  return chunks
}

/**
 * Estimate total chunks across all files without running the full pipeline.
 * Used for the large-diff warning.
 */
export function estimateTotalChunks(files) {
  return files.reduce((n, f) => n + chunkFile(f).length, 0)
}

/**
 * Splits a FileDiff into ReviewChunk[] sized for the agent token budget.
 */
export function chunkFile(fileDiff) {
  const chunks = []

  fileDiff.hunks.forEach((hunk, hunkIndex) => {
    const content = formatChanges(hunk.header, hunk.changes)
    if (estimateTokens(content) <= MAX_TOKENS) {
      chunks.push(makeChunk(fileDiff, hunk, hunkIndex, 0, hunk.changes))
    } else {
      chunks.push(...splitAtBoundaries(fileDiff, hunk, hunkIndex))
    }
  })

  return chunks.filter((c) => c.tokenCount > 0)
}
