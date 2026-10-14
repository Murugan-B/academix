const crypto = require('crypto');
const db = require('../../db');
const aiService = require('../ai/aiService');
const textExtractor = require('../../utils/textExtractor');

/**
 * Deterministic hash helpers
 */
function hashString(str) {
  return crypto.createHash('sha256').update(str || '').digest('hex').substring(0, 32);
}

function computeEvidenceHash(missedQuestions = []) {
  const normalized = (missedQuestions || []).map(q => ({
    q: (q.question || '').trim().toLowerCase(),
    f: parseInt(q.fail_count || 0),
    c: (q.correct_answer || '').trim()
  })).sort((a, b) => a.q.localeCompare(b.q));
  return hashString(JSON.stringify(normalized));
}

function computePathHash(prerequisites = []) {
  const normalized = (prerequisites || []).map(p => ({
    id: p.conceptId || p.id,
    name: (p.conceptName || p.name || '').trim().toLowerCase(),
    status: p.status || 'CONFIRMED',
    depth: p.depth || 1
  })).sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  return hashString(JSON.stringify(normalized));
}

function computeMaterialHash(material) {
  if (!material) return 'NO_MATERIAL';
  const val = `${material.id}:${material.updated_at || material.created_at}:${material.file_name || ''}:${material.file_size || 0}`;
  return hashString(val);
}

/**
 * Standard item keys for structured remedial learning plans
 */
const PLAN_ITEM_KEYS = [
  'prerequisiteRecap',
  'conceptExplanation',
  'example',
  'commonMistakes',
  'practiceExercises',
  'quickAssessmentQuestions'
];

/**
 * Verification of department and institute authorization scope
 */
async function verifyAuthorization(subjectId, user) {
  if (!user) return { authorized: false, reason: 'Authentication required' };
  if (user.role === 'SUPER_ADMIN') return { authorized: true };

  const subRes = await db.query(`
    SELECT s.id, s.department_id, d.institute_id
    FROM subjects s
    JOIN departments d ON s.department_id = d.id
    WHERE s.id = $1
  `, [subjectId]);

  if (subRes.rowCount === 0) {
    return { authorized: false, reason: 'Subject not found' };
  }

  const subject = subRes.rows[0];

  if (user.role === 'INSTITUTE_ADMIN') {
    if (user.institute_id && subject.institute_id !== user.institute_id) {
      return { authorized: false, reason: 'Cross-institute access denied' };
    }
    return { authorized: true };
  }

  if (user.role === 'HOD' || user.role === 'FACULTY') {
    if (user.institute_id && subject.institute_id !== user.institute_id) {
      return { authorized: false, reason: 'Cross-institute access denied' };
    }
    if (user.department_id && subject.department_id !== user.department_id) {
      return { authorized: false, reason: 'Cross-department access denied' };
    }
    return { authorized: true };
  }

  return { authorized: false, reason: 'Insufficient role permissions' };
}

/**
 * Traverses prerequisite graph and determines root gap with cycle protection
 */
async function fetchPrerequisiteContext(topicTag, subjectId, maxDepth = 4) {
  try {
    const conceptRes = await db.query(`
      SELECT c.* 
      FROM concepts c
      WHERE c.subject_id = $1 AND (c.name ILIKE $2 OR $3 ILIKE '%' || c.name || '%')
      LIMIT 1
    `, [subjectId, `%${topicTag}%`, topicTag]);

    if (conceptRes.rowCount === 0) {
      return { rootGap: null, prerequisites: [], pathHash: 'NO_PREREQS' };
    }

    const targetConcept = conceptRes.rows[0];
    const visited = new Set([targetConcept.id]);
    const queue = [{ concept: targetConcept, depth: 0 }];
    const prerequisites = [];

    while (queue.length > 0) {
      const { concept: curr, depth } = queue.shift();
      if (depth >= maxDepth) continue;

      const relRes = await db.query(`
        SELECT c.id, c.name, c.description, cr.relationship_type, cr.status
        FROM concept_relationships cr
        JOIN concepts c ON cr.source_concept_id = c.id
        WHERE cr.target_concept_id = $1 AND cr.relationship_type IN ('PREREQUISITE_OF', 'DEPENDS_ON')
        UNION
        SELECT c.id, c.name, c.description, cr.relationship_type, cr.status
        FROM concept_relationships cr
        JOIN concepts c ON cr.target_concept_id = c.id
        WHERE cr.source_concept_id = $1 AND cr.relationship_type = 'DEPENDS_ON'
      `, [curr.id]);

      for (const p of relRes.rows) {
        if (!visited.has(p.id)) {
          visited.add(p.id);
          prerequisites.push({
            conceptId: p.id,
            conceptName: p.name,
            description: p.description,
            relationshipType: p.relationship_type,
            status: p.status,
            depth: depth + 1
          });
          queue.push({ concept: p, depth: depth + 1 });
        }
      }
    }

    prerequisites.sort((a, b) => b.depth - a.depth);
    const rootGap = prerequisites.length > 0 ? prerequisites[0] : null;
    const pathHash = computePathHash(prerequisites);

    return { rootGap, prerequisites, pathHash, targetConcept };
  } catch (err) {
    console.warn('[incrementalRemedialService] fetchPrerequisiteContext fallback:', err.message);
    return { rootGap: null, prerequisites: [], pathHash: 'NO_PREREQS' };
  }
}

/**
 * Fetches current assessment error evidence for a topic
 */
async function fetchAssessmentEvidence(topicTag) {
  try {
    const missedRes = await db.query(`
      SELECT qq.question, qaa.selected_answer, qq.correct_answer, qq.explanation, COUNT(*) as fail_count
      FROM quiz_attempt_answers qaa
      JOIN quiz_questions qq ON qaa.question_id = qq.id
      JOIN quiz_attempts qa ON qaa.attempt_id = qa.id
      WHERE (qq.topic_tag ILIKE $1 OR qq.question ILIKE $1) AND qaa.is_correct = false
      GROUP BY qq.question, qaa.selected_answer, qq.correct_answer, qq.explanation
      ORDER BY fail_count DESC
      LIMIT 5
    `, [`%${topicTag}%`]);

    const totalFails = missedRes.rows.reduce((sum, r) => sum + parseInt(r.fail_count || 0), 0);
    const evidenceHash = computeEvidenceHash(missedRes.rows);

    return {
      missedQuestions: missedRes.rows,
      totalFails,
      evidenceHash
    };
  } catch (err) {
    console.warn('[incrementalRemedialService] fetchAssessmentEvidence fallback:', err.message);
    return { missedQuestions: [], totalFails: 0, evidenceHash: 'NO_EVIDENCE' };
  }
}

