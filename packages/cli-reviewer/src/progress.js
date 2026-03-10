import { riskLabel } from '../lib/scoring.js'

// ---------------------------------------------------------------------------
// TTY detection
// ---------------------------------------------------------------------------

const IS_TTY = process.stderr.isTTY === true

function ts() {
  return new Date().toISOString().slice(11, 23) // HH:MM:SS.mmm
}

// ---------------------------------------------------------------------------
// ANSI helpers (only applied when TTY)
// ---------------------------------------------------------------------------

const RESET  = '\x1b[0m'
const BOLD   = '\x1b[1m'
const DIM    = '\x1b[2m'
const RED    = '\x1b[31m'
const GREEN  = '\x1b[32m'
const YELLOW = '\x1b[33m'
const CYAN   = '\x1b[36m'

function color(str, ...codes) {
  if (!IS_TTY) return str
  return codes.join('') + str + RESET
}

function riskColor(score) {
  if (score <= 3) return GREEN
  if (score <= 6) return YELLOW
  return RED
}

// ---------------------------------------------------------------------------
// ProgressReporter class
// ---------------------------------------------------------------------------

export class ProgressReporter {
  /**
   * @param {object} opts
   * @param {boolean} opts.quiet    — suppress all output
   * @param {boolean} opts.verbose  — show per-chunk timing
   * @param {boolean} opts.stream   — print tokens as they arrive
   */
  constructor({ quiet = false, verbose = false, stream = false } = {}) {
    this.quiet   = quiet
    this.verbose = verbose
    this.stream  = stream

    this._spinner    = null
    this._streamBuf  = ''
    this._agentStart = 0
    this._fileStart  = 0
    this._ora        = null
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  async _loadOra() {
    if (this._ora) return this._ora
    const { default: ora } = await import('ora')
    this._ora = ora
    return ora
  }

  _write(text) {
    process.stderr.write(text + '\n')
  }

  _writePlain(text) {
    if (IS_TTY) {
      process.stderr.write(text + '\n')
    } else {
      process.stderr.write(`[${ts()}] ${text}\n`)
    }
  }

  _stopSpinner() {
    if (this._spinner) {
      this._spinner.stop()
      this._spinner = null
    }
  }

  // ---------------------------------------------------------------------------
  // Public callbacks (mapped to reviewer-cli.js + agents.js callbacks)
  // ---------------------------------------------------------------------------

  async onFileStart(filename, index, total) {
    if (this.quiet) return
    this._fileStart = Date.now()

    const prefix = color(`[ ${index}/${total} ]`, BOLD, CYAN)
    const name   = color(filename, BOLD)

    if (IS_TTY) {
      const ora = await this._loadOra()
      this._stopSpinner()
      this._spinner = ora({ text: `${prefix} ${name}`, stream: process.stderr }).start()
    } else {
      this._writePlain(`[ ${index}/${total} ] ${filename}`)
    }
  }

  onAgentStart(agentId) {
    if (this.quiet) return
    this._agentStart = Date.now()

    if (IS_TTY && this._spinner) {
      const agentLabel = agentId.charAt(0).toUpperCase() + agentId.slice(1)
      this._spinner.text = `  ${color('⏳', DIM)} ${agentLabel} Agent...`
    } else {
      this._writePlain(`  → ${agentId} agent started`)
    }
  }

  onToken(token) {
    if (this.quiet || !this.stream) return

    if (IS_TTY && this._spinner) {
      this._spinner.stop()
      this._spinner = null
    }

    // Write token directly to stderr without newline
    process.stderr.write(token)
    this._streamBuf += token
  }

  onAgentComplete(agentId, result) {
    if (this.quiet) return

    const durationSec = ((Date.now() - this._agentStart) / 1000).toFixed(1)
    const issueCount  = result?.issues?.length ?? 0
    const agentLabel  = agentId.charAt(0).toUpperCase() + agentId.slice(1)
    const issueStr    = issueCount === 1 ? '1 issue' : `${issueCount} issues`

    if (this.stream && this._streamBuf) {
      process.stderr.write('\n')
      this._streamBuf = ''
    }

    if (IS_TTY && this._spinner) {
      const timing = this.verbose ? color(` (${durationSec}s)`, DIM) : ''
      this._spinner.text = `  ${color('✓', GREEN)} ${agentLabel} Agent — ${issueStr}${timing}`
    } else {
      const timing = this.verbose ? ` (${durationSec}s)` : ''
      this._writePlain(`  ✓ ${agentLabel} Agent — ${issueStr}${timing}`)
    }
  }

  async onFileComplete(filename, fileReview) {
    if (this.quiet) return

    const durationSec = ((Date.now() - this._fileStart) / 1000).toFixed(1)
    const { label }   = riskLabel(fileReview.riskScore)
    const c           = fileReview.issueCount
    const riskStr     = color(`Risk ${fileReview.riskScore} ${label}`, riskColor(fileReview.riskScore))
    const issueStr    = `${c.critical} critical · ${c.warning} warnings · ${c.info} info`
    const timing      = this.verbose ? color(` · ${durationSec}s`, DIM) : ''
    const msg         = `${filename} — ${riskStr} · ${issueStr}${timing}`

    if (IS_TTY && this._spinner) {
      this._spinner.succeed(msg)
      this._spinner = null
    } else {
      this._writePlain(`✓ ${filename} — Risk ${fileReview.riskScore} ${label} · ${issueStr}`)
    }
  }

  onFileSkipped(filename, reason) {
    if (this.quiet) return
    const reasonStr = reason === 'deleted' ? 'deleted file' : 'no applicable agents'
    if (IS_TTY && this._spinner) {
      this._spinner.info(`${filename} — skipped (${reasonStr})`)
      this._spinner = null
    } else {
      this._writePlain(`- ${filename} — skipped (${reasonStr})`)
    }
  }

  onFinalSummary(diffReview, outPath) {
    if (this.quiet) return
    this._stopSpinner()

    const { overallRisk, totalIssues, durationMs, files } = diffReview
    const { label } = riskLabel(overallRisk)
    const seconds   = (durationMs / 1000).toFixed(1)
    const fileCount = files.length
    const outLine   = outPath ? `Output: ${outPath}` : 'Output: stdout'

    if (IS_TTY) {
      const riskLine    = color(`Risk: ${overallRisk} ${label}`, riskColor(overallRisk))
      const issueLine   = `Issues: ${totalIssues.critical} critical · ${totalIssues.warning} warnings · ${totalIssues.info} info`
      const summaryLine = `Review complete — ${fileCount} file${fileCount !== 1 ? 's' : ''} · ${seconds}s`

      const lines = [summaryLine, riskLine, issueLine, outLine]
      const width = Math.max(...lines.map((l) => stripAnsi(l).length)) + 4

      const border = '─'.repeat(width)
      process.stderr.write('\n')
      process.stderr.write(`┌${border}┐\n`)
      for (const line of lines) {
        const padded = stripAnsi(line).padEnd(width - 2)
        // Re-apply ANSI after padding calculation
        process.stderr.write(`│  ${line}${' '.repeat(Math.max(0, width - 2 - stripAnsi(line).length))}│\n`)
      }
      process.stderr.write(`└${border}┘\n`)
    } else {
      this._writePlain(`Review complete — ${fileCount} file(s) · ${seconds}s`)
      this._writePlain(`Risk: ${overallRisk} ${label}`)
      this._writePlain(`Issues: ${totalIssues.critical} critical · ${totalIssues.warning} warnings · ${totalIssues.info} info`)
      this._writePlain(outLine)
    }
  }

  onChunkError(chunkId, message) {
    if (this.quiet) return
    this._writePlain(`  ⚠ Chunk error (${chunkId}): ${message}`)
  }

  onPostReviewError(message) {
    if (this.quiet) return
    this._writePlain(`  ⚠ Post-review error: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Utility: strip ANSI escape codes for length calculation
// ---------------------------------------------------------------------------

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}
