# CLI Code Reviewer — Implementation Plan

> A Node.js CLI tool for local code review powered by Ollama, built on the same core pipeline as the WebGPU browser tool.

---

## Overview

The CLI reuses the browser tool's core review pipeline (diff parsing → semantic chunking → 4-agent review → risk scoring → export) but replaces the WebGPU/WebLLM engine with an Ollama HTTP client and the React UI with a terminal progress display.

**User flow:**
```bash
cr review my.diff --format md --output review.md
```

Zero server costs. Code never leaves the machine.

---

## Module Portability Assessment

### Verbatim copies — zero changes needed

| Module | Why portable |
|---|---|
| `src/lib/diffParser.js` | Uses only `parse-diff` npm package |
| `src/lib/chunker.js` | Pure string/array math |
| `src/lib/prompts.js` | Pure template strings |
| `src/lib/parseResponse.js` | Pure string/regex/JSON |
| `src/lib/scoring.js` | Pure arithmetic |
| `src/lib/agents.js` | Engine is injected — no `engine.js` import |
| `src/lib/export.js` | `toMarkdown/toJSON/toCSV/toSARIF` are pure; `triggerDownload` is never called from CLI code path |

### Needs adaptation — targeted changes only

| Module | What changes |
|---|---|
| `src/lib/reviewer.js` → `reviewer-cli.js` | (1) Remove `Worker`/`chunkFileAsync` → call `chunkFile()` directly; (2) Replace `sessionStorage` write-through with in-memory Map only; (3) Replace `useStore.getState()` with an `options` parameter passed in from CLI |
| `src/lib/engine.js` → `ollama-client.js` | Full rewrite — same interface contract, Ollama HTTP backend |
| `src/lib/persist.js` | Not needed — drop entirely |

---

## Project Structure

```
webgpu-llm/
├── src/                              ← existing browser app (unchanged)
└── packages/
    └── cli-reviewer/                 ← NEW
        ├── package.json
        ├── bin/
        │   └── cr.js                 ← entry point (#!/usr/bin/env node)
        ├── src/
        │   ├── cli.js                ← arg parsing + top-level orchestration
        │   ├── ollama-client.js      ← Ollama HTTP wrapper (replaces engine.js)
        │   ├── ollama-models.js      ← suggested model catalog
        │   ├── reviewer-cli.js       ← adapted reviewer.js (no Zustand, no Workers)
        │   ├── progress.js           ← terminal UX (spinners, progress bars)
        │   ├── writer.js             ← file/stdout output (replaces triggerDownload)
        │   └── config-cli.js         ← constants (copy of config.js minus UI consts)
        └── lib/                      ← verbatim copies of portable src/lib modules
            ├── diffParser.js
            ├── chunker.js
            ├── prompts.js
            ├── parseResponse.js
            ├── scoring.js
            ├── agents.js
            └── export.js
```

---

## CLI Interface

### Command syntax

```bash
# Happy path — review a diff file, write markdown to stdout
cr review my.diff

# Read from stdin
git diff --cached | cr review -

# Write to file
cr review my.diff --format md --output review.md

# Full options
cr review <diff-path> [options]

# Utility subcommands
cr status          # check Ollama health + default model availability
cr models          # list locally available Ollama models
```

### All flags with defaults

| Flag | Default | Description |
|---|---|---|
| `--model, -m` | `qwen2.5-coder:7b` | Ollama model name |
| `--host` | `http://localhost:11434` | Ollama base URL |
| `--timeout` | `120000` | Per-request HTTP timeout in milliseconds |
| `--mode` | `fast` | `fast` (unified) or `deep` (sequential 4-agent) |
| `--agents` | `bug,security,performance` | Comma-separated agents to enable |
| `--focus` | `""` | Free-text context injected into every prompt |
| `--profile` | none | Preset: `security-audit`, `critical-only`, `performance`, `show-all` |
| `--format, -f` | `md` | Output format: `md`, `json`, `csv`, `sarif`, `pr-desc` |
| `--output, -o` | stdout | Write to file instead of stdout |
| `--min-severity` | `info` | Filter issues below this level: `info`, `warning`, `critical` |
| `--stream` | `false` | Print LLM tokens as they arrive |
| `--quiet, -q` | `false` | Suppress progress display; only output result (good for CI) |
| `--verbose, -v` | `false` | Show per-chunk timing and token counts |
| `--no-tests` | `false` | Skip test-suggestion LLM call |
| `--no-commit-msg` | `false` | Skip commit message generation |

### Example invocations

