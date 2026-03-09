/**
 * Infer per-file review context from filename and language.
 * Returns a string to append to the user's manual focusContext.
 * Zero LLM cost — just makes the existing prompt smarter.
 */

const PATTERNS = [
  {
    test: /\/(auth|login|logout|session|token|oauth|jwt|password|credential)/i,
    ctx:  'Authentication code — treat every input as untrusted, flag any missing auth check or session management issue',
  },
  {
    test: /\/(api|routes?|handlers?|controllers?|endpoints?)\//i,
    ctx:  'API layer — check for missing input validation, auth guards, rate limiting, and proper error responses',
  },
  {
    test: (filename, language) => language === 'sql' || /\.(query|dao|repository)\.[jt]sx?$/.test(filename),
    ctx:  'Database layer — check for SQL injection, N+1 query patterns, missing transactions, and unindexed lookups',
  },
  {
    test: /\/(db|database|models?|repositories?|dao)\//i,
    ctx:  'Database layer — check for SQL injection, N+1 query patterns, missing transactions, and unindexed lookups',
  },
  {
    test: /\.(test|spec)\.[cm]?[jt]sx?$/,
    ctx:  'Test file — check for missing assertions, incorrect mock setups, incomplete edge-case coverage, and flaky async patterns',
  },
  {
    test: (filename, language) =>
      (language === 'typescript' || language === 'javascript') &&
      /component/i.test(filename),
    ctx:  'React component — check for hooks rules violations, stale closure bugs, missing dependency arrays, and unnecessary re-renders',
  },
  {
    test: /\/(middleware|interceptor|filter|guard)\//i,
    ctx:  'Middleware — check for security bypass risks, missing next() calls, and proper error propagation',
  },
  {
    test: /\/(migration|schema|seed)\//i,
    ctx:  'Database migration — check for irreversible operations, missing rollback paths, and data loss risks',
  },
  {
    test: /\.(config|conf)\.[cm]?[jt]sx?$|^(vite|webpack|babel|jest|rollup|tsconfig|jsconfig)/i,
    ctx:  'Configuration — check for hardcoded secrets, insecure defaults, and missing environment variable validation',
  },
]

/**
 * @param {string} filename
 * @param {string} language — from LANGUAGE_MAP in diffParser
 * @returns {string} context hint, or '' if no pattern matches
 */
export function getAutoContext(filename, language) {
  for (const { test, ctx } of PATTERNS) {
    const matched =
      typeof test === 'function'
        ? test(filename, language)
        : test.test(filename)
    if (matched) return ctx
  }
  return ''
}
