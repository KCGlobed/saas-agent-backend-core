const Anthropic = require('@anthropic-ai/sdk');
const BaseProvider = require('./BaseProvider');

class ClaudeProvider extends BaseProvider {
  constructor(apiKey) {
    super(apiKey);
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async generateResponse(prompt, config) {
    const model = config.model || 'claude-3-opus-20240229';
    const systemPrompt = config.systemPrompt || 'You are a helpful AI assistant.';

    const operation = async () => {
      let retries = 3;
      let delay = 1000;

      while (retries > 0) {
        try {
          const response = await this.client.messages.create({
            model: model,
            system: systemPrompt,
            max_tokens: 1024,
            messages: [
              { role: "user", content: prompt }
            ]
          });

          return {
            response: response.content[0].text,
            tokensUsed: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
          };
        } catch (error) {
          if (error.status === 429 || error.status >= 500) {
            retries -= 1;
            if (retries === 0) throw new Error(`Claude Error: ${error.message}`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw new Error(`Claude Error: ${error.message}`);
          }
        }
      }
    };

    return this.executeWithTimeout(operation, 60000); // 60s timeout
  }
}

module.exports = ClaudeProvider;
