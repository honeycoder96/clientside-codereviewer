import { chunkFile } from '../lib/chunker.js'
import { runAgentPipeline, getApplicableAgentIds } from '../lib/agents.js'
import { calculateFileRisk, calculateOverallRisk, countBySeverity } from '../lib/scoring.js'
import { TEST_SUGGESTION_PROMPT } from '../lib/prompts.js'
import { MAX_TOKENS_TESTS, CHUNK_CACHE_MAX } from './config-cli.js'

// ---------------------------------------------------------------------------
// Abort control
// ---------------------------------------------------------------------------

let _abortController = null

export function cancelCurrentReview() {
  _abortController?.abort()
}

// ---------------------------------------------------------------------------
// Chunk result cache — in-memory only (no sessionStorage in Node)
// ---------------------------------------------------------------------------

const _chunkCache = new Map()

function setCacheEntry(hash, value) {
  _chunkCache.set(hash, value)
  // Evict oldest entries if over limit
  if (_chunkCache.size > CHUNK_CACHE_MAX) {
    const firstKey = _chunkCache.keys().next().value
    _chunkCache.delete(firstKey)
  }
}

function djb2Hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h, 33) ^ str.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

function hashCacheKey(chunk, enabledAgentIds, focusContext, reviewMode) {
  const raw =
    chunk.content +
    '|' +
    [...enabledAgentIds].sort().join(',') +
    '|' +
    (focusContext ?? '') +
    '|' +
    (reviewMode ?? 'fast')
  return djb2Hash(raw)
}

// ---------------------------------------------------------------------------
// LLM streaming helper (for test generation)
// ---------------------------------------------------------------------------

async function streamLLMCall(engine, messages, callbacks, signal, maxTokens) {
  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    max_tokens: maxTokens,
  })
  let text = ''
  for await (const part of stream) {
    if (signal?.aborted) break
    const token = part.choices[0]?.delta?.content ?? ''
    if (token) {
      callbacks.onToken?.(token)
      text += token
    }
  }
  return text.trim()
}

