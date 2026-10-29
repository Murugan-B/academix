const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Set up express app using real routes
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/student-resources', require('./routes/studentResourceRoutes'));

async function runTests() {
  console.log('--- STARTING PUBLIC RESOURCE PREVIEW & DOWNLOAD TESTS ---');

  // Start test server on ephemeral port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`[SERVER] Test server listening on ${baseUrl}`);

  try {
    // 1. Get test users
    const publicUserRes = await db.query("SELECT id, name, email, role FROM users WHERE role = 'PUBLIC_USER' LIMIT 1");
    const superAdminRes = await db.query("SELECT id, name, email, role FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1");
    const studentRes = await db.query("SELECT id, name, email, role, department_id, institute_id FROM users WHERE role = 'STUDENT' LIMIT 1");

    if (publicUserRes.rowCount === 0 || superAdminRes.rowCount === 0) {
      throw new Error('Test users missing in database');
    }

    const publicUser = publicUserRes.rows[0];
    const superAdmin = superAdminRes.rows[0];
    const student = studentRes.rows[0];

    const publicToken = jwt.sign({ id: publicUser.id, role: publicUser.role, email: publicUser.email }, process.env.JWT_SECRET || 'secret');
    const superAdminToken = jwt.sign({ id: superAdmin.id, role: superAdmin.role, email: superAdmin.email }, process.env.JWT_SECRET || 'secret');
    const studentToken = jwt.sign({ id: student.id, role: student.role, email: student.email, department_id: student.department_id, institute_id: student.institute_id }, process.env.JWT_SECRET || 'secret');

    console.log(`[AUTH] Test users: PublicUser=${publicUser.id}, SuperAdmin=${superAdmin.id}`);

    // 2. Test Contributing a Public Material with a PDF file
    console.log('\n[TEST 1] Uploading a public material with PDF attachment via /api/public/contribute...');
    const testPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<<>>>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF');

    const form = new FormData();
    form.append('title', 'E2E Automated Test Public Note');
    form.append('description', 'Comprehensive automated test verification note.');
    form.append('tags', 'algorithms,testing');
    form.append('courseCategoryType', 'COMMUNITY_COURSE');
    form.append('newCourseName', 'Automated Testing Hub');
    form.append('file', testPdfBuffer, { filename: 'automated_test_doc.pdf', contentType: 'application/pdf' });

    const uploadRes = await axios.post(`${baseUrl}/api/public/contribute`, form, {
      headers: {
        Authorization: `Bearer ${publicToken}`,
        ...form.getHeaders()
      }
    });

    if (uploadRes.status !== 201) {
      console.error('Upload failed:', uploadRes.data);
      throw new Error(`Expected 201 Created from /contribute, got ${uploadRes.status}`);
    }

    const createdResource = uploadRes.data.resource;
    console.log(`✓ Upload succeeded! Resource ID: ${createdResource.id}, Status: ${createdResource.status}`);
    console.log(`  File Name: ${createdResource.file_name}`);
    console.log(`  Cloudinary Public ID: ${createdResource.cloudinary_public_id}`);

    if (!createdResource.file_url || !createdResource.cloudinary_public_id) {
      throw new Error('Upload failed to populate file_url or cloudinary_public_id!');
    }

    // 3. Test Preview Before Approval
    console.log('\n[TEST 2] Testing preview permissions before approval...');

    // 3a. Uploader preview
    const uploaderPreview = await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/signed-url`, {
      headers: { Authorization: `Bearer ${publicToken}` }
    });
    console.log(`  Uploader preview status: ${uploaderPreview.status}`);
    if (uploaderPreview.status !== 200 || !uploaderPreview.data.url) {
      throw new Error(`Uploader should be able to preview own pending submission!`);
    }
    console.log('✓ Uploader can preview own pending submission.');

    // 3b. Admin preview
    const adminPreview = await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/signed-url`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });
    console.log(`  Admin preview status: ${adminPreview.status}`);
    if (adminPreview.status !== 200 || !adminPreview.data.url) {
      throw new Error(`Admin should be able to preview pending submission!`);
    }
    console.log('✓ Admin can preview pending submission.');

    // 3c. Unauthenticated guest preview (must fail 401)
    let guestPreviewFailed = false;
    try {
      await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/signed-url`);
    } catch (err) {
      if (err.response?.status === 401) {
        guestPreviewFailed = true;
      }
    }
    if (!guestPreviewFailed) {
      throw new Error(`Guest should not be able to preview unapproved material!`);
    }
    console.log('✓ Guest properly denied access to pending submission (HTTP 401).');

    // 4. Approve Resource as Admin
    console.log('\n[TEST 3] Approving resource as Super Admin...');
    const approveRes = await axios.put(`${baseUrl}/api/student-resources/${createdResource.id}/approve`, {}, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    if (approveRes.status !== 200) {
      console.error('Approval failed:', approveRes.data);
      throw new Error(`Expected 200 from approve, got ${approveRes.status}`);
    }
    console.log('✓ Resource approved successfully.');

    // 5. Test Access After Approval (Open and Download)
    console.log('\n[TEST 4] Testing Open and Download for approved public resource...');

    // 5a. Unauthenticated guest signed-url
    const guestApprovedSignedUrl = await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/signed-url`);
    console.log(`  Guest approved signed-url status: ${guestApprovedSignedUrl.status}`);
    if (guestApprovedSignedUrl.status !== 200 || !guestApprovedSignedUrl.data.url) {
      throw new Error('Guest should be able to get signed url for approved public resource!');
    }
    console.log('✓ Guest signed URL generation succeeded.');

    // 5b. Public route alias /api/public/resources/:id/signed-url
    const publicAliasSignedUrl = await axios.get(`${baseUrl}/api/public/resources/${createdResource.id}/signed-url`);
    console.log(`  Public alias signed-url status: ${publicAliasSignedUrl.status}`);
    if (publicAliasSignedUrl.status !== 200) {
      throw new Error('Public alias route failed!');
    }
    console.log('✓ /api/public/resources/:id/signed-url alias succeeded.');

    // 5c. Inline View (Open in Tab) stream
    console.log('\n[TEST 5] Testing inline view stream proxy (/view)...');
    const viewRes = await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/view`, {
      responseType: 'arraybuffer'
    });
    console.log(`  View stream status: ${viewRes.status}`);
    console.log(`  View Content-Type: ${viewRes.headers['content-type']}`);
    console.log(`  View Content-Disposition: ${viewRes.headers['content-disposition']}`);
    if (viewRes.status !== 200 || !viewRes.headers['content-disposition']?.includes('inline')) {
      throw new Error('View endpoint should stream with inline disposition!');
    }
    console.log('✓ Inline view stream proxy returned HTTP 200 with disposition: inline.');

    // 5d. Attachment Download stream
    console.log('\n[TEST 6] Testing download stream proxy (/download)...');
    const downloadRes = await axios.get(`${baseUrl}/api/student-resources/${createdResource.id}/download`, {
      responseType: 'arraybuffer'
    });
    console.log(`  Download stream status: ${downloadRes.status}`);
    console.log(`  Download Content-Type: ${downloadRes.headers['content-type']}`);
    console.log(`  Download Content-Disposition: ${downloadRes.headers['content-disposition']}`);
    if (downloadRes.status !== 200 || !downloadRes.headers['content-disposition']?.includes('attachment')) {
      throw new Error('Download endpoint should stream with attachment disposition!');
    }
    console.log('✓ Download stream proxy returned HTTP 200 with disposition: attachment.');

    // 6. Test Featured Public Resources API
    console.log('\n[TEST 7] Checking /api/public/featured-resources...');
    const featuredRes = await axios.get(`${baseUrl}/api/public/featured-resources`);
    if (featuredRes.status !== 200 || !Array.isArray(featuredRes.data)) {
      throw new Error('Featured resources failed!');
    }
    const foundFeatured = featuredRes.data.find(f => f.id === createdResource.id);
    if (!foundFeatured) {
      throw new Error('Newly approved resource should appear in featured resources!');
    }
    console.log(`✓ Approved resource found in featured resources list (Title: "${foundFeatured.title}").`);

    // 7. Test Isolation: Private Institutional Resources
    console.log('\n[TEST 8] Verifying isolation of private institutional materials...');
    const privateResQuery = await db.query("SELECT id FROM student_resources WHERE is_public = FALSE AND status = 'APPROVED' LIMIT 1");
    if (privateResQuery.rowCount > 0) {
      const privateResId = privateResQuery.rows[0].id;
      let blocked = false;
      try {
        await axios.get(`${baseUrl}/api/student-resources/${privateResId}/signed-url`, {
          headers: { Authorization: `Bearer ${publicToken}` }
        });
      } catch (err) {
        if (err.response?.status === 403) {
          blocked = true;
        }
      }
      if (!blocked) {
        throw new Error(`Public user must be forbidden (403) from accessing private institutional resources!`);
      }
      console.log('✓ Public user successfully blocked from private institutional material (HTTP 403).');
    }

    // Cleanup test resource
    console.log('\n[CLEANUP] Removing test resource...');
    await db.query('DELETE FROM student_resources WHERE id = $1', [createdResource.id]);
    console.log('✓ Test cleanup complete.');

    console.log('\nALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err.message, err.response?.data || '');
  process.exit(1);
});
