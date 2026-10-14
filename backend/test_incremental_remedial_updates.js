require('dotenv').config();
const db = require('./db');
const incrementalRemedialService = require('./services/remedial/incrementalRemedialService');
const cohortAnalyticsController = require('./controllers/cohortAnalyticsController');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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

async function runTestSuite() {
  console.log('\n================================================================');
  console.log('STARTING INCREMENTAL REMEDIAL PLAN TEST SUITE');
  console.log('================================================================\n');

  // Setup test users & context
  const hodRes = await db.query("SELECT * FROM users WHERE role = 'HOD' LIMIT 1");
  const studentRes = await db.query("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1");
  const otherDeptRes = await db.query("SELECT * FROM departments WHERE id != $1 LIMIT 1", [hodRes.rows[0].department_id]);

  if (hodRes.rowCount === 0 || studentRes.rowCount === 0) {
    throw new Error('Required test users not found in DB');
  }

  const hodUser = hodRes.rows[0];
  const studentUser = studentRes.rows[0];

  // User from another department for RBAC testing
  const unauthorizedUser = {
    id: '11111111-1111-1111-1111-111111111111',
    role: 'FACULTY',
    email: 'unauth@test.edu',
    department_id: otherDeptRes.rows[0]?.id || '22222222-2222-2222-2222-222222222222',
    institute_id: hodUser.institute_id
  };

  // Find a test subject and topic
  const subRes = await db.query("SELECT * FROM subjects WHERE department_id = $1 LIMIT 1", [hodUser.department_id]);
  const subject = subRes.rows[0];
  const testTopicTag = 'Incremental Remedial Unit Test Topic';

  // Find or create test material
  let matRes = await db.query("SELECT * FROM materials LIMIT 1");
  let testMaterial = matRes.rows[0];

  // Clean up any existing test records for this topic
  await db.query("DELETE FROM cohort_remedial_plans WHERE topic_tag = $1", [testTopicTag]);

  // Initial Plan Content Payload
  const initialPlanContent = {
    prerequisiteRecap: "Initial prerequisite overview: basics of algebra and functions.",
    conceptExplanation: "Initial concept explanation: core definitions and foundational rules.",
    example: "Initial worked example: step 1, step 2, step 3 calculation.",
    commonMistakes: [
      "Initial mistake 1: confusing dependent and independent variables.",
      "Initial mistake 2: incorrect sign during simplification."
    ],
    practiceExercises: [
      "Practice 1: Solve equation 2x + 3 = 7.",
      "Practice 2: Find the slope of line y = 3x - 4."
    ],
    quickAssessmentQuestions: [
      {
        question: "What is the slope of line y = 4x + 1?",
        options: ["4", "1", "-4", "0"],
        correctIndex: 0,
        explanation: "The coefficient of x in slope-intercept form is 4."
      }
    ]
  };

  console.log('--- TEST 1: Existing Remedial Plan Behavior & Decomposition ---');
  // 1. Save remedial plan via controller
  let savedPlanResult = null;
  const mockReq = {
    body: {
      subject_id: subject.id,
      topic_tag: testTopicTag,
      plan_content: initialPlanContent,
      status: 'PUBLISHED'
    },
    user: hodUser
  };
  const mockRes = {
    json: (data) => { savedPlanResult = data; },
    status: () => mockRes
  };

  await cohortAnalyticsController.saveRemedialPlan(mockReq, mockRes);
  assert(savedPlanResult && savedPlanResult.success, 'Plan saved successfully through controller');
  assert(savedPlanResult.plan && savedPlanResult.plan.id, 'Plan has generated UUID');

  const testPlanId = savedPlanResult.plan.id;

  // Verify decomposed items in remedial_plan_items
  const itemsInDb = await db.query("SELECT * FROM remedial_plan_items WHERE plan_id = $1 ORDER BY item_key", [testPlanId]);
  assert(itemsInDb.rowCount === 6, 'All 6 plan sections decomposed and saved into remedial_plan_items');

  const itemKeys = itemsInDb.rows.map(r => r.item_key);
  assert(itemKeys.includes('prerequisiteRecap'), 'prerequisiteRecap decomposed');
  assert(itemKeys.includes('conceptExplanation'), 'conceptExplanation decomposed');
  assert(itemKeys.includes('example'), 'example decomposed');
  assert(itemKeys.includes('commonMistakes'), 'commonMistakes decomposed');
  assert(itemKeys.includes('practiceExercises'), 'practiceExercises decomposed');
  assert(itemKeys.includes('quickAssessmentQuestions'), 'quickAssessmentQuestions decomposed');

  // Verify dependencies persisted
  const depsInDb = await db.query(`
    SELECT d.*, i.item_key 
    FROM remedial_item_dependencies d
    JOIN remedial_plan_items i ON d.item_id = i.id
    WHERE i.plan_id = $1
  `, [testPlanId]);
  assert(depsInDb.rowCount >= 6, 'Dependencies registered for plan items in database');

  const depTypes = new Set(depsInDb.rows.map(d => d.dependency_type));
  assert(depTypes.has('AUTHORIZATION_SCOPE'), 'AUTHORIZATION_SCOPE dependency tracked');
  assert(depTypes.has('ROOT_CONCEPT'), 'ROOT_CONCEPT dependency tracked');
  assert(depTypes.has('PREREQUISITE_PATH'), 'PREREQUISITE_PATH dependency tracked');
  assert(depTypes.has('ASSESSMENT_EVIDENCE'), 'ASSESSMENT_EVIDENCE dependency tracked');

  console.log('\n--- TEST 2: Unrelated Changes Trigger NO Recomputations (NO_OP) ---');
  // At this point, plan is fresh and up to date
  const noOpResult = await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
    user: hodUser,
    triggerType: 'MANUAL_TRIGGER',
    triggerDetails: { note: 'Testing no-op execution' }
  });

  assert(noOpResult.outcome === 'NO_OP', 'Unrelated/fresh state returns outcome NO_OP');
  assert(noOpResult.updated === false, 'Plan updated flag is false');
  assert(noOpResult.aiCallsMade === 0, 'Zero AI calls made for no-op execution');

  console.log('\n--- TEST 3: Assessment Changes Affect ONLY Dependent Items ---');
  // Invalidate assessment evidence dependency for this plan
  await db.query(`
    UPDATE remedial_item_dependencies d
    SET expected_state = jsonb_set(d.expected_state, '{evidenceHash}', '"simulated_changed_assessment_hash"'),
        is_valid = FALSE
    FROM remedial_plan_items i
    WHERE d.item_id = i.id AND i.plan_id = $1 AND d.dependency_type = 'ASSESSMENT_EVIDENCE'
  `, [testPlanId]);

  // Evaluate staleness
  const stalenessCheck1 = await incrementalRemedialService.evaluatePlanStaleness(testPlanId, hodUser);
  assert(stalenessCheck1.isStale === true, 'Plan flagged as stale after assessment evidence change');
  
  const stale1 = stalenessCheck1.staleItemKeys.sort();
  const intact1 = stalenessCheck1.intactItemKeys.sort();

  assert(
    stale1.includes('commonMistakes') &&
    stale1.includes('practiceExercises') &&
    stale1.includes('quickAssessmentQuestions'),
    'Assessment-dependent items (commonMistakes, practiceExercises, quickAssessmentQuestions) identified as stale'
  );
  assert(
    intact1.includes('prerequisiteRecap') &&
    intact1.includes('conceptExplanation') &&
    intact1.includes('example'),
    'Unrelated items (prerequisiteRecap, conceptExplanation, example) remain INTACT'
  );

  // Recompute incrementally with mock AI generator
  let aiCalledKeys = null;
  const mockAssessmentAi = async (keys, prompt) => {
    aiCalledKeys = keys;
    return {
      commonMistakes: ["Updated Mistake: Students now confuse slope with y-intercept."],
      practiceExercises: ["Updated Practice: Find the intercept of y = 5x + 10."],
      quickAssessmentQuestions: [
        {
          question: "What is the intercept of y = 5x + 10?",
          options: ["10", "5", "0", "-10"],
          correctIndex: 0,
          explanation: "y-intercept is 10."
        }
      ]
    };
  };

  const updateResult1 = await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
    user: hodUser,
    triggerType: 'ASSESSMENT_UPDATE',
    triggerDetails: { simulatedReason: 'Cohort quiz attempts shifted error distribution' },
    mockAiGenerator: mockAssessmentAi
  });

  assert(updateResult1.outcome === 'SUCCESS', 'Incremental update succeeded');
  assert(updateResult1.recomputedItemKeys.length === 3, 'Exactly 3 items were recomputed');
  assert(updateResult1.intactItemKeys.length === 3, 'Exactly 3 items preserved intact without recomputation');
  assert(updateResult1.newPlanVersion === 2, 'Plan version incremented from 1 to 2');

  // Verify item version counts in DB
  const itemVersionsAfterTest3 = await db.query("SELECT item_key, version, content FROM remedial_plan_items WHERE plan_id = $1", [testPlanId]);
  const verMap = {};
  itemVersionsAfterTest3.rows.forEach(r => { verMap[r.item_key] = r.version; });

  assert(verMap.prerequisiteRecap === 1, 'prerequisiteRecap preserved version 1');
  assert(verMap.conceptExplanation === 1, 'conceptExplanation preserved version 1');
  assert(verMap.example === 1, 'example preserved version 1');
  assert(verMap.commonMistakes === 2, 'commonMistakes version bumped to 2');
  assert(verMap.practiceExercises === 2, 'practiceExercises version bumped to 2');
  assert(verMap.quickAssessmentQuestions === 2, 'quickAssessmentQuestions version bumped to 2');

  console.log('\n--- TEST 4: Prerequisite Graph Changes Affect ONLY prerequisiteRecap ---');
  // Invalidate prerequisite path dependency
  await db.query(`
    UPDATE remedial_item_dependencies d
    SET expected_state = jsonb_set(d.expected_state, '{pathHash}', '"simulated_prereq_graph_change"'),
        is_valid = FALSE
    FROM remedial_plan_items i
    WHERE d.item_id = i.id AND i.plan_id = $1 AND d.dependency_type = 'PREREQUISITE_PATH'
  `, [testPlanId]);

  const stalenessCheck2 = await incrementalRemedialService.evaluatePlanStaleness(testPlanId, hodUser);
  assert(stalenessCheck2.isStale === true, 'Plan flagged as stale after prerequisite graph change');
  assert(stalenessCheck2.staleItemKeys.length === 1 && stalenessCheck2.staleItemKeys[0] === 'prerequisiteRecap', 'ONLY prerequisiteRecap is stale');
  assert(stalenessCheck2.intactItemKeys.length === 5, 'All other 5 items remain intact');

  const mockPrereqAi = async (keys, prompt) => {
    return {
      prerequisiteRecap: "Updated prerequisite recap: Confirmed prerequisite Graph Theory and Linear Maps."
    };
  };

  const updateResult2 = await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
    user: hodUser,
    triggerType: 'PREREQUISITE_GRAPH_CHANGE',
    mockAiGenerator: mockPrereqAi
  });

  assert(updateResult2.outcome === 'SUCCESS', 'Prerequisite incremental update succeeded');
  assert(updateResult2.recomputedItemKeys.length === 1, 'Only 1 item recomputed');
  assert(updateResult2.recomputedItemKeys[0] === 'prerequisiteRecap', 'Recomputed item was prerequisiteRecap');

  const itemVersionsAfterTest4 = await db.query("SELECT item_key, version FROM remedial_plan_items WHERE plan_id = $1", [testPlanId]);
  const verMap2 = {};
  itemVersionsAfterTest4.rows.forEach(r => { verMap2[r.item_key] = r.version; });
  assert(verMap2.prerequisiteRecap === 2, 'prerequisiteRecap version bumped to 2');
  assert(verMap2.conceptExplanation === 1, 'conceptExplanation still intact at version 1');

  console.log('\n--- TEST 5: Material Replacement & Citations Update ---');
  // Attach a source material dependency and test replacement
  const explanationItem = itemsInDb.rows.find(i => i.item_key === 'conceptExplanation');
  await db.query(`
    INSERT INTO remedial_item_dependencies (item_id, dependency_type, target_id, expected_state, is_valid)
    VALUES ($1, 'SOURCE_MATERIAL', $2, $3, FALSE)
    ON CONFLICT (item_id, dependency_type, target_id)
    DO UPDATE SET expected_state = $3, is_valid = FALSE
  `, [explanationItem.id, testMaterial.id, JSON.stringify({ materialHash: 'outdated_hash_v1' })]);

  const stalenessCheck3 = await incrementalRemedialService.evaluatePlanStaleness(testPlanId, hodUser);
  assert(stalenessCheck3.staleItemKeys.includes('conceptExplanation'), 'conceptExplanation detected stale due to material change');

  const mockMaterialAi = async (keys, prompt) => {
    return {
      conceptExplanation: "Updated concept explanation referencing replacement material textbook edition."
    };
  };

  const updateResult3 = await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
    user: hodUser,
    triggerType: 'MATERIAL_REPLACED',
    mockAiGenerator: mockMaterialAi
  });

  assert(updateResult3.outcome === 'SUCCESS', 'Material update succeeded');
  assert(updateResult3.recomputedItemKeys.includes('conceptExplanation'), 'conceptExplanation recomputed');
  
  // Verify citations in cohort_remedial_plans
  const finalPlanRes = await db.query("SELECT * FROM cohort_remedial_plans WHERE id = $1", [testPlanId]);
  assert(Array.isArray(finalPlanRes.rows[0].citations), 'Citations array persisted in plan');

  console.log('\n--- TEST 6: Revoked Access Permissions Recheck ---');
  let authBlocked = false;
  try {
    await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
      user: unauthorizedUser,
      triggerType: 'MANUAL_TRIGGER'
    });
  } catch (err) {
    if (err.status === 403 || err.message.includes('denied') || err.message.includes('permissions')) {
      authBlocked = true;
    }
  }
  assert(authBlocked, 'Unauthorized user from another department is strictly blocked (403 Forbidden)');

  let studentBlocked = false;
  try {
    await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
      user: studentUser,
      triggerType: 'MANUAL_TRIGGER'
    });
  } catch (err) {
    if (err.status === 403 || err.message.includes('denied') || err.message.includes('permissions')) {
      studentBlocked = true;
    }
  }
  assert(studentBlocked, 'Student user is strictly blocked from modifying remedial plans');

  console.log('\n--- TEST 7: Failed Updates & Retry Safety (Plan Content Preservation) ---');
  // First, get the plan content before failure
  const beforeFailPlan = await db.query("SELECT * FROM cohort_remedial_plans WHERE id = $1", [testPlanId]);
  const contentBeforeFail = JSON.stringify(beforeFailPlan.rows[0].plan_content);

  // Invalidate commonMistakes to simulate failure during update
  await db.query(`
    UPDATE remedial_item_dependencies d
    SET expected_state = jsonb_set(d.expected_state, '{evidenceHash}', '"stale_fail_test_hash"'),
        is_valid = FALSE
    FROM remedial_plan_items i
    WHERE d.item_id = i.id AND i.plan_id = $1 AND d.dependency_type = 'ASSESSMENT_EVIDENCE'
  `, [testPlanId]);

  let failedUpdateThrown = false;
  try {
    await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
      user: hodUser,
      triggerType: 'ASSESSMENT_UPDATE',
      mockAiGenerator: async () => {
        throw new Error('Simulated Gemini 503 Overloaded Error');
      }
    });
  } catch (err) {
    failedUpdateThrown = true;
    assert(err.preserved === true, 'Error indicates existing plan was safely preserved');
  }

  assert(failedUpdateThrown, 'AI failure threw expected error');

  // Verify that plan content in database was NOT corrupted or wiped!
  const afterFailPlan = await db.query("SELECT * FROM cohort_remedial_plans WHERE id = $1", [testPlanId]);
  const contentAfterFail = JSON.stringify(afterFailPlan.rows[0].plan_content);
  assert(contentBeforeFail === contentAfterFail, 'Plan content in cohort_remedial_plans was 100% PRESERVED upon failure!');

  // Verify item status was marked FAILED with last_error
  const failedItems = await db.query("SELECT * FROM remedial_plan_items WHERE plan_id = $1 AND status = 'FAILED'", [testPlanId]);
  assert(failedItems.rowCount > 0, 'Stale items marked as FAILED with last_error message recorded');
  assert(failedItems.rows[0].last_error.includes('503 Overloaded'), 'last_error accurately records failure reason');

  // Verify audit log has the FAILED entry
  const failAudit = await db.query(`
    SELECT * FROM remedial_plan_audit_log 
    WHERE plan_id = $1 AND outcome = 'FAILED'
    ORDER BY created_at DESC LIMIT 1
  `, [testPlanId]);
  assert(failAudit.rowCount === 1, 'Audit log recorded failed update with outcome FAILED and error message');

  // Verify retry safety: successful subsequent update clears failure
  const retryResult = await incrementalRemedialService.recomputePlanIncrementally(testPlanId, {
    user: hodUser,
    triggerType: 'MANUAL_TRIGGER',
    mockAiGenerator: async (keys) => {
      return {
        commonMistakes: ["Retry Recovered Mistake: Students now master the algebraic steps."],
        practiceExercises: ["Retry Exercise: Solve 3x + 1 = 10."],
        quickAssessmentQuestions: [{ question: "Is x=3 correct?", options: ["Yes", "No"], correctIndex: 0, explanation: "3*3+1=10" }]
      };
    }
  });

  assert(retryResult.outcome === 'SUCCESS', 'Retry after failure succeeded completely');

  const clearedItems = await db.query("SELECT * FROM remedial_plan_items WHERE plan_id = $1 AND status = 'FAILED'", [testPlanId]);
  assert(clearedItems.rowCount === 0, 'All previously failed items recovered to ACTIVE status');

  console.log('\n--- TEST 8: Audit Log Integrity ---');
  const auditLogs = await db.query("SELECT * FROM remedial_plan_audit_log WHERE plan_id = $1 ORDER BY created_at ASC", [testPlanId]);
  assert(auditLogs.rowCount >= 4, 'Complete audit trail persisted for all updates');

  for (const log of auditLogs.rows) {
    const detailsStr = JSON.stringify(log.trigger_details || {});
    assert(!detailsStr.includes('Bearer') && !detailsStr.includes('api_key') && !detailsStr.includes('password'), 'Audit log contains NO passwords, API keys, or JWT tokens');
  }

  console.log('\n--- TEST 9: Permission Revocation Invalidates Affected Plan Items in Database ---');
  // Trigger permission revocation notification for this subject
  await incrementalRemedialService.notifyPermissionRevoked({ subjectId: subject.id, reason: 'Department access scope reassigned' });

  const staleItemsAfterRevocation = await db.query(
    "SELECT * FROM remedial_plan_items WHERE plan_id = $1 AND status = 'STALE'",
    [testPlanId]
  );
  assert(staleItemsAfterRevocation.rowCount > 0, 'Plan items marked as STALE in database upon permission revocation');

  const stalePlanAfterRevocation = await db.query(
    "SELECT is_stale FROM cohort_remedial_plans WHERE id = $1",
    [testPlanId]
  );
  assert(stalePlanAfterRevocation.rows[0].is_stale === true, 'Parent remedial plan marked as is_stale=true in database');

  const invalidAuthDeps = await db.query(`
    SELECT d.* FROM remedial_item_dependencies d
    JOIN remedial_plan_items i ON d.item_id = i.id
    WHERE i.plan_id = $1 AND d.dependency_type = 'AUTHORIZATION_SCOPE' AND d.is_valid = FALSE
  `, [testPlanId]);
  assert(invalidAuthDeps.rowCount > 0, 'AUTHORIZATION_SCOPE dependencies marked is_valid=false in database');

  console.log('\n--- TEST 10: Server-Side Authorization on Retrieval (getSubjectRemedialPlans) ---');
  let getSubBlocked = false;
  let getSubStatusCode = null;
  const mockUnauthReq = {
    params: { subjectId: subject.id },
    user: unauthorizedUser
  };
  const mockUnauthRes = {
    status: (code) => {
      getSubStatusCode = code;
      return {
        json: (data) => {
          if (code === 403) getSubBlocked = true;
        }
      };
    },
    json: () => {}
  };

  await cohortAnalyticsController.getSubjectRemedialPlans(mockUnauthReq, mockUnauthRes);
  assert(getSubBlocked && getSubStatusCode === 403, 'getSubjectRemedialPlans enforces server-side 403 Forbidden before retrieving plan data');

  console.log('\n================================================================');
  console.log(`ALL ${testPassedCount} / ${testTotalCount} TESTS PASSED WITH 100% SUCCESS!`);
  console.log('================================================================\n');

  // Cleanup test plan
  await db.query("DELETE FROM cohort_remedial_plans WHERE id = $1", [testPlanId]);
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\nTest Suite Failed with Error:', err.message, err.stack);
  process.exit(1);
});
