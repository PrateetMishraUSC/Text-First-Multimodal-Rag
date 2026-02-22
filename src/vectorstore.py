import os
import faiss
import numpy as np
import pickle
from typing import List, Any, Optional
from sentence_transformers import SentenceTransformer
from src.embeddings import EmbeddingPipeline


class FaissVectorStore:
    def __init__(self, persist_dir: str = "faiss_store", embedding_model: str = "all-MiniLM-L6-v2",
                 chunk_size: int = 1000, chunk_overlap: int = 200,
                 shared_model: Optional[SentenceTransformer] = None):
        self.persist_dir = persist_dir
        os.makedirs(self.persist_dir, exist_ok=True)
        self.index = None
        self.metadata = []
        self.embedding_model = embedding_model
        self.model = shared_model if shared_model is not None else SentenceTransformer(embedding_model)
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        print(f"[INFO] Loaded embedding model: {embedding_model}")

    def _build_rich_metadata(self, chunks: List[Any], base_id: int = 0) -> List[dict]:
        metadatas = []
        for i, chunk in enumerate(chunks):
            meta = {
                "text": chunk.page_content,
                "chunk_id": base_id + i,
                "source_file": chunk.metadata.get("source_file", chunk.metadata.get("source", "unknown")),
                "page": chunk.metadata.get("page", 0),
                "file_type": chunk.metadata.get("file_type", "unknown"),
                "chunk_type": chunk.metadata.get("chunk_type", "text"),
                "asset_path": chunk.metadata.get("asset_path", ""),
                "section": chunk.metadata.get("section", ""),
                "content_length": len(chunk.page_content),
            }
            metadatas.append(meta)
        return metadatas

    def build_from_documents(self, documents: List[Any]):
        print(f"[INFO] Building vector store from {len(documents)} raw documents...")
        emb_pipe = EmbeddingPipeline(model_name=self.embedding_model, chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
        chunks = emb_pipe.chunk_documents(documents)
        embeddings = emb_pipe.embed_chunks(chunks)
        metadatas = self._build_rich_metadata(chunks, base_id=0)
        self.add_embeddings(np.array(embeddings).astype('float32'), metadatas)
        self.save()
        print(f"[INFO] Vector store built and saved to {self.persist_dir}")

    def add_documents(self, documents: List[Any]):
        """Add new documents to an existing index (for incremental uploads)."""
        print(f"[INFO] Adding {len(documents)} documents to existing index...")
        emb_pipe = EmbeddingPipeline(model_name=self.embedding_model, chunk_size=self.chunk_size, chunk_overlap=self.chunk_overlap)
        chunks = emb_pipe.chunk_documents(documents)
        embeddings = emb_pipe.embed_chunks(chunks)
        base_id = len(self.metadata)
        metadatas = self._build_rich_metadata(chunks, base_id=base_id)
        self.add_embeddings(np.array(embeddings).astype('float32'), metadatas)
        self.save()
        print(f"[INFO] Added {len(chunks)} chunks. Total chunks: {len(self.metadata)}")

    def add_multimodal_chunks(self, multimodal_chunks: List[dict]):
        """
        Add pre-built multimodal chunks (tables/images) directly to the index.
        These chunks already have text representations — they bypass the text splitter.
        """
        if not multimodal_chunks:
            return
        print(f"[INFO] Adding {len(multimodal_chunks)} multimodal chunks...")
        texts = [chunk["text"] for chunk in multimodal_chunks]
        embeddings = self.model.encode(texts).astype('float32')

        base_id = len(self.metadata)
        metadatas = []
        for i, chunk in enumerate(multimodal_chunks):
            metadatas.append({
                "text": chunk["text"],
                "chunk_id": base_id + i,
                "source_file": chunk.get("source_file", "unknown"),
                "page": chunk.get("page", 0),
                "file_type": chunk.get("file_type", "unknown"),
                "chunk_type": chunk.get("chunk_type", "text"),
                "asset_path": chunk.get("asset_path", ""),
                "section": chunk.get("section", ""),
                "content_length": len(chunk["text"]),
            })

        self.add_embeddings(embeddings, metadatas)
        self.save()
        print(f"[INFO] Added {len(multimodal_chunks)} multimodal chunks. Total chunks: {len(self.metadata)}")

    def add_embeddings(self, embeddings: np.ndarray, metadatas: List[Any] = None):
        dim = embeddings.shape[1]
        if self.index is None:
            self.index = faiss.IndexFlatL2(dim)
        self.index.add(embeddings)
        if metadatas:
            self.metadata.extend(metadatas)
        print(f"[INFO] Added {embeddings.shape[0]} vectors to Faiss index.")

    def save(self):
        faiss_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        faiss.write_index(self.index, faiss_path)
        with open(meta_path, "wb") as f:
            pickle.dump(self.metadata, f)
        print(f"[INFO] Saved Faiss index and metadata to {self.persist_dir}")

    def load(self):
        faiss_path = os.path.join(self.persist_dir, "faiss.index")
        meta_path = os.path.join(self.persist_dir, "metadata.pkl")
        self.index = faiss.read_index(faiss_path)
        with open(meta_path, "rb") as f:
            self.metadata = pickle.load(f)
        print(f"[INFO] Loaded Faiss index and metadata from {self.persist_dir}")

    def search(self, query_embedding: np.ndarray, top_k: int = 5):
        D, I = self.index.search(query_embedding, top_k)
        results = []
        for idx, dist in zip(I[0], D[0]):
            if idx < 0:
                continue
            meta = self.metadata[idx] if idx < len(self.metadata) else None
            results.append({"index": int(idx), "distance": float(dist), "metadata": meta})
        return results

    def query(self, query_text: str, top_k: int = 5):
        print(f"[INFO] Querying vector store for: '{query_text}'")
        query_emb = self.model.encode([query_text]).astype('float32')
        return self.search(query_emb, top_k=top_k)


if __name__ == "__main__":
    from src.data_loader import load_all_documents
    docs = load_all_documents("data")
    store = FaissVectorStore("faiss_store")
    store.build_from_documents(docs)
    store.load()
    print(store.query("What is Federated Learning?", top_k=3))
