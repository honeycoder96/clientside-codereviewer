# WebGPU Local Code Reviewer — Project Specification

> A fully client-side, multi-agent code reviewer powered by WebLLM.
> Zero server costs. Zero data leaves the browser.
>
> **All phases shipped and complete.**

---

## 1. Overview

A fully client-side code review tool built on WebLLM that:

1. Accepts a pasted unified diff (e.g. `git diff` or a GitHub PR `.diff` file) — with drag-and-drop support
2. Parses the diff off the main thread via a Web Worker into structured `FileDiff[]`
3. Chunks changes into reviewable units (off main thread, in parallel per file)
4. Runs each chunk through **4 specialized AI agents** (Bug, Security, Performance, Summary) — all powered by a single WebLLM model with different role prompts and cumulative memory
5. Presents inline review comments anchored to the exact changed lines alongside a syntax-highlighted diff viewer
6. Produces a 0–10 risk score, security findings panel, suggested commit message, and test cases
7. Lets users control the review pipeline — inject free-text focus context, toggle individual agents, and filter issues by severity/category — all persisted across sessions
8. Supports 5 MLC-compiled models with mid-session switching and cache detection
9. Exports completed reviews as Markdown, JSON, or CSV
10. Runs fully responsively from 375px (mobile) to wide desktop

---

## 2. Application Flow

```
┌─────────────────────────────────┐
│  User pastes unified diff       │
│  into textarea input            │
│  (git diff / PR .diff output)   │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│  Parse unified diff             │
│  (parse-diff library)           │
│  → Array<FileDiff>              │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│  Group changes by file          │
│  → Map<filename, hunks[]>       │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│  Semantic chunking              │
│  Split hunks at logical         │
│  boundaries (functions, blocks) │
│  Target: 500–800 tokens/chunk   │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│  Progressive file-by-file       │
│  review with streaming output   │
│                                 │
│  For each FILE:                 │
│    For each chunk in file:      │
│      Run 4 agent passes:        │
│        Bug → Security → Perf    │
│        → Summary                │
│      (tokens stream to UI)      │
│    ─────────────────────────    │
│    File complete → push results │
│    to UI immediately            │
│    ✓ auth.js reviewed           │
│    ✓ login.ts reviewed          │
│    ⏳ api.ts reviewing...       │
│                                 │
│  Aggregate updates live as      │
│  each file completes            │
└──────────────┬──────────────────┘
               ▼
┌─────────────────────────────────┐
│  Render UI (progressive)        │
│  LEFT:  diff viewer + inline    │
│         comments appear as      │
│         each file completes     │
│  RIGHT: review panel fills in   │
│         file by file            │
│  TOP:   risk badge updates      │
│         incrementally           │
└─────────────────────────────────┘
```

---

## 3. UI Architecture

### 3.1 Screens

| Screen          | When                        | Description                                  |
| --------------- | --------------------------- | -------------------------------------------- |
| **ModelLoader** | App start (no engine ready) | Model selection, download progress bar        |
| **DiffInput**   | Engine ready, no diff loaded| Large textarea to paste diff + "Review" button|
| **Review**      | Diff parsed, review started | Single progressive screen — results fill in file-by-file as agents complete. No separate "Results" screen; reviewing and results are the same view. |

> **Key UX principle:** There is no loading wall. The Review screen appears
> immediately with the diff viewer and empty right panel. As each file's review
> completes, its results appear — inline comments in the diff, entries in the
> file list, and incrementally updated risk scores. The user can browse
> already-reviewed files while later files are still being analyzed.

### 3.2 Layout (Reviewing / Results)

```
┌──────────────────────────────────────────────────────────┐
│  Header: file count · additions/deletions · risk badge   │
├────────────────────┬─────────────────────────────────────┤
│  File Tree         │                                     │
│  ┌──────────┐      │  Diff Viewer (react-diff-view)      │
│  │✓src/     │      │  ┌─────────────────────────────┐    │
│  │✓ App.jsx │◄─────│  │ @@ -10,6 +10,8 @@           │    │
│  │⏳utils.js│      │  │  import React from 'react'   │    │
│  │ test/    │      │  │ +import { validate } from... │    │
│  │  app.test│      │  │ +                            │    │
│  └──────────┘      │  └─────────────────────────────┘    │
│  ✓ = reviewed      │                                     │
│  ⏳= in progress   │  Inline comment (appears when file  │
│                    │  review completes):                  │
│  Review Panel      │  ┌─────────────────────────────┐    │
│  ┌──────────┐      │  │ ⚠ Missing input validation   │    │
│  │ Summary  │      │  │ on `validate()` — could      │    │
│  │ Risk: 7↑ │      │  │ allow injection if userInput  │    │
│  │ Issues: 3│      │  │ is unsanitized.              │    │
│  │ (live)   │      │  │ Severity: warning  🔒        │    │
│  └──────────┘      │  └─────────────────────────────┘    │
├────────────────────┴─────────────────────────────────────┤
│  Footer: ⏳ 🔍Bug Agent on chunk 3/7 · tokens/sec · ETA  │
└──────────────────────────────────────────────────────────┘
```

### 3.3 Component Tree

