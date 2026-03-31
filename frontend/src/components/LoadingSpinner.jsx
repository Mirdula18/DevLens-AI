/**
 * LoadingSpinner – simple animated spinner with optional label.
 */
export default function LoadingSpinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-surface-600 border-t-accent" />
      <span className="text-sm text-gray-400">{label}</span>
    </div>
  )
}
