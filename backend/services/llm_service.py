"""
LLM service – wraps the local Ollama HTTP API.

All prompts are sent to http://localhost:11434/api/generate and the
response is streamed back and then returned as a single string.
"""

import json
import os

import httpx

# Base URL can be overridden with the OLLAMA_URL env var (e.g. remote host)
OLLAMA_BASE_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434").rstrip("/")
OLLAMA_URL = f"{OLLAMA_BASE_URL}/api/generate"
OLLAMA_TAGS_URL = f"{OLLAMA_BASE_URL}/api/tags"

# Default model can be overridden with the OLLAMA_MODEL env var
DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")

# Shared HTTP client – reuses the TCP connection to Ollama across requests,
# removing per-request connection overhead.
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client  # noqa: PLW0603
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=180.0)
    return _client


def sse(event: dict) -> str:
    """Encode *event* as a single Server-Sent-Events message."""
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

# ── Prompt templates ────────────────────────────────────────────────────────

_EXPLAIN_NORMAL = """\
You are a senior software engineer.
Explain the following code clearly in a structured format.
Include:
- A short summary (1-2 sentences)
- A detailed explanation with bullet points
- What each major section does
- Any important patterns or concepts used

Code:
```
{code}
```
"""

_EXPLAIN_ELI5 = """\
You are a friendly teacher explaining code to a 5-year-old.
Use very simple words, fun analogies, and avoid all technical jargon.
Explain what this code does as if the reader has never programmed before.

Code:
```
{code}
```
"""

_EXPLAIN_REVIEW = """\
You are a strict senior code reviewer.
Review the following code and report:
- Bugs or logical errors
- Security vulnerabilities
- Bad practices or code smells
- Missing error handling
- Readability issues

Be concise and use numbered lists.

Code:
```
{code}
```
"""

_EXPLAIN_OPTIMIZE = """\
You are a performance-focused senior engineer.
Analyse the following code and suggest:
- Performance improvements
- Memory optimizations
- Cleaner / more idiomatic rewrites
- Better algorithms or data structures

Provide concrete, actionable suggestions with brief code examples where helpful.

Code:
```
{code}
```
"""

_PROJECT_SUMMARY = """\
You are a senior software architect.
Analyse the following codebase snapshot and generate a structured project report:

1. **What the project does** – one paragraph overview
2. **Tech stack** – list frameworks, languages, libraries detected
3. **Architecture overview** – how components fit together
4. **Important files and their roles** – bullet list

Codebase snapshot:
{snapshot}
"""

_CONFUSION_DETECT = """\
You are a code-clarity expert.
Review the following code and identify the TOP 3 most confusing or complex sections.
For each section:
- Quote the confusing code snippet (max 5 lines)
- Explain WHY it is confusing
- Provide a simplified plain-English explanation

Code:
```
{code}
```
"""

_RAG_ANSWER = """\
You are a senior software engineer helping a developer understand their codebase.
Use ONLY the context below to answer the question.
If the answer is not in the context, say "I could not find relevant information in the provided files."

Context (retrieved code snippets):
{context}

Question: {question}
"""

MODE_PROMPTS: dict[str, str] = {
    "normal": _EXPLAIN_NORMAL,
    "eli5": _EXPLAIN_ELI5,
    "review": _EXPLAIN_REVIEW,
    "optimize": _EXPLAIN_OPTIMIZE,
}


# ── Core LLM call ────────────────────────────────────────────────────────────

async def generate(prompt: str, model: str = DEFAULT_MODEL) -> str:
    """
    Send *prompt* to Ollama and return the complete response text.

    Raises httpx.HTTPError on network / server errors.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }

    response = await _get_client().post(OLLAMA_URL, json=payload)
    response.raise_for_status()
    data = response.json()
    return data.get("response", "").strip()


async def stream_generate(prompt: str, model: str = DEFAULT_MODEL):
    """
    Stream *prompt* to Ollama and yield each token as it is produced.

    Raises httpx.HTTPError on network / server errors.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": True,
    }

    async with _get_client().stream("POST", OLLAMA_URL, json=payload) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            token = data.get("response", "")
            if token:
                yield token
            if data.get("done"):
                break


# ── Prompt builders ──────────────────────────────────────────────────────────

def make_explain_prompt(code: str, mode: str = "normal") -> str:
    """Build the prompt for *mode* (used by both the JSON and streaming paths)."""
    template = MODE_PROMPTS.get(mode, _EXPLAIN_NORMAL)
    return template.format(code=code)


def make_summary_prompt(snapshot: str) -> str:
    return _PROJECT_SUMMARY.format(snapshot=snapshot)


def make_confusion_prompt(code: str) -> str:
    return _CONFUSION_DETECT.format(code=code)


def make_rag_prompt(question: str, context: str) -> str:
    return _RAG_ANSWER.format(context=context, question=question)


# ── Public helpers ────────────────────────────────────────────────────────────

async def list_models() -> list[str]:
    """
    Return the names of models available in Ollama.

    Falls back to the default model on network / server errors so the UI
    still has something to show if Ollama is unavailable.
    """
    try:
        response = await _get_client().get(OLLAMA_TAGS_URL)
        response.raise_for_status()
        data = response.json()
        models = [m.get("name") for m in data.get("models", [])]
        return [m for m in models if m]
    except Exception:  # noqa: BLE001
        return [DEFAULT_MODEL]


async def explain_code(code: str, mode: str = "normal", model: str = DEFAULT_MODEL) -> str:
    """Return an AI explanation of *code* using the selected *mode*."""
    return await generate(make_explain_prompt(code, mode), model)


async def summarise_project(snapshot: str, model: str = DEFAULT_MODEL) -> str:
    """Return a high-level project summary from a codebase *snapshot*."""
    return await generate(make_summary_prompt(snapshot), model)


async def detect_confusion(code: str, model: str = DEFAULT_MODEL) -> str:
    """Identify and explain the most confusing parts of *code*."""
    return await generate(make_confusion_prompt(code), model)


async def answer_with_rag(question: str, context: str, model: str = DEFAULT_MODEL) -> str:
    """Answer *question* using the RAG-retrieved *context*."""
    return await generate(make_rag_prompt(question, context), model)


# ── Streaming variants (used by the SSE endpoints) ──────────────────────────

async def stream_explain(code: str, mode: str = "normal", model: str = DEFAULT_MODEL):
    async for token in stream_generate(make_explain_prompt(code, mode), model):
        yield token


async def stream_summary(snapshot: str, model: str = DEFAULT_MODEL):
    async for token in stream_generate(make_summary_prompt(snapshot), model):
        yield token


async def stream_confusion(code: str, model: str = DEFAULT_MODEL):
    async for token in stream_generate(make_confusion_prompt(code), model):
        yield token


async def stream_rag(question: str, context: str, model: str = DEFAULT_MODEL):
    async for token in stream_generate(make_rag_prompt(question, context), model):
        yield token
