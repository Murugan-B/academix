const db = require('../../db');

/**
 * Token Pricing Estimator (USD per 1M tokens) based on standard public rates
 */
const PROVIDER_PRICING = {
  gemini: {
    promptPerMillion: 0.075,
    completionPerMillion: 0.30
  },
  openrouter: {
    promptPerMillion: 0.15,
    completionPerMillion: 0.60
  }
};

class UsageLedgerService {
  /**
   * Check if a user / global request is allowed under configured quota limits
   * @param {string} userId - User UUID
   * @param {string} featureCategory - Category from ai_quota_configs
   * @returns {Promise<{ allowed: boolean, reason?: string, usageToday?: number, dailyLimit?: number, warning?: boolean }>}
   */
  async checkQuota(userId, featureCategory) {
    try {
      const configRes = await db.query(
        `SELECT daily_limit_per_user, monthly_limit_per_user, global_daily_limit, is_enabled, warning_threshold_pct, feature_name
         FROM ai_quota_configs
         WHERE feature_category = $1`,
        [featureCategory]
      );

      if (configRes.rowCount === 0) {
        return { allowed: true };
      }

      const config = configRes.rows[0];

      if (!config.is_enabled) {
        return {
          allowed: false,
          reason: `The feature "${config.feature_name}" is temporarily disabled by system administrators.`
        };
      }

      // Check Global Daily Usage
      const globalTodayRes = await db.query(
        `SELECT COUNT(*) as count
         FROM ai_usage_ledger
         WHERE feature_category = $1 
           AND status = 'SUCCESS'
           AND created_at >= CURRENT_DATE`,
        [featureCategory]
      );

      const globalTodayCount = parseInt(globalTodayRes.rows[0]?.count || 0, 10);
      if (config.global_daily_limit && globalTodayCount >= config.global_daily_limit) {
        return {
          allowed: false,
          reason: `Global daily quota reached for ${config.feature_name}. Please try again tomorrow.`
        };
      }

      // Check Per-User Daily Usage if user is authenticated
      if (userId) {
        const userTodayRes = await db.query(
          `SELECT COUNT(*) as count
           FROM ai_usage_ledger
           WHERE user_id = $1 
             AND feature_category = $2 
             AND status = 'SUCCESS'
             AND created_at >= CURRENT_DATE`,
          [userId, featureCategory]
        );

        const userTodayCount = parseInt(userTodayRes.rows[0]?.count || 0, 10);
        const dailyLimit = config.daily_limit_per_user || 50;

        if (userTodayCount >= dailyLimit) {
          return {
            allowed: false,
            reason: `You have reached your daily limit of ${dailyLimit} requests for ${config.feature_name}. Reset occurs at midnight UTC.`,
            usageToday: userTodayCount,
            dailyLimit
          };
        }

        const warningThreshold = Math.floor((dailyLimit * (config.warning_threshold_pct || 80)) / 100);
        const isWarning = userTodayCount >= warningThreshold;

        return {
          allowed: true,
          usageToday: userTodayCount,
          dailyLimit,
          warning: isWarning
        };
      }

      return { allowed: true };
    } catch (err) {
      console.warn('[UsageLedgerService] Quota check notice:', err.message);
      return { allowed: true }; // Fail-open gracefully if ledger check fails
    }
  }

