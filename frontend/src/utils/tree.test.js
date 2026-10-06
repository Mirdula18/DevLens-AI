import { describe, expect, it } from 'vitest'
import { countFiles, filterTree } from './tree'

const tree = [
  {
    name: 'src', path: 'src', type: 'folder', children: [
      { name: 'App.jsx', path: 'src/App.jsx', type: 'file' },
      {
        name: 'components', path: 'src/components', type: 'folder', children: [
          { name: 'Sidebar.jsx', path: 'src/components/Sidebar.jsx', type: 'file' },
        ],
      },
    ],
  },
  { name: 'README.md', path: 'README.md', type: 'file' },
]

describe('filterTree', () => {
  it('returns the tree unchanged for an empty query', () => {
    expect(filterTree(tree, '  ')).toBe(tree)
  })

  it('keeps matching files and the folders leading to them', () => {
    const result = filterTree(tree, 'sidebar')
    expect(result).toHaveLength(1)
    expect(result[0].children).toHaveLength(1)
    expect(result[0].children[0].children[0].path).toBe('src/components/Sidebar.jsx')
  })

  it('matches on the full path, case-insensitively', () => {
    expect(countFiles(filterTree(tree, 'SRC/'))).toBe(2)
    expect(countFiles(filterTree(tree, 'readme'))).toBe(1)
  })

  it('drops folders with no matches', () => {
    expect(filterTree(tree, 'nothing-matches')).toEqual([])
  })
})

describe('countFiles', () => {
  it('counts files recursively', () => {
    expect(countFiles(tree)).toBe(3)
    expect(countFiles([])).toBe(0)
  })
})
