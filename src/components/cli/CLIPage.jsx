import { useState, useEffect } from 'react'

// ─── Terminal animation data ───────────────────────────────────────────────────

const T_LINES = [
  { type: 'cmd',        text: '$ git diff main...feature | cr review - --output review.md' },
  { type: 'blank',      text: '' },
  { type: 'file-start', text: '[ 1/3 ] src/auth.js' },
  { type: 'agent-ok',   text: '  ✓ Unified Reviewer — 3 issues  (2.4s)' },
  { type: 'file-ok',    text: '✓ src/auth.js — Risk 6.8 Medium · 1 critical · 2 warnings' },
  { type: 'blank',      text: '' },
  { type: 'file-start', text: '[ 2/3 ] src/api/users.js' },
  { type: 'agent-ok',   text: '  ✓ Unified Reviewer — 0 issues  (1.7s)' },
  { type: 'file-ok',    text: '✓ src/api/users.js — Risk 0 Low · 0 critical · 0 warnings' },
  { type: 'blank',      text: '' },
  { type: 'file-start', text: '[ 3/3 ] src/middleware/auth.js' },
  { type: 'agent-ok',   text: '  ✓ Unified Reviewer — 2 issues  (2.1s)' },
  { type: 'agent-esc',  text: '  ✓ Security Auditor — escalated  (3.8s)' },
  { type: 'file-high',  text: '✓ src/middleware/auth.js — Risk 8.1 High · 2 critical' },
  { type: 'blank',      text: '' },
  { type: 'box',        text: '┌──────────────────────────────────────────┐' },
  { type: 'box',        text: '│  Review complete — 3 files · 16.2s       │' },
  { type: 'box-risk',   text: '│  Risk: 6.4 Medium                        │' },
  { type: 'box',        text: '│  Issues: 3 critical · 2 warnings · 1 info│' },
  { type: 'box',        text: '│  Output written to: review.md            │' },
  { type: 'box',        text: '└──────────────────────────────────────────┘' },
]

const T_DELAY = {
  cmd:          850,
  blank:        180,
  'file-start': 420,
  'agent-ok':   720,
  'agent-esc':  520,
  'file-ok':    160,
  'file-high':  160,
  box:           65,
  'box-risk':    65,
}

function lineColor(type) {
  const map = {
    cmd:          '#f8fafc',
    'file-start': '#67e8f9',
    'agent-ok':   '#4ade80',
    'agent-esc':  '#fbbf24',
    'file-ok':    '#34d399',
    'file-high':  '#f87171',
    box:          '#818cf8',
    'box-risk':   '#fbbf24',
    blank:        'transparent',
  }
  return map[type] ?? '#94a3b8'
}

// ─── Flag groups data ──────────────────────────────────────────────────────────

const FLAG_GROUPS = [
  {
    id: 'model',
    label: 'Model & Connection',
    color: { pill: '#67e8f9', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.15)' },
    flags: [
      { name: '--model, -m',  type: 'string',  default: 'qwen2.5-coder:7b',      desc: 'Ollama model name to use for inference' },
      { name: '--host',       type: 'string',  default: 'http://localhost:11434', desc: 'Ollama base URL (change for remote instances)' },
      { name: '--timeout',    type: 'number',  default: '120000',                 desc: 'Per-request HTTP timeout in milliseconds' },
    ],
  },
  {
    id: 'review',
    label: 'Review Mode',
    color: { pill: '#a5b4fc', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.15)' },
    flags: [
      { name: '--mode',      type: 'enum',    default: 'fast',                    desc: 'fast — single unified pass; deep — sequential Bug → Security → Performance agents' },
      { name: '--agents',    type: 'string',  default: 'bug,security,performance', desc: 'Comma-separated list of agents to enable in deep mode' },
      { name: '--focus',     type: 'string',  default: '""',                      desc: 'Free-text context injected into every prompt (e.g. "Go — check goroutine leaks")' },
      { name: '--profile',   type: 'enum',    default: '—',                       desc: 'Preset configuration: security-audit, critical-only, performance, show-all' },
    ],
  },
  {
    id: 'output',
    label: 'Output',
    color: { pill: '#34d399', bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.14)' },
    flags: [
      { name: '--format, -f',    type: 'enum',    default: 'md',    desc: 'Export format: md, json, csv, sarif, pr-desc' },
      { name: '--output, -o',    type: 'string',  default: 'stdout', desc: 'Write to this file path instead of stdout. Auto-appends extension if omitted.' },
      { name: '--min-severity',  type: 'enum',    default: 'info',   desc: 'Filter out issues below this level: info · warning · critical' },
    ],
  },
  {
    id: 'ux',
    label: 'UX & CI',
    color: { pill: '#fbbf24', bg: 'rgba(245,158,11,0.07)', border: 'rgba(245,158,11,0.14)' },
    flags: [
      { name: '--stream',         type: 'boolean', default: 'false', desc: 'Print LLM tokens live to stderr as inference runs' },
      { name: '--quiet, -q',      type: 'boolean', default: 'false', desc: 'Suppress all progress output — only the final result on stdout (ideal for CI)' },
      { name: '--verbose, -v',    type: 'boolean', default: 'false', desc: 'Show per-chunk timing, token counts, and escalation events' },
      { name: '--no-tests',       type: 'boolean', default: 'false', desc: 'Skip the test-suggestion LLM call at the end of the review' },
      { name: '--no-commit-msg',  type: 'boolean', default: 'false', desc: 'Skip commit message generation (generated client-side, no extra LLM call)' },
    ],
  },
]

