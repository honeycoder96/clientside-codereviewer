import { readFileSync } from 'fs'
import { createInterface } from 'readline'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { OllamaClient, OllamaNotRunningError, ModelNotPulledError, OllamaTimeoutError } from './ollama-client.js'
import { DEFAULT_MODEL, SUGGESTED_MODELS } from './ollama-models.js'
import { reviewDiff } from './reviewer-cli.js'
import { ProgressReporter } from './progress.js'
import { writeOutput } from './writer.js'
import { parseDiff } from '../lib/diffParser.js'
import { estimateTotalChunks } from '../lib/chunker.js'
import { riskLabel } from '../lib/scoring.js'
import { toMarkdown, toJSON, toCSV, toSARIF, toPRDescription } from '../lib/export.js'
import { LARGE_FILE_THRESHOLD, LARGE_CHUNK_THRESHOLD } from './config-cli.js'

// ---------------------------------------------------------------------------
// Profile presets
// ---------------------------------------------------------------------------

const PROFILES = {
  'security-audit': {
    enabledAgents: new Set(['security']),
    minSeverity:   'info',
    focusContext:  'Focus exclusively on security vulnerabilities, auth issues, and injection risks.',
  },
  'critical-only': {
    enabledAgents: new Set(['bug', 'security', 'performance']),
    minSeverity:   'critical',
    focusContext:  '',
  },
  'performance': {
    enabledAgents: new Set(['performance']),
    minSeverity:   'info',
    focusContext:  'Focus exclusively on performance bottlenecks, memory leaks, and inefficiencies.',
  },
  'show-all': {
    enabledAgents: new Set(['bug', 'security', 'performance']),
    minSeverity:   'info',
    focusContext:  '',
  },
}

// ---------------------------------------------------------------------------
// Severity filter helper
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { info: 1, warning: 2, critical: 3 }

function applyMinSeverity(diffReview, minSeverity) {
  const minRank = SEVERITY_RANK[minSeverity] ?? 1
  if (minRank <= 1) return // 'info' = show everything, skip filtering

  diffReview.files.forEach((fr) => {
    fr.mergedIssues = fr.mergedIssues.filter(
      (i) => (SEVERITY_RANK[i.severity] ?? 0) >= minRank
    )
  })

  // Recalculate totals after filtering
  const allIssues = diffReview.files.flatMap((fr) => fr.mergedIssues)
  diffReview.totalIssues = {
    critical: allIssues.filter((i) => i.severity === 'critical').length,
    warning:  allIssues.filter((i) => i.severity === 'warning').length,
    info:     allIssues.filter((i) => i.severity === 'info').length,
  }
  diffReview.securityFindings = allIssues.filter((i) => i.category === 'security')
}

// ---------------------------------------------------------------------------
// Exporter
// ---------------------------------------------------------------------------

function buildOutput(format, diffReview, fileReviewsMap, files) {
  switch (format) {
    case 'json':     return toJSON(diffReview, fileReviewsMap, files)
    case 'csv':      return toCSV(fileReviewsMap)
    case 'sarif':    return toSARIF(fileReviewsMap)
    case 'pr-desc':  return toPRDescription(diffReview, fileReviewsMap, files)
    default:         return toMarkdown(diffReview, fileReviewsMap, files)
  }
}

// ---------------------------------------------------------------------------
// Read diff input
// ---------------------------------------------------------------------------

async function readDiffInput(diffPath) {
  if (diffPath === '-') {
    // Read from stdin
    return new Promise((resolve, reject) => {
      const rl = createInterface({ input: process.stdin })
      const lines = []
      rl.on('line', (line) => lines.push(line))
      rl.on('close', () => resolve(lines.join('\n')))
      rl.on('error', reject)
    })
  }

  try {
    return readFileSync(diffPath, 'utf8')
  } catch (err) {
    console.error(`Error: Cannot read diff file: ${diffPath}`)
    process.exit(2)
  }
}

// ---------------------------------------------------------------------------
// Large diff guard
// ---------------------------------------------------------------------------

async function checkLargeDiff(files, totalChunks, quiet) {
  const tooManyFiles  = files.length >= LARGE_FILE_THRESHOLD
  const tooManyChunks = totalChunks  >= LARGE_CHUNK_THRESHOLD

  if (!tooManyFiles && !tooManyChunks) return true

  if (quiet) {
    // Auto-continue in CI mode
    process.stderr.write(
      `Warning: Large diff (${files.length} files, ~${totalChunks} chunks). Proceeding in --quiet mode.\n`
    )
    return true
  }

  process.stderr.write(
    `\nLarge diff detected: ${files.length} files · ~${totalChunks} estimated chunks.\n` +
    `This may take a while. Continue? [y/N] `
  )

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr })
    rl.question('', (answer) => {
      rl.close()
      resolve(answer.toLowerCase().startsWith('y'))
    })
  })
}

