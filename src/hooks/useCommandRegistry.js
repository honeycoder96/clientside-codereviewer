import { useMemo } from 'react'
import { useStore } from '../store/useStore'
import { toMarkdown, toCSV, toJSON, toSARIF, triggerDownload } from '../lib/export'
import { serializeReviewFile } from '../lib/reviewFile'
import { MODELS } from '../lib/models'
import { BUILTIN_PROFILES } from '../lib/profiles'

function isoDate() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Returns a flat array of CommandDef objects representing every available command.
 * Each command: { id, section, label, description?, icon, shortcut?, keywords?, onSelect, available }
 */
export function useCommandRegistry() {
  const files         = useStore((s) => s.files)
  const reviewStatus  = useStore((s) => s.reviewStatus)
  const diffReview    = useStore((s) => s.diffReview)
  const fileReviews   = useStore((s) => s.fileReviews)
  const rawDiff       = useStore((s) => s.rawDiff)
  const selectedModel = useStore((s) => s.selectedModel)
  const reviewMode    = useStore((s) => s.reviewMode)
  const diffViewMode  = useStore((s) => s.diffViewMode)
  const settingsOpen  = useStore((s) => s.settingsOpen)

  const initReview      = useStore((s) => s.initReview)
  const cancelReview    = useStore((s) => s.cancelReview)
  const clearDiff       = useStore((s) => s.clearDiff)
  const selectFile      = useStore((s) => s.selectFile)
  const setTab          = useStore((s) => s.setTab)
  const setDiffViewMode = useStore((s) => s.setDiffViewMode)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const setReviewMode   = useStore((s) => s.setReviewMode)
  const switchModel     = useStore((s) => s.switchModel)
  const applyProfile    = useStore((s) => s.applyProfile)
  const userProfiles    = useStore((s) => s.userProfiles)

  const isDone      = reviewStatus === 'done' && !!diffReview
  const isReviewing = reviewStatus === 'reviewing'
  const hasFiles    = files.length > 0

  return useMemo(() => {
    const cmds = []

    // ── Review actions ──────────────────────────────────────────────────────
    cmds.push({
      id: 'review:start',
      section: 'Review',
      label: 'Start Review',
      icon: '▶',
      shortcut: 'R',
      keywords: ['run', 'analyze', 'begin', 'go'],
      available: reviewStatus === 'idle' && hasFiles,
      onSelect: () => initReview(),
    })

    cmds.push({
      id: 'review:cancel',
      section: 'Review',
      label: 'Cancel Review',
      icon: '✕',
      keywords: ['stop', 'abort', 'halt'],
      available: isReviewing,
      onSelect: () => cancelReview(),
    })

    cmds.push({
      id: 'review:new',
      section: 'Review',
      label: 'New Review',
      description: 'Clear diff and start fresh',
      icon: '↺',
      shortcut: 'N',
      keywords: ['clear', 'reset', 'fresh', 'new'],
      available: !isReviewing,
      onSelect: () => clearDiff(),
    })

    // ── File navigation ──────────────────────────────────────────────────────
    for (const file of files) {
      const name = file.filename.split('/').pop()
      cmds.push({
        id: `file:${file.filename}`,
        section: 'Files',
        label: name,
        description: file.filename,
        icon: '📄',
        keywords: [file.filename, name, 'open', 'jump', 'go to'],
        available: true,
        onSelect: () => {
          selectFile(file.filename)
          setTab('diff')
        },
      })
    }

    // ── Profiles ─────────────────────────────────────────────────────────────
    for (const profile of [...BUILTIN_PROFILES, ...userProfiles]) {
      cmds.push({
        id: `profile:${profile.id}`,
        section: 'Profiles',
        label: `${profile.icon} ${profile.name}`,
        description: profile.description,
        icon: profile.icon,
        keywords: ['profile', 'preset', 'apply', profile.name.toLowerCase()],
        available: !isReviewing,
        onSelect: () => applyProfile(profile.id),
      })
    }

    // ── View commands ────────────────────────────────────────────────────────
    cmds.push({
      id: 'view:unified',
      section: 'View',
      label: 'Switch to Unified diff view',
      icon: '≡',
      shortcut: 'V',
      keywords: ['unified', 'diff', 'view', 'toggle'],
      available: diffViewMode !== 'unified',
      onSelect: () => setDiffViewMode('unified'),
    })

    cmds.push({
      id: 'view:split',
      section: 'View',
      label: 'Switch to Split diff view',
      icon: '⊟',
      shortcut: 'V',
      keywords: ['split', 'side by side', 'diff', 'view', 'toggle'],
      available: diffViewMode !== 'split',
      onSelect: () => setDiffViewMode('split'),
    })

    cmds.push({
      id: 'view:tab:summary',
      section: 'View',
      label: 'Go to Summary tab',
      icon: '◎',
      keywords: ['summary', 'tab', 'overview', 'panel'],
      available: true,
      onSelect: () => setTab('summary'),
    })

    cmds.push({
      id: 'view:tab:diff',
      section: 'View',
      label: 'Go to Diff tab',
      icon: '≋',
      keywords: ['diff', 'tab', 'changes', 'panel'],
      available: true,
      onSelect: () => setTab('diff'),
    })

    cmds.push({
      id: 'view:tab:commit',
      section: 'View',
      label: 'Go to Commit tab',
      icon: '⊕',
      keywords: ['commit', 'message', 'tab', 'git'],
      available: true,
      onSelect: () => setTab('commit'),
    })

    cmds.push({
      id: 'view:tab:history',
      section: 'View',
      label: 'Go to History tab',
      description: 'Browse and restore past reviews',
      icon: '⧗',
      keywords: ['history', 'past', 'previous', 'restore', 'tab', 'review'],
      available: true,
      onSelect: () => setTab('history'),
    })

    // ── Export ───────────────────────────────────────────────────────────────
    cmds.push({
      id: 'export:markdown',
      section: 'Export',
      label: 'Export Markdown report',
      icon: '⬇',
      keywords: ['export', 'download', 'markdown', 'md', 'report', 'save'],
      available: isDone,
      onSelect: () => {
        const { toMarkdown: _toMarkdown } = { toMarkdown }
        const content = toMarkdown(diffReview, fileReviews, files)
        triggerDownload(`code-review-${isoDate()}.md`, content, 'text/markdown')
      },
    })

    cmds.push({
      id: 'export:json',
      section: 'Export',
      label: 'Export JSON data',
      icon: '⬇',
      keywords: ['export', 'download', 'json', 'data', 'save'],
      available: isDone,
      onSelect: () => {
        const content = toJSON(diffReview, fileReviews, files)
        triggerDownload(`code-review-${isoDate()}.json`, content, 'application/json')
      },
    })

    cmds.push({
      id: 'export:csv',
      section: 'Export',
      label: 'Export CSV issues',
      icon: '⬇',
      keywords: ['export', 'download', 'csv', 'spreadsheet', 'save'],
      available: isDone,
      onSelect: () => {
        const content = toCSV(fileReviews)
        triggerDownload(`code-review-${isoDate()}.csv`, content, 'text/csv')
      },
    })

    cmds.push({
      id: 'export:sarif',
      section: 'Export',
      label: 'Export SARIF (GitHub Code Scanning)',
      description: 'Upload to GitHub for inline PR annotations',
      icon: '⬇',
      keywords: ['sarif', 'github', 'code scanning', 'export', 'download', 'pr', 'annotations'],
      available: isDone,
      onSelect: () => {
        const content = toSARIF(fileReviews)
        triggerDownload(`code-review-${isoDate()}.sarif`, content, 'application/json')
      },
    })

    cmds.push({
      id: 'export:review-file',
      section: 'Export',
      label: 'Export Review snapshot (.review)',
      description: 'Share without re-running inference',
      icon: '⬇',
      keywords: ['export', 'download', 'review', 'snapshot', 'share', 'save'],
      available: isDone,
      onSelect: () => {
        const content = serializeReviewFile({ rawDiff, files, diffReview, fileReviews, selectedModel, reviewMode })
        triggerDownload(`code-review-${isoDate()}.review`, content, 'application/json')
      },
    })

    cmds.push({
      id: 'export:copy-markdown',
      section: 'Export',
      label: 'Copy Markdown to clipboard',
      icon: '⎘',
      keywords: ['copy', 'clipboard', 'markdown', 'md'],
      available: isDone,
      onSelect: () => {
        const content = toMarkdown(diffReview, fileReviews, files)
        navigator.clipboard.writeText(content)
      },
    })

    // ── Settings ─────────────────────────────────────────────────────────────
    cmds.push({
      id: 'settings:open',
      section: 'Settings',
      label: settingsOpen ? 'Close Settings' : 'Open Settings',
      icon: '⚙',
      keywords: ['settings', 'config', 'options', 'panel'],
      available: true,
      onSelect: () => setSettingsOpen(!settingsOpen),
    })

    cmds.push({
      id: 'settings:mode:fast',
      section: 'Settings',
      label: 'Switch to Fast review mode',
      description: 'Single unified pass — faster results',
      icon: '⚡',
      keywords: ['fast', 'mode', 'review', 'quick', 'speed'],
      available: reviewMode !== 'fast' && !isReviewing,
      onSelect: () => setReviewMode('fast'),
    })

    cmds.push({
      id: 'settings:mode:deep',
      section: 'Settings',
      label: 'Switch to Deep review mode',
      description: 'Multiple specialist agents — thorough analysis',
      icon: '🔍',
      keywords: ['deep', 'mode', 'review', 'thorough', 'detailed'],
      available: reviewMode !== 'deep' && !isReviewing,
      onSelect: () => setReviewMode('deep'),
    })

    // ── Model switching ──────────────────────────────────────────────────────
    for (const model of MODELS) {
      if (model.id === selectedModel) continue
      cmds.push({
        id: `model:${model.id}`,
        section: 'Model',
        label: `Switch to ${model.name}`,
        description: model.description,
        icon: '◈',
        keywords: ['model', 'switch', 'change', model.name.toLowerCase(), 'llm'],
        available: !isReviewing,
        onSelect: () => switchModel(model.id),
      })
    }

    return cmds
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    files, reviewStatus, diffReview, fileReviews, rawDiff,
    selectedModel, reviewMode, diffViewMode, settingsOpen, isDone, isReviewing, hasFiles,
    userProfiles,
  ])
}
