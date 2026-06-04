const fs = require('fs');
const path = require('path');
const Project = require('../models/Project');
const Dataset = require('../models/Dataset');
const ApiKey = require('../models/ApiKey');
const LLMClient = require('../services/llm/LLMClient');
const ChatLog = require('../models/ChatLog');
const { scoreAccuracy } = require('../services/accuracy');
const { decryptSourceConfig } = require('./datasets');

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
  return `Context information from knowledge base (may or may not be relevant):\n---------------------\n${contextBlock}\n---------------------\nInstructions: Use the conversation history and the context information above (if relevant) to answer the user's query. If the context is irrelevant to the ongoing conversation, ignore it.\n\nUser Query: ${prompt}`;
}

function strictDocumentOnlyPrompt(base) {
  const strictConstraint =
    ' Use the provided context and the conversation history to answer questions. Give concise, direct, conversational answers — do NOT use structured formats like "Answer:", "Explanation:", "Key Points:", "Source:", or excessive headers and bullet points unless specifically asked. If the user asks a question not covered by the context or the history, politely say you can only answer based on the provided documents. You MAY respond to general greetings and pleasantries normally.';
  if (base.includes('Use the provided context')) return base;
  return base + strictConstraint;
}

function hybridPrompt(base, { hasRagHits }) {
  const presentation = [
    'Presentation (match modern chat assistants):',
    '- Start with a short lead (1–2 sentences): what you found and how many records (if known).',
    '- Then give a tight summary: 3–6 bullet points of highlights (totals, date range, notable outliers).',
    '- For tabular API data: prefer a clean Markdown pipe table with a header row, a separator row (e.g. |---|---|), then rows. Keep column headers short.',
    '- If there are many rows (>12), show the most relevant ~10–12 in the table, then say how many more exist and offer to narrow (filters) instead of dumping everything.',
    '- Use ### section headings sparingly (e.g. ### Summary, ### Records).',
    '- Avoid filler closings like "Let me know if you need anything else" unless the user asked for help choosing next steps.',
  ].join('\n');

  const extra = [
    'You may receive a "Context information" section from the project knowledge base (RAG).',
    hasRagHits
      ? 'When that context is relevant, ground answers in it.'
      : 'If the knowledge base has no relevant data, do not invent knowledge-base content.',
    'CRITICAL: Always use the CONVERSATION HISTORY to understand follow-up questions (e.g. if the user says "yes" or asks for "more details"). If you previously retrieved API data, use the data in the history to provide those details.',
    'When the user needs live or structured data (lists, filters such as "created today", counts), call the configured functions with sensible query parameters (e.g. ISO dates YYYY-MM-DD).',
    'Combine RAG and API results when both apply; otherwise use whichever source fits.',
    'If an API error is returned, explain briefly without fabricating records.',
    presentation,
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
      history = [],
      widgetApiToken,
    } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Resolve access token for API integration tools
    let resolvedApiToken = widgetApiToken;
    if (!resolvedApiToken && project.config?.apiCustomToken) {
      try {
        const { decrypt } = require('../utils/crypto');
        resolvedApiToken = decrypt(project.config.apiCustomToken);
      } catch (err) {
        console.error('Failed to decrypt project apiCustomToken:', err.message);
      }
    }

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

    let collection = bodyApiCollection || project.config?.apiCollection;
    const diskCollection = loadCollectionFromDisk();

    if (collection) {
      // Normalize to a plain, mutable object
      if (collection && typeof collection.toObject === 'function') {
        collection = collection.toObject();
      } else {
        collection = JSON.parse(JSON.stringify(collection));
      }
      // Fallback to global defaults for base_url and auth if missing
      if (diskCollection) {
        if (!collection.base_url) collection.base_url = diskCollection.base_url;
        if (!collection.auth) collection.auth = diskCollection.auth;
      }
    } else {
      collection = diskCollection ? { ...diskCollection } : { apis: [] };
    }

    // Attach projectId and register the list_project_resources tool descriptor
    collection.projectId = projectId;
    if (!collection.apis) collection.apis = [];
    collection.apis.push({
      name: 'list_project_resources',
      description: 'Get the list of all ingested files, links, and documents uploaded to the project\'s knowledge base. Use this tool when the user asks which files/documents/resources are uploaded or ingested.',
      method: 'GET',
      url: `/api/projects/${projectId}/resources`,
      queryParams: {
        projectId: { type: 'string', required: true, default: projectId }
      }
    });
    
    const datasets = await Dataset.find({ projectId });
    if (datasets && datasets.length > 0) {
      if (!collection) collection = { apis: [] };
      if (!collection.apis) collection.apis = [];
      
      // Build tables metadata with:
      // 1. Decrypted credentials (so Python can connect to live SQL/MongoDB sources)
      // 2. Full schema: nullable, foreignKeys, user descriptions
      const tablesMetadata = datasets.flatMap(d => (d.tables || []).map(table => {
        const tableObj = table.toObject ? table.toObject() : { ...table };
        // Decrypt sensitive sourceConfig fields before passing to Python
        const decryptedConfig = decryptSourceConfig(tableObj.sourceConfig, tableObj.sourceType);
        return {
          tableName: tableObj.tableName,
          description: tableObj.description || '',
          sourceType: tableObj.sourceType,
          queryMode: tableObj.queryMode,
          gcsParquetPath: tableObj.gcsParquetPath,
          rowCount: tableObj.rowCount,
          columns: (tableObj.columns || []).map(col => ({
            name: col.name,
            type: col.type,
            nullable: col.nullable || 'YES',
            description: col.description || ''
          })),
          foreignKeys: tableObj.foreignKeys || [],
          sourceConfig: decryptedConfig
        };
      }));
      
      collection.apis.push({
        name: 'query_project_datasets',
        description: 'Query the user\'s connected datasets (databases, Excel/CSV files) using natural language to get analytics, tables, and charts. Use this tool when the user asks questions that require joining, filtering, or aggregating data from the connected sources.',
        method: 'POST',
        url: `${FASTAPI_URL}/datasets/query`,
        bodyParams: {
          query: { type: 'string', required: true, description: 'The natural language query describing what analytics or data the user wants.' },
          tables_metadata: { type: 'array', required: true, description: 'MUST BE exact JSON of tablesMetadata.', default: tablesMetadata },
          apiKey: { type: 'string', required: false, description: 'OpenAI API key', default: apiKey }
        }
      });
    }

    const useTools = collection && Array.isArray(collection.apis) && collection.apis.length > 0;

    if (useTools && project.config.provider === 'llama') {
      return res.status(400).json({
        error: 'Tool calling requires an OpenAI or Claude project provider. Update the project provider or remove the API collection.',
      });
    }

    const contextWindowSize = project.config.contextWindowSize || 15;
    const trimmedHistory = Array.isArray(history) ? history.slice(-contextWindowSize) : [];

    const userMessage = buildUserMessage(prompt, contextBlock);

    let finalSystemPrompt;
    if (useTools) {
      finalSystemPrompt = hybridPrompt(baseSystemPrompt, { hasRagHits });
    } else {
      finalSystemPrompt = strictDocumentOnlyPrompt(baseSystemPrompt);
    }

    // Inject current year/date context and rigid formatting instructions
    const now = new Date();
    const dynamicContext = [
      "",
      "[CRITICAL CONTEXT]",
      `- Current Date: ${now.toDateString()}`,
      `- Current Year: ${now.getFullYear()}`,
      "- Formatting: When responding with lists or tabular records, ALWAYS use strict GitHub Flavored Markdown tables. IMPORTANT: Ensure there are NO blank lines between table rows (e.g. the separator row and data rows must be consecutive without empty lines).",
      "- File Links: When providing a link to a downloadable report or file (e.g. Excel, PDF), ALWAYS use standard Markdown format [Link Text](URL). Ensure the link text describes the file (e.g. [View Excel Report](url))."
    ].join("\n");
    finalSystemPrompt += dynamicContext;

    // ── Timing start ──
    const startTime = Date.now();

    let response;
    if (useTools) {
      response = await LLMClient.generateResponseWithTools({
        provider: project.config.provider,
        apiKey,
        model: project.config.model,
        systemPrompt: finalSystemPrompt,
        userMessage,
        history: trimmedHistory,
        collection,
        resolvedApiToken,
      });
    } else {
      response = await LLMClient.generateResponse({
        provider: project.config.provider,
        apiKey,
        model: project.config.model,
        prompt: userMessage,
        history: trimmedHistory,
        systemPrompt: finalSystemPrompt,
      });
    }

    const latencyMs = Date.now() - startTime;

    // ── Extract tool calls made (if any) from the response ──
    const toolCallsMade = Array.isArray(response.toolCalls)
      ? response.toolCalls.map(tc => ({ name: tc.name || tc.function?.name, params: tc.arguments || tc.function?.arguments }))
      : [];

    const out = { ...response };
    if (citations.length) out.citations = citations;

    // ── Send response immediately — don't block on logging ──
    res.json(out);

    // ── Background: score accuracy + persist log ──
    const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || '');
    setImmediate(async () => {
      try {
        const { score: accuracyScore, note: accuracyNote } = await scoreAccuracy({
          query: prompt,
          response: responseText,
          context: contextBlock,
          hasRagHits,
          toolCallsMade,
          provider: project.config.provider,
          apiKey,
          model: project.config.model,
        });

        let generationSource = 'Direct LLM';
        let generationDetails = {};
        
        if (toolCallsMade && toolCallsMade.length > 0) {
          const hasDataset = toolCallsMade.some(tc => tc.name === 'query_project_datasets');
          if (hasDataset) {
            generationSource = 'Dataset / SQL / Excel';
          } else {
            generationSource = 'API Tool Call';
          }
          generationDetails.toolCalls = toolCallsMade;
        } else if (hasRagHits) {
          generationSource = 'RAG (Knowledge Base)';
          generationDetails.citations = citations;
        }

        await ChatLog.create({
          projectId,
          query: prompt,
          response: responseText,
          provider: project.config.provider,
          model: project.config.model,
          latencyMs,
          hasRagHits,
          citations,
          toolCallsMade,
          accuracyScore,
          accuracyNote,
          generationSource,
          generationDetails,
        });
      } catch (logErr) {
        console.error('[chat] Background logging failed:', logErr.message);
      }
    });

  } catch (error) {
    console.error('Chat generation error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
