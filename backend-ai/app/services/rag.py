import requests
from app.core.config import get_or_create_collection
from app.services.ingestion import get_openai_client
from app.services.collection_loader import load_api_collection
import os
from typing import Any, Dict, List, Optional, Tuple

NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:4000")

def perform_search(query: str, project_id: str, top_k: int = 5, api_key: str = None):
    collection = get_or_create_collection()
    
    # Generate query embedding using OpenAI
    client = get_openai_client(api_key)
    response = client.embeddings.create(
        input=[query],
        model="text-embedding-3-small"
    )
    query_embedding = [item.embedding for item in response.data]
    
    # Search ChromaDB
    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where={"projectId": project_id} # Filter by project namespace
    )
    
    if not results['documents'] or len(results['documents'][0]) == 0:
        return []
        
    # Return chunks and metadatas
    return list(zip(results['documents'][0], results['metadatas'][0]))


def build_rag_context(query: str, project_id: str, api_key: str = None) -> Tuple[str, List[Dict[str, Any]], bool]:
    search_results = perform_search(query, project_id, api_key=api_key)
    context = ""
    citations: List[Dict[str, Any]] = []
    if search_results:
        for i, (doc, meta) in enumerate(search_results):
            context += f"[Source {i+1}]: {doc}\n\n"
            citations.append({
                "source": meta.get("source"),
                "filename": meta.get("filename")
            })
        return context, citations, True
    context = "No relevant context found in the project's knowledge base."
    return context, citations, False


def chat_with_context(
    query: str,
    project_id: str,
    api_key: str = None,
    api_collection: Optional[Dict[str, Any]] = None,
):
    context, citations, has_rag_hits = build_rag_context(query, project_id, api_key=api_key)
    collection = load_api_collection(api_collection)

    payload: Dict[str, Any] = {
        "projectId": project_id,
        "prompt": query,
        "context": context,
        "hasRagHits": has_rag_hits,
        "skipRagRetrieval": True,
    }
    if collection and collection.get("apis"):
        payload["apiCollection"] = collection

    response = requests.post(f"{NODE_BACKEND_URL}/api/chat/generate", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        data["citations"] = citations
        return data
    else:
        raise Exception(f"Failed to generate chat: {response.text}")
