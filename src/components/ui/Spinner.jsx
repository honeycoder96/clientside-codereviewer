const SIZE = {
  sm: 'w-3 h-3 border',
  md: 'w-4 h-4 border-2',
}

export default function Spinner({ size = 'sm', className = '' }) {
  return (
    <span
      className={`inline-block rounded-full border-gray-600 border-t-indigo-400 animate-spin ${SIZE[size]} ${className}`}
    />
  )
}