```
<App>
├── <ModelLoader />                   // Screen 1: model download + progress
│   ├── <ModelSelector />             // Radio-card picker: 5 models with size/VRAM/cached badge
│   └── <ProgressBar />              // Download progress
│
├── <ReviewDashboard />               // Screens 2–3 (after model loaded)
│   ├── <DiffInputArea />             // Large textarea + drag-drop + restore banner
│   │
│   ├── <Header />                    // Stats · risk badge · Start Review · Export · ⚙ · New Review
│   │   ├── <ExportMenu />            // Markdown / JSON / CSV download (done state only)
│   │   └── <SettingsPanel />         // Right-edge slide-over: Focus / Agents / Filters tabs
│   │
│   ├── [Desktop] <SplitLayout />     // Resizable two-column layout
│   │   ├── <LeftPanel>
│   │   │   ├── <FileTree />          // Flat list (default) or tree; virtualised >40 files
│   │   │   └── <DiffViewer />        // react-diff-view; lazy inline comments via requestIdleCallback
│   │   │       └── <InlineComment /> // Anchored to exact changed lines
│   │   │
│   │   └── <RightPanel>
│   │       ├── <AgentProgress />     // Shown during review (collapses when done)
│   │       │   ├── <AgentStatusRow />
│   │       │   └── <StreamingText />
│   │       ├── <ReviewSummary />     // Risk score — updates incrementally per file
│   │       ├── <SecurityFindings />  // Grows as files complete
│   │       ├── <FileReviewList />    // Files appear progressively
│   │       │   └── <ChunkReviewCard />
│   │       ├── <CommitMessage />     // Generated after all files done
│   │       └── <SuggestedTests />   // Generated after all files done
│   │
│   ├── [Mobile] <MobileTabBar />     // [📄 Diff] [📋 Review] — h-12 bottom bar
│   │   └── <LeftPanel (mobile)>
│   │       ├── "≡ filename ▲ Files"  // Trigger bar → opens bottom sheet
│   │       ├── <DiffViewer />
│   │       └── <FileTree />          // Renders inside 70vh bottom sheet overlay
│   │
│   └── <StatusBar />                 // model name · agent progress · tok/s · ? shortcuts
│                                     // Hidden on mobile (bottom slot used by MobileTabBar)
```

---

## 4. Data Models

### 4.1 Core Types

```typescript
// --- Diff Parsing ---

interface FileDiff {
  filename: string;
  language: string;          // inferred from extension
  status: "added" | "deleted" | "modified" | "renamed";
  hunks: Hunk[];
  additions: number;
  deletions: number;
}

interface Hunk {
  header: string;            // @@ line
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: Change[];
}

interface Change {
  type: "add" | "del" | "normal";
  content: string;
  lineNumber: number;        // new file line number
  oldLineNumber?: number;    // old file line number
}

// --- Chunking ---

interface ReviewChunk {
  id: string;                // `${filename}:chunk-${index}`
  filename: string;
  language: string;
  hunkIndex: number;
  content: string;           // the diff text for this chunk
  context: string;           // surrounding unchanged lines for context
  tokenCount: number;        // estimated token count
  startLine: number;
  endLine: number;
}

// --- Agent System ---

interface AgentConfig {
  id: string;                // "bug" | "security" | "performance" | "summary"
  name: string;              // "Bug Reviewer" | "Security Auditor" | ...
  icon: string;              // emoji for UI display
  systemPrompt: string;      // role-specific system prompt
  categories: string[];      // issue categories this agent produces
  receivesPriorResults: boolean; // whether this agent reads earlier agents' output
}

interface AgentResult {
  agentId: string;
  agentName: string;
  issues: ReviewIssue[];
  summary: string;
  tokenCount: number;        // tokens used for this pass
  durationMs: number;        // inference time for this pass
}

// --- Review Results ---

interface ChunkReview {
  chunkId: string;
  filename: string;
  startLine: number;
  endLine: number;
  agentResults: AgentResult[];  // one result per agent pass
  mergedIssues: ReviewIssue[];  // deduplicated union of all agent issues
  summary: string;              // from summary agent (final pass)
}

interface ReviewIssue {
  severity: "info" | "warning" | "critical";
  category: "bug" | "security" | "performance" | "style" | "logic";
  line: number;              // line number in new file
  message: string;
  suggestion?: string;       // suggested fix
}

interface FileReviewStatus {
  filename: string;
  status: "pending" | "reviewing" | "done" | "error";
  chunksTotal: number;
  chunksCompleted: number;
}

interface FileReview {
  filename: string;
  chunks: ChunkReview[];
  riskScore: number;         // 0–10
  issueCount: { info: number; warning: number; critical: number };
}

interface DiffReview {
  files: FileReview[];
  overallRisk: number;       // 0–10 weighted average
  totalIssues: { info: number; warning: number; critical: number };
  securityFindings: ReviewIssue[];
  commitMessage: string;     // auto-generated conventional commit
  suggestedTests: string[];
  reviewedAt: string;        // ISO timestamp
  modelId: string;
  totalTokens: number;
  durationMs: number;
}

// --- App State ---

interface AppState {
  // Engine
  engineStatus: "idle" | "loading" | "ready" | "error";
  engineRef: MLCEngine | null;
  loadProgress: number;      // 0–100
  loadMessage: string;
  selectedModel: string;

  // Diff Input
  rawDiff: string;             // pasted by user
  files: FileDiff[];

  // Review (progressive)
  reviewStatus: "idle" | "reviewing" | "done" | "error";
  reviewQueue: ReviewChunk[];
  currentChunkIndex: number;
  currentAgentId: string | null;     // which agent is currently running
  agentStatuses: Map<string, "pending" | "running" | "done">; // per-agent status
  fileStatuses: Map<string, FileReviewStatus>;  // per-file progress
  fileReviews: Map<string, FileReview>;         // populated incrementally as files complete
  diffReview: DiffReview | null;                // finalized after all files done

  // Streaming
  streamingText: string;             // live token output from active agent
  streamingAgentId: string | null;   // which agent is producing streamingText
  tokensPerSecond: number;           // rolling average for StatusBar

  // UI
  selectedFile: string | null;
  rightPanelTab: "summary" | "security" | "tests" | "commit";
}
```

