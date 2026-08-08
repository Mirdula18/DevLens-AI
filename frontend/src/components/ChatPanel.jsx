/**
 * ChatPanel – Codebase Q&A using RAG.
 *
 * Props:
 *   hasProject – bool (a project must be loaded)
 *   model      – the active Ollama model
 */
import { useState, useRef, useEffect } from 'react'
import { streamChat } from '../services/api'
import LoadingSpinner from './LoadingSpinner'
import Icon from './icons'

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-accent text-white'
            : 'rounded-bl-sm border border-surface-600 bg-surface-800 text-gray-200'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2.5 border-t border-surface-600/70 pt-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
              Sources
            </p>
            <ul className="space-y-0.5">
              {msg.sources.map(s => (
                <li key={s} className="flex items-center gap-1.5 truncate text-xs text-gray-400">
                  <Icon.File className="h-3 w-3 flex-shrink-0 text-gray-500" />
                  <span className="truncate">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ChatPanel({ hasProject, model }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  // Auto-scroll to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(e) {
    e.preventDefault()
    const question = input.trim()
    if (!question || loading) return

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    // Append a placeholder assistant message that tokens stream into
    setMessages(prev => [...prev, { role: 'assistant', content: '', sources: [] }])

    const appendToLast = updater =>
      setMessages(prev => {
        const arr = [...prev]
        const last = arr[arr.length - 1]
        arr[arr.length - 1] = updater(last)
        return arr
      })

    try {
      await streamChat({ question, topK: 5, model }, {
        onToken: token => appendToLast(m => ({ ...m, content: m.content + token })),
        onSources: sources => appendToLast(m => ({ ...m, sources })),
        onError: err => appendToLast(m => ({
          ...m,
          content: m.content || `Error: ${err.message}`,
        })),
      })
    } catch (err) {
      appendToLast(m => ({ ...m, content: m.content || `Error: ${err.message}` }))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-surface-600 bg-surface-800 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
          <Icon.Message className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Codebase Chat</h2>
          <p className="text-[11px] text-gray-500">
            RAG-powered Q&A over the loaded project
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-surface-700 bg-surface-800">
              <Icon.Message className="h-6 w-6 text-gray-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-300">
                {hasProject ? 'Ask about your codebase' : 'No project loaded'}
              </p>
              <p className="mx-auto max-w-[220px] text-xs leading-relaxed text-gray-500">
                {hasProject
                  ? 'Try "Where is authentication handled?" or "How does file upload work?"'
                  : 'Load a project from the sidebar first, then ask questions.'}
              </p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && (
          <div className="py-4">
            <LoadingSpinner label="Searching codebase…" />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 border-t border-surface-600 bg-surface-800 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={!hasProject || loading}
          placeholder={hasProject ? 'Ask about your code…' : 'Load a project first'}
          className="flex-1 rounded-md border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 transition-colors focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!hasProject || loading || !input.trim()}
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon.Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  )
}