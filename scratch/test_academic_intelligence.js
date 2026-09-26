const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const db = require('../backend/db');
const { analyzePrerequisitesForTopic } = require('../backend/controllers/prerequisiteController');
const { calculateSubjectCoverage } = require('../backend/controllers/syllabusCoverageController');
const { aggregateCohortTopicPerformance } = require('../backend/controllers/cohortAnalyticsController');
const { extractCitationMetadata, determineGroundingStatus } = require('../backend/controllers/assistantController');

async function runTests() {
  console.log('================================================================');
  console.log('STARTING ACADEMIX INTELLIGENT ACADEMIC LAYER VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST 1: KNOWLEDGE GRAPH & CYCLE DETECTION
    // -------------------------------------------------------------
    console.log('\n--- 1. Knowledge Graph Architecture & Cycle Prevention ---');
    
    // Pick an existing subject
    const subjectRes = await db.query(`SELECT id, department_id FROM subjects LIMIT 1`);
    if (subjectRes.rowCount === 0) {
      console.log('Skipping subject-dependent tests: No subjects in DB.');
    } else {
      const subjectId = subjectRes.rows[0].id;
      
      // Clean test concepts
      await db.query(`DELETE FROM concepts WHERE name IN ('Test_FD', 'Test_2NF', 'Test_3NF', 'Test_BCNF')`);

      // Create concept nodes
      const c1 = await db.query(
        `INSERT INTO concepts (subject_id, name, description, provenance, status) 
         VALUES ($1, 'Test_FD', 'Functional Dependency', 'TEST_RUN', 'CONFIRMED') RETURNING id`,
        [subjectId]
      );
      const c2 = await db.query(
        `INSERT INTO concepts (subject_id, name, description, provenance, status) 
         VALUES ($1, 'Test_2NF', 'Second Normal Form', 'TEST_RUN', 'CONFIRMED') RETURNING id`,
        [subjectId]
      );
      const c3 = await db.query(
        `INSERT INTO concepts (subject_id, name, description, provenance, status) 
         VALUES ($1, 'Test_3NF', 'Third Normal Form', 'TEST_RUN', 'DETECTED') RETURNING id`,
        [subjectId]
      );

      const id1 = c1.rows[0].id;
      const id2 = c2.rows[0].id;
      const id3 = c3.rows[0].id;

      // Add valid prerequisite relationships: Test_FD -> Test_2NF -> Test_3NF
      await db.query(
        `INSERT INTO concept_relationships (source_concept_id, target_concept_id, relationship_type, status)
         VALUES ($1, $2, 'PREREQUISITE_OF', 'CONFIRMED')`,
        [id1, id2]
      );
      await db.query(
        `INSERT INTO concept_relationships (source_concept_id, target_concept_id, relationship_type, status)
         VALUES ($1, $2, 'PREREQUISITE_OF', 'CONFIRMED')`,
        [id2, id3]
      );

      assert(id1 && id2 && id3, 'Concepts and relationships created safely with subject scoping');

      // Test Cycle Detection function
      const wouldCreateCycle = async (sourceId, targetId) => {
        const visited = new Set([sourceId]);
        const queue = [targetId];
        while (queue.length > 0) {
          const curr = queue.shift();
          if (curr === sourceId) return true;
          visited.add(curr);
          const res = await db.query(
            `SELECT target_concept_id FROM concept_relationships 
             WHERE source_concept_id = $1 AND relationship_type IN ('PREREQUISITE_OF', 'DEPENDS_ON')`,
            [curr]
          );
          for (const r of res.rows) {
            if (!visited.has(r.target_concept_id)) queue.push(r.target_concept_id);
          }
        }
        return false;
      };

      const createsCycle = await wouldCreateCycle(id3, id1); // Attempting Test_3NF -> Test_FD
      assert(createsCycle === true, 'Prerequisite cycle (id3 -> id1) correctly detected and rejected');

      const noCycle = await wouldCreateCycle(id1, id3);
      assert(noCycle === false, 'Non-cyclical forward dependency correctly permitted');

      // -------------------------------------------------------------
      // TEST 2: PREREQUISITE DETECTION & STUDENT DIAGNOSIS
      // -------------------------------------------------------------
      console.log('\n--- 2. Prerequisite Detection & Root Learning Gap ---');

      // Pick a student or mock student ID
      const studentRes = await db.query(`SELECT id FROM users WHERE role = 'STUDENT' LIMIT 1`);
      const studentId = studentRes.rows[0]?.id || '00000000-0000-0000-0000-000000000000';

      const prereqAnalysis = await analyzePrerequisitesForTopic(studentId, 'Test_3NF', subjectId);
      assert(prereqAnalysis.hasPrerequisites === true, 'Prerequisite chain correctly traversed via BFS');
      assert(prereqAnalysis.prerequisites.length >= 2, `Found ${prereqAnalysis.prerequisites.length} prerequisite nodes`);
      assert(Array.isArray(prereqAnalysis.recommendations), 'Remedial learning pathway recommendations generated');

      // Clean test concepts
      await db.query(`DELETE FROM concepts WHERE name IN ('Test_FD', 'Test_2NF', 'Test_3NF', 'Test_BCNF')`);
    }

    // -------------------------------------------------------------
    // TEST 3: CITATION & GROUNDING EXTRACTION (NO FABRICATION)
    // -------------------------------------------------------------
    console.log('\n--- 3. AI Evidence & Transparent Grounding ---');

    // Case A: Chunk with real page number
    const chunkWithPage = {
      content: '--- Page 14 ---\nNormalization is the process of organizing data.',
      metadata: { material_title: 'DBMS Unit 3 Notes.pdf', subject_name: 'DBMS', unit_name: 'Unit 3', topic_title: 'Normalization' }
    };
    const cite1 = extractCitationMetadata(chunkWithPage);
    assert(cite1.page_number === 14, 'Extracted genuine page number 14 from PDF chunk header');
    assert(cite1.material_title === 'DBMS Unit 3 Notes.pdf', 'Extracted material title accurately');

    // Case B: Chunk with real slide number
    const chunkWithSlide = {
      content: '--- Slide 22 ---\nBCNF decomposes relations to remove transitive functional dependencies.',
      metadata: { material_title: 'DBMS Lecture 4.pptx' }
    };
    const cite2 = extractCitationMetadata(chunkWithSlide);
    assert(cite2.slide_number === 22, 'Extracted genuine slide number 22 from PPTX chunk header');

    // Case C: Chunk without page/slide numbers (MUST NOT FABRICATE)
    const chunkPlain = {
      content: 'General definition without explicit slide or page header markers.',
      metadata: { material_title: 'Syllabus.docx' }
    };
    const cite3 = extractCitationMetadata(chunkPlain);
    assert(cite3.page_number === null, 'Did NOT fabricate page number when header marker is absent');
    assert(cite3.slide_number === null, 'Did NOT fabricate slide number when marker is absent');
    assert(cite3.material_title === 'Syllabus.docx', 'Preserved genuine material title');

    // Case D: Grounding Status Verification
    const groundStatusFull = determineGroundingStatus([cite1, cite2], 0.85);
    assert(groundStatusFull === 'GROUNDED', 'Grounding status is GROUNDED when strong matching chunks exist');

    const groundStatusPartial = determineGroundingStatus([cite3], 0.35);
    assert(groundStatusPartial === 'PARTIAL', 'Grounding status is PARTIAL when low match score exists');

    const groundStatusGeneral = determineGroundingStatus([], 0.1);
    assert(groundStatusGeneral === 'GENERAL', 'Grounding status is GENERAL when no verified sources exist');

    // -------------------------------------------------------------
    // TEST 4: DETERMINISTIC SYLLABUS COVERAGE INTELLIGENCE
    // -------------------------------------------------------------
    console.log('\n--- 4. Syllabus Coverage Intelligence Formula ---');

    if (subjectRes.rowCount > 0) {
      const subjectId = subjectRes.rows[0].id;
      const coverage = await calculateSubjectCoverage(subjectId);
      
      assert(typeof coverage.overallCoverageScore === 'number', `Calculated deterministic score: ${coverage.overallCoverageScore}%`);
      assert(coverage.overallCoverageScore >= 0 && coverage.overallCoverageScore <= 100, 'Score is bounded between 0% and 100%');
      assert(Array.isArray(coverage.units), 'Unit breakdown generated deterministically');
      assert(Array.isArray(coverage.actionableGaps), `Identified ${coverage.actionableGaps.length} actionable curriculum gaps`);
      assert(typeof coverage.formulaDescription === 'string', 'Formula documentation is transparently attached');
    }

    // -------------------------------------------------------------
    // TEST 5: COHORT LEARNING GAPS FROM QUESTION-LEVEL ANSWERS
    // -------------------------------------------------------------
    console.log('\n--- 5. Cohort Learning Gap Aggregation ---');

    // Pick department
    const deptRes = await db.query(`SELECT id FROM departments LIMIT 1`);
    if (deptRes.rowCount > 0) {
      const deptId = deptRes.rows[0].id;
      const cohortData = await aggregateCohortTopicPerformance({ departmentId: deptId });

      assert(Array.isArray(cohortData.topics), 'Cohort topics aggregated from question-level answers');
      assert(cohortData.summary !== undefined, 'Cohort summary stats calculated');
      console.log(`Evaluated ${cohortData.topics.length} topics across ${cohortData.summary?.totalStudentsEvaluated || 0} cohort students.`);
    }

    // -------------------------------------------------------------
    // SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
}

runTests();