---

## 5. Module Architecture

```
src/
├── main.jsx                          // React root
├── App.jsx                           // Top-level router / screen switcher
├── config.js                         // Constants + STORAGE_KEYS
│
├── components/
│   ├── model/
│   │   ├── ModelLoader.jsx           // Model download screen
│   │   ├── ModelSelector.jsx         // Radio-card picker (5 models, cached badge)
│   │   ├── ModelSwitchDialog.jsx     // Mid-session switch modal
│   │   ├── NoWebGPU.jsx              // Shown when WebGPU unavailable
│   │   └── ProgressBar.jsx           // Reusable progress bar
│   │
│   ├── input/
│   │   ├── DiffInputArea.jsx         // Textarea + drag-drop + restore banner
│   │   ├── AgentProgress.jsx         // Multi-agent progress panel
│   │   ├── AgentStatusRow.jsx        // Single agent: icon + name + status
│   │   └── LargeDiffWarning.jsx      // Modal guard for large diffs
│   │
│   ├── diff/
│   │   ├── FileTree.jsx              // Flat list (default) or tree view; virtualised >40 files
│   │   ├── DiffViewer.jsx            // react-diff-view wrapper; lazy inline comments
│   │   └── InlineComment.jsx         // Comment widget anchored to diff lines
│   │
│   ├── review/
│   │   ├── RightPanel.jsx            // Tab router: Summary / Security / Tests / Commit
│   │   ├── ReviewSummary.jsx         // Risk score + issue counts (incremental)
│   │   ├── SecurityFindings.jsx      // Security issues list (filtered)
│   │   ├── FileReviewList.jsx        // Per-file expandable reviews
│   │   ├── ChunkReviewCard.jsx       // Single chunk review card (filtered)
│   │   ├── CommitMessage.jsx         // Generated commit message
│   │   ├── SuggestedTests.jsx        // Suggested test cases
│   │   └── ExportMenu.jsx            // Markdown / JSON / CSV download dropdown
│   │
│   ├── settings/
│   │   └── SettingsPanel.jsx         // Right-edge slide-over: Focus / Agents / Filters
│   │
│   ├── layout/
│   │   ├── SplitLayout.jsx           // Resizable split pane (desktop only)
│   │   ├── Header.jsx                // Stats · ExportMenu · ⚙ · New Review
│   │   ├── StatusBar.jsx             // Model name · agent progress · tok/s · ?
│   │   ├── Navbar.jsx                // Top bar (model badge + ModelSwitchDialog)
│   │   └── HeroSection.jsx           // Landing page hero wrapper
│   │
│   └── ui/
│       ├── Badge.jsx                 // Severity/risk badge
│       ├── Spinner.jsx               // Loading spinner
│       └── StreamingText.jsx         // Live token-by-token text display
│
├── lib/
│   ├── engine.js                     // WebLLM engine singleton
│   │   ├── createEngine(model, onProgress)
│   │   ├── getEngine()
│   │   ├── destroyEngine()
│   │   └── isModelCached(modelId) → Promise<boolean>
│   │
│   ├── models.js                     // Static catalog: 5 MLC models with metadata
│   │
│   ├── diffParser.js                 // Unified diff → structured data
│   │   ├── parseDiff(raw) → FileDiff[]
│   │   └── inferLanguage(filename) → string
│   │
│   ├── chunker.js                    // Semantic chunking logic
│   │   ├── chunkFile(fileDiff) → ReviewChunk[]
│   │   ├── estimateTokens(text) → number
│   │   ├── estimateTotalChunks(files) → number
│   │   └── splitAtBoundaries(hunk) → ReviewChunk[]
│   │
│   ├── agents.js                     // Agent definitions + pipeline orchestration
│   │   ├── AGENTS: AgentConfig[]
│   │   ├── AGENT_IDS: string[]
│   │   ├── runAgentOnChunk(engine, agent, chunk, prior, callbacks, signal, focusContext)
│   │   ├── runAgentPipeline(engine, chunk, callbacks, signal, options) → ChunkReview
│   │   └── mergeAgentResults(results) → ReviewIssue[]
│   │
│   ├── reviewer.js                   // Top-level review orchestration
│   │   ├── reviewDiff(engine, files, callbacks) → DiffReview
│   │   ├── chunkFileAsync(fileDiff) → Promise<ReviewChunk[]>  // uses chunker worker
│   │   └── cancelCurrentReview()
│   │
│   ├── scoring.js                    // Risk score calculation
│   │   ├── calculateFileRisk(issues) → number
│   │   ├── calculateOverallRisk(fileReviews, files) → number
│   │   └── countBySeverity(issues) → { info, warning, critical }
│   │
│   ├── prompts.js                    // LLM prompt templates
│   │   ├── buildChunkPrompt(chunk, focusContext) → string
│   │   ├── COMMIT_MESSAGE_PROMPT
│   │   └── TEST_SUGGESTION_PROMPT
│   │
│   ├── export.js                     // Export helpers (no React deps)
│   │   ├── toMarkdown(diffReview, fileReviews) → string
│   │   ├── toJSON(diffReview, fileReviews) → string
│   │   ├── toCSV(diffReview, fileReviews) → string
│   │   └── triggerDownload(content, filename, mime)
│   │
│   └── persist.js                    // localStorage save/restore
│       ├── saveReview({ rawDiff, files, diffReview, fileReviews }) → { ok }
│       ├── loadSavedReview() → SavedReview | null
│       └── clearSavedReview()
│
├── workers/
│   ├── diffParser.worker.js          // parseDiff off main thread (Vite module worker)
│   └── chunker.worker.js             // chunkFile off main thread
│
├── hooks/
│   ├── useKeyboardShortcuts.js       // j/k/r/n/Escape; j/k debounced 150ms
│   ├── useIssueFilters.js            // filterIssues(issues) + isFiltered from store
│   └── useBreakpoint.js             // matchMedia(max-width: 767px) → { isMobile }
│
├── store/
│   └── useStore.js                   // Zustand store — 5 slices (see Section 7)
│
└── styles/
    ├── index.css                     // Global styles + Tailwind base
    └── diff.css                      // react-diff-view theme overrides
```

