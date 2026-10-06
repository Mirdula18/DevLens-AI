/**
 * InsightsPanel – codebase metrics for the loaded project.
 *
 * Shows totals as stat tiles, a ranked bar chart of lines per language
 * (single series, so one hue and direct value labels instead of a legend),
 * and the largest files, which open in the code viewer when clicked.
 *
 * Props:
 *   active     – bool, the panel is visible (stats load on first view)
 *   hasProject – bool
 *   onOpenFile – callback(relativePath)
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchStats } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import Icon from './icons'

// Languages beyond this many fold into a single "Other" row
const MAX_LANGUAGES = 7

const fmt = n => n.toLocaleString()

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Keep the top languages and fold the remainder into "Other". */
export function foldLanguages(languages, max = MAX_LANGUAGES) {
  if (languages.length <= max) return languages
  const top = languages.slice(0, max - 1)
  const rest = languages.slice(max - 1)
  const lines = rest.reduce((n, l) => n + l.lines, 0)
  const files = rest.reduce((n, l) => n + l.files, 0)
  const percent = Math.round(rest.reduce((n, l) => n + l.percent, 0) * 10) / 10
  return [...top, { name: `Other (${rest.length})`, lines, files, percent }]
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-lg border border-surface-600 bg-surface-800 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-gray-100">{value}</p>
    </div>
  )
}

function LanguageBars({ languages }) {
  const rows = foldLanguages(languages)
  const maxLines = Math.max(...rows.map(r => r.lines), 1)

  return (
    <ul className="space-y-2" aria-label="Lines of code per language">
      {rows.map(row => (
        <li
          key={row.name}
          title={`${row.name}: ${fmt(row.lines)} lines in ${fmt(row.files)} file${row.files === 1 ? '' : 's'} (${row.percent}%)`}
          className="group grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 rounded px-1 py-0.5 hover:bg-surface-800"
        >
          <span className="truncate text-xs text-gray-300">{row.name}</span>
          <span className="h-2.5">
            <span
              className="block h-full rounded-r bg-accent/80 transition-colors group-hover:bg-accent"
              style={{ width: `${Math.max((row.lines / maxLines) * 100, 1.5)}%` }}
            />
          </span>
          <span className="text-right text-[11px] tabular-nums text-gray-400">
            {fmt(row.lines)} <span className="text-gray-600">· {row.percent}%</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

export default function InsightsPanel({ active, hasProject, onOpenFile }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStats(await fetchStats())
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Load lazily the first time the panel is shown for this project
  useEffect(() => {
    if (active && hasProject && !stats && !loading && !error) load()
  }, [active, hasProject, stats, loading, error, load])

  return (
    <div className="flex h-full flex-col bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-surface-600 bg-surface-800 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Icon.Chart className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-200">Codebase Insights</h2>
          <p className="text-[11px] text-gray-500">Languages, size, and largest files</p>
        </div>
        {hasProject && (
          <button
            onClick={load}
            disabled={loading}
            title="Recompute statistics"
            className="rounded p-1.5 text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-200 disabled:opacity-40"
          >
            <Icon.Refresh className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        {!hasProject && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-700 bg-surface-800">
              <Icon.Chart className="h-6 w-6 text-gray-500" />
            </div>
            <p className="text-sm font-medium text-gray-300">No project loaded</p>
            <p className="max-w-[220px] text-xs text-gray-500">Load a project to see its statistics.</p>
          </div>
        )}

        {hasProject && loading && !stats && <LoadingSpinner label="Analysing project…" />}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-400">
            <Icon.Alert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {hasProject && stats && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <StatTile label="Files" value={fmt(stats.total_files)} />
              <StatTile label="Lines" value={fmt(stats.total_lines)} />
              <StatTile label="Size" value={formatBytes(stats.total_bytes)} />
            </div>

            {stats.languages.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Lines by language
                </h3>
                <LanguageBars languages={stats.languages} />
              </section>
            )}

            {stats.largest_files.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
                  Largest files
                </h3>
                <ol className="space-y-0.5">
                  {stats.largest_files.map(f => (
                    <li key={f.path}>
                      <button
                        onClick={() => onOpenFile(f.path)}
                        title={`Open ${f.path}`}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-gray-300 transition-colors hover:bg-surface-700 hover:text-white"
                      >
                        <Icon.File className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
                        <span className="flex-1 truncate font-mono">{f.path}</span>
                        <span className="tabular-nums text-gray-500">{fmt(f.lines)} lines</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
