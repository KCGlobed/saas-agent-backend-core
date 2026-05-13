const Project = require('../models/Project');
const ApiKey = require('../models/ApiKey');
const LLMClient = require('../services/llm/LLMClient');

exports.parseTextToApi = async (req, res) => {
  try {
    const { id } = req.params;
    const { rawText } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: 'rawText is required' });
    }

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const apiKeyDoc = await ApiKey.findOne({ user: req.user.id, provider: project.config.provider });
    if (!apiKeyDoc) {
      return res.status(400).json({ error: `API Key for ${project.config.provider} not configured` });
    }

    const apiKey = apiKeyDoc.getDecryptedKey();

    const systemPrompt = `You are an expert API schema generator. Your job is to parse raw natural language descriptions of API endpoints and convert them into a strict JSON array of API definitions.

You MUST output ONLY valid JSON. Do not include markdown code blocks like \`\`\`json or any other text. Output exactly the array.

Each object in the array MUST have the following structure:
{
  "name": "a_snake_case_function_name",
  "description": "Short description of what the endpoint does.",
  "purpose": "Instructions for an AI agent on when to use this tool, what filters exist, and how to format the output.",
  "endpoint": "The URL path, e.g., /api/payments",
  "method": "GET or POST",
  "query_params": {
    "param_name": {
      "type": "string or number or boolean",
      "description": "What this param does"
    }
  }
}

If the user does not provide query parameters, "query_params" should be an empty object {}.
If the user provides multiple endpoints, create an object for each in the array.`;

    const response = await LLMClient.generateResponse({
      provider: project.config.provider,
      apiKey,
      model: project.config.model,
      prompt: rawText,
      systemPrompt: systemPrompt
    });

    let rawJsonStr = response.response.trim();
    
    // Clean up potential markdown formatting if the LLM ignores instructions
    if (rawJsonStr.startsWith('```json')) {
      rawJsonStr = rawJsonStr.replace(/^```json/, '');
      rawJsonStr = rawJsonStr.replace(/```$/, '');
    } else if (rawJsonStr.startsWith('```')) {
      rawJsonStr = rawJsonStr.replace(/^```/, '');
      rawJsonStr = rawJsonStr.replace(/```$/, '');
    }

    rawJsonStr = rawJsonStr.trim();

    try {
      const parsedArray = JSON.parse(rawJsonStr);
      if (!Array.isArray(parsedArray)) {
         return res.status(400).json({ error: 'AI failed to generate a valid JSON array format.', raw: rawJsonStr });
      }
      return res.json({ apis: parsedArray });
    } catch (parseError) {
      console.error('JSON Parse Error from AI output:', parseError);
      return res.status(400).json({ error: 'AI generated invalid JSON.', raw: rawJsonStr });
    }

  } catch (error) {
    console.error('parseTextToApi error:', error);
    res.status(500).json({ error: 'Server error parsing API text.' });
  }
};
