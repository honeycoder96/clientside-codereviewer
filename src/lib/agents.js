import {
  BUG_AGENT_PROMPT,
  SECURITY_AGENT_PROMPT,
  PERFORMANCE_AGENT_PROMPT,
  UNIFIED_AGENT_PROMPT,
  buildChunkPrompt,
  formatPriorFindings,
} from './prompts.js'
import { parseReviewResponse } from './parseResponse.js'
import { estimateTokens } from './chunker.js'
import {
  MAX_TOKENS_COMPLETION_SMALL,
  MAX_TOKENS_COMPLETION_MEDIUM,
  MAX_TOKENS_COMPLETION_LARGE,
} from '../config.js'

// Deep-mode specialized agents (no summary — deduplication is done client-side)
export const AGENT_IDS = ['bug', 'security', 'performance']

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
]

// Fast-mode single-pass agent
export const UNIFIED_AGENT = {
  id: 'unified',
  name: 'Unified Reviewer',
  icon: '🔎',
  systemPrompt: UNIFIED_AGENT_PROMPT,
  receivesPriorResults: false,
}

// ---------------------------------------------------------------------------
// Language-aware agent skipping
// ---------------------------------------------------------------------------

// Languages where security analysis is irrelevant
const SKIP_SECURITY_LANGS = new Set([
  'markdown', 'css', 'scss', 'sass', 'less', 'text',
])

// Languages where performance analysis is irrelevant
const SKIP_PERFORMANCE_LANGS = new Set([
  'markdown', 'json', 'yaml', 'toml', 'css', 'scss', 'sass', 'less', 'text',
])

// Languages with no executable code — skip all agents
const SKIP_ALL_LANGS = new Set(['text'])

function isTestFile(filename) {
  return (
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(filename) ||
    /\/__tests__\//.test(filename) ||
    /\/test\/[^/]+\.[jt]sx?$/.test(filename)
  )
}

function isConfigFile(filename) {
  const base = filename.split('/').pop()
  return (
    /\.(config|conf)\.[cm]?[jt]sx?$/.test(filename) ||
    /^(vite|webpack|babel|jest|eslint|prettier|rollup|tsconfig|jsconfig)/i.test(base)
  )
}

/**
 * Returns the subset of enabledAgentIds that are relevant for this file's language.
 * Returns an empty Set if the file should be skipped entirely.
 */
export function getApplicableAgentIds(file, enabledAgentIds) {
  const { language, filename } = file
  if (SKIP_ALL_LANGS.has(language)) return new Set()

  const applicable = new Set(enabledAgentIds)

  if (SKIP_SECURITY_LANGS.has(language))    applicable.delete('security')
  if (SKIP_PERFORMANCE_LANGS.has(language)) applicable.delete('performance')
  if (isTestFile(filename))                 applicable.delete('security')
  if (isConfigFile(filename))               applicable.delete('performance')

  // Remove unified from the set — it's controlled separately
  applicable.delete('unified')

  return applicable
}

// ---------------------------------------------------------------------------
// Adaptive max_tokens
// ---------------------------------------------------------------------------

/**
 * Returns an appropriate max_tokens cap based on how many tokens the chunk has.
 * Smaller chunks can't possibly produce many issues — cap early to save time.
 */
export function getMaxTokens(chunkTokenCount) {
  if (chunkTokenCount < 100) return MAX_TOKENS_COMPLETION_SMALL
  if (chunkTokenCount < 400) return MAX_TOKENS_COMPLETION_MEDIUM
  return MAX_TOKENS_COMPLETION_LARGE
}

// ---------------------------------------------------------------------------
// System prompt builder (deep mode)
// ---------------------------------------------------------------------------

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
  }
  return prompt
}

// ---------------------------------------------------------------------------
// Core agent runner
// ---------------------------------------------------------------------------

/**
 * Run a single agent pass over one chunk.
 * Returns AgentResult.
 */
