import { useEffect } from 'react'
import { useStore } from '../store/useStore'

const IGNORED_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcuts() {
  const files        = useStore((s) => s.files)
  const selectedFile = useStore((s) => s.selectedFile)
  const reviewStatus = useStore((s) => s.reviewStatus)
  const selectFile   = useStore((s) => s.selectFile)
  const clearDiff    = useStore((s) => s.clearDiff)
  const initReview   = useStore((s) => s.initReview)

  useEffect(() => {
    function onKey(e) {
      if (IGNORED_TAGS.has(e.target.tagName)) return
      if (e.target.contentEditable === 'true') return
      if (files.length === 0) return

      const idx = files.findIndex((f) => f.filename === selectedFile)

      switch (e.key) {
        case 'j':
          e.preventDefault()
          selectFile(files[Math.min(idx + 1, files.length - 1)]?.filename ?? null)
          break
        case 'k':
          e.preventDefault()
          // When nothing is selected (idx === -1), 'k' selects the last file (symmetric with 'j' → first)
          selectFile(files[idx === -1 ? files.length - 1 : Math.max(idx - 1, 0)]?.filename ?? null)
          break
        case 'r':
          if (reviewStatus === 'idle') initReview()
          break
        case 'n':
          if (reviewStatus !== 'reviewing') clearDiff()
          break
        case 'Escape':
          selectFile(null)
          break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [files, selectedFile, reviewStatus, selectFile, clearDiff, initReview])
}
