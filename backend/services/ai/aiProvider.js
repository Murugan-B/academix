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

  /**
   * Generates a quiz from the provided academic text.
   * @param {string} text - The extracted text from the material.
   * @returns {Promise<Array>} Array of quiz question objects.
   */
  async generateQuiz(text) {
    throw new Error('Method generateQuiz() must be implemented by subclass.');
  }

  /**
   * Generates a personalized AI recommendation based on quiz stats.
   * @param {object} stats - The student's quiz performance stats.
   * @returns {Promise<string>} The recommendation text.
   */
  async generateRecommendation(stats) {
    throw new Error('Method generateRecommendation() must be implemented by subclass.');
  }
}

module.exports = AIProvider;
