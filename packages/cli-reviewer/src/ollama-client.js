// ---------------------------------------------------------------------------
// Custom error types
// ---------------------------------------------------------------------------

export class OllamaNotRunningError extends Error {
  constructor(host) {
    super(`Ollama is not running at ${host}. Start it with: ollama serve`)
    this.name = 'OllamaNotRunningError'
  }
}

export class ModelNotPulledError extends Error {
  constructor(model) {
    super(`Model "${model}" not found locally. Pull it with: ollama pull ${model}`)
    this.name = 'ModelNotPulledError'
  }
}

export class OllamaTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`Ollama request timed out after ${timeoutMs / 1000}s. Try increasing --timeout`)
    this.name = 'OllamaTimeoutError'
  }
}

// ---------------------------------------------------------------------------
// Ollama client
// ---------------------------------------------------------------------------

export class OllamaClient {
  /**
   * @param {object} opts
   * @param {string} opts.model     — Ollama model name (e.g. 'qwen2.5-coder:7b')
   * @param {string} opts.host      — Base URL (e.g. 'http://localhost:11434')
   * @param {number} opts.timeout   — Per-request timeout in ms
   */
  constructor({ model, host = 'http://localhost:11434', timeout = 120_000 } = {}) {
    this.model   = model
    this.host    = host.replace(/\/$/, '')
    this.timeout = timeout

    // Expose the interface agents.js expects:
    // engine.chat.completions.create(...)
    this.chat = {
      completions: {
        create: (params) => this._create(params),
      },
    }
  }

  // ---------------------------------------------------------------------------
  // Preflight — call once before starting a review
  // ---------------------------------------------------------------------------

  async preflight() {
    let res
    try {
      const signal = AbortSignal.timeout(5_000)
      res = await fetch(`${this.host}/api/tags`, { signal })
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        throw new OllamaNotRunningError(this.host)
      }
      // ECONNREFUSED and similar
      throw new OllamaNotRunningError(this.host)
    }

    if (!res.ok) {
      throw new OllamaNotRunningError(this.host)
    }

    const data = await res.json()
    const models = (data.models ?? []).map((m) => m.name)

    // Ollama returns names like "qwen2.5-coder:7b" or just "llama3.2"
    const isAvailable = models.some(
      (m) => m === this.model || m.startsWith(this.model + ':') || m.startsWith(this.model.split(':')[0])
    )

    if (!isAvailable) {
      throw new ModelNotPulledError(this.model)
    }
  }

  // ---------------------------------------------------------------------------
  // List models — for `cr models` subcommand
  // ---------------------------------------------------------------------------

  async listModels() {
    const signal = AbortSignal.timeout(5_000)
    const res = await fetch(`${this.host}/api/tags`, { signal })
    if (!res.ok) throw new OllamaNotRunningError(this.host)
    const data = await res.json()
    return data.models ?? []
  }

  // ---------------------------------------------------------------------------
  // chat.completions.create — streaming generator matching OpenAI shape
  // ---------------------------------------------------------------------------

  async _create({ messages, stream = true, max_tokens }) {
    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), this.timeout)

    let res
    try {
      res = await fetch(`${this.host}/api/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:    this.model,
          messages,
          stream:   true,
          options:  max_tokens ? { num_predict: max_tokens } : undefined,
        }),
        signal: controller.signal,
      })
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError') throw new OllamaTimeoutError(this.timeout)
      throw new OllamaNotRunningError(this.host)
    }

    if (!res.ok) {
      clearTimeout(timeoutId)
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`)
    }

    // Return an async iterable that yields OpenAI-shaped chunks
    return this._streamResponse(res, controller, timeoutId)
  }

  async * _streamResponse(res, controller, timeoutId) {
    try {
      const decoder = new TextDecoder()
      let buffer = ''

      for await (const rawChunk of res.body) {
        buffer += decoder.decode(rawChunk, { stream: true })

        // Ollama sends newline-delimited JSON blobs
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          let blob
          try {
            blob = JSON.parse(trimmed)
          } catch {
            continue
          }

          if (blob.error) {
            throw new Error(`Ollama error: ${blob.error}`)
          }

          const content = blob.message?.content ?? ''
          if (content) {
            yield { choices: [{ delta: { content } }] }
          }

          if (blob.done) return
        }
      }

      // Flush any remaining buffer
      if (buffer.trim()) {
        try {
          const blob = JSON.parse(buffer.trim())
          const content = blob.message?.content ?? ''
          if (content) yield { choices: [{ delta: { content } }] }
        } catch { /* ignore */ }
      }
    } finally {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }
}
