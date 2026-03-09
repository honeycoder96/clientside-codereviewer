# Contributing to WebGPU Local Code Reviewer

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js 18+** (20 recommended)
- **Chrome 113+** or **Edge 113+** with WebGPU enabled
- **4+ GB GPU VRAM** for running the model locally
- **Git**

## Setup

```bash
# Fork the repo on GitHub, then clone your fork
git clone https://github.com/<your-username>/webgpu-llm.git
cd webgpu-llm

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at [http://localhost:5173](http://localhost:5173).

On first load, you'll need to download the Phi-3.5-mini model (~2.2 GB). This is cached in IndexedDB and only needs to happen once.

## Project Layout

```
src/
├── lib/            # Core logic — no React, no DOM
│   ├── engine.js         WebLLM engine singleton
│   ├── diffParser.js     Unified diff → FileDiff[]
│   ├── chunker.js        Semantic chunking
│   ├── agents.js         Multi-agent pipeline
│   ├── prompts.js        LLM prompt templates
│   ├── parseResponse.js  JSON extraction from LLM output
│   ├── scoring.js        Risk score calculation
│   ├── reviewer.js       Review orchestration
│   └── persist.js        localStorage persistence
├── store/
│   └── useStore.js       Zustand store (4 slices + actions)
├── components/
│   ├── model/      Model loading, WebGPU detection
│   ├── input/      Diff input, agent progress UI
│   ├── diff/       File tree, diff viewer, inline comments
│   ├── review/     Results tabs (summary, security, tests, commit)
│   ├── layout/     Header, status bar, split pane
│   └── ui/         Shared primitives (Badge, Spinner, StreamingText)
├── hooks/          Custom React hooks
└── styles/         CSS files (diff viewer theme)
```

### Key architectural notes

- **`src/lib/`** contains framework-agnostic logic. These modules should not import React or Zustand. They receive dependencies (like the engine instance) as function arguments.
- **Zustand store** uses 4 slices (`engineSlice`, `diffSlice`, `reviewSlice`, `uiSlice`) combined in a single store. Use fine-grained selectors (`useStore(s => s.specificField)`) to avoid unnecessary re-renders.
- **Components** are plain JSX (not TypeScript). Keep components focused — one responsibility per file.

## Development Workflow

### Branching

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bugfix
   ```

2. Make your changes in small, focused commits.

3. Push and open a pull request against `main`.

### Branch naming

| Prefix | Use |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring (no behavior change) |
| `docs/` | Documentation only |
| `perf/` | Performance improvements |

### Commit messages

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat(review): add export to markdown
fix(chunker): handle empty hunks without crashing
refactor(store): split review slice into smaller functions
docs: update README with new keyboard shortcuts
```

## Code Style

### General

- **No TypeScript** — the project uses plain JavaScript with JSX. Add JSDoc comments for complex function signatures if helpful.
- **Tailwind CSS** for all styling. Avoid inline styles and custom CSS unless absolutely necessary (the diff viewer theme in `src/styles/diff.css` is an exception).
- **No `var`** — use `const` by default, `let` only when reassignment is needed.
- **Named exports** preferred over default exports for `src/lib/` modules.

### Linting

```bash
npm run lint
```

Fix all lint errors before submitting a PR. The project uses ESLint with React-specific plugins.

### File conventions

- Components: PascalCase filenames (`ReviewSummary.jsx`)
- Modules: camelCase filenames (`diffParser.js`)
- Hooks: `use` prefix (`useKeyboardShortcuts.js`)
- One component per file

## Testing Changes

There is no automated test suite yet — this is an area where contributions are welcome.

For manual testing:

1. **Get a diff** — run `git diff` on any repository, or download a `.diff` from a GitHub PR
2. **Paste into the app** — verify parsing, file tree, and diff viewer work correctly
3. **Run a review** — confirm agents run sequentially, streaming works, and results appear progressively
4. **Check edge cases:**
   - Empty diff
   - Single-file diff
   - Large diff (15+ files)
   - Binary file changes
   - Malformed input (not a valid diff)
5. **Verify the build:**
   ```bash
   npm run build
   npm run preview
   ```

## Areas Where Help Is Needed

See [`spec/FUTURE_ENHANCEMENTS.md`](./spec/FUTURE_ENHANCEMENTS.md) for detailed specs on all planned phases. High-impact contributions:

- **Export & Reports** (Phase 10) — download reviews as Markdown/JSON/CSV
- **GitHub PR Integration** (Phase 8) — paste a PR URL to fetch the diff automatically
- **Automated tests** — unit tests for `src/lib/` modules (chunker, scoring, parseResponse)
- **Accessibility** — keyboard navigation, screen reader support, ARIA labels
- **Performance** (Phase 13) — virtualized file tree, Web Worker for chunking

## Submitting a Pull Request

1. Make sure `npm run lint` passes
2. Make sure `npm run build` succeeds
3. Test your changes manually in Chrome or Edge
4. Write a clear PR description:
   - What does this change do?
   - Why is it needed?
   - How did you test it?
5. Keep PRs focused — one feature or fix per PR

## Reporting Issues

When filing a bug report, include:

- Browser and version
- GPU model (check `chrome://gpu`)
- Steps to reproduce
- Expected vs. actual behavior
- Console errors (if any)

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to build something useful.
