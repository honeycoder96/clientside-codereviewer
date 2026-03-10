export const DEFAULT_MODEL = 'qwen2.5-coder:7b'
export const FALLBACK_MODEL = 'llama3.2:3b'

export const SUGGESTED_MODELS = [
  { name: 'qwen2.5-coder:7b',    description: 'Best for code review, strong reasoning' },
  { name: 'llama3.2:3b',         description: 'Fastest, smallest download (~2 GB)' },
  { name: 'llama3.1:8b',         description: 'Best for large complex diffs' },
  { name: 'mistral:7b',          description: 'Strong general reasoning' },
  { name: 'deepseek-coder:6.7b', description: 'Alternative code specialist' },
]
