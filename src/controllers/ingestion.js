const path = require('path');
const crypto = require('crypto');
const Project = require('../models/Project');
const ApiKey = require('../models/ApiKey');
const Resource = require('../models/Resource');
const { uploadFile, deleteFile, getSignedUrl } = require('../services/storage');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001/api';

// Helper: get decrypted OpenAI key for a user
async function getOpenAIKey(userId) {
  const apiKeyDoc = await ApiKey.findOne({ user: userId, provider: 'openai' });
  return apiKeyDoc ? apiKeyDoc.getDecryptedKey() : null;
}

// Helper: poll FastAPI job status and update Resource record
async function pollAndUpdateResource(resourceId, jobId) {
  const maxAttempts = 30;
  let attempts = 0;
  const interval = setInterval(async () => {
    attempts++;
    try {
      const resp = await fetch(`${FASTAPI_URL}/status/${jobId}`);
      const data = await resp.json();
      const status = data.status || '';

      if (status.includes('completed')) {
        const chunkMatch = status.match(/(\d+)\s+chunks?/);
        await Resource.findByIdAndUpdate(resourceId, {
          status: 'completed',
          chunkCount: chunkMatch ? parseInt(chunkMatch[1]) : 0,
          jobId
        });
        clearInterval(interval);
      } else if (status.includes('failed')) {
        await Resource.findByIdAndUpdate(resourceId, { status: 'failed', errorMessage: status, jobId });
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        await Resource.findByIdAndUpdate(resourceId, { status: 'failed', errorMessage: 'Timed out', jobId });
        clearInterval(interval);
      }
    } catch {
      clearInterval(interval);
    }
  }, 3000);
}