---

## 6. Key Modules — Detailed Design

### 6.1 Diff Input (`components/input/DiffInputArea.jsx`)

```
Input:  User pastes raw unified diff text into a textarea
Output: rawDiff string stored in Zustand → triggers parsing

UI:
  - Full-width textarea, monospace font, ~60vh tall
  - Placeholder text showing expected format:
    "Paste your unified diff here...
     (output of `git diff`, `git diff --staged`, or a GitHub PR .diff)"
  - "Review" button (disabled until textarea has content)
  - "Clear" button to reset
  - Drag-and-drop support: user can drop a .diff / .patch file
  - Character/line count indicator below textarea

Validation:
  1. Check that pasted text contains at least one `diff --git` or `---`/`+++` header
  2. If not valid unified diff format, show inline error:
     "This doesn't look like a unified diff. Try running `git diff` in your repo."
  3. On valid input + click "Review":
     a. Store rawDiff in Zustand
     b. Parse via lib/diffParser.js
     c. Transition to Reviewing screen
```

### 6.2 Diff Parsing (`lib/diffParser.js`)

```
Input:  raw unified diff string
Output: FileDiff[]

Library: parse-diff (npm)
  - parse(diffString) → Array<{ from, to, chunks, additions, deletions }>
  - Each chunk has: content (header), changes[]
  - Each change has: type (add/del/normal), content, ln/ln1/ln2

Post-processing:
  1. Normalize parse-diff output → our FileDiff type
  2. Detect file status (added/deleted/modified/renamed)
  3. Infer language from file extension
  4. Filter out binary files and lock files
```

### 6.3 Semantic Chunking (`lib/chunker.js`)

```
Goal: Split file diffs into chunks of 500–800 tokens that align
      with logical code boundaries.

Token estimation:
  - Simple heuristic: ~4 chars per token (works for English + code)
  - More precise: split on whitespace + punctuation, count segments
  - Target: 500–800 tokens per chunk (leaving ~200 tokens for prompt
    framing + ~500 tokens for model response)

Algorithm:
  1. For each FileDiff, iterate hunks
  2. If a single hunk fits within token budget → one chunk
  3. If a hunk exceeds budget, split at:
     a. Function/class declarations (regex: /^[\+\-]\s*(function|class|const|def|pub fn)/)
     b. Blank lines between logical blocks
     c. Hard split at token limit (last resort)
  4. Each chunk includes:
     - The diff content (added/removed/context lines)
     - 3–5 lines of surrounding context (unchanged lines)
     - File metadata (name, language)

Edge cases:
  - Single-line changes: group adjacent single-line changes into one chunk
  - Huge files (>50 hunks): cap at first 30 hunks, warn user
  - Non-code files (md, json, yaml): use simpler line-based chunking
```

### 6.4 Multi-Agent Architecture (`lib/agents.js`)

**Core idea:** One WebLLM model, multiple "agent" personas via different system
prompts. Each agent is a focused pass over the same code chunk. Later agents
receive earlier agents' findings as additional context (agent memory).

