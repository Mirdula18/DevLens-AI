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
import Icon from './icons'

const MODE_LABELS = {
  normal: 'Explanation',
  eli5: 'ELI5',
  review: 'Code Review',
  optimize: 'Optimization',
}

// Render markdown-ish text: bold **text**, bullets, headings
function FormattedText({ text }) {
  if (!text) return null

  const lines = text.split('\n')
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-300">
      {lines.map((line, i) => {
        // Numbered list (e.g. "1. ...")
        if (/^\d+\.\s/.test(line)) {
          return (
            <p key={i} className="flex gap-2">
              <span className="text-accent">{line.match(/^\d+/)[0]}.</span>
              <span>{line.replace(/^\d+\.\s/, '')}</span>
            </p>
          )
        }
        // Heading lines (## or ###)
        if (/^#{2,3}\s/.test(line)) {
          return (
            <p key={i} className="mt-4 flex items-center gap-2 font-semibold text-gray-100 first:mt-0">
              <span className="h-3 w-0.5 rounded bg-accent" />
              <span>{line.replace(/^#{2,3}\s/, '')}</span>
            </p>
          )
        }
        // Bold (wrap **text** with strong)
        const parts = line.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className={line.startsWith('- ') || line.startsWith('* ') ? 'ml-4 flex gap-2' : ''}>
            {(line.startsWith('- ') || line.startsWith('* ')) && (
              <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-surface-500" />
            )}
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

function ActionButton({ icon: BtnIcon, label, title, onClick, disabled, primary }) {
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? 'bg-accent text-white hover:bg-accent-hover'
          : 'border border-surface-500 text-gray-300 hover:bg-surface-700'
      }`}
    >
      <BtnIcon className={`h-3.5 w-3.5 ${primary ? 'text-white' : 'text-gray-400'}`} />
      <span>{label}</span>
    </button>
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
      <div className="flex flex-wrap gap-2 border-b border-surface-600 bg-surface-800 px-4 py-3">
        <ActionButton
          icon={Icon.Sparkles}
          label="Explain File"
          title="Generate an AI explanation"
          primary
          onClick={onExplain}
          disabled={!hasFile || loading}
        />
        <ActionButton
          icon={Icon.Target}
          label="Detect Confusion"
          title="Find complex sections"
          onClick={onDetectConfusion}
          disabled={!hasFile || loading}
        />
        <ActionButton
          icon={Icon.Clipboard}
          label="Project Summary"
          title="Analyse the whole codebase"
          onClick={onSummary}
          disabled={!hasProject || loading}
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="py-10">
            <LoadingSpinner label="Thinking…" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-400">
            <Icon.Alert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && !explanation && !confusionAnalysis && !summary && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-600">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-700 bg-surface-800">
              <Icon.Sparkles className="h-6 w-6 text-gray-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-300">
                {hasFile ? 'Ready to analyse' : 'No file selected'}
              </p>
              <p className="mx-auto max-w-[220px] text-xs leading-relaxed text-gray-500">
                {hasFile
                  ? 'Pick an action above to see insight generated from your code.'
                  : 'Select a file from the sidebar to begin.'}
              </p>
            </div>
          </div>
        )}

        {summary && !loading && (
          <section>
            <SectionTitle icon={Icon.Clipboard} title="Project Summary" />
            <FormattedText text={summary} />
          </section>
        )}

        {explanation && !loading && (
          <section>
            <SectionTitle icon={Icon.Sparkles} title={`Explanation · ${MODE_LABELS[mode] ?? mode}`} />
            <FormattedText text={explanation} />
          </section>
        )}

        {confusionAnalysis && !loading && (
          <section className="mt-6">
            <SectionTitle icon={Icon.Target} title="Confusion Detector" />
            <FormattedText text={confusionAnalysis} />
          </section>
        )}
      </div>
    </div>
  )
}

function SectionTitle({ icon: TitleIcon, title }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
      <TitleIcon className="h-3.5 w-3.5" />
      {title}
    </h3>
  )
}