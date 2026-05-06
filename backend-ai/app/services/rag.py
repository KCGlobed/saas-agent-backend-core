import requests
from app.core.config import get_or_create_collection
from app.services.ingestion import get_openai_client
import os

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

def chat_with_context(query: str, project_id: str, api_key: str = None):
    # 1. Similarity Search
    search_results = perform_search(query, project_id, api_key=api_key)
    
    # 2. Build Context
    context = ""
    citations = []
    
    if search_results:
        for i, (doc, meta) in enumerate(search_results):
            context += f"[Source {i+1}]: {doc}\n\n"
            citations.append({
                "source": meta.get("source"),
                "filename": meta.get("filename")
            })
    else:
        context = "No relevant context found in the project's knowledge base."
        
    # 3. Call Node.js Backend LLM Abstraction Layer
    payload = {
        "projectId": project_id,
        "prompt": query,
        "context": context
    }
    
    response = requests.post(f"{NODE_BACKEND_URL}/api/chat/generate", json=payload)
    
    if response.status_code == 200:
        data = response.json()
        data["citations"] = citations
        return data
    else:
        raise Exception(f"Failed to generate chat: {response.text}")
