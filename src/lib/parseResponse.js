const VALID_SEVERITIES = new Set(['info', 'warning', 'critical'])
const VALID_CATEGORIES = new Set(['bug', 'security', 'performance', 'style', 'logic'])

/**
 * Strip dangerous Unicode from LLM-generated text before rendering:
 * - C0/C1 control chars (except tab \u0009 and newline \u000a)
 * - Zero-width and invisible chars (\u200b–\u200f)
 * - Line/paragraph separators and BiDi overrides (\u2028–\u202e)
 * - Interlinear annotation and invisible math (\u2060–\u2064)
 * - BOM (\ufeff)
 */
/* eslint-disable no-control-regex */
function sanitizeText(str) {
  return str.replace(
    /[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\ufeff]/g,
    ''
  )
}
/* eslint-enable no-control-regex */

/**
 * Extract and validate JSON from a raw LLM response.
 * Handles markdown fences and leading prose.
 */
export function parseReviewResponse(text) {
  // Strip markdown code fences
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()

  // Find the outermost JSON object
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')

  if (start === -1 || end === -1 || end <= start) {
    return { issues: [], summary: cleaned.slice(0, 300) }
  }

  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1))
    const issues = (Array.isArray(parsed.issues) ? parsed.issues : [])
      .filter((i) => i && typeof i.message === 'string')
      .map((i) => ({
        severity: VALID_SEVERITIES.has(i.severity) ? i.severity : 'info',
        category: VALID_CATEGORIES.has(i.category) ? i.category : 'bug',
        line: Math.max(0, Number(i.line) || 0),
        message: sanitizeText(String(i.message).slice(0, 500)),
        suggestion: i.suggestion ? sanitizeText(String(i.suggestion).slice(0, 500)) : null,
      }))

    return {
      issues,
      summary: typeof parsed.summary === 'string' ? sanitizeText(parsed.summary) : '',
    }
  } catch (err) {
    console.warn('[parseReviewResponse] JSON parse failed:', err.message, '— raw:', cleaned.slice(0, 200))
    return { issues: [], summary: cleaned.slice(0, 300) }
  }
}
