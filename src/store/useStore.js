import { create } from 'zustand'
import { createEngine, getEngine, destroyEngine } from '../lib/engine'
import { parseDiff as parseDiffFn } from '../lib/diffParser'
import { computeDiffStats } from '../lib/diffStats'
import { reviewDiff, cancelCurrentReview } from '../lib/reviewer'
import { saveReview } from '../lib/persist'
import { AGENT_IDS } from '../lib/agents'
import { DEFAULT_MODEL_ID } from '../lib/models'
import { STORAGE_KEYS } from '../config'
import { BUILTIN_PROFILES, findProfile } from '../lib/profiles'
import {
  saveToHistory,
  loadHistoryList,
  loadHistoryEntry,
  deleteHistoryEntry as idbDeleteHistoryEntry,
  clearHistory as idbClearHistory,
} from '../lib/history'
import { computeDelta } from '../lib/issueDelta'

// Token flush interval for UI batching (ms) — reduces React re-renders during streaming
const TOKEN_FLUSH_INTERVAL = 50

const engineSlice = (set, get) => ({
  engineStatus: 'idle',
  loadProgress: 0,
  loadMessage: '',
  selectedModel: localStorage.getItem(STORAGE_KEYS.SELECTED_MODEL) ?? DEFAULT_MODEL_ID,

  initEngine: async () => {
    const model = useStore.getState().selectedModel
    set({ engineStatus: 'loading', loadProgress: 0, loadMessage: '' })
    try {
      await createEngine(model, (progress) => {
        set({
          loadMessage: progress.text,
          loadProgress: Math.round((progress.progress ?? 0) * 100),
        })
      })
      set({ engineStatus: 'ready', loadProgress: 100 })
    } catch (err) {
      set({ engineStatus: 'error', loadMessage: err.message })
    }
  },

  resetEngine: () => {
    set({ engineStatus: 'idle', loadProgress: 0, loadMessage: '' })
  },

  setModel: (modelId) => {
    // Only allow pre-load model selection
    if (get().engineStatus !== 'idle') return
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId)
    set({ selectedModel: modelId })
  },

  switchModel: (modelId) => {
    // Mid-session switch: cancel review, destroy engine, reset all state
    cancelCurrentReview()
    destroyEngine()
    localStorage.setItem(STORAGE_KEYS.SELECTED_MODEL, modelId)
    set({
      selectedModel: modelId,
      engineStatus: 'idle',
      loadProgress: 0,
      loadMessage: '',
      // Reset review state so stale results don't linger
      reviewStatus: 'idle',
      streamingText: '',
      currentAgentId: null,
      tokensPerSecond: 0,
      fileReviews: new Map(),
      diffReview: null,
      files: [],
      rawDiff: '',
      selectedFile: null,
      selectedFiles: new Set(),
      fileStatuses: new Map(),
      agentStatuses: new Map(),
      reviewWarnings: [],
    })
  },
})

const diffSlice = (set, get) => ({
  rawDiff: '',
  files: [],
  diffStats: null,

  setDiff: (raw) => set({ rawDiff: raw }),

  parseDiff: async () => {
    const { rawDiff } = get()
    if (!rawDiff?.trim()) return

    let files
    if (typeof Worker !== 'undefined') {
      const worker = new Worker(
        new URL('../workers/diffParser.worker.js', import.meta.url),
        { type: 'module' }
      )
      files = await new Promise((resolve, reject) => {
        worker.onmessage = ({ data }) => {
          worker.terminate()
          if (data.error) reject(new Error(data.error))
          else resolve(data.files)
        }
        worker.onerror = (e) => { worker.terminate(); reject(e) }
        worker.postMessage({ rawDiff })
      })
    } else {
      files = parseDiffFn(rawDiff)
    }

    set({ files, selectedFile: null, diffStats: computeDiffStats(files) })
    get().initSelectedFiles(files.map((f) => f.filename))
  },

  clearDiff: () => set({ rawDiff: '', files: [], selectedFile: null, selectedFiles: new Set(), diffStats: null, reviewQueue: [] }),
})

