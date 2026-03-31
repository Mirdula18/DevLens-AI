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
        <span className="text-lg">🔍</span>
        <span className="font-semibold text-accent">DevLens AI</span>
      </div>

      {/* Project upload */}
      <div className="border-b border-surface-600 p-3">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <label className="text-xs font-medium uppercase tracking-widest text-gray-500">
            Project Folder
          </label>
          <input
            type="text"
            value={inputPath}
            onChange={e => setInputPath(e.target.value)}
            placeholder="/absolute/path/to/project"
            className="rounded border border-surface-600 bg-surface-700 px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-accent focus:outline-none"
          />
          <button
            type="submit"
            disabled={uploadStatus.loading}
            className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {uploadStatus.loading ? 'Loading…' : 'Load Project'}
          </button>
        </form>

        {uploadStatus.error && (
          <p className="mt-2 text-xs text-red-400">{uploadStatus.error}</p>
        )}
        {uploadStatus.projectName && (
          <p className="mt-2 text-xs text-green-400">
            ✓ {uploadStatus.projectName} loaded
          </p>
        )}
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-2">
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
