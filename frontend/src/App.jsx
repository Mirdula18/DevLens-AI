/**
 * App – root component.
 *
 * Layout (dark, two-column):
 * ┌─────────────┬──────────────────────┬──────────────────────┐
 * │  Sidebar    │   CodeViewer         │  ExplanationPanel    │
 * │  (file tree)│   (file content)     │  (AI explanations)   │
 * └─────────────┴──────────────────────┴──────────────────────┘
 *
 * A bottom "Chat" tab toggles the ChatPanel.
 */
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import CodeViewer from './components/CodeViewer'
import ExplanationPanel from './components/ExplanationPanel'
import ChatPanel from './components/ChatPanel'
import ModeSelector from './components/ModeSelector'
import ModelSelector from './components/ModelSelector'
import Icon from './components/icons'

import {
  uploadProject,
  fetchTree,
  fetchFile,
  explainCode,
  detectConfusion,
  generateSummary,
  fetchModels,
} from './services/api'

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

  // Explanation / model state
  const [mode, setMode] = useState('normal')
  const [availableModels, setAvailableModels] = useState(['mistral'])
  const [model, setModel] = useState('mistral')
  const [explanation, setExplanation] = useState('')
  const [confusionAnalysis, setConfusionAnalysis] = useState('')
  const [summary, setSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  // Panel tab: 'explain' | 'chat'
  const [activePanel, setActivePanel] = useState('explain')

  // ── Handlers ────────────────────────────────────────────────────────────────

  // Load the available models from Ollama on startup
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const data = await fetchModels()
        if (!active) return
        if (data.models?.length) {
          setAvailableModels(data.models)
          setModel(data.models[0])
        }
      } catch {
        // Ollama unavailable – keep the fallback default
      }
    })()
    return () => {
      active = false
    }
  }, [])

  async function handleUpload(path) {
    setUploadStatus({ loading: true, error: null, projectName: '' })
    setTree([])
    setSelectedPath('')
    setFileContent('')
    setExplanation('')
    setConfusionAnalysis('')
    setSummary('')

    try {
      const uploadResult = await uploadProject(path)
      const treeResult = await fetchTree()
      setProjectRoot(path)
      setTree(treeResult.tree ?? [])
      setUploadStatus({ loading: false, error: null, projectName: uploadResult.root })
    } catch (err) {
      setUploadStatus({
        loading: false,
        error: err.response?.data?.detail ?? err.message,
        projectName: '',
      })
    }
  }

  async function handleFileClick(relativePath) {
    setSelectedPath(relativePath)
    setFileLoading(true)
    setExplanation('')
    setConfusionAnalysis('')
    setAiError(null)

    try {
      const data = await fetchFile(relativePath)
      setFileContent(data.content)
      setFileName(data.name)
    } catch (err) {
      setFileContent(`Error loading file: ${err.response?.data?.detail ?? err.message}`)
      setFileName(relativePath.split('/').pop())
    } finally {
      setFileLoading(false)
    }
  }

  async function handleExplain() {
    if (!fileContent) return
    setAiLoading(true)
    setAiError(null)
    setExplanation('')
    setConfusionAnalysis('')
    setSummary('')
    setActivePanel('explain')

    try {
      const data = await explainCode(fileContent, mode, model)
      setExplanation(data.explanation)
    } catch (err) {
      setAiError(err.response?.data?.detail ?? err.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleDetectConfusion() {
    if (!fileContent) return
    setAiLoading(true)
    setAiError(null)
    setExplanation('')
    setConfusionAnalysis('')
    setSummary('')
    setActivePanel('explain')

    try {
      const data = await detectConfusion(fileContent, model)
      setConfusionAnalysis(data.confusion_analysis)
    } catch (err) {
      setAiError(err.response?.data?.detail ?? err.message)
    } finally {
      setAiLoading(false)
    }
  }

  async function handleSummary() {
    setAiLoading(true)
    setAiError(null)
    setExplanation('')
    setConfusionAnalysis('')
    setSummary('')
    setActivePanel('explain')

    try {
      const data = await generateSummary(model)
      setSummary(data.summary)
    } catch (err) {
      setAiError(err.response?.data?.detail ?? err.message)
    } finally {
      setAiLoading(false)
    }
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
          <ModelSelector
            models={availableModels}
            value={model}
            onChange={setModel}
          />
          <div className="flex gap-1">
            {[
              { id: 'explain', label: 'Explain', Icon: Icon.Sparkles },
              { id: 'chat', label: 'Chat', Icon: Icon.Message },
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
        />

        {/* Code viewer */}
        <main className="flex flex-1 flex-col overflow-hidden border-r border-surface-600">
          {fileLoading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-sm text-gray-500">Loading file…</span>
            </div>
          ) : (
            <CodeViewer fileName={fileName} content={fileContent} />
          )}
        </main>

        {/* Right panel */}
        <aside className="flex w-96 flex-shrink-0 flex-col overflow-hidden">
          {activePanel === 'explain' ? (
            <>
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
                hasFile={hasFile}
                hasProject={hasProject}
              />
            </>
          ) : (
            <ChatPanel hasProject={hasProject} model={model} />
          )}
        </aside>
      </div>
    </div>
  )
}
