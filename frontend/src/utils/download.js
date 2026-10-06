/**
 * Helpers for exporting AI output as Markdown files.
 */

/** Trigger a browser download of *text* as a Markdown file. */
export function downloadMarkdown(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Turn arbitrary text into a safe, readable file-name fragment. */
export function slugify(text) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'devlens'
  )
}

/** Format a citation as "path:L12-40" (or "path:L7" for one line). */
export function formatSource({ path, start_line: start, end_line: end }) {
  if (!start) return path
  return start === end ? `${path}:L${start}` : `${path}:L${start}-${end}`
}

/**
 * Build a Markdown transcript of a chat conversation.
 * @param {string} project  project name shown in the heading
 * @param {Array<{role, content, sources?}>} messages
 */
export function chatToMarkdown(project, messages) {
  const parts = [`# DevLens chat – ${project || 'project'}`, '']
  for (const msg of messages) {
    if (msg.role === 'user') {
      parts.push(`## Q: ${msg.content}`, '')
    } else {
      parts.push(msg.content, '')
      if (msg.sources?.length) {
        parts.push('**Sources:**', ...msg.sources.map(s => `- \`${formatSource(s)}\``), '')
      }
    }
  }
  return parts.join('\n')
}
