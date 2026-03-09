import { chunkFile } from './chunker.js'
import { runAgentPipeline, getApplicableAgentIds } from './agents.js'
import { calculateFileRisk, calculateOverallRisk, countBySeverity } from './scoring.js'
import { TEST_SUGGESTION_PROMPT } from './prompts.js'
import { useStore } from '../store/useStore.js'
import { MAX_TOKENS_TESTS, CHUNK_CACHE_PREFIX, CHUNK_CACHE_MAX } from '../config.js'
import { getAutoContext } from './autoContext.js'

// ---------------------------------------------------------------------------
// Chunking helper (off main thread when Workers available)
// ---------------------------------------------------------------------------

function chunkFileAsync(fileDiff) {
  if (typeof Worker === 'undefined') return Promise.resolve(chunkFile(fileDiff))
  return new Promise((resolve) => {
    const worker = new Worker(
      new URL('../workers/chunker.worker.js', import.meta.url),
      { type: 'module' }
    )
    worker.onmessage = ({ data }) => { worker.terminate(); resolve(data.chunks ?? []) }
    worker.onerror   = () => { worker.terminate(); resolve(chunkFile(fileDiff)) }
    worker.postMessage({ fileDiff })
  })
}

// ---------------------------------------------------------------------------
// Abort control
// ---------------------------------------------------------------------------

let _abortController = null

export function cancelCurrentReview() {
  _abortController?.abort()
}

// ---------------------------------------------------------------------------
// Chunk result cache
// In-memory Map + sessionStorage write-through.
// sessionStorage survives page reloads within the same tab session; clears on
// tab close, preventing stale results from a different diff bleeding in.
// ---------------------------------------------------------------------------

const _chunkCache = new Map()

// Warm the in-memory cache from sessionStorage on module load
;(function warmCacheFromStorage() {
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (!key?.startsWith(CHUNK_CACHE_PREFIX)) continue
      const hash = key.slice(CHUNK_CACHE_PREFIX.length)
      const raw  = sessionStorage.getItem(key)
      if (raw) _chunkCache.set(hash, JSON.parse(raw))
    }
  } catch { /* sessionStorage unavailable or corrupted — degrade gracefully */ }
})()

function setCacheEntry(hash, value) {
  _chunkCache.set(hash, value)
  try {
    // Enforce max entry count by evicting the oldest sessionStorage entry
    const cacheKeys = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(CHUNK_CACHE_PREFIX)) cacheKeys.push(k)
    }
    if (cacheKeys.length >= CHUNK_CACHE_MAX) {
      sessionStorage.removeItem(cacheKeys[0])
    }
    sessionStorage.setItem(CHUNK_CACHE_PREFIX + hash, JSON.stringify(value))
  } catch { /* quota exceeded — in-memory cache still serves the current session */ }
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
// LLM streaming helper (for test generation only)
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
// Uses chunk summaries (already LLM-generated) + issue stats
// ---------------------------------------------------------------------------