This is the same pattern used by Cursor, Devin (Cognition Labs), and Sourcegraph —
simulating multiple agents without running multiple models, saving GPU memory,
inference time, and context tokens.

```
Agent pipeline per chunk:

  ┌─────────────┐
  │  Bug Agent   │  Pass 1 — logic errors, bugs, edge cases
  └──────┬───────┘
         │ output
         ▼
  ┌──────────────┐
  │Security Agent│  Pass 2 — XSS, injection, eval, secrets
  │ reads: Bug   │  (receives Bug Agent's findings as context)
  └──────┬───────┘
         │ output
         ▼
  ┌──────────────┐
  │ Perf Agent   │  Pass 3 — N+1, unnecessary re-renders, memory
  │ reads: Bug,  │  (receives Bug + Security findings)
  │   Security   │
  └──────┬───────┘
         │ output
         ▼
  ┌──────────────┐
  │Summary Agent │  Pass 4 — merges all, deduplicates, ranks
  │ reads: all 3 │  (produces final ChunkReview)
  └──────────────┘

Agent definitions:

  const AGENTS: AgentConfig[] = [
    {
      id: "bug",
      name: "Bug Reviewer",
      icon: "🔍",
      systemPrompt: BUG_AGENT_PROMPT,
      categories: ["bug", "logic"],
      receivesPriorResults: false
    },
    {
      id: "security",
      name: "Security Auditor",
      icon: "🔒",
      systemPrompt: SECURITY_AGENT_PROMPT,
      categories: ["security"],
      receivesPriorResults: true
    },
    {
      id: "performance",
      name: "Performance Reviewer",
      icon: "⚡",
      systemPrompt: PERFORMANCE_AGENT_PROMPT,
      categories: ["performance"],
      receivesPriorResults: true
    },
    {
      id: "summary",
      name: "Summary Agent",
      icon: "🧠",
      systemPrompt: SUMMARY_AGENT_PROMPT,
      categories: [],           // doesn't produce new issues
      receivesPriorResults: true
    }
  ];

Key functions:

  runAgentOnChunk(engine, agent, chunk, priorResults?, callbacks?) → AgentResult
    1. Build messages array:
       - system: agent.systemPrompt
       - user: chunk content + (if receivesPriorResults) serialized prior findings
    2. Call engine.chat.completions.create({ messages, stream: true })
    3. For each streamed token:
       - Call callbacks.onToken(token) → pushes to store.streamingText
       - UI renders token immediately via <StreamingText />
    4. Parse complete JSON response → AgentResult

  runAgentPipeline(engine, chunk) → ChunkReview
    1. priorResults = []
    2. For each agent in AGENTS:
       a. result = runAgentOnChunk(engine, agent, chunk, priorResults)
       b. priorResults.push(result)
       c. Update progress callback
    3. mergedIssues = mergeAgentResults(priorResults)  // deduplicate
    4. summary = last agent's (Summary) summary
    5. Return ChunkReview { agentResults, mergedIssues, summary }

  mergeAgentResults(results: AgentResult[]) → ReviewIssue[]
    1. Collect all issues from Bug, Security, Performance agents
    2. Deduplicate by (line + category) — keep highest severity
    3. Sort by line number
    4. Return merged array
```

### 6.5 LLM Review Orchestration (`lib/reviewer.js`) — Progressive

```
Input:  WebLLM engine + FileDiff[]
Output: DiffReview (built incrementally)

Callbacks:
  onToken(token: string)             // streamed token from active agent
  onAgentComplete(agentId, result)   // one agent pass finished
  onFileComplete(filename, review)   // all chunks for a file done → push to UI
  onProgress({ chunkIndex, totalChunks, agentId, filename })

Flow (file-by-file progressive):
  1. Group chunks by file: Map<filename, ReviewChunk[]>
  2. For each FILE (sequential):
     a. Set fileStatus → "reviewing"
     b. For each chunk in file:
        - Run agent pipeline: runAgentPipeline(engine, chunk, { onToken })
          → 4 sequential agent passes, tokens stream to UI during each
        - After each agent: onAgentComplete(agentId, result)
        - After all 4 agents: store ChunkReview
     c. Aggregate file's ChunkReviews → FileReview
     d. Calculate file risk score
     e. Set fileStatus → "done"
     f. ── onFileComplete(filename, fileReview) ──
        UI immediately:
          ✓ Shows file as reviewed in FileTree
          ✓ Renders inline comments in DiffViewer (if file selected)
          ✓ Adds file to FileReviewList in right panel
          ✓ Updates running risk score in ReviewSummary
          ✓ Appends security findings to SecurityFindings panel
  3. After ALL files done:
     a. Generate commit message (separate LLM call, tokens stream)
     b. Generate suggested tests (separate LLM call, tokens stream)
     c. Finalize DiffReview with overall risk, totals
     d. Set reviewStatus → "done"
  4. Return DiffReview

The user never waits for the full review to finish. They can browse
reviewed files, read inline comments, and see the risk score evolve
while later files are still being analyzed.
```

### 6.6 Prompt Templates (`lib/prompts.js`)

