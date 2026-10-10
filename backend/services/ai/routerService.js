const { GoogleGenAI } = require('@google/genai');
const OpenAI = require('openai');
const geminiKeyManager = require('./geminiKeyManager');

class SmartAIRouter {
  constructor() {
    this.geminiCandidateModels = [
      process.env.GEMINI_PREFERRED_MODEL || 'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro'
    ];

    this.openRouterTextModels = [
      process.env.OPENROUTER_MODEL,
      'openrouter/auto',
      'qwen/qwen-2.5-72b-instruct',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemini-2.5-flash'
    ].filter(Boolean);

    this.openRouterVisionModels = [
      process.env.OPENROUTER_VISION_MODEL,
      'openrouter/auto',
      'google/gemini-2.0-flash-001',
      'meta-llama/llama-3.2-11b-vision-instruct',
      'qwen/qwen-2-vl-72b-instruct',
      'openai/gpt-4o-mini'
    ].filter(Boolean);
  }

  /**
   * Returns list of safe selectable models for UI dropdown
   */
  getAvailableModels() {
    const geminiAvailable = geminiKeyManager.getEligibleSlots().length > 0;
    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const openrouterAvailable = !!(openrouterKey && openrouterKey !== 'your_new_key_here');

    const models = [
      {
        id: 'auto',
        name: 'Auto (Smart Multi-Provider Routing)',
        provider: 'auto',
        isDefault: true,
        supportsVision: true,
        status: geminiAvailable || openrouterAvailable ? 'available' : 'unavailable',
        badge: 'Recommended'
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        provider: 'gemini',
        supportsVision: true,
        status: geminiAvailable ? 'available' : 'unavailable',
        badge: 'Fast & Smart'
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        provider: 'gemini',
        supportsVision: true,
        status: geminiAvailable ? 'available' : 'unavailable',
        badge: 'High Throughput'
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        provider: 'gemini',
        supportsVision: true,
        status: geminiAvailable ? 'available' : 'unavailable',
        badge: 'Multimodal'
      },
      {
        id: 'openrouter-default',
        name: 'OpenRouter (Llama 3.3 / Qwen / Claude / Auto)',
        provider: 'openrouter',
        supportsVision: true,
        status: openrouterAvailable ? 'available' : 'unavailable',
        badge: 'Fallback Provider'
      }
    ];

    return models;
  }

  /**
   * Safe status summary of all AI routing backends
   */
  getSystemStatus() {
    const keySlots = geminiKeyManager.getSafeStatus();
    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    const openrouterConfigured = !!(openrouterKey && openrouterKey !== 'your_new_key_here');

    return {
      gemini: {
        configured: geminiKeyManager.hasConfiguredKeys(),
        totalSlots: keySlots.length,
        availableSlots: keySlots.filter(s => s.isAvailable).length,
        preferredModel: this.geminiCandidateModels[0],
        candidateModels: this.geminiCandidateModels,
        slots: keySlots
      },
      openrouter: {
        configured: openrouterConfigured,
        defaultModel: process.env.OPENROUTER_MODEL || 'openrouter/auto',
        visionModel: process.env.OPENROUTER_VISION_MODEL || 'google/gemini-2.0-flash-001',
        status: openrouterConfigured ? 'available' : 'not_configured'
      }
    };
  }

