/**
 * CodeViewer – displays the content of the selected file with
 * syntax highlighting via react-syntax-highlighter.
 *
 * Props:
 *   fileName – name of the file (used to pick language)
 *   content  – raw text content
 */
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import Icon from './icons'

// Map common extensions to Prism language identifiers
const EXT_LANG = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', java: 'java', cpp: 'cpp', c: 'c', h: 'c',
  html: 'html', css: 'css', json: 'json', md: 'markdown',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'bash',
  go: 'go', rb: 'ruby', rs: 'rust', php: 'php',
}

function getLang(fileName) {
  if (!fileName) return 'text'
  const ext = fileName.split('.').pop().toLowerCase()
  return EXT_LANG[ext] ?? 'text'
}

export default function CodeViewer({ fileName, content }) {
  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-gray-600">
        <Icon.File className="h-8 w-8 text-gray-700" />
        <p className="text-sm">Select a file to view its content.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filename bar */}
      <div className="flex items-center gap-2 border-b border-surface-600 bg-surface-800 px-4 py-2 text-sm">
        <span className="flex h-4 w-4 items-center justify-center text-gray-500">
          <Icon.File className="h-3.5 w-3.5" />
        </span>
        <span className="font-mono text-gray-200">{fileName}</span>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto">
        <SyntaxHighlighter
          language={getLang(fileName)}
          style={oneDark}
          showLineNumbers
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            borderRadius: 0,
            background: '#0d1117',
            fontSize: '0.82rem',
            minHeight: '100%',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
