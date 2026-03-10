// Chunking
export const TARGET_TOKENS = 700
export const MAX_TOKENS = 800
// Chunks smaller than this token count are skipped (trivial changes like single imports)
export const MIN_REVIEW_TOKENS = 30

// Large diff thresholds
export const LARGE_FILE_THRESHOLD = 15
export const LARGE_CHUNK_THRESHOLD = 60
// Estimated seconds per chunk for time estimates
export const SECONDS_PER_CHUNK = 4

// Adaptive max_tokens for LLM completions (by chunk size)
export const MAX_TOKENS_COMPLETION_SMALL  = 300   // chunk < 100 tokens
export const MAX_TOKENS_COMPLETION_MEDIUM = 450   // chunk 100–400 tokens
export const MAX_TOKENS_COMPLETION_LARGE  = 640   // chunk 400–800 tokens
export const MAX_TOKENS_TESTS = 350               // test-suggestion LLM call

// Risk scoring
export const RISK_NORMALIZATION_DIVISOR = 5
export const SECURITY_CRITICAL_BOOST = 3

export const SEVERITY_WEIGHTS = { critical: 5, warning: 2, info: 0.5 }
export const CATEGORY_MULTIPLIERS = {
  security: 2.0,
  bug: 1.5,
  logic: 1.2,
  performance: 1.0,
  style: 0.5,
}

// Chunk result cache (in-memory only for CLI — no sessionStorage)
export const CHUNK_CACHE_PREFIX = 'wgpu_chunk_'
export const CHUNK_CACHE_MAX    = 150