const TYPE_STYLE = {
  string:  { bg: 'rgba(6,182,212,0.1)',    color: '#67e8f9',  border: 'rgba(6,182,212,0.2)'    },
  boolean: { bg: 'rgba(167,139,250,0.1)',  color: '#c4b5fd',  border: 'rgba(167,139,250,0.2)'  },
  enum:    { bg: 'rgba(251,191,36,0.08)',  color: '#fbbf24',  border: 'rgba(251,191,36,0.2)'   },
  number:  { bg: 'rgba(52,211,153,0.08)',  color: '#34d399',  border: 'rgba(52,211,153,0.2)'   },
}

// ─── Profile presets data ──────────────────────────────────────────────────────

const PROFILE_CARDS = [
  {
    id: 'security-audit',
    label: 'security-audit',
    icon: '🔒',
    tagline: 'Security-only deep scan',
    agents: ['security'],
    minSev: 'info',
    focus: 'Security vulnerabilities, auth issues, injection risks',
    accent: { border: 'rgba(239,68,68,0.2)', bg: 'rgba(127,29,29,0.1)', pill: '#f87171', dot: 'bg-red-500', glow: 'rgba(239,68,68,0.05)' },
    example: 'cr review pr.diff --profile security-audit --format json -o audit.json',
  },
  {
    id: 'critical-only',
    label: 'critical-only',
    icon: '🚨',
    tagline: 'Only critical issues shown',
    agents: ['bug', 'security', 'performance'],
    minSev: 'critical',
    focus: '—',
    accent: { border: 'rgba(251,146,60,0.2)', bg: 'rgba(124,45,18,0.1)', pill: '#fb923c', dot: 'bg-orange-500', glow: 'rgba(251,146,60,0.05)' },
    example: 'git diff main...HEAD | cr review - --profile critical-only --quiet',
  },
  {
    id: 'performance',
    label: 'performance',
    icon: '⚡',
    tagline: 'Performance bottlenecks only',
    agents: ['performance'],
    minSev: 'info',
    focus: 'N+1 queries, memory leaks, unnecessary allocations',
    accent: { border: 'rgba(52,211,153,0.2)', bg: 'rgba(6,78,59,0.1)', pill: '#34d399', dot: 'bg-emerald-500', glow: 'rgba(52,211,153,0.05)' },
    example: 'cr review feature.diff --profile performance --format md',
  },
  {
    id: 'show-all',
    label: 'show-all',
    icon: '📋',
    tagline: 'All agents, all severities',
    agents: ['bug', 'security', 'performance'],
    minSev: 'info',
    focus: '—',
    accent: { border: 'rgba(99,102,241,0.2)', bg: 'rgba(49,46,129,0.1)', pill: '#a5b4fc', dot: 'bg-indigo-500', glow: 'rgba(99,102,241,0.06)' },
    example: 'cr review pr.diff --profile show-all --format md --output review.md',
  },
]

// ─── Examples data ─────────────────────────────────────────────────────────────

