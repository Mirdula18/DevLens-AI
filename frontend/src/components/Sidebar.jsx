/**
 * Sidebar – contains the project upload form and the FileTree.
 *
 * Props:
 *   tree         – file-tree nodes from the backend
 *   selectedPath – currently selected file path
 *   onFileClick  – callback when a file is selected
 *   onUpload     – callback(path: string) to trigger project upload
 *   uploadStatus – { loading, error, projectName }
 */
import { useState } from 'react'
import FileTree from './FileTree'
import LoadingSpinner from './LoadingSpinner'
import Icon from './icons'

export default function Sidebar({ tree, selectedPath, onFileClick, onUpload, uploadStatus }) {
  const [inputPath, setInputPath] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (inputPath.trim()) {
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
          <label className="text-[11px] font-medium uppercase tracking-widest text-gray-500">
            Project Folder
          </label>
          <input
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
            <span>{uploadStatus.projectName} loaded</span>
          </p>
        )}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto">
        {uploadStatus.loading ? (
          <LoadingSpinner label="Scanning project…" />
        ) : (
          <FileTree
            nodes={tree}
            onFileClick={onFileClick}
            selectedPath={selectedPath}
          />
        )}
      </div>
    </aside>
  )
}