const OpenAI = require('openai');
const BaseProvider = require('./BaseProvider');

class OpenAIProvider extends BaseProvider {
  constructor(apiKey) {
    super(apiKey);
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async generateResponse(prompt, config) {
    const model = config.model || 'gpt-4o';
    const systemPrompt = config.systemPrompt || 'You are a helpful AI assistant.';

    const operation = async () => {
      let retries = 3;
      let delay = 1000;

      while (retries > 0) {
        try {
          const response = await this.client.chat.completions.create({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt }
            ]
          });

          return {
            response: response.choices[0].message.content,
            tokensUsed: response.usage.total_tokens || 0
          };
        } catch (error) {
          if (error.status === 429 || error.status >= 500) {
            retries -= 1;
            if (retries === 0) throw new Error(`OpenAI Error: ${error.message}`);
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
          } else {
            throw new Error(`OpenAI Error: ${error.message}`);
          }
        }
      }
    };

    return this.executeWithTimeout(operation, 60000); // 60s timeout
  }
}

module.exports = OpenAIProvider;
