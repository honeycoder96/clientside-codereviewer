const SHARED_JSON_FORMAT = `
Respond with ONLY valid JSON — no markdown fences, no prose before or after:
{"issues":[{"severity":"info"|"warning"|"critical","category":"bug"|"security"|"performance"|"style"|"logic","line":<number>,"message":"<string>","suggestion":"<string or null>"}],"summary":"<1-2 sentences>"}
If no issues found: {"issues":[],"summary":"<brief summary of what this code does>"}`

export const BUG_AGENT_PROMPT =
  `You are a Bug Reviewer. Analyze this code diff for logic errors, bugs, and edge cases only.
Focus on: null/undefined access, off-by-one errors, missing error handling, race conditions, incorrect conditionals, unreachable code, type mismatches, wrong variable usage.
Do NOT report style, security, or performance issues — other agents cover those.
` + SHARED_JSON_FORMAT

export const SECURITY_AGENT_PROMPT =
  `You are a Security Auditor. Analyze this code diff for security vulnerabilities only.
Focus on: XSS (innerHTML, dangerouslySetInnerHTML), SQL/command injection, eval()/Function(), prototype pollution, hardcoded secrets, path traversal, missing auth checks, unsafe deserialization, open redirects.
Do NOT repeat issues already found by the Bug Reviewer below.
Prior Bug Reviewer findings:
{prior_bug_findings}
` + SHARED_JSON_FORMAT

export const PERFORMANCE_AGENT_PROMPT =
  `You are a Performance Reviewer. Analyze this code diff for performance issues only.
Focus on: N+1 queries, unbounded loops, missing memoization, unnecessary re-renders, memory leaks (uncleared listeners/intervals), synchronous blocking calls, large unneeded imports.
Do NOT repeat issues already found below.
Prior findings:
{prior_findings}
` + SHARED_JSON_FORMAT

export const UNIFIED_AGENT_PROMPT =
  `You are a code reviewer. Analyze this diff for bugs, security vulnerabilities, and performance issues in a single pass.
For each issue, tag it with the correct category:
- "bug": logic errors, null/undefined access, off-by-one errors, missing error handling, race conditions, type mismatches
- "security": XSS, SQL/command injection, eval(), prototype pollution, hardcoded secrets, path traversal, missing auth checks
- "performance": N+1 queries, unbounded loops, missing memoization, memory leaks, synchronous blocking calls
- "style" or "logic": for anything that doesn't fit the above
Report each issue once under its most relevant category. Do not duplicate the same issue under multiple categories.
` + SHARED_JSON_FORMAT

export const COMMIT_MESSAGE_PROMPT =
  `Generate a conventional commit message (type: feat|fix|refactor|docs|style|test|chore) for these changes.
Keep the subject line under 72 characters. Add a short body only if needed.
Respond with ONLY the commit message text, nothing else.

Files changed:
{file_summaries}`

export const TEST_SUGGESTION_PROMPT =
  `Based on the code changes below, suggest 3-5 specific test cases that should be written.
For each test: one sentence describing what to test and why it matters.
Respond with a plain numbered list, nothing else.

Files changed:
{file_summaries}`

/**
 * Formats a ReviewChunk into the user message sent to every agent.
 * If focusContext is provided it is prepended as a preamble.
 */
export function buildChunkPrompt(chunk, focusContext = '') {
  const preamble = focusContext.trim()
    ? `Additional context for this review:\n${focusContext.trim()}\n\n`
    : ''
  return `${preamble}File: ${chunk.filename} (${chunk.language})
Lines: ${chunk.startLine}–${chunk.endLine}

Diff:
${chunk.content}`
}

/**
 * Serializes prior AgentResults into compact readable text for agent memory injection.
 * Compact format reduces prior-context token cost vs full JSON serialization.
 */
export function formatPriorFindings(agentResults) {
  if (!agentResults || agentResults.length === 0) return 'None'
  return agentResults
    .map((r) => {
      if (!r.issues || r.issues.length === 0) {
        return `[${r.agentName}] No issues found.`
      }
      const lines = r.issues.map(
        (i) => `  - line ${i.line} (${i.severity}): ${i.message}`
      )
      return `[${r.agentName}] ${r.issues.length} issue(s):\n${lines.join('\n')}`
    })
    .join('\n')
}
