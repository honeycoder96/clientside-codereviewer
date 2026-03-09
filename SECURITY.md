# Security Policy

## Architecture

WebGPU Code Reviewer is a fully client-side application. All LLM inference runs locally on the user's GPU via WebGPU — no code or diffs are ever sent to external servers.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue for security vulnerabilities.
2. Email the maintainers at **contact@honeyhimself.com** with:
   - A description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive an acknowledgement within 48 hours.
4. A fix will be prioritized and released as soon as possible.

## Scope

Since this is a client-side-only application with no backend, the primary security concerns are:

- **XSS via LLM output** — LLM-generated review comments are rendered in the UI. Output is sanitized before display: Unicode control characters, zero-width characters, BiDi overrides, and BOM are stripped via `src/lib/parseResponse.js`. Text is rendered as plain string content (not `innerHTML`), so HTML injection is not possible.
- **localStorage persistence** — Review data (including pasted diffs) is stored in the browser's localStorage in plaintext. Users on shared computers should clear their review data when done.
- **Dependency supply chain** — We pin dependency versions and review updates before merging.

## Data Privacy

- Zero-server architecture: all processing happens locally
- No telemetry, analytics, or tracking
- No data leaves the browser
- Model weights are cached in IndexedDB by WebLLM
