import { parseDiff } from '../lib/diffParser.js'

self.onmessage = ({ data: { rawDiff } }) => {
  try {
    const files = parseDiff(rawDiff)
    self.postMessage({ files })
  } catch (err) {
    self.postMessage({ files: [], error: err.message })
  }
}
