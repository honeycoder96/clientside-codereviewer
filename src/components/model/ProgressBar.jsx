export default function ProgressBar({ percent, label }) {
  return (
    <div className="w-full">
      <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
        <div
          className="bg-indigo-500 h-3 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {label && (
        <p className="mt-2 text-sm text-gray-400 text-center truncate">{label}</p>
      )}
    </div>
  )
}
