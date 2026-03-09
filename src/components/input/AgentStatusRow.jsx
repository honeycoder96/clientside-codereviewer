export default function AgentStatusRow({ agent, status }) {
  const isPending = !status || status.status === 'pending'
  const isRunning = status?.status === 'running'
  const isDone = status?.status === 'done'
  const count = status?.issueCount ?? 0

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-opacity ${
        isPending ? 'opacity-40' : 'opacity-100'
      }`}
    >
      <span className="text-base w-5 flex-shrink-0">{agent.icon}</span>

      <span className={`flex-1 font-medium ${isDone ? 'text-gray-300' : isRunning ? 'text-white' : 'text-gray-500'}`}>
        {agent.name}
      </span>

      {isPending && (
        <span className="text-xs text-gray-600">waiting</span>
      )}

      {isRunning && (
        <span className="flex items-center gap-1.5 text-xs text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
          analyzing...
        </span>
      )}

      {isDone && (
        <span className={`text-xs ${count > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
          {count > 0 ? `${count} issue${count !== 1 ? 's' : ''} found` : 'no issues'}
        </span>
      )}
    </div>
  )
}