Each agent has a focused system prompt. All prompts enforce the same JSON
response format for consistent parsing.

**Shared JSON format (enforced in all agent prompts):**
```
Respond with ONLY a valid JSON object (no markdown, no extra text):
{
  "issues": [
    {
      "severity": "info" | "warning" | "critical",
      "category": "bug" | "security" | "performance" | "style" | "logic",
      "line": <line_number_in_new_file>,
      "message": "<concise description>",
      "suggestion": "<how to fix, or null>"
    }
  ],
  "summary": "<1-2 sentence summary>"
}
If no issues found, return {"issues": [], "summary": "..."}.
```

**Bug Agent Prompt (`BUG_AGENT_PROMPT`):**
```
You are a senior Bug Reviewer. Your ONLY job is to find logic errors,
bugs, and edge cases in code diffs. Ignore style, performance, and
security — other reviewers handle those.

Focus on:
- Off-by-one errors, null/undefined access, wrong variable usage
- Missing error handling, uncaught exceptions
- Race conditions, state mutation bugs
- Incorrect conditionals, unreachable code
- Type mismatches, wrong function signatures

{shared_json_format}
```

**Security Agent Prompt (`SECURITY_AGENT_PROMPT`):**
```
You are a senior Security Auditor. Your ONLY job is to find security
vulnerabilities in code diffs. Ignore style, performance, and general
bugs — other reviewers handle those.

Focus on:
- XSS (innerHTML, dangerouslySetInnerHTML, unescaped output)
- Injection (SQL concat, shell exec, eval(), Function())
- Prototype pollution (__proto__, Object.assign from user input)
- Hardcoded secrets (API keys, tokens, passwords in source)
- Path traversal (unsanitized file paths, .. in user input)
- Auth issues (missing checks, JWT not verified, no CSRF)
- Unsafe deserialization, open redirects

A prior Bug Reviewer found these issues (use as context, do NOT repeat them):
{prior_bug_findings}

{shared_json_format}
```

**Performance Agent Prompt (`PERFORMANCE_AGENT_PROMPT`):**
```
You are a senior Performance Reviewer. Your ONLY job is to find
performance problems in code diffs. Ignore style, security, and
general bugs — other reviewers handle those.

Focus on:
- N+1 queries, missing pagination, unbounded loops
- Unnecessary re-renders (React), missing memoization
- Memory leaks (event listeners, intervals not cleared)
- Synchronous blocking operations, missing async/await
- Large bundle imports that could be lazy-loaded
- Inefficient data structures or algorithms

Prior reviewers found these issues (use as context, do NOT repeat them):
{prior_findings}

{shared_json_format}
```

**Summary Agent Prompt (`SUMMARY_AGENT_PROMPT`):**
```
You are a Summary Agent. You receive a code diff chunk and findings
from 3 specialist reviewers (Bug, Security, Performance).

Your job:
1. Write a 1-2 sentence summary of this chunk's changes and overall quality
2. If any findings are duplicates or contradict each other, resolve them
3. Return the final deduplicated issues list

Bug findings:    {bug_findings}
Security findings: {security_findings}
Performance findings: {performance_findings}

{shared_json_format}
```

**Commit Message Prompt:**
```
Based on the following diff summary, generate a conventional commit
message (type: feat|fix|refactor|docs|style|test|chore).
Keep subject under 72 chars. Add body if needed.

Files changed:
{file_summaries}

Respond with ONLY the commit message, no extra text.
```

### 6.7 Risk Scoring (`lib/scoring.js`)

```
Per-file risk score (0–10):
  score = Σ (issue.severity_weight × issue.category_weight) / max_possible
  Clamped to [0, 10]

Severity weights:
  critical: 5
  warning:  2
  info:     0.5

Category multipliers:
  security:    2.0
  bug:         1.5
  logic:       1.2
  performance: 1.0
  style:       0.5

Overall PR risk:
  weighted_avg = Σ (file_risk × file_change_size) / Σ file_change_size
  Boosted if any critical security finding exists: min(10, weighted_avg + 3)

Risk labels:
  0–3:  Low    (green badge)
  4–6:  Medium (yellow badge)
  7–10: High   (red badge)
```

---

## 7. State Management

**Library: Zustand 5** — lightweight, no boilerplate, works with React 19.

