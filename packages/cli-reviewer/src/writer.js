import { writeFileSync } from 'fs'
import { resolve, extname } from 'path'

const FORMAT_EXT = {
  md:       '.md',
  json:     '.json',
  csv:      '.csv',
  sarif:    '.sarif',
  'pr-desc': '.md',
}

/**
 * Write the review output to a file or stdout.
 *
 * @param {string} content    — formatted output string
 * @param {object} opts
 * @param {string} opts.format  — 'md' | 'json' | 'csv' | 'sarif' | 'pr-desc'
 * @param {string} [opts.output] — file path, or '-' / undefined for stdout
 * @returns {string|null}      — resolved file path, or null if stdout
 */
export function writeOutput(content, { format, output }) {
  if (!output || output === '-') {
    process.stdout.write(content + '\n')
    return null
  }

  // Append the default extension if the path has none
  const withExt = extname(output) ? output : output + (FORMAT_EXT[format] ?? '.txt')
  const absPath = resolve(withExt)
  writeFileSync(absPath, content, 'utf8')
  return absPath
}
