from fastapi import APIRouter, File, UploadFile, Form, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, Optional
from app.services.ingestion import extract_text_from_file, extract_text_from_url, process_and_store
from app.services.rag import chat_with_context, build_rag_context
import uuid

router = APIRouter()

# In-memory status tracker (In production, use Redis or a DB)
ingestion_status = {}

class UrlIngestRequest(BaseModel):
    projectId: str
    url: str
    apiKey: Optional[str] = None
    chunkSize: int = 1000
    chunkOverlap: int = 100

class ChatRequest(BaseModel):
    projectId: str
    query: str
    apiKey: Optional[str] = None
    apiCollection: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional API catalog (e.g. collection.json). If omitted, loads COLLECTION_JSON_PATH or repo collection.json.",
    )


class RetrieveRequest(BaseModel):
    projectId: str
    query: str
    apiKey: Optional[str] = None

def background_ingest_file(file_content: bytes, filename: str, project_id: str, job_id: str, api_key: str = None, chunk_size: int = 1000, chunk_overlap: int = 100):
    try:
        ingestion_status[job_id] = "processing"
        text = extract_text_from_file(file_content, filename)
        chunks_stored = process_and_store(text, project_id, source="file", filename=filename, api_key=api_key, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        ingestion_status[job_id] = f"completed: {chunks_stored} chunks stored"
    except Exception as e:
        ingestion_status[job_id] = f"failed: {str(e)}"

def background_ingest_url(url: str, project_id: str, job_id: str, api_key: str = None, chunk_size: int = 1000, chunk_overlap: int = 100):
    try:
        ingestion_status[job_id] = "processing"
        text = extract_text_from_url(url)
        chunks_stored = process_and_store(text, project_id, source="url", filename=url, api_key=api_key, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        ingestion_status[job_id] = f"completed: {chunks_stored} chunks stored"
    except Exception as e:
        ingestion_status[job_id] = f"failed: {str(e)}"

@router.post("/ingest/file")
async def ingest_file(
    background_tasks: BackgroundTasks,
    projectId: str = Form(...),
    apiKey: Optional[str] = Form(None),
    chunkSize: int = Form(1000),
    chunkOverlap: int = Form(100),
    file: UploadFile = File(...)
):
    job_id = str(uuid.uuid4())
    ingestion_status[job_id] = "pending"
    
    file_content = await file.read()
    
    background_tasks.add_task(
        background_ingest_file, 
        file_content, 
        file.filename, 
        projectId, 
        job_id,
        apiKey,
        chunkSize,
        chunkOverlap
    )
    
    return {"jobId": job_id, "status": "pending"}

@router.post("/ingest/url")
async def ingest_url(
    req: UrlIngestRequest,
    background_tasks: BackgroundTasks
):
    job_id = str(uuid.uuid4())
    ingestion_status[job_id] = "pending"
    
    background_tasks.add_task(
        background_ingest_url,
        req.url,
        req.projectId,
        job_id,
        req.apiKey,
        req.chunkSize,
        req.chunkOverlap
    )
    
    return {"jobId": job_id, "status": "pending"}

@router.get("/status/{job_id}")
async def get_status(job_id: str):
    if job_id not in ingestion_status:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"jobId": job_id, "status": ingestion_status[job_id]}

@router.post("/retrieve")
async def retrieve(req: RetrieveRequest):
    try:
        context, citations, has_hits = build_rag_context(req.query, req.projectId, api_key=req.apiKey)
        return {"context": context, "citations": citations, "hasRagHits": has_hits}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def chat(req: ChatRequest):
    try:
        response = chat_with_context(
            req.query,
            req.projectId,
            api_key=req.apiKey,
            api_collection=req.apiCollection,
        )
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/knowledge/{project_id}")
async def get_knowledge(project_id: str):
    """Returns a deduplicated list of ingested files/sources for a project."""
    try:
        from app.core.config import get_or_create_collection
        collection = get_or_create_collection()
        results = collection.get(
            where={"projectId": project_id},
            include=["metadatas"]
        )
        metadatas = results.get("metadatas", [])
        
        # Deduplicate by filename
        seen = {}
        for meta in metadatas:
            key = meta.get("filename", "unknown")
            if key not in seen:
                seen[key] = {
                    "filename": meta.get("filename", "unknown"),
                    "source": meta.get("source", "file"),
                    "chunkCount": 1
                }
            else:
                seen[key]["chunkCount"] += 1
        
        return {"files": list(seen.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/knowledge/{project_id}")
async def delete_knowledge(project_id: str, filename: str):
    """Deletes all ChromaDB documents for a project that match the given filename."""
    try:
        from app.core.config import get_or_create_collection
        collection = get_or_create_collection()
        # ChromaDB .delete() supports where filters
        collection.delete(
            where={"$and": [{"projectId": {"$eq": project_id}}, {"filename": {"$eq": filename}}]}
        )
        return {"message": f"Deleted documents for '{filename}' from project '{project_id}'"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
