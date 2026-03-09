import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { MIN_TREE_PX, MIN_DIFF_PX } from '../config.js'
import DiffInputArea from './input/DiffInputArea'
import FileTree from './diff/FileTree'
import DiffViewer from './diff/DiffViewer'
import Header from './layout/Header'
import StatusBar from './layout/StatusBar'
import SplitLayout from './layout/SplitLayout'
import RightPanel from './review/RightPanel'

// ── Mobile tab bar ──────────────────────────────────────────────────────────

function MobileTabBar({ mobileView, setMobileView }) {
  return (
    <div className="flex items-stretch border-t border-gray-700 bg-gray-900 flex-shrink-0 h-12">
      <button
        onClick={() => setMobileView('diff')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
          mobileView === 'diff'
            ? 'text-indigo-400 border-t-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <span>📄</span>
        <span>Diff</span>
      </button>
      <button
        onClick={() => setMobileView('review')}
        className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs transition-colors ${
          mobileView === 'review'
            ? 'text-indigo-400 border-t-2 border-indigo-500'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        <span>📋</span>
        <span>Review</span>
      </button>
    </div>
  )
}

// ── Left panel (FileTree + DiffViewer) ─────────────────────────────────────

function LeftPanel() {
  const { isMobile } = useBreakpoint()
  const [sheetOpen, setSheetOpen] = useState(false)
  const selectedFile = useStore((s) => s.selectedFile)

  // Auto-close sheet when user selects a file — use store subscription so
  // setState fires inside a callback (not directly in the effect body)
  useEffect(() => {
    if (!isMobile) return
    return useStore.subscribe((state, prev) => {
      if (state.selectedFile !== prev.selectedFile && state.selectedFile) {
        setSheetOpen(false)
      }
    })
  }, [isMobile])

  // ── Mobile layout ──────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Files trigger bar */}
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 px-3 py-2 border-b border-gray-700 bg-gray-800 text-xs text-gray-400 hover:text-white flex-shrink-0 w-full text-left transition-colors"
        >
          <span className="text-gray-500 flex-shrink-0">≡</span>
          <span className="flex-1 truncate font-mono">
            {selectedFile ?? 'Select a file…'}
          </span>
          <span className="text-gray-600 text-[10px] flex-shrink-0">▲ Files</span>
        </button>

        {/* DiffViewer fills all remaining height */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <DiffViewer />
        </div>

        {/* Bottom sheet overlay */}
        {sheetOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setSheetOpen(false)}
            />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
                <span className="text-sm font-semibold text-white">Files</span>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <FileTree />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── Desktop layout (unchanged vertical split) ──────────────────────────
  return <DesktopLeftPanel />
}

function DesktopLeftPanel() {
  const containerRef = useRef(null)
  const dragging = useRef(false)
  const cleanupDrag = useRef(null)
  const [treeRatio, setTreeRatio] = useState(0.3)

  useEffect(() => {
    return () => { cleanupDrag.current?.() }
  }, [])

  const startDrag = useCallback((e) => {
    e.preventDefault()
    dragging.current = true

    function onMove(e) {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const totalHeight = rect.height
      const rawTop = e.clientY - rect.top
      const clamped = Math.min(
        Math.max(rawTop, MIN_TREE_PX),
        totalHeight - MIN_DIFF_PX
      )
      setTreeRatio(clamped / totalHeight)
    }

    function cleanup() {
      dragging.current = false
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      cleanupDrag.current = null
    }

    function onUp() { cleanup() }

    cleanupDrag.current = cleanup
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <div className="overflow-hidden flex-shrink-0" style={{ height: `${treeRatio * 100}%` }}>
        <FileTree />
      </div>
      <div
        onMouseDown={startDrag}
        className="h-1 flex-shrink-0 bg-gray-700 hover:bg-indigo-500 cursor-row-resize transition-colors"
      />
      <div className="flex-1 overflow-hidden flex flex-col">
        <DiffViewer />
      </div>
    </div>
  )
}

// ── Right panel variants ────────────────────────────────────────────────────

function IdleRightPanel() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-600">
      <p className="text-sm">
        Click <span className="text-indigo-400 font-medium">Start Review</span> to begin analysis
      </p>
      <p className="text-xs text-gray-700">4 specialized AI agents will review your diff</p>
    </div>
  )
}

function ErrorRightPanel() {
  const initReview = useStore((s) => s.initReview)
  const clearDiff  = useStore((s) => s.clearDiff)
  return (
    <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-red-400 text-sm font-medium">Review failed</p>
      <p className="text-gray-500 text-xs text-center">
        Something went wrong during inference. Check the browser console for details.
      </p>
      <div className="flex gap-3">
        <button
          onClick={initReview}
          className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
        >
          Retry
        </button>
        <button
          onClick={clearDiff}
          className="text-xs px-3 py-1.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded transition-colors"
        >
          New Review
        </button>
      </div>
    </div>
  )
}

// ── Root dashboard ──────────────────────────────────────────────────────────

export default function ReviewDashboard() {
  const files        = useStore((s) => s.files)
  const reviewStatus = useStore((s) => s.reviewStatus)
  const { isMobile } = useBreakpoint()
  const [mobileView, setMobileView] = useState('diff')
  useKeyboardShortcuts()

  if (files.length === 0) return <DiffInputArea />

  const rightPanel =
    reviewStatus === 'idle'  ? <IdleRightPanel /> :
    reviewStatus === 'error' ? <ErrorRightPanel /> :
    <RightPanel />

  // ── Mobile ───────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
        <Header />
        <div className="flex-1 overflow-hidden">
          {mobileView === 'diff' ? <LeftPanel /> : rightPanel}
        </div>
        <MobileTabBar mobileView={mobileView} setMobileView={setMobileView} />
      </div>
    )
  }

  // ── Desktop (unchanged) ──────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
      <Header />
      <SplitLayout
        left={<LeftPanel />}
        right={rightPanel}
      />
      <StatusBar />
    </div>
  )
}
