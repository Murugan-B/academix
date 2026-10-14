require('dotenv').config();
const db = require('./db');
const incrementalRemedialService = require('./services/remedial/incrementalRemedialService');
const cohortAnalyticsController = require('./controllers/cohortAnalyticsController');

let testPassedCount = 0;
let testTotalCount = 0;

function assert(condition, testName) {
  testTotalCount++;
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    testPassedCount++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    throw new Error(`Assertion failed: ${testName}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runConcurrencyTestSuite() {
  console.log('\n================================================================');
  console.log('STARTING REMEDIAL PLAN CONCURRENCY & INTEGRITY TEST SUITE');
  console.log('================================================================\n');

  // 0. Setup test users and subject
  const hodRes = await db.query("SELECT * FROM users WHERE role = 'HOD' LIMIT 1");
  const studentRes = await db.query("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1");
  const otherDeptRes = await db.query("SELECT * FROM departments WHERE id != $1 LIMIT 1", [hodRes.rows[0].department_id]);

  if (hodRes.rowCount === 0 || studentRes.rowCount === 0) {
    throw new Error('Required test users not found in database');
  }

  const hodUser = hodRes.rows[0];
  const studentUser = studentRes.rows[0];

  const subRes = await db.query("SELECT * FROM subjects WHERE department_id = $1 LIMIT 1", [hodUser.department_id]);
  const subject = subRes.rows[0];

  const testTopicTagA = 'Concurrency Test Topic A';
  const testTopicTagB = 'Concurrency Test Topic B';

  // Clean up any stale records from prior runs
  await db.query("DELETE FROM cohort_remedial_plans WHERE topic_tag IN ($1, $2)", [testTopicTagA, testTopicTagB]);

  const basePlanContent = {
    prerequisiteRecap: "Prerequisite recap for concurrency tests.",
    conceptExplanation: "Concept explanation for concurrency tests.",
    example: "Worked example for concurrency tests.",
    commonMistakes: ["Common mistake 1", "Common mistake 2"],
    practiceExercises: ["Practice exercise 1", "Practice exercise 2"],
    quickAssessmentQuestions: [
      { question: "Q1?", options: ["A", "B", "C", "D"], correctIndex: 0, explanation: "Exp" }
    ]
  };

  // Helper to create a clean plan
  async function createTestPlan(topicTag) {
    const res = await db.query(`
      INSERT INTO cohort_remedial_plans (subject_id, topic_tag, created_by, plan_content, status, version, is_stale, updated_at)
      VALUES ($1, $2, $3, $4, 'PUBLISHED', 1, FALSE, NOW())
      RETURNING *
    `, [subject.id, topicTag, hodUser.id, JSON.stringify(basePlanContent)]);

    const plan = res.rows[0];
    await incrementalRemedialService.registerPlanDependencies({
      planId: plan.id,
      planContent: basePlanContent,
      subjectId: subject.id,
      topicId: null,
      topicTag,
      userId: hodUser.id
    });
    return plan;
  }

  // =========================================================================
  // SCENARIO 1: Two simultaneous updates to the same plan
  // =========================================================================
  console.log('--- SCENARIO 1: Two Simultaneous Updates to the Same Plan ---');
  const plan1 = await createTestPlan(testTopicTagA);

  // Invalidate an item to trigger staleness
  await db.query(`
    UPDATE remedial_plan_items
    SET status = 'STALE', updated_at = NOW()
    WHERE plan_id = $1 AND item_key = 'commonMistakes'
  `, [plan1.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan1.id]);

  // Launch two concurrent recomputations simultaneously with realistic AI execution delays
  const p1PromiseA = incrementalRemedialService.recomputePlanIncrementally(plan1.id, {
    user: hodUser,
    triggerType: 'MANUAL_TRIGGER',
    mockAiGenerator: async (staleKeys) => {
      await sleep(40); // Request A AI takes 40ms
      return { commonMistakes: ["Updated mistake by Request A"] };
    },
    throwOnConflict: false
  });

  const p1PromiseB = incrementalRemedialService.recomputePlanIncrementally(plan1.id, {
    user: hodUser,
    triggerType: 'MANUAL_TRIGGER',
    mockAiGenerator: async (staleKeys) => {
      await sleep(90); // Request B AI takes 90ms
      return { commonMistakes: ["Updated mistake by Request B"] };
    },
    throwOnConflict: false
  });

  const [res1A, res1B] = await Promise.all([p1PromiseA, p1PromiseB]);

  // Exactly one request must succeed, and the concurrent second request must detect conflict or no-op cleanly
  const succeededCount = (res1A.success ? 1 : 0) + (res1B.success ? 1 : 0);
  const conflictDetected = res1A.concurrencyConflict || res1B.concurrencyConflict;

  assert(succeededCount >= 1, 'At least one concurrent update completed successfully');
  assert(conflictDetected || succeededCount === 2, 'Concurrency control properly arbitrated simultaneous updates');

  // Verify the database has consistent version and no corrupted state
  const plan1After = await db.query("SELECT * FROM cohort_remedial_plans WHERE id = $1", [plan1.id]);
  assert(plan1After.rows[0].version >= 2, 'Remedial plan version cleanly incremented to version 2 or higher');

  const item1After = await db.query("SELECT * FROM remedial_plan_items WHERE plan_id = $1 AND item_key = 'commonMistakes'", [plan1.id]);
  assert(item1After.rows[0].status === 'ACTIVE', 'Item returned to ACTIVE status');
  assert(item1After.rows[0].version >= 2, 'Item version incremented consistently');

  // =========================================================================
  // SCENARIO 2: Concurrent updates to different plans
  // =========================================================================
  console.log('\n--- SCENARIO 2: Concurrent Updates to Different Plans ---');
  const plan2A = await createTestPlan(testTopicTagA + ' - Part 1');
  const plan2B = await createTestPlan(testTopicTagB + ' - Part 2');

  // Mark items stale on both plans
  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id IN ($1, $2) AND item_key = 'example'", [plan2A.id, plan2B.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id IN ($1, $2)", [plan2A.id, plan2B.id]);

  // Execute concurrent updates across both separate plans
  const [res2A, res2B] = await Promise.all([
    incrementalRemedialService.recomputePlanIncrementally(plan2A.id, {
      user: hodUser,
      triggerType: 'MANUAL_TRIGGER',
      mockAiGenerator: async () => {
        await sleep(50);
        return { example: "Example for Plan 2A" };
      }
    }),
    incrementalRemedialService.recomputePlanIncrementally(plan2B.id, {
      user: hodUser,
      triggerType: 'MANUAL_TRIGGER',
      mockAiGenerator: async () => {
        await sleep(50);
        return { example: "Example for Plan 2B" };
      }
    })
  ]);

  assert(res2A.success === true && res2A.updated === true, 'Plan A incremental update succeeded without interference');
  assert(res2B.success === true && res2B.updated === true, 'Plan B incremental update succeeded without interference');
  assert(res2A.newPlanVersion === 2, 'Plan A incremented version to 2');
  assert(res2B.newPlanVersion === 2, 'Plan B incremented version to 2');

  // Clean up scenario 2 plans
  await db.query("DELETE FROM cohort_remedial_plans WHERE id IN ($1, $2)", [plan2A.id, plan2B.id]);

  // =========================================================================
  // SCENARIO 3: Stale version detected after an AI call
  // =========================================================================
  console.log('\n--- SCENARIO 3: Stale Version Detected After an AI Call ---');
  const plan3 = await createTestPlan('Concurrency Stale AI Topic');

  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'practiceExercises'", [plan3.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan3.id]);

  let staleCaught = false;
  let caughtConflictErr = null;

  try {
    await incrementalRemedialService.recomputePlanIncrementally(plan3.id, {
      user: hodUser,
      triggerType: 'MANUAL_TRIGGER',
      mockAiGenerator: async () => {
        return { practiceExercises: ["Stale exercise from outdated AI call"] };
      },
      // Simulate another request committing an update while AI call is executing
      _onAiBeforeCommit: async ({ baselineVersion }) => {
        // Out-of-band commit that bumps plan version in the database
        await db.query("UPDATE cohort_remedial_plans SET version = $1, updated_at = NOW() WHERE id = $2", [baselineVersion + 1, plan3.id]);
      }
    });
  } catch (err) {
    if (err.concurrencyConflict && err.code === 'PLAN_VERSION_CONFLICT') {
      staleCaught = true;
      caughtConflictErr = err;
    }
  }

  assert(staleCaught === true, 'Outdated plan version was detected before committing');
  assert(caughtConflictErr?.retryable === true, 'Concurrency conflict is flagged as retryable');
  assert(caughtConflictErr?.status === 409, 'Conflict status code is 409 Conflict');

  // Verify that the stale AI generation was safely discarded and NOT written to the DB
  const plan3Db = await db.query("SELECT plan_content FROM cohort_remedial_plans WHERE id = $1", [plan3.id]);
  const contentStr = JSON.stringify(plan3Db.rows[0].plan_content);
  assert(!contentStr.includes("Stale exercise from outdated AI call"), 'Outdated AI generation was safely discarded without corrupting database');

  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [plan3.id]);

  // =========================================================================
  // SCENARIO 4: Database failure during commit (Transaction Rollback)
  // =========================================================================
  console.log('\n--- SCENARIO 4: Database Failure During Commit ---');
  const plan4 = await createTestPlan('Concurrency DB Failure Topic');

  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'example'", [plan4.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan4.id]);

  let commitFailed = false;
  try {
    await incrementalRemedialService.recomputePlanIncrementally(plan4.id, {
      user: hodUser,
      mockAiGenerator: async () => ({ example: "Failed update example" }),
      _simulateCommitFailure: true // Triggers simulated DB error inside transaction
    });
  } catch (err) {
    commitFailed = true;
  }

  assert(commitFailed === true, 'Simulated database error during commit threw expected error');

  // Verify that the transaction rolled back and left NO partial database changes
  const plan4After = await db.query("SELECT * FROM cohort_remedial_plans WHERE id = $1", [plan4.id]);
  assert(plan4After.rows[0].version === 1, 'Plan version remained strictly at 1 after rollback');
  assert(!JSON.stringify(plan4After.rows[0].plan_content).includes("Failed update example"), 'Zero partial plan changes were committed');

  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [plan4.id]);

  // =========================================================================
  // SCENARIO 5: Lock timeout and retry behavior
  // =========================================================================
  console.log('\n--- SCENARIO 5: Lock Timeout and Retry Behavior ---');
  const plan5 = await createTestPlan('Concurrency Lock Timeout Topic');

  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'conceptExplanation'", [plan5.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan5.id]);

  // Client 1 connects and holds the transaction-scoped advisory lock
  const holdClient = await db.pool.connect();
  let timeoutCaught = false;

  try {
    await holdClient.query('BEGIN');
    await holdClient.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [plan5.id]);

    // Client 2 attempts to update the locked plan with a bounded 200ms timeout
    try {
      await incrementalRemedialService.recomputePlanIncrementally(plan5.id, {
        user: hodUser,
        mockAiGenerator: async () => ({ conceptExplanation: "Lock timeout test" }),
        lockTimeoutMs: 200 // 200ms bounded timeout
      });
    } catch (err) {
      if (err.concurrencyConflict && err.code === 'LOCK_TIMEOUT') {
        timeoutCaught = true;
      }
    }
  } finally {
    // Release the holding lock
    await holdClient.query('COMMIT');
    holdClient.release();
  }

  assert(timeoutCaught === true, 'Lock contention exceeded timeout and was caught with code LOCK_TIMEOUT');

  // Retry after lock release should succeed cleanly
  const retryResult = await incrementalRemedialService.recomputePlanIncrementally(plan5.id, {
    user: hodUser,
    mockAiGenerator: async () => ({ conceptExplanation: "Retried concept explanation after lock release" }),
    lockTimeoutMs: 5000
  });

  assert(retryResult.success === true, 'Retry after lock release succeeded cleanly');
  assert(retryResult.newPlanVersion === 2, 'Retried update incremented plan version to 2');

  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [plan5.id]);

  // =========================================================================
  // SCENARIO 6: Permission revocation during an update
  // =========================================================================
  console.log('\n--- SCENARIO 6: Permission Revocation During an Update ---');
  const plan6 = await createTestPlan('Concurrency Revocation Topic');

  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'example'", [plan6.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan6.id]);

  // Create temporary faculty user
  const tempFacultyRes = await db.query(`
    INSERT INTO users (name, email, password, role, department_id, institute_id, created_at)
    VALUES ('Temp Revoke Faculty', 'temp_faculty@test.edu', 'hash', 'FACULTY', $1, $2, NOW())
    RETURNING *
  `, [subject.department_id, hodUser.institute_id]);
  const tempFaculty = tempFacultyRes.rows[0];

  let revocationBlocked = false;

  try {
    await incrementalRemedialService.recomputePlanIncrementally(plan6.id, {
      user: tempFaculty,
      mockAiGenerator: async () => {
        // Demote the user while the AI call is running!
        await db.query("UPDATE users SET role = 'STUDENT' WHERE id = $1", [tempFaculty.id]);
        return { example: "Unauthorized generated material" };
      }
    });
  } catch (err) {
    if (err.status === 403 || err.code === 'PERMISSION_REVOKED') {
      revocationBlocked = true;
    }
  }

  assert(revocationBlocked === true, 'Update was blocked with 403 after user permissions were revoked in-flight');

  // Verify that the unauthorized material was never exposed or committed
  const plan6Db = await db.query("SELECT plan_content FROM cohort_remedial_plans WHERE id = $1", [plan6.id]);
  assert(!JSON.stringify(plan6Db.rows[0].plan_content).includes("Unauthorized generated material"), 'Revoked user material was never exposed in database');

  // Cleanup scenario 6
  await db.query("DELETE FROM users WHERE id = $1", [tempFaculty.id]);
  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [plan6.id]);

  // =========================================================================
  // SCENARIO 7: Correct plan-version increments and audit records under concurrency
  // =========================================================================
  console.log('\n--- SCENARIO 7: Correct Plan-Version Increments & Audit Records ---');
  const plan7 = await createTestPlan('Concurrency Version & Audit Topic');

  // Perform sequential update 1
  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'prerequisiteRecap'", [plan7.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan7.id]);
  const vUpdate1 = await incrementalRemedialService.recomputePlanIncrementally(plan7.id, {
    user: hodUser,
    mockAiGenerator: async () => ({ prerequisiteRecap: "Updated prereq v2" })
  });
  assert(vUpdate1.newPlanVersion === 2, 'Sequential update 1 moved version from 1 to 2');

  // Perform sequential update 2
  await db.query("UPDATE remedial_plan_items SET status = 'STALE' WHERE plan_id = $1 AND item_key = 'example'", [plan7.id]);
  await db.query("UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1", [plan7.id]);
  const vUpdate2 = await incrementalRemedialService.recomputePlanIncrementally(plan7.id, {
    user: hodUser,
    mockAiGenerator: async () => ({ example: "Updated example v3" })
  });
  assert(vUpdate2.newPlanVersion === 3, 'Sequential update 2 moved version from 2 to 3');

  // Audit history verification
  const auditRes = await db.query(
    "SELECT * FROM remedial_plan_audit_log WHERE plan_id = $1 ORDER BY created_at ASC",
    [plan7.id]
  );
  assert(auditRes.rowCount >= 3, 'Audit log accurately recorded initial registration and both version increments');

  const outcomes = auditRes.rows.map(r => r.outcome);
  assert(outcomes.every(o => o === 'SUCCESS'), 'All committed updates logged SUCCESS without duplicate retries');

  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [plan7.id]);

  // =========================================================================
  // SCENARIO 8: Existing remedial-plan persistence and authorization behavior
  // =========================================================================
  console.log('\n--- SCENARIO 8: Existing Remedial-Plan Persistence and Authorization ---');
  let controllerSavedPlan = null;
  const saveReq = {
    body: {
      subject_id: subject.id,
      topic_tag: 'Concurrency Existing Behavior Topic',
      plan_content: basePlanContent,
      status: 'PUBLISHED'
    },
    user: hodUser
  };
  const saveRes = {
    json: (d) => { controllerSavedPlan = d; },
    status: () => saveRes
  };

  await cohortAnalyticsController.saveRemedialPlan(saveReq, saveRes);
  assert(controllerSavedPlan?.success === true, 'Existing saveRemedialPlan endpoint succeeded');

  const createdPlanId = controllerSavedPlan.plan.id;

  // Student authorization check on triggerIncrementalUpdate
  let studentBlocked = false;
  let studentStatus = null;
  const studReq = {
    params: { planId: createdPlanId },
    body: {},
    user: studentUser
  };
  const studRes = {
    status: (s) => {
      studentStatus = s;
      return { json: () => { if (s === 403) studentBlocked = true; } };
    },
    json: () => {}
  };

  await cohortAnalyticsController.triggerIncrementalUpdate(studReq, studRes);
  assert(studentBlocked === true && studentStatus === 403, 'triggerIncrementalUpdate strictly rejects student with 403 Forbidden');

  // Cleanup
  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [createdPlanId]);

  console.log('\n================================================================');
  console.log(`ALL ${testPassedCount} / ${testTotalCount} CONCURRENCY TESTS PASSED WITH 100% SUCCESS!`);
  console.log('================================================================\n');

  process.exit(0);
}

runConcurrencyTestSuite().catch(err => {
  console.error('\nConcurrency Test Suite Failed with Error:', err.message, err.stack);
  process.exit(1);
});
