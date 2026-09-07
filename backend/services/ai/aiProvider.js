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
  /**
   * Generates structured personalized learning content for a weak topic grounded in academic material.
   * @param {string} topic - The topic name.
   * @param {string} materialText - Grounding text from academic material.
   * @param {Array} wrongQuestions - Array of questions the student got wrong.
   * @param {object} meta - Additional metadata (e.g. file_type, title).
   * @returns {Promise<object>} Structured learning object.
   */
  async generateLearningContent(topic, materialText, wrongQuestions = [], meta = {}) {
    throw new Error('Method generateLearningContent() must be implemented by subclass.');
  }
}

module.exports = AIProvider;