// ---------------------------------------------------------------------------
// `cr review` command
// ---------------------------------------------------------------------------

async function cmdReview(args) {
  const { diffPath, model, host, timeout, mode, agents, focus, profile,
    format, output, minSeverity, stream, quiet, verbose, noTests, noCommitMsg } = args

  // Apply profile overrides (profile > individual flags)
  let resolvedAgents     = new Set(agents.split(',').map((a) => a.trim()).filter(Boolean))
  let resolvedFocus      = focus
  let resolvedMinSev     = minSeverity

  if (profile && PROFILES[profile]) {
    const preset = PROFILES[profile]
    resolvedAgents = preset.enabledAgents
    if (preset.minSeverity) resolvedMinSev = preset.minSeverity
    if (preset.focusContext) resolvedFocus = preset.focusContext
  }

  // Read and parse diff
  const rawDiff = await readDiffInput(diffPath)
  const files   = parseDiff(rawDiff)

  if (files.length === 0) {
    if (!quiet) {
      console.error('No reviewable files found (binary, lock, or minified files only).')
    }
    process.exit(0)
  }

  // Validate diff was parseable
  if (rawDiff.trim() && !rawDiff.includes('---') && !rawDiff.includes('diff --git')) {
    console.error('Error: Could not parse the diff. Check it is valid unified diff format.')
    process.exit(2)
  }

  // Large diff guard
  const totalChunks = estimateTotalChunks(files)
  const proceed = await checkLargeDiff(files, totalChunks, quiet)
  if (!proceed) {
    console.error('Review cancelled.')
    process.exit(130)
  }

  // Instantiate Ollama client and preflight
  const client = new OllamaClient({ model, host, timeout })

  try {
    await client.preflight()
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }

  // Set up progress reporter
  const reporter = new ProgressReporter({ quiet, verbose, stream })

  // Set up options
  const options = {
    enabledAgents: resolvedAgents,
    focusContext:  resolvedFocus,
    reviewMode:    mode,
    noTests,
    noCommitMsg,
  }

  // Handle Ctrl+C
  const { cancelCurrentReview } = await import('./reviewer-cli.js')
  process.on('SIGINT', () => {
    cancelCurrentReview()
    process.stderr.write('\nReview cancelled.\n')
    process.exit(130)
  })

  // Run review
  let diffReview
  try {
    diffReview = await reviewDiff(client, files, options, {
      onToken:          (t)          => reporter.onToken(t),
      onAgentStart:     (id)         => reporter.onAgentStart(id),
      onAgentComplete:  (id, result) => reporter.onAgentComplete(id, result),
      onFileStart:      (fn, i, tot) => reporter.onFileStart(fn, i, tot),
      onFileComplete:   (fn, fr)     => reporter.onFileComplete(fn, fr),
      onFileSkipped:    (fn, reason) => reporter.onFileSkipped(fn, reason),
      onChunkError:     (id, msg)    => reporter.onChunkError(id, msg),
      onPostReviewError:(msg)        => reporter.onPostReviewError(msg),
      clearStreaming:   ()           => {},
    })
  } catch (err) {
    if (err instanceof OllamaNotRunningError || err instanceof ModelNotPulledError) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
    if (err instanceof OllamaTimeoutError) {
      console.error(`Error: ${err.message}`)
      process.exit(1)
    }
    throw err
  }

  // Apply severity filter
  applyMinSeverity(diffReview, resolvedMinSev)

  // Build export map
  const fileReviewsMap = new Map(diffReview.files.map((fr) => [fr.filename, fr]))

  // Format output
  const content = buildOutput(format, diffReview, fileReviewsMap, files)

  // Write output
  const outPath = writeOutput(content, { format, output })

  // Final summary to stderr
  reporter.onFinalSummary(diffReview, outPath)
}

// ---------------------------------------------------------------------------
// `cr status` command
// ---------------------------------------------------------------------------

