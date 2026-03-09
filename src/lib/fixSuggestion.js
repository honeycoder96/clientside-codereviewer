import { getEngine } from './engine.js'

const FIX_SYSTEM_PROMPT = `You are a code fixer. Given a specific code issue and the relevant diff hunk, produce a corrected version.
Output ONLY the corrected code in a fenced code block. No explanation, no prose before or after.
Make the fix minimal — change only the lines necessary to address the stated issue.`

/**
 * Format a hunk from the store's file.hunks[] into a unified diff string.
 * file.hunks[].changes[] have { type: 'add'|'del'|'normal', content, lineNumber }
 * where content already starts with '+', '-', or ' '.
 */
export function formatHunkAsText(hunk) {
  const header = hunk.header
    ? hunk.header
    : `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
  const lines = hunk.changes.map((ch) => ch.content)
  return [header, ...lines].join('\n')
}

/**
 * Find the hunk in file.hunks that contains the given new-file line number.
 * Returns null if no hunk covers the line.
 */
export function findHunkForLine(fileHunks, line) {
  return (
    fileHunks.find(
      (h) => line >= h.newStart && line <= h.newStart + Math.max(h.newLines - 1, 0) + 5
    ) ?? fileHunks[0] ?? null
  )
}

/**
 * Stream a fix suggestion from the LLM.
 *
 * @param {object}   opts
 * @param {object}   opts.issue         — { severity, category, line, message, suggestion }
 * @param {string}   opts.filename
 * @param {string}   opts.hunkText      — formatted diff hunk around the issue
 * @param {function} opts.onToken       — (token: string) => void
 * @param {function} opts.onDone        — (fullText: string) => void
 * @param {function} opts.onError       — (message: string) => void
 */
export async function streamFixSuggestion({ issue, filename, hunkText, onToken, onDone, onError }) {
  const engine = getEngine()
  if (!engine) {
    onError?.('Model not loaded')
    return
  }

  const userContent = [
    `File: ${filename}`,
    `Issue (${issue.severity} ${issue.category}, line ${issue.line}): ${issue.message}`,
    issue.suggestion ? `Suggestion: ${issue.suggestion}` : '',
    '',
    'Diff hunk:',
    '```diff',
    hunkText,
    '```',
    '',
    'Produce the corrected lines:',
  ]
    .filter((l) => l !== null)
    .join('\n')

  try {
    const stream = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: FIX_SYSTEM_PROMPT },
        { role: 'user',   content: userContent },
      ],
      stream: true,
      max_tokens: 400,
    })

    let fullText = ''
    for await (const part of stream) {
      const token = part.choices[0]?.delta?.content ?? ''
      if (token) {
        onToken?.(token)
        fullText += token
      }
    }
    onDone?.(fullText)
  } catch (err) {
    onError?.(err.message ?? 'Fix generation failed')
  }
}
