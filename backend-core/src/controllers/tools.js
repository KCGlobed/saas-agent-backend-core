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

    const systemPrompt = `You are an expert API schema generator and Natural Language Processing (NLP) optimizer. Your job is to parse raw natural language descriptions of API endpoints and convert them into a highly intelligent, structured JSON array of tool definitions for an AI agent.

To ensure maximum accuracy and dynamic query routing by LLM agents, you MUST optimize the generated text using advanced semantic enrichment:

Each object in the array MUST adhere strictly to this JSON format:
{
  "name": "a_snake_case_function_name",
  "description": "Highly descriptive explanation of what data this endpoint retrieves or modifies. Write using active, semantically rich language so that AI routers can instantly match user intents (synonyms, variations) to this specific tool.",
  "purpose": "CRITICAL NLP INSTRUCTIONS FOR AGENT: Write precise guidelines instructing an AI agent exactly when to invoke this tool, what implicit user intents it handles, how to map filters correctly, and how to beautifully present the output (e.g., Markdown tables, lists) for the end-user.",
  "endpoint": "The relative URL path, e.g., /api/payments",
  "method": "GET, POST, PUT, or DELETE",
  "response_schema": "Optional. If the user provides an example of what the API returns, put that JSON or description here.",
  "query_params": {
    "param_name": {
      "type": "string, number, or boolean",
      "description": "Explicit description of what this parameter does, its required formats (e.g. ISO 'YYYY-MM-DD' for dates), and semantic mapping context."
    }
  }
}

CRITICAL INSTRUCTIONS:
- Explicitly tell the agent in the 'purpose' field to parse user inputs (such as relative dates like 'today') and map them to query params in correct formats.
- If query parameters are omitted in prompt but clearly available based on the endpoint name (like page size or page number), intelligently infer and define them with clear descriptions.
- If multiple endpoints are provided in text, generate an object for each in the output array.
- ALWAYS output ONLY a valid JSON array. Do NOT surround it in markdown block \`\`\`json.`;

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

exports.addToolsToProject = async (req, res) => {
  try {
    const { id } = req.params;
    const { apis } = req.body; // Can accept a single API object or an array of API objects

    if (!apis) {
      return res.status(400).json({ error: 'No apis configuration payload provided.' });
    }

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!project.config) project.config = {};
    if (!project.config.apiCollection) {
      project.config.apiCollection = { apis: [] };
    }
    if (!Array.isArray(project.config.apiCollection.apis)) {
      project.config.apiCollection.apis = [];
    }

    const itemsToAdd = Array.isArray(apis) ? apis : [apis];

    for (const item of itemsToAdd) {
      if (item && item.name) {
        // Deduplicate: Pull out existing API by same name to prevent duplicates
        project.config.apiCollection.apis = project.config.apiCollection.apis.filter(
          (a) => a.name !== item.name
        );
        // Push new config
        project.config.apiCollection.apis.push(item);
      }
    }

    // Deep modification alert for Mongoose Mixed types
    project.markModified('config.apiCollection');
    await project.save();

    res.json({
      message: 'Tool configuration added/updated successfully.',
      apiCollection: project.config.apiCollection
    });
  } catch (error) {
    console.error('addToolsToProject error:', error);
    res.status(500).json({ error: 'Server error persisting tool configuration.' });
  }
};

exports.removeToolFromProject = async (req, res) => {
  try {
    const { id, name } = req.params;

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (project.config?.apiCollection?.apis) {
      project.config.apiCollection.apis = project.config.apiCollection.apis.filter(
        (a) => a.name !== name
      );
      project.markModified('config.apiCollection');
      await project.save();
    }

    res.json({
      message: `Tool '${name}' successfully removed.`,
      apiCollection: project.config?.apiCollection || { apis: [] }
    });
  } catch (error) {
    console.error('removeToolFromProject error:', error);
    res.status(500).json({ error: 'Server error deleting tool configuration.' });
  }
};

/**
 * PUT /projects/:id/tools/:name
 * Update a specific API tool definition within a project's apiCollection.
 * The :name URL param identifies which tool to update (by its current name).
 * All fields provided in req.body will be merged into the existing tool.
 * To rename the tool, include a `name` field in req.body with the new name.
 */
exports.updateToolInProject = async (req, res) => {
  try {
    const { id, name } = req.params;
    const updates = req.body;

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Request body must be a JSON object with fields to update.' });
    }

    const project = await Project.findOne({ _id: id, user: req.user.id });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    if (!project.config?.apiCollection?.apis || !Array.isArray(project.config.apiCollection.apis)) {
      return res.status(404).json({ error: `No apiCollection found for project.` });
    }

    const toolIndex = project.config.apiCollection.apis.findIndex((a) => a.name === name);
    if (toolIndex === -1) {
      return res.status(404).json({ error: `Tool '${name}' not found in this project's apiCollection.` });
    }

    // Deep merge: spread existing tool then apply updates (updates win over existing fields)
    // If query_params are provided, they fully replace the existing ones for precision
    const existingTool = project.config.apiCollection.apis[toolIndex];
    const updatedTool = {
      ...existingTool,
      ...updates,
      // If query_params were explicitly provided in updates, use them; otherwise keep existing
      query_params: updates.query_params !== undefined ? updates.query_params : existingTool.query_params
    };

    project.config.apiCollection.apis[toolIndex] = updatedTool;

    // Mongoose requires markModified for nested Mixed types
    project.markModified('config.apiCollection');
    await project.save();

    res.json({
      message: `Tool '${name}' updated successfully.`,
      tool: updatedTool,
      apiCollection: project.config.apiCollection
    });
  } catch (error) {
    console.error('updateToolInProject error:', error);
    res.status(500).json({ error: 'Server error updating tool configuration.' });
  }
};
