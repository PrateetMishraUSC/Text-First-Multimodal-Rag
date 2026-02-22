import os
import uuid
import asyncio
import shutil
import tempfile
import time
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from sentence_transformers import SentenceTransformer

from src.data_loader import load_single_file, SUPPORTED_EXTENSIONS
from src.vectorstore import FaissVectorStore
from src.search import RAGSearch

load_dotenv()

app = FastAPI(title="RAG Chat")

ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

shared_model: SentenceTransformer = None

UPLOAD_BASE = Path(tempfile.gettempdir()) / "rag_uploads"
STORE_BASE  = Path(tempfile.gettempdir()) / "rag_stores"
ASSETS_BASE = Path(tempfile.gettempdir()) / "rag_assets"

MAX_FILE_SIZE        = 10 * 1024 * 1024  
MAX_FILES_PER_SESSION = 5
SESSION_TTL_SECONDS  = 24 * 60 * 60      

sessions:      Dict[str, dict]           = {}
session_locks: Dict[str, asyncio.Lock]   = {}


@app.on_event("startup")
async def startup():
    global shared_model
    print("[INFO] Loading shared embedding model...")
    shared_model = SentenceTransformer("all-MiniLM-L6-v2")
    print("[INFO] Shared embedding model loaded.")
    asyncio.create_task(cleanup_old_sessions())


async def cleanup_old_sessions():
    """Background task: delete sessions older than 24 hours, runs hourly."""
    while True:
        await asyncio.sleep(3600)
        now = time.time()
        expired = [
            sid for sid, sdata in sessions.items()
            if now - sdata.get("created_at", now) > SESSION_TTL_SECONDS
        ]
        for sid in expired:
            print(f"[INFO] Cleaning up expired session: {sid}")
            session = sessions.pop(sid, None)
            session_locks.pop(sid, None)
            if session:
                upload_dir = session.get("upload_dir")
                if upload_dir and upload_dir.exists():
                    shutil.rmtree(upload_dir, ignore_errors=True)
                store_dir = STORE_BASE / sid
                if store_dir.exists():
                    shutil.rmtree(store_dir, ignore_errors=True)
                assets_dir = ASSETS_BASE / sid
                if assets_dir.exists():
                    shutil.rmtree(assets_dir, ignore_errors=True)
        if expired:
            print(f"[INFO] Cleaned up {len(expired)} expired sessions.")


def get_or_create_session(session_id: str) -> dict:
    if session_id not in sessions:
        session_dir = UPLOAD_BASE / session_id
        store_dir   = STORE_BASE  / session_id
        assets_dir  = ASSETS_BASE / session_id
        session_dir.mkdir(parents=True, exist_ok=True)
        store_dir.mkdir(parents=True, exist_ok=True)
        assets_dir.mkdir(parents=True, exist_ok=True)

        vs     = FaissVectorStore(persist_dir=str(store_dir), shared_model=shared_model)
        search = RAGSearch(vectorstore=vs)

        sessions[session_id] = {
            "vectorstore": vs,
            "search":      search,
            "upload_dir":  session_dir,
            "assets_dir":  assets_dir,
            "files":       [],
            "created_at":  time.time(),
        }
        session_locks[session_id] = asyncio.Lock()
    return sessions[session_id]


@app.post("/api/session")
async def create_session():
    session_id = uuid.uuid4().hex[:12]
    get_or_create_session(session_id)
    return {"session_id": session_id}


@app.post("/api/upload")
async def upload_file(
    file:       UploadFile = File(...),
    session_id: str        = Form(...),
):
    if not session_id:
        raise HTTPException(400, "session_id required")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Supported: {', '.join(SUPPORTED_EXTENSIONS)}")

    session = get_or_create_session(session_id)

    if len(session["files"]) >= MAX_FILES_PER_SESSION:
        raise HTTPException(400, f"Maximum {MAX_FILES_PER_SESSION} files per session. Please start a new session.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            400,
            f"File too large ({len(content) / (1024*1024):.1f} MB). "
            f"Maximum allowed is {MAX_FILE_SIZE / (1024*1024):.0f} MB."
        )

    dest = session["upload_dir"] / file.filename
    with open(dest, "wb") as f:
        f.write(content)

    lock = session_locks[session_id]
    async with lock:
        try:
            assets_dir = str(session["assets_dir"])
            result     = await asyncio.to_thread(load_single_file, str(dest), assets_dir)
            text_docs          = result["documents"]
            multimodal_chunks  = result["multimodal_chunks"]

            if text_docs:
                await asyncio.to_thread(session["vectorstore"].add_documents, text_docs)
            if multimodal_chunks:
                await asyncio.to_thread(session["vectorstore"].add_multimodal_chunks, multimodal_chunks)

            total_chunks = len(text_docs) + len(multimodal_chunks)
            session["files"].append({
                "name":      file.filename,
                "size":      len(content),
                "type":      ext.lstrip("."),
                "documents": total_chunks,
            })
        except Exception as e:
            raise HTTPException(500, f"Processing failed: {str(e)}")

    return {
        "status":           "success",
        "filename":         file.filename,
        "documents_loaded": total_chunks,
        "total_files":      len(session["files"]),
    }


@app.get("/api/chat")
async def chat_stream(query: str, session_id: str, top_k: int = 5):
    """SSE endpoint — GET so browser EventSource works natively."""
    if not session_id or session_id not in sessions:
        raise HTTPException(400, "Invalid session")

    session = sessions[session_id]
    search  = session["search"]

    if session["vectorstore"].index is None:
        raise HTTPException(400, "No documents uploaded yet. Please upload files first.")

    async def event_generator():
        async for event in search.stream_answer(query, top_k=top_k):
            yield event

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":    "no-cache",
            "Connection":       "keep-alive",
            "X-Accel-Buffering":"no",
        },
    )


@app.get("/api/health")
async def health():
    """Railway healthcheck endpoint."""
    return {"status": "ok", "model_loaded": shared_model is not None}


@app.get("/api/files")
async def list_files(session_id: str):
    if session_id not in sessions:
        return {"files": []}
    return {"files": sessions[session_id]["files"]}


@app.get("/api/assets/{filename:path}")
async def serve_asset(filename: str, session_id: str = ""):
    """Serve multimodal asset files (table screenshots, image thumbnails)."""
    if session_id and session_id in sessions:
        asset_path = sessions[session_id]["assets_dir"] / filename
        if asset_path.exists():
            return FileResponse(str(asset_path))

    for sid, sdata in sessions.items():
        asset_path = sdata["assets_dir"] / filename
        if asset_path.exists():
            return FileResponse(str(asset_path))

    raise HTTPException(404, "Asset not found")


# ─── Serve React Frontend (production) ────────────────────────────────────────
# When SERVE_FRONTEND=true (set by railway.toml), FastAPI serves the built
# React app from frontend/dist/.  All non-API routes fall through to index.html
# so React Router works correctly.

FRONTEND_DIST = Path(__file__).parent / "frontend" / "dist"

if os.getenv("SERVE_FRONTEND", "false").lower() == "true" and FRONTEND_DIST.exists():
    # Mount static assets (JS/CSS/images) at /assets
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_react(full_path: str):
        """Catch-all: serve index.html so React Router handles client-side nav."""
        index = FRONTEND_DIST / "index.html"
        if index.exists():
            return FileResponse(str(index))
        raise HTTPException(404, "Frontend not built. Run: cd frontend && npm run build")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=False)
