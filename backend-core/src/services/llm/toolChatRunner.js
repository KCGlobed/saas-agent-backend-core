const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { executeApiTool } = require('../apiCollectionExecutor');
const { buildOpenAITools, buildClaudeTools } = require('./toolDefinitions');

const MAX_ROUNDS = 8;

async function runOpenAIToolLoop({ apiKey, model, systemPrompt, userMessage, history = [], collection, resolvedApiToken }) {
  const client = new OpenAI({ apiKey });
  const tools = buildOpenAITools(collection);
  if (!tools.length) {
    throw new Error('No tools defined in api collection');
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage },
  ];
  let totalTokens = 0;
  const allToolCalls = [];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const response = await client.chat.completions.create({
      model: model || 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });
    const msg = response.choices[0]?.message;
    totalTokens += response.usage?.total_tokens || 0;
    if (!msg?.tool_calls?.length) {
      return {
        response: msg?.content || '',
        tokensUsed: totalTokens,
        toolRounds: round,
        toolCalls: allToolCalls,
      };
    }
    messages.push(msg);
    for (const tc of msg.tool_calls) {
      allToolCalls.push(tc);
      const name = tc.function?.name;
      let args = {};
      try {
        args = JSON.parse(tc.function?.arguments || '{}');
      } catch {
        args = {};
      }
      const content = await executeApiTool(collection, name, args, resolvedApiToken);
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content,
      });
    }
  }
  return { response: 'Stopped after maximum tool rounds.', tokensUsed: totalTokens, toolRounds: MAX_ROUNDS, toolCalls: allToolCalls };
}

async function runClaudeToolLoop({ apiKey, model, systemPrompt, userMessage, history = [], collection, resolvedApiToken }) {
  const client = new Anthropic({ apiKey });
  const tools = buildClaudeTools(collection);
  if (!tools.length) {
    throw new Error('No tools defined in api collection');
  }

  const messages = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: userMessage }
  ];
  let totalTokens = 0;
  const allToolCalls = [];

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const response = await client.messages.create({
      model: model || 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: systemPrompt,
      tools,
      messages,
    });
    totalTokens += (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const blocks = response.content || [];
    const toolUses = blocks.filter((b) => b.type === 'tool_use');
    const textParts = blocks.filter((b) => b.type === 'text').map((b) => b.text);

    if (!toolUses.length) {
      return {
        response: textParts.join('\n') || '',
        tokensUsed: totalTokens,
        toolRounds: round,
        toolCalls: allToolCalls,
      };
    }

    messages.push({ role: 'assistant', content: blocks });

    const toolResults = [];
    for (const tu of toolUses) {
      allToolCalls.push({
        name: tu.name,
        arguments: tu.input,
      });
      const content = await executeApiTool(collection, tu.name, tu.input || {}, resolvedApiToken);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: tu.id,
        content,
      });
    }
    messages.push({ role: 'user', content: toolResults });
  }
  return { response: 'Stopped after maximum tool rounds.', tokensUsed: totalTokens, toolRounds: MAX_ROUNDS, toolCalls: allToolCalls };
}

/**
 * @param {object} input
 * @param {string} input.provider - openai | claude
 */
async function runToolChat(input) {
  const { provider, apiKey, model, systemPrompt, userMessage, history, collection, resolvedApiToken } = input;
  const p = (provider || '').toLowerCase();
  if (p === 'openai') {
    return runOpenAIToolLoop({ apiKey, model, systemPrompt, userMessage, history, collection, resolvedApiToken });
  }
  if (p === 'claude') {
    return runClaudeToolLoop({ apiKey, model, systemPrompt, userMessage, history, collection, resolvedApiToken });
  }
  throw new Error(`Tool calling is not implemented for provider: ${provider}`);
}

module.exports = { runToolChat };
