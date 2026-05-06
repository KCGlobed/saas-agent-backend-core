import io
from typing import Optional
import uuid
import pandas as pd
from PyPDF2 import PdfReader
from docx import Document
from bs4 import BeautifulSoup
import requests
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
from openai import OpenAI
from app.core.config import get_or_create_collection

def get_openai_client(api_key: Optional[str] = None):
    key = api_key or os.getenv("OPENAI_API_KEY")
    if not key:
        raise ValueError("OpenAI API Key is missing")
    return OpenAI(api_key=key)

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    ext = filename.split('.')[-1].lower()
    text = ""
    
    if ext == 'pdf':
        reader = PdfReader(io.BytesIO(file_content))
        for page in reader.pages:
            text += page.extract_text() + "\n"
    elif ext in ['doc', 'docx']:
        doc = Document(io.BytesIO(file_content))
        for para in doc.paragraphs:
            text += para.text + "\n"
    elif ext in ['xls', 'xlsx']:
        df = pd.read_excel(io.BytesIO(file_content))
        text = df.to_string()
    elif ext in ['txt', 'csv']:
        text = file_content.decode('utf-8')
    else:
        raise ValueError(f"Unsupported file type: {ext}")
        
    return text

def extract_text_from_url(url: str) -> str:
    response = requests.get(url)
    response.raise_for_status()
    soup = BeautifulSoup(response.content, 'html.parser')
    # Extract text and remove extra whitespaces
    text = soup.get_text(separator=' ', strip=True)
    return text

def process_and_store(text: str, project_id: str, source: str, filename: str, api_key: Optional[str] = None):
    # 1. Chunk text
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100,
        length_function=len
    )
    chunks = text_splitter.split_text(text)
    
    if not chunks:
        return
        
    # 2. Generate Embeddings using OpenAI
    client = get_openai_client(api_key)
    response = client.embeddings.create(
        input=chunks,
        model="text-embedding-3-small"
    )
    embeddings = [item.embedding for item in response.data]
    
    # 3. Store in ChromaDB
    collection = get_or_create_collection()
    
    ids = [str(uuid.uuid4()) for _ in range(len(chunks))]
    metadatas = [
        {"projectId": project_id, "source": source, "filename": filename, "chunk_index": i} 
        for i in range(len(chunks))
    ]
    
    collection.add(
        documents=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids
    )
    
    return len(chunks)
