/**
 * Multi-Key Manager for Gemini API
 * Concurrency-safe key rotation, quota exhaustion cooldown tracking, and key health diagnostics.
 * Never exposes actual secret key values in logs, responses, or client payloads.
 */

class GeminiKeyManager {
  constructor() {
    this.slots = [];
    this.currentIndex = 0;
    this.initKeys();
  }

  /**
   * Cleans and sanitizes an environment variable value
   */
  _cleanKey(val) {
    if (!val || typeof val !== 'string') return '';
    let cleaned = val.trim();
    // Strip leading and trailing quotes (e.g. "AIzaSy..." or 'AIzaSy...')
    cleaned = cleaned.replace(/^['"]+|['"]+$/g, '').trim();
    return cleaned;
  }

  /**
   * Discovers all configured GEMINI_API_KEY_* environment variables, standard GEMINI_API_KEY, and common aliases.
   */
  initKeys() {
    const discovered = new Map(); // keyString -> slot metadata

    // Preserve existing runtime metrics (failure counts, cooldowns, success counts)
    const existingSlotMap = new Map();
    for (const s of (this.slots || [])) {
      if (s.key) {
        existingSlotMap.set(s.key, s);
      }
    }

    // 1. Check numbered keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_01, GEMINI_API_KEY1, GEMINI_KEY_1, etc.
    const envKeys = Object.keys(process.env)
      .filter(k => /^GEMINI_API_KEY_?\d+$/i.test(k) || /^GEMINI_KEY_?\d+$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

    for (const envKey of envKeys) {
      const val = this._cleanKey(process.env[envKey]);
      if (val && !discovered.has(val) && val !== 'your_new_key_here' && val !== 'your_api_key_here' && val !== 'not-configured') {
        const existing = existingSlotMap.get(val);
        discovered.set(val, {
          slotId: existing?.slotId || `slot-${discovered.size + 1}`,
          envName: envKey,
          key: val,
          status: existing?.status || 'ACTIVE', // ACTIVE | COOLDOWN | INVALID
          cooldownUntil: existing?.cooldownUntil || 0,
          failureCount: existing?.failureCount || 0,
          exhaustedCount: existing?.exhaustedCount || 0,
          successCount: existing?.successCount || 0,
          lastUsedAt: existing?.lastUsedAt || 0,
          lastError: existing?.lastError || null
        });
      }
    }

    // 2. Also check standard keys if not already discovered
    const standardKeys = [
      { name: 'GEMINI_API_KEY', val: this._cleanKey(process.env.GEMINI_API_KEY) },
      { name: 'GOOGLE_API_KEY', val: this._cleanKey(process.env.GOOGLE_API_KEY) },
      { name: 'GOOGLE_GEMINI_API_KEY', val: this._cleanKey(process.env.GOOGLE_GEMINI_API_KEY) },
      { name: 'GEMINI_KEY', val: this._cleanKey(process.env.GEMINI_KEY) }
    ];

    for (const item of standardKeys) {
      if (item.val && !discovered.has(item.val) && item.val !== 'your_new_key_here' && item.val !== 'your_api_key_here' && item.val !== 'not-configured') {
        const existing = existingSlotMap.get(item.val);
        discovered.set(item.val, {
          slotId: existing?.slotId || `slot-${discovered.size + 1}`,
          envName: item.name,
          key: item.val,
          status: existing?.status || 'ACTIVE',
          cooldownUntil: existing?.cooldownUntil || 0,
          failureCount: existing?.failureCount || 0,
          exhaustedCount: existing?.exhaustedCount || 0,
          successCount: existing?.successCount || 0,
          lastUsedAt: existing?.lastUsedAt || 0,
          lastError: existing?.lastError || null
        });
      }
    }

    // 3. Also support comma-separated or newline-separated keys in GEMINI_API_KEYS / GEMINI_KEYS
    const listKeys = this._cleanKey(process.env.GEMINI_API_KEYS || process.env.GEMINI_KEYS);
    if (listKeys) {
      const parts = listKeys.split(/[,;\n]+/).map(p => this._cleanKey(p)).filter(Boolean);
      parts.forEach((k, idx) => {
        if (k && !discovered.has(k) && k !== 'your_new_key_here' && k !== 'your_api_key_here') {
          const existing = existingSlotMap.get(k);
          discovered.set(k, {
            slotId: existing?.slotId || `slot-${discovered.size + 1}`,
            envName: `GEMINI_API_KEYS[${idx + 1}]`,
            key: k,
            status: existing?.status || 'ACTIVE',
            cooldownUntil: existing?.cooldownUntil || 0,
            failureCount: existing?.failureCount || 0,
            exhaustedCount: existing?.exhaustedCount || 0,
            successCount: existing?.successCount || 0,
            lastUsedAt: existing?.lastUsedAt || 0,
            lastError: existing?.lastError || null
          });
        }
      });
    }

    // Re-index slot IDs consistently
    const newSlots = Array.from(discovered.values());
    newSlots.forEach((s, idx) => {
      s.slotId = `slot-${idx + 1}`;
    });

    this.slots = newSlots;
    return this.slots;
  }

  /**
   * Reload keys if environment changes at runtime
   */
  refresh() {
    return this.initKeys();
  }

  /**
   * Ensures keys are dynamically synced with current process.env
   */
  _ensureSynced() {
    // Check if env has keys that are not yet discovered or vice versa
    const envKeys = Object.keys(process.env).filter(k => /^GEMINI_API_KEY/i.test(k) || /^GOOGLE_API_KEY/i.test(k) || /^GEMINI_KEY/i.test(k));
    if (this.slots.length === 0 && envKeys.length > 0) {
      this.initKeys();
    }
  }

  /**
   * Returns true if at least one Gemini key is configured
   */
  hasConfiguredKeys() {
    this._ensureSynced();
    return this.slots.length > 0;
  }

  /**
   * Returns list of eligible keys (status = ACTIVE and not in cooldown)
   */
  getEligibleSlots() {
    this._ensureSynced();
    const now = Date.now();
    return this.slots.filter(s => {
      if (s.status === 'INVALID') return false;
      if (s.cooldownUntil > now) return false;
      // If cooldown expired, recover to ACTIVE
      if (s.status === 'COOLDOWN' && s.cooldownUntil <= now) {
        s.status = 'ACTIVE';
        s.cooldownUntil = 0;
      }
      return true;
    });
  }

  /**
   * Selects next available key using round-robin / lowest recent failure strategy
   * @param {Array<string>} excludeSlotIds - slots already attempted in this request
   */
  acquireKey(excludeSlotIds = []) {
    const eligible = this.getEligibleSlots().filter(s => !excludeSlotIds.includes(s.slotId));
    if (eligible.length === 0) {
      return null;
    }

    // Sort by least recently used and lowest failure count
    eligible.sort((a, b) => {
      if (a.failureCount !== b.failureCount) {
        return a.failureCount - b.failureCount;
      }
      return a.lastUsedAt - b.lastUsedAt;
    });

    const selected = eligible[0];
    selected.lastUsedAt = Date.now();
    return selected;
  }

  /**
   * Record a successful operation on a key slot
   */
  recordSuccess(slotId) {
    const slot = this.slots.find(s => s.slotId === slotId);
    if (slot) {
      slot.successCount += 1;
      slot.failureCount = 0;
      slot.status = 'ACTIVE';
      slot.lastError = null;
    }
  }

  /**
   * Record an error on a key slot and determine cooldown / invalidation
   * @param {string} slotId
   * @param {Error|object} error
   * @param {number} cooldownSeconds - optional custom cooldown duration in seconds
   */
  recordFailure(slotId, error, cooldownSeconds = 600) {
    const slot = this.slots.find(s => s.slotId === slotId);
    if (!slot) return { isInvalid: false, isQuota: false };

    slot.failureCount += 1;
    const msg = error?.message || String(error);
    slot.lastError = msg;

    // Detect permanent invalid key
    if (
      msg.includes('API_KEY_INVALID') ||
      msg.includes('API key not valid') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('401') ||
      (msg.includes('403') && !msg.includes('quota'))
    ) {
      slot.status = 'INVALID';
      console.error(`[GeminiKeyManager] ${slot.envName} (${slot.slotId}) marked INVALID: ${msg}`);
      return { isInvalid: true, isQuota: false };
    }

    // Detect rate limit / quota exhaustion
    if (
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('Quota exceeded') ||
      msg.includes('rate-limits')
    ) {
      slot.exhaustedCount += 1;
      slot.status = 'COOLDOWN';
      slot.cooldownUntil = Date.now() + cooldownSeconds * 1000;
      console.warn(`[GeminiKeyManager] ${slot.envName} (${slot.slotId}) rate-limited / quota exhausted. In cooldown for ${cooldownSeconds}s.`);
      return { isInvalid: false, isQuota: true };
    }

    // Transient server errors (503 / 500 / network) -> Short 30s pause
    if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand') || msg.includes('ECONNRESET')) {
      slot.cooldownUntil = Date.now() + 30 * 1000;
      return { isInvalid: false, isQuota: false, isTransient: true };
    }

    return { isInvalid: false, isQuota: false };
  }

  /**
   * Returns safe status list of all slots without leaking secret values
   */
  getSafeStatus() {
    this._ensureSynced();
    const now = Date.now();
    return this.slots.map(s => {
      const remainingCooldown = Math.max(0, Math.ceil((s.cooldownUntil - now) / 1000));
      const currentStatus = remainingCooldown > 0 ? 'COOLDOWN' : s.status;
      
      let validationState = 'CONFIGURED_UNTESTED';
      if (s.status === 'INVALID') {
        validationState = 'INVALID';
      } else if (s.successCount > 0) {
        validationState = 'VALIDATED';
      } else if (s.failureCount > 0) {
        validationState = 'FAILED';
      }

      return {
        slotId: s.slotId,
        envName: s.envName,
        status: currentStatus,
        validationState,
        cooldownRemainingSeconds: remainingCooldown,
        successCount: s.successCount,
        failureCount: s.failureCount,
        exhaustedCount: s.exhaustedCount,
        lastUsedAt: s.lastUsedAt ? new Date(s.lastUsedAt).toISOString() : null,
        isAvailable: s.status === 'ACTIVE' && remainingCooldown === 0
      };
    });
  }
}

module.exports = new GeminiKeyManager();
