# cr-reviewer

Local AI code reviewer powered by Ollama. Zero server costs. Code never leaves your machine.

## Prerequisites

| Requirement | Minimum | Install |
|---|---|---|
| Node.js | 18.0.0 | [nodejs.org](https://nodejs.org) |
| Ollama | latest | [ollama.com](https://ollama.com) |

## Installation

**Global install (recommended)**
```bash
npm install -g cr-reviewer
```

**One-off with npx**
```bash
npx cr-reviewer review my.diff
```

**From source**
```bash
git clone https://github.com/AESiR-0/webgpu-llm.git
cd webgpu-llm/packages/cli-reviewer
npm install
npm link
```

## First-time setup

```bash
# 1. Start Ollama
ollama serve

# 2. Pull a model (one-time download ~4 GB)
ollama pull qwen2.5-coder:7b

# 3. Run your first review
git diff main...feature | cr review - --output review.md
```

## Usage

```bash
# Review a diff file
cr review my.diff

# Read from stdin (pipe from git)
git diff --cached | cr review -

# Write to file
cr review my.diff --format md --output review.md

# Check Ollama status
cr status

# List available models
cr models
```

## All flags

| Flag | Default | Description |
|---|---|---|
| `--model, -m` | `qwen2.5-coder:7b` | Ollama model name |
| `--host` | `http://localhost:11434` | Ollama base URL |
| `--timeout` | `120000` | Per-request timeout (ms) |
| `--mode` | `fast` | `fast` (unified) or `deep` (3-agent sequential) |
| `--agents` | `bug,security,performance` | Comma-separated agents to enable |
| `--focus` | `""` | Context injected into every prompt |
| `--profile` | none | `security-audit`, `critical-only`, `performance`, `show-all` |
| `--format, -f` | `md` | `md`, `json`, `csv`, `sarif`, `pr-desc` |
| `--output, -o` | stdout | Write to file instead of stdout |
| `--min-severity` | `info` | Filter: `info`, `warning`, `critical` |
| `--stream` | `false` | Print LLM tokens live |
| `--quiet, -q` | `false` | Suppress progress (CI mode) |
| `--verbose, -v` | `false` | Show per-chunk timing |
| `--no-tests` | `false` | Skip test suggestion generation |
| `--no-commit-msg` | `false` | Skip commit message generation |

## Examples

```bash
# Security audit, JSON output
cr review feature.diff --profile security-audit --format json -o audit.json

# CI pipeline — SARIF for GitHub Code Scanning
git diff main...HEAD | cr review - --format sarif --output results.sarif --quiet

# Deep mode with focus context
cr review pr.diff --mode deep --focus "Go — check goroutine leaks"

# Stream tokens while reviewing
cr review my.diff --stream --verbose
```

## Suggested models

| Model | Description |
|---|---|
| `qwen2.5-coder:7b` | Best for code review (default) |
| `llama3.2:3b` | Fastest, smallest (~2 GB) |
| `llama3.1:8b` | Best for large complex diffs |
| `mistral:7b` | Strong general reasoning |
| `deepseek-coder:6.7b` | Alternative code specialist |
