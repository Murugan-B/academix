const db = require('./db');
const studentResourceController = require('./controllers/studentResourceController');
const publicEcosystemController = require('./controllers/publicEcosystemController');

function createMockReqRes({ user, body = {}, query = {}, params = {}, file = null }) {
  const req = {
    user,
    body,
    query,
    params,
    file,
    headers: {}
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: function (code) {
      statusCode = code;
      return this;
    },
    json: function (data) {
      responseData = data;
      return this;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData
  };

  return { req, res };
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PUBLIC MATERIAL APPROVAL WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  try {
    // 1. Verify existing sample data preservation
    console.log('🔹 Test 1: Verifying existing database records (SAMPLE folder & TEST materials)...');
    const existingFolders = await db.query(`SELECT id, name, created_by FROM public_courses WHERE name ILIKE 'SAMPLE'`);
    if (existingFolders.rowCount === 0) {
      throw new Error('Expected existing SAMPLE folder to be preserved, but none found!');
    }
    const sampleFolder = existingFolders.rows[0];
    console.log(`   ✅ Preserved Folder: ID=${sampleFolder.id}, Name=${sampleFolder.name}`);

    const existingMaterials = await db.query(
      `SELECT id, title, status, is_public, public_course_id FROM student_resources WHERE public_course_id = $1`,
      [sampleFolder.id]
    );
    console.log(`   ✅ Found ${existingMaterials.rowCount} existing material(s) linked to SAMPLE folder.`);
    existingMaterials.rows.forEach(m => {
      console.log(`      - Material ID=${m.id}, Title="${m.title}", Status=${m.status}, is_public=${m.is_public}`);
    });

    // 2. Identify or create test users for RBAC testing
    console.log('\n🔹 Test 2: Setting up test personas (Public User, Student, Faculty, Admin)...');
    const publicUserRes = await db.query(`SELECT id, role, email, name FROM users WHERE role = 'PUBLIC_USER' LIMIT 1`);
    const studentUserRes = await db.query(`SELECT id, role, email, name, department_id FROM users WHERE role = 'STUDENT' LIMIT 1`);
    const facultyUserRes = await db.query(`SELECT id, role, email, name, department_id FROM users WHERE role = 'FACULTY' LIMIT 1`);
    const adminUserRes = await db.query(`SELECT id, role, email, name, department_id FROM users WHERE role IN ('SUPER_ADMIN', 'INSTITUTE_ADMIN') LIMIT 1`);

    const publicUser = publicUserRes.rows[0] || { id: sampleFolder.created_by, role: 'PUBLIC_USER', name: 'Public Contributor' };
    const studentUser = studentUserRes.rows[0] || { id: '00000000-0000-0000-0000-000000000001', role: 'STUDENT', name: 'Student Test' };
    const facultyUser = facultyUserRes.rows[0] || { id: '00000000-0000-0000-0000-000000000002', role: 'FACULTY', name: 'Faculty Reviewer' };
    const adminUser = adminUserRes.rows[0] || { id: '00000000-0000-0000-0000-000000000003', role: 'SUPER_ADMIN', name: 'Super Admin' };

    console.log(`   - Public User: ${publicUser.name} (${publicUser.role})`);
    console.log(`   - Faculty Reviewer: ${facultyUser.name} (${facultyUser.role})`);
    console.log(`   - Admin: ${adminUser.name} (${adminUser.role})`);

    // 3. Test Public User Contribution (Pending Material)
    console.log('\n🔹 Test 3: Public User submits an academic YouTube lecture to SAMPLE folder...');
    const { req: contribReq, res: contribRes } = createMockReqRes({
      user: publicUser,
      body: {
        title: 'Complete Guide to Distributed Systems & Consensus',
        description: 'Comprehensive video lecture on Paxos and Raft consensus algorithms.',
        tags: ['Distributed Systems', 'Consensus', 'Raft'],
        courseCategoryType: 'COMMUNITY_COURSE',
        publicCourseId: sampleFolder.id,
        resourceType: 'YOUTUBE',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }
    });

    await publicEcosystemController.contributeMaterial(contribReq, contribRes);
    const contribStatusCode = contribRes.getStatusCode();
    const contribData = contribRes.getData();
    if (contribStatusCode !== 201) {
      throw new Error(`Public contribution failed with status ${contribStatusCode}: ${JSON.stringify(contribData)}`);
    }
    const testMaterialId = contribData.resource.id;
    console.log(`   ✅ Contribution submitted successfully! Material ID: ${testMaterialId}, Status: ${contribData.resource.status}`);

    // 4. Test Public Course Folders query BEFORE approval
    console.log('\n🔹 Test 4: Checking Public Course Folder counts before approval...');
    const { req: coursesReq1, res: coursesRes1 } = createMockReqRes({
      query: { query: 'SAMPLE' }
    });
    await publicEcosystemController.getPublicCourses(coursesReq1, coursesRes1);
    const coursesBefore = coursesRes1.getData();
    const folderBefore = coursesBefore.find(c => c.id === sampleFolder.id);
    console.log(`   ✅ Folder counts before approval: resource_count=${folderBefore?.resource_count}, pending_count=${folderBefore?.pending_count}`);
    if (Number(folderBefore?.pending_count) < 1) {
      throw new Error(`Expected pending_count >= 1, but got ${folderBefore?.pending_count}`);
    }

    // 5. Test Admin/Faculty Review Queue includes the pending public course resource
    console.log('\n🔹 Test 5: Faculty/Admin fetches pending approvals queue...');
    const { req: queueReq, res: queueRes } = createMockReqRes({
      user: facultyUser,
      query: { status: 'PENDING' }
    });
    await studentResourceController.getPendingApprovals(queueReq, queueRes);
    const pendingList = queueRes.getData();
    const pendingSubmission = pendingList.find(item => item.id === testMaterialId);
    if (!pendingSubmission) {
      throw new Error(`Pending public course submission ${testMaterialId} NOT found in faculty approval queue!`);
    }
    console.log(`   ✅ Pending submission found in queue: Title="${pendingSubmission.title}", Course="${pendingSubmission.public_course_name}", Contributor="${pendingSubmission.uploader_name}"`);

    // 6. Test RBAC: Public User or Student CANNOT approve their own or other submissions
    console.log('\n🔹 Test 6: Testing RBAC enforcement (Public User & Student self-approval blocked)...');
    const { req: unauthReq1, res: unauthRes1 } = createMockReqRes({
      user: publicUser,
      params: { id: testMaterialId }
    });
    await studentResourceController.approveResource(unauthReq1, unauthRes1);
    if (unauthRes1.getStatusCode() !== 403) {
      throw new Error(`Expected 403 Forbidden for Public User approval attempt, got ${unauthRes1.getStatusCode()}`);
    }
    console.log(`   ✅ Public User approval blocked with 403: "${unauthRes1.getData()?.error}"`);

    const { req: unauthReq2, res: unauthRes2 } = createMockReqRes({
      user: studentUser,
      params: { id: testMaterialId }
    });
    await studentResourceController.approveResource(unauthReq2, unauthRes2);
    if (unauthRes2.getStatusCode() !== 403) {
      throw new Error(`Expected 403 Forbidden for Student approval attempt, got ${unauthRes2.getStatusCode()}`);
    }
    console.log(`   ✅ Student approval blocked with 403: "${unauthRes2.getData()?.error}"`);

    // 7. Test Authorized Faculty / Admin Approves Material
    console.log('\n🔹 Test 7: Authorized Faculty/Admin approves the resource...');
    const { req: approveReq, res: approveRes } = createMockReqRes({
      user: facultyUser,
      params: { id: testMaterialId }
    });
    await studentResourceController.approveResource(approveReq, approveRes);
    if (approveRes.getStatusCode() !== 200) {
      throw new Error(`Approval failed with status ${approveRes.getStatusCode()}: ${JSON.stringify(approveRes.getData())}`);
    }
    console.log(`   ✅ Resource approved successfully: "${approveRes.getData()?.title}" by ${facultyUser.name}`);

    // 8. Verify status updated to APPROVED in DB
    console.log('\n🔹 Test 8: Verifying DB status & approval metadata...');
    const checkDb = await db.query(`SELECT id, status, approved_by, approved_at FROM student_resources WHERE id = $1`, [testMaterialId]);
    const updatedRecord = checkDb.rows[0];
    if (updatedRecord.status !== 'APPROVED' || !updatedRecord.approved_by) {
      throw new Error(`Expected status 'APPROVED' and approved_by set, got: ${JSON.stringify(updatedRecord)}`);
    }
    console.log(`   ✅ DB verified: status=${updatedRecord.status}, approved_by=${updatedRecord.approved_by}, approved_at=${updatedRecord.approved_at}`);

    // 9. Test Public Course Folders query AFTER approval (Count immediately incremented)
    console.log('\n🔹 Test 9: Checking Public Course Folder counts AFTER approval...');
    const { req: coursesReq2, res: coursesRes2 } = createMockReqRes({
      query: { query: 'SAMPLE' }
    });
    await publicEcosystemController.getPublicCourses(coursesReq2, coursesRes2);
    const coursesAfter = coursesRes2.getData();
    const folderAfter = coursesAfter.find(c => c.id === sampleFolder.id);
    console.log(`   ✅ Folder counts after approval: resource_count=${folderAfter?.resource_count}, pending_count=${folderAfter?.pending_count}`);
    if (Number(folderAfter?.resource_count) <= Number(folderBefore?.resource_count)) {
      throw new Error(`Expected resource_count to increment from ${folderBefore?.resource_count}, but got ${folderAfter?.resource_count}`);
    }

    // 10. Test Public Course Details endpoint returns the newly approved material
    console.log('\n🔹 Test 10: Fetching public course details and resources list...');
    const { req: detailsReq, res: detailsRes } = createMockReqRes({
      params: { id: sampleFolder.id }
    });
    await publicEcosystemController.getPublicCourseDetails(detailsReq, detailsRes);
    const detailsData = detailsRes.getData();
    const approvedInFolder = detailsData?.resources?.find(r => r.id === testMaterialId);
    if (!approvedInFolder) {
      throw new Error(`Approved resource ${testMaterialId} NOT listed in public course folder resources!`);
    }
    console.log(`   ✅ Approved resource is visible in folder: Title="${approvedInFolder.title}", Provider="${approvedInFolder.external_provider}"`);

    // 11. Test Rejection Workflow with Feedback
    console.log('\n🔹 Test 11: Testing submission rejection workflow with feedback...');
    // Create another submission to test rejection
    const { req: rejSubmitReq, res: rejSubmitRes } = createMockReqRes({
      user: publicUser,
      body: {
        title: 'Draft Incomplete Notes',
        description: 'Rough notes.',
        courseCategoryType: 'COMMUNITY_COURSE',
        publicCourseId: sampleFolder.id,
        resourceType: 'YOUTUBE',
        externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
      }
    });
    await publicEcosystemController.contributeMaterial(rejSubmitReq, rejSubmitRes);
    const rejMaterialId = rejSubmitRes.getData()?.resource?.id;

    const { req: rejectReq, res: rejectRes } = createMockReqRes({
      user: facultyUser,
      params: { id: rejMaterialId },
      body: { reason: 'Missing diagrams and detailed explanations.' }
    });
    await studentResourceController.rejectResource(rejectReq, rejectRes);
    if (rejectRes.getStatusCode() !== 200) {
      throw new Error(`Rejection failed with status ${rejectRes.getStatusCode()}`);
    }
    console.log(`   ✅ Resource rejected with feedback reason: "${rejectRes.getData()?.rejection_reason}"`);

    // Clean up test items created during this specific test run
    await db.query(`DELETE FROM student_resources WHERE id IN ($1, $2)`, [testMaterialId, rejMaterialId]);
    console.log('\n🧹 Cleaned up temporary test-run submissions. Original user sample data remains intact.');

    console.log('\n================================================================');
    console.log('🎉 ALL 11 TESTS PASSED SUCCESSFULLY!');
    console.log('================================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    process.exit(1);
  }
}

runTests();
