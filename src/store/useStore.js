import { create } from 'zustand'
import { createEngine, getEngine, destroyEngine } from '../lib/engine'
import { parseDiff as parseDiffFn } from '../lib/diffParser'
import { reviewDiff, cancelCurrentReview } from '../lib/reviewer'
import { saveReview } from '../lib/persist'
import { AGENT_IDS } from '../lib/agents'
import { DEFAULT_MODEL_ID } from '../lib/models'
import { STORAGE_KEYS } from '../config'

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

  setDiff: (raw) => set({ rawDiff: raw }),

  parseDiff: () => {
    const { rawDiff } = get()
    const files = parseDiffFn(rawDiff)
    set({ files, selectedFile: null })
    get().initSelectedFiles(files.map((f) => f.filename))
  },

  clearDiff: () => set({ rawDiff: '', files: [], selectedFile: null, selectedFiles: new Set() }),
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

  initReview: async () => {
    const { files, selectedFiles } = get()
    const filesToReview =
      selectedFiles.size > 0 ? files.filter((f) => selectedFiles.has(f.filename)) : files
    const filenames = filesToReview.map((f) => f.filename)

    set({
      reviewStatus: 'reviewing',
      fileStatuses: new Map(filenames.map((f) => [f, 'pending'])),
      agentStatuses: new Map(AGENT_IDS.map((id) => [id, { status: 'pending', issueCount: 0 }])),
      fileReviews: new Map(),
      diffReview: null,
      streamingText: '',
      currentChunkIndex: 0,
      currentAgentId: null,
      tokensPerSecond: 0,
      reviewWarnings: [],
    })

    try {
      const engine = getEngine()
      if (!engine) throw new Error('Engine not ready')

      const result = await reviewDiff(engine, filesToReview, {
        onToken: (token) =>
          set((s) => ({ streamingText: s.streamingText + token })),

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

        clearStreaming: () => set({ streamingText: '' }),
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
      })
      if (!saved) {
        warnings.push('Review could not be auto-saved (storage quota exceeded or private mode)')
      }

      set({ diffReview: result, reviewStatus: 'done', reviewWarnings: warnings })
    } catch (err) {
      if (err.name === 'AbortError') {
        set({ reviewStatus: 'idle', streamingText: '' })
      } else {
        console.error('Review failed:', err)
        set({ reviewStatus: 'error', streamingText: '' })
      }
    }
  },

  cancelReview: () => {
    cancelCurrentReview()
    // reviewStatus transitions to 'idle' when AbortError is caught in initReview
  },

  restoreReview: ({ rawDiff, files, diffReview, fileReviews }) => {
    if (useStore.getState().reviewStatus !== 'idle') return
    set({
      rawDiff,
      files,
      diffReview,
      fileReviews,
      reviewStatus: 'done',
      selectedFile: null,
      fileStatuses: new Map(files.map((f) => [f.filename, 'done'])),
      agentStatuses: new Map(
        AGENT_IDS.map((id) => [id, { status: 'done', issueCount: 0 }])
      ),
      selectedFiles: new Set(files.map((f) => f.filename)),
    })
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

const settingsSlice = (set, get) => ({
  focusContext:  localStorage.getItem(STORAGE_KEYS.FOCUS_CONTEXT) ?? '',
  enabledAgents: loadEnabledAgents(),
  issueFilters:  loadIssueFilters(),
  settingsOpen:  false,

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

  setSettingsOpen: (open) => set({ settingsOpen: open }),

  resetSettings: () => {
    localStorage.removeItem(STORAGE_KEYS.FOCUS_CONTEXT)
    localStorage.removeItem(STORAGE_KEYS.ENABLED_AGENTS)
    localStorage.removeItem(STORAGE_KEYS.ISSUE_FILTERS)
    set({
      focusContext:  '',
      enabledAgents: new Set(AGENT_IDS),
      issueFilters:  { ...DEFAULT_ISSUE_FILTERS },
    })
  },
})

const uiSlice = (set) => ({
  selectedFile: null,
  rightPanelTab: 'summary',
  sidebarCollapsed: false,
  splitRatio: 0.28,
  selectedFiles: new Set(),

  selectFile: (file) => set({ selectedFile: file }),
  setTab: (tab) => set({ rightPanelTab: tab }),
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSplitRatio: (ratio) => set({ splitRatio: ratio }),

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
})

export const useStore = create((set, get) => ({
  ...engineSlice(set, get),
  ...diffSlice(set, get),
  ...reviewSlice(set, get),
  ...settingsSlice(set, get),
  ...uiSlice(set, get),
}))
