/**
 * FileTree – recursively renders a tree of files and folders.
 *
 * Props:
 *   nodes        – array of tree nodes from the backend
 *   onFileClick  – callback(relativePath: string) when a file node is clicked
 *   selectedPath – currently selected file path (for highlight)
 *   depth        – indent depth (internal recursion, starts at 0)
 */
import { useState } from 'react'

// File-extension → colour mapping for icons
const EXT_COLOURS = {
  js:   'text-yellow-400',
  jsx:  'text-yellow-400',
  ts:   'text-blue-400',
  tsx:  'text-blue-400',
  py:   'text-green-400',
  java: 'text-orange-400',
  cpp:  'text-purple-400',
  c:    'text-purple-400',
  h:    'text-purple-300',
  html: 'text-red-400',
  css:  'text-pink-400',
  json: 'text-gray-300',
  md:   'text-gray-300',
  default: 'text-gray-400',
}

function fileColour(name) {
  const ext = name.split('.').pop().toLowerCase()
  return EXT_COLOURS[ext] ?? EXT_COLOURS.default
}

function FileIcon({ name }) {
  const cls = fileColour(name)
  return <span className={`mr-1 text-xs ${cls}`}>◈</span>
}

function FolderIcon({ open }) {
  return <span className="mr-1 text-yellow-500">{open ? '▾' : '▸'}</span>
}

function TreeNode({ node, onFileClick, selectedPath, depth }) {
  const [open, setOpen] = useState(depth === 0)
  const indent = depth * 12

  if (node.type === 'folder') {
    return (
      <div>
        <button
          className="flex w-full items-center rounded px-2 py-0.5 text-left text-sm text-gray-300 hover:bg-surface-700 hover:text-white"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setOpen(o => !o)}
        >
          <FolderIcon open={open} />
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map(child => (
          <TreeNode
            key={child.path}
            node={child}
            onFileClick={onFileClick}
            selectedPath={selectedPath}
            depth={depth + 1}
          />
        ))}
      </div>
    )
  }

  // File node
  const isSelected = node.path === selectedPath
  return (
    <button
      className={`flex w-full items-center rounded px-2 py-0.5 text-left text-sm hover:bg-surface-700 hover:text-white ${
        isSelected ? 'bg-surface-600 text-white' : 'text-gray-400'
      }`}
      style={{ paddingLeft: `${indent + 8}px` }}
      onClick={() => onFileClick(node.path)}
      title={node.path}
    >
      <FileIcon name={node.name} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export default function FileTree({ nodes, onFileClick, selectedPath }) {
  if (!nodes || nodes.length === 0) {
    return <p className="px-3 py-2 text-xs text-gray-500">No files found.</p>
  }

  return (
    <div className="select-none">
      {nodes.map(node => (
        <TreeNode
          key={node.path}
          node={node}
          onFileClick={onFileClick}
          selectedPath={selectedPath}
          depth={0}
        />
      ))}
    </div>
  )
}
