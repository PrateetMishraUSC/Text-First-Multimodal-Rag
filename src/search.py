import os
import json
from typing import AsyncGenerator
from dotenv import load_dotenv
from src.vectorstore import FaissVectorStore
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage

load_dotenv()

# L2 distance threshold: lower = more similar.
# For all-MiniLM-L6-v2 (384-dim), relevant results typically < 1.0-1.2
RELEVANCE_THRESHOLD = 1.2

SYSTEM_PROMPT = (
    "You are a helpful assistant that answers questions based on the "
    "provided context from uploaded documents. If you are asked to summarize the document, please do. If the context does not contain "
    "information to answer the question, respond with: "
    "'This isn't covered in the uploaded files.' "
    "When answering, cite which source document and page the information comes from. "
    "Be concise, accurate, and helpful."
)


class RAGSearch:
    def __init__(self, vectorstore: FaissVectorStore, llm_model: str = "llama-3.1-8b-instant"):
        self.vectorstore = vectorstore
        self.llm_model = llm_model
        groq_api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ-API-KEY")
        self.llm = ChatGroq(
            groq_api_key=groq_api_key,
            model_name=llm_model,
            temperature=0.1,
            max_tokens=1024,
            streaming=True,
        )
        print(f"[INFO] Groq LLM initialized: {llm_model}")

    def retrieve(self, query: str, top_k: int = 5) -> dict:
        """Retrieve chunks and classify relevance."""
        results = self.vectorstore.query(query, top_k=top_k)
        relevant = [r for r in results if r["distance"] < RELEVANCE_THRESHOLD]

        if not relevant:
            return {
                "status": "no_context",
                "chunks": [],
                "message": "I couldn't find relevant information in your uploaded documents. Try rephrasing your question or uploading a new file.",
            }

        return {"status": "ok", "chunks": relevant}

    async def stream_answer(self, query: str, top_k: int = 5) -> AsyncGenerator[str, None]:
        """
        Async generator yielding SSE-formatted events:
        1. 'sources' — retrieved chunk metadata (sent first)
        2. 'token'   — each LLM token
        3. 'done'    — signals completion
        """
        retrieval = self.retrieve(query, top_k=top_k)

        # Build sources payload
        sources = []
        for chunk in retrieval["chunks"]:
            meta = chunk.get("metadata", {})
            source_entry = {
                "chunk_id": meta.get("chunk_id", -1),
                "source_file": meta.get("source_file", "unknown"),
                "page": meta.get("page", 0),
                "distance": round(chunk.get("distance", 0), 4),
                "text_preview": meta.get("text", "")[:300],
                "chunk_type": meta.get("chunk_type", "text"),
                "section": meta.get("section", ""),
            }
            # Include asset URL for multimodal chunks (table screenshots, image thumbnails)
            asset_path = meta.get("asset_path", "")
            if asset_path:
                source_entry["asset_url"] = f"/api/assets/{asset_path}"
            else:
                source_entry["asset_url"] = ""
            sources.append(source_entry)

        yield f"event: sources\ndata: {json.dumps(sources)}\n\n"

        if retrieval["status"] == "no_context":
            yield f"event: token\ndata: {json.dumps({'token': retrieval['message']})}\n\n"
            yield f"event: done\ndata: {json.dumps({'status': 'no_context'})}\n\n"
            return

        # Build context from retrieved chunks
        context_parts = []
        for chunk in retrieval["chunks"]:
            meta = chunk["metadata"]
            chunk_type = meta.get("chunk_type", "text")
            section = meta.get("section", "")
            header = f"[Source: {meta.get('source_file', 'unknown')}, Page: {meta.get('page', '?')}, Type: {chunk_type}]"
            if section:
                header += f" ({section})"
            context_parts.append(f"{header}\n{meta['text']}")
        context = "\n\n---\n\n".join(context_parts)

        system_msg = SystemMessage(content=SYSTEM_PROMPT)
        human_msg = HumanMessage(
            content=f"Context:\n{context}\n\nQuestion: {query}\n\nAnswer based on the above context:"
        )

        # Stream tokens from Groq via LangChain's astream
        async for chunk in self.llm.astream([system_msg, human_msg]):
            token = chunk.content
            if token:
                yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"

        yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"
