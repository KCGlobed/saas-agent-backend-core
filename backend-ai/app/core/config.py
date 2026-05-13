import os
import chromadb
from chromadb.config import Settings

# Instead of connecting to a remote server, we run Chroma directly in the FastAPI process
CHROMA_DATA_PATH = os.getenv("CHROMA_DATA_PATH", "./chroma_data")

chroma_client = chromadb.PersistentClient(
    path=CHROMA_DATA_PATH,
    settings=Settings(allow_reset=True)
)

def get_chroma_client():
    return chroma_client

def get_or_create_collection(name: str = "rag_collection_v2"):
    return chroma_client.get_or_create_collection(name=name)
