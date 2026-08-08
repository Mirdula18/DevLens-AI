/**
 * API service.
 *
 * - JSON requests (upload, tree, file, models) use Axios.
 * - LLM requests (explain / confusion / summary / chat) stream results
 *   token-by-token over Server-Sent Events via fetch, so the UI can render
 *   progressively instead of waiting for the full response.
 */

import axios from 'axios'

// During dev Vite proxies /upload, /tree, etc. to localhost:8000
const api = axios.create({ baseURL: '/' })

/** Upload (register) a project folder by its absolute path. */
export async function uploadProject(path) {
  const { data } = await api.post('/upload', { path })
  return data
}

/** Fetch the file-tree for the currently loaded project. */
export async function fetchTree() {
  const { data } = await api.get('/tree')
  return data
}

/** Fetch the content of a single file (relative path). */
export async function fetchFile(path) {
  const { data } = await api.get('/file', { params: { path } })
  return data
}

/** Fetch the list of models available in Ollama. */
export async function fetchModels() {
  const { data } = await api.get('/models')
  return data
}

/**
 * Stream a POST request over Server-Sent Events.
 *
 * @param {string} path   API path
 * @param {object} body   JSON payload
 * @param {object} handlers
 *   onToken(t)   – called for each streamed token
 *   onSources(s) – called once with the source-file array (chat only)
 *   onError(e)   – called on SSE or HTTP errors
 * @returns {Promise<void>} resolves when the stream finishes
 */
async function requestStream(path, body, { onToken, onSources, onError } = {}) {
  let resp
  try {
    resp = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    onError?.(err)
    throw err
  }

  if (!resp.ok) {
    let message = `Request failed (${resp.status})`
    try {
      const data = await resp.json()
      if (data.detail) message = data.detail
      else if (Array.isArray(data.details)) message = data.details.map(d => d.message).join('; ')
    } catch {
      /* keep fallback message */
    }
    const err = new Error(message)
    onError?.(err)
    throw err
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE messages are separated by a blank line
    let idx = buffer.indexOf('\n\n')
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 2)

      const line = chunk.split('\n').find(l => l.startsWith('data:'))
      if (line) {
        let evt
        try {
          evt = JSON.parse(line.slice(5).trim())
        } catch {
          continue
        }
        if (evt.type === 'token') onToken?.(evt.data ?? '')
        else if (evt.type === 'sources') onSources?.(evt.data ?? [])
        else if (evt.type === 'error') {
          const err = new Error(evt.data ?? 'LLM error')
          onError?.(err)
        }
      }

      idx = buffer.indexOf('\n\n')
    }
  }
}

/**
 * Stream an AI explanation of *code* in the given *mode*.
 * @param {{code: string, mode: string, model: string}} payload
 * @param {object} handlers – see requestStream
 */
export function streamExplain({ code, mode = 'normal', model }, handlers) {
  return requestStream('/explain', { code, mode, model }, handlers)
}

/** Stream a confusion analysis of *code*. */
export function streamConfusion({ code, model }, handlers) {
  return requestStream('/explain/confusion', { code, model }, handlers)
}

/** Stream a high-level project summary. */
export function streamSummary({ model }, handlers) {
  return requestStream('/summary', { model }, handlers)
}

/** Stream an answer to a codebase question. */
export function streamChat({ question, topK = 5, model }, handlers) {
  return requestStream('/chat', { question, top_k: topK, model }, handlers)
}