```
Store slices (src/store/useStore.js):

engineSlice:
  - engineStatus: 'idle' | 'loading' | 'ready' | 'error'
  - loadProgress, loadMessage, selectedModel
  - actions: initEngine(), resetEngine(), setModel(id), switchModel(id)
    switchModel() cancels active review, destroys engine, resets all state

diffSlice:
  - rawDiff, files: FileDiff[]
  - actions: setDiff(raw), parseDiff() [async — uses diffParser worker], clearDiff()

reviewSlice:
  - reviewStatus: 'idle' | 'reviewing' | 'done' | 'error'
  - currentChunkIndex, currentAgentId
  - agentStatuses: Map<agentId, { status, issueCount }>
  - fileStatuses:  Map<filename, 'pending'|'reviewing'|'done'>
  - fileReviews:   Map<filename, FileReview>  ← grows as files complete
  - diffReview:    DiffReview | null          ← finalized after all files done
  - streamingText, tokensPerSecond, reviewWarnings
  - actions:
    - initReview()                // runs reviewDiff; handles progress callbacks
    - cancelReview()              // calls cancelCurrentReview() in reviewer.js
    - restoreReview({ rawDiff, files, diffReview, fileReviews })
    - appendFileReview(filename, review)
    - appendStreamingToken(token)
    - clearStreamingText()

settingsSlice:
  - focusContext: string        ← persisted to localStorage
  - enabledAgents: Set<string>  ← persisted; defaults to all 4 agent IDs
  - issueFilters: { minSeverity, categories[] }  ← persisted
  - settingsOpen: boolean
  - actions:
    - setFocusContext(text), toggleAgent(agentId), setIssueFilters(patch)
    - setSettingsOpen(open), resetSettings()

uiSlice:
  - selectedFile, rightPanelTab, splitRatio
  - selectedFiles: Set<string>  ← which files are checked for review
  - actions:
    - selectFile(file), setTab(tab), setSplitRatio(ratio)
    - initSelectedFiles(filenames), toggleFileSelection(filename)
    - selectAllFiles(), deselectAllFiles()
```

---

## 8. Dependencies

### Runtime dependencies

| Package                    | Purpose                              | Size (gzip) |
| -------------------------- | ------------------------------------ | ----------- |
| `@mlc-ai/web-llm`          | Local LLM inference (WebGPU)         | ~2 MB       |
| `react` / `react-dom`      | UI framework                         | ~45 KB      |
| `zustand`                  | State management                     | ~1 KB       |
| `parse-diff`               | Unified diff parsing                 | ~3 KB       |
| `react-diff-view`          | Diff rendering component             | ~15 KB      |
| `unidiff`                  | Tokenize diff for react-diff-view    | ~4 KB       |
| `@tanstack/react-virtual`  | Row virtualization for FileTree      | ~3 KB       |

### Dev / build dependencies

| Package             | Purpose                             |
| ------------------- | ----------------------------------- |
| `vite`              | Build tool + HMR                    |
| `@vitejs/plugin-react` | React Fast Refresh              |
| `tailwindcss`       | Utility-first CSS (build-time only) |
| `@tailwindcss/vite` | Tailwind Vite integration           |
| `eslint`            | Linting                             |

### Web Workers (bundled by Vite, no extra packages)

| Worker file                         | Wraps             | Emitted chunk |
| ----------------------------------- | ----------------- | ------------- |
| `src/workers/diffParser.worker.js`  | `parseDiff()`     | `diffParser.worker-*.js` |
| `src/workers/chunker.worker.js`     | `chunkFile()`     | `chunker.worker-*.js` |

---

## 9. Performance Strategy

### 9.1 Model Caching
- WebLLM caches model weights in IndexedDB after first download
- Engine singleton pattern: load once, reuse across reviews
- Show "Model ready" indicator when cached model detected

### 9.2 Token Budget
- Agent system prompt: ~150 tokens each (focused = shorter than a generic prompt)
- Prior findings context: ~100–300 tokens (grows per pass)
- Chunk content: 500–800 tokens (variable)
- Response budget: ~400 tokens
- Total per agent call: ~1200–1500 tokens max
- 4 agent passes per chunk: ~5000–6000 tokens total per chunk
- Phi-3.5-mini context window: 4096 tokens — each individual pass fits comfortably
- **Key:** each agent call is independent (no conversation history), so context
  window is never exhausted — only the current pass's messages are sent

### 9.3 Multi-Agent Performance
- 4 passes per chunk instead of 1 → ~4x inference time per chunk
- Trade-off: higher quality (focused agents) vs. longer review time
- Mitigation strategies:
  - Each agent prompt is shorter than a single "do everything" prompt
  - Focused prompts produce shorter, more precise responses
  - Summary agent handles deduplication (no post-processing needed)
  - Progress UI keeps user engaged: shows which agent is active
- Single model in GPU memory — no additional memory cost for multi-agent

### 9.4 Progressive Analysis

**Problem:** Local LLM inference is slow (10–30s per chunk with 4 agent passes).
Showing a loading spinner for minutes is unacceptable UX.

**Solution:** Progressive file-by-file delivery + token-level streaming.

```
Three levels of progressive feedback:

Level 1 — Token streaming (fastest feedback)
  Each agent pass streams tokens to <StreamingText /> in real-time.
  User sees the AI "thinking" — text appears character by character.
  Latency to first token: ~1-2 seconds.

Level 2 — Agent-level progress (every ~5-10 seconds)
  As each agent completes a chunk, its status row updates:
    ✓ Bug Reviewer — 1 issue found
    ⏳ Security Auditor analyzing...
  User sees momentum even between token streams.

Level 3 — File-level results (every ~20-60 seconds)
  When all chunks of a file are reviewed, full results appear:
    - FileTree marks file as ✓ reviewed
    - InlineComment widgets appear in DiffViewer
    - FileReviewList gains a new entry
    - ReviewSummary risk score updates
    - SecurityFindings panel grows
  User can browse completed files while others are still processing.
```

