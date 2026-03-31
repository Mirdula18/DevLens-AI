/**
 * ModeSelector – tab bar for choosing the explanation mode.
 *
 * Props:
 *   mode      – currently active mode string
 *   onChange  – callback(newMode: string)
 */

const MODES = [
  { id: 'normal',   label: '📖 Explain',   title: 'Structured explanation' },
  { id: 'eli5',     label: '🧒 ELI5',      title: "Explain Like I'm 5" },
  { id: 'review',   label: '🔍 Review',    title: 'Code review — find issues' },
  { id: 'optimize', label: '⚡ Optimize',  title: 'Performance & optimization tips' },
]

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="flex gap-1 border-b border-surface-600 bg-surface-800 px-4 py-2">
      {MODES.map(m => (
        <button
          key={m.id}
          title={m.title}
          onClick={() => onChange(m.id)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            mode === m.id
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:bg-surface-700 hover:text-white'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
