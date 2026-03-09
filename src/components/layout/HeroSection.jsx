import FeaturesSection from './FeaturesSection'

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

/**
 * Shared hero left-column used on the landing page, model-selector view,
 * and the NoWebGPU fallback.
 *
 * Props:
 *   children — rendered in the right column next to the hero copy
 */
export default function HeroSection({ children }) {
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
            {/* ── Hero ── */}
            <div className="min-h-screen flex items-center justify-center px-6 py-12">
                <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-10 lg:gap-16 items-center">

                    {/* ── Left: Hero copy ── */}
                    <div className="flex flex-col gap-8">

                        {/* Badge */}
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

                        {/* Headline */}
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

                        {/* Feature list */}
                        <ul className="flex flex-col gap-3">
                            {FEATURES.map((f) => (
                                <li key={f.label} className="flex items-start gap-3">
                                    <span
                                        className="mt-0.5 flex-shrink-0"
                                        style={{ color: '#6366f1' }}
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

                        {/* How to get a diff */}
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

                        {/* Scroll hint */}
                        <div className="flex items-center gap-2 text-gray-700 text-[11px] font-mono">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                                <path d="M6 2v8M3 7l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            scroll to explore all features
                        </div>
                    </div>

                    {/* ── Right: Slot for each page's content ── */}
                    {children}

                </div>
            </div>

            {/* ── Features section ── */}
            <FeaturesSection />
        </div>
    )
}