/**
 * Fetches active material for a topic or subject
 */
async function fetchTopicMaterial(topicId, topicTag, materialId = null) {
  try {
    let material = null;
    if (materialId) {
      const res = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
      if (res.rowCount > 0) material = res.rows[0];
    }
    if (!material && topicId) {
      const res = await db.query('SELECT * FROM materials WHERE topic_id = $1 ORDER BY created_at DESC LIMIT 1', [topicId]);
      if (res.rowCount > 0) material = res.rows[0];
    }
    if (!material && topicTag) {
      const res = await db.query(`
        SELECT m.* FROM materials m
        JOIN quizzes q ON m.id = q.material_id
        JOIN quiz_questions qq ON q.id = qq.quiz_id
        WHERE qq.topic_tag ILIKE $1
        ORDER BY m.created_at DESC LIMIT 1
      `, [`%${topicTag}%`]);
      if (res.rowCount > 0) material = res.rows[0];
    }
    return material;
  } catch (err) {
    console.warn('[incrementalRemedialService] fetchTopicMaterial fallback:', err.message);
    return null;
  }
}

/**
 * Decomposes a full remedial plan into discrete items and tracks all dependencies
 */
async function registerPlanDependencies({ planId, planContent, subjectId, topicId, topicTag, materialId = null, userId = null }) {
  let contentObj = planContent;
  if (typeof planContent === 'string') {
    try {
      contentObj = JSON.parse(planContent);
    } catch (e) {
      contentObj = null;
    }
  }
  if (!contentObj) return null;

  // 1. Gather context snapshots
  const subRes = await db.query('SELECT s.*, d.institute_id FROM subjects s JOIN departments d ON s.department_id = d.id WHERE s.id = $1', [subjectId]);
  const subject = subRes.rows[0] || {};
  const { rootGap, prerequisites, pathHash } = await fetchPrerequisiteContext(topicTag, subjectId);
  const { missedQuestions, totalFails, evidenceHash } = await fetchAssessmentEvidence(topicTag);
  const material = await fetchTopicMaterial(topicId, topicTag, materialId);
  const materialHash = computeMaterialHash(material);

  // 2. Build citations list
  const citations = material ? [{
    materialId: material.id,
    title: material.title,
    fileName: material.file_name,
    fileUrl: material.file_url,
    versionTimestamp: material.updated_at || material.created_at,
    fileSize: material.file_size
  }] : [];

  // Update citations in parent plan
  await db.query(`
    UPDATE cohort_remedial_plans 
    SET citations = $1, is_stale = FALSE, last_incremental_update_at = NOW()
    WHERE id = $2
  `, [JSON.stringify(citations), planId]);

  // 3. Register each item and its fine-grained dependencies
  const registeredItems = [];

  for (const itemKey of PLAN_ITEM_KEYS) {
    const rawVal = contentObj[itemKey];
    if (rawVal === undefined || rawVal === null) continue;

    // Upsert remedial_plan_items
    const itemTitle = itemKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    const itemRes = await db.query(`
      INSERT INTO remedial_plan_items (plan_id, item_key, title, content, version, status, last_recomputed_at, updated_at)
      VALUES ($1, $2, $3, $4, 1, 'ACTIVE', NOW(), NOW())
      ON CONFLICT (plan_id, item_key)
      DO UPDATE SET content = EXCLUDED.content, status = 'ACTIVE', last_error = NULL, updated_at = NOW()
      RETURNING *
    `, [planId, itemKey, itemTitle, JSON.stringify(rawVal)]);

    const item = itemRes.rows[0];
    registeredItems.push(item);

    // Wipe previous dependencies for clean re-registration
    await db.query('DELETE FROM remedial_item_dependencies WHERE item_id = $1', [item.id]);

    // Define dependencies based on item semantic type
    const depsToInsert = [];

    // All items depend on AUTHORIZATION_SCOPE
    depsToInsert.push({
      item_id: item.id,
      dependency_type: 'AUTHORIZATION_SCOPE',
      target_id: subjectId,
      expected_state: {
        departmentId: subject.department_id,
        instituteId: subject.institute_id
      }
    });

    // Root concept dependency
    depsToInsert.push({
      item_id: item.id,
      dependency_type: 'ROOT_CONCEPT',
      target_id: rootGap?.conceptId || topicTag,
      expected_state: {
        rootConceptName: rootGap?.conceptName || topicTag,
        depth: rootGap?.depth || 0,
        status: rootGap?.status || 'DETECTED'
      }
    });

    if (itemKey === 'prerequisiteRecap') {
      // Prerequisite recap depends on prerequisite graph traversal path
      depsToInsert.push({
        item_id: item.id,
        dependency_type: 'PREREQUISITE_PATH',
        target_id: topicTag,
        expected_state: {
          pathHash,
          nodeCount: prerequisites.length,
          rootGapName: rootGap?.conceptName || null
        }
      });
    } else if (itemKey === 'conceptExplanation' || itemKey === 'example') {
      // Explanation & examples depend on source material version
      if (material) {
        depsToInsert.push({
          item_id: item.id,
          dependency_type: 'SOURCE_MATERIAL',
          target_id: material.id,
          expected_state: {
            materialId: material.id,
            materialHash,
            versionTimestamp: material.updated_at || material.created_at,
            title: material.title
          }
        });
      }
    } else if (itemKey === 'commonMistakes' || itemKey === 'practiceExercises' || itemKey === 'quickAssessmentQuestions') {
      // Mistakes, practice, and diagnostic assessment depend on assessment evidence
      depsToInsert.push({
        item_id: item.id,
        dependency_type: 'ASSESSMENT_EVIDENCE',
        target_id: topicTag,
        expected_state: {
          evidenceHash,
          totalFails,
          sampleCount: missedQuestions.length
        }
      });
    }

    // Insert dependencies
    for (const d of depsToInsert) {
      await db.query(`
        INSERT INTO remedial_item_dependencies (item_id, dependency_type, target_id, expected_state, is_valid, updated_at)
        VALUES ($1, $2, $3, $4, TRUE, NOW())
        ON CONFLICT (item_id, dependency_type, target_id)
        DO UPDATE SET expected_state = EXCLUDED.expected_state, is_valid = TRUE, updated_at = NOW()
      `, [d.item_id, d.dependency_type, d.target_id, JSON.stringify(d.expected_state)]);
    }
  }

  // Audit initial registration
  await recordAuditLog({
    planId,
    triggerType: 'INITIAL_GENERATION',
    triggerDetails: { topicTag, itemCount: registeredItems.length },
    affectedItemKeys: registeredItems.map(i => i.item_key),
    oldVersionSummary: {},
    newVersionSummary: { planVersion: 1, items: registeredItems.map(i => ({ key: i.item_key, version: 1 })) },
    outcome: 'SUCCESS',
    latencyMs: 0,
    aiCallsMade: 0,
    createdBy: userId
  });

  return { registeredItems, citations };
}

