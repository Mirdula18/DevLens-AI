# DevLens AI 

**DevLens AI** is an offline, AI-powered codebase explainer — a mini GitHub Copilot that runs entirely on your machine. Load any local project folder and get instant AI explanations, code reviews, optimization suggestions, and a codebase Q&A chatbot, all powered by a local LLM (Ollama).

---

## Features

| Feature | Description |
|---|---|
| 📁 Project Upload | Point to any local folder; backend scans recursively |
| 🌲 File Tree | VS Code-style expandable file explorer |
| 🖥 Code Viewer | Syntax-highlighted file viewer |
| ✨ AI Explanation | Four modes: Normal · ELI5 · Code Review · Optimize |
| 📋 Project Summary | Full codebase architecture overview |
| 💬 Codebase Chat | RAG-powered Q&A ("Where is auth handled?") |
| 🔎 Confusion Detector | Highlights complex sections and simplifies them |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS + Axios |
| Backend | Python + FastAPI + Uvicorn |
| AI | Ollama (Mistral / LLaMA3) |
| RAG | FAISS + sentence-transformers |

---

## Folder Structure

```
devlens-ai/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt
│   ├── routes/
│   │   ├── upload.py        # POST /upload
│   │   ├── tree.py          # GET  /tree
│   │   ├── file.py          # GET  /file
│   │   ├── explain.py       # POST /explain  &  /explain/confusion
│   │   ├── summary.py       # POST /summary
│   │   └── chat.py          # POST /chat
│   ├── services/
│   │   ├── file_parser.py   # Recursive folder scan → JSON tree
│   │   ├── llm_service.py   # Ollama HTTP integration + prompt templates
│   │   └── rag_service.py   # FAISS index, chunking, retrieval
│   └── utils/
│       └── file_utils.py    # Allowed extensions, safe file read
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── FileTree.jsx
        │   ├── CodeViewer.jsx
        │   ├── ModeSelector.jsx
        │   ├── ExplanationPanel.jsx
        │   ├── ChatPanel.jsx
        │   └── LoadingSpinner.jsx
        ├── services/
        │   └── api.js
        └── styles/
            └── index.css
```

---

## Setup Instructions

### 1. Install Ollama and pull a model

```bash
# Install Ollama (https://ollama.com)
curl -fsSL https://ollama.com/install.sh | sh

# Pull Mistral (recommended, ~4 GB)
ollama pull mistral

# Or LLaMA3
ollama pull llama3

# Start the Ollama server (runs on port 11434 by default)
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

### 4. Use DevLens AI

1. Enter the **absolute path** to any local project folder in the sidebar input.
2. Click **Load Project** — the file tree will appear.
3. Click any file to view its source code.
4. Choose an explanation **mode** (Explain / ELI5 / Review / Optimize).
5. Click **✨ Explain File** to get an AI explanation.
6. Click **📋 Project Summary** to analyse the whole codebase.
7. Switch to the **💬 Chat** tab and ask natural-language questions.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/upload` | Register a project folder `{ "path": "/abs/path" }` |
| GET | `/tree` | Get file-tree JSON |
| GET | `/file?path=<rel>` | Get file content |
| POST | `/explain` | Explain code `{ "code", "mode", "model" }` |
| POST | `/explain/confusion` | Detect confusing sections `{ "code" }` |
| POST | `/summary` | Generate project summary `{ "model" }` |
| POST | `/chat` | RAG Q&A `{ "question", "top_k", "model" }` |
| GET | `/health` | Liveness probe |

---

## Notes

- Everything runs **100% offline** after initial setup.
- The RAG index is built automatically the first time you use the Chat feature.
- Only files ≤ 100 KB are read; `node_modules`, `.git`, and build dirs are skipped.
