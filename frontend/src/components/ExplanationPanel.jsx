/**
 * ExplanationPanel – shows AI explanations, project summary, and
 * confusion-detector results.
 *
 * Props:
 *   explanation       – string from /explain
 *   confusionAnalysis – string from /explain/confusion
 *   summary           – string from /summary
 *   loading           – bool
 *   error             – string | null
 *   mode              – current explanation mode
 *   onExplain         – callback() trigger explanation
 *   onDetectConfusion – callback()
 *   onSummary         – callback()
 *   hasFile           – bool (a file is currently selected)
 *   hasProject        – bool (a project is loaded)
 */
import LoadingSpinner from './LoadingSpinner'

// Render markdown-ish text: bold **text**, bullets, headings
function FormattedText({ text }) {
  if (!text) return null

  const lines = text.split('\n')
  return (
    <div className="space-y-1 text-sm leading-relaxed text-gray-300">
      {lines.map((line, i) => {
        // Heading lines (## or ###)
        if (/^#{2,3}\s/.test(line)) {
          return (
            <p key={i} className="mt-3 font-semibold text-accent">
              {line.replace(/^#{2,3}\s/, '')}
            </p>
          )
        }
        // Bold (wrap **text** with strong)
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className={line.startsWith('- ') || line.startsWith('* ') ? 'ml-3' : ''}>
            {parts.map((part, j) =>
              /^\*\*[^*]+\*\*$/.test(part) ? (
                <strong key={j} className="text-white">
                  {part.replace(/\*\*/g, '')}
                </strong>
              ) : (
                part
              )
            )}
          </p>
        )
      })}
    </div>
  )
}

export default function ExplanationPanel({
  explanation,
  confusionAnalysis,
  summary,
  loading,
  error,
  mode,
  onExplain,
  onDetectConfusion,
  onSummary,
  hasFile,
  hasProject,
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-900">
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 border-b border-surface-600 bg-surface-800 px-4 py-2">
        <button
          disabled={!hasFile || loading}
          onClick={onExplain}
          className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          ✨ Explain File
        </button>
        <button
          disabled={!hasFile || loading}
          onClick={onDetectConfusion}
          className="rounded border border-surface-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          🔎 Detect Confusion
        </button>
        <button
          disabled={!hasProject || loading}
          onClick={onSummary}
          className="rounded border border-surface-500 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          📋 Project Summary
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && <LoadingSpinner label="Thinking…" />}

        {error && (
          <div className="rounded border border-red-800 bg-red-950/40 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && !explanation && !confusionAnalysis && !summary && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <span className="text-4xl">🤖</span>
            <span className="text-sm">
              {hasFile
                ? 'Click "Explain File" to get an AI explanation.'
                : 'Select a file from the sidebar.'}
            </span>
          </div>
        )}

        {summary && !loading && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
              📋 Project Summary
            </h2>
            <FormattedText text={summary} />
          </section>
        )}

        {explanation && !loading && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
              ✨ Explanation ({mode})
            </h2>
            <FormattedText text={explanation} />
          </section>
        )}

        {confusionAnalysis && !loading && (
          <section className="mt-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-gray-500">
              🔎 Confusion Detector
            </h2>
            <FormattedText text={confusionAnalysis} />
          </section>
        )}
      </div>
    </div>
  )
}
