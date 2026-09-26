const db = require('../db');
const aiService = require('../services/ai/aiService');
const textExtractor = require('../utils/textExtractor');

/**
 * Depth-limited graph cycle detector for PREREQUISITE_OF / DEPENDS_ON
 * Returns true if adding edge from sourceId -> targetId would create a cycle.
 */
const wouldCreateCycle = async (sourceId, targetId, relType = 'PREREQUISITE_OF', maxDepth = 6) => {
  if (sourceId === targetId) return true;

  // For PREREQUISITE_OF: source is prerequisite of target (source -> target).
  // Cycle exists if there's already a path from target -> source.
  const visited = new Set();
  const queue = [{ id: targetId, depth: 0 }];

  while (queue.length > 0) {
    const { id: currentId, depth } = queue.shift();
    if (currentId === sourceId) return true;
    if (depth >= maxDepth) continue;

    if (!visited.has(currentId)) {
      visited.add(currentId);

      const nextRes = await db.query(
        `SELECT target_concept_id 
         FROM concept_relationships 
         WHERE source_concept_id = $1 AND relationship_type = $2`,
        [currentId, relType]
      );

      for (const row of nextRes.rows) {
        if (!visited.has(row.target_concept_id)) {
          queue.push({ id: row.target_concept_id, depth: depth + 1 });
        }
      }
    }
  }

  return false;
};

/**
 * GET /api/knowledge-graph/subjects/:subjectId
 * Retrieve the full knowledge graph (concepts + relationships) for a subject
 */
exports.getSubjectKnowledgeGraph = async (req, res) => {
  const { subjectId } = req.params;
  const user = req.user;

  try {
    // 1. Verify subject access
    const subRes = await db.query(
      `SELECT s.id, s.name, s.code, s.department_id, d.institute_id
       FROM subjects s
       JOIN departments d ON s.department_id = d.id
       WHERE s.id = $1`,
      [subjectId]
    );

    if (subRes.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const subject = subRes.rows[0];

    // Check institute / department isolation
    if (user.role !== 'SUPER_ADMIN') {
      if (user.institute_id && subject.institute_id !== user.institute_id) {
        return res.status(403).json({ error: 'Access denied to this institute subject.' });
      }
    }

    // 2. Fetch concepts for this subject
    const conceptsRes = await db.query(
      `SELECT c.id, c.subject_id, c.topic_id, c.name, c.description, c.status, c.created_at,
              t.title as topic_title, u.unit_number, u.title as unit_title
       FROM concepts c
       LEFT JOIN topics t ON c.topic_id = t.id
       LEFT JOIN lessons l ON t.lesson_id = l.id
       LEFT JOIN units u ON l.unit_id = u.id
       WHERE c.subject_id = $1
       ORDER BY c.name ASC`,
      [subjectId]
    );

    // 3. Fetch concept relationships
    const relationshipsRes = await db.query(
      `SELECT cr.id, cr.source_concept_id, cr.target_concept_id, cr.relationship_type, cr.status, cr.created_at,
              sc.name as source_name, tc.name as target_name
       FROM concept_relationships cr
       JOIN concepts sc ON cr.source_concept_id = sc.id
       JOIN concepts tc ON cr.target_concept_id = tc.id
       WHERE sc.subject_id = $1 AND tc.subject_id = $1
       ORDER BY cr.relationship_type, sc.name`,
      [subjectId]
    );

    const concepts = conceptsRes.rows;
    const relationships = relationshipsRes.rows;

    const prerequisitesCount = relationships.filter(r => r.relationship_type === 'PREREQUISITE_OF' || r.relationship_type === 'DEPENDS_ON').length;

    res.json({
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        departmentId: subject.department_id
      },
      concepts,
      relationships,
      summary: {
        totalConcepts: concepts.length,
        totalRelationships: relationships.length,
        prerequisitesCount,
        confirmedCount: concepts.filter(c => c.status === 'CONFIRMED').length,
        detectedCount: concepts.filter(c => c.status === 'DETECTED').length
      }
    });
  } catch (err) {
    console.error('getSubjectKnowledgeGraph error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch knowledge graph.' });
  }
};

/**
 * GET /api/knowledge-graph/topics/:topicId
 * Retrieve concept nodes and direct relationships for a single topic
 */