  /**
   * Atomically record an AI usage entry in the ledger
   */
  async recordUsage({
    userId = null,
    featureCategory,
    provider = 'gemini',
    model = 'gemini-2.5-flash',
    promptTokens = 0,
    completionTokens = 0,
    totalTokens = 0,
    status = 'SUCCESS',
    errorCategory = null,
    ipAddress = null
  }) {
    try {
      const pTokens = parseInt(promptTokens, 10) || 0;
      const cTokens = parseInt(completionTokens, 10) || 0;
      const tTokens = parseInt(totalTokens, 10) || (pTokens + cTokens);

      const pricing = PROVIDER_PRICING[provider?.toLowerCase()] || PROVIDER_PRICING.gemini;
      const estimatedCost = (
        (pTokens / 1_000_000) * pricing.promptPerMillion +
        (cTokens / 1_000_000) * pricing.completionPerMillion
      );

      await db.query(
        `INSERT INTO ai_usage_ledger 
          (user_id, feature_category, provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, status, error_category, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          userId,
          featureCategory,
          provider || 'gemini',
          model || 'default',
          pTokens,
          cTokens,
          tTokens,
          estimatedCost.toFixed(6),
          status,
          errorCategory,
          ipAddress
        ]
      );
    } catch (err) {
      console.warn('[UsageLedgerService] Failed to record usage entry:', err.message);
    }
  }

  /**
   * Get Admin AI Quota Dashboard Analytics
   */
  async getDashboardMetrics() {
    // 1. Fetch all category configurations
    const configsRes = await db.query(
      `SELECT feature_category, feature_name, daily_limit_per_user, monthly_limit_per_user, global_daily_limit, is_enabled, warning_threshold_pct
       FROM ai_quota_configs
       ORDER BY feature_name ASC`
    );

    // 2. Fetch Aggregated Usage per Category (Today, This Month, and All-Time)
    const categoryStatsRes = await db.query(`
      SELECT 
        feature_category,
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
        COUNT(*) FILTER (WHERE status != 'SUCCESS') as failure_count,
        COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE) as today_requests,
        COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at >= date_trunc('month', CURRENT_DATE)) as month_requests,
        COUNT(*) FILTER (WHERE error_category = 'RESOURCE_EXHAUSTED' OR error_category = 'QUOTA_EXCEEDED') as quota_exhaustion_count,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_estimated_cost,
        MAX(created_at) as last_used_at
      FROM ai_usage_ledger
      GROUP BY feature_category
    `);

    const statsMap = {};
    for (const r of categoryStatsRes.rows) {
      statsMap[r.feature_category] = r;
    }

    // 3. Provider breakdown
    const providerStatsRes = await db.query(`
      SELECT 
        provider,
        model,
        COUNT(*) as request_count,
        COUNT(*) FILTER (WHERE status = 'SUCCESS') as success_count,
        COALESCE(SUM(total_tokens), 0) as tokens,
        COALESCE(SUM(estimated_cost), 0) as cost
      FROM ai_usage_ledger
      GROUP BY provider, model
      ORDER BY request_count DESC
    `);

    // 4. Overall Top-level Metrics
    const overviewRes = await db.query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as requests_today,
        COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as requests_month,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(estimated_cost), 0) as total_cost,
        COUNT(*) FILTER (WHERE status = 'SUCCESS') as total_success,
        COUNT(*) FILTER (WHERE status != 'SUCCESS') as total_failures
      FROM ai_usage_ledger
    `);

    const categories = configsRes.rows.map(cfg => {
      const stats = statsMap[cfg.feature_category] || {};
      const todayCount = parseInt(stats.today_requests || 0, 10);
      const limit = cfg.global_daily_limit || 5000;
      const remaining = Math.max(0, limit - todayCount);

      return {
        featureCategory: cfg.feature_category,
        featureName: cfg.feature_name,
        isEnabled: cfg.is_enabled,
        dailyLimitPerUser: cfg.daily_limit_per_user,
        monthlyLimitPerUser: cfg.monthly_limit_per_user,
        globalDailyLimit: limit,
        warningThresholdPct: cfg.warning_threshold_pct,
        todayRequests: todayCount,
        monthRequests: parseInt(stats.month_requests || 0, 10),
        totalRequests: parseInt(stats.total_requests || 0, 10),
        requestsRemaining: remaining,
        successCount: parseInt(stats.success_count || 0, 10),
        failureCount: parseInt(stats.failure_count || 0, 10),
        quotaExhaustionCount: parseInt(stats.quota_exhaustion_count || 0, 10),
        totalTokens: parseInt(stats.total_tokens || 0, 10),
        estimatedCost: parseFloat(stats.total_estimated_cost || 0).toFixed(4),
        lastUsedAt: stats.last_used_at || null
      };
    });

