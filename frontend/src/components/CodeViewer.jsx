/**
 * CodeViewer – displays the content of the selected file with
 * syntax highlighting via react-syntax-highlighter.
 *
 * Uses the PrismLight build and registers only the languages DevLens can
 * open, which keeps the bundle far smaller than the full Prism build.
 *
 * Props:
 *   fileName – name of the file (used to pick language)
 *   content  – raw text content
 */
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import batch from 'react-syntax-highlighter/dist/esm/languages/prism/batch'
import c from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import cpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import go from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import jsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import php from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import ruby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import rust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import toml from 'react-syntax-highlighter/dist/esm/languages/prism/toml'
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'
import Icon from './icons'

const LANGUAGES = {
  bash, batch, c, cpp, css, go, java, javascript, json, jsx,
  markdown, markup, php, python, ruby, rust, toml, tsx, typescript, yaml,
}
for (const [name, lang] of Object.entries(LANGUAGES)) {
  SyntaxHighlighter.registerLanguage(name, lang)
}

// Map common extensions to the Prism language identifiers registered above
const EXT_LANG = {
  js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
  py: 'python', java: 'java', cpp: 'cpp', c: 'c', h: 'c',
  html: 'markup', css: 'css', json: 'json', md: 'markdown',
  yaml: 'yaml', yml: 'yaml', toml: 'toml', sh: 'bash', bat: 'batch',
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
