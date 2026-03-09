import { useState, useMemo } from 'react'
import { useStore } from '../../store/useStore'

const STATUS_ICON = {
  added:    { symbol: '+', color: 'text-green-400' },
  deleted:  { symbol: '−', color: 'text-red-400' },
  modified: { symbol: '~', color: 'text-yellow-400' },
  renamed:  { symbol: '→', color: 'text-blue-400' },
}

function ReviewBadge({ status }) {
  if (status === 'done')      return <span className="text-green-400 text-xs font-bold">✓</span>
  if (status === 'reviewing') return <span className="text-yellow-400 text-xs animate-pulse">⏳</span>
  return <span className="text-gray-600 text-xs">—</span>
}

/**
 * Group FileDiff[] into a nested directory tree:
 * { 'src': { 'components': { __files: [...] }, __files: [] }, __files: [] }
 */
function buildTree(files) {
  const root = {}
  for (const file of files) {
    const parts = file.filename.split('/')
    const filename = parts.pop()
    let node = root
    for (const part of parts) {
      if (!node[part]) node[part] = { __files: [] }
      node = node[part]
    }
    if (!node.__files) node.__files = []
    node.__files.push({ ...file, basename: filename })
  }
  return root
}

function FileRow({ file, activeFile, fileStatuses, selectedFiles, onSelect, onToggle }) {
  const isActive  = activeFile === file.filename
  const isChecked = selectedFiles.has(file.filename)
  const reviewStatus = fileStatuses.get(file.filename)
  const si = STATUS_ICON[file.status] ?? STATUS_ICON.modified

  return (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors ${
        isActive ? 'bg-indigo-600' : 'hover:bg-gray-700'
      }`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={() => onToggle(file.filename)}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 accent-indigo-500 cursor-pointer"
      />
      <button
        onClick={() => onSelect(file.filename)}
        className={`flex-1 flex items-center gap-2 text-left min-w-0 ${
          isActive ? 'text-white' : isChecked ? 'text-gray-300' : 'text-gray-600'
        }`}
      >
        <span
          className={`font-mono font-bold text-xs w-3 flex-shrink-0 ${
            isActive ? 'text-white' : isChecked ? si.color : 'text-gray-600'
          }`}
        >
          {si.symbol}
        </span>
        <span className="flex-1 truncate font-mono text-xs">{file.basename}</span>
        <span className="text-xs flex-shrink-0">
          <span className={isActive || isChecked ? 'text-green-400' : 'text-gray-700'}>
            +{file.additions}
          </span>{' '}
          <span className={isActive || isChecked ? 'text-red-400' : 'text-gray-700'}>
            -{file.deletions}
          </span>
        </span>
        <span className="flex-shrink-0 w-4 text-center">
          <ReviewBadge status={reviewStatus} />
        </span>
      </button>
    </div>
  )
}

function TreeNode({ name, node, depth, activeFile, fileStatuses, selectedFiles, onSelect, onToggle }) {
  const [collapsed, setCollapsed] = useState(false)
  const files = node.__files ?? []
  const dirs  = Object.entries(node).filter(([k]) => k !== '__files')

  if (files.length === 0 && dirs.length === 0) return null

  return (
    <div>
      {name && (
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-1 px-2 py-1 text-left text-xs text-gray-400 hover:text-gray-200 font-medium transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          <span className="text-gray-500 text-xs">{collapsed ? '▶' : '▼'}</span>
          <span className="font-mono">{name}/</span>
        </button>
      )}
      {!collapsed && (
        <div style={{ paddingLeft: name ? `${depth * 12}px` : 0 }}>
          {dirs.map(([dirName, child]) => (
            <TreeNode
              key={dirName}
              name={dirName}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              fileStatuses={fileStatuses}
              selectedFiles={selectedFiles}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
          {files.map((file) => (
            <div key={file.filename} style={{ paddingLeft: `${(depth + (name ? 1 : 0)) * 12}px` }}>
              <FileRow
                file={file}
                activeFile={activeFile}
                fileStatuses={fileStatuses}
                selectedFiles={selectedFiles}
                onSelect={onSelect}
                onToggle={onToggle}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FileTree() {
  const files               = useStore((s) => s.files)
  const fileStatuses        = useStore((s) => s.fileStatuses)
  const fileReviews         = useStore((s) => s.fileReviews)
  const reviewStatus        = useStore((s) => s.reviewStatus)
  const selectedFile        = useStore((s) => s.selectedFile)
  const selectedFiles       = useStore((s) => s.selectedFiles)
  const selectFile          = useStore((s) => s.selectFile)
  const toggleFileSelection = useStore((s) => s.toggleFileSelection)
  const selectAllFiles      = useStore((s) => s.selectAllFiles)
  const deselectAllFiles    = useStore((s) => s.deselectAllFiles)

  // Sort by risk score (desc) when review is done
  const sortedFiles = useMemo(
    () =>
      reviewStatus === 'done'
        ? [...files].sort(
            (a, b) =>
              (fileReviews.get(b.filename)?.riskScore ?? 0) -
              (fileReviews.get(a.filename)?.riskScore ?? 0)
          )
        : files,
    [files, fileReviews, reviewStatus]
  )

  const tree = useMemo(() => buildTree(sortedFiles), [sortedFiles])
  const totalAdditions = files.reduce((s, f) => s + f.additions, 0)
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Files</p>
          {files.length > 1 && reviewStatus !== 'reviewing' && (
            <div className="flex gap-2">
              <button
                onClick={selectAllFiles}
                className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
              >
                All
              </button>
              <button
                onClick={deselectAllFiles}
                className="text-xs text-gray-600 hover:text-gray-300 transition-colors"
              >
                None
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {files.length} file{files.length !== 1 ? 's' : ''}
          {' · '}
          <span className="text-green-400">+{totalAdditions}</span>
          {' '}
          <span className="text-red-400">-{totalDeletions}</span>
          {reviewStatus === 'done' && (
            <span className="text-gray-700 ml-1">· sorted by risk</span>
          )}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        <TreeNode
          name=""
          node={tree}
          depth={0}
          activeFile={selectedFile}
          fileStatuses={fileStatuses}
          selectedFiles={selectedFiles}
          onSelect={selectFile}
          onToggle={toggleFileSelection}
        />
      </div>
    </div>
  )
}
