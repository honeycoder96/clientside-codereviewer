export default function NoWebGPU() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="max-w-lg w-full flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="text-red-400 text-2xl">⚠</span>
          <h1 className="text-xl font-semibold text-white">WebGPU not supported</h1>
        </div>

        <p className="text-sm text-gray-400 leading-relaxed">
          This app runs AI models locally in your browser using WebGPU. Your current
          browser or device does not support WebGPU.
        </p>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col gap-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
            Supported browsers
          </p>
          <ul className="text-sm text-gray-300 flex flex-col gap-1">
            <li>Google Chrome 113 or newer</li>
            <li>Microsoft Edge 113 or newer</li>
          </ul>
          <p className="text-xs text-gray-500 mt-1">
            Firefox and Safari do not currently support WebGPU.
          </p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            Already on Chrome?
          </p>
          <p className="text-sm text-gray-300">
            Navigate to{' '}
            <code className="bg-gray-700 px-1.5 py-0.5 rounded text-indigo-300 text-xs">
              chrome://flags/#enable-unsafe-webgpu
            </code>{' '}
            and set it to <span className="text-green-400">Enabled</span>, then relaunch.
          </p>
        </div>
      </div>
    </div>
  )
}