const reviewSlice = (set, get) => ({
  reviewStatus: 'idle',
  currentChunkIndex: 0,
  currentAgentId: null,
  agentStatuses: new Map(),  // Map<agentId, { status, issueCount }>
  fileStatuses: new Map(),   // Map<filename, 'pending'|'reviewing'|'done'>
  fileReviews: new Map(),    // Map<filename, FileReview>
  diffReview: null,
  streamingText: '',
  tokensPerSecond: 0,
  reviewWarnings: [],        // string[] — surfaced after review (chunk failures, save errors)
  reviewImportMeta: null,    // { model, reviewMode, createdAt } | null — set when loaded from .review file
  reviewQueue: [],           // QueuedDiff[] — { id, rawDiff, files, label, queuedAt }
  issueDelta: null,          // { introduced, resolved, unchanged } | null
  userAnnotations: (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ANNOTATIONS) ?? '[]')
      return new Map(saved)
    } catch { return new Map() }
  })(),

  initReview: async () => {
    const { files, selectedFiles, reviewMode } = get()
    const filesToReview =
      selectedFiles.size > 0 ? files.filter((f) => selectedFiles.has(f.filename)) : files
    const filenames = filesToReview.map((f) => f.filename)

    // Initial agent statuses depend on review mode
    const initialAgentIds = reviewMode === 'fast'
      ? ['unified']
      : AGENT_IDS

    set({
      reviewStatus: 'reviewing',
      fileStatuses: new Map(filenames.map((f) => [f, 'pending'])),
      agentStatuses: new Map(initialAgentIds.map((id) => [id, { status: 'pending', issueCount: 0 }])),
      fileReviews: new Map(),
      diffReview: null,
      streamingText: '',
      currentChunkIndex: 0,
      currentAgentId: null,
      tokensPerSecond: 0,
      reviewWarnings: [],
      reviewImportMeta: null,
      userAnnotations: new Map(),
      issueDelta: null,
    })

    // Token buffer + visibility state — declared outside try so finally can clean up
    let tokenBuffer = ''
    let flushTimer  = null

    const flushTokens = () => {
      if (tokenBuffer) {
        const toFlush = tokenBuffer
        tokenBuffer = ''
        set((s) => ({ streamingText: s.streamingText + toFlush }))
      }
      flushTimer = null
    }

    // Page Visibility API: when tab is hidden stop scheduling flushes.
    // Tokens keep accumulating in tokenBuffer; flush immediately on tab focus.
    // The LLM inference is unaffected — only the React state update is paused.
    const onVisibilityChange = () => {
      if (!document.hidden && tokenBuffer) {
        if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
        flushTokens()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    try {
      const engine = getEngine()
      if (!engine) throw new Error('Engine not ready')

      const result = await reviewDiff(engine, filesToReview, {
        onToken: (token) => {
          tokenBuffer += token
          // Only schedule flush when tab is visible — suppresses re-renders in background
          if (!document.hidden && !flushTimer) {
            flushTimer = setTimeout(flushTokens, TOKEN_FLUSH_INTERVAL)
          }
        },

        onAgentStart: (agentId) =>
          set((s) => ({
            currentAgentId: agentId,
            agentStatuses: new Map(s.agentStatuses).set(agentId, { status: 'running', issueCount: 0 }),
          })),

        onAgentComplete: (agentId, agentResult) =>
          set((s) => ({
            agentStatuses: new Map(s.agentStatuses).set(agentId, {
              status: 'done',
              issueCount: agentResult.issues?.length ?? 0,
            }),
          })),

        onFileStart: (filename) =>
          set((s) => ({
            fileStatuses: new Map(s.fileStatuses).set(filename, 'reviewing'),
          })),

        onFileComplete: (filename, fileReview) =>
          set((s) => ({
            fileStatuses: new Map(s.fileStatuses).set(filename, 'done'),
            fileReviews: new Map(s.fileReviews).set(filename, fileReview),
          })),

        onProgress: ({ chunkIndex, agentId }) =>
          set({ currentChunkIndex: chunkIndex, currentAgentId: agentId }),

        onTps: (tps) => set({ tokensPerSecond: tps }),

        clearStreaming: () => {
          // Flush any buffered tokens before clearing
          if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
          tokenBuffer = ''
          set({ streamingText: '' })
        },
      })

      const warnings = []
      if (result.failedChunks > 0) {
        warnings.push(
          `${result.failedChunks} chunk${result.failedChunks !== 1 ? 's' : ''} could not be reviewed — results may be incomplete`
        )
      }

      const { ok: saved } = saveReview({
        rawDiff: get().rawDiff,
        files: get().files,
        diffReview: result,
        fileReviews: get().fileReviews,
        annotations: get().userAnnotations,
      })
      if (!saved) {
        warnings.push('Review could not be auto-saved (storage quota exceeded or private mode)')
      }

      // Compute delta against the previous review (non-blocking).
      // Must run before saveToHistory so historyEntries[0] still points to the prior review.
      const prevMeta = get().historyEntries[0]
      if (prevMeta) {
        loadHistoryEntry(prevMeta.id)
          .then((prev) => {
            if (!prev) return
            const delta = computeDelta(get().fileReviews, new Map(prev.fileReviews))
            if (delta !== null) set({ issueDelta: delta })
          })
          .catch(() => {})
      }

      // Persist to IndexedDB history (non-blocking — never fails the review)
      saveToHistory({
        rawDiff:       get().rawDiff,
        files:         get().files,
        diffReview:    result,
        fileReviews:   get().fileReviews,
        annotations:   get().userAnnotations,
        selectedModel: get().selectedModel,
        reviewMode:    get().reviewMode,
      }).then(() => get().loadHistory()).catch(() => {})

      set({ diffReview: result, reviewStatus: 'done', reviewWarnings: warnings })

      // Auto-advance queue: if items are waiting, start the next review after a brief pause
      if (get().reviewQueue.length > 0) {
        setTimeout(() => get().dequeueNext(), 400)
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        set({ reviewStatus: 'idle', streamingText: '' })
      } else {
        console.error('Review failed:', err)
        set({ reviewStatus: 'error', streamingText: '' })
      }
    } finally {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (flushTimer) { clearTimeout(flushTimer); flushTimer = null }
    }
  },

  cancelReview: () => {
    cancelCurrentReview()
    // reviewStatus transitions to 'idle' when AbortError is caught in initReview
  },

  // Parse a diff and add it to the queue. If idle, start immediately.
  // Returns { ok: true, position } | { ok: false, error }
  enqueueReview: async (rawDiff, label = '') => {
    if (!rawDiff?.trim()) return { ok: false, error: 'Empty diff' }

    // Parse files — use Worker when available (same pattern as parseDiff)
    let files
    try {
      if (typeof Worker !== 'undefined') {
        const worker = new Worker(
          new URL('../workers/diffParser.worker.js', import.meta.url),
          { type: 'module' }
        )
        files = await new Promise((resolve, reject) => {
          worker.onmessage = ({ data }) => {
            worker.terminate()
            if (data.error) reject(new Error(data.error))
            else resolve(data.files)
          }
          worker.onerror = (e) => { worker.terminate(); reject(e) }
          worker.postMessage({ rawDiff })
        })
      } else {
        files = parseDiffFn(rawDiff)
      }
    } catch (err) {
      return { ok: false, error: 'Failed to parse diff: ' + err.message }
    }

    if (!files || files.length === 0) return { ok: false, error: 'No files found in diff' }

    const resolvedLabel = label || files[0]?.filename?.split('/').pop() || 'Untitled'
    const item = {
      id:       `queue_${Date.now()}`,
      rawDiff,
      files,
      label:    resolvedLabel,
      queuedAt: new Date().toISOString(),
    }

    const { reviewStatus } = get()
    if (reviewStatus === 'idle') {
      // Start immediately — no queuing needed
      set({
        rawDiff,
        files,
        diffStats: computeDiffStats(files),
        selectedFiles: new Set(files.map((f) => f.filename)),
        selectedFile: null,
      })
      setTimeout(() => get().initReview(), 0)
      return { ok: true, position: 0 }
    }

    set((s) => ({ reviewQueue: [...s.reviewQueue, item] }))
    return { ok: true, position: get().reviewQueue.length }
  },

  // Pop the head of the queue and start its review
  dequeueNext: () => {
    const { reviewQueue } = get()
    if (reviewQueue.length === 0) return
    const [next, ...rest] = reviewQueue
    set({
      reviewQueue:   rest,
      rawDiff:       next.rawDiff,
      files:         next.files,
      diffStats:     computeDiffStats(next.files),
      selectedFiles: new Set(next.files.map((f) => f.filename)),
      selectedFile:  null,
    })
    setTimeout(() => get().initReview(), 0)
  },

  removeFromQueue: (id) =>
    set((s) => ({ reviewQueue: s.reviewQueue.filter((item) => item.id !== id) })),

  restoreReview: ({ rawDiff, files, diffReview, fileReviews, annotations = new Map(), importMeta = null }) => {
    if (useStore.getState().reviewStatus !== 'idle') return

    // Derive which agents were used from the saved review (handles fast/deep mode)
    const savedAgentIds = new Set()
    for (const fr of fileReviews.values()) {
      for (const chunk of fr.chunks ?? []) {
        for (const ar of chunk.agentResults ?? []) {
          savedAgentIds.add(ar.agentId)
        }
      }
    }
    const agentStatusEntries = savedAgentIds.size > 0
      ? [...savedAgentIds]
      : AGENT_IDS

    set({
      rawDiff,
      files,
      diffReview,
      fileReviews,
      reviewStatus: 'done',
      selectedFile: null,
      diffStats: null,
      reviewImportMeta: importMeta,
      userAnnotations: annotations instanceof Map ? annotations : new Map(annotations),
      fileStatuses: new Map(files.map((f) => [f.filename, 'done'])),
      agentStatuses: new Map(
        agentStatusEntries.map((id) => [id, { status: 'done', issueCount: 0 }])
      ),
      selectedFiles: new Set(files.map((f) => f.filename)),
    })
  },

  // annotation state: 'accepted' | 'dismissed'. Calling with the same state toggles it off.
  setAnnotation: (issueKey, state) =>
    set((s) => {
      const next = new Map(s.userAnnotations)
      if (next.get(issueKey) === state) {
        next.delete(issueKey)
      } else {
        next.set(issueKey, state)
      }
      try { localStorage.setItem(STORAGE_KEYS.ANNOTATIONS, JSON.stringify([...next.entries()])) } catch { /* quota */ }
      return { userAnnotations: next }
    }),

  clearAnnotations: () => {
    localStorage.removeItem(STORAGE_KEYS.ANNOTATIONS)
    set({ userAnnotations: new Map() })
  },

  setAgentStatus: (agentId, status) =>
    set((s) => ({
      agentStatuses: new Map(s.agentStatuses).set(agentId, { status, issueCount: 0 }),
    })),

  setFileStatus: (filename, status) =>
    set((s) => ({
      fileStatuses: new Map(s.fileStatuses).set(filename, status),
    })),

  appendFileReview: (filename, fileReview) =>
    set((s) => ({
      fileReviews: new Map(s.fileReviews).set(filename, fileReview),
    })),

  appendStreamingToken: (token) =>
    set((s) => ({ streamingText: s.streamingText + token })),

  clearStreamingText: () => set({ streamingText: '' }),
})

