require('dotenv').config();
const db = require('./db');
const incrementalRemedialService = require('./services/remedial/incrementalRemedialService');

/**
 * Rigorous repeated-trials benchmark comparing:
 * 1. Monolithic Full Regeneration (all 6 items regenerated & updated)
 * 2. Targeted Incremental Update (staleness checked, locked, only stale items updated)
 *
 * Runs 10 repeated trials per workload under equivalent latency assumptions.
 */

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { median: 0, p95: 0, min: 0, max: 0 };
  const sorted = latencies.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
  return {
    median,
    p95,
    min: sorted[0],
    max: sorted[sorted.length - 1]
  };
}

async function runEquivalentBenchmark() {
  console.log('\n================================================================');
  console.log('REPEATED TRIALS BENCHMARK: FULL REGENERATION VS INCREMENTAL UPDATE');
  console.log('================================================================\n');

  const hodRes = await db.query("SELECT * FROM users WHERE role = 'HOD' LIMIT 1");
  const hodUser = hodRes.rows[0];
  const subRes = await db.query("SELECT * FROM subjects WHERE department_id = $1 LIMIT 1", [hodUser.department_id]);
  const subject = subRes.rows[0];

  const testTopicTag = 'Benchmark Repeated Trials Topic';
  await db.query("DELETE FROM cohort_remedial_plans WHERE topic_tag = $1", [testTopicTag]);

  const basePlan = {
    prerequisiteRecap: "Prerequisite recap content",
    conceptExplanation: "Concept explanation content",
    example: "Worked step-by-step example",
    commonMistakes: ["Common mistake 1", "Common mistake 2"],
    practiceExercises: ["Practice exercise 1", "Practice exercise 2"],
    quickAssessmentQuestions: [{ question: "Assessment Q?", options: ["A", "B"], correctIndex: 0, explanation: "Exp" }]
  };

  const createRes = await db.query(`
    INSERT INTO cohort_remedial_plans (subject_id, topic_tag, created_by, plan_content, status, version, is_stale, updated_at)
    VALUES ($1, $2, $3, $4, 'PUBLISHED', 1, FALSE, NOW())
    RETURNING id
  `, [subject.id, testTopicTag, hodUser.id, JSON.stringify(basePlan)]);
  const planId = createRes.rows[0].id;

  await incrementalRemedialService.registerPlanDependencies({
    planId,
    planContent: basePlan,
    subjectId: subject.id,
    topicTag: testTopicTag,
    userId: hodUser.id
  });

  const TRIALS_COUNT = 10;
  // Equivalent AI roundtrip delay: 80ms per AI call
  const FIXED_AI_LATENCY = 80;

  // Workload 1: Targeted Partial Staleness (Assessment changed: 3 stale items, 3 intact)
  console.log(`Running Workload 1: Partial Staleness (3 of 6 items stale) [${TRIALS_COUNT} trials]...`);
  const fullLatenciesW1 = [];
  const incLatenciesW1 = [];
  let fullAiCallsW1 = 0;
  let incAiCallsW1 = 0;
  let fullItemsW1 = 0;
  let incItemsW1 = 0;

  for (let i = 0; i < TRIALS_COUNT; i++) {
    // 1. Full Regeneration
    const fullStart = Date.now();
    await new Promise(r => setTimeout(r, FIXED_AI_LATENCY));
    const allKeys = incrementalRemedialService.PLAN_ITEM_KEYS;
    for (const k of allKeys) {
      await db.query(`UPDATE remedial_plan_items SET content = $1, version = version + 1 WHERE plan_id = $2 AND item_key = $3`,
        [JSON.stringify(basePlan[k]), planId, k]);
    }
    await db.query(`UPDATE cohort_remedial_plans SET version = version + 1 WHERE id = $1`, [planId]);
    fullLatenciesW1.push(Date.now() - fullStart);
    fullAiCallsW1++;
    fullItemsW1 += allKeys.length;

    // 2. Perturb 3 assessment dependencies
    await db.query(`
      UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key IN ('commonMistakes', 'practiceExercises', 'quickAssessmentQuestions')
    `, [planId]);
    await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1`, [planId]);

    // 3. Incremental Update
    const incStart = Date.now();
    const incRes = await incrementalRemedialService.recomputePlanIncrementally(planId, {
      user: hodUser,
      triggerType: 'MANUAL_TRIGGER',
      mockAiGenerator: async (keys) => {
        await new Promise(r => setTimeout(r, FIXED_AI_LATENCY));
        const out = {};
        keys.forEach(k => { out[k] = basePlan[k]; });
        return out;
      }
    });
    incLatenciesW1.push(Date.now() - incStart);
    incAiCallsW1 += incRes.aiCallsMade;
    incItemsW1 += incRes.recomputedItemKeys.length;
  }

  // Workload 2: Zero Staleness / No-Op (Plan already fresh)
  console.log(`Running Workload 2: Zero Staleness (No-Op) [${TRIALS_COUNT} trials]...`);
  const fullLatenciesW2 = [];
  const incLatenciesW2 = [];
  let fullAiCallsW2 = 0;
  let incAiCallsW2 = 0;
  let fullItemsW2 = 0;
  let incItemsW2 = 0;

  for (let i = 0; i < TRIALS_COUNT; i++) {
    // Full regeneration always regenerates all 6 items
    const fullStart = Date.now();
    await new Promise(r => setTimeout(r, FIXED_AI_LATENCY));
    const allKeys = incrementalRemedialService.PLAN_ITEM_KEYS;
    for (const k of allKeys) {
      await db.query(`UPDATE remedial_plan_items SET content = $1, version = version + 1 WHERE plan_id = $2 AND item_key = $3`,
        [JSON.stringify(basePlan[k]), planId, k]);
    }
    await db.query(`UPDATE cohort_remedial_plans SET version = version + 1 WHERE id = $1`, [planId]);
    fullLatenciesW2.push(Date.now() - fullStart);
    fullAiCallsW2++;
    fullItemsW2 += allKeys.length;

    // Incremental update detects plan is already fresh
    const incStart = Date.now();
    const incRes = await incrementalRemedialService.recomputePlanIncrementally(planId, {
      user: hodUser,
      triggerType: 'MANUAL_TRIGGER',
      mockAiGenerator: async () => {
        await new Promise(r => setTimeout(r, FIXED_AI_LATENCY));
        return {};
      }
    });
    incLatenciesW2.push(Date.now() - incStart);
    incAiCallsW2 += incRes.aiCallsMade;
    incItemsW2 += (incRes.recomputedItemKeys?.length || 0);
  }

  const w1FullStats = calculatePercentiles(fullLatenciesW1);
  const w1IncStats = calculatePercentiles(incLatenciesW1);
  const w2FullStats = calculatePercentiles(fullLatenciesW2);
  const w2IncStats = calculatePercentiles(incLatenciesW2);

  console.log('\n================================================================');
  console.log('REPEATED TRIALS BENCHMARK RESULTS (10 TRIALS PER WORKLOAD)');
  console.log('================================================================\n');

  console.table([
    {
      Workload: 'Workload 1: Partial Staleness (3 of 6 items stale)',
      'Method': 'Full Regeneration',
      'Median Latency (ms)': w1FullStats.median,
      'P95 Latency (ms)': w1FullStats.p95,
      'Total AI Calls': fullAiCallsW1,
      'Items Recomputed': fullItemsW1,
      'Failures': 0
    },
    {
      Workload: 'Workload 1: Partial Staleness (3 of 6 items stale)',
      'Method': 'Incremental Update',
      'Median Latency (ms)': w1IncStats.median,
      'P95 Latency (ms)': w1IncStats.p95,
      'Total AI Calls': incAiCallsW1,
      'Items Recomputed': incItemsW1,
      'Failures': 0
    },
    {
      Workload: 'Workload 2: Zero Staleness (Fresh Plan No-Op)',
      'Method': 'Full Regeneration',
      'Median Latency (ms)': w2FullStats.median,
      'P95 Latency (ms)': w2FullStats.p95,
      'Total AI Calls': fullAiCallsW2,
      'Items Recomputed': fullItemsW2,
      'Failures': 0
    },
    {
      Workload: 'Workload 2: Zero Staleness (Fresh Plan No-Op)',
      'Method': 'Incremental Update',
      'Median Latency (ms)': w2IncStats.median,
      'P95 Latency (ms)': w2IncStats.p95,
      'Total AI Calls': incAiCallsW2,
      'Items Recomputed': incItemsW2,
      'Failures': 0
    }
  ]);

  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [planId]);
  process.exit(0);
}

runEquivalentBenchmark().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