exports.getTopicKnowledgeGraph = async (req, res) => {
  const { topicId } = req.params;

  try {
    const topicRes = await db.query(
      `SELECT t.id, t.title, l.unit_id, u.subject_id, s.name as subject_name
       FROM topics t
       JOIN lessons l ON t.lesson_id = l.id
       JOIN units u ON l.unit_id = u.id
       JOIN subjects s ON u.subject_id = s.id
       WHERE t.id = $1`,
      [topicId]
    );

    if (topicRes.rowCount === 0) {
      return res.status(404).json({ error: 'Topic not found.' });
    }

    const topic = topicRes.rows[0];

    // Fetch concepts mapped to this topic or matching title
    const conceptsRes = await db.query(
      `SELECT * FROM concepts 
       WHERE subject_id = $1 AND (topic_id = $2 OR name ILIKE $3)`,
      [topic.subject_id, topicId, `%${topic.title}%`]
    );

    const conceptIds = conceptsRes.rows.map(c => c.id);

    let relationships = [];
    if (conceptIds.length > 0) {
      const relsRes = await db.query(
        `SELECT cr.*, sc.name as source_name, tc.name as target_name
         FROM concept_relationships cr
         JOIN concepts sc ON cr.source_concept_id = sc.id
         JOIN concepts tc ON cr.target_concept_id = tc.id
         WHERE cr.source_concept_id = ANY($1::uuid[]) OR cr.target_concept_id = ANY($1::uuid[])`,
        [conceptIds]
      );
      relationships = relsRes.rows;
    }

    res.json({
      topic,
      concepts: conceptsRes.rows,
      relationships
    });
  } catch (err) {
    console.error('getTopicKnowledgeGraph error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch topic knowledge graph.' });
  }
};

/**
 * POST /api/knowledge-graph/concepts
 * Create or register a new concept under a subject
 */
exports.createConcept = async (req, res) => {
  const { subjectId, topicId, name, description, status = 'CONFIRMED' } = req.body;
  const userId = req.user.id;

  if (!subjectId || !name || !name.trim()) {
    return res.status(400).json({ error: 'Subject ID and concept name are required.' });
  }

  try {
    const trimmedName = name.trim();

    const insertRes = await db.query(
      `INSERT INTO concepts (subject_id, topic_id, name, description, status, created_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (subject_id, name)
       DO UPDATE SET topic_id = COALESCE(EXCLUDED.topic_id, concepts.topic_id),
                     description = COALESCE(EXCLUDED.description, concepts.description),
                     status = EXCLUDED.status,
                     updated_at = NOW()
       RETURNING *`,
      [subjectId, topicId || null, trimmedName, description || null, status, userId]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('createConcept error:', err);
    res.status(500).json({ error: err.message || 'Failed to create concept.' });
  }
};

/**
 * PATCH or PUT /api/knowledge-graph/concepts/:id/status
 * Update concept status following lifecycle: DETECTED -> REVIEWED -> CONFIRMED
 */
exports.updateConceptStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const user = req.user;

  // 1. Validate status input
  const validStatuses = ['DETECTED', 'REVIEWED', 'CONFIRMED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status '${status}'. Allowed statuses: ${validStatuses.join(', ')}.`
    });
  }

  // 2. Enforce student restriction
  if (user.role === 'STUDENT') {
    return res.status(403).json({ error: 'Students are not authorized to modify concept status.' });
  }

  try {
    // 3. Fetch concept with subject and department details for authorization
    const conceptRes = await db.query(
      `SELECT c.id, c.subject_id, c.name, c.status, s.department_id, d.institute_id
       FROM concepts c
       JOIN subjects s ON c.subject_id = s.id
       JOIN departments d ON s.department_id = d.id
       WHERE c.id = $1`,
      [id]
    );

    if (conceptRes.rowCount === 0) {
      return res.status(404).json({ error: 'Concept not found.' });
    }

    const concept = conceptRes.rows[0];

    // 4. Institute and Department ownership checks
    if (user.role !== 'SUPER_ADMIN') {
      if (user.institute_id && concept.institute_id !== user.institute_id) {
        return res.status(403).json({ error: 'Access denied: Concept belongs to a different institute.' });
      }
      if ((user.role === 'HOD' || user.role === 'FACULTY') && user.department_id && concept.department_id !== user.department_id) {
        return res.status(403).json({ error: 'Access denied: Concept belongs to a different department.' });
      }
    }

    // 5. Enforce valid lifecycle transitions
    const currentStatus = concept.status;
    const allowedTransitions = {
      DETECTED: ['DETECTED', 'REVIEWED', 'CONFIRMED'],
      REVIEWED: ['REVIEWED', 'CONFIRMED'],
      CONFIRMED: ['CONFIRMED']
    };

    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        error: `Invalid lifecycle transition from ${currentStatus} to ${status}.`
      });
    }

    // 6. Update concept status in database
    const updateRes = await db.query(
      `UPDATE concepts 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    res.json({
      success: true,
      message: status === 'REVIEWED' ? 'Concept marked as reviewed.' : status === 'CONFIRMED' ? 'Concept confirmed.' : 'Concept status updated.',
      concept: updateRes.rows[0]
    });
  } catch (err) {
    console.error('updateConceptStatus error:', err);
    res.status(500).json({ error: err.message || 'Failed to update concept status.' });
  }
};

/**
 * POST /api/knowledge-graph/relationships
 * Create a relationship between two concepts with cycle detection
 */
exports.createRelationship = async (req, res) => {
  const { sourceConceptId, targetConceptId, relationshipType, status = 'CONFIRMED' } = req.body;
  const userId = req.user.id;

  const validTypes = ['PREREQUISITE_OF', 'DEPENDS_ON', 'RELATED_TO', 'PART_OF', 'EXPLAINS', 'EXAMPLE_OF'];

  if (!sourceConceptId || !targetConceptId || !relationshipType) {
    return res.status(400).json({ error: 'Source concept, target concept, and relationship type are required.' });
  }

  if (!validTypes.includes(relationshipType)) {
    return res.status(400).json({ error: `Invalid relationship type. Allowed: ${validTypes.join(', ')}` });
  }

  if (sourceConceptId === targetConceptId) {
    return res.status(400).json({ error: 'A concept cannot have a relationship to itself.' });
  }

  try {
    // Check cycle for prerequisite relations
    if (relationshipType === 'PREREQUISITE_OF' || relationshipType === 'DEPENDS_ON') {
      const isCycle = await wouldCreateCycle(sourceConceptId, targetConceptId, relationshipType);
      if (isCycle) {
        return res.status(400).json({
          error: `Cannot create relationship: this would introduce a circular prerequisite cycle (${relationshipType}).`
        });
      }
    }

    const insertRes = await db.query(
      `INSERT INTO concept_relationships (source_concept_id, target_concept_id, relationship_type, status, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (source_concept_id, target_concept_id, relationship_type)
       DO UPDATE SET status = EXCLUDED.status
       RETURNING *`,
      [sourceConceptId, targetConceptId, relationshipType, status, userId]
    );

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    console.error('createRelationship error:', err);
    res.status(500).json({ error: err.message || 'Failed to create concept relationship.' });
  }
};

/**
 * DELETE /api/knowledge-graph/relationships/:id
 */
exports.deleteRelationship = async (req, res) => {
  const { id } = req.params;

  try {
    const delRes = await db.query(`DELETE FROM concept_relationships WHERE id = $1 RETURNING *`, [id]);
    if (delRes.rowCount === 0) {
      return res.status(404).json({ error: 'Relationship not found.' });
    }
    res.json({ success: true, message: 'Relationship deleted successfully.' });
  } catch (err) {
    console.error('deleteRelationship error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete relationship.' });
  }
};

/**
 * PUT /api/knowledge-graph/relationships/:id/status
 */
exports.updateRelationshipStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['DETECTED', 'REVIEWED', 'CONFIRMED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: DETECTED, REVIEWED, CONFIRMED.' });
  }

  try {
    const updateRes = await db.query(
      `UPDATE concept_relationships SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Relationship not found.' });
    }
    res.json(updateRes.rows[0]);
  } catch (err) {
    console.error('updateRelationshipStatus error:', err);
    res.status(500).json({ error: err.message || 'Failed to update relationship status.' });
  }
};

