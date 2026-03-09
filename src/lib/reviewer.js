import { chunkFile } from './chunker.js'
import { runAgentPipeline } from './agents.js'
import { calculateFileRisk, calculateOverallRisk, countBySeverity } from './scoring.js'
import { COMMIT_MESSAGE_PROMPT, TEST_SUGGESTION_PROMPT } from './prompts.js'

// Module-level abort controller — cancelled via cancelCurrentReview()
let _abortController = null

export function cancelCurrentReview() {
  _abortController?.abort()
}

async function streamLLMCall(engine, messages, callbacks, signal) {
  const stream = await engine.chat.completions.create({ messages, stream: true })
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

async function generateCommitMessage(engine, fileSummaries, callbacks, signal) {
  const content = COMMIT_MESSAGE_PROMPT.replace('{file_summaries}', fileSummaries)
  return streamLLMCall(engine, [{ role: 'user', content }], callbacks, signal)
}

async function generateTests(engine, fileSummaries, callbacks, signal) {
  const content = TEST_SUGGESTION_PROMPT.replace('{file_summaries}', fileSummaries)
  const raw = await streamLLMCall(engine, [{ role: 'user', content }], callbacks, signal)
  // Parse numbered list into array
  return raw
    .split('\n')
    .map((l) => l.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
}

/**
 * Main orchestrator. Processes files sequentially, streaming results progressively.
 *
 * Callbacks:
 *   onToken(token)                      — live token from active agent
 *   onAgentStart(agentId)               — agent pass beginning
 *   onAgentComplete(agentId, result)    — agent pass done
 *   onFileStart(filename)               — file review starting
 *   onFileComplete(filename, fileReview)— file fully reviewed
 *   onProgress({chunkIndex, totalChunks, agentId, filename})
 *   onTps(tps)                          — tokens/sec from last agent pass
 *   clearStreaming()                    — reset streaming text between passes
 */
export async function reviewDiff(engine, files, callbacks = {}) {
  _abortController = new AbortController()
  const signal = _abortController.signal

  const startedAt = Date.now()

  // Build chunk list grouped by file
  const chunksByFile = new Map()
  let totalChunks = 0
  for (const file of files) {
    const chunks = chunkFile(file)
    if (chunks.length > 0) {
      chunksByFile.set(file.filename, chunks)
      totalChunks += chunks.length
    }
  }

  let chunkIndex = 0
  let failedChunks = 0
  const completedFileReviews = []

  for (const file of files) {
    if (signal.aborted) break

    const fileChunks = chunksByFile.get(file.filename)
    if (!fileChunks || fileChunks.length === 0) continue

    callbacks.onFileStart?.(file.filename)

    const chunkReviews = []

    for (const chunk of fileChunks) {
      if (signal.aborted) break

      callbacks.onProgress?.({
        chunkIndex,
        totalChunks,
        agentId: null,
        filename: file.filename,
      })

      try {
        const chunkReview = await runAgentPipeline(engine, chunk, {
          onToken: (t) => callbacks.onToken?.(t),
          onAgentStart: (id) => {
            callbacks.onAgentStart?.(id)
            callbacks.onProgress?.({ chunkIndex, totalChunks, agentId: id, filename: file.filename })
          },
          onAgentComplete: (id, result) => callbacks.onAgentComplete?.(id, result),
          onTps: (tps) => callbacks.onTps?.(tps),
          clearStreaming: () => callbacks.clearStreaming?.(),
        }, signal)

        chunkReviews.push(chunkReview)
      } catch (err) {
        if (err.name === 'AbortError') break
        failedChunks++
        callbacks.onChunkError?.(chunk.id, err.message)
      }

      chunkIndex++
    }

    if (signal.aborted) break

    // Aggregate file results
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

  // Post-review generation (commit message + tests)
  let commitMessage = ''
  let suggestedTests = []

  if (!signal.aborted && completedFileReviews.length > 0) {
    const fileSummaries = completedFileReviews
      .map((fr) => {
        const summary = fr.chunks.map((c) => c.summary).filter(Boolean).join(' ')
        return `${fr.filename}: ${summary || 'no summary'}`
      })
      .join('\n')

    try {
      callbacks.clearStreaming?.()
      commitMessage = await generateCommitMessage(engine, fileSummaries, callbacks, signal)
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
