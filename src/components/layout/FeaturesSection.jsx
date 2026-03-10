import { useState } from 'react'

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  {
    id: 'privacy',
    label: 'Privacy & Local AI',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 1L2 4v5c0 4.25 2.97 7.7 7 8.93C13.03 16.7 16 13.25 16 9V4L9 1Z"
          stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    accent: { pill: 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50', card: 'border-emerald-800/30 bg-emerald-950/10', glow: 'rgba(52,211,153,0.06)', dot: 'bg-emerald-500' },
    tagline: 'Your code never leaves the device.',
    features: [
      { icon: '⛔', title: 'Zero data egress', desc: 'Every token is computed locally — no request is ever sent to a server.' },
      { icon: '🔑', title: 'No API keys', desc: 'No accounts, no billing, no rate limits. Just open and run.' },
      { icon: '📶', title: 'Offline capable', desc: 'After the first model download, the app works with no internet.' },
      { icon: '💾', title: 'Browser-cached weights', desc: 'Model files are stored in IndexedDB — subsequent loads are instant.' },
      { icon: '🕶', title: 'No telemetry', desc: 'Zero analytics, zero tracking. Nothing is measured or reported.' },
    ],
  },
  {
    id: 'analysis',
    label: 'Multi-Agent Analysis',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    accent: { pill: 'text-indigo-400 bg-indigo-950/60 border-indigo-800/50', card: 'border-indigo-800/30 bg-indigo-950/10', glow: 'rgba(99,102,241,0.07)', dot: 'bg-indigo-500' },
    tagline: 'Four experts reviewing in parallel.',
    features: [
      { icon: '🔍', title: 'Bug detection agent', desc: 'Catches logic errors, null dereferences, off-by-ones and edge cases.' },
      { icon: '🔒', title: 'Security agent', desc: 'Flags XSS, injection risks, insecure auth patterns, and data exposure.' },
      { icon: '⚡', title: 'Performance agent', desc: 'Detects N+1 queries, memory leaks, unnecessary renders and allocations.' },
      { icon: '📋', title: 'Summary agent', desc: 'Produces a concise diff summary, suggested commit message, and test plan.' },
      { icon: '🚀', title: 'Fast & Deep modes', desc: 'Fast mode runs a single unified pass; Deep runs all four agents.' },
    ],
  },
  {
    id: 'diff',
    label: 'Diff Handling',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 5h12M3 9h8M3 13h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="15" cy="13" r="2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
    accent: { pill: 'text-cyan-400 bg-cyan-950/60 border-cyan-800/50', card: 'border-cyan-800/30 bg-cyan-950/10', glow: 'rgba(34,211,238,0.06)', dot: 'bg-cyan-500' },
    tagline: 'Handles any diff, any size.',
    features: [
      { icon: '📋', title: 'Unified diff support', desc: 'Paste output from `git diff`, `git diff --staged`, or any standard tool.' },
      { icon: '🗂', title: 'Drag & drop', desc: 'Drop a .diff or .patch file directly onto the input area.' },
      { icon: '☑️', title: 'File selection', desc: 'Choose exactly which files to include before starting the review.' },
      { icon: '✂️', title: 'Smart chunking', desc: 'Large files are split into overlapping chunks for accurate context.' },
      { icon: '🧠', title: 'Auto context injection', desc: 'File type is detected and a relevant context prompt is injected automatically.' },
    ],
  },
  {
    id: 'review',
    label: 'Review Output',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M4 9l3 3 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="2" y="2" width="14" height="14" rx="3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
    accent: { pill: 'text-amber-400 bg-amber-950/60 border-amber-800/50', card: 'border-amber-800/30 bg-amber-950/10', glow: 'rgba(251,191,36,0.05)', dot: 'bg-amber-500' },
    tagline: 'Rich, actionable findings.',
    features: [
      { icon: '🌡', title: 'Per-file risk scores', desc: 'Each file gets a 0–10 risk score with a color-coded heat indicator.' },
      { icon: '💬', title: 'Inline diff comments', desc: 'Issues appear inline within the unified or split diff view.' },
      { icon: '✅', title: 'Issue annotations', desc: 'Accept or dismiss individual findings — state persists across sessions.' },
      { icon: '🔧', title: 'LLM fix suggestions', desc: 'One-click streaming code fix generated on demand for any issue.' },
      { icon: '📝', title: 'PR description generator', desc: 'Auto-generates a structured pull-request body from the review results.' },
      { icon: '📊', title: 'Issue trend delta', desc: 'After re-reviewing, see exactly which issues were introduced, resolved, or unchanged vs the previous run.' },
    ],
  },
  {
    id: 'export',
    label: 'Export & Sharing',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 11V3M6 6l3-3 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 13v2h12v-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
    accent: { pill: 'text-orange-400 bg-orange-950/60 border-orange-800/50', card: 'border-orange-800/30 bg-orange-950/10', glow: 'rgba(251,146,60,0.05)', dot: 'bg-orange-500' },
    tagline: 'Take your review anywhere.',
    features: [
      { icon: '📄', title: 'Markdown report', desc: 'Full review as a GitHub-renderable .md — paste into any issue or wiki.' },
      { icon: '🔭', title: 'SARIF export', desc: 'Upload to GitHub Code Scanning with `gh code-scanning upload-results`.' },
      { icon: '📊', title: 'JSON & CSV', desc: 'Machine-readable formats for CI pipelines, scripts and spreadsheets.' },
      { icon: '💿', title: '.review snapshots', desc: 'Save the complete review state and restore it instantly — no re-inference.' },
      { icon: '⎘', title: 'Copy to clipboard', desc: 'One-click copy of Markdown report directly to your clipboard.' },
    ],
  },
  {
    id: 'devex',
    label: 'Developer Experience',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M5 7l-3 2 3 2M13 7l3 2-3 2M10 5l-2 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    accent: { pill: 'text-violet-400 bg-violet-950/60 border-violet-800/50', card: 'border-violet-800/30 bg-violet-950/10', glow: 'rgba(167,139,250,0.06)', dot: 'bg-violet-500' },
    tagline: 'Built for engineers who love their tools.',
    features: [
      { icon: '⌨', title: 'Command palette', desc: '⌘K fuzzy search over files, issues, actions, presets and settings.' },
      { icon: '🗄', title: 'Chunk cache', desc: 'Previously reviewed chunks are cached in sessionStorage — no redundant inference.' },
      { icon: '📱', title: 'PWA / installable', desc: 'Install as a standalone desktop or mobile app from the browser.' },
      { icon: '📈', title: 'Diff statistics', desc: 'Churn analysis, blast-radius detection, coupling heatmap per directory.' },
      { icon: '🖥', title: 'Split-pane layout', desc: 'Resizable side-by-side diff viewer and review panel with keyboard nav.' },
      { icon: '📚', title: 'Review history', desc: 'Every review is saved to IndexedDB automatically — browse, restore, and diff against past runs.' },
      { icon: '🔖', title: 'Custom profiles', desc: 'Save and apply named review configurations covering mode, agents, focus context, and issue filters.' },
      { icon: '⏱', title: 'Review queue', desc: 'Queue multiple diffs while a review is running — the next one starts automatically on completion.' },
    ],
  },
]

