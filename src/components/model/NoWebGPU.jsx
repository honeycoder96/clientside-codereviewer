import HeroSection from '../layout/HeroSection'

const BROWSERS = [
  { name: 'Chrome', version: '113+', supported: true },
  { name: 'Edge', version: '113+', supported: true },
  { name: 'Safari', version: '17+', supported: true },
  { name: 'Firefox', version: 'any', supported: false },
]

export default function NoWebGPU() {
  return (
    <HeroSection>
      {/* ── Right: WebGPU not supported ── */}
      <div className="flex flex-col gap-4">

        {/* Error card */}
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
                <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="#f87171" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M8 6v3.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="#f87171" />
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
    </HeroSection>
  )
}