const EXAMPLES = [
  {
    title: 'Review staged changes',
    desc: 'Review everything staged for commit, write Markdown report to file.',
    cmd: 'git diff --cached | cr review - --output review.md',
  },
  {
    title: 'CI pipeline with SARIF',
    desc: 'GitHub Code Scanning compatible. Upload the output with gh code-scanning upload-results.',
    cmd: 'git diff main...HEAD | cr review - --format sarif --quiet --output results.sarif',
  },
  {
    title: 'Security audit, JSON output',
    desc: 'Run only the security agent on a diff and emit machine-readable JSON.',
    cmd: 'cr review feature.diff --profile security-audit --format json -o sec-audit.json',
  },
  {
    title: 'Deep mode with focus context',
    desc: 'Run all 3 specialized agents sequentially with a language hint injected into every prompt.',
    cmd: 'cr review pr.diff --mode deep --focus "Go — check goroutine leaks and channel usage"',
  },
  {
    title: 'Stream tokens live',
    desc: 'Watch the model think in real time. Per-chunk timing with --verbose.',
    cmd: 'cr review my.diff --stream --verbose',
  },
  {
    title: 'PR description generator',
    desc: 'Generate a structured pull-request body from the review results.',
    cmd: 'git diff main...HEAD | cr review - --format pr-desc --output PR_DESCRIPTION.md',
  },
]

// ─── Features for left hero column ────────────────────────────────────────────

const CLI_FEATURES = [
  // { label: 'No WebGPU required',      sub: 'Runs on any machine with Node 18+ and a local Ollama instance' },
  // { label: 'Same 4-agent pipeline',   sub: 'Identical review logic and scoring to the browser tool' },
  { label: '5 export formats',        sub: 'Markdown, JSON, CSV, SARIF for GitHub Code Scanning, and PR description' },
  { label: 'CI/CD ready',             sub: '–quiet mode, stdin support, and deterministic non-zero exit codes' },
  { label: 'Fast & Deep modes',       sub: 'Single unified pass or sequential Bug → Security → Performance agents' },
  { label: 'Profile presets',         sub: 'Four named configurations — security-audit, critical-only, performance, show-all' },
  { label: 'Token streaming',         sub: 'Watch inference happen with –stream; pair with –verbose for timing detail' },
  { label: 'Chunk result cache',      sub: 'Re-reviewing the same chunk uses cached results — no redundant inference' },
]

// ─── FeatureIcon (matches HeroSection) ────────────────────────────────────────

function FeatureIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M7 1L8.96 5.02L13.5 5.63L10.25 8.8L11.09 13.32L7 11.1L2.91 13.32L3.75 8.8L0.5 5.63L5.04 5.02L7 1Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  )
}

// ─── TerminalCard ──────────────────────────────────────────────────────────────

function TerminalCard() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (count >= T_LINES.length) {
      const id = setTimeout(() => setCount(0), 4500)
      return () => clearTimeout(id)
    }
    const delay = count === 0 ? 600 : (T_DELAY[T_LINES[count]?.type] ?? 500)
    const id = setTimeout(() => setCount((c) => c + 1), delay)
    return () => clearTimeout(id)
  }, [count])

  const visibleLines = T_LINES.slice(0, count)
  const isRunning = count > 0 && count < T_LINES.length

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'rgba(1,6,16,0.97)',
        borderColor: 'rgba(34,211,238,0.14)',
        boxShadow: '0 0 0 1px rgba(34,211,238,0.04), 0 12px 48px rgba(0,0,0,0.65)',
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'rgba(34,211,238,0.07)', background: 'rgba(0,3,10,0.85)' }}
      >
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f56' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#febc2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#28c840' }} />
        </div>
        <span className="ml-2 text-[11px] font-mono tracking-wide" style={{ color: '#374151' }}>
          cr-reviewer — zsh
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{
              background: isRunning ? '#4ade80' : count >= T_LINES.length ? '#818cf8' : '#374151',
              boxShadow: isRunning ? '0 0 6px rgba(74,222,128,0.5)' : 'none',
            }}
          />
          <span className="text-[10px] font-mono" style={{ color: '#374151' }}>
            {isRunning ? 'running' : count >= T_LINES.length ? 'done' : 'idle'}
          </span>
        </div>
      </div>

      {/* Terminal body */}
      <div className="p-5 font-mono text-[13px] leading-[1.7] min-h-[380px] overflow-hidden">
        {visibleLines.map((line, i) => (
          <div
            key={i}
            className="whitespace-pre"
            style={{ color: lineColor(line.type), opacity: line.type === 'blank' ? 0 : 1 }}
          >
            {line.text || '\u00a0'}
          </div>
        ))}
        {/* Blinking cursor */}
        {count < T_LINES.length && (
          <span
            className="inline-block w-[9px] h-[15px] align-middle"
            style={{
              background: '#34d399',
              animation: 'cli-blink 1s step-end infinite',
              boxShadow: '0 0 6px rgba(52,211,153,0.4)',
            }}
          />
        )}
      </div>
    </div>
  )
}

