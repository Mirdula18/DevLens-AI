/**
 * FormattedText – lightweight renderer for the markdown the LLM produces.
 *
 * Supports fenced code blocks, headings (# to ####), bullet and numbered
 * lists (including nested / indented items), **bold** and `inline code`.
 * Unclosed code fences (common mid-stream) render as a code block too.
 *
 * Props:
 *   text – markdown-ish string
 */

// Split a line into plain text, **bold** and `code` segments
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="text-white">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="rounded bg-surface-700 px-1 py-0.5 text-[0.8em] text-accent">
          {part.slice(1, -1)}
        </code>
      )
    }
    return part
  })
}

/** Group lines into blocks: fenced code vs. regular lines. */
function toBlocks(text) {
  const blocks = []
  let code = null
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) {
        blocks.push(code)
        code = null
      } else {
        code = { type: 'code', lines: [] }
      }
    } else if (code) {
      code.lines.push(line)
    } else {
      blocks.push({ type: 'line', text: line })
    }
  }
  if (code) blocks.push(code) // unclosed fence while streaming
  return blocks
}

function Line({ text }) {
  if (!text.trim()) return <div className="h-1" />

  const heading = text.match(/^\s*#{1,4}\s+(.*)$/)
  if (heading) {
    return (
      <p className="mt-4 flex items-center gap-2 font-semibold text-gray-100 first:mt-0">
        <span className="h-3 w-0.5 rounded bg-accent" />
        <span>
          <Inline text={heading[1]} />
        </span>
      </p>
    )
  }

  const indent = Math.min(Math.floor((text.match(/^\s*/)[0].length) / 2), 3)

  // Bullets – also handles "* - item" style double markers
  const bullet = text.match(/^\s*(?:[-*+]\s+)+(.*)$/)
  if (bullet) {
    return (
      <p className="flex gap-2" style={{ marginLeft: `${1 + indent * 0.75}rem` }}>
        <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-surface-500" />
        <span>
          <Inline text={bullet[1]} />
        </span>
      </p>
    )
  }

  const numbered = text.match(/^\s*(\d+)[.)]\s+(.*)$/)
  if (numbered) {
    return (
      <p className="flex gap-2" style={{ marginLeft: `${indent * 0.75}rem` }}>
        <span className="text-accent">{numbered[1]}.</span>
        <span>
          <Inline text={numbered[2]} />
        </span>
      </p>
    )
  }

  return (
    <p>
      <Inline text={text} />
    </p>
  )
}

export default function FormattedText({ text }) {
  if (!text) return null

  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-gray-300">
      {toBlocks(text).map((block, i) =>
        block.type === 'code' ? (
          <pre
            key={i}
            className="overflow-x-auto rounded-md border border-surface-600 bg-surface-800 p-3 text-xs leading-relaxed text-gray-200"
          >
            <code>{block.lines.join('\n')}</code>
          </pre>
        ) : (
          <Line key={i} text={block.text} />
        )
      )}
    </div>
  )
}
