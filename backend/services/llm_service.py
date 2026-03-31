"""
LLM service – wraps the local Ollama HTTP API.

All prompts are sent to http://localhost:11434/api/generate and the
response is streamed back and then returned as a single string.
"""

import httpx

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "mistral"

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

    Uses streaming internally but collects all chunks before returning.
    Raises httpx.HTTPError on network / server errors.
    """
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(OLLAMA_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        return data.get("response", "").strip()


# ── Public helpers ────────────────────────────────────────────────────────────

async def explain_code(code: str, mode: str = "normal", model: str = DEFAULT_MODEL) -> str:
    """Return an AI explanation of *code* using the selected *mode*."""
    template = MODE_PROMPTS.get(mode, _EXPLAIN_NORMAL)
    prompt = template.format(code=code)
    return await generate(prompt, model)


async def summarise_project(snapshot: str, model: str = DEFAULT_MODEL) -> str:
    """Return a high-level project summary from a codebase *snapshot*."""
    prompt = _PROJECT_SUMMARY.format(snapshot=snapshot)
    return await generate(prompt, model)


async def detect_confusion(code: str, model: str = DEFAULT_MODEL) -> str:
    """Identify and explain the most confusing parts of *code*."""
    prompt = _CONFUSION_DETECT.format(code=code)
    return await generate(prompt, model)


async def answer_with_rag(question: str, context: str, model: str = DEFAULT_MODEL) -> str:
    """Answer *question* using the RAG-retrieved *context*."""
    prompt = _RAG_ANSWER.format(context=context, question=question)
    return await generate(prompt, model)
