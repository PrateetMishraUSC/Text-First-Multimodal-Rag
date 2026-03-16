---
title: DocuChat
emoji: 📄
colorFrom: indigo
colorTo: purple
sdk: docker
pinned: false
---

# DocuChat — Text-First Multimodal RAG System

A full-stack RAG (Retrieval-Augmented Generation) system that lets you upload PDFs and chat with them in real time. DocuChat goes beyond plain text — it extracts tables and figures from your documents, indexes them as searchable knowledge, and streams LLM-powered answers with full source citations.

**Live Demo:** [DocuChat on Hugging Face Spaces](https://huggingface.co/spaces/prateetm/docuchat)

**Stack:** Python · FastAPI · FAISS · LangChain · Groq · Sentence Transformers · PyMuPDF · React · Vite · Docker

---

## What It Does

- **Upload PDFs** — supports up to 5 files per session, each up to 10MB
- **Multimodal extraction** — parses text, tables (as markdown), and figures (as OCR text) from every page
- **Semantic search** — embeds all chunk types into a single FAISS vector index using Sentence Transformers
- **Streaming answers** — streams LLaMA 3.1 responses token-by-token over Server-Sent Events via Groq
- **Source citations** — every answer links back to the exact chunk (with page number and chunk type) it was drawn from
- **Relevance filtering** — out-of-scope or off-topic queries are caught before reaching the LLM using L2 distance thresholds
- **Session isolation** — each user gets their own FAISS index; a shared embedding model keeps memory usage low across concurrent sessions

---

## Project Structure

```
RAG/
├── app.py                  # FastAPI app — routes, session management, SSE streaming
├── main.py                 # Entrypoint
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container config for Hugging Face Spaces / Railway
├── .env.example            # Environment variable template
├── src/
│   ├── multimodal_extractor.py   # PyMuPDF-based text, table, and figure extraction
│   ├── embeddings.py             # Sentence Transformers embedding logic
│   ├── vectorstore.py            # FAISS index build, save, and load
│   ├── search.py                 # Semantic search with relevance threshold filtering
│   └── data_loader.py            # PDF loading utilities
└── frontend/
    ├── src/                      # React + TypeScript components
    ├── vite.config.ts
    └── dist/                     # Built static files served by FastAPI
```

---

## How It Works

### 1. Document Ingestion
When you upload a PDF, the backend:
1. Extracts text blocks, tables (converted to markdown), and figures (OCR'd to text) using **PyMuPDF**
2. Splits content into chunks with metadata: `chunk_type`, `page_number`, `source_file`
3. Embeds all chunks using **`all-MiniLM-L6-v2`** (Sentence Transformers)
4. Stores embeddings in a session-specific **FAISS** flat L2 index

### 2. Query & Retrieval
When you send a message:
1. The query is embedded using the same shared model
2. FAISS returns the top-5 most similar chunks by L2 distance
3. A relevance threshold filters out chunks that are too distant — if nothing passes, the LLM is told there is no relevant context
4. Passing chunks are assembled into a prompt with source metadata

### 3. Streaming Response
1. The prompt is sent to **LLaMA 3.1** via **Groq's API** using LangChain
2. The response streams token-by-token back to the frontend over **Server-Sent Events (SSE)**
3. Source citations (file name, page, chunk type) are appended after the stream completes

---

## Running Locally

### Prerequisites
- Python 3.12+
- Node.js 18+
- A free [Groq API key](https://console.groq.com)

### 1. Clone the repo
```bash
git clone https://github.com/your-username/docuchat.git
cd docuchat
```

### 2. Set up the backend
```bash
# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your Groq API key:
# GROQ-API-KEY=your_key_here
```

### 3. Set up the frontend
```bash
cd frontend
npm install
npm run build       # Builds static files into frontend/dist/
cd ..
```

### 4. Run the app
```bash
# Set SERVE_FRONTEND=true so FastAPI serves the built React app
SERVE_FRONTEND=true uvicorn app:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

> **Dev mode (hot reload on both ends):**
> Run `uvicorn app:app --reload --port 8000` in one terminal and `cd frontend && npm run dev` in another. The Vite dev server proxies API calls to FastAPI.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ-API-KEY` | Yes | Your Groq API key — get one free at [console.groq.com](https://console.groq.com) |
| `SERVE_FRONTEND` | No | Set to `true` to serve the built React app from FastAPI (used in production) |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins for local dev (e.g. `http://localhost:5173`) |

---

## Running with Docker

```bash
# Build the image
docker build -t docuchat .

# Run with your API key
docker run -p 7860:7860 -e GROQ-API-KEY=your_key_here docuchat
```

Open [http://localhost:7860](http://localhost:7860).

---

## Deployment

The app is deployed on **Hugging Face Spaces** using the Docker SDK. The `README.md` frontmatter at the top of this file configures the Space automatically.

To deploy your own:
1. Fork this repo
2. Create a new Space on [huggingface.co/spaces](https://huggingface.co/spaces) with **Docker** as the SDK
3. Push the repo — Hugging Face builds and runs the Dockerfile automatically
4. Add `GROQ-API-KEY` as a Space Secret in the Space settings

---

## Limitations

- **Session-based storage** — uploaded files and indexes are stored in memory/disk per session and cleaned up after 24 hours
- **PDF only** — currently supports `.pdf` files only
- **Max 5 files / 10MB per file** per session
- **No persistent chat history** — conversations reset on page refresh

---

## Tech Stack

| Layer | Technology |
|---|---|
| LLM | LLaMA 3.1 via Groq API |
| Orchestration | LangChain |
| Embeddings | Sentence Transformers (`all-MiniLM-L6-v2`) |
| Vector Store | FAISS (flat L2 index) |
| PDF Extraction | PyMuPDF |
| Backend | FastAPI + Uvicorn |
| Streaming | Server-Sent Events (SSE) |
| Frontend | React + TypeScript + Vite |
| Containerization | Docker |
| Hosting | Hugging Face Spaces |