const DEFAULT_ISSUE_FILTERS = { minSeverity: 'info', categories: ['bug', 'security', 'performance'] }

function loadEnabledAgents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ENABLED_AGENTS))
    if (Array.isArray(saved)) return new Set(saved)
  } catch { /* ignore */ }
  return new Set(AGENT_IDS)
}

function loadIssueFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.ISSUE_FILTERS))
    if (saved && typeof saved === 'object') return { ...DEFAULT_ISSUE_FILTERS, ...saved }
  } catch { /* ignore */ }
  return { ...DEFAULT_ISSUE_FILTERS }
}

function loadUserProfiles() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILES))
    if (Array.isArray(saved)) return saved
  } catch { /* ignore */ }
  return []
}

const settingsSlice = (set, get) => ({
  focusContext:  localStorage.getItem(STORAGE_KEYS.FOCUS_CONTEXT) ?? '',
  enabledAgents: loadEnabledAgents(),
  issueFilters:  loadIssueFilters(),
  reviewMode:    localStorage.getItem(STORAGE_KEYS.REVIEW_MODE) ?? 'fast',
  settingsOpen:  false,
  userProfiles:  loadUserProfiles(),

  setFocusContext: (text) => {
    localStorage.setItem(STORAGE_KEYS.FOCUS_CONTEXT, text)
    set({ focusContext: text })
  },

  toggleAgent: (agentId) => {
    const next = new Set(get().enabledAgents)
    if (next.has(agentId)) next.delete(agentId); else next.add(agentId)
    localStorage.setItem(STORAGE_KEYS.ENABLED_AGENTS, JSON.stringify([...next]))
    set({ enabledAgents: next })
  },

  setIssueFilters: (patch) => {
    const next = { ...get().issueFilters, ...patch }
    localStorage.setItem(STORAGE_KEYS.ISSUE_FILTERS, JSON.stringify(next))
    set({ issueFilters: next })
  },

  setReviewMode: (mode) => {
    localStorage.setItem(STORAGE_KEYS.REVIEW_MODE, mode)
    set({ reviewMode: mode })
  },

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  resetSettings: () => {
    localStorage.removeItem(STORAGE_KEYS.FOCUS_CONTEXT)
    localStorage.removeItem(STORAGE_KEYS.ENABLED_AGENTS)
    localStorage.removeItem(STORAGE_KEYS.ISSUE_FILTERS)
    localStorage.removeItem(STORAGE_KEYS.REVIEW_MODE)
    set({
      focusContext:  '',
      enabledAgents: new Set(AGENT_IDS),
      issueFilters:  { ...DEFAULT_ISSUE_FILTERS },
      reviewMode:    'fast',
    })
  },

  applyProfile: (id) => {
    const { userProfiles } = get()
    const profile = findProfile(id, userProfiles)
    if (!profile) return
    const enabledAgents = new Set(profile.enabledAgents)
    localStorage.setItem(STORAGE_KEYS.FOCUS_CONTEXT, profile.focusContext)
    localStorage.setItem(STORAGE_KEYS.REVIEW_MODE, profile.reviewMode)
    localStorage.setItem(STORAGE_KEYS.ENABLED_AGENTS, JSON.stringify([...enabledAgents]))
    localStorage.setItem(STORAGE_KEYS.ISSUE_FILTERS, JSON.stringify(profile.issueFilters))
    set({
      focusContext:  profile.focusContext,
      reviewMode:    profile.reviewMode,
      enabledAgents,
      issueFilters:  { ...profile.issueFilters },
    })
  },

  saveCurrentAsProfile: (name) => {
    if (!name?.trim()) return false
    const { focusContext, reviewMode, enabledAgents, issueFilters, userProfiles } = get()
    const newProfile = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      icon: '◈',
      description: '',
      focusContext,
      reviewMode,
      enabledAgents: [...enabledAgents],
      issueFilters: { ...issueFilters },
      builtin: false,
    }
    const next = [...userProfiles, newProfile]
    try { localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(next)) } catch { return false }
    set({ userProfiles: next })
    return true
  },

  deleteUserProfile: (id) => {
    const next = get().userProfiles.filter((p) => p.id !== id)
    localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(next))
    set({ userProfiles: next })
  },

  importUserProfiles: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr)
      if (!Array.isArray(parsed)) return false
      const valid = parsed.filter((p) => p.id && p.name).map((p) => ({ ...p, builtin: false }))
      const { userProfiles } = get()
      const importedIds = new Set(valid.map((p) => p.id))
      const merged = [...userProfiles.filter((p) => !importedIds.has(p.id)), ...valid]
      localStorage.setItem(STORAGE_KEYS.PROFILES, JSON.stringify(merged))
      set({ userProfiles: merged })
      return true
    } catch { return false }
  },

  exportUserProfiles: () => {
    return JSON.stringify(get().userProfiles, null, 2)
  },
})

