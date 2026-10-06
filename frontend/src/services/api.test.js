import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamChat, streamExplain } from './api'

/** Build a fetch Response whose body streams *chunks* one by one. */
function sseResponse(chunks, init = {}) {
  const encoder = new TextEncoder()
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' }, ...init })
}

const event = obj => `data: ${JSON.stringify(obj)}\n\n`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestStream (via streamChat / streamExplain)', () => {
  it('delivers tokens and sources in order', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      event({ type: 'token', data: 'Hello' }),
      event({ type: 'token', data: ' world' }),
      event({ type: 'sources', data: ['a.py'] }),
      event({ type: 'done' }),
    ])))

    const tokens = []
    const onSources = vi.fn()
    await streamChat({ question: 'q', model: 'm' }, { onToken: t => tokens.push(t), onSources })

    expect(tokens.join('')).toBe('Hello world')
    expect(onSources).toHaveBeenCalledWith(['a.py'])
    const [url, opts] = fetch.mock.calls[0]
    expect(url).toBe('/chat')
    expect(JSON.parse(opts.body)).toEqual({ question: 'q', top_k: 5, model: 'm' })
  })

  it('reassembles events split across network chunks', async () => {
    const full = event({ type: 'token', data: 'héllo' }) + event({ type: 'token', data: '!' })
    const pieces = [full.slice(0, 7), full.slice(7, 25), full.slice(25)]
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse(pieces)))

    const tokens = []
    await streamExplain({ code: 'x', model: 'm' }, { onToken: t => tokens.push(t) })
    expect(tokens).toEqual(['héllo', '!'])
  })

  it('reports SSE error events through onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      event({ type: 'error', data: 'LLM error: boom' }),
      event({ type: 'done' }),
    ])))

    const onError = vi.fn()
    await streamExplain({ code: 'x', model: 'm' }, { onError })
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].message).toBe('LLM error: boom')
  })

  it('surfaces validation details from HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ error: 'validation_error', details: [{ message: 'Code must not be empty' }] }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )))

    const onError = vi.fn()
    await expect(streamExplain({ code: '', model: 'm' }, { onError })).rejects.toThrow('Code must not be empty')
    expect(onError).toHaveBeenCalledOnce()
  })

  it('ends quietly when aborted', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, { signal }) => {
      signal.throwIfAborted()
      return sseResponse([])
    }))

    const controller = new AbortController()
    controller.abort()
    const onError = vi.fn()
    await expect(streamChat({ question: 'q', model: 'm' }, { signal: controller.signal, onError })).resolves.toBeUndefined()
    expect(onError).not.toHaveBeenCalled()
  })
})
