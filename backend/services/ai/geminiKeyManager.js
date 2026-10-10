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
   * Discovers all configured GEMINI_API_KEY_* environment variables and standard GEMINI_API_KEY.
   */
  initKeys() {
    const discovered = new Map(); // keyString -> slot metadata

    // 1. Check numbered keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ... up to any N
    const envKeys = Object.keys(process.env)
      .filter(k => /^GEMINI_API_KEY_\d+$/i.test(k))
      .sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

    for (const envKey of envKeys) {
      const val = (process.env[envKey] || '').trim();
      if (val && !discovered.has(val)) {
        discovered.set(val, {
          slotId: `slot-${discovered.size + 1}`,
          envName: envKey,
          key: val,
          status: 'ACTIVE', // ACTIVE | COOLDOWN | INVALID
          cooldownUntil: 0,
          failureCount: 0,
          exhaustedCount: 0,
          successCount: 0,
          lastUsedAt: 0,
          lastError: null
        });
      }
    }

    // 2. Also check standard GEMINI_API_KEY if not already discovered
    const standardKey = (process.env.GEMINI_API_KEY || '').trim();
    if (standardKey && !discovered.has(standardKey)) {
      discovered.set(standardKey, {
        slotId: `slot-${discovered.size + 1}`,
        envName: 'GEMINI_API_KEY',
        key: standardKey,
        status: 'ACTIVE',
        cooldownUntil: 0,
        failureCount: 0,
        exhaustedCount: 0,
        successCount: 0,
        lastUsedAt: 0,
        lastError: null
      });
    }

    this.slots = Array.from(discovered.values());
    console.log(`[GeminiKeyManager] Discovered ${this.slots.length} distinct Gemini API key slot(s).`);
  }

  /**
   * Reload keys if environment changes at runtime
   */
  refresh() {
    this.initKeys();
  }

  /**
   * Returns true if at least one Gemini key is configured
   */
  hasConfiguredKeys() {
    return this.slots.length > 0;
  }

  /**
   * Returns list of eligible keys (status = ACTIVE and not in cooldown)
   */
  getEligibleSlots() {
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
    if (!slot) return;

    slot.failureCount += 1;
    const msg = error?.message || String(error);
    slot.lastError = msg;

    // Detect permanent invalid key
    if (
      msg.includes('API_KEY_INVALID') ||
      msg.includes('API key not valid') ||
      msg.includes('PERMISSION_DENIED') ||
      msg.includes('401') ||
      msg.includes('403') && !msg.includes('quota')
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
    const now = Date.now();
    return this.slots.map(s => {
      const remainingCooldown = Math.max(0, Math.ceil((s.cooldownUntil - now) / 1000));
      return {
        slotId: s.slotId,
        envName: s.envName,
        status: remainingCooldown > 0 ? 'COOLDOWN' : s.status,
        cooldownRemainingSeconds: remainingCooldown,
        successCount: s.successCount,
        exhaustedCount: s.exhaustedCount,
        lastUsedAt: s.lastUsedAt ? new Date(s.lastUsedAt).toISOString() : null,
        isAvailable: s.status === 'ACTIVE' && remainingCooldown === 0
      };
    });
  }
}

module.exports = new GeminiKeyManager();
