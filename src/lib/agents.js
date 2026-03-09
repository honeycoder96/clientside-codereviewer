import {
  BUG_AGENT_PROMPT,
  SECURITY_AGENT_PROMPT,
  PERFORMANCE_AGENT_PROMPT,
  SUMMARY_AGENT_PROMPT,
  buildChunkPrompt,
  formatPriorFindings,
} from './prompts.js'
import { parseReviewResponse } from './parseResponse.js'
import { estimateTokens } from './chunker.js'

export const AGENT_IDS = ['bug', 'security', 'performance', 'summary']

export const AGENTS = [
  {
    id: 'bug',
    name: 'Bug Reviewer',
    icon: '🔍',
    systemPrompt: BUG_AGENT_PROMPT,
    receivesPriorResults: false,
  },
  {
    id: 'security',
    name: 'Security Auditor',
    icon: '🔒',
    systemPrompt: SECURITY_AGENT_PROMPT,
    receivesPriorResults: true,
  },
  {
    id: 'performance',
    name: 'Performance Reviewer',
    icon: '⚡',
    systemPrompt: PERFORMANCE_AGENT_PROMPT,
    receivesPriorResults: true,
  },
  {
    id: 'summary',
    name: 'Summary Agent',
    icon: '🧠',
    systemPrompt: SUMMARY_AGENT_PROMPT,
    receivesPriorResults: true,
  },
]

function buildSystemPrompt(agent, priorResults) {
  let prompt = agent.systemPrompt
  if (!agent.receivesPriorResults) return prompt

  if (agent.id === 'security') {
    const bugResult = priorResults.find((r) => r.agentId === 'bug')
    prompt = prompt.replace(
      '{prior_bug_findings}',
      formatPriorFindings(bugResult ? [bugResult] : [])
    )
  } else if (agent.id === 'performance') {
    prompt = prompt.replace(
      '{prior_findings}',
      formatPriorFindings(priorResults)
    )
  } else if (agent.id === 'summary') {
    const bugR = priorResults.find((r) => r.agentId === 'bug')
    const secR = priorResults.find((r) => r.agentId === 'security')
    const perfR = priorResults.find((r) => r.agentId === 'performance')
    prompt = prompt
      .replace('{bug_findings}', formatPriorFindings(bugR ? [bugR] : []))
      .replace('{security_findings}', formatPriorFindings(secR ? [secR] : []))
      .replace('{performance_findings}', formatPriorFindings(perfR ? [perfR] : []))
  }
  return prompt
}

/**
 * Run a single agent pass over one chunk.
 * Returns AgentResult.
 */
export async function runAgentOnChunk(engine, agent, chunk, priorResults = [], callbacks = {}, signal) {
  const systemPrompt = buildSystemPrompt(agent, priorResults)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildChunkPrompt(chunk) },
  ]

  const startMs = Date.now()
  let fullText = ''
  let outputChunks = 0  // counts streaming delta events (≈ output tokens) for tps

  const stream = await engine.chat.completions.create({ messages, stream: true })

  for await (const part of stream) {
    if (signal?.aborted) {
      const err = new Error('Review cancelled')
      err.name = 'AbortError'
      throw err
    }
    const token = part.choices[0]?.delta?.content ?? ''
    if (token) {
      callbacks.onToken?.(token)
      fullText += token
      outputChunks++
    }
  }

  const durationMs = Date.now() - startMs
  const tps = durationMs > 0 ? Math.round((outputChunks / durationMs) * 1000) : 0
  callbacks.onTps?.(tps)

  const { issues, summary } = parseReviewResponse(fullText)

  return {
    agentId: agent.id,
    agentName: agent.name,
    issues,
    summary,
    tokenCount: estimateTokens(fullText),
    durationMs,
  }
}

/**
 * Run all 4 agents sequentially on a chunk, threading prior results as context.
 * Returns ChunkReview.
 */
export async function runAgentPipeline(engine, chunk, callbacks = {}, signal) {
  const priorResults = []

  for (const agent of AGENTS) {
    if (signal?.aborted) {
      const err = new Error('Review cancelled')
      err.name = 'AbortError'
      throw err
    }

    callbacks.onAgentStart?.(agent.id)

    const result = await runAgentOnChunk(
      engine, agent, chunk, priorResults, callbacks, signal
    )

    callbacks.onAgentComplete?.(agent.id, result)
    callbacks.clearStreaming?.()
    priorResults.push(result)
  }

  // Summary agent is last; its issues are the deduplicated final set
  const summaryResult = priorResults[priorResults.length - 1]
  const mergedIssues = mergeAgentResults(priorResults.slice(0, 3))

  return {
    chunkId: chunk.id,
    filename: chunk.filename,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    agentResults: priorResults,
    mergedIssues,
    summary: summaryResult.summary,
  }
}

/**
 * Deduplicate issues from bug/security/performance agents.
 * Keeps highest severity per (line, category) pair.
 */
export function mergeAgentResults(agentResults) {
  const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 }
  const map = new Map()

  for (const result of agentResults) {
    for (const issue of result.issues ?? []) {
      const key = `${issue.line}:${issue.category}`
      const existing = map.get(key)
      if (
        !existing ||
        (SEVERITY_RANK[issue.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)
      ) {
        map.set(key, { ...issue, foundBy: result.agentId })
      }
    }
  }

  return [...map.values()].sort((a, b) => a.line - b.line)
}
