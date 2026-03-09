import * as webllm from '@mlc-ai/web-llm'

let _engine = null

export async function createEngine(model, onProgress) {
  _engine = await webllm.CreateMLCEngine(model, {
    initProgressCallback: onProgress,
  })
  return _engine
}

export function getEngine() {
  return _engine
}

export function destroyEngine() {
  _engine = null
}

export async function isModelCached(model) {
  try {
    return await webllm.hasModelInCache(model)
  } catch {
    return false
  }
}
