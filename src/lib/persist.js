import { STORAGE_KEYS } from '../config.js'

/**
 * Persist the completed review to localStorage.
 * Returns { ok: true } on success or { ok: false, error: string } on failure
 * (quota exceeded, private browsing, serialization error).
 */
export function saveReview({ rawDiff, files, diffReview, fileReviews, annotations }) {
  try {
    localStorage.setItem(STORAGE_KEYS.RAW_DIFF,      rawDiff)
    localStorage.setItem(STORAGE_KEYS.FILES,          JSON.stringify(files))
    localStorage.setItem(STORAGE_KEYS.DIFF_REVIEW,    JSON.stringify(diffReview))
    localStorage.setItem(STORAGE_KEYS.FILE_REVIEWS,   JSON.stringify([...fileReviews.entries()]))
    localStorage.setItem(STORAGE_KEYS.ANNOTATIONS,    JSON.stringify([...(annotations ?? new Map()).entries()]))
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

export function loadSavedReview() {
  try {
    const rawDiff = localStorage.getItem(STORAGE_KEYS.RAW_DIFF)
    if (!rawDiff) return null
    return {
      rawDiff,
      files:       JSON.parse(localStorage.getItem(STORAGE_KEYS.FILES)        ?? '[]'),
      diffReview:  JSON.parse(localStorage.getItem(STORAGE_KEYS.DIFF_REVIEW)  ?? 'null'),
      fileReviews: new Map(JSON.parse(localStorage.getItem(STORAGE_KEYS.FILE_REVIEWS) ?? '[]')),
      annotations: new Map(JSON.parse(localStorage.getItem(STORAGE_KEYS.ANNOTATIONS) ?? '[]')),
    }
  } catch {
    return null
  }
}

export function clearSavedReview() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k))
}
