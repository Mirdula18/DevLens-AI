/**
 * ModelSelector – dropdown for choosing the active Ollama model.
 *
 * Props:
 *   models   – array of model names available in Ollama
 *   value    – currently selected model string
 *   onChange – callback(newModel: string)
 *   disabled – bool
 */
export default function ModelSelector({ models, value, onChange, disabled }) {
  if (!models || models.length === 0) {
    return null
  }

  return (
    <label className="flex items-center gap-2 text-xs text-gray-400">
      <span className="uppercase tracking-widest">Model:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="rounded border border-surface-600 bg-surface-700 px-2 py-1 text-xs font-medium text-gray-200 focus:border-accent focus:outline-none disabled:opacity-50"
      >
        {models.map(m => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </label>
  )
}