```bash
# Review staged changes, deep mode, write to file
git diff --cached > staged.diff
cr review staged.diff --mode deep --output review.md

# CI pipeline — SARIF output, no prompts
git diff main...HEAD | cr review - --format sarif --output results.sarif --quiet

# Security audit profile, JSON output
cr review feature.diff --profile security-audit --format json -o sec-audit.json

# Stream tokens while reviewing with focus context
cr review pr-123.diff --stream --focus "Go — check goroutine leaks and channel usage"
```

---

## Ollama Integration

### API interface

`agents.js` already consumes the engine through a clean injected interface:

```js
engine.chat.completions.create({ messages, stream: true, max_tokens })
// → AsyncIterable<{ choices: [{ delta: { content } }] }>
```

`ollama-client.js` must expose exactly this shape. Internally it POSTs to Ollama's `/api/chat` with streaming and converts Ollama's newline-delimited JSON into the same async iterator. **`agents.js` requires zero modification.**

### Preflight health check

On startup, before running the review:

1. `GET /api/tags` with a 5-second timeout
2. `ECONNREFUSED` → typed `OllamaNotRunningError`
3. Requested model absent from tag list → typed `ModelNotPulledError`

### Streaming

Ollama returns `Content-Type: text/event-stream` with newline-delimited JSON blobs:
```json
{"message":{"role":"assistant","content":"..."},"done":false}
```

The async generator reads the response body, splits on `\n`, parses each blob, and yields:
```js
{ choices: [{ delta: { content: blob.message.content } }] }
```

This matches exactly what `agents.js` iterates over.

### `ollama-models.js`

```js
export const DEFAULT_MODEL = 'qwen2.5-coder:7b'
export const FALLBACK_MODEL = 'llama3.2:3b'

export const SUGGESTED_MODELS = [
  { name: 'qwen2.5-coder:7b',    description: 'Best for code review, strong reasoning' },
  { name: 'llama3.2:3b',         description: 'Fastest, smallest download (~2 GB)' },
  { name: 'llama3.1:8b',         description: 'Best for large complex diffs' },
  { name: 'mistral:7b',          description: 'Strong general reasoning' },
  { name: 'deepseek-coder:6.7b', description: 'Alternative code specialist' },
]
```

---

## reviewer-cli.js — Adaptation Details

Three targeted changes from `src/lib/reviewer.js`:

**1. Remove Worker indirection**
```js
// Before (browser)
const chunks = await chunkFileAsync(fileDiff)   // spawns chunker.worker.js

// After (CLI)
const chunks = chunkFile(fileDiff)              // direct synchronous call
```

**2. Replace sessionStorage with in-memory Map only**
```js
// Before: writes to sessionStorage + _chunkCache Map
// After: keep _chunkCache Map and hash logic, drop sessionStorage write-through
```

**3. Replace Zustand with injected options**
```js
// Before
export async function reviewDiff(engine, files, callbacks) {
  const { enabledAgents, focusContext, reviewMode } = useStore.getState()

// After
export async function reviewDiff(engine, files, options, callbacks) {
  const { enabledAgents, focusContext, reviewMode } = options
```

---

## Terminal Progress UX

All progress output goes to **stderr** so stdout stays clean for piping.

```
[ 1/3 ] src/api/auth.js
  ✓ Bug Agent         — 2 issues found  (4.2s)
  ⏳ Security Auditor  — chunk 2/4...
  · Performance       — waiting
  · Summary           — waiting

auth.js complete — Risk 7.2 High · 1 critical · 3 warnings

[ 2/3 ] src/lib/session.js
  ...

┌─────────────────────────────────────────────┐
│  Review complete — 3 files · 42s            │
│  Risk: 6.8 Medium                           │
│  Issues: 2 critical · 7 warnings · 4 info   │
│  Output written to: review.md               │
└─────────────────────────────────────────────┘
```

### `ProgressReporter` class

Maps directly to the `callbacks` object consumed by `reviewer-cli.js` and `agents.js`:

| Callback | Terminal action |
|---|---|
| `onFileStart(filename, i, total)` | Print `[ i/total ] filename`, start spinner |
| `onAgentStart(agentId, chunk, total)` | Update spinner text |
| `onToken(token)` | If `--stream`: write to stderr (spinner paused) |
| `onAgentComplete(agentId, result)` | Spinner checkmark + timing if `--verbose` |
| `onFileComplete(filename, fileReview)` | `spinner.succeed` with risk + issue counts |
| `onFinalSummary(diffReview, outPath)` | Print summary box |

