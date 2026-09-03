class AIProvider {
  /**
   * Initializes the provider with any necessary configuration.
   */
  constructor() {}

  /**
   * Summarizes the given academic text.
   * @param {string} text - The extracted text from the material.
   * @returns {Promise<string>} The generated summary.
   */
  async summarizeContent(text) {
    throw new Error('Method summarizeContent() must be implemented by subclass.');
  }

  /**
   * Answers a question based solely on the provided academic text.
   * @param {string} text - The extracted text from the material.
   * @param {string} question - The user's question.
   * @returns {Promise<string>} The generated answer.
   */
  async askQuestion(text, question) {
    throw new Error('Method askQuestion() must be implemented by subclass.');
  }
}

module.exports = AIProvider;
