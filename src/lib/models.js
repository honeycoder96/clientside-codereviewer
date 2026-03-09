/**
 * Static catalog of supported MLC-compiled models.
 * All models are compatible with @mlc-ai/web-llm and run fully in-browser.
 */
export const MODELS = [
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    name: 'Phi-3.5 Mini',
    sizeGB: 2.2,
    contextK: 4,
    vramGB: 3,
    description: 'Fast and compact. Good default for most diffs.',
    tags: [],
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 3B',
    sizeGB: 1.8,
    contextK: 4,
    vramGB: 2.5,
    description: 'Smallest download. Use when speed matters most.',
    tags: [],
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.1 8B',
    sizeGB: 4.9,
    contextK: 8,
    vramGB: 6,
    description: 'Larger context window. Better for complex, multi-file diffs.',
    tags: [],
  },
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f16_1-MLC',
    name: 'Mistral 7B',
    sizeGB: 4.1,
    contextK: 8,
    vramGB: 5,
    description: 'Strong reasoning. Good balance of size and quality.',
    tags: [],
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 Coder 7B',
    sizeGB: 4.3,
    contextK: 8,
    vramGB: 5.5,
    description: 'Purpose-built for code review. Highest quality results.',
    tags: ['best-for-code'],
  },
]

export const DEFAULT_MODEL_ID = 'Phi-3.5-mini-instruct-q4f16_1-MLC'

export function getModelById(id) {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}
