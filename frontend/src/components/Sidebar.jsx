/**
 * Sidebar – contains the project upload form, a file filter, and the FileTree.
 *
 * Props:
 *   tree         – file-tree nodes from the backend
 *   selectedPath – currently selected file path
 *   onFileClick  – callback when a file is selected
 *   onUpload     – callback(path: string) to trigger project upload
 *   uploadStatus – { loading, error, projectName }
 *   initialPath  – value to pre-fill the project path with
 */
import { useMemo, useState } from 'react'
import { countFiles, filterTree } from '../utils/tree'
import FileTree from './FileTree'
import LoadingSpinner from './LoadingSpinner'
import Icon from './icons'

export default function Sidebar({ tree, selectedPath, onFileClick, onUpload, uploadStatus, initialPath = '' }) {
  const [inputPath, setInputPath] = useState(initialPath)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => filterTree(tree, query), [tree, query])
  const filtering = Boolean(query.trim())

  function handleSubmit(e) {
    e.preventDefault()
    if (inputPath.trim()) {
      setQuery('')
      onUpload(inputPath.trim())
    }
  }

  return (
    <aside className="flex h-full w-72 flex-shrink-0 flex-col border-r border-surface-600 bg-surface-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-surface-600 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Icon.Logo className="h-4 w-4" />
        </div>
        <div>
          <span className="block text-sm font-semibold text-gray-100">DevLens</span>
          <span className="block text-[11px] text-gray-500">Project Explorer</span>
        </div>
      </div>

      {/* Project upload */}
      <div className="border-b border-surface-600 p-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label
            htmlFor="project-path"
            className="text-[11px] font-medium uppercase tracking-widest text-gray-500"
          >
            Project Folder
          </label>
          <input
            id="project-path"
            type="text"
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            placeholder="/absolute/path/to/project"
            className="rounded-md border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={uploadStatus.loading}
            className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {uploadStatus.loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Loading…
              </>
            ) : (
              <>
                <Icon.Folder className="h-3.5 w-3.5" />
                Load Project
              </>
            )}
          </button>
        </form>

        {uploadStatus.error && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-400">
            <Icon.Alert className="mt-0.5 h-3 w-3 flex-shrink-0" />
            <span>{uploadStatus.error}</span>
          </p>
        )}
        {uploadStatus.projectName && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
            <Icon.Check className="h-3 w-3" />
            <span>
              {uploadStatus.projectName} loaded · {countFiles(tree)} files
            </span>
          </p>
        )}
      </div>

      {/* File filter */}
      {tree.length > 0 && !uploadStatus.loading && (
        <div className="border-b border-surface-600 px-3 py-2">
          <div className="flex items-center gap-2 rounded-md border border-surface-600 bg-surface-700 px-2 focus-within:border-accent">
            <Icon.Search className="h-3.5 w-3.5 flex-shrink-0 text-gray-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && setQuery('')}
              placeholder="Filter files…"
              aria-label="Filter files"
              className="w-full bg-transparent py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
            />
            {filtering && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Clear filter"
                className="text-gray-500 hover:text-gray-200"
              >
                <Icon.Close className="h-3 w-3" />
              </button>
            )}
          </div>
          {filtering && (
            <p className="mt-1.5 text-[11px] text-gray-500">
              {countFiles(filtered)} of {countFiles(tree)} files
            </p>
          )}
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {uploadStatus.loading ? (
          <LoadingSpinner label="Scanning project…" />
        ) : (
          <FileTree
            nodes={filtered}
            onFileClick={onFileClick}
            selectedPath={selectedPath}
            forceOpen={filtering}
            emptyMessage={filtering ? 'No files match the filter.' : 'No files found.'}
          />
        )}
      </div>
    </aside>
  )
}
