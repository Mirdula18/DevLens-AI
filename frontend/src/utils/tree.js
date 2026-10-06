/**
 * Helpers for the file-tree JSON returned by GET /tree.
 */

/**
 * Return a copy of *nodes* containing only files whose path matches
 * *query* (case-insensitive), plus the folders leading to them.
 * An empty query returns *nodes* unchanged.
 */
export function filterTree(nodes, query) {
  const q = query.trim().toLowerCase()
  if (!q) return nodes

  const result = []
  for (const node of nodes) {
    if (node.type === 'folder') {
      const children = filterTree(node.children ?? [], q)
      if (children.length) result.push({ ...node, children })
    } else if (node.path.toLowerCase().includes(q)) {
      result.push(node)
    }
  }
  return result
}

/** Count the file nodes in *nodes* (recursively). */
export function countFiles(nodes) {
  return nodes.reduce(
    (total, node) => total + (node.type === 'folder' ? countFiles(node.children ?? []) : 1),
    0,
  )
}
