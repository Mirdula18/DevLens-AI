/**
 * ExplanationPanel – shows AI explanations, project summary, and
 * confusion-detector results. Text renders progressively as it streams.
 *
 * Props:
 *   explanation       – string from /explain
 *   confusionAnalysis – string from /explain/confusion
 *   summary           – string from /summary
 *   loading           – bool (a stream is in progress)
 *   error             – string | null
 *   mode              – current explanation mode
 *   onExplain         – callback() trigger explanation
 *   onDetectConfusion – callback()
 *   onSummary         – callback()
 *   onStop            – callback() cancel the running stream
 *   hasFile           – bool (a file is currently selected)
 *   hasProject        – bool (a project is loaded)
 */
import { useState } from 'react'
import FormattedText from './FormattedText'
import LoadingSpinner from './LoadingSpinner'
import Icon from './icons'

const MODE_LABELS = {
  normal: 'Explanation',
  eli5: 'ELI5',
  review: 'Code Review',
  optimize: 'Optimization',
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
  onStop,
  hasFile,
  hasProject,
}) {
  const hasOutput = Boolean(explanation || confusionAnalysis || summary)

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
        {loading && (
          <ActionButton
            icon={Icon.Close}
            label="Stop"
            title="Stop generating"
            onClick={onStop}
          />
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Spinner only until the first token arrives */}
        {loading && !hasOutput && (
          <div className="py-10">
            <LoadingSpinner label="Thinking…" />
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-800/60 bg-red-950/40 p-3 text-sm text-red-400">
            <Icon.Alert className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && !hasOutput && (
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

        {summary && (
          <ResultSection icon={Icon.Clipboard} title="Project Summary" text={summary} streaming={loading} />
        )}

        {explanation && (
          <ResultSection
            icon={Icon.Sparkles}
            title={mode === 'normal' ? 'Explanation' : `Explanation · ${MODE_LABELS[mode] ?? mode}`}
            text={explanation}
            streaming={loading}
          />
        )}

        {confusionAnalysis && (
          <ResultSection icon={Icon.Target} title="Confusion Detector" text={confusionAnalysis} streaming={loading} />
        )}
      </div>
    </div>
  )
}

function ResultSection({ icon: TitleIcon, title, text, streaming }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (e.g. insecure context) */
    }
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gray-500">
          <TitleIcon className="h-3.5 w-3.5" />
          {title}
          {streaming && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
        </h3>
        {!streaming && (
          <button
            onClick={handleCopy}
            title="Copy to clipboard"
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-gray-500 transition-colors hover:bg-surface-700 hover:text-gray-200"
          >
            {copied ? <Icon.Check className="h-3 w-3 text-green-400" /> : <Icon.Clipboard className="h-3 w-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        )}
      </div>
      <FormattedText text={text} />
    </section>
  )
}