const uiSlice = (set) => ({
  selectedFile: null,
  rightPanelTab: 'summary',
  sidebarCollapsed: false,
  splitRatio: 0.28,
  selectedFiles: new Set(),
  diffViewMode: localStorage.getItem(STORAGE_KEYS.DIFF_VIEW_MODE) ?? 'unified',
  paletteOpen: false,

  selectFile: (file) => set({ selectedFile: file }),
  setTab: (tab) => set({ rightPanelTab: tab }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),
  setDiffViewMode: (mode) => {
    localStorage.setItem(STORAGE_KEYS.DIFF_VIEW_MODE, mode)
    set({ diffViewMode: mode })
  },

  initSelectedFiles: (filenames) => set({ selectedFiles: new Set(filenames) }),
  toggleFileSelection: (filename) =>
    set((s) => {
      const next = new Set(s.selectedFiles)
      next.has(filename) ? next.delete(filename) : next.add(filename)
      return { selectedFiles: next }
    }),
  selectAllFiles: () =>
    set((s) => ({ selectedFiles: new Set(s.files.map((f) => f.filename)) })),
  deselectAllFiles: () => set({ selectedFiles: new Set() }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
})

const historySlice = (set, get) => {
  // Warm the list on store creation (non-blocking)
  loadHistoryList()
    .then((entries) => set({ historyEntries: entries }))
    .catch(() => { /* IDB unavailable — degrade silently */ })

  return {
    historyEntries: [],

    loadHistory: async () => {
      try {
        const entries = await loadHistoryList()
        set({ historyEntries: entries })
      } catch { /* IDB unavailable */ }
    },

    deleteHistoryEntry: async (id) => {
      try {
        await idbDeleteHistoryEntry(id)
        set((s) => ({ historyEntries: s.historyEntries.filter((e) => e.id !== id) }))
      } catch { /* ignore */ }
    },

    clearHistory: async () => {
      try {
        await idbClearHistory()
        set({ historyEntries: [] })
      } catch { /* ignore */ }
    },
  }
}

export const useStore = create((set, get) => ({
  ...engineSlice(set, get),
  ...diffSlice(set, get),
  ...reviewSlice(set, get),
  ...settingsSlice(set, get),
  ...uiSlice(set, get),
  ...historySlice(set, get),
}))
