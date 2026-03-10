import { useStore } from '../../store/useStore'
import AgentProgress from '../input/AgentProgress'
import ReviewSummary from './ReviewSummary'
import SecurityFindings from './SecurityFindings'
import FileReviewList from './FileReviewList'
import SuggestedTests from './SuggestedTests'
import CommitMessage from './CommitMessage'
import HistoryPanel from './HistoryPanel'

const TABS = [
  { id: 'summary',  label: 'Summary',  alwaysEnabled: true },
  { id: 'files',    label: 'Files',    alwaysEnabled: true },
  { id: 'security', label: 'Security', alwaysEnabled: true },
  { id: 'tests',    label: 'Tests',    alwaysEnabled: false },
  { id: 'commit',   label: 'Commit',   alwaysEnabled: false },
  { id: 'history',  label: 'History',  alwaysEnabled: true },
]

function TabBar({ tab, setTab, reviewStatus, securityCount, historyCount }) {
  const isDone = reviewStatus === 'done'
  return (
    <div className="flex border-b border-gray-700 flex-shrink-0 overflow-x-auto">
      {TABS.map(({ id, label, alwaysEnabled }) => {
        const enabled = alwaysEnabled || isDone
        const active = tab === id
        return (
          <button
            key={id}
            onClick={() => enabled && setTab(id)}
            disabled={!enabled}
            title={!enabled ? 'Available after review completes' : undefined}
            className={`
              relative px-3 py-2 text-xs font-medium flex-shrink-0 transition-colors
              ${active ? 'text-white border-b-2 border-indigo-400 -mb-px' : 'text-gray-500'}
              ${enabled && !active ? 'hover:text-gray-300' : ''}
              ${!enabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            {label}
            {id === 'security' && securityCount > 0 && (
              <span className="ml-1 text-xs text-red-400 font-mono">{securityCount}</span>
            )}
            {id === 'history' && historyCount > 0 && (
              <span className="ml-1 text-xs text-gray-500 font-mono">{historyCount}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function RightPanel() {
  const reviewStatus   = useStore((s) => s.reviewStatus)
  const rightPanelTab  = useStore((s) => s.rightPanelTab)
  const setTab         = useStore((s) => s.setTab)
  const fileReviews    = useStore((s) => s.fileReviews)
  const historyCount   = useStore((s) => s.historyEntries.length)

  const securityCount = [...fileReviews.values()]
    .flatMap((fr) => fr.mergedIssues)
    .filter((i) => i.category === 'security').length

  const showProgress = reviewStatus === 'reviewing' || reviewStatus === 'done'

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Agent progress (shown during + after review, collapses to bar when done) */}
      {showProgress && <AgentProgress />}

      {/* Tab bar */}
      <TabBar
        tab={rightPanelTab}
        setTab={setTab}
        reviewStatus={reviewStatus}
        securityCount={securityCount}
        historyCount={historyCount}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {rightPanelTab === 'summary'  && <ReviewSummary />}
        {rightPanelTab === 'files'    && <FileReviewList />}
        {rightPanelTab === 'security' && <SecurityFindings />}
        {rightPanelTab === 'tests'    && <SuggestedTests />}
        {rightPanelTab === 'commit'   && <CommitMessage />}
        {rightPanelTab === 'history'  && <HistoryPanel />}
      </div>
    </div>
  )
}
