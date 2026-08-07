# DevLens AI

**DevLens AI** is an offline, AI-powered codebase explainer that runs entirely on your machine. Load any local project folder and get instant AI explanations, code reviews, optimization suggestions, and codebase Q&A — all powered by a local LLM (Ollama). No code ever leaves your computer.

---

## Features

| Feature | Description |
|---|---|
| Project Upload | Point to any local folder; the backend scans it recursively |
| File Tree | VS Code-style expandable file explorer |
| Code Viewer | Syntax-highlighted file viewer with all major languages |
| AI Explanation | Four modes: Explain · ELI5 · Code Review · Optimization |
| Project Summary | High-level codebase architecture overview |
| Codebase Chat | RAG-powered Q&A (e.g. "Where is authentication handled?") |
| Confusion Detector | Highlights complex sections and simplifies them |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Axios |
| Backend | Python, FastAPI, Uvicorn |
| AI | Ollama (Mistral, Llama, Gemma, and others) |
| RAG | FAISS, sentence-transformers |

---

## Architecture

The application is split into two independent services:

- **Backend** (`FastAPI`) — accepts a project path, builds a file tree, reads file contents, and proxies requests to the local Ollama model. It includes a Retrieval-Augmented Generation (RAG) pipeline that indexes the codebase with FAISS and answers natural-language questions.
- **Frontend** (`React + Vite`) — a dark, split-pane UI with a file explorer, code viewer, AI explanation panel, and a chat tab. The Vite dev server proxies API calls to the backend.

---

## Folder Structure

```
devlens-ai/
├── backend/
│   ├── main.py                 # FastAPI app entry point
│   ├── requirements.txt
│   ├── routes/
│   │   ├── upload.py           # POST /upload
│   │   ├── tree.py             # GET  /tree
│   │   ├── file.py             # GET  /file
│   │   ├── explain.py          # POST /explain and /explain/confusion
│   │   ├── summary.py          # POST /summary
│   │   ├── chat.py             # POST /chat (RAG Q&A)
│   │   └── models.py           # GET  /models
│   ├── services/
│   │   ├── file_parser.py      # Recursive folder scan → JSON tree + flat list
│   │   ├── llm_service.py      # Ollama HTTP integration + prompt templates
│   │   └── rag_service.py      # FAISS index, chunking, retrieval
│   └── utils/
│       └── file_utils.py       # Allowed extensions, size limits, safe reads
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js           # Dev proxy to the backend
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── FileTree.jsx
        │   ├── CodeViewer.jsx
        │   ├── ModeSelector.jsx
        │   ├── ModelSelector.jsx
        │   ├── ExplanationPanel.jsx
        │   ├── ChatPanel.jsx
        │   ├── LoadingSpinner.jsx
        │   └── icons.jsx        # Shared SVG icon set
        ├── services/
        │   └── api.js
        └── styles/
            └── index.css
```

---

## Setup Instructions

### 1. Install Ollama and pull a model

DevLens AI uses [Ollama](https://ollama.com) to run a model locally.

```bash
# Install Ollama (https://ollama.com)
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model (Mistral recommended, ~4 GB; Llama 3 and Gemma also work)
ollama pull mistral

# Start the Ollama server (listens on port 11434 by default)
ollama serve
```

### 2. Set up the backend

```bash
cd backend

# (optional) create a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

### 4. Configuration

The backend reads the following environment variables (with sensible defaults):

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Base URL of the Ollama server |
| `OLLAMA_MODEL` | `mistral` | Default model used when none is selected |

The model dropdown in the app header is populated automatically from the models installed in Ollama. You can switch the active model at any time; your selection is applied to explanations, reviews, project summaries, and chat.

### 5. Use DevLens AI

1. Enter the **absolute path** to any local project folder in the sidebar.
2. Click **Load Project** — the file tree appears in the sidebar.
3. Click any file to view its source code.
4. Choose an explanation **mode** (Explain / ELI5 / Review / Optimize).
5. Click **Explain File** to generate an AI explanation.
6. Click **Project Summary** to analyse the whole codebase.
7. Switch to the **Chat** tab and ask natural-language questions.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Register a project folder `{ "path": "/abs/path" }` |
| GET | `/tree` | Get the file-tree JSON |
| GET | `/file?path=<rel>` | Get a file's content |
| POST | `/explain` | Explain code `{ "code", "mode", "model" }` |
| POST | `/explain/confusion` | Detect confusing sections `{ "code" }` |
| POST | `/summary` | Generate a project summary `{ "model" }` |
| POST | `/chat` | RAG Q&A `{ "question", "top_k", "model" }` |
| GET | `/models` | List installed models and the default |
| GET | `/health` | Liveness probe |

---

## Security & Constraints

- Files are filtered by an allowlist of source-code extensions and a 100 KB size limit.
- The `/file` endpoint resolves paths safely and rejects path-traversal attempts (HTTP 403).
- Code sent to the model is capped to 50,000 characters; RAG context is capped at 30,000 characters to stay within prompt budgets.
- The model selection and all AI features run against your local Ollama instance; no code is transmitted over the network.