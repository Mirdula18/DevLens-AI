/**
 * ModeSelector – tab bar for choosing the explanation mode.
 *
 * Props:
 *   mode      – currently active mode string
 *   onChange  – callback(newMode: string)
 */
import Icon from './icons'

const MODES = [
  { id: 'normal',   icon: Icon.Book,    label: 'Explain',  title: 'Structured explanation' },
  { id: 'eli5',     icon: Icon.Eye,     label: 'ELI5',     title: "Explain Like I'm 5" },
  { id: 'review',   icon: Icon.Shield,  label: 'Review',   title: 'Code review — find issues' },
  { id: 'optimize', icon: Icon.Zap,     label: 'Optimize', title: 'Performance & optimization tips' },
]

export default function ModeSelector({ mode, onChange }) {
  return (
    <div className="flex gap-1 border-b border-surface-600 bg-surface-800 px-3 py-2">
      {MODES.map(m => {
        const MIcon = m.icon
        const active = mode === m.id
        return (
          <button
            key={m.id}
            title={m.title}
            onClick={() => onChange(m.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-surface-700 text-accent'
                : 'text-gray-500 hover:bg-surface-700/50 hover:text-gray-200'
            }`}
          >
            <MIcon className="h-3.5 w-3.5" />
            <span>{m.label}</span>
          </button>
        )
      })}
    </div>
  )
}