    return {
      overview: {
        totalRequests: parseInt(overviewRes.rows[0]?.total_requests || 0, 10),
        requestsToday: parseInt(overviewRes.rows[0]?.requests_today || 0, 10),
        requestsMonth: parseInt(overviewRes.rows[0]?.requests_month || 0, 10),
        totalTokens: parseInt(overviewRes.rows[0]?.total_tokens || 0, 10),
        totalCost: parseFloat(overviewRes.rows[0]?.total_cost || 0).toFixed(4),
        totalSuccess: parseInt(overviewRes.rows[0]?.total_success || 0, 10),
        totalFailures: parseInt(overviewRes.rows[0]?.total_failures || 0, 10)
      },
      categories,
      providers: providerStatsRes.rows.map(p => ({
        provider: p.provider,
        model: p.model,
        requestCount: parseInt(p.request_count, 10),
        successCount: parseInt(p.success_count, 10),
        tokens: parseInt(p.tokens, 10),
        cost: parseFloat(p.cost).toFixed(4)
      }))
    };
  }

  /**
   * Get User Personal Usage Analytics
   */
  async getUserUsage(userId) {
    if (!userId) return { categories: [], totalRequestsToday: 0 };

    const configsRes = await db.query(
      `SELECT feature_category, feature_name, daily_limit_per_user, monthly_limit_per_user, is_enabled
       FROM ai_quota_configs
       ORDER BY feature_name ASC`
    );

    const userStatsRes = await db.query(
      `SELECT 
        feature_category,
        COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at >= CURRENT_DATE) as today_count,
        COUNT(*) FILTER (WHERE status = 'SUCCESS' AND created_at >= date_trunc('month', CURRENT_DATE)) as month_count,
        COUNT(*) as total_count,
        MAX(created_at) as last_used_at
       FROM ai_usage_ledger
       WHERE user_id = $1
       GROUP BY feature_category`,
      [userId]
    );

    const statsMap = {};
    for (const r of userStatsRes.rows) {
      statsMap[r.feature_category] = r;
    }

    let totalToday = 0;

    const categories = configsRes.rows.map(cfg => {
      const stats = statsMap[cfg.feature_category] || {};
      const todayCount = parseInt(stats.today_count || 0, 10);
      totalToday += todayCount;
      const dailyLimit = cfg.daily_limit_per_user || 50;
      const remainingToday = Math.max(0, dailyLimit - todayCount);

      return {
        featureCategory: cfg.feature_category,
        featureName: cfg.feature_name,
        isEnabled: cfg.is_enabled,
        dailyLimit,
        todayCount,
        remainingToday,
        monthCount: parseInt(stats.month_count || 0, 10),
        totalCount: parseInt(stats.total_count || 0, 10),
        lastUsedAt: stats.last_used_at || null
      };
    });

    return {
      totalRequestsToday: totalToday,
      categories
    };
  }

  /**
   * Get Paginated Usage Ledger for Admins
   */
  async getUsageLedger({ page = 1, limit = 20, featureCategory, provider, status }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (featureCategory) {
      params.push(featureCategory);
      conditions.push(`l.feature_category = $${params.length}`);
    }

    if (provider) {
      params.push(provider);
      conditions.push(`l.provider = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`l.status = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await db.query(
      `SELECT COUNT(*) FROM ai_usage_ledger l ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || 0, 10);

    const dataParams = [...params, limit, offset];
    const dataRes = await db.query(
      `SELECT 
        l.id,
        l.user_id,
        u.name as user_name,
        u.email as user_email,
        l.feature_category,
        c.feature_name,
        l.provider,
        l.model,
        l.prompt_tokens,
        l.completion_tokens,
        l.total_tokens,
        l.estimated_cost,
        l.status,
        l.error_category,
        l.created_at
       FROM ai_usage_ledger l
       LEFT JOIN users u ON l.user_id = u.id
       LEFT JOIN ai_quota_configs c ON l.feature_category = c.feature_category
       ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      dataParams
    );

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      records: dataRes.rows
    };
  }

  /**
   * Update Quota Config for a Feature Category
   */
  async updateQuotaConfig(featureCategory, updates, adminUserId) {
    const {
      dailyLimitPerUser,
      monthlyLimitPerUser,
      globalDailyLimit,
      isEnabled,
      warningThresholdPct
    } = updates;

    const res = await db.query(
      `UPDATE ai_quota_configs
       SET 
         daily_limit_per_user = COALESCE($1, daily_limit_per_user),
         monthly_limit_per_user = COALESCE($2, monthly_limit_per_user),
         global_daily_limit = COALESCE($3, global_daily_limit),
         is_enabled = COALESCE($4, is_enabled),
         warning_threshold_pct = COALESCE($5, warning_threshold_pct),
         updated_by = $6,
         updated_at = NOW()
       WHERE feature_category = $7
       RETURNING *`,
      [
        dailyLimitPerUser,
        monthlyLimitPerUser,
        globalDailyLimit,
        isEnabled,
        warningThresholdPct,
        adminUserId,
        featureCategory
      ]
    );

    if (res.rowCount === 0) {
      throw new Error(`Quota configuration for "${featureCategory}" not found.`);
    }

    return res.rows[0];
  }
}

module.exports = new UsageLedgerService();
