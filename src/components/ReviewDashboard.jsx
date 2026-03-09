import { useRef, useState, useCallback, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { MIN_TREE_PX, MIN_DIFF_PX } from '../config.js'
import DiffInputArea from './input/DiffInputArea'
import FileTree from './diff/FileTree'
import DiffViewer from './diff/DiffViewer'
import Header from './layout/Header'
import StatusBar from './layout/StatusBar'
import SplitLayout from './layout/SplitLayout'
import RightPanel from './review/RightPanel'

function LeftPanel() {
  const containerRef = useRef(null)
  const dragging = useRef(false)
  const cleanupDrag = useRef(null)
  const [treeRatio, setTreeRatio] = useState(0.3)

  // Clean up document listeners if component unmounts mid-drag
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
      {/* File tree — resizable top section */}
      <div className="overflow-hidden flex-shrink-0" style={{ height: `${treeRatio * 100}%` }}>
        <FileTree />
      </div>

      {/* Vertical drag handle */}
      <div
        onMouseDown={startDrag}
        className="h-1 flex-shrink-0 bg-gray-700 hover:bg-indigo-500 cursor-row-resize transition-colors"
      />

      {/* Diff viewer — takes remaining height */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <DiffViewer />
      </div>
    </div>
  )
}

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

export default function ReviewDashboard() {
  const files = useStore((s) => s.files)
  const reviewStatus = useStore((s) => s.reviewStatus)
  useKeyboardShortcuts()

  if (files.length === 0) {
    return <DiffInputArea />
  }

  const rightPanel =
    reviewStatus === 'idle'  ? <IdleRightPanel /> :
    reviewStatus === 'error' ? <ErrorRightPanel /> :
    <RightPanel />

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
