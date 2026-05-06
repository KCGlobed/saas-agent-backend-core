const Project = require('../models/Project');
const ApiKey = require('../models/ApiKey');
const LLMClient = require('../services/llm/LLMClient');

exports.generateChat = async (req, res) => {
  try {
    const { projectId, prompt, context } = req.body;

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // The user associated with the project needs to have an API key for the chosen provider
    const apiKeyDoc = await ApiKey.findOne({ user: project.user, provider: project.config.provider });
    if (!apiKeyDoc) return res.status(400).json({ error: `API Key for ${project.config.provider} not configured` });

    const apiKey = apiKeyDoc.getDecryptedKey();

    // Ensure the system prompt enforces strict RAG but allows greetings
    const baseSystemPrompt = project.config.systemPrompt || 'You are a helpful AI assistant.';
    const strictConstraint = ' Use the provided context to answer questions. Give concise, direct, conversational answers — do NOT use structured formats like "Answer:", "Explanation:", "Key Points:", "Source:", or excessive headers and bullet points unless specifically asked. If the user asks a question not covered by the context, politely say you can only answer based on the provided documents. You MAY respond to general greetings and pleasantries normally.';
    
    // Make sure we append it if not already present
    const finalSystemPrompt = baseSystemPrompt.includes('Use the provided context to answer questions') 
      ? baseSystemPrompt 
      : baseSystemPrompt + strictConstraint;

    // Construct the final prompt including the RAG context
    const finalPrompt = context 
      ? `Context information is below.\n---------------------\n${context}\n---------------------\nGiven the context information and not prior knowledge, answer the query.\nQuery: ${prompt}`
      : prompt;

    const response = await LLMClient.generateResponse({
      provider: project.config.provider,
      apiKey: apiKey,
      model: project.config.model,
      prompt: finalPrompt,
      systemPrompt: finalSystemPrompt
    });

    res.json(response);
  } catch (error) {
    console.error("Chat generation error:", error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};