/**
 * POST /api/knowledge-graph/subjects/:subjectId/auto-generate
 * AI-powered extraction of concepts and prerequisite relationships from course materials
 */
exports.generateSubjectKnowledgeGraph = async (req, res) => {
  const { subjectId } = req.params;
  const { provider = 'gemini' } = req.body;
  const userId = req.user.id;

  try {
    // 1. Verify subject access and institute boundaries
    const subRes = await db.query(
      `SELECT s.id, s.name, s.code, s.department_id, d.institute_id
       FROM subjects s
       JOIN departments d ON s.department_id = d.id
       WHERE s.id = $1`,
      [subjectId]
    );

    if (subRes.rowCount === 0) {
      return res.status(404).json({ error: 'Subject not found.' });
    }

    const subject = subRes.rows[0];

    if (req.user.role !== 'SUPER_ADMIN') {
      if (req.user.institute_id && subject.institute_id !== req.user.institute_id) {
        return res.status(403).json({ error: 'Access denied to this institute subject.' });
      }
      if (req.user.role === 'HOD' && req.user.department_id && subject.department_id !== req.user.department_id) {
        return res.status(403).json({ error: 'Access denied: HOD cannot modify subjects outside their department.' });
      }
    }

    // 2. Fetch Subject Topics and Materials
    const topicsRes = await db.query(
      `SELECT t.id as topic_id, t.title as topic_title, u.title as unit_title, u.unit_number,
              m.id as material_id, m.title as material_title, m.file_type
       FROM topics t
       JOIN lessons l ON t.lesson_id = l.id
       JOIN units u ON l.unit_id = u.id
       LEFT JOIN materials m ON m.topic_id = t.id AND (m.source_type = 'OFFICIAL' OR m.source_type IS NULL)
       WHERE u.subject_id = $1
       ORDER BY u.unit_number ASC, t.topic_number ASC`,
      [subjectId]
    );

    if (topicsRes.rowCount === 0) {
      return res.status(400).json({ error: 'Subject has no units or topics to analyze.' });
    }

    const syllabusOutline = topicsRes.rows.map(r => 
      `Unit ${r.unit_number} (${r.unit_title}): Topic "${r.topic_title}" [TopicID: ${r.topic_id}]`
    ).join('\n');

    // 2. Ask AI to extract structured concepts & prerequisite relationships
    const prompt = `You are an expert curriculum architect and academic ontology engineer.
Analyze this academic syllabus outline and construct a structured Knowledge Graph of academic concepts and their prerequisite relationships.

ACADEMIC SYLLABUS:
${syllabusOutline}

RULES:
1. Extract 8-15 distinct, essential technical/academic concepts taught in this syllabus.
2. For each concept, assign the matching TopicID if known from the syllabus.
3. Identify genuine prerequisite dependencies (PREREQUISITE_OF: Concept A must be learned before Concept B).
4. Identify other relationships (RELATED_TO, PART_OF, EXPLAINS).
5. DO NOT create circular prerequisite loops.
6. Return ONLY valid JSON matching this schema:

{
  "concepts": [
    { "name": "Concept Name", "description": "Crisp 1-sentence definition", "topicId": "UUID or null" }
  ],
  "relationships": [
    { "sourceConcept": "Prerequisite Concept Name", "targetConcept": "Target Concept Name", "type": "PREREQUISITE_OF" or "RELATED_TO" or "PART_OF" }
  ]
}`;

    const aiResult = await aiService.getProvider(provider)._generateContentWithFallback({
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = aiService.getProvider(provider)._cleanAndParseJson(aiResult.text);

    if (!parsed || !Array.isArray(parsed.concepts)) {
      return res.status(500).json({ error: 'AI failed to produce structured knowledge graph JSON.' });
    }

    // 3. Insert Concepts transactionally
    const client = await db.pool.connect();
    let createdConcepts = 0;
    let createdRelationships = 0;

    try {
      await client.query('BEGIN');

      const nameToIdMap = {};

      // Insert concepts
      for (const c of parsed.concepts) {
        if (!c.name || !c.name.trim()) continue;
        const name = c.name.trim();
        const topicId = c.topicId && c.topicId.length === 36 ? c.topicId : null;

        const cRes = await client.query(
          `INSERT INTO concepts (subject_id, topic_id, name, description, status, created_by)
           VALUES ($1, $2, $3, $4, 'DETECTED', $5)
           ON CONFLICT (subject_id, name)
           DO UPDATE SET topic_id = COALESCE(EXCLUDED.topic_id, concepts.topic_id),
                         description = COALESCE(EXCLUDED.description, concepts.description)
           RETURNING id`,
          [subjectId, topicId, name, c.description || null, userId]
        );

        nameToIdMap[name.toLowerCase()] = cRes.rows[0].id;
        createdConcepts++;
      }

      // Insert relationships with validation
      if (Array.isArray(parsed.relationships)) {
        for (const rel of parsed.relationships) {
          const srcId = nameToIdMap[(rel.sourceConcept || '').toLowerCase().trim()];
          const tgtId = nameToIdMap[(rel.targetConcept || '').toLowerCase().trim()];
          const type = rel.type || 'RELATED_TO';

          if (srcId && tgtId && srcId !== tgtId) {
            // Check for simple cycle before insertion
            const wouldCycle = await wouldCreateCycle(srcId, tgtId, type);
            if (!wouldCycle) {
              await client.query(
                `INSERT INTO concept_relationships (source_concept_id, target_concept_id, relationship_type, status, created_by)
                 VALUES ($1, $2, $3, 'DETECTED', $4)
                 ON CONFLICT (source_concept_id, target_concept_id, relationship_type) DO NOTHING`,
                [srcId, tgtId, type, userId]
              );
              createdRelationships++;
            }
          }
        }
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      message: `Knowledge Graph generated: ${createdConcepts} concepts and ${createdRelationships} relationships.`,
      createdConcepts,
      createdRelationships
    });
  } catch (err) {
    console.error('generateSubjectKnowledgeGraph error:', err);
    res.status(500).json({ error: err.message || 'Failed to auto-generate knowledge graph.' });
  }
};

exports.wouldCreateCycle = wouldCreateCycle;

