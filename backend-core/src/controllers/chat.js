const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const ApiKey = require('../models/ApiKey');
const LLMClient = require('../services/llm/LLMClient');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8001/api';

async function fetchRagFromFastAPI(projectId, prompt, openaiApiKey) {
  try {
    const resp = await fetch(`${FASTAPI_URL}/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        query: prompt,
        apiKey: openaiApiKey || undefined,
      }),
    });
    if (!resp.ok) return null;
    return resp.json();
  } catch (e) {
    console.warn('FastAPI retrieve failed:', e.message);
    return null;
  }
}

function loadCollectionFromDisk() {
  const candidates = [];
  if (process.env.COLLECTION_JSON_PATH) {
    candidates.push(process.env.COLLECTION_JSON_PATH);
  }
  candidates.push(
    path.join(__dirname, '..', '..', '..', 'collection.json')
  );
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch (e) {
        console.warn('API collection read failed:', p, e.message);
      }
    }
  }
  return null;
}

function buildUserMessage(prompt, contextBlock) {
  if (!contextBlock || !String(contextBlock).trim()) {
    return prompt;
  }
  return `Context information is below.\n---------------------\n${contextBlock}\n---------------------\nGiven the context information (if any) and available tools, answer the query.\nQuery: ${prompt}`;
}

function strictDocumentOnlyPrompt(base) {
  const strictConstraint =
    ' Use the provided context to answer questions. Give concise, direct, conversational answers — do NOT use structured formats like "Answer:", "Explanation:", "Key Points:", "Source:", or excessive headers and bullet points unless specifically asked. If the user asks a question not covered by the context, politely say you can only answer based on the provided documents. You MAY respond to general greetings and pleasantries normally.';
  if (base.includes('Use the provided context to answer questions')) return base;
  return base + strictConstraint;
}

function hybridPrompt(base, { hasRagHits }) {
  const extra = [
    'You may receive a "Context information" section from the project knowledge base (RAG).',
    hasRagHits
      ? 'When that context is relevant, ground answers in it.'
      : 'If the context states nothing was found, do not invent knowledge-base content.',
    'When the user needs live or structured data (lists, filters such as "created today", counts), call the configured functions with sensible query parameters (e.g. ISO dates YYYY-MM-DD).',
    'Combine RAG and API results when both apply; otherwise use whichever source fits.',
    'If an API error is returned, explain briefly without fabricating records.',
  ].join(' ');
  if (!base || !String(base).trim()) return extra;
  return `${base}\n\n${extra}`;
}

exports.generateChat = async (req, res) => {
  try {
    const {
      projectId,
      prompt,
      context: bodyContext,
      apiCollection: bodyApiCollection,
      hasRagHits: bodyHasRagHits,
      skipRagRetrieval,
      enableRag,
      openaiApiKey,
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apiKeyDoc = await ApiKey.findOne({ user: project.user, provider: project.config.provider });
    if (!apiKeyDoc) {
      return res.status(400).json({ error: `API Key for ${project.config.provider} not configured` });
    }

    const apiKey = apiKeyDoc.getDecryptedKey();
    const baseSystemPrompt = project.config.systemPrompt || 'You are a helpful AI assistant.';

    let contextBlock = typeof bodyContext === 'string' ? bodyContext : '';
    let hasRagHits = !!bodyHasRagHits;
    let citations = [];

    const skipFetch = skipRagRetrieval === true || skipRagRetrieval === 'true';
    if (!skipFetch && enableRag !== false) {
      const retrieved = await fetchRagFromFastAPI(projectId, prompt, openaiApiKey);
      if (retrieved && typeof retrieved.context === 'string') {
        contextBlock = retrieved.context;
        hasRagHits = !!retrieved.hasRagHits;
        citations = Array.isArray(retrieved.citations) ? retrieved.citations : [];
      }
    } else if (skipFetch) {
      hasRagHits = !!bodyHasRagHits;
    }

    const collection =
      bodyApiCollection ||
      project.config?.apiCollection ||
      loadCollectionFromDisk();
    const useTools = collection && Array.isArray(collection.apis) && collection.apis.length > 0;

    if (useTools && project.config.provider === 'llama') {
      return res.status(400).json({
        error: 'Tool calling requires an OpenAI or Claude project provider. Update the project provider or remove the API collection.',
      });
    }

    const userMessage = buildUserMessage(prompt, contextBlock);

    let finalSystemPrompt;
    if (useTools) {
      finalSystemPrompt = hybridPrompt(baseSystemPrompt, { hasRagHits });
    } else {
      finalSystemPrompt = strictDocumentOnlyPrompt(baseSystemPrompt);
    }

    let response;
    if (useTools) {
      response = await LLMClient.generateResponseWithTools({
        provider: project.config.provider,
        apiKey,
        model: project.config.model,
        systemPrompt: finalSystemPrompt,
        userMessage,
        collection,
      });
    } else {
      response = await LLMClient.generateResponse({
        provider: project.config.provider,
        apiKey,
        model: project.config.model,
        prompt: userMessage,
        systemPrompt: finalSystemPrompt,
      });
    }

    const out = { ...response };
    if (citations.length) out.citations = citations;
    res.json(out);
  } catch (error) {
    console.error('Chat generation error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