  /**
   * Central content generation method with multi-key rotation and multi-provider failover
   */
  async generateContent({
    systemPrompt = '',
    messages = [], // [{ role: 'user'|'assistant'|'system', content: string }]
    imageAttachment = null, // { mimeType, data (base64) }
    preferredModel = 'auto', // 'auto' | 'gemini-2.5-flash' | 'gemini-1.5-flash' | 'openrouter-default' | custom
    temperature = 0.7,
    jsonMode = false
  }) {
    let requestedProvider = 'auto';
    let targetGeminiModel = this.geminiCandidateModels[0];

    if (preferredModel && preferredModel !== 'auto') {
      if (preferredModel.startsWith('gemini')) {
        requestedProvider = 'gemini';
        targetGeminiModel = preferredModel;
      } else if (preferredModel.startsWith('openrouter') || preferredModel.includes('/')) {
        requestedProvider = 'openrouter';
      }
    }

    const errors = [];
    let fallbackOccurred = false;
    let fallbackReason = null;

    // ── Strategy A: Attempt Gemini (if Auto or Gemini requested) ─────────────
    if (requestedProvider === 'auto' || requestedProvider === 'gemini') {
      const modelsToTry = requestedProvider === 'gemini' && targetGeminiModel
        ? [targetGeminiModel, ...this.geminiCandidateModels.filter(m => m !== targetGeminiModel)]
        : this.geminiCandidateModels;

      for (const modelName of modelsToTry) {
        const attemptedSlots = [];

        while (true) {
          const slot = geminiKeyManager.acquireKey(attemptedSlots);
          if (!slot) {
            // No more available keys for this model
            break;
          }
          attemptedSlots.push(slot.slotId);

          try {
            const ai = new GoogleGenAI({ apiKey: slot.key });
            const contents = this._buildGeminiContents(messages, imageAttachment);

            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config: {
                systemInstruction: systemPrompt || undefined,
                temperature
              }
            });

            const text = response.text || '';
            geminiKeyManager.recordSuccess(slot.slotId);

            if (modelName !== (preferredModel === 'auto' ? this.geminiCandidateModels[0] : preferredModel)) {
              fallbackOccurred = true;
              fallbackReason = `Requested model was busy/exhausted. Generated via ${modelName} on ${slot.slotId}.`;
            }

            return {
              text,
              providerUsed: 'gemini',
              modelUsed: modelName,
              slotUsed: slot.slotId,
              fallbackOccurred,
              fallbackReason,
              estimatedPromptTokens: Math.ceil((systemPrompt.length + JSON.stringify(messages).length) / 4),
              estimatedCompletionTokens: Math.ceil(text.length / 4)
            };
          } catch (err) {
            const failResult = geminiKeyManager.recordFailure(slot.slotId, err);
            errors.push(`[Gemini][${slot.slotId}][${modelName}] ${err.message}`);

            // If non-retryable error (e.g. invalid user prompt format), don't keep rotating keys pointlessly
            if (err.status === 400 && !err.message.includes('API_KEY')) {
              throw err;
            }

            // If quota error on this key, loop to try next key slot
            if (failResult.isQuota) {
              fallbackOccurred = true;
              fallbackReason = `Gemini key (${slot.slotId}) rate limit exceeded. Rotating key...`;
              continue;
            }
          }
        }
      }
    }

    // ── Strategy B: Fallback to OpenRouter ────────────────────────────────────
    const openrouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (openrouterKey && openrouterKey !== 'your_new_key_here') {
      const candidateOpenRouterModels = imageAttachment
        ? this.openRouterVisionModels
        : this.openRouterTextModels;

      const client = new OpenAI({
        baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
        apiKey: openrouterKey,
        defaultHeaders: {
          'HTTP-Referer': 'https://academix.app',
          'X-Title': 'Academix Smart AI'
        },
        timeout: 45000,
        maxRetries: 0
      });

      for (const model of candidateOpenRouterModels) {
        try {
          const payloadMessages = this._buildOpenRouterMessages(systemPrompt, messages, imageAttachment);
          const params = {
            model,
            messages: payloadMessages,
            temperature
          };
          if (jsonMode) {
            params.response_format = { type: 'json_object' };
          }

          const response = await client.chat.completions.create(params);
          const text = response.choices?.[0]?.message?.content || '';

          if (requestedProvider === 'gemini' || (requestedProvider === 'auto' && geminiKeyManager.hasConfiguredKeys())) {
            fallbackOccurred = true;
            fallbackReason = `Gemini quota/keys exhausted. Seamlessly routed to OpenRouter (${model}).`;
          }

          return {
            text,
            providerUsed: 'openrouter',
            modelUsed: model,
            slotUsed: 'openrouter-primary',
            fallbackOccurred,
            fallbackReason,
            estimatedPromptTokens: response.usage?.prompt_tokens || Math.ceil((systemPrompt.length + JSON.stringify(messages).length) / 4),
            estimatedCompletionTokens: response.usage?.completion_tokens || Math.ceil(text.length / 4)
          };
        } catch (orErr) {
          errors.push(`[OpenRouter][${model}] ${orErr.message}`);
          console.warn(`[SmartAIRouter] OpenRouter candidate "${model}" notice: ${orErr.message}`);
        }
      }
    }

    // ── If all providers and fallbacks failed ─────────────────────────────────
    console.error('[SmartAIRouter] All configured AI providers & fallbacks failed:', errors);
    const errorSummary = errors.length > 0 ? errors[errors.length - 1] : 'All AI models are currently unavailable.';
    
    throw new Error(`AI Service Notice: All configured AI keys and fallback models are currently experiencing high demand or rate limits. Please retry in a few moments. (${errorSummary})`);
  }

  /**
   * Formats messages into Google GenAI SDK contents format
   */
  _buildGeminiContents(messages, imageAttachment) {
    return messages.map((m, idx) => {
      const isLastUserMsg = (idx === messages.length - 1) && (m.role === 'user');
      const parts = [{ text: m.content || '' }];

      if (isLastUserMsg && imageAttachment?.data && imageAttachment?.mimeType) {
        parts.push({
          inlineData: {
            mimeType: imageAttachment.mimeType,
            data: imageAttachment.data
          }
        });
      }

      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });
  }

  /**
   * Formats messages into OpenAI / OpenRouter format
   */
  _buildOpenRouterMessages(systemPrompt, messages, imageAttachment) {
    const list = [];
    if (systemPrompt) {
      list.push({ role: 'system', content: systemPrompt });
    }

    messages.forEach((m, idx) => {
      const isLastUserMsg = (idx === messages.length - 1) && (m.role === 'user');

      if (isLastUserMsg && imageAttachment?.data && imageAttachment?.mimeType) {
        list.push({
          role: 'user',
          content: [
            { type: 'text', text: m.content || '' },
            {
              type: 'image_url',
              image_url: {
                url: `data:${imageAttachment.mimeType};base64,${imageAttachment.data}`
              }
            }
          ]
        });
      } else {
        list.push({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || ''
        });
      }
    });

    return list;
  }
}

module.exports = new SmartAIRouter();