/**
 * Checks all dependencies for a remedial plan against the current live state
 */
async function evaluatePlanStaleness(planId, user = null) {
  // 1. Fetch Plan and Subject Context
  const planRes = await db.query(`
    SELECT p.*, s.department_id, d.institute_id
    FROM cohort_remedial_plans p
    JOIN subjects s ON p.subject_id = s.id
    JOIN departments d ON s.department_id = d.id
    WHERE p.id = $1
  `, [planId]);

  if (planRes.rowCount === 0) {
    throw new Error('Remedial plan not found');
  }

  const plan = planRes.rows[0];

  // 2. Authorization Verification
  if (user) {
    const auth = await verifyAuthorization(plan.subject_id, user);
    if (!auth.authorized) {
      // Invalidate authorization scope dependency and affected items in database
      await db.query(`
        UPDATE remedial_item_dependencies d
        SET is_valid = FALSE, updated_at = NOW()
        FROM remedial_plan_items i
        WHERE d.item_id = i.id AND i.plan_id = $1 AND d.dependency_type = 'AUTHORIZATION_SCOPE'
      `, [planId]);

      await db.query(`
        UPDATE remedial_plan_items
        SET status = 'STALE', updated_at = NOW()
        WHERE plan_id = $1
      `, [planId]);

      await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = $1`, [planId]);

      return {
        authorized: false,
        authError: auth.reason,
        planId,
        isStale: true,
        staleItemKeys: PLAN_ITEM_KEYS,
        intactItemKeys: [],
        reasons: { auth: auth.reason }
      };
    }
  }

  // 3. Fetch Items and their Dependencies
  const itemsRes = await db.query(`
    SELECT i.*, 
      COALESCE(
        JSON_AGG(
          JSON_BUILD_OBJECT(
            'depId', d.id,
            'type', d.dependency_type,
            'targetId', d.target_id,
            'expectedState', d.expected_state,
            'isValid', d.is_valid
          )
        ) FILTER (WHERE d.id IS NOT NULL), '[]'::json
      ) as dependencies
    FROM remedial_plan_items i
    LEFT JOIN remedial_item_dependencies d ON i.id = d.item_id
    WHERE i.plan_id = $1
    GROUP BY i.id
  `, [planId]);

  if (itemsRes.rowCount === 0) {
    // Legacy plan with no decomposed items yet -> needs initial registration
    return {
      authorized: true,
      planId,
      isStale: true,
      needsInitialRegistration: true,
      staleItemKeys: PLAN_ITEM_KEYS,
      intactItemKeys: [],
      reasons: { initial: 'Plan items not yet decomposed' }
    };
  }

  // 4. Fetch Live Snapshots for Comparison
  const { rootGap, prerequisites, pathHash } = await fetchPrerequisiteContext(plan.topic_tag, plan.subject_id);
  const { totalFails, evidenceHash } = await fetchAssessmentEvidence(plan.topic_tag);

  const staleItemKeys = new Set();
  const intactItemKeys = new Set();
  const reasons = {};
  const invalidDepIds = [];

  for (const item of itemsRes.rows) {
    let itemIsStale = false;
    const deps = item.dependencies || [];

    for (const dep of deps) {
      const exp = dep.expectedState || {};

      switch (dep.type) {
        case 'AUTHORIZATION_SCOPE': {
          if (exp.departmentId !== plan.department_id || exp.instituteId !== plan.institute_id) {
            itemIsStale = true;
            invalidDepIds.push(dep.depId);
            reasons[item.item_key] = 'Department or Institute ownership changed';
          }
          break;
        }

        case 'PREREQUISITE_PATH': {
          if (exp.pathHash !== pathHash) {
            itemIsStale = true;
            invalidDepIds.push(dep.depId);
            reasons[item.item_key] = `Prerequisite path changed (Stored: ${exp.pathHash?.substring(0, 8)}, Current: ${pathHash.substring(0, 8)})`;
          }
          break;
        }

        case 'ROOT_CONCEPT': {
          const currentRootName = rootGap?.conceptName || plan.topic_tag;
          if (exp.rootConceptName && exp.rootConceptName.toLowerCase() !== currentRootName.toLowerCase()) {
            itemIsStale = true;
            invalidDepIds.push(dep.depId);
            reasons[item.item_key] = `Root concept diagnosis changed from "${exp.rootConceptName}" to "${currentRootName}"`;
          }
          break;
        }

        case 'SOURCE_MATERIAL': {
          // Verify if material still exists
          const matRes = await db.query('SELECT id, updated_at, created_at, title, file_name, file_size FROM materials WHERE id = $1', [dep.targetId]);
          if (matRes.rowCount === 0) {
            itemIsStale = true;
            invalidDepIds.push(dep.depId);
            reasons[item.item_key] = 'Source material deleted or replaced';
          } else {
            const currentMat = matRes.rows[0];
            const currentHash = computeMaterialHash(currentMat);
            if (exp.materialHash && exp.materialHash !== currentHash) {
              itemIsStale = true;
              invalidDepIds.push(dep.depId);
              reasons[item.item_key] = 'Source material updated with a new version';
            }
          }
          break;
        }

        case 'ASSESSMENT_EVIDENCE': {
          if (exp.evidenceHash !== evidenceHash) {
            itemIsStale = true;
            invalidDepIds.push(dep.depId);
            reasons[item.item_key] = `Cohort assessment error distribution changed (Fail count: stored ${exp.totalFails}, current ${totalFails})`;
          }
          break;
        }
      }
    }

    if (itemIsStale || item.status === 'STALE' || item.status === 'FAILED') {
      staleItemKeys.add(item.item_key);
    } else {
      intactItemKeys.add(item.item_key);
    }
  }

  // Mark invalid dependencies in DB
  if (invalidDepIds.length > 0) {
    await db.query(`UPDATE remedial_item_dependencies SET is_valid = FALSE WHERE id = ANY($1::uuid[])`, [invalidDepIds]);
  }

  const isStale = staleItemKeys.size > 0;

  // Sync plan staleness flag
  await db.query('UPDATE cohort_remedial_plans SET is_stale = $1 WHERE id = $2', [isStale, planId]);

  return {
    authorized: true,
    planId,
    isStale,
    staleItemKeys: Array.from(staleItemKeys),
    intactItemKeys: Array.from(intactItemKeys),
    reasons,
    items: itemsRes.rows,
    plan,
    context: {
      rootGap,
      prerequisites,
      pathHash,
      totalFails,
      evidenceHash
    }
  };
}

/**
/**
 * Recomputes ONLY stale items of a remedial plan incrementally with safe concurrency control.
 *
 * LOCKING & TRANSACTION STRATEGY:
 * 1. AI execution is performed OUTSIDE of any database transaction or lock to prevent holding resources during long calls.
 * 2. User authorization is re-verified after the AI call finishes to ensure revoked permissions invalidate affected items.
 * 3. A dedicated database client initiates a transaction ('BEGIN') with a bounded lock timeout ('SELECT set_config(...)').
 * 4. A transaction-scoped advisory lock ('pg_advisory_xact_lock(hashtext(planId::text))') is acquired for the specific plan ID.
 * 5. A row-level lock ('cohort_remedial_plans WHERE id = $1 FOR UPDATE') locks the record and re-reads current version and metadata.
 * 6. If the current plan version or item versions differ from baseline, the outdated AI output is discarded, the transaction
 *    is rolled back, and a retryable concurrency conflict (HTTP 409) is returned without partial modifications or duplicate audits.
 * 7. In-transaction updates are executed deterministically (items sorted alphabetically by item_key ASC) to prevent deadlocks.
 * 8. Plan version increments, item version bumps, dependency updates, and audit records commit atomically.
 */
async function recomputePlanIncrementally(planId, options = {}) {
  const startTime = Date.now();
  const {
    user,
    triggerType = 'MANUAL_TRIGGER',
    triggerDetails = {},
    provider = 'gemini',
    mockAiGenerator = null,         // Available for deterministic testing
    lockTimeoutMs = 5000,           // Bounded lock acquisition timeout (ms)
    throwOnConflict = true,         // Throw or return conflict object
    _simulateCommitFailure = false, // Test hook to simulate DB failure during commit
    _onAiBeforeCommit = null        // Test hook to inject concurrent changes while AI call is executing
  } = options;

  // 1. Initial Authorization & Plan Existence Check
  const planCheck = await db.query(`
    SELECT p.*, s.department_id, d.institute_id
    FROM cohort_remedial_plans p
    JOIN subjects s ON p.subject_id = s.id
    JOIN departments d ON s.department_id = d.id
    WHERE p.id = $1
  `, [planId]);

  if (planCheck.rowCount === 0) {
    throw new Error('Remedial plan not found');
  }

  const plan = planCheck.rows[0];

  let liveUser = user;
  if (user && user.id) {
    try {
      const uRes = await db.query('SELECT id, role, department_id, institute_id FROM users WHERE id = $1', [user.id]);
      if (uRes.rowCount > 0) {
        liveUser = { ...user, ...uRes.rows[0] };
      }
    } catch (uErr) {
      console.warn('[incrementalRemedialService] User lookup note:', uErr.message);
    }
  }

  if (liveUser) {
    const auth = await verifyAuthorization(plan.subject_id, liveUser);
    if (!auth.authorized) {
      await recordAuditLog({
        planId,
        triggerType,
        triggerDetails: { ...triggerDetails, error: 'Unauthorized' },
        affectedItemKeys: [],
        outcome: 'FAILED',
        latencyMs: Date.now() - startTime,
        aiCallsMade: 0,
        errorMessage: auth.reason,
        createdBy: user?.id
      });
      const err = new Error(auth.reason);
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  // 2. Evaluate Staleness & Capture Baseline State
  const staleness = await evaluatePlanStaleness(planId, liveUser);

  if (staleness.needsInitialRegistration) {
    // Populate decomposed items first
    await registerPlanDependencies({
      planId,
      planContent: plan.plan_content,
      subjectId: plan.subject_id,
      topicId: plan.topic_id,
      topicTag: plan.topic_tag,
      userId: user?.id
    });
    // Re-evaluate staleness after registration
    return await recomputePlanIncrementally(planId, options);
  }

  // 3. Fast No-Op Exit: If plan is already up to date, exit immediately without locks or AI calls
  if (!staleness.isStale || staleness.staleItemKeys.length === 0) {
    const latencyMs = Date.now() - startTime;
    await recordAuditLog({
      planId,
      triggerType,
      triggerDetails: { ...triggerDetails, reason: 'Plan already up to date' },
      affectedItemKeys: [],
      oldVersionSummary: { planVersion: plan.version },
      newVersionSummary: { planVersion: plan.version },
      outcome: 'NO_OP',
      latencyMs,
      aiCallsMade: 0,
      createdBy: user?.id
    });

    return {
      success: true,
      updated: false,
      outcome: 'NO_OP',
      aiCallsMade: 0,
      latencyMs,
      message: 'Plan is fully up to date. No recomputations required.',
      plan: {
        ...plan,
        staleItemKeys: [],
        intactItemKeys: staleness.intactItemKeys
      }
    };
  }

  const expectedPlanVersion = plan.version || 1;
  const staleKeys = staleness.staleItemKeys.slice().sort(); // Deterministic ordering
  const currentItems = staleness.items || [];

  const baselineItemVersions = {};
  for (const it of currentItems) {
    baselineItemVersions[it.item_key] = it.version;
  }

  const oldVersionSummary = {
    planVersion: expectedPlanVersion,
    items: currentItems.map(i => ({ key: i.item_key, version: i.version }))
  };

  // 4. Gather Live Context for recomputing stale items (reusing evaluated context)
  const rootGap = staleness.context?.rootGap || null;
  const prerequisites = staleness.context?.prerequisites || [];
  const totalFails = staleness.context?.totalFails || 0;
  const evidenceHash = staleness.context?.evidenceHash || 'NO_EVIDENCE';
  const pathHash = staleness.context?.pathHash || 'NO_PREREQS';

  let missedQuestions = [];
  if (staleKeys.some(k => ['commonMistakes', 'practiceExercises', 'quickAssessmentQuestions'].includes(k))) {
    const ev = await fetchAssessmentEvidence(plan.topic_tag);
    missedQuestions = ev.missedQuestions;
  }

  let material = null;
  let materialHash = 'NO_MATERIAL';
  let extractedText = '';
  if (staleKeys.includes('conceptExplanation') || staleKeys.includes('example') || triggerType === 'MATERIAL_REPLACED') {
    material = await fetchTopicMaterial(plan.topic_id, plan.topic_tag);
    if (!material) {
      const matDepRes = await db.query(`
        SELECT m.* 
        FROM remedial_item_dependencies d
        JOIN remedial_plan_items i ON d.item_id = i.id
        JOIN materials m ON d.target_id = m.id::text
        WHERE i.plan_id = $1 AND d.dependency_type = 'SOURCE_MATERIAL'
        LIMIT 1
      `, [planId]);
      if (matDepRes.rowCount > 0) material = matDepRes.rows[0];
    }
    materialHash = computeMaterialHash(material);

    if (material) {
      try {
        const ext = await textExtractor.extractTextFromMaterial(material);
        extractedText = ext.text || '';
      } catch (e) {
        console.warn('[incrementalRemedialService] textExtractor error:', e.message);
      }
    }
  }

  const missedBlock = missedQuestions.map((q, idx) => 
    `Missed Question ${idx + 1} (Failed by ${q.fail_count} students): ${q.question} | Correct: ${q.correct_answer} | Explanation: ${q.explanation || 'N/A'}`
  ).join('\n');

  const prereqBlock = prerequisites.map(p => `- ${p.conceptName} (Depth ${p.depth}, Status: ${p.status || 'CONFIRMED'})`).join('\n');

  // 5. Construct targeted schema and prompt for ONLY the stale items
  const schemaProperties = {};
  for (const k of staleKeys) {
    if (k === 'prerequisiteRecap') schemaProperties.prerequisiteRecap = "1-2 paragraphs detailing foundational concepts students must revise before this topic";
    if (k === 'conceptExplanation') schemaProperties.conceptExplanation = "Clear, intuitive breakdown of the core concept with key rules";
    if (k === 'example') schemaProperties.example = "Worked step-by-step example illustrating proper application";
    if (k === 'commonMistakes') schemaProperties.commonMistakes = ["Specific mistake 1 and why students make it", "Specific mistake 2 and how to avoid it"];
    if (k === 'practiceExercises') schemaProperties.practiceExercises = ["Targeted practice exercise 1", "Targeted practice exercise 2"];
    if (k === 'quickAssessmentQuestions') schemaProperties.quickAssessmentQuestions = [
      { question: "Diagnostic question?", options: ["Opt A", "Opt B", "Opt C", "Opt D"], correctIndex: 0, explanation: "Explanation" }
    ];
  }

  const targetedPrompt = `You are an expert Academic Curriculum Specialist updating a targeted remedial package.
Topic: "${plan.topic_tag}"
Root Learning Gap Identified: "${rootGap?.conceptName || plan.topic_tag}"

Active Prerequisite Context:
${prereqBlock || 'Standard foundational concepts.'}

Recent Cohort Error Analysis:
${missedBlock || 'General misconceptions in applying this concept.'}

Active Course Material:
${extractedText ? extractedText.substring(0, 3000) : 'Standard undergraduate academic curriculum topic.'}

CRITICAL INSTRUCTION: Recompute ONLY the following requested sections: [${staleKeys.join(', ')}].
Do not generate or return other sections. Return strict JSON matching this structure:
${JSON.stringify(schemaProperties, null, 2)}`;

  // 6. Execute AI generator OUTSIDE of any database transaction or lock
  let recomputedContent = null;
  let aiCallsCount = 0;

  try {
    aiCallsCount = 1;
    if (mockAiGenerator) {
      recomputedContent = await mockAiGenerator(staleKeys, targetedPrompt);
    } else {
      recomputedContent = await aiService._executeWithFallback(provider, async (prov) => {
        const aiResult = await prov._generateContentWithFallback({
          contents: targetedPrompt,
          config: { responseMimeType: 'application/json' }
        });
        return prov._cleanAndParseJson(aiResult.text);
      });
    }

    if (!recomputedContent || typeof recomputedContent !== 'object') {
      throw new Error('AI returned invalid non-object response');
    }
  } catch (aiErr) {
    // PRESERVE EXISTING PLAN AND RECORD FAILURE!
    const sanitizedErrorMsg = (aiErr.message || 'AI Generation failed')
      .replace(/key=[a-zA-Z0-9_\-\.]+/gi, 'key=[REDACTED]')
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/sk-or-v1-[a-f0-9]{64}/g, '[REDACTED_OPENROUTER_KEY]')
      .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]')
      .slice(0, 500);

    console.error('[incrementalRemedialService] AI Generation failed during incremental update:', sanitizedErrorMsg);

    // Mark stale items as FAILED with last_error safely sanitized
    await db.query(`
      UPDATE remedial_plan_items
      SET status = 'FAILED', last_error = $1, updated_at = NOW()
      WHERE plan_id = $2 AND item_key = ANY($3::varchar[])
    `, [sanitizedErrorMsg, planId, staleKeys]);

    const latencyMs = Date.now() - startTime;
    await recordAuditLog({
      planId,
      triggerType,
      triggerDetails,
      affectedItemKeys: staleKeys,
      oldVersionSummary,
      newVersionSummary: oldVersionSummary,
      outcome: 'FAILED',
      latencyMs,
      aiCallsMade: aiCallsCount,
      errorMessage: sanitizedErrorMsg,
      createdBy: user?.id
    });

    const failureErr = new Error(`Incremental update failed: ${sanitizedErrorMsg}. The existing plan was safely preserved without modification.`);
    failureErr.preserved = true;
    failureErr.planId = planId;
    throw failureErr;
  }

  // Optional test hook: trigger concurrent modifications while AI call finishes
  if (typeof _onAiBeforeCommit === 'function') {
    await _onAiBeforeCommit({ baselineVersion: expectedPlanVersion, staleKeys });
  }

  // 7. Post-AI Authorization & Revocation Re-check (Before acquiring DB locks)
  if (user && user.id) {
    try {
      const postURes = await db.query('SELECT id, role, department_id, institute_id FROM users WHERE id = $1', [user.id]);
      const updatedUser = postURes.rowCount > 0 ? { ...user, ...postURes.rows[0] } : null;
      const reAuth = await verifyAuthorization(plan.subject_id, updatedUser);

      if (!reAuth.authorized) {
        // Permissions were revoked while AI call was executing!
        // Invalidate affected items immediately so previously accessible material is not exposed
        await notifyPermissionRevoked({ subjectId: plan.subject_id, reason: reAuth.reason });

        const latencyMs = Date.now() - startTime;
        await recordAuditLog({
          planId,
          triggerType: 'PERMISSION_REVOKED',
          triggerDetails: { ...triggerDetails, revokedDuringUpdate: true },
          affectedItemKeys: staleKeys,
          oldVersionSummary: { planVersion: expectedPlanVersion },
          newVersionSummary: { planVersion: expectedPlanVersion },
          outcome: 'FAILED',
          latencyMs,
          aiCallsMade: aiCallsCount,
          errorMessage: `Permissions revoked during update: ${reAuth.reason}`,
          createdBy: user.id
        });

        const authErr = new Error(`Permission revoked: ${reAuth.reason}. Generated updates were discarded and affected items invalidated.`);
        authErr.status = 403;
        authErr.code = 'PERMISSION_REVOKED';
        authErr.revoked = true;
        throw authErr;
      }
    } catch (authErr) {
      if (authErr.code === 'PERMISSION_REVOKED') throw authErr;
      console.warn('[incrementalRemedialService] Post-AI auth check error:', authErr.message);
    }
  }

  // 8. Transaction-Scoped Locking, Optimistic Version Validation, & Atomic Commit
  const client = await db.pool.connect();
  let inTransaction = false;

  try {
    await client.query('BEGIN');
    inTransaction = true;

    // A. Bounded lock timeout to handle lock contention gracefully without deadlock
    await client.query("SELECT set_config('lock_timeout', $1, true)", [`${parseInt(lockTimeoutMs, 10)}ms`]);

    // B. Acquire transaction-scoped PostgreSQL advisory lock specifically keyed on plan ID
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1::text))', [planId]);

    // C. Acquire row-level lock on the plan row and re-read current version and state
    const lockedPlanRes = await client.query(`
      SELECT id, version, is_stale, citations, status, subject_id, topic_id, topic_tag, plan_content
      FROM cohort_remedial_plans
      WHERE id = $1
      FOR UPDATE
    `, [planId]);

    if (lockedPlanRes.rowCount === 0) {
      throw new Error('Remedial plan not found during locked transaction');
    }

    const lockedPlan = lockedPlanRes.rows[0];

    // D. Re-read and revalidate plan version: Detect concurrent updates and discard stale AI results
    if (lockedPlan.version !== expectedPlanVersion) {
      await client.query('ROLLBACK');
      inTransaction = false;

      const conflictMsg = `Concurrency conflict: Remedial plan version changed from ${expectedPlanVersion} to ${lockedPlan.version} while update was in flight. Stale AI generation was safely discarded to prevent lost updates.`;
      console.warn(`[incrementalRemedialService] ${conflictMsg}`);

      const conflictErr = new Error(conflictMsg);
      conflictErr.status = 409;
      conflictErr.code = 'PLAN_VERSION_CONFLICT';
      conflictErr.concurrencyConflict = true;
      conflictErr.retryable = true;
      conflictErr.expectedVersion = expectedPlanVersion;
      conflictErr.currentVersion = lockedPlan.version;

      if (throwOnConflict) {
        throw conflictErr;
      }
      return {
        success: false,
        concurrencyConflict: true,
        retryable: true,
        code: 'PLAN_VERSION_CONFLICT',
        message: conflictMsg,
        expectedVersion: expectedPlanVersion,
        currentVersion: lockedPlan.version
      };
    }

    // E. Re-read and revalidate item versions under lock: Detect any fine-grained item changes
    const lockedItemsRes = await client.query(`
      SELECT id, item_key, version, status
      FROM remedial_plan_items
      WHERE plan_id = $1
      ORDER BY item_key ASC
      FOR UPDATE
    `, [planId]);

    for (const it of lockedItemsRes.rows) {
      if (baselineItemVersions[it.item_key] !== undefined && it.version !== baselineItemVersions[it.item_key]) {
        await client.query('ROLLBACK');
        inTransaction = false;

        const itemConflictMsg = `Concurrency conflict: Item "${it.item_key}" version changed from ${baselineItemVersions[it.item_key]} to ${it.version}. Stale AI generation was safely discarded.`;
        console.warn(`[incrementalRemedialService] ${itemConflictMsg}`);

        const itemConflictErr = new Error(itemConflictMsg);
        itemConflictErr.status = 409;
        itemConflictErr.code = 'ITEM_VERSION_CONFLICT';
        itemConflictErr.concurrencyConflict = true;
        itemConflictErr.retryable = true;

        if (throwOnConflict) throw itemConflictErr;
        return {
          success: false,
          concurrencyConflict: true,
          retryable: true,
          code: 'ITEM_VERSION_CONFLICT',
          message: itemConflictMsg
        };
      }
    }

    // F. Simulated failure hook for testing transaction rollback guarantees
    if (_simulateCommitFailure) {
      throw new Error('Simulated database failure during transaction commit');
    }

    // G. Atomic update of recomputed items in deterministic alphabetical order (prevents deadlocks)
    const updatedItemSummaries = [];

    for (const key of staleKeys) {
      const freshVal = recomputedContent[key];
      if (freshVal === undefined) continue;

      // Increment item version
      const itemUpdateRes = await client.query(`
        UPDATE remedial_plan_items
        SET content = $1, version = version + 1, status = 'ACTIVE', last_error = NULL, last_recomputed_at = NOW(), updated_at = NOW()
        WHERE plan_id = $2 AND item_key = $3
        RETURNING *
      `, [JSON.stringify(freshVal), planId, key]);

      if (itemUpdateRes.rowCount > 0) {
        const updatedItem = itemUpdateRes.rows[0];
        updatedItemSummaries.push({ key, version: updatedItem.version });

        // Update dependencies snapshot for this item
        if (key === 'prerequisiteRecap') {
          await client.query(`
            UPDATE remedial_item_dependencies
            SET expected_state = $1, is_valid = TRUE, updated_at = NOW()
            WHERE item_id = $2 AND dependency_type = 'PREREQUISITE_PATH'
          `, [JSON.stringify({ pathHash, nodeCount: prerequisites.length, rootGapName: rootGap?.conceptName || null }), updatedItem.id]);
        }

        if (key === 'conceptExplanation' || key === 'example') {
          if (material) {
            await client.query(`
              UPDATE remedial_item_dependencies
              SET expected_state = $1, is_valid = TRUE, updated_at = NOW()
              WHERE item_id = $2 AND dependency_type = 'SOURCE_MATERIAL'
            `, [JSON.stringify({ materialId: material.id, materialHash, versionTimestamp: material.updated_at || material.created_at, title: material.title }), updatedItem.id]);
          } else {
            await client.query(`
              UPDATE remedial_item_dependencies
              SET expected_state = '{"materialHash": "NO_MATERIAL"}'::jsonb, is_valid = TRUE, updated_at = NOW()
              WHERE item_id = $1 AND dependency_type = 'SOURCE_MATERIAL'
            `, [updatedItem.id]);
          }
        }

        if (key === 'commonMistakes' || key === 'practiceExercises' || key === 'quickAssessmentQuestions') {
          await client.query(`
            UPDATE remedial_item_dependencies
            SET expected_state = $1, is_valid = TRUE, updated_at = NOW()
            WHERE item_id = $2 AND dependency_type = 'ASSESSMENT_EVIDENCE'
          `, [JSON.stringify({ evidenceHash, totalFails, sampleCount: missedQuestions.length }), updatedItem.id]);
        }
      }
    }

    // H. Reassemble composite plan_content
    const allItemsRes = await client.query('SELECT item_key, content, version FROM remedial_plan_items WHERE plan_id = $1 ORDER BY item_key ASC', [planId]);
    const compositePlan = {};
    allItemsRes.rows.forEach(r => {
      let parsed = r.content;
      if (typeof r.content === 'string') {
        try {
          parsed = JSON.parse(r.content);
        } catch (e) {
          parsed = r.content;
        }
      }
      compositePlan[r.item_key] = parsed;
    });

    // I. Citations: Preserve citations during unrelated updates, update only if material was re-evaluated
    const updatedCitations = (staleKeys.includes('conceptExplanation') || staleKeys.includes('example') || triggerType === 'MATERIAL_REPLACED')
      ? (material ? [{
          materialId: material.id,
          title: material.title,
          fileName: material.file_name,
          fileUrl: material.file_url,
          versionTimestamp: material.updated_at || material.created_at,
          fileSize: material.file_size
        }] : [])
      : (lockedPlan.citations || []);

    const newPlanVersion = lockedPlan.version + 1;

    // J. Update parent plan record
    const updatedPlanRes = await client.query(`
      UPDATE cohort_remedial_plans
      SET plan_content = $1, version = $2, is_stale = FALSE, citations = $3, last_incremental_update_at = NOW(), updated_at = NOW()
      WHERE id = $4
      RETURNING *
    `, [JSON.stringify(compositePlan), newPlanVersion, JSON.stringify(updatedCitations), planId]);

    const finalPlan = updatedPlanRes.rows[0];

    const newVersionSummary = {
      planVersion: newPlanVersion,
      items: allItemsRes.rows.map(r => ({ key: r.item_key, version: r.version }))
    };

    const latencyMs = Date.now() - startTime;

    // K. Record success in audit log inside the transaction
    await client.query(`
      INSERT INTO remedial_plan_audit_log (
        plan_id, trigger_type, trigger_details, affected_item_keys,
        old_version_summary, new_version_summary, outcome,
        latency_ms, ai_calls_made, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'SUCCESS', $7, $8, $9, NOW())
    `, [
      planId,
      triggerType,
      JSON.stringify(triggerDetails),
      staleKeys,
      JSON.stringify(oldVersionSummary),
      JSON.stringify(newVersionSummary),
      latencyMs,
      aiCallsCount,
      user?.id || null
    ]);

    await client.query('COMMIT');
    inTransaction = false;

    return {
      success: true,
      updated: true,
      outcome: 'SUCCESS',
      recomputedItemKeys: staleKeys,
      intactItemKeys: staleness.intactItemKeys,
      oldPlanVersion: expectedPlanVersion,
      newPlanVersion,
      latencyMs,
      aiCallsMade: aiCallsCount,
      plan: finalPlan
    };
  } catch (dbErr) {
    if (inTransaction) {
      try {
        await client.query('ROLLBACK');
      } catch (rbErr) {
        // Ignore rollback error on already closed/aborted transaction
      }
    }

    // Handle bounded lock timeout (PostgreSQL 55P03: lock_not_available / lock timeout)
    if (dbErr.code === '55P03' || dbErr.message?.includes('lock timeout') || dbErr.message?.includes('canceling statement due to lock timeout')) {
      console.warn(`[incrementalRemedialService] Bounded lock acquisition timed out (${lockTimeoutMs}ms) on plan ${planId}`);

      const timeoutErr = new Error(`Lock acquisition timed out (${lockTimeoutMs}ms) for remedial plan. The plan is currently locked by a concurrent update. Please retry.`);
      timeoutErr.status = 409;
      timeoutErr.code = 'LOCK_TIMEOUT';
      timeoutErr.concurrencyConflict = true;
      timeoutErr.retryable = true;

      if (throwOnConflict) throw timeoutErr;
      return {
        success: false,
        concurrencyConflict: true,
        retryable: true,
        code: 'LOCK_TIMEOUT',
        message: timeoutErr.message
      };
    }

    console.error('[incrementalRemedialService] DB error during incremental update commit:', dbErr.message);
    throw dbErr;
  } finally {
    client.release();
  }
}

/**
 * Record audit log entry
 */
async function recordAuditLog({
  planId,
  triggerType,
  triggerDetails = {},
  affectedItemKeys = [],
  oldVersionSummary = {},
  newVersionSummary = {},
  outcome,
  latencyMs = 0,
  aiCallsMade = 0,
  errorMessage = null,
  createdBy = null
}) {
  try {
    // Sanitize triggerDetails: remove tokens, secrets, or keys
    const sanitizedDetails = { ...triggerDetails };
    delete sanitizedDetails.token;
    delete sanitizedDetails.apiKey;
    delete sanitizedDetails.password;
    delete sanitizedDetails.authorization;

    // Validate createdBy in users table to prevent foreign key errors for simulated callers
    let validUserId = null;
    if (createdBy) {
      const uRes = await db.query('SELECT id FROM users WHERE id = $1', [createdBy]);
      if (uRes.rowCount > 0) validUserId = createdBy;
    }

    await db.query(`
      INSERT INTO remedial_plan_audit_log (
        plan_id, trigger_type, trigger_details, affected_item_keys,
        old_version_summary, new_version_summary, outcome,
        latency_ms, ai_calls_made, error_message, created_by, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
      planId,
      triggerType,
      JSON.stringify(sanitizedDetails),
      affectedItemKeys,
      JSON.stringify(oldVersionSummary),
      JSON.stringify(newVersionSummary),
      outcome,
      latencyMs,
      aiCallsMade,
      errorMessage,
      validUserId
    ]);
  } catch (err) {
    console.error('[incrementalRemedialService] recordAuditLog error:', err.message);
  }
}