// POST /projects/:id/ingest/file  (multer handles array of files)
exports.ingestFiles = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found or access denied' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    const apiKey = await getOpenAIKey(req.user.id);
    const results = [];

    for (const file of req.files) {
      // 1. Upload to GCS
      const gcsPath = `projects/${id}/resources/${crypto.randomUUID()}-${file.originalname}`;
      await uploadFile(file.buffer, gcsPath, file.mimetype);

      // 2. Create Resource record
      const resource = await Resource.create({
        projectId: id,
        userId: req.user.id,
        type: 'file',
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        gcsPath,
        status: 'processing'
      });

      // 3. Forward to FastAPI for embedding
      const formData = new FormData();
      formData.append('projectId', id);
      if (apiKey) formData.append('apiKey', apiKey);
      const blob = new Blob([file.buffer], { type: file.mimetype });
      formData.append('file', blob, file.originalname);

      const resp = await fetch(`${FASTAPI_URL}/ingest/file`, { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) {
        await Resource.findByIdAndUpdate(resource._id, { status: 'failed', errorMessage: data.detail });
        results.push({ file: file.originalname, resourceId: resource._id, status: 'failed' });
        continue;
      }

      // 4. Update jobId and start polling
      await Resource.findByIdAndUpdate(resource._id, { jobId: data.jobId });
      pollAndUpdateResource(resource._id, data.jobId);

      results.push({ file: file.originalname, resourceId: resource._id, jobId: data.jobId, status: 'processing' });
    }

    res.json({ results });
  } catch (error) {
    console.error('File ingestion error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// POST /projects/:id/ingest/url
exports.ingestUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apiKey = await getOpenAIKey(req.user.id);

    // 1. Create Resource record
    const resource = await Resource.create({
      projectId: id,
      userId: req.user.id,
      type: 'url',
      originalName: url,
      gcsPath: null, // URL resources store scraped text to GCS after FastAPI extracts it
      status: 'processing'
    });

    // 2. Forward to FastAPI
    const resp = await fetch(`${FASTAPI_URL}/ingest/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: id, url, apiKey })
    });
    const data = await resp.json();
    if (!resp.ok) {
      await Resource.findByIdAndUpdate(resource._id, { status: 'failed', errorMessage: data.detail });
      return res.status(500).json({ error: data.detail || 'FastAPI Error' });
    }

    await Resource.findByIdAndUpdate(resource._id, { jobId: data.jobId });
    pollAndUpdateResource(resource._id, data.jobId);

    res.json({ resourceId: resource._id, jobId: data.jobId, status: 'processing' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// POST /projects/:id/ingest/text
exports.ingestText = async (req, res) => {
  try {
    const { id } = req.params;
    const { text, label } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apiKey = await getOpenAIKey(req.user.id);
    const filename = `${label || 'raw_text'}_${Date.now()}.txt`;
    const textBuffer = Buffer.from(text, 'utf-8');

    // 1. Upload raw text to GCS
    const gcsPath = `projects/${id}/resources/${crypto.randomUUID()}-${filename}`;
    await uploadFile(textBuffer, gcsPath, 'text/plain');

    // 2. Create Resource with preview
    const resource = await Resource.create({
      projectId: id,
      userId: req.user.id,
      type: 'text',
      originalName: label || 'Raw Text',
      mimeType: 'text/plain',
      sizeBytes: textBuffer.length,
      gcsPath,
      status: 'processing',
      preview: text.slice(0, 500)
    });

    // 3. Forward to FastAPI as a file upload
    const formData = new FormData();
    formData.append('projectId', id);
    if (apiKey) formData.append('apiKey', apiKey);
    const blob = new Blob([textBuffer], { type: 'text/plain' });
    formData.append('file', blob, filename);

    const resp = await fetch(`${FASTAPI_URL}/ingest/file`, { method: 'POST', body: formData });
    const data = await resp.json();
    if (!resp.ok) {
      await Resource.findByIdAndUpdate(resource._id, { status: 'failed', errorMessage: data.detail });
      return res.status(500).json({ error: data.detail || 'FastAPI Error' });
    }

    await Resource.findByIdAndUpdate(resource._id, { jobId: data.jobId });
    pollAndUpdateResource(resource._id, data.jobId);

    res.json({ resourceId: resource._id, jobId: data.jobId, status: 'processing' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /projects/:id/ingest/status/:jobId
exports.getStatus = async (req, res) => {
  try {
    const { id, jobId } = req.params;
    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const resp = await fetch(`${FASTAPI_URL}/status/${jobId}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.detail || 'FastAPI Error');
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /projects/:id/resources
exports.listResources = async (req, res) => {
  try {
    const { id } = req.params;
    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });
    const resources = await Resource.find({ projectId: id }).sort({ createdAt: -1 });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// GET /projects/:id/resources/:resourceId/preview
exports.previewResource = async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const resource = await Resource.findOne({ _id: resourceId, projectId: id, userId: req.user.id });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    // Return text preview and signed URL if available
    const signedUrl = resource.gcsPath ? await getSignedUrl(resource.gcsPath) : null;
    res.json({ preview: resource.preview, gcsUrl: signedUrl, type: resource.type, originalName: resource.originalName });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

// DELETE /projects/:id/resources/:resourceId
exports.deleteResource = async (req, res) => {
  try {
    const { id, resourceId } = req.params;
    const resource = await Resource.findOne({ _id: resourceId, projectId: id, userId: req.user.id });
    if (!resource) return res.status(404).json({ error: 'Resource not found' });

    // 1. Delete from GCS
    if (resource.gcsPath) {
      await deleteFile(resource.gcsPath);
    }

    // 2. Delete from ChromaDB via FastAPI
    const chromaResp = await fetch(
      `${FASTAPI_URL}/knowledge/${id}?filename=${encodeURIComponent(resource.originalName)}`,
      { method: 'DELETE' }
    );
    if (!chromaResp.ok) {
      const err = await chromaResp.json();
      console.warn('ChromaDB delete warning:', err.detail);
    }

    // 3. Delete from MongoDB
    await Resource.findByIdAndDelete(resourceId);

    res.json({ message: 'Resource deleted successfully' });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
