const OpenAIProvider = require('./OpenAIProvider');
const ClaudeProvider = require('./ClaudeProvider');
const { runToolChat } = require('./toolChatRunner');

class LLMClient {
  /**
   * Factory method to get the correct LLM provider
   * @param {string} providerName - 'openai', 'claude'
   * @param {string} apiKey - Decrypted API key
   * @returns {BaseProvider}
   */
  static getProvider(providerName, apiKey) {
    switch (providerName.toLowerCase()) {
      case 'openai':
        return new OpenAIProvider(apiKey);
      case 'claude':
        return new ClaudeProvider(apiKey);
      case 'llama':
        throw new Error("LLaMA provider is currently disabled as per user request.");
      default:
        throw new Error(`Unsupported LLM provider: ${providerName}`);
    }
  }

  /**
   * Generates a response using the specified provider.
   * @param {Object} input - { provider, apiKey, model, prompt, systemPrompt }
   */
  static async generateResponse(input) {
    const { provider, apiKey, model, prompt, history, systemPrompt } = input;
    
    const client = this.getProvider(provider, apiKey);
    
    return await client.generateResponse(prompt, { model, systemPrompt, history });
  }

  /**
   * Multi-turn tool loop (OpenAI / Claude) using HTTP APIs from collection.json.
   */
  static async generateResponseWithTools(input) {
    const { provider, apiKey, model, systemPrompt, userMessage, history, collection } = input;
    return runToolChat({ provider, apiKey, model, systemPrompt, userMessage, history, collection });
  }
}

module.exports = LLMClient;
