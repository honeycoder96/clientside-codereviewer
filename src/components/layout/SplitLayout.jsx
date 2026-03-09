import { useRef, useCallback, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { MIN_LEFT_PX, MIN_RIGHT_PX } from '../../config.js'

export default function SplitLayout({ left, right }) {
  const splitRatio = useStore((s) => s.splitRatio)
  const setSplitRatio = useStore((s) => s.setSplitRatio)
  const containerRef = useRef(null)
  const dragging = useRef(false)
  const cleanupDrag = useRef(null)

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
      const totalWidth = rect.width
      const rawLeft = e.clientX - rect.left

      // Enforce min widths
      const clampedLeft = Math.min(
        Math.max(rawLeft, MIN_LEFT_PX),
        totalWidth - MIN_RIGHT_PX
      )
      setSplitRatio(clampedLeft / totalWidth)
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
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [setSplitRatio])

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden">
      {/* Left panel */}
      <div
        className="flex flex-col overflow-hidden flex-shrink-0"
        style={{ width: `${splitRatio * 100}%` }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        onMouseDown={startDrag}
        className="w-1 flex-shrink-0 bg-gray-700 hover:bg-indigo-500 cursor-col-resize transition-colors"
      />

      {/* Right panel */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {right}
      </div>
    </div>
  )
}
