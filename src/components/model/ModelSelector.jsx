import { useEffect, useState } from 'react'
import { MODELS } from '../../lib/models'
import { isModelCached } from '../../lib/engine'

/**
 * Radio-card model picker.
 * Props:
 *   value      — currently selected model id
 *   onChange   — called with new model id when user picks a different one
 *   disabled   — disables all inputs (e.g. while engine is loading)
 */
export default function ModelSelector({ value, onChange, disabled }) {
  // Map<modelId, bool> — populated async; undefined means "still checking"
  const [cacheMap, setCacheMap] = useState({})

  useEffect(() => {
    let cancelled = false
    Promise.all(
      MODELS.map((m) =>
        isModelCached(m.id).then((hit) => [m.id, hit])
      )
    ).then((entries) => {
      if (!cancelled) setCacheMap(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="flex flex-col gap-2 w-full">
      {MODELS.map((model) => {
        const selected = value === model.id
        const cached   = cacheMap[model.id]

        return (
          <label
            key={model.id}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              disabled ? 'opacity-60 cursor-not-allowed' : ''
            } ${
              selected
                ? 'border-indigo-500 bg-indigo-950/60'
                : 'border-gray-700 bg-gray-800 hover:border-gray-500'
            }`}
          >
            <input
              type="radio"
              name="model-selector"
              value={model.id}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(model.id)}
              className="mt-0.5 flex-shrink-0 accent-indigo-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-sm font-medium ${selected ? 'text-white' : 'text-gray-300'}`}>
                  {model.name}
                </span>
                {model.tags.includes('best-for-code') && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-600 text-indigo-100 font-medium">
                    Best for code
                  </span>
                )}
                {cached === true && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-900/60 text-green-400 border border-green-800">
                    Cached
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
              <p className="text-xs text-gray-600 mt-1 font-mono">
                {model.sizeGB} GB download · {model.contextK}K ctx · ~{model.vramGB} GB VRAM
              </p>
            </div>
          </label>
        )
      })}
    </div>
  )
}