**Behaviour rules:**
- Non-TTY mode (CI pipe): print plain timestamped lines, no ANSI
- `--stream` mode: pause spinner → raw tokens to stderr → restart for next agent
- `--quiet`: suppress all progress output (stderr silent)
- `--verbose`: show per-chunk progress bar and token counts

**Dependencies:** `ora` (spinner), `cli-progress` (chunk bars, verbose only)

---

## Export — `writer.js`

All export functions in `src/lib/export.js` are pure string builders — copied verbatim. `writer.js` only replaces `triggerDownload`:

```js
export function writeOutput(content, { format, output }) {
  if (!output || output === '-') {
    process.stdout.write(content + '\n')
    return null
  }
  const ext = extname(output) ? output : output + FORMAT_EXT[format]
  const path = resolve(ext)
  writeFileSync(path, content, 'utf8')
  return path
}
```

**`--min-severity` filtering** applied in `cli.js` before passing to exporters:
```js
const rank = { info: 1, warning: 2, critical: 3 }
const minRank = rank[args.minSeverity]
diffReview.files.forEach(fr => {
  fr.mergedIssues = fr.mergedIssues.filter(i => rank[i.severity] >= minRank)
})
```

---

## Error Handling

| Situation | Exit code | Message |
|---|---|---|
| Ollama not running | 1 | `"Ollama is not running. Start it with: ollama serve"` |
| Model not pulled | 1 | `"Model not found. Pull it with: ollama pull <model>"` |
| File not found | 2 | `"Cannot read diff file: <path>"` |
| Invalid diff format | 2 | `"Could not parse the diff. Check it is valid unified diff format."` |
| No reviewable files | 0 | `"No reviewable files found (binary, lock, or minified files only)."` |
| Large diff (>15 files / >60 chunks) | 0 | Warning + interactive prompt; auto-continue in `--quiet` mode |
| HTTP timeout | 1 | Message + `--timeout` hint |
| `Ctrl+C` | 130 | `"Review cancelled."` — triggers `cancelCurrentReview()` + AbortSignal |

---

## Implementation Phases

### Phase 1 — Scaffold & portability verification

**Goal:** Create the package skeleton and verify all portable modules load cleanly in Node.js.

**Files to create:**
- `packages/cli-reviewer/package.json` — `"type":"module"`, `"bin":{"cr":"./bin/cr.js"}`, deps: `parse-diff`, `ora`, `cli-progress`, `yargs`
- `packages/cli-reviewer/bin/cr.js` — shebang + import of `src/cli.js`
- `packages/cli-reviewer/src/config-cli.js` — copy of `src/config.js`, UI layout constants removed
- `packages/cli-reviewer/lib/*.js` — verbatim copies of all 7 portable modules

**Key decision:** Use `yargs` for argument parsing — provides auto-generated `--help`, type coercion, and enum validation out of the box.

---

### Phase 2 — Ollama client

**Goal:** Implement `ollama-client.js` with preflight, streaming, and abort. Verify against a live Ollama instance.

**Files to create:**
- `packages/cli-reviewer/src/ollama-client.js`
- `packages/cli-reviewer/src/ollama-models.js`

**Key decision:** Use `response.body` as an async iterator (`for await (const chunk of response.body)`) — available in Node 18+ when the body is a Node.js stream. Test both success and all four error paths before moving on.

---

### Phase 3 — Adapted reviewer + CLI core

**Goal:** Port `reviewer.js` to `reviewer-cli.js`, implement `cli.js` with full argument parsing, wire up the pipeline end-to-end.

**Files to create:**
- `packages/cli-reviewer/src/reviewer-cli.js`
- `packages/cli-reviewer/src/cli.js`

**Key decision:** `cli.js` must build `Map<filename, FileReview>` from the array returned by `reviewer-cli.js` before calling exporters:
```js
const fileReviewsMap = new Map(diffReview.files.map(fr => [fr.filename, fr]))
```

---

### Phase 4 — Terminal progress display

**Goal:** Implement the `ProgressReporter` class with full spinner, streaming, and CI-safe output.

**Files to create:**
- `packages/cli-reviewer/src/progress.js`

**Key decision:** `--stream` mode conflicts with spinner animation. Pause the spinner before writing raw tokens; restart it for the next agent. In non-TTY mode, fall back to plain timestamped lines.

---

### Phase 5 — Export and writer

**Goal:** Implement `writer.js`, verify all five export formats, wire up `--min-severity` filter.

**Files to create:**
- `packages/cli-reviewer/src/writer.js`

---

### Phase 6 — Polish and packaging

