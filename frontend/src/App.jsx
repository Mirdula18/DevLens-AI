/**
 * App – root component.
 *
 * Layout (dark, three-column):
 * ┌─────────────┬──────────────────────┬──────────────────────┐
 * │  Sidebar    │   CodeViewer         │  ExplanationPanel    │
 * │  (file tree)│   (file content)     │  / Chat / Insights   │
 * └─────────────┴──────────────────────┴──────────────────────┘
 *
 * The header tabs switch the right panel between Explain, Chat and Insights.
 */
import { useCallback, useState, useEffect, useRef } from 'react'
import Sidebar from './components/Sidebar'
import CodeViewer from './components/CodeViewer'
import ExplanationPanel from './components/ExplanationPanel'
import ChatPanel from './components/ChatPanel'
import InsightsPanel from './components/InsightsPanel'
import ModeSelector from './components/ModeSelector'
import ModelSelector from './components/ModelSelector'
import StatusIndicator from './components/StatusIndicator'
import Icon from './components/icons'

import {
  uploadProject,
  fetchTree,
  fetchFile,
  fetchModels,
  streamExplain,
  streamConfusion,
  streamSummary,
} from './services/api'
import { loadPref, savePref } from './utils/storage'

export default function App() {
  // Project state
  const [tree, setTree] = useState([])
  const [projectRoot, setProjectRoot] = useState('')
  const [uploadStatus, setUploadStatus] = useState({ loading: false, error: null, projectName: '' })

  // File viewer state
  const [selectedPath, setSelectedPath] = useState('')
  const [fileContent, setFileContent] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileLoading, setFileLoading] = useState(false)
  const [highlight, setHighlight] = useState(null)

  // Explanation / model state
  const [mode, setMode] = useState('normal')
  const [model, setModel] = useState(() => loadPref('model', 'mistral'))
  const [availableModels, setAvailableModels] = useState(() => [model])
  const [explanation, setExplanation] = useState('')
  const [confusionAnalysis, setConfusionAnalysis] = useState('')
  const [summary, setSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Panel tab: 'explain' | 'chat' | 'insights'
  const [activePanel, setActivePanel] = useState('explain')

  // Controller for the in-flight explain / confusion / summary stream
  const streamRef = useRef(null)

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Load the models installed in Ollama, keeping the remembered choice
  // when it is still available, else the server default, else the first.
  const loadModels = useCallback(async () => {
    try {
      const data = await fetchModels()
      if (!data.models?.length) return
      setAvailableModels(data.models)
      setModel(current => {
        const saved = loadPref('model')
        if (data.models.includes(saved)) return saved
        if (data.models.includes(current)) return current
        return data.models.includes(data.default) ? data.default : data.models[0]
      })
    } catch {
      // Ollama unavailable – keep the fallback default
    }
  }, [])

  useEffect(() => {
    loadModels()
  }, [loadModels])

  function handleModelChange(next) {
    setModel(next)
    savePref('model', next)
  }

  // Cancel any running stream when the app unmounts
  useEffect(() => () => streamRef.current?.abort(), [])

  /** Abort the running AI stream (if any), keeping the text received so far. */
  function stopStream() {
    streamRef.current?.abort()
    streamRef.current = null
    setAiLoading(false)
  }

  /** Abort the running AI stream (if any) and clear its results. */
  function resetAi() {
    stopStream()
    setAiError(null)
    setExplanation('')
    setConfusionAnalysis('')
    setSummary('')
  }

  /**
   * Run one AI stream, appending tokens via *setText*. Starting a new stream
   * cancels the previous one so stale tokens never leak into the new view.
   */
  async function runStream(start, setText) {
    resetAi()
    setActivePanel('explain')
    setAiLoading(true)

    const controller = new AbortController()
    streamRef.current = controller
    const live = () => streamRef.current === controller

    try {
      await start({
        signal: controller.signal,
        onToken: token => live() && setText(prev => prev + token),
        onError: err => live() && setAiError(err.message),
      })
    } catch (err) {
      if (live()) setAiError(err.message)
    } finally {
      if (live()) {
        streamRef.current = null
        setAiLoading(false)
      }
    }
  }

  async function handleUpload(path) {
    resetAi()
    setUploadStatus({ loading: true, error: null, projectName: '' })
    setTree([])
    setSelectedPath('')
    setHighlight(null)
    setFileContent('')
    setFileName('')

    try {
      const uploadResult = await uploadProject(path)
      const treeResult = await fetchTree()
      savePref('projectPath', path)
      setProjectRoot(uploadResult.path ?? path)
      setTree(treeResult.tree ?? [])
      setUploadStatus({ loading: false, error: null, projectName: uploadResult.root })
    } catch (err) {
      setProjectRoot('')
      setUploadStatus({
        loading: false,
        error: formatError(err),
        projectName: '',
      })
    }
  }

  /**
   * Open *relativePath* in the code viewer, optionally highlighting a
   * `{ start, end }` line range (used by chat citations).
   */
  async function handleFileClick(relativePath, highlightRange = null) {
    setHighlight(highlightRange)
    // Re-opening the current file (e.g. another citation in it) only moves the highlight
    if (relativePath === selectedPath && fileContent && !fileLoading) return

    resetAi()
    setSelectedPath(relativePath)
    setFileLoading(true)

    try {
      const data = await fetchFile(relativePath)
      setFileContent(data.content)
      setFileName(data.name)
    } catch (err) {
      setFileContent(`Error loading file: ${formatError(err)}`)
      setFileName(relativePath.split('/').pop())
    } finally {
      setFileLoading(false)
    }
  }

  function handleExplain() {
    if (!fileContent) return
    runStream(
      handlers => streamExplain({ code: fileContent, mode, model }, handlers),
      setExplanation,
    )
  }

  function handleDetectConfusion() {
    if (!fileContent) return
    runStream(
      handlers => streamConfusion({ code: fileContent, model }, handlers),
      setConfusionAnalysis,
    )
  }

  function handleSummary() {
    runStream(handlers => streamSummary({ model }, handlers), setSummary)
  }

  const hasProject = Boolean(projectRoot)
  const hasFile = Boolean(fileContent && !fileLoading)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-900 text-gray-100">
      {/* ── Top bar ── */}
      <header className="flex items-center justify-between border-b border-surface-600 bg-surface-800 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Icon.Logo className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold leading-tight text-gray-100">DevLens AI</h1>
            <span className="text-[11px] leading-tight text-gray-500">Offline AI Code Explainer</span>
          </div>
        </div>
        {/* Panel toggle */}
        <div className="flex items-center gap-3">
          <StatusIndicator onRecover={loadModels} />
          <ModelSelector
            models={availableModels}
            value={model}
            onChange={handleModelChange}
          />
          <div className="flex gap-1">
            {[
              { id: 'explain', label: 'Explain', Icon: Icon.Sparkles },
              { id: 'chat', label: 'Chat', Icon: Icon.Message },
              { id: 'insights', label: 'Insights', Icon: Icon.Chart },
            ].map(({ id, label, Icon: PanelIcon }) => (
              <button
                key={id}
                onClick={() => setActivePanel(id)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  activePanel === id
                    ? 'bg-accent text-white'
                    : 'text-gray-400 hover:bg-surface-700 hover:text-white'
                }`}
              >
                <PanelIcon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          tree={tree}
          selectedPath={selectedPath}
          onFileClick={handleFileClick}
          onUpload={handleUpload}
          uploadStatus={uploadStatus}
          initialPath={loadPref('projectPath')}
        />

        {/* Code viewer */}
        <main className="flex flex-1 flex-col overflow-hidden border-r border-surface-600">
          {fileLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-gray-500">Loading file…</span>
            </div>
          ) : (
            <CodeViewer fileName={fileName} content={fileContent} highlight={highlight} />
          )}
        </main>

        {/* Right panel – both panels stay mounted so chat history and
            in-flight streams survive switching tabs */}
        <aside className="flex w-96 flex-shrink-0 flex-col overflow-hidden">
          <div className={activePanel === 'explain' ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <ModeSelector mode={mode} onChange={setMode} />
            <ExplanationPanel
              explanation={explanation}
              confusionAnalysis={confusionAnalysis}
              summary={summary}
              loading={aiLoading}
              error={aiError}
              mode={mode}
              onExplain={handleExplain}
              onDetectConfusion={handleDetectConfusion}
              onSummary={handleSummary}
              onStop={stopStream}
              hasFile={hasFile}
              hasProject={hasProject}
              fileName={fileName}
              projectName={uploadStatus.projectName}
            />
          </div>
          {/* Keyed by project so loading a new project starts fresh */}
          <div className={activePanel === 'chat' ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <ChatPanel
              key={projectRoot}
              hasProject={hasProject}
              projectName={uploadStatus.projectName}
              model={model}
              onOpenSource={s => handleFileClick(s.path, { start: s.start_line, end: s.end_line })}
            />
          </div>
          <div className={activePanel === 'insights' ? 'flex h-full flex-col overflow-hidden' : 'hidden'}>
            <InsightsPanel
              key={projectRoot}
              active={activePanel === 'insights'}
              hasProject={hasProject}
              onOpenFile={path => handleFileClick(path)}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

/** Extract a readable message from an Axios / fetch error. */
function formatError(err) {
  const data = err.response?.data
  if (typeof data?.detail === 'string') return data.detail
  if (Array.isArray(data?.details)) return data.details.map(d => d.message).join('; ')
  return err.message
}
