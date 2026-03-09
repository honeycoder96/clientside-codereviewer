import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { useCommandRegistry } from '../hooks/useCommandRegistry'

// ── Fuzzy scorer ─────────────────────────────────────────────────────────────
// Returns score 0–100 for how well `query` matches `cmd`.
// 0 means no match (should be excluded).
function scoreCommand(cmd, query) {
  if (!query) return 50 // default ordering when no query
  const q = query.toLowerCase()
  const label = cmd.label.toLowerCase()
  const desc  = (cmd.description ?? '').toLowerCase()
  const kws   = (cmd.keywords ?? []).join(' ').toLowerCase()

  if (label === q)                     return 100
  if (label.startsWith(q))             return 80
  if (label.includes(q))               return 60
  if (desc.includes(q))                return 40
  if (kws.includes(q))                 return 20
  // multi-word: every word of query must match somewhere
  const words = q.split(/\s+/).filter(Boolean)
  if (words.length > 1) {
    const haystack = `${label} ${desc} ${kws}`
    if (words.every((w) => haystack.includes(w))) return 30
  }
  return 0
}

// Highlight matching substring in label text
function HighlightMatch({ text, query }) {
  if (!query) return <span>{text}</span>
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-indigo-500/40 text-white rounded-sm not-italic">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  )
}

// Group commands by section (preserving insertion order of sections)
function groupCommands(cmds) {
  const map = new Map()
  for (const cmd of cmds) {
    if (!map.has(cmd.section)) map.set(cmd.section, [])
    map.get(cmd.section).push(cmd)
  }
  return [...map.entries()] // [[section, cmds[]], ...]
}

// ── Main component ────────────────────────────────────────────────────────────
export default function CommandPalette() {
  const paletteOpen    = useStore((s) => s.paletteOpen)
  const setPaletteOpen = useStore((s) => s.setPaletteOpen)

  const [query,       setQuery]       = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const inputRef      = useRef(null)
  const listRef       = useRef(null)
  const activeItemRef = useRef(null)

  const allCommands = useCommandRegistry()

  // Filter to available commands, score and sort
  const visibleCommands = query
    ? allCommands
        .map((cmd) => ({ cmd, score: scoreCommand(cmd, query) }))
        .filter(({ score, cmd }) => score > 0 && cmd.available)
        .sort((a, b) => b.score - a.score)
        .map(({ cmd }) => cmd)
    : allCommands.filter((cmd) => cmd.available)

  // Open: focus input, reset state
  useEffect(() => {
    if (paletteOpen) {
      setQuery('')
      setActiveIndex(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [paletteOpen])

  // Cmd+K / Ctrl+K opens palette
  useEffect(() => {
    function onKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setPaletteOpen])

  // Reset active index when list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    activeItemRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const close = useCallback(() => {
    setPaletteOpen(false)
  }, [setPaletteOpen])

  function execute(cmd) {
    close()
    cmd.onSelect()
  }

  function onKeyDown(e) {
    switch (e.key) {
      case 'ArrowDown':
      case 'Tab': {
        if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault()
          setActiveIndex((i) => Math.max(i - 1, 0))
        } else {
          e.preventDefault()
          setActiveIndex((i) => Math.min(i + 1, visibleCommands.length - 1))
        }
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        setActiveIndex((i) => Math.max(i - 1, 0))
        break
      }
      case 'Enter': {
        e.preventDefault()
        const cmd = visibleCommands[activeIndex]
        if (cmd) execute(cmd)
        break
      }
      case 'Escape': {
        e.preventDefault()
        close()
        break
      }
    }
  }

  if (!paletteOpen) return null

  // Decide display: grouped (no query) or flat ranked (with query)
  const groups = query ? null : groupCommands(visibleCommands)

  // Build a flat index → command mapping for keyboard nav
  const flatList = visibleCommands

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      style={{ paddingTop: '15vh', background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}
    >
      {/* Panel */}
      <div
        className="relative w-full max-w-[520px] mx-4 rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col"
        style={{ background: 'rgba(15,20,35,0.97)', maxHeight: '420px' }}
        onKeyDown={onKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-gray-700/80">
          <span className="text-gray-500 flex-shrink-0 text-sm">⌘</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands, files, actions…"
            className="flex-1 bg-transparent text-sm text-gray-100 outline-none placeholder-gray-600"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-600 hover:text-gray-400 text-xs flex-shrink-0"
            >
              ✕
            </button>
          )}
          <kbd className="text-[10px] text-gray-600 bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 flex-shrink-0">
            esc
          </kbd>
        </div>

        {/* Results list */}
        <div ref={listRef} className="overflow-y-auto flex-1">
          {flatList.length === 0 && (
            <p className="text-xs text-gray-600 text-center py-8">No commands match "{query}"</p>
          )}

          {/* Flat ranked results when searching */}
          {query && flatList.length > 0 && (
            <ul className="py-1">
              {flatList.map((cmd, i) => (
                <CommandItem
                  key={cmd.id}
                  cmd={cmd}
                  query={query}
                  isActive={i === activeIndex}
                  itemRef={i === activeIndex ? activeItemRef : null}
                  onMouseEnter={() => setActiveIndex(i)}
                  onSelect={() => execute(cmd)}
                />
              ))}
            </ul>
          )}

          {/* Grouped when no query */}
          {!query && groups && groups.map(([section, cmds]) => {
            const sectionStartIndex = flatList.indexOf(cmds[0])
            return (
              <div key={section}>
                <p className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                  {section}
                </p>
                <ul>
                  {cmds.map((cmd, j) => {
                    const i = sectionStartIndex + j
                    return (
                      <CommandItem
                        key={cmd.id}
                        cmd={cmd}
                        query={query}
                        isActive={i === activeIndex}
                        itemRef={i === activeIndex ? activeItemRef : null}
                        onMouseEnter={() => setActiveIndex(i)}
                        onSelect={() => execute(cmd)}
                      />
                    )
                  })}
                </ul>
              </div>
            )
          })}

          <div className="h-1" />
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-3.5 py-1.5 border-t border-gray-800 bg-gray-900/60">
          <div className="flex items-center gap-3 text-[10px] text-gray-700">
            <span><kbd className="font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono">↵</kbd> select</span>
            <span><kbd className="font-mono">esc</kbd> close</span>
          </div>
          <span className="text-[10px] text-gray-700">
            {flatList.length} command{flatList.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

function CommandItem({ cmd, query, isActive, itemRef, onMouseEnter, onSelect }) {
  return (
    <li
      ref={itemRef}
      onMouseEnter={onMouseEnter}
      onClick={onSelect}
      className={`flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors ${
        isActive
          ? 'bg-indigo-600/20 border-l-2 border-indigo-400'
          : 'border-l-2 border-transparent hover:bg-gray-800/60'
      }`}
    >
      <span className="text-sm flex-shrink-0 w-4 text-center text-gray-500">{cmd.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-white' : 'text-gray-300'}`}>
          <HighlightMatch text={cmd.label} query={query} />
        </p>
        {cmd.description && (
          <p className="text-[11px] text-gray-600 truncate">{cmd.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {cmd.shortcut && (
          <kbd className="text-[10px] font-mono text-gray-700 bg-gray-800/80 border border-gray-700/60 rounded px-1.5 py-0.5">
            {cmd.shortcut}
          </kbd>
        )}
        <span className="text-[10px] text-gray-700 font-mono">{cmd.section}</span>
      </div>
    </li>
  )
}
