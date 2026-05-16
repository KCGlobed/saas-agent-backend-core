const LLMClient = require('./llm/LLMClient');

/**
 * Score how well the AI response matches the retrieved context.
 *
 * Returns { score: number (0–100) | null, note: string }
 *
 * - score is null when there is no context to evaluate against (no RAG hits, no tool data).
 * - Uses a minimal single-turn LLM call (very low token cost).
 */
async function scoreAccuracy({ query, response, context, hasRagHits, toolCallsMade = [], provider, apiKey, model }) {
  // Nothing to evaluate against — mark N/A
  const hasContext = hasRagHits && context && context.trim() && !context.includes('No relevant context');
  const hasToolData = Array.isArray(toolCallsMade) && toolCallsMade.length > 0;

  if (!hasContext && !hasToolData) {
    return { score: null, note: 'N/A — no RAG context or tool data available to evaluate against.' };
  }

  const contextSnippet = hasContext
    ? context.substring(0, 1500)   // cap to avoid token bloat
    : '[No document context — evaluation based on tool call presence]';

  const systemPrompt = `You are an AI evaluation assistant. Your ONLY job is to rate how accurately and faithfully an AI assistant's response answers a user's question based solely on the provided context.

Output EXACTLY this JSON and nothing else:
{"score": <integer 0-100>, "note": "<one sentence reason>"}

Scoring guide:
- 90–100: Response directly and fully answers from context, no hallucination.
- 70–89: Mostly correct, minor omission or slight deviation.
- 50–69: Partially correct, some relevant info used but gaps present.
- 20–49: Loosely related, missing key information or mixed with hallucination.
- 0–19: Largely incorrect, ignores context, or fabricates information.`;

  const userMessage = `USER QUERY:\n${query}\n\nCONTEXT PROVIDED TO AI:\n${contextSnippet}\n\nAI RESPONSE:\n${response.substring(0, 2000)}\n\nRate the accuracy of the AI response against the context.`;

  try {
    const result = await LLMClient.generateResponse({
      provider,
      apiKey,
      model,
      prompt: userMessage,
      systemPrompt,
    });

    const raw = result.response?.trim() || '';

    // Strip markdown fences if model wraps in ```json
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);

    const score = Math.min(100, Math.max(0, Number(parsed.score) || 0));
    const note = String(parsed.note || '').substring(0, 300);
    return { score, note };
  } catch (err) {
    console.warn('[accuracy] Scoring failed:', err.message);
    return { score: null, note: `Scoring failed: ${err.message}` };
  }
}

module.exports = { scoreAccuracy };
