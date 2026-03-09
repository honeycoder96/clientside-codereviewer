import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcuts() {
  const files           = useStore((s) => s.files)
  const selectedFile    = useStore((s) => s.selectedFile)
  const reviewStatus    = useStore((s) => s.reviewStatus)
  const selectFile      = useStore((s) => s.selectFile)
  const clearDiff       = useStore((s) => s.clearDiff)
  const initReview      = useStore((s) => s.initReview)
  const diffViewMode    = useStore((s) => s.diffViewMode)
  const setDiffViewMode = useStore((s) => s.setDiffViewMode)
  const paletteOpen     = useStore((s) => s.paletteOpen)

  const navTimerRef = useRef(null)

  useEffect(() => {
    function onKey(e) {
      if (paletteOpen) return
      if (IGNORED_TAGS.has(e.target.tagName)) return
      if (e.target.contentEditable === 'true') return
      if (files.length === 0) return

      const idx = files.findIndex((f) => f.filename === selectedFile)

      switch (e.key) {
        case 'j': {
          e.preventDefault()
          const next = files[Math.min(idx + 1, files.length - 1)]?.filename ?? null
          clearTimeout(navTimerRef.current)
          navTimerRef.current = setTimeout(() => selectFile(next), 150)
          break
        }
        case 'k': {
          e.preventDefault()
          const prev = files[idx === -1 ? files.length - 1 : Math.max(idx - 1, 0)]?.filename ?? null
          clearTimeout(navTimerRef.current)
          navTimerRef.current = setTimeout(() => selectFile(prev), 150)
          break
        }
        case 'r':
          if (reviewStatus === 'idle') initReview()
          break
        case 'n':
          if (reviewStatus !== 'reviewing') clearDiff()
          break
        case 'Escape':
          selectFile(null)
          break
        case 'v':
          setDiffViewMode(diffViewMode === 'unified' ? 'split' : 'unified')
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(navTimerRef.current)
    }
  }, [files, selectedFile, reviewStatus, selectFile, clearDiff, initReview, diffViewMode, setDiffViewMode, paletteOpen])
}
