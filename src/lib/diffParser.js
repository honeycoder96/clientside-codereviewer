import parseDiffLib from 'parse-diff'

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg', 'bmp', 'tiff',
  'pdf', 'zip', 'tar', 'gz', 'rar', '7z',
  'ttf', 'woff', 'woff2', 'eot',
  'mp3', 'mp4', 'wav', 'ogg', 'webm',
  'exe', 'dll', 'so', 'dylib',
])

const SKIP_EXTENSIONS = new Set([
  'lock', 'min.js', 'map', 'min.css',
])

const SKIP_FILENAMES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'Gemfile.lock', 'Cargo.lock', 'poetry.lock',
])

const LANGUAGE_MAP = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  go: 'golang',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  cs: 'csharp',
  cpp: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  rb: 'ruby',
  php: 'php',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  html: 'html',
  htm: 'html',
  vue: 'html',
  svelte: 'html',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  ps1: 'powershell',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  xml: 'xml',
  dockerfile: 'dockerfile',
  tf: 'terraform',
  hcl: 'terraform',
}

export function inferLanguage(filename) {
  const base = filename.split('/').pop().toLowerCase()

  // Named files without extensions
  if (base === 'dockerfile') return 'dockerfile'
  if (base === 'makefile') return 'makefile'
  if (base === '.env' || base.startsWith('.env.')) return 'bash'
  if (base === '.gitignore' || base === '.eslintrc') return 'text'

  const ext = base.split('.').pop()
  return LANGUAGE_MAP[ext] ?? 'text'
}

function shouldSkipFile(filename) {
  const base = filename.split('/').pop().toLowerCase()
  if (SKIP_FILENAMES.has(base)) return true

  const parts = base.split('.')
  if (parts.length < 2) return false

  const ext = parts.pop()
  if (BINARY_EXTENSIONS.has(ext)) return true
  if (SKIP_EXTENSIONS.has(ext)) return true

  // e.g. foo.min.js
  if (parts.length >= 1) {
    const doubleExt = parts[parts.length - 1] + '.' + ext
    if (SKIP_EXTENSIONS.has(doubleExt)) return true
  }

  return false
}

function detectStatus(file) {
  const from = file.from ?? ''
  const to = file.to ?? ''
  if (from === '/dev/null') return 'added'
  if (to === '/dev/null') return 'deleted'
  if (from !== to && from !== '' && to !== '') return 'renamed'
  return 'modified'
}

function normalizeChanges(changes) {
  return changes.map((ch) => {
    if (ch.type === 'add') {
      return { type: 'add', content: ch.content, lineNumber: ch.ln }
    }
    if (ch.type === 'del') {
      return { type: 'del', content: ch.content, lineNumber: ch.ln, oldLineNumber: ch.ln }
    }
    // normal / context line
    return {
      type: 'normal',
      content: ch.content,
      lineNumber: ch.ln2 ?? ch.ln,
      oldLineNumber: ch.ln1 ?? ch.ln,
    }
  })
}

function normalizeHunks(chunks) {
  return chunks.map((chunk) => ({
    header: chunk.content,
    oldStart: chunk.oldStart,
    oldLines: chunk.oldLines,
    newStart: chunk.newStart,
    newLines: chunk.newLines,
    changes: normalizeChanges(chunk.changes),
  }))
}

/**
 * Parse a raw unified diff string → FileDiff[]
 * Filters out binary files, lock files, and minified assets.
 */
export function parseDiff(rawText) {
  const raw = parseDiffLib(rawText)
  const results = []

  for (const file of raw) {
    const filename = file.to !== '/dev/null' ? (file.to ?? file.from ?? '') : (file.from ?? '')
    if (!filename) continue
    if (shouldSkipFile(filename)) continue

    // Skip binary files (parse-diff marks them with no chunks and binary flag)
    if (file.binary) continue

    const status = detectStatus(file)
    const hunks = normalizeHunks(file.chunks ?? [])
    let additions = 0
    let deletions = 0
    for (const hunk of hunks) {
      for (const ch of hunk.changes) {
        if (ch.type === 'add') additions++
        else if (ch.type === 'del') deletions++
      }
    }

    results.push({
      filename,
      language: inferLanguage(filename),
      status,
      hunks,
      additions,
      deletions,
    })
  }

  return results
}