// ─── CopyButton ────────────────────────────────────────────────────────────────

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }}
      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono transition-all duration-150 flex-shrink-0"
      style={{
        background: copied ? 'rgba(52,211,153,0.1)' : 'rgba(30,41,59,0.6)',
        border: `1px solid ${copied ? 'rgba(52,211,153,0.3)' : 'rgba(51,65,85,0.5)'}`,
        color: copied ? '#34d399' : '#6b7280',
      }}
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2 2 4-4" stroke="#34d399" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          copied
        </>
      ) : (
        <>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="3" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.1" />
            <path d="M3 3V2a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H7" stroke="currentColor" strokeWidth="1.1" />
          </svg>
          copy
        </>
      )}
    </button>
  )
}

// ─── CodeBlock ─────────────────────────────────────────────────────────────────

function CodeBlock({ code, label }) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'rgba(3,7,18,0.8)',
        border: '1px solid rgba(30,41,59,0.7)',
      }}
    >
      {label && (
        <div
          className="flex items-center justify-between px-4 py-2 border-b"
          style={{ borderColor: 'rgba(30,41,59,0.7)', background: 'rgba(8,15,28,0.6)' }}
        >
          <span className="text-[10px] font-mono tracking-widest uppercase text-gray-600">{label}</span>
          <CopyButton text={code} />
        </div>
      )}
      <pre
        className="px-4 py-3 text-sm font-mono overflow-x-auto"
        style={{ color: '#a5b4fc', lineHeight: '1.65' }}
      >
        {code}
      </pre>
    </div>
  )
}

// ─── Install section ───────────────────────────────────────────────────────────

const INSTALL_TABS = [
  {
    id: 'global',
    label: 'Global',
    note: 'cr command available system-wide permanently',
    code: 'npm install -g cr-reviewer\n\n# First-time setup\nollama serve\nollama pull qwen2.5-coder:7b\n\n# Run a review\ncr review my.diff',
  },
  {
    id: 'npx',
    label: 'npx',
    note: 'No install required — downloads on demand',
    code: 'npx cr-reviewer review my.diff\n\n# Or pipe from git\ngit diff --cached | npx cr-reviewer review - --output review.md',
  },
  {
    id: 'source',
    label: 'From source',
    note: 'For contributors — live-reloads from local source files',
    code: 'git clone https://github.com/AESiR-0/webgpu-llm.git\ncd webgpu-llm/packages/cli-reviewer\nnpm install\nnpm link          # registers cr globally',
  },
]

