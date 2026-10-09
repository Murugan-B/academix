const db = require('../db');
const cloudinary = require('../utils/cloudinary');
const axios = require('axios');
const crypto = require('crypto');
const { getCloudinaryType } = require('../utils/textExtractor');

// Helper: Check if a faculty/mentor is authorized to review a student's resource
async function checkApproverAuthorization(userId, userRole, userDeptId, resource) {
  // 1. Student can NEVER approve/reject
  if (userRole === 'STUDENT') {
    return { authorized: false, reason: 'Students cannot approve or reject resources.' };
  }

  // 2. Prevent self-approval if somehow uploader is the reviewer
  if (resource.uploaded_by === userId) {
    return { authorized: false, reason: 'You cannot approve or reject your own uploaded resource.' };
  }

  // 3. Super Admin & Institute Admin always authorized within institute
  if (userRole === 'SUPER_ADMIN' || userRole === 'INSTITUTE_ADMIN') {
    return { authorized: true, roleLabel: 'Administrator' };
  }

  // 4. HOD of the department
  if (userRole === 'HOD' && userDeptId === resource.department_id) {
    return { authorized: true, roleLabel: 'HOD' };
  }

  // 5. Faculty in the same department (assigned to subject's department)
  if (userRole === 'FACULTY' && userDeptId === resource.department_id) {
    return { authorized: true, roleLabel: 'Faculty' };
  }

  // 6. Assigned Mentor of the student (from mentor_students)
  const mentorCheck = await db.query(
    'SELECT 1 FROM mentor_students WHERE mentor_id = $1 AND student_id = $2',
    [userId, resource.uploaded_by]
  );
  if (mentorCheck.rowCount > 0) {
    return { authorized: true, roleLabel: 'Mentor' };
  }

  return { authorized: false, reason: 'You are not authorized to review resources for this student or subject.' };
}