async function cmdStatus(args) {
  const { host, model } = args
  const client = new OllamaClient({ model, host, timeout: 5_000 })

  try {
    const models = await client.listModels()
    console.error(`Ollama is running at ${host}`)
    console.error(`Default model (${model}): ${
      models.some((m) => m.name?.startsWith(model.split(':')[0]))
        ? 'available locally'
        : 'NOT pulled — run: ollama pull ' + model
    }`)
    console.error(`\nLocal models (${models.length}):`)
    for (const m of models) {
      const sizeGb = m.size ? ` (${(m.size / 1e9).toFixed(1)} GB)` : ''
      console.error(`  ${m.name}${sizeGb}`)
    }
    process.exit(0)
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}

// ---------------------------------------------------------------------------
// `cr models` command
// ---------------------------------------------------------------------------

async function cmdModels(args) {
  const { host } = args
  const client = new OllamaClient({ model: DEFAULT_MODEL, host, timeout: 5_000 })

  let localModels = []
  try {
    localModels = await client.listModels()
  } catch (err) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }

  const localNames = new Set(localModels.map((m) => m.name ?? ''))

  console.error('\nSuggested models for code review:\n')
  for (const m of SUGGESTED_MODELS) {
    const pulled = localNames.has(m.name) || [...localNames].some((n) => n.startsWith(m.name.split(':')[0]))
    const badge  = pulled ? ' [pulled]' : ''
    console.error(`  ${m.name.padEnd(25)}${badge.padEnd(10)} ${m.description}`)
  }

  console.error('\nAll local models:\n')
  if (localModels.length === 0) {
    console.error('  (none — run: ollama pull qwen2.5-coder:7b)')
  } else {
    for (const m of localModels) {
      const sizeGb = m.size ? ` — ${(m.size / 1e9).toFixed(1)} GB` : ''
      console.error(`  ${m.name}${sizeGb}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Yargs CLI definition
// ---------------------------------------------------------------------------

const DEFAULT_HOST = 'http://localhost:11434'

yargs(hideBin(process.argv))
  .scriptName('cr')
  .usage('$0 <command> [options]')

  // ── review ──────────────────────────────────────────────────────────────
  .command(
    'review <diff-path>',
    'Review a diff file (or stdin with -)',
    (y) => {
      y.positional('diff-path', {
        describe: 'Path to .diff file, or - to read from stdin',
        type:     'string',
      })
      .option('model',        { alias: 'm', type: 'string',  default: DEFAULT_MODEL,           describe: 'Ollama model name' })
      .option('host',                        { type: 'string',  default: DEFAULT_HOST,            describe: 'Ollama base URL' })
      .option('timeout',                     { type: 'number',  default: 120_000,                 describe: 'Per-request HTTP timeout (ms)' })
      .option('mode',                        { type: 'string',  default: 'fast', choices: ['fast', 'deep'], describe: 'Review mode' })
      .option('agents',                      { type: 'string',  default: 'bug,security,performance', describe: 'Comma-separated agents to enable' })
      .option('focus',                       { type: 'string',  default: '',                      describe: 'Free-text context injected into every prompt' })
      .option('profile',                     { type: 'string',  choices: Object.keys(PROFILES),   describe: 'Preset profile' })
      .option('format',       { alias: 'f', type: 'string',  default: 'md', choices: ['md', 'json', 'csv', 'sarif', 'pr-desc'], describe: 'Output format' })
      .option('output',       { alias: 'o', type: 'string',                                       describe: 'Write to file instead of stdout' })
      .option('min-severity',               { type: 'string',  default: 'info', choices: ['info', 'warning', 'critical'], describe: 'Filter issues below this level' })
      .option('stream',                      { type: 'boolean', default: false,  describe: 'Print LLM tokens as they arrive' })
      .option('quiet',        { alias: 'q', type: 'boolean', default: false,  describe: 'Suppress progress display (CI mode)' })
      .option('verbose',      { alias: 'v', type: 'boolean', default: false,  describe: 'Show per-chunk timing' })
      .option('tests',                       { type: 'boolean', default: true,  describe: 'Generate test suggestions (use --no-tests to skip)' })
      .option('commit-msg',                  { type: 'boolean', default: true,  describe: 'Generate commit message (use --no-commit-msg to skip)' })
    },
    async (args) => {
      await cmdReview({
        diffPath:    args['diff-path'],
        model:       args.model,
        host:        args.host,
        timeout:     args.timeout,
        mode:        args.mode,
        agents:      args.agents,
        focus:       args.focus,
        profile:     args.profile,
        format:      args.format,
        output:      args.output,
        minSeverity: args['min-severity'],
        stream:      args.stream,
        quiet:       args.quiet,
        verbose:     args.verbose,
        noTests:     !args.tests,
        noCommitMsg: !args['commit-msg'],
      }).catch((err) => {
        console.error(`Unexpected error: ${err.message}`)
        process.exit(1)
      })
    }
  )

  // ── status ───────────────────────────────────────────────────────────────
  .command(
    'status',
    'Check Ollama health and default model availability',
    (y) => {
      y.option('host',  { type: 'string', default: DEFAULT_HOST,  describe: 'Ollama base URL' })
       .option('model', { alias: 'm', type: 'string', default: DEFAULT_MODEL, describe: 'Model to check' })
    },
    async (args) => {
      await cmdStatus({ host: args.host, model: args.model })
    }
  )

  // ── models ───────────────────────────────────────────────────────────────
  .command(
    'models',
    'List locally available Ollama models',
    (y) => {
      y.option('host', { type: 'string', default: DEFAULT_HOST, describe: 'Ollama base URL' })
    },
    async (args) => {
      await cmdModels({ host: args.host })
    }
  )

  .demandCommand(1, 'Please specify a command: review, status, or models')
  .strict()
  .help()
  .alias('help', 'h')
  .version('0.1.0')
  .alias('version', 'V')
  .wrap(Math.min(120, process.stdout.columns ?? 80))
  .parse()
