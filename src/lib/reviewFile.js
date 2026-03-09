export const REVIEW_FILE_FORMAT  = 'webgpu-code-review'
export const REVIEW_FILE_VERSION = 2  // v2 adds annotations field

/**
 * Serialize the current review state to a .review file string (minified JSON).
 *
 * @param {{ rawDiff, files, diffReview, fileReviews, selectedModel, reviewMode, annotations }} opts
 * @returns {string}
 */
export function serializeReviewFile({ rawDiff, files, diffReview, fileReviews, selectedModel, reviewMode, annotations }) {
  const payload = {
    format:     REVIEW_FILE_FORMAT,
    version:    REVIEW_FILE_VERSION,
    createdAt:  new Date().toISOString(),
    model:      selectedModel ?? '',
    reviewMode: reviewMode    ?? 'fast',
    rawDiff,
    files,
    diffReview,
    // Maps serialized as entry arrays
    fileReviews: [...fileReviews.entries()],
    annotations: [...(annotations ?? new Map()).entries()],
  }
  return JSON.stringify(payload)
}

/**
 * Parse and validate a .review file string.
 *
 * Returns one of:
 *   { ok: true,  data: { rawDiff, files, diffReview, fileReviews, meta } }
 *   { ok: false, error: string }
 *
 * `meta` = { model, reviewMode, createdAt } — for display in the UI.
 */
export function deserializeReviewFile(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not a valid .review file — could not parse JSON.' }
  }

  if (parsed.format !== REVIEW_FILE_FORMAT) {
    return { ok: false, error: 'Not a valid .review file — unrecognized format identifier.' }
  }

  if (!parsed.version || parsed.version > REVIEW_FILE_VERSION) {
    return {
      ok: false,
      error: `This .review file was created by a newer version of the app (v${parsed.version}). Please update to open it.`,
    }
  }

  if (
    typeof parsed.rawDiff !== 'string' ||
    !Array.isArray(parsed.files) ||
    !parsed.diffReview ||
    !Array.isArray(parsed.fileReviews)
  ) {
    return { ok: false, error: 'Malformed .review file — missing required fields.' }
  }

  let fileReviews
  try {
    fileReviews = new Map(parsed.fileReviews)
  } catch {
    return { ok: false, error: 'Malformed .review file — could not reconstruct file reviews.' }
  }

  // annotations is optional (absent in v1 files) — default to empty Map
  let annotations = new Map()
  try {
    if (Array.isArray(parsed.annotations)) annotations = new Map(parsed.annotations)
  } catch { /* malformed annotations — ignore */ }

  return {
    ok: true,
    data: {
      rawDiff:    parsed.rawDiff,
      files:      parsed.files,
      diffReview: parsed.diffReview,
      fileReviews,
      annotations,
      meta: {
        model:      parsed.model      ?? '',
        reviewMode: parsed.reviewMode ?? 'fast',
        createdAt:  parsed.createdAt  ?? null,
      },
    },
  }
}
