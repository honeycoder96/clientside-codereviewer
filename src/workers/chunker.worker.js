import { chunkFile } from '../lib/chunker.js'

self.onmessage = ({ data: { fileDiff } }) => {
  try {
    const chunks = chunkFile(fileDiff)
    self.postMessage({ chunks })
  } catch (err) {
    self.postMessage({ chunks: [], error: err.message })
  }
}