// 1. CHECK DUPLICATE BEFORE UPLOAD
exports.checkDuplicate = async (req, res) => {
  const { title, topic_id, file_name } = req.body;
  const userId = req.user.id;

  try {
    let duplicateWarnings = [];

    // Check same title by same user
    if (title) {
      const titleRes = await db.query(
        `SELECT id, title, status, created_at 
         FROM student_resources 
         WHERE uploaded_by = $1 AND LOWER(title) = LOWER($2) AND status != 'REJECTED'`,
        [userId, title.trim()]
      );
      if (titleRes.rowCount > 0) {
        duplicateWarnings.push(`You already uploaded a resource with the title "${titleRes.rows[0].title}" (Status: ${titleRes.rows[0].status}).`);
      }
    }

    // Check same file name for this topic
    if (topic_id && file_name) {
      const fileRes = await db.query(
        `SELECT id, title, file_name, status, created_at 
         FROM student_resources 
         WHERE topic_id = $1 AND LOWER(file_name) = LOWER($2) AND status != 'REJECTED'`,
        [topic_id, file_name.trim()]
      );
      if (fileRes.rowCount > 0) {
        duplicateWarnings.push(`A file with name "${file_name}" has already been uploaded for this topic.`);
      }
    }

    res.json({
      isDuplicate: duplicateWarnings.length > 0,
      warnings: duplicateWarnings
    });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] checkDuplicate error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 2. UPLOAD RESOURCE (STUDENT & FACULTY)
exports.uploadResource = async (req, res) => {
  const { title, description, department_id, semester, subject_id, unit_id, lesson_id, topic_id, tags } = req.body;
  const uploaded_by = req.user.id;
  const userRole = req.user.role;
  const userDept = req.user.department_id;

  if (!req.file) {
    return res.status(400).json({ error: 'Please select a document to upload.' });
  }

  if (!title || !subject_id || !unit_id || !lesson_id || !topic_id) {
    return res.status(400).json({ error: 'Title, Subject, Unit, Lesson, and Topic are required.' });
  }

  // Size limit: 15 MB
  if (req.file.size > 15 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size must be less than 15 MB.' });
  }

  const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];
  const fileExt = req.file.originalname.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    return res.status(400).json({ error: 'Unsupported file type. Please upload PDF, DOCX, or PPTX.' });
  }

  try {
    // Validate hierarchy integrity
    const hierarchyRes = await db.query(`
      SELECT t.id as topic_id, l.id as lesson_id, u.id as unit_id, s.id as subject_id, s.department_id, s.semester, s.name as subject_name
      FROM topics t
      JOIN lessons l ON t.lesson_id = l.id
      JOIN units u ON l.unit_id = u.id
      JOIN subjects s ON u.subject_id = s.id
      WHERE t.id = $1 AND l.id = $2 AND u.id = $3 AND s.id = $4
    `, [topic_id, lesson_id, unit_id, subject_id]);

    if (hierarchyRes.rowCount === 0) {
      return res.status(400).json({ error: 'Invalid academic hierarchy selection.' });
    }

    const matchedDeptId = hierarchyRes.rows[0].department_id;
    const matchedSemester = hierarchyRes.rows[0].semester;
    const subjectName = hierarchyRes.rows[0].subject_name;

    // Check department match for students & faculty
    if ((userRole === 'STUDENT' || userRole === 'FACULTY' || userRole === 'HOD') && userDept && userRole !== 'SUPER_ADMIN' && userDept !== matchedDeptId) {
      return res.status(403).json({ error: 'You can only upload resources for subjects in your department.' });
    }

    // Determine source type and approval workflow
    const isFacultyUpload = ['FACULTY', 'HOD', 'INSTITUTE_ADMIN', 'SUPER_ADMIN'].includes(userRole);
    const sourceType = isFacultyUpload ? 'FACULTY' : 'STUDENT';
    const status = isFacultyUpload ? 'APPROVED' : 'PENDING';

    // Parse tags array
    let tagsArray = [];
    if (tags) {
      if (Array.isArray(tags)) {
        tagsArray = tags;
      } else if (typeof tags === 'string') {
        tagsArray = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      }
    }

    // Compute simple file hash
    const fileHash = crypto.createHash('md5').update(req.file.buffer).digest('hex');

    const uniqueFilename = `student_res_${Date.now()}_${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    // Upload to Cloudinary stream
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        type: 'authenticated',
        folder: 'student_resources',
        public_id: uniqueFilename
      },
      async (error, cloudResult) => {
        if (error) {
          console.error('[STUDENT_RESOURCES] Cloudinary upload error:', error.message);
          return res.status(500).json({ error: 'Failed to upload document to storage service.' });
        }

        try {
          const insertRes = await db.query(`
            INSERT INTO student_resources (
              title, description, tags, department_id, semester, subject_id,
              unit_id, lesson_id, topic_id, file_name, file_url,
              cloudinary_public_id, file_type, file_size, file_hash,
              source_type, status, uploaded_by, approved_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
          `, [
            title.trim(),
            description ? description.trim() : null,
            tagsArray,
            matchedDeptId,
            matchedSemester || semester || 1,
            subject_id,
            unit_id,
            lesson_id,
            topic_id,
            req.file.originalname,
            cloudResult.secure_url,
            cloudResult.public_id,
            req.file.mimetype,
            req.file.size,
            fileHash,
            sourceType,
            status,
            uploaded_by,
            isFacultyUpload ? new Date() : null
          ]);

          const savedResource = insertRes.rows[0];

          if (isFacultyUpload) {
            // Trigger text extraction in the background for faculty upload
            if (process.env.AI_PROVIDER === 'local' || process.env.AI_PROVIDER === 'gemini' || process.env.AI_PROVIDER === 'openrouter') {
              try {
                const { extractTextFromMaterial } = require('../utils/textExtractor');

                extractTextFromMaterial({
                  id: savedResource.id,
                  file_url: cloudResult.secure_url,
                  file_name: req.file.originalname,
                  file_type: req.file.mimetype,
                  cloudinary_public_id: cloudResult.public_id
                })
                  .then(({ text }) => {
                    console.log(`[STUDENT_RESOURCES] Text extraction completed for published faculty shared resource ${savedResource.id}`);
                  })
                  .catch(err => {
                    console.warn('[STUDENT_RESOURCES] Background extraction note for faculty shared resource:', err.message);
                  });
              } catch (embErr) {
                console.warn('[STUDENT_RESOURCES] Extraction setup warning for faculty upload:', embErr.message);
              }
            }

            return res.status(201).json({
              message: 'Resource uploaded and published successfully.',
              resource: savedResource
            });
          }

          // If Student upload, dispatch notifications to approvers (Assigned Mentor + Department Faculty)
          try {
            const studentName = req.user.name || 'A student';
            const notifTitle = 'New Student Resource Pending Approval';
            const notifMessage = `${studentName} submitted a new resource "${title.trim()}" for ${subjectName}. Please review and approve.`;

            // 1. Notify student's mentor
            const mentorRes = await db.query(
              'SELECT mentor_id FROM mentor_students WHERE student_id = $1',
              [uploaded_by]
            );
            for (const row of mentorRes.rows) {
              await db.query(`
                INSERT INTO notifications 
                (title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id, target_department_id)
                VALUES ($1, $2, $3, 'STUDENT', 'SPECIFIC_FACULTY', $4, $5, $6)
              `, [notifTitle, notifMessage, uploaded_by, row.mentor_id, req.user.institute_id, matchedDeptId]);
            }

            // 2. Notify department faculty
            await db.query(`
              INSERT INTO notifications 
              (title, message, sender_id, sender_role, recipient_type, institute_id, target_department_id)
              VALUES ($1, $2, $3, 'STUDENT', 'SPECIFIC_DEPARTMENT_FACULTY', $4, $5)
            `, [notifTitle, notifMessage, uploaded_by, req.user.institute_id, matchedDeptId]);
          } catch (notifErr) {
            console.warn('[STUDENT_RESOURCES] Approver notification dispatch warning:', notifErr.message);
          }

          return res.status(201).json({
            message: 'Resource uploaded successfully and submitted for faculty/mentor approval.',
            resource: savedResource
          });
        } catch (dbErr) {
          console.error('[STUDENT_RESOURCES] DB Insert error:', dbErr.message);
          return res.status(500).json({ error: dbErr.message });
        }
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('[STUDENT_RESOURCES] uploadResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 3. GET APPROVED RESOURCES (STUDENTS & FACULTY)
exports.getApprovedResources = async (req, res) => {
  const { search, subject_id, semester, unit_id, topic_id, file_type, source_type, source, sort } = req.query;
  const userDept = req.user.department_id;
  const userRole = req.user.role;

  try {
    let query = `
      SELECT 
        sr.id, sr.title, sr.description, sr.tags, sr.semester,
        sr.file_name, sr.file_url, sr.file_type, sr.file_size,
        sr.source_type, sr.status, sr.is_public, sr.created_at, sr.updated_at,
        sr.approved_at, sr.approved_by,
        s.id as subject_id, s.name as subject_name, s.code as subject_code,
        u.id as unit_id, u.title as unit_title, u.unit_number,
        l.id as lesson_id, l.title as lesson_title, l.lesson_number,
        t.id as topic_id, t.title as topic_title, t.topic_number,
        d.id as department_id, d.name as department_name,
        up.id as uploader_id, up.name as uploader_name, up.role as uploader_role, 
        up.designation as uploader_designation, up.roll_number as uploader_roll_number,
        ap.name as approver_name, ap.role as approver_role, ap.designation as approver_designation
      FROM student_resources sr
      JOIN subjects s ON sr.subject_id = s.id
      JOIN units u ON sr.unit_id = u.id
      JOIN lessons l ON sr.lesson_id = l.id
      JOIN topics t ON sr.topic_id = t.id
      JOIN departments d ON sr.department_id = d.id
      JOIN users up ON sr.uploaded_by = up.id
      LEFT JOIN users ap ON sr.approved_by = ap.id
      WHERE sr.status = 'APPROVED'
    `;

    const params = [];

    // STRICT ISOLATION: PUBLIC_USER can ONLY see explicitly public approved resources
    if (userRole === 'PUBLIC_USER') {
      query += ` AND sr.is_public = TRUE`;
    } else if (userDept && userRole !== 'SUPER_ADMIN' && userRole !== 'INSTITUTE_ADMIN') {
      // Institutional students/faculty see their department resources + public resources
      params.push(userDept);
      query += ` AND (sr.department_id = $${params.length} OR sr.is_public = TRUE)`;
    }

    // Filter by source_type (FACULTY / STUDENT)
    const effectiveSource = (source_type || source || '').trim().toUpperCase();
    if (effectiveSource && (effectiveSource === 'FACULTY' || effectiveSource === 'STUDENT')) {
      params.push(effectiveSource);
      query += ` AND sr.source_type = $${params.length}`;
    }

    if (subject_id) {
      params.push(subject_id);
      query += ` AND sr.subject_id = $${params.length}`;
    }

    if (semester) {
      params.push(parseInt(semester, 10));
      query += ` AND sr.semester = $${params.length}`;
    }

    if (unit_id) {
      params.push(unit_id);
      query += ` AND sr.unit_id = $${params.length}`;
    }

    if (topic_id) {
      params.push(topic_id);
      query += ` AND sr.topic_id = $${params.length}`;
    }

    if (file_type) {
      params.push(`%${file_type.toLowerCase()}%`);
      query += ` AND (LOWER(sr.file_name) LIKE $${params.length} OR LOWER(sr.file_type) LIKE $${params.length})`;
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      const searchParamIdx = params.length;
      query += ` AND (
        LOWER(sr.title) LIKE $${searchParamIdx} OR
        LOWER(sr.description) LIKE $${searchParamIdx} OR
        LOWER(s.name) LIKE $${searchParamIdx} OR
        LOWER(t.title) LIKE $${searchParamIdx} OR
        LOWER(up.name) LIKE $${searchParamIdx} OR
        EXISTS (SELECT 1 FROM unnest(sr.tags) tag WHERE LOWER(tag) LIKE $${searchParamIdx})
      )`;
    }

    // Sort order
    if (sort === 'oldest') {
      query += ` ORDER BY sr.approved_at ASC, sr.created_at ASC`;
    } else if (sort === 'title') {
      query += ` ORDER BY sr.title ASC`;
    } else {
      query += ` ORDER BY sr.approved_at DESC NULLS LAST, sr.created_at DESC`;
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[STUDENT_RESOURCES] getApprovedResources error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 4. GET MY SUBMISSIONS / UPLOADS (STUDENT)
exports.getMyUploads = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await db.query(`
      SELECT 
        sr.*,
        s.name as subject_name, s.code as subject_code,
        u.title as unit_title, u.unit_number,
        l.title as lesson_title, l.lesson_number,
        t.title as topic_title, t.topic_number,
        ap.name as approver_name, ap.role as approver_role,
        rp.name as rejector_name, rp.role as rejector_role
      FROM student_resources sr
      JOIN subjects s ON sr.subject_id = s.id
      JOIN units u ON sr.unit_id = u.id
      JOIN lessons l ON sr.lesson_id = l.id
      JOIN topics t ON sr.topic_id = t.id
      LEFT JOIN users ap ON sr.approved_by = ap.id
      LEFT JOIN users rp ON sr.rejected_by = rp.id
      WHERE sr.uploaded_by = $1
      ORDER BY sr.created_at DESC
    `, [userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('[STUDENT_RESOURCES] getMyUploads error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 5. GET PENDING / HISTORICAL APPROVALS (FACULTY, HOD, ADMIN)
exports.getPendingApprovals = async (req, res) => {
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDeptId = req.user.department_id;
  const { status = 'PENDING' } = req.query;

  try {
    let query = `
      SELECT 
        sr.*,
        s.name as subject_name, s.code as subject_code,
        u.title as unit_title, u.unit_number,
        l.title as lesson_title, l.lesson_number,
        t.title as topic_title, t.topic_number,
        d.name as department_name,
        up.name as uploader_name, up.email as uploader_email, up.roll_number as uploader_roll_number,
        ap.name as approver_name, rp.name as rejector_name,
        EXISTS (SELECT 1 FROM mentor_students ms WHERE ms.mentor_id = $1 AND ms.student_id = sr.uploaded_by) as is_my_mentee
      FROM student_resources sr
      JOIN subjects s ON sr.subject_id = s.id
      JOIN units u ON sr.unit_id = u.id
      JOIN lessons l ON sr.lesson_id = l.id
      JOIN topics t ON sr.topic_id = t.id
      JOIN departments d ON sr.department_id = d.id
      JOIN users up ON sr.uploaded_by = up.id
      LEFT JOIN users ap ON sr.approved_by = ap.id
      LEFT JOIN users rp ON sr.rejected_by = rp.id
      WHERE sr.uploaded_by != $1
    `;

    const params = [userId];

    // Status filter
    if (status && status !== 'ALL') {
      params.push(status.toUpperCase());
      query += ` AND sr.status = $${params.length}`;
    }

    // Role-based scope
    if (userRole === 'SUPER_ADMIN' || userRole === 'INSTITUTE_ADMIN') {
      // Sees all in institute
    } else if (userRole === 'HOD') {
      params.push(userDeptId);
      query += ` AND sr.department_id = $${params.length}`;
    } else if (userRole === 'FACULTY') {
      // Faculty can review resources for subjects in their department OR from their mentees
      params.push(userDeptId);
      const deptParamIdx = params.length;
      query += ` AND (
        sr.department_id = $${deptParamIdx} OR 
        sr.uploaded_by IN (SELECT student_id FROM mentor_students WHERE mentor_id = $1)
      )`;
    } else {
      return res.status(403).json({ error: 'Only faculty and administrators can access approvals.' });
    }

    query += ` ORDER BY sr.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[STUDENT_RESOURCES] getPendingApprovals error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 6. APPROVE RESOURCE
exports.approveResource = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDeptId = req.user.department_id;

  try {
    const resResult = await db.query(`
      SELECT sr.*, s.name as subject_name, up.name as uploader_name
      FROM student_resources sr
      JOIN subjects s ON sr.subject_id = s.id
      JOIN users up ON sr.uploaded_by = up.id
      WHERE sr.id = $1
    `, [id]);

    if (resResult.rowCount === 0) {
      return res.status(404).json({ error: 'Student resource not found.' });
    }

    const resource = resResult.rows[0];

    // Authorize approver
    const authCheck = await checkApproverAuthorization(userId, userRole, userDeptId, resource);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.reason });
    }

    // Update student_resources table
    const updateRes = await db.query(`
      UPDATE student_resources
      SET status = 'APPROVED',
          approved_by = $1,
          approved_at = NOW(),
          rejected_by = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [userId, id]);

    const approvedResource = updateRes.rows[0];

    // Trigger text extraction in the background
    if (process.env.AI_PROVIDER === 'local' || process.env.AI_PROVIDER === 'gemini' || process.env.AI_PROVIDER === 'openrouter') {
      try {
        const { extractTextFromMaterial } = require('../utils/textExtractor');

        extractTextFromMaterial({
          id: approvedResource.id,
          file_url: resource.file_url,
          file_name: resource.file_name,
          file_type: resource.file_type,
          cloudinary_public_id: resource.cloudinary_public_id
        })
          .then(({ text }) => {
            console.log(`[STUDENT_RESOURCES] Text extraction completed for approved shared resource ${id}`);
          })
          .catch(err => {
            console.warn('[STUDENT_RESOURCES] Background extraction note:', err.message);
          });
      } catch (embErr) {
        console.warn('[STUDENT_RESOURCES] Extraction setup warning:', embErr.message);
      }
    }

    // Send notification to the student
    try {
      const approverName = req.user.name || 'Your faculty mentor';
      const notifTitle = 'Resource Approved! 🎉';
      const notifMessage = `Your shared resource "${resource.title}" for ${resource.subject_name} has been approved by ${approverName} and is now available to students.`;

      await db.query(`
        INSERT INTO notifications 
        (title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id, target_department_id)
        VALUES ($1, $2, $3, $4, 'SPECIFIC_STUDENT', $5, $6, $7)
      `, [notifTitle, notifMessage, userId, userRole, resource.uploaded_by, req.user.institute_id, resource.department_id]);
    } catch (notifErr) {
      console.warn('[STUDENT_RESOURCES] Notification error:', notifErr.message);
    }

    res.json({
      message: 'Student resource approved successfully and published to students.',
      resource: approvedResource
    });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] approveResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 7. REJECT RESOURCE
exports.rejectResource = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDeptId = req.user.department_id;

  try {
    const resResult = await db.query(`
      SELECT sr.*, s.name as subject_name
      FROM student_resources sr
      JOIN subjects s ON sr.subject_id = s.id
      WHERE sr.id = $1
    `, [id]);

    if (resResult.rowCount === 0) {
      return res.status(404).json({ error: 'Student resource not found.' });
    }

    const resource = resResult.rows[0];

    // Authorize approver
    const authCheck = await checkApproverAuthorization(userId, userRole, userDeptId, resource);
    if (!authCheck.authorized) {
      return res.status(403).json({ error: authCheck.reason });
    }

    // Update student_resources table
    const updateRes = await db.query(`
      UPDATE student_resources
      SET status = 'REJECTED',
          rejected_by = $1,
          rejected_at = NOW(),
          rejection_reason = $2,
          approved_by = NULL,
          approved_at = NULL,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [userId, reason ? reason.trim() : 'Does not meet departmental quality criteria.', id]);

    const rejectedResource = updateRes.rows[0];

    // Send rejection notification to the student
    try {
      const rejectorName = req.user.name || 'Faculty reviewer';
      const notifTitle = 'Resource Submission Update';
      const reasonText = reason && reason.trim() ? ` Reason: "${reason.trim()}"` : '';
      const notifMessage = `Your resource submission "${resource.title}" for ${resource.subject_name} was not approved.${reasonText}`;

      await db.query(`
        INSERT INTO notifications 
        (title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id, target_department_id)
        VALUES ($1, $2, $3, $4, 'SPECIFIC_STUDENT', $5, $6, $7)
      `, [notifTitle, notifMessage, userId, userRole, resource.uploaded_by, req.user.institute_id, resource.department_id]);
    } catch (notifErr) {
      console.warn('[STUDENT_RESOURCES] Rejection notification error:', notifErr.message);
    }

    res.json({
      message: 'Student resource has been rejected.',
      resource: rejectedResource
    });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] rejectResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 8. SIGNED URL FOR PREVIEW & DOWNLOAD
