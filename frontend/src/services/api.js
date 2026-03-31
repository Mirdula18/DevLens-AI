/**
 * Centralised Axios-based API service.
 *
 * Every function returns the relevant data portion of the response
 * and throws on non-2xx status codes (Axios default).
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

/**
 * Request an AI explanation of *code*.
 * @param {string} code
 * @param {'normal'|'eli5'|'review'|'optimize'} mode
 * @param {string} model
 */
export async function explainCode(code, mode = 'normal', model = 'mistral') {
  const { data } = await api.post('/explain', { code, mode, model })
  return data
}

/** Detect confusing / complex sections in *code*. */
export async function detectConfusion(code, model = 'mistral') {
  const { data } = await api.post('/explain/confusion', { code, model })
  return data
}

/** Generate a high-level project summary. */
export async function generateSummary(model = 'mistral') {
  const { data } = await api.post('/summary', { model })
  return data
}

/**
 * Send a chat question to the RAG endpoint.
 * @param {string} question
 * @param {number} topK
 * @param {string} model
 */
export async function sendChatMessage(question, topK = 5, model = 'mistral') {
  const { data } = await api.post('/chat', { question, top_k: topK, model })
  return data
}
