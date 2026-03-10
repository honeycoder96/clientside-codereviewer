const DB_NAME    = 'wgpu_review_history'
const DB_VERSION = 1
const STORE_NAME = 'reviews'
const MAX_ENTRIES = 50

// Cache the open connection so we don't reopen on every call
let _dbPromise = null

function openHistoryDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }

    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => {
      _dbPromise = null // allow retry on next call
      reject(e.target.error)
    }
  })
  return _dbPromise
}

async function evictOldest(db) {
  const keys = await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAllKeys()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })

  if (keys.length <= MAX_ENTRIES) return

  const toDelete = keys.slice(0, keys.length - MAX_ENTRIES)
  await new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    for (const key of toDelete) store.delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
  })
}

/**
 * Save a completed review to history. Returns the generated id.
 */
export async function saveToHistory({ rawDiff, files, diffReview, fileReviews, annotations, selectedModel, reviewMode }) {
  const db = await openHistoryDB()
  const id = crypto.randomUUID()

  const record = {
    id,
    createdAt:     new Date().toISOString(),
    selectedModel: selectedModel ?? '',
    reviewMode:    reviewMode ?? 'fast',
    overallRisk:   diffReview?.overallRisk ?? 0,
    fileCount:     files?.length ?? 0,
    firstFilename: files?.[0]?.filename ?? '',
    totalIssues:   diffReview?.totalIssues ?? { critical: 0, warning: 0, info: 0 },
    // Full payload — only fetched on restore
    rawDiff,
    files,
    diffReview,
    fileReviews: [...(fileReviews instanceof Map ? fileReviews : new Map()).entries()],
    annotations: [...(annotations instanceof Map ? annotations : new Map()).entries()],
  }

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(record)
    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
  })

  await evictOldest(db)
  return id
}

/**
 * Returns all entries sorted newest-first, with the heavy fields stripped.
 * Safe to call frequently — used for the list view.
 */
export async function loadHistoryList() {
  const db  = await openHistoryDB()
  const all = await new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).index('createdAt').getAll()
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => reject(e.target.error)
  })

  return all
    .reverse() // newest first
    .map(({ id, createdAt, selectedModel, reviewMode, overallRisk, fileCount, firstFilename, totalIssues }) => ({
      id, createdAt, selectedModel, reviewMode, overallRisk, fileCount, firstFilename, totalIssues,
    }))
}

/**
 * Returns the full record for a single entry (including rawDiff, fileReviews, etc.).
 * Returns null if the entry has been deleted.
 */
export async function loadHistoryEntry(id) {
  const db = await openHistoryDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get(id)
    req.onsuccess = (e) => resolve(e.target.result ?? null)
    req.onerror   = (e) => reject(e.target.error)
  })
}

/**
 * Delete a single entry by id.
 */
export async function deleteHistoryEntry(id) {
  const db = await openHistoryDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
  })
}

/**
 * Delete all entries.
 */
export async function clearHistory() {
  const db = await openHistoryDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).clear()
    tx.oncomplete = () => resolve()
    tx.onerror    = (e) => reject(e.target.error)
  })
}