function InstallSection() {
  const [active, setActive] = useState('global')
  const tab = INSTALL_TABS.find((t) => t.id === active)

  return (
    <div className="flex flex-col gap-4">
      {/* Prerequisite chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: 'Node.js ≥ 18', color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
          { label: 'Ollama latest', color: '#67e8f9', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)' },
        ].map((p) => (
          <span
            key={p.label}
            className="text-xs font-mono px-2.5 py-1 rounded-full border"
            style={{ color: p.color, background: p.bg, borderColor: p.border }}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div
        className="rounded-xl overflow-hidden border"
        style={{ borderColor: 'rgba(30,41,59,0.7)', background: 'rgba(3,7,18,0.6)' }}
      >
        <div
          className="flex border-b"
          style={{ borderColor: 'rgba(30,41,59,0.7)', background: 'rgba(8,15,28,0.5)' }}
        >
          {INSTALL_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className="px-4 py-2.5 text-xs font-mono transition-colors relative"
              style={{
                color: active === t.id ? '#a5b4fc' : '#4b5563',
                background: active === t.id ? 'rgba(99,102,241,0.08)' : 'transparent',
                borderBottom: active === t.id ? '1px solid #6366f1' : '1px solid transparent',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="p-1">
          <pre
            className="px-4 py-3 text-sm font-mono overflow-x-auto"
            style={{ color: '#a5b4fc', lineHeight: '1.7' }}
          >
            {tab.code}
          </pre>
        </div>
        <div
          className="px-4 py-2.5 border-t flex items-center justify-between"
          style={{ borderColor: 'rgba(30,41,59,0.5)', background: 'rgba(8,15,28,0.4)' }}
        >
          <span className="text-[11px] text-gray-600 font-mono">{tab.note}</span>
          <CopyButton text={tab.code} />
        </div>
      </div>
    </div>
  )
}

// ─── Flags section ─────────────────────────────────────────────────────────────

function FlagRow({ flag }) {
  const ts = TYPE_STYLE[flag.type] ?? TYPE_STYLE.string
  return (
    <div
      className="grid gap-3 py-3 items-start"
      style={{
        gridTemplateColumns: '1fr auto auto 2fr',
        borderBottom: '1px solid rgba(15,23,42,0.8)',
      }}
    >
      <code
        className="text-xs font-mono whitespace-nowrap"
        style={{ color: '#a5b4fc' }}
      >
        {flag.name}
      </code>
      <span
        className="text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap"
        style={{ color: ts.color, background: ts.bg, borderColor: ts.border }}
      >
        {flag.type}
      </span>
      <code
        className="text-[11px] font-mono whitespace-nowrap"
        style={{ color: '#4b5563' }}
      >
        {flag.default}
      </code>
      <p className="text-xs text-gray-500 leading-relaxed">{flag.desc}</p>
    </div>
  )
}

function FlagsSection() {
  return (
    <div className="flex flex-col gap-6">
      {FLAG_GROUPS.map((group) => (
        <div
          key={group.id}
          className="rounded-xl overflow-hidden border"
          style={{ borderColor: group.color.border, background: group.color.bg }}
        >
          {/* Group header */}
          <div
            className="flex items-center gap-2 px-4 py-3 border-b"
            style={{ borderColor: group.color.border, background: 'rgba(3,7,18,0.4)' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: group.color.pill, boxShadow: `0 0 6px ${group.color.pill}60` }}
            />
            <span
              className="text-[10px] font-mono tracking-widest uppercase"
              style={{ color: group.color.pill }}
            >
              {group.label}
            </span>
          </div>

          {/* Flag rows */}
          <div className="px-4">
            {/* Header row */}
            <div
              className="grid gap-3 py-2 border-b"
              style={{ gridTemplateColumns: '1fr auto auto 2fr', borderColor: 'rgba(15,23,42,0.6)' }}
            >
              {['flag', 'type', 'default', 'description'].map((h) => (
                <span key={h} className="text-[9px] font-mono tracking-widest uppercase text-gray-700">{h}</span>
              ))}
            </div>
            {group.flags.map((f) => <FlagRow key={f.name} flag={f} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Profiles section ──────────────────────────────────────────────────────────

function ProfileCard({ profile: p }) {
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border"
      style={{
        borderColor: p.accent.border,
        background: `radial-gradient(ellipse at 0% 0%, ${p.accent.glow}, transparent 60%), ${p.accent.bg}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">{p.icon}</span>
        <code
          className="text-xs font-mono font-medium"
          style={{ color: p.accent.pill }}
        >
          --profile {p.id}
        </code>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">{p.tagline}</p>

      {/* Meta */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <span className="text-[10px] font-mono text-gray-700 w-20 flex-shrink-0 mt-0.5">agents</span>
          <div className="flex flex-wrap gap-1">
            {p.agents.map((a) => (
              <span
                key={a}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(30,41,59,0.6)', color: '#6b7280', border: '1px solid rgba(30,41,59,0.8)' }}
              >
                {a}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-700 w-20 flex-shrink-0">min-severity</span>
          <span className="text-[10px] font-mono text-gray-500">{p.minSev}</span>
        </div>
        {p.focus !== '—' && (
          <div className="flex items-start gap-2">
            <span className="text-[10px] font-mono text-gray-700 w-20 flex-shrink-0 mt-0.5">focus</span>
            <span className="text-[10px] font-mono text-gray-600 leading-relaxed">{p.focus}</span>
          </div>
        )}
      </div>

      {/* Example */}
      <div
        className="rounded-lg px-3 py-2 mt-1"
        style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(15,23,42,0.8)' }}
      >
        <div className="flex items-start gap-2 justify-between">
          <code
            className="text-[11px] font-mono leading-relaxed flex-1 break-all"
            style={{ color: '#475569' }}
          >
            {p.example}
          </code>
          <CopyButton text={p.example} />
        </div>
      </div>
    </div>
  )
}

// ─── Examples section ──────────────────────────────────────────────────────────

function ExampleCard({ ex }) {
  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border"
      style={{ borderColor: 'rgba(30,41,59,0.5)', background: 'rgba(8,15,28,0.5)' }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-200">{ex.title}</span>
        <span className="text-xs text-gray-500 leading-relaxed">{ex.desc}</span>
      </div>
      <div
        className="rounded-lg px-3 py-2.5"
        style={{ background: 'rgba(3,7,18,0.7)', border: '1px solid rgba(15,23,42,0.9)' }}
      >
        <div className="flex items-start gap-2 justify-between">
          <code
            className="text-xs font-mono leading-relaxed flex-1 break-all"
            style={{ color: '#818cf8' }}
          >
            {ex.cmd}
          </code>
          <CopyButton text={ex.cmd} />
        </div>
      </div>
    </div>
  )
}

// ─── Docs section anchor ───────────────────────────────────────────────────────

function SectionAnchor({ id, label, accent = '#a5b4fc' }) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <span
        className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border w-fit"
        style={{ color: accent, borderColor: `${accent}50`, background: `${accent}12` }}
      >
        {label}
      </span>
      <div className="flex-1 h-px" style={{ background: 'rgba(30,41,59,0.6)' }} />
    </div>
  )
}

// ─── Full docs section ─────────────────────────────────────────────────────────

function CLIDocs() {
  return (
    <section
      className="px-6 py-20"
      style={{ borderTop: '1px solid rgba(20,30,48,0.9)' }}
    >
      <div className="max-w-6xl mx-auto flex flex-col gap-20">

        {/* ── Section title ── */}
        <div className="flex flex-col gap-4 max-w-2xl">
          <span
            className="text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border w-fit"
            style={{ color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.08)' }}
          >
            documentation
          </span>
          <h2
            className="text-3xl sm:text-4xl font-bold leading-tight tracking-tight"
            style={{ color: '#f1f5f9' }}
          >
            Everything you need,{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #34d399 0%, #67e8f9 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              in your shell.
            </span>
          </h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            15 flags, 4 profile presets, 5 output formats, and 3 utility subcommands.
            Everything configurable. All local.
          </p>
        </div>

        {/* ── Quick start ── */}
        <div>
          <SectionAnchor id="install" label="Quick Start" accent="#34d399" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-semibold text-gray-200">Installation</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Install globally to use the <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#a5b4fc' }}>cr</code> command anywhere, or run on-demand with <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#a5b4fc' }}>npx</code>.
                Either way, Ollama must be running locally.
              </p>
              <div className="flex flex-col gap-2 mt-1">
                {[
                  { cmd: 'ollama serve', note: 'Start the Ollama daemon' },
                  { cmd: 'ollama pull qwen2.5-coder:7b', note: 'Pull the default model (~4 GB, one-time)' },
                  { cmd: 'cr status', note: 'Verify Ollama is reachable and model is ready' },
                ].map((s) => (
                  <div key={s.cmd} className="flex items-center gap-3">
                    <code
                      className="text-xs font-mono px-2.5 py-1 rounded-md flex-shrink-0"
                      style={{ background: 'rgba(20,30,48,0.7)', color: '#a5b4fc', border: '1px solid rgba(30,41,59,0.7)' }}
                    >
                      {s.cmd}
                    </code>
                    <span className="text-xs text-gray-600">{s.note}</span>
                  </div>
                ))}
              </div>
            </div>
            <InstallSection />
          </div>
        </div>

        {/* ── Flags reference ── */}
        <div>
          <SectionAnchor id="flags" label="Flags Reference" accent="#a5b4fc" />
          <FlagsSection />
        </div>

        {/* ── Profile presets ── */}
        <div>
          <SectionAnchor id="profiles" label="Profile Presets" accent="#fbbf24" />
          <p className="text-sm text-gray-500 leading-relaxed mb-6 max-w-2xl">
            Profiles are shorthand configurations. <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#fbbf24' }}>--profile</code> overrides{' '}
            <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#a5b4fc' }}>--agents</code>,{' '}
            <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#a5b4fc' }}>--min-severity</code>, and{' '}
            <code className="font-mono text-xs px-1 py-0.5 rounded" style={{ background: 'rgba(30,41,59,0.6)', color: '#a5b4fc' }}>--focus</code> simultaneously.
            Individual flags still work alongside a profile.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PROFILE_CARDS.map((p) => <ProfileCard key={p.id} profile={p} />)}
          </div>
        </div>

        {/* ── Examples ── */}
        <div>
          <SectionAnchor id="examples" label="Examples" accent="#67e8f9" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {EXAMPLES.map((ex) => <ExampleCard key={ex.title} ex={ex} />)}
          </div>
        </div>

        {/* ── Subcommands ── */}
        <div>
          <SectionAnchor id="subcommands" label="Utility Subcommands" accent="#34d399" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                cmd: 'cr status',
                desc: 'Check Ollama is running, verify the default model is pulled, and list all local models.',
                example: 'cr status --model llama3.1:8b --host http://192.168.1.10:11434',
              },
              {
                cmd: 'cr models',
                desc: 'List all locally available Ollama models with sizes. Highlights which ones match the suggested model catalog.',
                example: 'cr models',
              },
            ].map((sc) => (
              <div
                key={sc.cmd}
                className="flex flex-col gap-3 p-4 rounded-xl border"
                style={{ borderColor: 'rgba(52,211,153,0.15)', background: 'rgba(6,78,59,0.06)' }}
              >
                <code
                  className="text-sm font-mono font-semibold"
                  style={{ color: '#34d399' }}
                >
                  {sc.cmd}
                </code>
                <p className="text-xs text-gray-500 leading-relaxed">{sc.desc}</p>
                <div
                  className="rounded-lg px-3 py-2"
                  style={{ background: 'rgba(3,7,18,0.6)', border: '1px solid rgba(15,23,42,0.8)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs font-mono" style={{ color: '#475569' }}>{sc.example}</code>
                    <CopyButton text={sc.example} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Error codes ── */}
        <div>
          <SectionAnchor id="errors" label="Exit Codes" accent="#f87171" />
          <div
            className="rounded-xl overflow-hidden border"
            style={{ borderColor: 'rgba(239,68,68,0.15)', background: 'rgba(127,29,29,0.05)' }}
          >
            <div className="px-4">
              {[
                { code: '0',   condition: 'Review completed (even if issues found)',         fix: '—' },
                { code: '0',   condition: 'No reviewable files found in diff',               fix: 'Check your diff is not all binary/lock files' },
                { code: '1',   condition: 'Ollama not running',                              fix: 'Run: ollama serve' },
                { code: '1',   condition: 'Model not pulled locally',                        fix: 'Run: ollama pull <model>' },
                { code: '1',   condition: 'HTTP timeout during inference',                   fix: 'Increase --timeout or use a smaller model' },
                { code: '2',   condition: 'Diff file not found',                             fix: 'Check the path to your .diff file' },
                { code: '2',   condition: 'Invalid diff format',                             fix: 'Must be valid unified diff (git diff output)' },
                { code: '130', condition: 'Ctrl+C — review cancelled',                      fix: '—' },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid gap-4 py-3 items-start"
                  style={{
                    gridTemplateColumns: '48px 1fr 1fr',
                    borderBottom: i < 7 ? '1px solid rgba(15,23,42,0.7)' : 'none',
                  }}
                >
                  <code
                    className="text-xs font-mono font-bold"
                    style={{ color: row.code === '0' ? '#34d399' : row.code === '130' ? '#94a3b8' : '#f87171' }}
                  >
                    {row.code}
                  </code>
                  <span className="text-xs text-gray-400 leading-relaxed">{row.condition}</span>
                  <span className="text-xs text-gray-600 leading-relaxed font-mono">{row.fix}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats footer ── */}
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-gray-800"
          style={{ background: 'rgba(20,30,48,0.4)' }}
        >
          {[
            { value: '5',    label: 'Output formats' },
            { value: '4',    label: 'Profile presets' },
            { value: '15',   label: 'CLI flags' },
            { value: '0 KB', label: 'Data sent to cloud' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col gap-1 items-center justify-center py-6 px-4 text-center"
              style={{ background: 'rgba(3,7,18,0.7)' }}
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

// ─── Main CLIPage export ───────────────────────────────────────────────────────

export default function CLIPage() {
  return (
    <>
      {/* Inject blink keyframe once */}
      <style>{`
        @keyframes cli-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
      `}</style>

      <div
        className="h-full overflow-y-auto"
        style={{
          background: '#030712',
          backgroundImage:
            'radial-gradient(circle at 1.5px 1.5px, rgba(52,211,153,0.08) 1.5px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      >
        {/* ── Hero ── */}
        <div className="min-h-screen flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">

            {/* ── Left: CLI hero copy ── */}
            <div className="flex flex-col gap-8">

              {/* Badge */}
              <div className="flex items-center gap-2 w-fit">
                <span
                  className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border"
                  style={{
                    color: '#6ee7b7',
                    borderColor: 'rgba(52,211,153,0.35)',
                    background: 'rgba(52,211,153,0.08)',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Powered by Ollama · Node.js CLI
                </span>
              </div>

              {/* Headline */}
              <div className="flex flex-col gap-3">
                <h1
                  className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
                  style={{ color: '#f1f5f9' }}
                >
                  AI code review,{' '}
                  <span
                    style={{
                      background: 'linear-gradient(135deg, #34d399 0%, #67e8f9 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                  >
                    in your terminal.
                  </span>
                </h1>
                <p className="text-base text-gray-400 leading-relaxed max-w-md">
                  Same 4-agent pipeline as the browser tool — driven by your local Ollama models.
                  Review diffs from git, CI, or any file. Zero API costs. Zero data egress.
                </p>
              </div>

              {/* Feature list */}
              <ul className="flex flex-col gap-3">
                {CLI_FEATURES.map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex-shrink-0"
                      style={{ color: '#10b981' }}
                    >
                      <FeatureIcon />
                    </span>
                    <div>
                      <span className="text-sm font-medium text-gray-200">{f.label}</span>
                      <span className="text-sm text-gray-500"> — {f.sub}</span>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Quick start card */}
              <div
                className="flex flex-col gap-2 p-4 rounded-xl border"
                style={{
                  background: 'rgba(6,20,36,0.7)',
                  borderColor: 'rgba(52,211,153,0.2)',
                }}
              >
                <p className="text-[10px] font-mono tracking-widest uppercase text-emerald-900">
                  Quick start
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    'npx cr-reviewer review my.diff',
                    'git diff --cached | cr review - --output review.md',
                    'cr review pr.diff --profile security-audit --quiet',
                  ].map((cmd) => (
                    <code
                      key={cmd}
                      className="text-xs px-2.5 py-1 rounded-md font-mono w-fit"
                      style={{
                        background: 'rgba(10,25,40,0.8)',
                        color: '#6ee7b7',
                        border: '1px solid rgba(52,211,153,0.18)',
                      }}
                    >
                      {cmd}
                    </code>
                  ))}
                </div>
              </div>

              {/* Scroll hint */}
              <div className="flex items-center gap-2 text-gray-700 text-[11px] font-mono">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                scroll for full documentation
              </div>
            </div>

            {/* ── Right: npm badge + Animated terminal ── */}
            <div className="flex flex-col gap-3">
              <div className="flex justify-end">
                <a
                  href="https://www.npmjs.com/package/cr-reviewer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors duration-150 group w-fit"
                  style={{
                    background: 'rgba(203,56,55,0.07)',
                    borderColor: 'rgba(203,56,55,0.2)',
                  }}
                >
                  {/* npm logo */}
                  <svg width="28" height="11" viewBox="0 0 27.23 27.23" aria-hidden="true">
                    <rect width="27.23" height="27.23" rx="2" fill="#cb3837" />
                    <polygon fill="#fff" points="5.8 21.75 13.66 21.75 13.66 9.98 17.59 9.98 17.59 21.75 21.52 21.75 21.52 6.06 5.8 6.06 5.8 21.75" />
                  </svg>
                  <span
                    className="text-[11px] font-mono tracking-wide"
                    style={{ color: '#fca5a5' }}
                  >
                    cr-reviewer
                  </span>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    className="transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    style={{ color: '#6b7280' }}
                  >
                    <path d="M2 8L8 2M8 2H4M8 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              </div>
              <TerminalCard />
            </div>

          </div>
        </div>

        {/* ── CLI Docs section ── */}
        <CLIDocs />
      </div>
    </>
  )
}
