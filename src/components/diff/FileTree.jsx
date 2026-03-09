import { useState, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore } from '../../store/useStore'
import { riskLabel } from '../../lib/scoring'
import DiffStats from './DiffStats'

const VIRTUALIZE_THRESHOLD = 40

const STATUS_ICON = {
  added:    { symbol: '+', color: 'text-green-400' },
  deleted:  { symbol: '−', color: 'text-red-400' },
  modified: { symbol: '~', color: 'text-yellow-400' },
  renamed:  { symbol: '→', color: 'text-blue-400' },
}

const RISK_DOT = {
  green:  'bg-green-400',
  yellow: 'bg-yellow-400',
  red:    'bg-red-400',
}

const RISK_SCORE_COLOR = {
  green:  'text-green-400',
  yellow: 'text-yellow-400',
  red:    'text-red-400',
}

function RiskIndicator({ fileStatus, riskScore }) {
  // File has been reviewed and has a score
  if (fileStatus === 'done' && riskScore != null && riskScore > 0) {
    const { color } = riskLabel(riskScore)
    return (
      <span className="flex items-center gap-1" title={`Risk score: ${riskScore}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${RISK_DOT[color]}`} />
        <span className={`text-[10px] font-mono tabular-nums ${RISK_SCORE_COLOR[color]}`}>
          {riskScore}
        </span>
      </span>
    )
  }
  // Reviewed but score is 0 (no issues)
  if (fileStatus === 'done') {
    return (
      <span className="flex items-center gap-1" title="No issues found">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
        <span className="text-[10px] font-mono text-green-500">0</span>
      </span>
    )
  }
  if (fileStatus === 'reviewing') {
    return <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" title="Reviewing…" />
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-gray-700 flex-shrink-0" />
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

function FileRow({ file, activeFile, fileStatuses, fileReviews, selectedFiles, onSelect, onToggle, showFullPath = false }) {
  const isActive     = activeFile === file.filename
  const isChecked    = selectedFiles.has(file.filename)
  const reviewStatus = fileStatuses.get(file.filename)
  const riskScore    = fileReviews.get(file.filename)?.riskScore ?? null
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
        {showFullPath ? (
          <span className="flex-1 min-w-0 font-mono text-xs" title={file.filename}>
            {file.filename.includes('/') && (
              <span className={`${isActive ? 'text-indigo-200' : isChecked ? 'text-gray-500' : 'text-gray-700'}`}>
                {file.filename.slice(0, file.filename.lastIndexOf('/') + 1)}
              </span>
            )}
            <span className="truncate">{file.basename}</span>
          </span>
        ) : (
          <span className="flex-1 truncate font-mono text-xs">{file.basename}</span>
        )}
        <span className="text-xs flex-shrink-0">
          <span className={isActive || isChecked ? 'text-green-400' : 'text-gray-700'}>
            +{file.additions}
          </span>{' '}
          <span className={isActive || isChecked ? 'text-red-400' : 'text-gray-700'}>
            -{file.deletions}
          </span>
        </span>
        <span className="flex-shrink-0 flex items-center justify-end" style={{ minWidth: '2.5rem' }}>
          <RiskIndicator fileStatus={reviewStatus} riskScore={riskScore} />
        </span>
      </button>
    </div>
  )
}

function TreeNode({ name, node, depth, activeFile, fileStatuses, fileReviews, selectedFiles, onSelect, onToggle }) {
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
              fileReviews={fileReviews}
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
                fileReviews={fileReviews}
                selectedFiles={selectedFiles}
                onSelect={onSelect}
                onToggle={onToggle}
                showFullPath={false}
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

  const [viewMode, setViewMode] = useState('flat')
  const listRef = useRef(null)

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

  const useVirtualFlatList = viewMode === 'flat' && sortedFiles.length > VIRTUALIZE_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: useVirtualFlatList ? sortedFiles.length : 0,
    getScrollElement: () => listRef.current,
    estimateSize: () => 32,
    overscan: 5,
  })
  const totalDeletions = files.reduce((s, f) => s + f.deletions, 0)

  const toggleBtnClass = (mode) =>
    `text-xs px-1.5 py-0.5 rounded transition-colors ${
      viewMode === mode
        ? 'bg-gray-600 text-gray-200'
        : 'text-gray-600 hover:text-gray-400'
    }`

  return (
    <div className="flex flex-col h-full">
      <DiffStats />
      <div className="px-3 py-2 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Files</p>
          <div className="flex items-center gap-2">
            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 border border-gray-700 rounded p-0.5">
              <button
                onClick={() => setViewMode('flat')}
                className={toggleBtnClass('flat')}
                title="Flat list"
              >
                ≡
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={toggleBtnClass('tree')}
                title="Tree view"
              >
                ⌥
              </button>
            </div>
            {/* Select all / none */}
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
      <div ref={listRef} className="flex-1 overflow-y-auto py-1">
        {viewMode === 'flat' ? (
          useVirtualFlatList ? (
            <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((vi) => (
                <div
                  key={vi.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${vi.size}px`,
                    transform: `translateY(${vi.start}px)`,
                  }}
                >
                  <FileRow
                    file={sortedFiles[vi.index]}
                    activeFile={selectedFile}
                    fileStatuses={fileStatuses}
                    fileReviews={fileReviews}
                    selectedFiles={selectedFiles}
                    onSelect={selectFile}
                    onToggle={toggleFileSelection}
                    showFullPath
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="px-1">
              {sortedFiles.map((file) => (
                <FileRow
                  key={file.filename}
                  file={file}
                  activeFile={selectedFile}
                  fileStatuses={fileStatuses}
                  fileReviews={fileReviews}
                  selectedFiles={selectedFiles}
                  onSelect={selectFile}
                  onToggle={toggleFileSelection}
                  showFullPath
                />
              ))}
            </div>
          )
        ) : (
          <TreeNode
            name=""
            node={tree}
            depth={0}
            activeFile={selectedFile}
            fileStatuses={fileStatuses}
            fileReviews={fileReviews}
            selectedFiles={selectedFiles}
            onSelect={selectFile}
            onToggle={toggleFileSelection}
          />
        )}
      </div>
    </div>
  )
}
