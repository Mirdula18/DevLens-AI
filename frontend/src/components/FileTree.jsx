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
import Icon from './icons'

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

function TreeNode({ node, onFileClick, selectedPath, depth }) {
  const [open, setOpen] = useState(depth === 0)
  const indent = depth * 12

  if (node.type === 'folder') {
    return (
      <div>
        <button
          className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm text-gray-300 transition-colors hover:bg-surface-700 hover:text-white"
          style={{ paddingLeft: `${indent + 8}px` }}
          onClick={() => setOpen(o => !o)}
        >
          <Icon.Chevron
            className={`h-3 w-3 flex-shrink-0 text-gray-500 transition-transform duration-150 ${
              open ? 'rotate-90' : ''
            }`}
          />
          <Icon.Folder className={`h-4 w-4 flex-shrink-0 ${open ? 'text-yellow-500' : 'text-yellow-600'}`} />
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
      className={`flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-surface-700 ${
        isSelected ? 'bg-surface-600 text-white' : 'text-gray-400 hover:text-white'
      }`}
      style={{ paddingLeft: `${indent + 8 + 4}px` }}
      onClick={() => onFileClick(node.path)}
      title={node.path}
    >
      <Icon.File className={`h-4 w-4 flex-shrink-0 ${fileColour(node.name)}`} />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export default function FileTree({ nodes, onFileClick, selectedPath }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-gray-500">
        <Icon.File className="h-6 w-6 text-gray-600" />
        <p className="text-xs">No files found.</p>
      </div>
    )
  }

  return (
    <div className="select-none px-1 py-1">
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