async function generateTests(engine, fileSummaries, callbacks, signal) {
  const content = TEST_SUGGESTION_PROMPT.replace('{file_summaries}', fileSummaries)
  const raw = await streamLLMCall(
    engine,
    [{ role: 'user', content }],
    callbacks,
    signal,
    MAX_TOKENS_TESTS
  )
  return raw
    .split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Client-side commit message generation (no LLM call needed)
// ---------------------------------------------------------------------------

function generateCommitMessageClientSide(fileReviews) {
  if (!fileReviews || fileReviews.length === 0) return ''

  const allIssues = fileReviews.flatMap((fr) => fr.mergedIssues)
  const counts = countBySeverity(allIssues)
  const hasFixes =
    counts.critical > 0 ||
    allIssues.some((i) => i.category === 'security' && i.severity !== 'info')

  const type = hasFixes ? 'fix' : 'refactor'

  const bases = fileReviews.map((fr) =>
    fr.filename.split('/').pop().replace(/\.[^.]+$/, '')
  )
  const scope =
    bases.length === 1
      ? bases[0]
      : bases.length <= 3
        ? bases.join(', ')
        : `${bases[0]} +${bases.length - 1} more`

  const parts = []
  if (counts.critical > 0) parts.push(`${counts.critical} critical`)
  if (counts.warning  > 0) parts.push(`${counts.warning} warning${counts.warning !== 1 ? 's' : ''}`)
  if (counts.info     > 0) parts.push(`${counts.info} info`)

  const issueText =
    parts.length > 0
      ? `address ${parts.join(', ')} issue${allIssues.length !== 1 ? 's' : ''}`
      : `update ${fileReviews.length} file${fileReviews.length !== 1 ? 's' : ''}`

  const subject = `${type}(${scope}): ${issueText}`
  const truncated = subject.length > 72 ? subject.slice(0, 69) + '...' : subject

  const firstSummary = fileReviews
    .flatMap((fr) => fr.chunks.map((c) => c.summary))
    .find((s) => s && s.length > 15)

  return firstSummary ? `${truncated}\n\n${firstSummary}` : truncated
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * CLI-adapted review orchestrator. Identical pipeline to the browser version
 * but with three targeted changes:
 *   1. Uses chunkFile() directly — no Web Workers
 *   2. Cache is in-memory only — no sessionStorage
 *   3. Options are injected via the `options` parameter — no Zustand
 *
 * @param {object}   engine     — OllamaClient instance
 * @param {object[]} files      — FileDiff[] from parseDiff()
 * @param {object}   options    — { enabledAgents, focusContext, reviewMode, noTests, noCommitMsg }
 * @param {object}   callbacks  — progress callbacks (see below)
 *
 * Callbacks:
 *   onToken(token)
 *   onAgentStart(agentId)
 *   onAgentComplete(agentId, result)
 *   onFileStart(filename, index, total)
 *   onFileComplete(filename, fileReview)
 *   onFileSkipped(filename, reason)
 *   onProgress({ chunkIndex, totalChunks, agentId, filename })
 *   onTps(tps)
 *   onChunkError(chunkId, message)
 *   onPostReviewError(message)
 *   clearStreaming()
 */
export async function reviewDiff(engine, files, options = {}, callbacks = {}) {
  _abortController = new AbortController()
  const signal = _abortController.signal

  const {
    enabledAgents = new Set(['bug', 'security', 'performance']),
    focusContext  = '',
    reviewMode    = 'fast',
    noTests       = false,
    noCommitMsg   = false,
  } = options

  const pipelineOptions = { enabledAgentIds: enabledAgents, focusContext, reviewMode }

  const startedAt = Date.now()

  // Chunk all non-deleted files synchronously (no Workers in Node)
  const reviewableFiles = files.filter((f) => f.status !== 'deleted')
  const chunksByFile = new Map()
  let totalChunks = 0

  for (const file of reviewableFiles) {
    const chunks = chunkFile(file)
    if (chunks.length > 0) {
      chunksByFile.set(file.filename, chunks)
      totalChunks += chunks.length
    }
  }

  // Report deleted files as skipped
  for (const file of files) {
    if (file.status === 'deleted') {
      callbacks.onFileSkipped?.(file.filename, 'deleted')
    }
  }

  let chunkIndex = 0
  let failedChunks = 0
  const completedFileReviews = []
  const reviewableCount = reviewableFiles.filter((f) => chunksByFile.has(f.filename)).length

  for (let fi = 0; fi < reviewableFiles.length; fi++) {
    const file = reviewableFiles[fi]
    if (signal.aborted) break

    const applicableAgentIds = getApplicableAgentIds(file, enabledAgents)

    if (applicableAgentIds.size === 0) {
      callbacks.onFileSkipped?.(file.filename, 'no-applicable-agents')
      continue
    }

    const fileChunks = chunksByFile.get(file.filename)
    if (!fileChunks || fileChunks.length === 0) continue

    callbacks.onFileStart?.(file.filename, fi + 1, reviewableCount)

    const chunkReviews = []
    const filePipelineOptions = { ...pipelineOptions, enabledAgentIds: applicableAgentIds, focusContext }

    for (const chunk of fileChunks) {
      if (signal.aborted) break

      callbacks.onProgress?.({
        chunkIndex,
        totalChunks,
        agentId: null,
        filename: file.filename,
      })

      const cacheKey = hashCacheKey(chunk, applicableAgentIds, focusContext, reviewMode)
      if (_chunkCache.has(cacheKey)) {
        chunkReviews.push(_chunkCache.get(cacheKey))
        chunkIndex++
        continue
      }

      try {
        const chunkReview = await runAgentPipeline(engine, chunk, {
          onToken:         (t)          => callbacks.onToken?.(t),
          onAgentStart:    (id)         => {
            callbacks.onAgentStart?.(id)
            callbacks.onProgress?.({ chunkIndex, totalChunks, agentId: id, filename: file.filename })
          },
          onAgentComplete: (id, result) => callbacks.onAgentComplete?.(id, result),
          onTps:           (tps)        => callbacks.onTps?.(tps),
          clearStreaming:  ()           => callbacks.clearStreaming?.(),
        }, signal, filePipelineOptions)

        setCacheEntry(cacheKey, chunkReview)
        chunkReviews.push(chunkReview)
      } catch (err) {
        if (err.name === 'AbortError') break
        failedChunks++
        callbacks.onChunkError?.(chunk.id, err.message)
      }

      chunkIndex++
    }

    if (signal.aborted) break

    const allMergedIssues = chunkReviews.flatMap((cr) => cr.mergedIssues)
    const fileReview = {
      filename: file.filename,
      chunks: chunkReviews,
      mergedIssues: allMergedIssues,
      riskScore: calculateFileRisk(allMergedIssues),
      issueCount: countBySeverity(allMergedIssues),
    }

    completedFileReviews.push(fileReview)
    callbacks.onFileComplete?.(file.filename, fileReview)
  }

  // ── Post-review: commit message + tests ───────────────────────────────────
  let commitMessage = ''
  let suggestedTests = []

  if (!signal.aborted && completedFileReviews.length > 0) {
    if (!noCommitMsg) {
      commitMessage = generateCommitMessageClientSide(completedFileReviews)
    }

    if (!noTests) {
      const fileSummaries = completedFileReviews
        .map((fr) => {
          const summary = fr.chunks.map((c) => c.summary).filter(Boolean).join(' ')
          return `${fr.filename}: ${summary || 'no summary'}`
        })
        .join('\n')

      try {
        callbacks.clearStreaming?.()
        suggestedTests = await generateTests(engine, fileSummaries, callbacks, signal)
        callbacks.clearStreaming?.()
      } catch (err) {
        if (err.name !== 'AbortError') {
          callbacks.onPostReviewError?.(err.message)
        }
      }
    }
  }

  const allIssues = completedFileReviews.flatMap((fr) => fr.mergedIssues)

  return {
    files: completedFileReviews,
    failedChunks,
    overallRisk: calculateOverallRisk(completedFileReviews, files),
    totalIssues: countBySeverity(allIssues),
    securityFindings: allIssues.filter((i) => i.category === 'security'),
    commitMessage,
    suggestedTests,
    reviewedAt: new Date().toISOString(),
    totalTokens: completedFileReviews.reduce(
      (s, fr) => s + fr.chunks.reduce(
        (cs, cr) => cs + cr.agentResults.reduce((as, ar) => as + ar.tokenCount, 0), 0
      ), 0
    ),
    durationMs: Date.now() - startedAt,
  }
}
