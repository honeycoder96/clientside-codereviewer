import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { AGENT_IDS } from '../../lib/agents'
import { BUILTIN_PROFILES } from '../../lib/profiles'
import { triggerDownload } from '../../lib/export'

const AGENT_LABELS = {
  bug:         { name: 'Bug Reviewer',         icon: '🔍', desc: 'Logic errors, null checks, edge cases' },
  security:    { name: 'Security Auditor',      icon: '🔒', desc: 'XSS, injection, secrets, path traversal' },
  performance: { name: 'Performance Reviewer',  icon: '⚡', desc: 'N+1 queries, memory leaks, re-renders' },
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
  const enabledAgents  = useStore((s) => s.enabledAgents)
  const toggleAgent    = useStore((s) => s.toggleAgent)
  const reviewMode     = useStore((s) => s.reviewMode)
  const setReviewMode  = useStore((s) => s.setReviewMode)
  const reviewStatus   = useStore((s) => s.reviewStatus)
  const isReviewing    = reviewStatus === 'reviewing'

  return (
    <div className="flex flex-col gap-4">

      {/* Review mode toggle */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-400 font-medium">Review mode</label>
        <div className="flex rounded overflow-hidden border border-gray-700">
          <button
            onClick={() => !isReviewing && setReviewMode('fast')}
            disabled={isReviewing}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              isReviewing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            } ${
              reviewMode === 'fast'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Fast
          </button>
          <button
            onClick={() => !isReviewing && setReviewMode('deep')}
            disabled={isReviewing}
            className={`flex-1 py-2 text-xs font-medium transition-colors border-l border-gray-700 ${
              isReviewing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            } ${
              reviewMode === 'deep'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
            }`}
          >
            Deep
          </button>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          {reviewMode === 'fast'
            ? 'Single unified pass — finds bugs, security, and performance issues together. Auto-escalates targeted agents for critical findings.'
            : '3 specialized agents sequentially (bug → security → performance). More thorough, ~3× slower.'}
        </p>
      </div>

      {/* Deep-mode agent toggles (only relevant in deep mode) */}
      {reviewMode === 'deep' && (
        <div className="flex flex-col gap-1 border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-500 leading-relaxed mb-1">
            Disabled agents are skipped, reducing inference time proportionally.
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
        </div>
      )}

      {/* Fast-mode info */}
      {reviewMode === 'fast' && (
        <div className="border-t border-gray-800 pt-3 flex flex-col gap-1.5 text-xs text-gray-500">
          <p>Fast mode uses a single 🔎 Unified Reviewer agent.</p>
          <p>If critical issues are found, targeted specialist agents run automatically on that chunk only.</p>
        </div>
      )}

      {isReviewing && (
        <p className="text-xs text-gray-600">Settings locked during active review</p>
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

function ProfilesTab() {
  const userProfiles         = useStore((s) => s.userProfiles)
  const applyProfile         = useStore((s) => s.applyProfile)
  const saveCurrentAsProfile = useStore((s) => s.saveCurrentAsProfile)
  const deleteUserProfile    = useStore((s) => s.deleteUserProfile)
  const importUserProfiles   = useStore((s) => s.importUserProfiles)
  const exportUserProfiles   = useStore((s) => s.exportUserProfiles)
  const isReviewing          = useStore((s) => s.reviewStatus === 'reviewing')

  const [newName, setNewName]       = useState('')
  const [saveStatus, setSaveStatus] = useState(null) // 'ok' | 'error'
  const fileInputRef                = useRef(null)

  function handleSave() {
    if (!newName.trim()) return
    const ok = saveCurrentAsProfile(newName)
    setSaveStatus(ok ? 'ok' : 'error')
    if (ok) setNewName('')
    setTimeout(() => setSaveStatus(null), 2000)
  }

  function handleImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      importUserProfiles(ev.target.result)
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  function handleExport() {
    triggerDownload('profiles.json', exportUserProfiles(), 'application/json')
  }

  const ProfileRow = ({ profile, showDelete }) => (
    <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-800">
      <span className="text-base leading-none">{profile.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-200 truncate">{profile.name}</p>
        {profile.description && (
          <p className="text-xs text-gray-500 truncate">{profile.description}</p>
        )}
      </div>
      <button
        onClick={() => !isReviewing && applyProfile(profile.id)}
        disabled={isReviewing}
        className="text-xs px-2 py-1 border border-gray-600 hover:border-indigo-500 hover:text-indigo-400 text-gray-400 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
      >
        Apply
      </button>
      {showDelete && (
        <button
          onClick={() => deleteUserProfile(profile.id)}
          className="text-gray-600 hover:text-red-400 transition-colors text-xs leading-none flex-shrink-0"
          title="Delete profile"
        >
          ✕
        </button>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-gray-500 leading-relaxed">
        Profiles atomically apply focus context, review mode, agents, and filters.
      </p>

      {/* Built-in profiles */}
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-gray-400 font-medium mb-1">Built-in</p>
        {BUILTIN_PROFILES.map((p) => <ProfileRow key={p.id} profile={p} showDelete={false} />)}
      </div>

      {/* User profiles */}
      {userProfiles.length > 0 && (
        <div className="flex flex-col gap-0.5 border-t border-gray-800 pt-3">
          <p className="text-xs text-gray-400 font-medium mb-1">Saved</p>
          {userProfiles.map((p) => <ProfileRow key={p.id} profile={p} showDelete={true} />)}
        </div>
      )}

      {/* Save current as profile */}
      <div className="flex flex-col gap-2 border-t border-gray-800 pt-3">
        <p className="text-xs text-gray-400 font-medium">Save current settings</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="Profile name"
            className="flex-1 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 transition-colors"
          />
          <button
            onClick={handleSave}
            disabled={!newName.trim()}
            className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Save
          </button>
        </div>
        {saveStatus === 'ok'    && <p className="text-xs text-green-400">✓ Profile saved</p>}
        {saveStatus === 'error' && <p className="text-xs text-red-400">Failed to save</p>}
      </div>

      {/* Import / Export */}
      <div className="flex gap-2 border-t border-gray-800 pt-3">
        {userProfiles.length > 0 && (
          <button
            onClick={handleExport}
            className="flex-1 text-xs py-1.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded transition-colors"
          >
            Export JSON
          </button>
        )}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex-1 text-xs py-1.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white rounded transition-colors"
        >
          Import JSON
        </button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
      </div>

      {isReviewing && (
        <p className="text-xs text-gray-600">Profile apply locked during active review</p>
      )}
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
    { id: 'focus',    label: 'Focus' },
    { id: 'agents',   label: 'Agents' },
    { id: 'filters',  label: 'Filters' },
    { id: 'profiles', label: 'Profiles' },
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
          {activeTab === 'focus'    && <FocusTab />}
          {activeTab === 'agents'   && <AgentsTab />}
          {activeTab === 'filters'  && <FiltersTab />}
          {activeTab === 'profiles' && <ProfilesTab />}
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