exports.getSignedUrl = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDept = req.user.department_id;

  try {
    const result = await db.query('SELECT * FROM student_resources WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const resource = result.rows[0];

    // Check visibility permissions
    if (resource.status !== 'APPROVED') {
      // Only uploader or authorized approver can preview pending/rejected resources
      if (resource.uploaded_by !== userId) {
        const authCheck = await checkApproverAuthorization(userId, userRole, userDept, resource);
        if (!authCheck.authorized) {
          return res.status(403).json({ error: 'Access denied. This resource has not been approved.' });
        }
      }
    } else {
      // If approved, verify public flag or institutional membership
      if (!resource.is_public) {
        if (userRole === 'PUBLIC_USER') {
          return res.status(403).json({ error: 'Access denied: This resource is restricted to registered institute members.' });
        }
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'INSTITUTE_ADMIN' && userDept && userDept !== resource.department_id) {
          return res.status(403).json({ error: 'Access denied: Resource belongs to another department.' });
        }
      }
    }

    let url = resource.file_url;
    if (url.includes('/authenticated/') || resource.cloudinary_public_id) {
      const options = {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
      };
      if (req.query.download === 'true') {
        options.attachment = true;
      }
      url = cloudinary.utils.private_download_url(resource.cloudinary_public_id, '', options);
    } else {
      if (req.query.download === 'true') {
        const filename = encodeURIComponent(resource.file_name);
        url = url.replace('/upload/', `/upload/fl_attachment:${filename}/`);
      }
    }

    res.json({ url, file_name: resource.file_name, file_type: resource.file_type });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] getSignedUrl error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 9. STREAM PROXY FOR INLINE VIEW & DOWNLOAD