**Implementation:**
- `reviewDiff()` processes files sequentially (not all chunks mixed together)
- After each file completes, `onFileComplete` callback pushes `FileReview` to store
- Zustand's fine-grained subscriptions ensure only affected components re-render
- `streamingText` in store is updated per-token via `appendStreamingToken()`
- `StreamingText` component renders with a blinking cursor animation
- Between agent passes, `clearStreamingText()` resets for the next agent

**Perceived performance:**
- Without progressive: user waits 2+ minutes, sees nothing, gets full results
- With progressive: user sees first token in ~2s, first agent result in ~10s,
  first file results in ~30s, can interact with partial results immediately

### 9.5 Review Queue
- Sequential processing: files processed one at a time, chunks within each file
- File-ordered (not interleaved): all chunks of file A finish before file B starts
- This ensures `onFileComplete` fires as early as possible
- Cancel button works between agent passes (cleanest) or between chunks

### 9.6 Large Diff Handling
- Warn if diff has ≥15 files or ≥60 estimated chunks (`LargeDiffWarning` modal)
- Allow user to select/deselect files before starting review
- Skip binary files, lock files, and generated code automatically
- File extension blocklist: .lock, .min.js, .map, .svg, .png, etc.

### 9.7 Off-Main-Thread Processing (Phase 13)
- **Diff parsing**: `parseDiff()` runs in `diffParser.worker.js`; store action is async; sync fallback when `Worker` unavailable
- **Chunking**: all files chunked in parallel via `Promise.all(files.map(chunkFileAsync))`; each spawns `chunker.worker.js`
- **Inline comments**: `buildWidgets()` deferred via `requestIdleCallback(fn, { timeout: 500 })`; diff renders immediately, comments appear in idle time
- **FileTree virtualization**: `@tanstack/react-virtual` activates in flat mode when `files.length > 40`; only viewport rows in DOM
- **Keyboard debounce**: `j`/`k` navigation debounced 150ms to avoid rendering intermediary files during fast traversal

---

## 10. Security Analysis

The LLM prompt specifically instructs the model to flag:

| Category            | Examples                                            |
| ------------------- | --------------------------------------------------- |
| **XSS**             | `innerHTML`, `dangerouslySetInnerHTML`, unescaped output |
| **Injection**       | SQL string concat, shell exec with user input, `eval()` |
| **Unsafe eval**     | `eval()`, `Function()`, `setTimeout(string)`        |
| **Prototype pollution** | `Object.assign` from user input, `__proto__`    |
| **Secrets**         | Hardcoded API keys, tokens, passwords               |
| **Path traversal**  | Unsanitized file paths, `..` in user input          |
| **Auth issues**     | Missing auth checks, JWT not verified, no CSRF      |
| **Dependency risk** | Known vulnerable patterns, unsafe `npm` scripts     |

Security findings are elevated to the dedicated `SecurityFindings` panel regardless of which file they appear in.

---

## 11. Implementation Phases

All phases are complete. The table below summarises each phase's goal and outcome.

| Phase | Name | Goal | Status |
|---|---|---|---|
| 1 | Project Scaffolding & Tooling | Migrate to multi-screen architecture with Zustand, Tailwind, and WebLLM engine singleton | ✅ Complete |
| 2 | Diff Input & Parsing | Textarea input, drag-and-drop, `parse-diff` integration, file tree display | ✅ Complete |
| 3 | Diff Viewer | `react-diff-view` integration, resizable split-pane layout, header, status bar | ✅ Complete |
| 4 | Multi-Agent Review Pipeline | 4-agent pipeline (Bug → Security → Performance → Summary), token streaming, progressive file-by-file results | ✅ Complete |
| 5 | Review Results UI | Summary tab, security findings panel, inline comments anchored to diff lines, risk score display | ✅ Complete |
| 6 | Polish & Hardening | Large diff warning, file selection, keyboard shortcuts, review persistence (localStorage) | ✅ Complete |
| 7 | Model Selector & Management | 5-model catalog, mid-session model switching, cache detection, `ModelSwitchDialog` | ✅ Complete |
| 10 | Export & Reports | Markdown / JSON / CSV download, copy-to-clipboard, `ExportMenu` component | ✅ Complete |
| 11 | Prompt Customization & Agent Control | `SettingsPanel` with Focus context, per-agent toggles, severity/category filters persisted across sessions | ✅ Complete |
| 12 | Responsive Layout & Mobile | Full 375px+ support: bottom tab bar, 70vh file tree bottom sheet, compact header | ✅ Complete |
| 13 | Performance & Scale | Web Workers for diff parsing and chunking, FileTree virtualisation (>40 files), lazy inline comments via `requestIdleCallback`, keyboard debounce | ✅ Complete |

---

## 12. Non-Goals

- Multi-model comparison (run the same diff through two models side-by-side)
- Posting review comments back to GitHub (requires OAuth + GitHub API)
- AST-based chunking (regex-based boundary detection is sufficient)
- Collaborative review (single user, local only)
- Review history browsing (IndexedDB-backed; deferred — export covers the immediate need)
- GitHub PR URL fetching (CORS + private repo complexity; paste workflow is adequate)