**Goal:** `cr status` and `cr models` subcommands, README, npm packaging.

**Files to create/finalize:**
- `packages/cli-reviewer/README.md`
- `packages/cli-reviewer/.npmignore`
- Finalize `package.json` with `"engines":{"node":">=18.0.0"}` and `"files"` field

---

## Publishing to npm

The CLI is published as a standalone package to the public npm registry so users can install it with a single command.

### Package identity

```json
{
  "name": "cr-reviewer",
  "version": "0.1.0",
  "description": "Local AI code reviewer powered by Ollama — no server, no data leaves your machine",
  "bin": { "cr": "./bin/cr.js" },
  "engines": { "node": ">=18.0.0" }
}
```

The `"bin"` field is what creates the `cr` command after install. npm symlinks `bin/cr.js` into the user's global `node_modules/.bin/` and adds it to `PATH` automatically.

### Publishing steps (our side)

```bash
cd packages/cli-reviewer

# 1. Login to npm (one-time)
npm login

# 2. Dry run — verify what gets included
npm pack --dry-run

# 3. Publish
npm publish --access public
```

The `.npmignore` (or `"files"` field in `package.json`) ensures only the runtime files are included in the published tarball — `bin/`, `src/`, `lib/`. Test fixtures, dev scripts, and the parent repo's `node_modules` are excluded.

### Versioning and releases

- Follow **semver**: `0.x.y` during initial development, `1.0.0` on first stable release
- Cut a new npm publish for each version bump — no automation required until the project matures
- Keep the CLI's `package.json` version independent from the browser app's version

---

## End-User Installation & Usage

### Prerequisites

Users need two things installed before using the CLI:

| Prerequisite | Minimum version | Install |
|---|---|---|
| Node.js | 18.0.0 | [nodejs.org](https://nodejs.org) |
| Ollama | latest | [ollama.com](https://ollama.com) |

### Installation paths

**Option 1 — Global install (recommended)**
```bash
npm install -g cr-reviewer
```
After this, the `cr` command is available system-wide permanently.

**Option 2 — One-off run with npx (no install)**
```bash
npx cr-reviewer review my.diff
```
npx downloads and runs the package without a permanent install. Good for trying it out or CI pipelines.

**Option 3 — From source (contributors / development)**
```bash
git clone https://github.com/AESiR-0/webgpu-llm.git
cd webgpu-llm/packages/cli-reviewer
npm install
npm link          # registers 'cr' globally from local source
```
`npm link` creates a global symlink to the local checkout — source changes are reflected immediately.

### First-time setup

```bash
# 1. Install the CLI
npm install -g cr-reviewer

# 2. Start Ollama (must be running before any review)
ollama serve

# 3. Pull a model — one-time download (~4 GB for the default)
ollama pull qwen2.5-coder:7b

# 4. Run a review
git diff main...feature | cr review - --output review.md
```

### Runtime flow

```
cr review my.diff
      ↓
Node.js resolves 'cr' from PATH → bin/cr.js → src/cli.js
      ↓
ollama-client.js preflight: GET http://localhost:11434/api/tags
  → Ollama not running?  "Run: ollama serve"
  → Model not pulled?    "Run: ollama pull qwen2.5-coder:7b"
      ↓
Pipeline: parse diff → chunk → 4-agent review → score
      ↓
Output written to file or stdout
```

### Common usage examples

```bash
# Review staged changes, write markdown to file
git diff --cached > staged.diff
cr review staged.diff --output review.md

# Pipe directly from git
git diff main...feature | cr review - --output review.md

# Deep mode with a specific focus
cr review pr.diff --mode deep --focus "TypeScript, focus on type safety"

# Security audit only, JSON output
cr review pr.diff --profile security-audit --format json -o audit.json

# CI pipeline — SARIF output, no interactive prompts
git diff main...HEAD | cr review - --format sarif --output results.sarif --quiet
```

---

## Critical Integration Points

| Seam | Why it matters |
|---|---|
| `ollama-client.js` ↔ `agents.js` | The async iterator shape must match exactly — this is the single integration point between old and new code |
| `reviewer-cli.js` options param | Signature changes from `reviewDiff(engine, files, callbacks)` to `reviewDiff(engine, files, options, callbacks)` — options injected from CLI args, not Zustand |
| Export map shape | `cli.js` must build `Map<filename, FileReview>` before calling `toMarkdown`/`toJSON` since that is what `export.js` expects |
| `config-cli.js` constants | All numeric constants (chunk sizes, risk weights, severity weights, token budgets) must match `src/config.js` exactly to preserve identical scoring behavior |
