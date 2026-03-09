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

// File size limit for drag-drop (50 MB)
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

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

// Split pane minimum dimensions (px)
export const MIN_TREE_PX = 80
export const MIN_DIFF_PX = 100
export const MIN_LEFT_PX = 180
export const MIN_RIGHT_PX = 320

// localStorage keys
export const STORAGE_KEYS = {
  RAW_DIFF:        'wgpu_cr_rawDiff',
  FILES:           'wgpu_cr_files',
  DIFF_REVIEW:     'wgpu_cr_diffReview',
  FILE_REVIEWS:    'wgpu_cr_fileReviews',
  ANNOTATIONS:     'wgpu_cr_annotations',
  SELECTED_MODEL:  'wgpu_cr_selectedModel',
  FOCUS_CONTEXT:   'wgpu_cr_focusContext',
  ENABLED_AGENTS:  'wgpu_cr_enabledAgents',
  ISSUE_FILTERS:   'wgpu_cr_issueFilters',
  REVIEW_MODE:     'wgpu_cr_reviewMode',
  DIFF_VIEW_MODE:  'wgpu_cr_diffViewMode',
}

// Chunk result cache (sessionStorage — survives page reload, clears on tab close)
export const CHUNK_CACHE_PREFIX = 'wgpu_chunk_'
export const CHUNK_CACHE_MAX    = 150