// ─── Sub-components ────────────────────────────────────────────────────────────

function CategoryTab({ cat, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all duration-150 whitespace-nowrap flex-shrink-0
        ${active
          ? cat.accent.pill
          : 'text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300 bg-transparent'
        }
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${active ? cat.accent.dot : 'bg-gray-700'}`} />
      {cat.label}
    </button>
  )
}

function FeatureCard({ feature, accent }) {
  return (
    <div
      className={`
        flex flex-col gap-2.5 p-4 rounded-xl border transition-all duration-200
        hover:border-opacity-60 hover:-translate-y-px
        ${accent.card}
      `}
      style={{ background: accent.glow ? `radial-gradient(ellipse at 0% 0%, ${accent.glow}, transparent 70%)` : undefined }}
    >
      <span className="text-lg leading-none">{feature.icon}</span>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-gray-200">{feature.title}</span>
        <p className="text-xs text-gray-500 leading-relaxed">{feature.desc}</p>
      </div>
    </div>
  )
}

function AllCategoryCard({ cat, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        text-left flex flex-col gap-3 p-5 rounded-2xl border transition-all duration-200
        hover:-translate-y-0.5 group
        ${cat.accent.card}
      `}
      style={{ background: `radial-gradient(ellipse at 10% 0%, ${cat.accent.glow}, transparent 60%)` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex-shrink-0 ${cat.accent.pill.split(' ')[0]}`}>
            {cat.icon}
          </span>
          <span className="text-sm font-semibold text-gray-200">{cat.label}</span>
        </div>
        <span className="text-gray-700 group-hover:text-gray-500 transition-colors text-xs">→</span>
      </div>

      {/* Tagline */}
      <p className="text-xs text-gray-500 leading-relaxed">{cat.tagline}</p>

      {/* Feature pills */}
      <ul className="flex flex-col gap-1.5">
        {cat.features.map((f) => (
          <li key={f.title} className="flex items-center gap-2 text-xs text-gray-400">
            <span className={`w-1 h-1 rounded-full flex-shrink-0 ${cat.accent.dot} opacity-70`} />
            {f.title}
          </li>
        ))}
      </ul>
    </button>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function FeaturesSection() {
  const [activeId, setActiveId] = useState(null) // null = "All"
  const activeCat = CATEGORIES.find((c) => c.id === activeId) ?? null

  return (
    <section
      className="px-6 py-20"
      style={{ borderTop: '1px solid rgba(30,41,59,0.6)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-12">

        {/* ── Section header ── */}
        <div className="flex flex-col gap-4 max-w-2xl">
          <span
            className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border w-fit"
            style={{ color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)' }}
          >
            capabilities
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight"
            style={{ color: '#f1f5f9' }}
          >
            Everything you need,{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              nothing you don't.
            </span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            35+ features across privacy, analysis depth, diff handling, review output, export formats and developer ergonomics —
            all running entirely in your browser with no server dependency.
          </p>
        </div>

        {/* ── Category tabs ── */}
        <div className="flex flex-col gap-6">
          {/* Scrollable tab row */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {/* "All" tab */}
            <button
              onClick={() => setActiveId(null)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                border transition-all duration-150 whitespace-nowrap flex-shrink-0
                ${activeId === null
                  ? 'text-gray-100 bg-gray-800 border-gray-600'
                  : 'text-gray-500 border-gray-800 hover:border-gray-600 hover:text-gray-300'
                }
              `}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${activeId === null ? 'bg-gray-300' : 'bg-gray-700'}`} />
              All categories
            </button>

            {CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                cat={cat}
                active={activeId === cat.id}
                onClick={() => setActiveId(activeId === cat.id ? null : cat.id)}
              />
            ))}
          </div>

          {/* ── "All" view: category overview cards ── */}
          {!activeCat && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {CATEGORIES.map((cat) => (
                <AllCategoryCard
                  key={cat.id}
                  cat={cat}
                  onClick={() => setActiveId(cat.id)}
                />
              ))}
            </div>
          )}

          {/* ── Category detail view: feature cards ── */}
          {activeCat && (
            <div className="flex flex-col gap-6">
              {/* Category header strip */}
              <div
                className={`flex items-start gap-4 p-5 rounded-2xl border ${activeCat.accent.card}`}
                style={{ background: `radial-gradient(ellipse at 0% 50%, ${activeCat.accent.glow}, transparent 60%)` }}
              >
                <span className={activeCat.accent.pill.split(' ')[0]}>
                  {activeCat.icon}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-gray-200">{activeCat.label}</span>
                  <span className="text-xs text-gray-500">{activeCat.tagline}</span>
                </div>
                <span className="text-[10px] font-mono text-gray-700 ml-auto mt-0.5">
                  {activeCat.features.length} features
                </span>
              </div>

              {/* Feature grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeCat.features.map((f) => (
                  <FeatureCard key={f.title} feature={f} accent={activeCat.accent} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats footer ── */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-gray-800"
          style={{ background: 'rgba(30,41,59,0.4)' }}
        >
          {[
            { value: '6',     label: 'Feature categories' },
            { value: '35+',   label: 'Individual features' },
            { value: '0 KB',  label: 'Server-side code' },
            { value: '100%',  label: 'Client-side inference' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 items-center justify-center py-6 px-4 text-center"
              style={{ background: 'rgba(8,15,28,0.7)' }}
            >
              <span
                className="text-2xl font-bold tracking-tight"
                style={{
                  background: 'linear-gradient(135deg, #e2e8f0 0%, #94a3b8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {stat.value}
              </span>
              <span className="text-[11px] text-gray-600 leading-tight">{stat.label}</span>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