/**
 * Notification hooks for reactive change detection
 */
async function notifyAssessmentChange({ topicTag, subjectId = null }) {
  try {
    const plansRes = await db.query(`
      SELECT id FROM cohort_remedial_plans 
      WHERE topic_tag ILIKE $1 OR ($2::uuid IS NOT NULL AND subject_id = $2)
    `, [`%${topicTag}%`, subjectId]);

    const planIds = plansRes.rows.map(r => r.id);
    if (planIds.length > 0) {
      await db.query(`
        UPDATE remedial_item_dependencies d
        SET is_valid = FALSE, updated_at = NOW()
        FROM remedial_plan_items i
        WHERE d.item_id = i.id AND i.plan_id = ANY($1::uuid[]) AND d.dependency_type = 'ASSESSMENT_EVIDENCE'
      `, [planIds]);

      await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = ANY($1::uuid[])`, [planIds]);
    }
    return { affectedPlansCount: planIds.length };
  } catch (err) {
    console.warn('[notifyAssessmentChange] error:', err.message);
    return { affectedPlansCount: 0 };
  }
}

async function notifyPrerequisiteChange({ conceptId = null, subjectId = null }) {
  try {
    const plansRes = await db.query(`
      SELECT DISTINCT p.id 
      FROM cohort_remedial_plans p
      JOIN remedial_plan_items i ON p.id = i.plan_id
      JOIN remedial_item_dependencies d ON i.id = d.item_id
      WHERE d.dependency_type = 'PREREQUISITE_PATH' 
        OR ($1::uuid IS NOT NULL AND d.target_id = $1::text)
        OR ($2::uuid IS NOT NULL AND p.subject_id = $2)
    `, [conceptId, subjectId]);

    const planIds = plansRes.rows.map(r => r.id);
    if (planIds.length > 0) {
      await db.query(`
        UPDATE remedial_item_dependencies d
        SET is_valid = FALSE, updated_at = NOW()
        FROM remedial_plan_items i
        WHERE d.item_id = i.id AND i.plan_id = ANY($1::uuid[]) AND d.dependency_type = 'PREREQUISITE_PATH'
      `, [planIds]);

      await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = ANY($1::uuid[])`, [planIds]);
    }
    return { affectedPlansCount: planIds.length };
  } catch (err) {
    console.warn('[notifyPrerequisiteChange] error:', err.message);
    return { affectedPlansCount: 0 };
  }
}

