class BaseProvider {
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error("API Key is required to instantiate a provider.");
    }
    this.apiKey = apiKey;
  }

  /**
   * Abstract method to be implemented by child classes.
   * @param {string} prompt - The user query/context.
   * @param {Object} config - Contains model, systemPrompt, etc.
   * @returns {Promise<{response: string, tokensUsed: number}>}
   */
  async generateResponse(prompt, config) {
    throw new Error("generateResponse() must be implemented by the provider.");
  }

  /**
   * Executes an async operation with timeout and optional retries.
   * @param {Function} operation - The promise-returning function to execute.
   * @param {number} timeoutMs - Timeout in milliseconds.
   */
  async executeWithTimeout(operation, timeoutMs = 30000) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`LLM Timeout: Request took longer than ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = BaseProvider;
