import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { AGENT_IDS } from '../../lib/agents'

const AGENT_LABELS = {
  bug:         { name: 'Bug Reviewer',         icon: '🔍', desc: 'Logic errors, null checks, edge cases' },
  security:    { name: 'Security Auditor',      icon: '🔒', desc: 'XSS, injection, secrets, path traversal' },
  performance: { name: 'Performance Reviewer',  icon: '⚡', desc: 'N+1 queries, memory leaks, re-renders' },
  summary:     { name: 'Summary Agent',         icon: '🧠', desc: 'Deduplicates and ranks all findings' },
}

const SEVERITY_OPTIONS = [
  { value: 'info',     label: 'Info and above' },
  { value: 'warning',  label: 'Warning and above' },
  { value: 'critical', label: 'Critical only' },
]

const CATEGORY_OPTIONS = ['bug', 'security', 'performance']

function FocusTab() {
  const focusContext    = useStore((s) => s.focusContext)
  const setFocusContext = useStore((s) => s.setFocusContext)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-gray-500 leading-relaxed">
        Free-text context injected as a preamble into every agent prompt.
        Applied on the next review run — no re-inference needed to save.
      </p>
      <textarea
        value={focusContext}
        onChange={(e) => setFocusContext(e.target.value)}
        placeholder="e.g. This is a React + TypeScript frontend. Focus on hooks usage, component re-renders, and accessibility. Ignore CSS class names."
        rows={6}
        className="w-full bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 p-2.5 resize-none placeholder:text-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
      />
      {focusContext.trim() && (
        <p className="text-xs text-indigo-400">
          ✓ Context active — will be injected into next review
        </p>
      )}
    </div>
  )
}

function AgentsTab() {
  const enabledAgents = useStore((s) => s.enabledAgents)
  const toggleAgent   = useStore((s) => s.toggleAgent)
  const reviewStatus  = useStore((s) => s.reviewStatus)
  const isReviewing   = reviewStatus === 'reviewing'
  const summaryDisabled = !enabledAgents.has('summary')

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-500 leading-relaxed mb-2">
        Disabled agents are skipped entirely, reducing inference time by ~25% per skipped agent.
      </p>
      {AGENT_IDS.map((id) => {
        const { name, icon, desc } = AGENT_LABELS[id]
        const enabled = enabledAgents.has(id)
        return (
          <label
            key={id}
            className={`flex items-start gap-3 p-2.5 rounded cursor-pointer transition-colors ${
              isReviewing ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'
            }`}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={() => !isReviewing && toggleAgent(id)}
              disabled={isReviewing}
              className="mt-0.5 accent-indigo-500 flex-shrink-0"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm text-gray-200">
                {icon} {name}
              </span>
              <span className="text-xs text-gray-500">{desc}</span>
            </div>
          </label>
        )
      })}
      {summaryDisabled && (
        <p className="mt-1 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-2.5 py-2">
          ⚠ Summary agent disabled — issues will not be deduplicated across agents
        </p>
      )}
      {isReviewing && (
        <p className="mt-1 text-xs text-gray-600">Agent toggles disabled during active review</p>
      )}
    </div>
  )
}

function FiltersTab() {
  const issueFilters    = useStore((s) => s.issueFilters)
  const setIssueFilters = useStore((s) => s.setIssueFilters)

  function toggleCategory(cat) {
    const cats = issueFilters.categories.includes(cat)
      ? issueFilters.categories.filter((c) => c !== cat)
      : [...issueFilters.categories, cat]
    setIssueFilters({ categories: cats })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Display filters — hide issues from view without re-running inference.
        Applies to all panels simultaneously.
      </p>

      {/* Min severity */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400 font-medium">Minimum severity</label>
        <select
          value={issueFilters.minSeverity}
          onChange={(e) => setIssueFilters({ minSeverity: e.target.value })}
          className="bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
        >
          {SEVERITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Category filter */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-gray-400 font-medium">Issue categories</label>
        {CATEGORY_OPTIONS.map((cat) => (
          <label key={cat} className="flex items-center gap-2 py-1 cursor-pointer hover:text-white">
            <input
              type="checkbox"
              checked={issueFilters.categories.includes(cat)}
              onChange={() => toggleCategory(cat)}
              className="accent-indigo-500"
            />
            <span className="capitalize text-sm text-gray-300">{cat}</span>
          </label>
        ))}
        {issueFilters.categories.length === 0 && (
          <p className="text-xs text-amber-400">All categories hidden — no issues will be shown</p>
        )}
      </div>
    </div>
  )
}

export default function SettingsPanel() {
  const settingsOpen    = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const resetSettings   = useStore((s) => s.resetSettings)

  const [activeTab, setActiveTab] = useState('focus')
  const panelRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!settingsOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setSettingsOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [settingsOpen, setSettingsOpen])

  if (!settingsOpen) return null

  const TABS = [
    { id: 'focus',   label: 'Focus' },
    { id: 'agents',  label: 'Agents' },
    { id: 'filters', label: 'Filters' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => setSettingsOpen(false)}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-0 top-0 h-full z-50 w-80 bg-gray-900 border-l border-gray-700 flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 flex-shrink-0">
          <span className="text-sm font-semibold text-white">⚙ Review Settings</span>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-gray-500 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 text-xs py-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'focus'   && <FocusTab />}
          {activeTab === 'agents'  && <AgentsTab />}
          {activeTab === 'filters' && <FiltersTab />}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex-shrink-0">
          <button
            onClick={resetSettings}
            className="w-full text-xs py-2 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </>
  )
}