export async function runAgentOnChunk(engine, agent, chunk, priorResults = [], callbacks = {}, signal, focusContext = '') {
  const systemPrompt = buildSystemPrompt(agent, priorResults)
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildChunkPrompt(chunk, focusContext) },
  ]

  const maxTokens = getMaxTokens(chunk.tokenCount ?? 400)
  const startMs = Date.now()
  let fullText = ''
  let outputChunks = 0

  const stream = await engine.chat.completions.create({
    messages,
    stream: true,
    max_tokens: maxTokens,
  })

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

  const { issues, summary } = parseReviewResponse(fullText, {
    startLine: chunk.startLine,
    endLine: chunk.endLine,
  })

  return {
    agentId: agent.id,
    agentName: agent.name,
    issues,
    summary,
    tokenCount: estimateTokens(fullText),
    durationMs,
  }
}

// ---------------------------------------------------------------------------
// Pipeline orchestration
// ---------------------------------------------------------------------------

/**
 * Run the review pipeline over one chunk.
 *
 * reviewMode 'fast' (default): single unified pass, auto-escalates for critical issues.
 * reviewMode 'deep': sequential bug → security → performance agents.
 *
 * @param {object}   options
 * @param {Set}      [options.enabledAgentIds]  — which deep agents to run (default: all)
 * @param {string}   [options.focusContext]      — injected into every prompt
 * @param {string}   [options.reviewMode]        — 'fast' | 'deep'
 */
export async function runAgentPipeline(engine, chunk, callbacks = {}, signal, options = {}) {
  const {
    enabledAgentIds = new Set(AGENT_IDS),
    focusContext = '',
    reviewMode = 'fast',
  } = options

  // ── Fast mode: single unified pass ────────────────────────────────────────
  if (reviewMode === 'fast') {
    callbacks.onAgentStart?.(UNIFIED_AGENT.id)

    const unifiedResult = await runAgentOnChunk(
      engine, UNIFIED_AGENT, chunk, [], callbacks, signal, focusContext
    )

    callbacks.onAgentComplete?.(UNIFIED_AGENT.id, unifiedResult)
    callbacks.clearStreaming?.()

    const agentResults = [unifiedResult]
    let mergedIssues = unifiedResult.issues

    // ── Conditional escalation: targeted deep pass for critical findings ───
    const criticalCategories = [
      ...new Set(
        unifiedResult.issues
          .filter((i) => i.severity === 'critical')
          .map((i) => i.category)
          .filter((cat) => AGENT_IDS.includes(cat))
      ),
    ]

    if (criticalCategories.length > 0 && !signal?.aborted) {
      const escalationAgents = AGENTS.filter(
        (a) => criticalCategories.includes(a.id) && enabledAgentIds.has(a.id)
      )

      const escalationPrior = [unifiedResult]
      for (const agent of escalationAgents) {
        if (signal?.aborted) break
        callbacks.onAgentStart?.(agent.id)
        const result = await runAgentOnChunk(
          engine, agent, chunk, escalationPrior, callbacks, signal, focusContext
        )
        callbacks.onAgentComplete?.(agent.id, result)
        callbacks.clearStreaming?.()
        escalationPrior.push(result)
        agentResults.push(result)
      }

      mergedIssues = mergeAgentResults(agentResults)
    }

    return {
      chunkId: chunk.id,
      filename: chunk.filename,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      agentResults,
      mergedIssues,
      summary: unifiedResult.summary,
    }
  }

  // ── Deep mode: sequential specialized agents ───────────────────────────────
  const agentsToRun = AGENTS.filter((a) => enabledAgentIds.has(a.id))
  const priorResults = []

  for (const agent of agentsToRun) {
    if (signal?.aborted) {
      const err = new Error('Review cancelled')
      err.name = 'AbortError'
      throw err
    }

    callbacks.onAgentStart?.(agent.id)

    const result = await runAgentOnChunk(
      engine, agent, chunk, priorResults, callbacks, signal, focusContext
    )

    callbacks.onAgentComplete?.(agent.id, result)
    callbacks.clearStreaming?.()
    priorResults.push(result)
  }

  const mergedIssues = mergeAgentResults(priorResults)
  const summary = priorResults[priorResults.length - 1]?.summary ?? ''

  return {
    chunkId: chunk.id,
    filename: chunk.filename,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    agentResults: priorResults,
    mergedIssues,
    summary,
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Deduplicate issues from multiple agent results.
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