async function notifyMaterialChange({ materialId, topicId = null }) {
  try {
    const plansRes = await db.query(`
      SELECT DISTINCT p.id 
      FROM cohort_remedial_plans p
      JOIN remedial_plan_items i ON p.id = i.plan_id
      JOIN remedial_item_dependencies d ON i.id = d.item_id
      WHERE (d.dependency_type = 'SOURCE_MATERIAL' AND d.target_id = $1::text)
        OR ($2::uuid IS NOT NULL AND p.topic_id = $2)
    `, [materialId, topicId]);

    const planIds = plansRes.rows.map(r => r.id);
    if (planIds.length > 0) {
      await db.query(`
        UPDATE remedial_item_dependencies d
        SET is_valid = FALSE, updated_at = NOW()
        FROM remedial_plan_items i
        WHERE d.item_id = i.id AND i.plan_id = ANY($1::uuid[]) AND d.dependency_type = 'SOURCE_MATERIAL'
      `, [planIds]);

      await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = ANY($1::uuid[])`, [planIds]);
    }
    return { affectedPlansCount: planIds.length };
  } catch (err) {
    console.warn('[notifyMaterialChange] error:', err.message);
    return { affectedPlansCount: 0 };
  }
}

async function notifyPermissionRevoked({ subjectId = null, departmentId = null, reason = 'Authorization revoked' }) {
  try {
    const plansRes = await db.query(`
      SELECT p.id FROM cohort_remedial_plans p
      JOIN subjects s ON p.subject_id = s.id
      WHERE ($1::uuid IS NOT NULL AND p.subject_id = $1)
         OR ($2::uuid IS NOT NULL AND s.department_id = $2)
    `, [subjectId, departmentId]);

    const planIds = plansRes.rows.map(r => r.id);
    if (planIds.length > 0) {
      await db.query(`
        UPDATE remedial_item_dependencies d
        SET is_valid = FALSE, updated_at = NOW()
        FROM remedial_plan_items i
        WHERE d.item_id = i.id AND i.plan_id = ANY($1::uuid[]) AND d.dependency_type = 'AUTHORIZATION_SCOPE'
      `, [planIds]);

      await db.query(`
        UPDATE remedial_plan_items
        SET status = 'STALE', updated_at = NOW()
        WHERE plan_id = ANY($1::uuid[])
      `, [planIds]);

      await db.query(`UPDATE cohort_remedial_plans SET is_stale = TRUE WHERE id = ANY($1::uuid[])`, [planIds]);
    }
    return { affectedPlansCount: planIds.length };
  } catch (err) {
    console.warn('[notifyPermissionRevoked] error:', err.message);
    return { affectedPlansCount: 0 };
  }
}

module.exports = {
  PLAN_ITEM_KEYS,
  verifyAuthorization,
  fetchPrerequisiteContext,
  fetchAssessmentEvidence,
  fetchTopicMaterial,
  registerPlanDependencies,
  evaluatePlanStaleness,
  recomputePlanIncrementally,
  recordAuditLog,
  notifyAssessmentChange,
  notifyPrerequisiteChange,
  notifyMaterialChange,
  notifyPermissionRevoked,
  computeEvidenceHash,
  computePathHash,
  computeMaterialHash
};