function generateCommitMessageClientSide(fileReviews) {
  if (!fileReviews || fileReviews.length === 0) return ''

  const allIssues = fileReviews.flatMap((fr) => fr.mergedIssues)
  const counts = countBySeverity(allIssues)
  const hasFixes =
    counts.critical > 0 ||
    allIssues.some((i) => i.category === 'security' && i.severity !== 'info')

  const type = hasFixes ? 'fix' : 'refactor'

  // Build scope from changed filenames (strip paths and extensions)
  const bases = fileReviews.map((fr) =>
    fr.filename.split('/').pop().replace(/\.[^.]+$/, '')
  )
  const scope =
    bases.length === 1
      ? bases[0]
      : bases.length <= 3
        ? bases.join(', ')
        : `${bases[0]} +${bases.length - 1} more`

  // Issue summary phrase
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

  // Use the first meaningful chunk summary as the body (already LLM-generated)
  const firstSummary = fileReviews
    .flatMap((fr) => fr.chunks.map((c) => c.summary))
    .find((s) => s && s.length > 15)

  return firstSummary ? `${truncated}\n\n${firstSummary}` : truncated
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Callbacks:
 *   onToken(token)                       — live token from active agent
 *   onAgentStart(agentId)                — agent pass beginning
 *   onAgentComplete(agentId, result)     — agent pass done
 *   onFileStart(filename)                — file review starting
 *   onFileComplete(filename, fileReview) — file fully reviewed
 *   onFileSkipped(filename, reason)      — file skipped without review
 *   onProgress({chunkIndex, totalChunks, agentId, filename})
 *   onTps(tps)                           — tokens/sec from last agent pass
 *   clearStreaming()                      — reset streaming text between passes
 */
export async function reviewDiff(engine, files, callbacks = {}) {
  _abortController = new AbortController()
  const signal = _abortController.signal

  const { enabledAgents, focusContext, reviewMode } = useStore.getState()
  const pipelineOptions = { enabledAgentIds: enabledAgents, focusContext, reviewMode }

  const startedAt = Date.now()

  // Chunk all non-deleted files in parallel off the main thread
  const reviewableFiles = files.filter((f) => f.status !== 'deleted')
  const chunksByFile = new Map()
  let totalChunks = 0

  const allChunks = await Promise.all(reviewableFiles.map((file) => chunkFileAsync(file)))
  reviewableFiles.forEach((file, i) => {
    const chunks = allChunks[i]
    if (chunks.length > 0) {
      chunksByFile.set(file.filename, chunks)
      totalChunks += chunks.length
    }
  })

  // Report deleted files as skipped
  for (const file of files) {
    if (file.status === 'deleted') {
      callbacks.onFileSkipped?.(file.filename, 'deleted')
    }
  }

  let chunkIndex = 0
  let failedChunks = 0
  const completedFileReviews = []

  for (const file of reviewableFiles) {
    if (signal.aborted) break

    // Language-aware agent skipping: determine which agents actually apply
    const applicableAgentIds = getApplicableAgentIds(file, enabledAgents)

    // In fast mode: if NO specialized agents apply (e.g. plain text), skip the file
    // In deep mode: if no applicable agents remain, skip the file
    if (applicableAgentIds.size === 0) {
      callbacks.onFileSkipped?.(file.filename, 'no-applicable-agents')
      continue
    }

    const fileChunks = chunksByFile.get(file.filename)
    if (!fileChunks || fileChunks.length === 0) continue

    callbacks.onFileStart?.(file.filename)

    const chunkReviews = []
    // Auto-infer per-file context and merge with user's global focusContext
    const autoCtx = getAutoContext(file.filename, file.language)
    const mergedContext = [focusContext, autoCtx].filter(Boolean).join('\n')
    const filePipelineOptions = { ...pipelineOptions, enabledAgentIds: applicableAgentIds, focusContext: mergedContext }

    for (const chunk of fileChunks) {
      if (signal.aborted) break

      callbacks.onProgress?.({
        chunkIndex,
        totalChunks,
        agentId: null,
        filename: file.filename,
      })

      // ── Chunk cache lookup ─────────────────────────────────────────────────
      const cacheKey = hashCacheKey(chunk, applicableAgentIds, focusContext, reviewMode)
      if (_chunkCache.has(cacheKey)) {
        chunkReviews.push(_chunkCache.get(cacheKey))
        chunkIndex++
        continue
      }

      try {
        const chunkReview = await runAgentPipeline(engine, chunk, {
          onToken:          (t)         => callbacks.onToken?.(t),
          onAgentStart:     (id)        => {
            callbacks.onAgentStart?.(id)
            callbacks.onProgress?.({ chunkIndex, totalChunks, agentId: id, filename: file.filename })
          },
          onAgentComplete:  (id, result) => callbacks.onAgentComplete?.(id, result),
          onTps:            (tps)        => callbacks.onTps?.(tps),
          clearStreaming:   ()           => callbacks.clearStreaming?.(),
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

  // ── Post-review: commit message (client-side) + tests (LLM) ──────────────
  let commitMessage = ''
  let suggestedTests = []

  if (!signal.aborted && completedFileReviews.length > 0) {
    // Commit message is generated instantly — no LLM call
    commitMessage = generateCommitMessageClientSide(completedFileReviews)

    // Test suggestions still use LLM (creative, requires understanding)
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
