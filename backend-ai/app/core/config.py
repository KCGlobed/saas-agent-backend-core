import os
import chromadb
from chromadb.config import Settings

CHROMA_HOST = os.getenv("CHROMA_HOST", "localhost")
CHROMA_PORT = int(os.getenv("CHROMA_PORT", 8000))

chroma_client = chromadb.HttpClient(
    host=CHROMA_HOST, 
    port=CHROMA_PORT,
    settings=Settings(allow_reset=True)
)

def get_chroma_client():
    return chroma_client

def get_or_create_collection(name: str = "rag_collection_v2"):
    return chroma_client.get_or_create_collection(name=name)
