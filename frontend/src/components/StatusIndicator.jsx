/**
 * StatusIndicator – shows whether the backend and Ollama are reachable.
 *
 * Polls GET /health on an interval and whenever the window regains focus,
 * so the badge recovers on its own after `ollama serve` is started.
 *
 * Props:
 *   onRecover – optional callback() fired when the status turns "ok" after
 *               not being ok (e.g. to re-fetch the model list)
 */
import { useEffect, useRef, useState } from 'react'
import { fetchHealth } from '../services/api'

const POLL_MS = 30_000

const STATES = {
  checking: { dot: 'bg-gray-500', label: 'Checking…', title: 'Checking the backend and Ollama' },
  ok: { dot: 'bg-green-400', label: 'Ollama', title: 'Backend and Ollama are reachable' },
  degraded: {
    dot: 'bg-yellow-400',
    label: 'Ollama offline',
    title: 'The backend is running but Ollama is unreachable – start it with `ollama serve`',
  },
  offline: {
    dot: 'bg-red-500',
    label: 'Backend offline',
    title: 'The DevLens backend is not responding – start it with uvicorn',
  },
}

export default function StatusIndicator({ onRecover }) {
  const [status, setStatus] = useState('checking')
  const prev = useRef('checking')
  const recoverRef = useRef(onRecover)
  recoverRef.current = onRecover

  useEffect(() => {
    let active = true

    async function check() {
      let next
      try {
        const data = await fetchHealth()
        next = data.llm === 'ok' ? 'ok' : 'degraded'
      } catch {
        next = 'offline'
      }
      if (!active) return
      if (next === 'ok' && prev.current !== 'ok' && prev.current !== 'checking') {
        recoverRef.current?.()
      }
      prev.current = next
      setStatus(next)
    }

    check()
    const timer = setInterval(check, POLL_MS)
    window.addEventListener('focus', check)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener('focus', check)
    }
  }, [])

  const s = STATES[status]
  return (
    <span
      title={s.title}
      role="status"
      className="flex items-center gap-1.5 rounded-md border border-surface-600 px-2 py-1 text-[11px] text-gray-400"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
