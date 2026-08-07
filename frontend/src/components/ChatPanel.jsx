/**
 * ChatPanel – Codebase Q&A using RAG.
 *
 * Props:
 *   hasProject – bool (a project must be loaded)
 */
import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/api'
import LoadingSpinner from './LoadingSpinner'

function Message({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-accent text-white'
            : 'bg-surface-700 text-gray-200'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.sources && msg.sources.length > 0 && (
          <div className="mt-2 border-t border-surface-600 pt-2">
            <p className="text-xs text-gray-400">Sources:</p>
            <ul className="mt-1 space-y-0.5">
              {msg.sources.map(s => (
                <li key={s} className="truncate text-xs text-gray-400">
                  📄 {s}
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

    try {
      const data = await sendChatMessage(question, 5, model)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: data.answer, sources: data.sources },
      ])
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.response?.data?.detail ?? err.message}`,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-surface-900">
      {/* Header */}
      <div className="border-b border-surface-600 bg-surface-800 px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-300">💬 Codebase Chat (RAG)</h2>
        <p className="text-xs text-gray-500">
          Ask questions like "Where is authentication handled?"
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
            <span className="text-3xl">💬</span>
            <span className="text-sm">
              {hasProject
                ? 'Ask anything about your codebase.'
                : 'Load a project first, then start chatting.'}
            </span>
          </div>
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {loading && <LoadingSpinner label="Searching codebase…" />}
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
          className="flex-1 rounded border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!hasProject || loading || !input.trim()}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  )
}
