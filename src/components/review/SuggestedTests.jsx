import { useStore } from '../../store/useStore'
import StreamingText from '../ui/StreamingText'
import Spinner from '../ui/Spinner'

export default function SuggestedTests() {
  const reviewStatus   = useStore((s) => s.reviewStatus)
  const diffReview     = useStore((s) => s.diffReview)
  const streamingText  = useStore((s) => s.streamingText)

  const suggestedTests = diffReview?.suggestedTests ?? []

  if (reviewStatus === 'reviewing' || (reviewStatus === 'done' && suggestedTests.length === 0)) {
    return (
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Spinner size="sm" />
          Generating test suggestions...
        </div>
        {streamingText && <StreamingText />}
      </div>
    )
  }

  if (suggestedTests.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-600">
        Start a review to generate test suggestions.
      </div>
    )
  }

  return (
    <div className="p-3 flex flex-col gap-2">
      <span className="text-xs text-gray-500">
        {suggestedTests.length} suggested test{suggestedTests.length !== 1 ? 's' : ''}
      </span>
      <ol className="flex flex-col gap-2">
        {suggestedTests.map((test, i) => (
          <li
            key={i}
            className="flex gap-3 border-l-2 border-indigo-800 pl-3 py-1"
          >
            <span className="text-xs text-indigo-500 font-mono flex-shrink-0 w-5">
              {i + 1}.
            </span>
            <span className="text-xs text-gray-300 leading-relaxed">{test}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