async function handleResourceStream(req, res, disposition) {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDept = req.user.department_id;

  try {
    const result = await db.query('SELECT * FROM student_resources WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Resource not found' });
    const resource = result.rows[0];

    // Authorization check
    if (resource.status !== 'APPROVED') {
      if (resource.uploaded_by !== userId) {
        const authCheck = await checkApproverAuthorization(userId, userRole, userDept, resource);
        if (!authCheck.authorized) {
          return res.status(403).json({ error: 'Access denied: Resource has not been approved.' });
        }
      }
    } else {
      if (!resource.is_public) {
        if (userRole === 'PUBLIC_USER') {
          return res.status(403).json({ error: 'Access denied: This resource is restricted to registered institute members.' });
        }
        if (userRole !== 'SUPER_ADMIN' && userRole !== 'INSTITUTE_ADMIN' && userDept && userDept !== resource.department_id) {
          return res.status(403).json({ error: 'Access denied: Resource belongs to another department.' });
        }
      }
    }

    const cloudinaryType = getCloudinaryType(resource.file_url);
    let fetchUrl;
    if (cloudinaryType === 'authenticated') {
      if (!resource.cloudinary_public_id) {
        return res.status(502).json({ error: 'Resource has no stored Cloudinary reference.' });
      }
      fetchUrl = cloudinary.utils.private_download_url(resource.cloudinary_public_id, '', {
        resource_type: 'raw',
        type: 'authenticated',
      });
    } else {
      fetchUrl = resource.file_url;
    }

    const axiosRes = await axios.get(fetchUrl, {
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 30000,
    });

    res.setHeader('Content-Type', resource.file_type || 'application/octet-stream');
    const filename = encodeURIComponent(resource.file_name);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    if (axiosRes.headers['content-length']) {
      res.setHeader('Content-Length', axiosRes.headers['content-length']);
    }

    axiosRes.data.pipe(res);
  } catch (err) {
    console.error('[STUDENT_RESOURCES] Stream error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

exports.viewResource = (req, res) => handleResourceStream(req, res, 'inline');
exports.downloadResource = (req, res) => handleResourceStream(req, res, 'attachment');

// 10. TOGGLE PUBLIC STATUS (FACULTY, HOD, ADMIN)
exports.togglePublicStatus = async (req, res) => {
  const { id } = req.params;
  const { is_public } = req.body;
  const userRole = req.user.role;
  const userDept = req.user.department_id;

  try {
    const resResult = await db.query('SELECT * FROM student_resources WHERE id = $1', [id]);
    if (resResult.rowCount === 0) {
      return res.status(404).json({ error: 'Student resource not found.' });
    }
    const resource = resResult.rows[0];

    if (!['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'HOD', 'FACULTY'].includes(userRole)) {
      return res.status(403).json({ error: 'Only faculty and administrators can modify public resource visibility.' });
    }

    if ((userRole === 'HOD' || userRole === 'FACULTY') && userDept !== resource.department_id) {
      return res.status(403).json({ error: 'You are not authorized to modify resources from another department.' });
    }

    const newPublicStatus = typeof is_public === 'boolean' ? is_public : !resource.is_public;

    const updateRes = await db.query(
      `UPDATE student_resources SET is_public = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [newPublicStatus, id]
    );

    res.json({
      message: `Resource is now ${newPublicStatus ? 'publicly accessible' : 'restricted to institute members'}.`,
      resource: updateRes.rows[0]
    });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] togglePublicStatus error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

// 10. DELETE RESOURCE
exports.deleteResource = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;
  const userDept = req.user.department_id;

  try {
    const result = await db.query('SELECT * FROM student_resources WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Resource not found.' });
    }

    const resource = result.rows[0];

    // Permission check
    const isOwner = resource.uploaded_by === userId;
    const isDeptHod = userRole === 'HOD' && userDept === resource.department_id;
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'INSTITUTE_ADMIN';

    if (!isOwner && !isDeptHod && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this resource.' });
    }

    // Delete linked material if any
    if (resource.material_id) {
      await db.query('DELETE FROM materials WHERE id = $1', [resource.material_id]);
    }

    // Delete from Cloudinary if stored
    if (resource.cloudinary_public_id) {
      try {
        await cloudinary.uploader.destroy(resource.cloudinary_public_id, {
          resource_type: 'raw',
          type: getCloudinaryType(resource.file_url)
        });
      } catch (cloudErr) {
        console.warn('[STUDENT_RESOURCES] Cloudinary deletion cleanup note:', cloudErr.message);
      }
    }

    await db.query('DELETE FROM student_resources WHERE id = $1', [id]);

    res.json({ message: 'Resource deleted successfully.' });
  } catch (err) {
    console.error('[STUDENT_RESOURCES] deleteResource error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
