const FEATURES = [
  {
    label: '4 specialized agents',
    sub: 'Security, logic bugs, test coverage & overall summary',
  },
  {
    label: 'Zero data egress',
    sub: 'Every token is computed locally — nothing leaves your machine',
  },
  {
    label: 'No account required',
    sub: 'Model weights are cached in your browser after first load',
  },
  {
    label: 'Offline capable',
    sub: 'Works without internet once the model is downloaded',
  },
]

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

const BROWSERS = [
  { name: 'Chrome', version: '113+', supported: true },
  { name: 'Edge',   version: '113+', supported: true },
  { name: 'Safari', version: '17+',  supported: true },
  { name: 'Firefox', version: 'any', supported: false },
]

export default function NoWebGPU() {
  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: '#030712',
        backgroundImage:
          'radial-gradient(circle at 1.5px 1.5px, rgba(99,102,241,0.12) 1.5px, transparent 0)',
        backgroundSize: '28px 28px',
      }}
    >
      <div className="min-h-full flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">

          {/* ── Left: Hero copy (identical to landing) ── */}
          <div className="flex flex-col gap-8">
            <div className="flex items-center gap-2 w-fit">
              <span
                className="flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase px-2.5 py-1 rounded-full border"
                style={{
                  color: '#a5b4fc',
                  borderColor: 'rgba(99,102,241,0.35)',
                  background: 'rgba(99,102,241,0.08)',
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 inline-block" />
                Runs entirely in your browser · WebGPU
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <h1
                className="text-4xl sm:text-5xl font-bold leading-[1.1] tracking-tight"
                style={{ color: '#f1f5f9' }}
              >
                AI code review,{' '}
                <span
                  style={{
                    background: 'linear-gradient(135deg, #818cf8 0%, #38bdf8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  fully private.
                </span>
              </h1>
              <p className="text-base text-gray-400 leading-relaxed max-w-md">
                Paste a git diff and get instant analysis from 4 specialized AI agents —
                security vulnerabilities, logic bugs, test gaps, and a commit summary.
                All processed locally. No API keys. No servers.
              </p>
            </div>

            <ul className="flex flex-col gap-3">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-3">
                  <span className="mt-0.5 flex-shrink-0" style={{ color: '#6366f1' }}>
                    <FeatureIcon />
                  </span>
                  <div>
                    <span className="text-sm font-medium text-gray-200">{f.label}</span>
                    <span className="text-sm text-gray-500"> — {f.sub}</span>
                  </div>
                </li>
              ))}
            </ul>

            <div
              className="flex flex-col gap-2 p-4 rounded-xl border"
              style={{
                background: 'rgba(15,23,42,0.6)',
                borderColor: 'rgba(51,65,85,0.6)',
              }}
            >
              <p className="text-[10px] font-mono tracking-widest uppercase text-gray-600">
                Get a diff
              </p>
              <div className="flex flex-col gap-1.5">
                {['git diff', 'git diff --staged', 'git diff HEAD~1'].map((cmd) => (
                  <code
                    key={cmd}
                    className="text-xs px-2.5 py-1 rounded-md font-mono w-fit"
                    style={{
                      background: 'rgba(30,41,59,0.8)',
                      color: '#a5b4fc',
                      border: '1px solid rgba(51,65,85,0.5)',
                    }}
                  >
                    {cmd}
                  </code>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right: WebGPU not supported ── */}
          <div className="flex flex-col gap-4">

            {/* Error card header */}
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                background: 'rgba(8,15,28,0.9)',
                borderColor: 'rgba(239,68,68,0.25)',
                boxShadow: '0 0 0 1px rgba(239,68,68,0.08), 0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              {/* Top bar */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b"
                style={{
                  borderColor: 'rgba(239,68,68,0.15)',
                  background: 'rgba(127,29,29,0.15)',
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M8 6v3.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="8" cy="11.5" r="0.75" fill="#f87171"/>
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-300">WebGPU not available</p>
                  <p className="text-[10px] text-red-500/70 font-mono">navigator.gpu → undefined</p>
                </div>
              </div>

              <div className="p-5 flex flex-col gap-5">
                <p className="text-sm text-gray-400 leading-relaxed">
                  This app runs AI models locally using WebGPU. Your current browser or
                  device doesn't expose the WebGPU API.
                </p>

                {/* Browser compatibility table */}
                <div className="flex flex-col gap-1.5">
                  <p className="text-[10px] font-mono tracking-widest uppercase text-gray-600 mb-1">
                    Browser support
                  </p>
                  {BROWSERS.map((b) => (
                    <div
                      key={b.name}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{
                        background: b.supported
                          ? 'rgba(16,185,129,0.05)'
                          : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${b.supported ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: b.supported ? '#10b981' : '#6b7280' }}
                        />
                        <span className="text-sm text-gray-300">{b.name}</span>
                      </div>
                      <span
                        className="text-xs font-mono"
                        style={{ color: b.supported ? '#34d399' : '#6b7280' }}
                      >
                        {b.supported ? `v${b.version} ✓` : 'not supported'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Troubleshooting */}
                <div
                  className="flex flex-col gap-2 p-4 rounded-xl"
                  style={{
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(51,65,85,0.5)',
                  }}
                >
                  <p className="text-[10px] font-mono tracking-widest uppercase text-gray-600">
                    On a supported browser but still seeing this?
                  </p>
                  <ul className="flex flex-col gap-1.5 text-sm text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">·</span>
                      Update your graphics drivers
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">·</span>
                      Enable hardware acceleration in browser settings
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-gray-600 mt-0.5">·</span>
                      WebGPU is unavailable in VMs and some cloud environments
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
