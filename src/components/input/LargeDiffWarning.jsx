import { estimateTotalChunks } from '../../lib/chunker'
import { SECONDS_PER_CHUNK } from '../../config.js'

export default function LargeDiffWarning({ files, onProceed, onCancel }) {
  const totalChunks = estimateTotalChunks(files)
  const estMinutes = Math.ceil((totalChunks * SECONDS_PER_CHUNK) / 60)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-md mx-4 flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">⚠</span>
          <h2 className="text-base font-semibold text-white">Large diff detected</h2>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>
            <span className="text-white font-medium">{files.length}</span> files
          </span>
          <span className="text-gray-600">·</span>
          <span>
            ~<span className="text-white font-medium">{totalChunks}</span> chunks
          </span>
          <span className="text-gray-600">·</span>
          <span>
            ~<span className="text-white font-medium">{estMinutes}</span> min estimated
          </span>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          This review may take several minutes. Consider deselecting large or unrelated
          files in the file tree before starting.
        </p>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 rounded-lg transition-colors"
          >
            Go back
          </button>
          <button
            onClick={onProceed}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Proceed anyway
          </button>
        </div>
      </div>
    </div>
  )
}
