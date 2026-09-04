const db = require('../db');
const cloudinary = require('../utils/cloudinary');
const axios = require('axios');
const https = require('https');
const http = require('http');
const { getCloudinaryType } = require('../utils/textExtractor');

// --- HIERARCHY VALIDATION MIDDLEWARE ---
exports.validateHierarchy = async (req, res, next) => {
  const { subjectId, unitId, lessonId, topicId } = req.params;
  const userDepartment = req.user.department_id;
  
  try {
    if (subjectId) {
      const subRes = await db.query('SELECT department_id FROM subjects WHERE id = $1', [subjectId]);
      if (subRes.rowCount === 0) return res.status(404).json({ error: 'Subject not found' });
      if (subRes.rows[0].department_id !== userDepartment) {
        return res.status(403).json({ error: 'Access denied: Subject belongs to another department' });
      }
    }
    
    if (unitId) {
      const unitRes = await db.query(
        'SELECT s.department_id FROM units u JOIN subjects s ON u.subject_id = s.id WHERE u.id = $1',
        [unitId]
      );
      if (unitRes.rowCount === 0) return res.status(404).json({ error: 'Unit not found' });
      if (unitRes.rows[0].department_id !== userDepartment) {
         return res.status(403).json({ error: 'Access denied: Unit belongs to another department' });
      }
    }

    if (lessonId) {
      const lessRes = await db.query(
        'SELECT s.department_id FROM lessons l JOIN units u ON l.unit_id = u.id JOIN subjects s ON u.subject_id = s.id WHERE l.id = $1',
        [lessonId]
      );
      if (lessRes.rowCount === 0) return res.status(404).json({ error: 'Lesson not found' });
      if (lessRes.rows[0].department_id !== userDepartment) {
         return res.status(403).json({ error: 'Access denied: Lesson belongs to another department' });
      }
    }

    if (topicId) {
      const topRes = await db.query(
        'SELECT s.department_id FROM topics t JOIN lessons l ON t.lesson_id = l.id JOIN units u ON l.unit_id = u.id JOIN subjects s ON u.subject_id = s.id WHERE t.id = $1',
        [topicId]
      );
      if (topRes.rowCount === 0) return res.status(404).json({ error: 'Topic not found' });
      if (topRes.rows[0].department_id !== userDepartment) {
         return res.status(403).json({ error: 'Access denied: Topic belongs to another department' });
      }
    }

    if (req.params.materialId) {
      const matRes = await db.query(
        'SELECT s.department_id FROM materials m JOIN topics t ON m.topic_id = t.id JOIN lessons l ON t.lesson_id = l.id JOIN units u ON l.unit_id = u.id JOIN subjects s ON u.subject_id = s.id WHERE m.id = $1',
        [req.params.materialId]
      );
      if (matRes.rowCount === 0) return res.status(404).json({ error: 'Material not found' });
      if (matRes.rows[0].department_id !== userDepartment) {
         return res.status(403).json({ error: 'Access denied: Material belongs to another department' });
      }
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- UNITS ---
exports.getUnits = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM units WHERE subject_id = $1 ORDER BY unit_number ASC', [req.params.subjectId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createUnit = async (req, res) => {
  const { unit_number, title, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO units (subject_id, unit_number, title, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.subjectId, unit_number, title, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateUnit = async (req, res) => {
  const { unit_number, title, description } = req.body;
  try {
    const result = await db.query(
      'UPDATE units SET unit_number = $1, title = $2, description = $3 WHERE id = $4 RETURNING *',
      [unit_number, title, description, req.params.unitId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUnit = async (req, res) => {
  try {
    await db.query('DELETE FROM units WHERE id = $1', [req.params.unitId]);
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- LESSONS ---
exports.getLessons = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM lessons WHERE unit_id = $1 ORDER BY lesson_number ASC', [req.params.unitId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createLesson = async (req, res) => {
  const { lesson_number, title, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO lessons (unit_id, lesson_number, title, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.unitId, lesson_number, title, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateLesson = async (req, res) => {
  const { lesson_number, title, description } = req.body;
  try {
    const result = await db.query(
      'UPDATE lessons SET lesson_number = $1, title = $2, description = $3 WHERE id = $4 RETURNING *',
      [lesson_number, title, description, req.params.lessonId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteLesson = async (req, res) => {
  try {
    await db.query('DELETE FROM lessons WHERE id = $1', [req.params.lessonId]);
    res.json({ message: 'Lesson deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- TOPICS ---
exports.getTopics = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM topics WHERE lesson_id = $1 ORDER BY topic_number ASC', [req.params.lessonId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTopic = async (req, res) => {
  const { topic_number, title, description } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO topics (lesson_id, topic_number, title, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.lessonId, topic_number, title, description, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateTopic = async (req, res) => {
  const { topic_number, title, description } = req.body;
  try {
    const result = await db.query(
      'UPDATE topics SET topic_number = $1, title = $2, description = $3 WHERE id = $4 RETURNING *',
      [topic_number, title, description, req.params.topicId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    await db.query('DELETE FROM topics WHERE id = $1', [req.params.topicId]);
    res.json({ message: 'Topic deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- MATERIALS ---
exports.getMaterials = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM materials WHERE topic_id = $1 ORDER BY created_at ASC', [req.params.topicId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.uploadMaterial = async (req, res) => {
  const { topicId } = req.params;
  const { title, description } = req.body;
  
  if (!req.file) {
    return res.status(400).json({ error: 'Please select a file.' });
  }

  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({ error: 'File size must be less than 10 MB.' });
  }

  const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
  const fileExt = req.file.originalname.split('.').pop().toLowerCase();
  if (!allowedExtensions.includes(fileExt)) {
    return res.status(400).json({ error: 'Unsupported file type.' });
  }

  try {
    const uniqueFilename = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        resource_type: 'raw', 
        type: 'authenticated',
        folder: 'academic_materials',
        public_id: uniqueFilename
      },
      async (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        
        const dbResult = await db.query(
          `INSERT INTO materials (topic_id, title, description, file_name, file_url, cloudinary_public_id, file_type, file_size, uploaded_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [
            topicId, 
            title, 
            description, 
            req.file.originalname, 
            result.secure_url, 
            result.public_id, 
            req.file.mimetype, 
            req.file.size, 
            req.user.id
          ]
        );
        return res.status(201).json(dbResult.rows[0]);
      }
    );
    uploadStream.end(req.file.buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMaterial = async (req, res) => {
  const { materialId } = req.params;
  const userId = req.user.id;
  const userRole = req.user.role;

  try {
    // Fetch the full material record
    const matRes = await db.query(
      `SELECT m.*, s.department_id
       FROM materials m
       JOIN topics t ON m.topic_id = t.id
       JOIN lessons l ON t.lesson_id = l.id
       JOIN units u ON l.unit_id = u.id
       JOIN subjects s ON u.subject_id = s.id
       WHERE m.id = $1`,
      [materialId]
    );

    if (matRes.rowCount === 0) {
      return res.status(404).json({ error: 'Material not found.' });
    }

    const material = matRes.rows[0];

    // Role-based authorization
    if (userRole === 'FACULTY') {
      // Faculty can only delete materials they uploaded
      if (material.uploaded_by !== userId) {
        return res.status(403).json({ error: 'You are not authorized to delete this material. Only the uploader or a HOD can delete it.' });
      }
    } else if (userRole === 'HOD') {
      // HOD can delete any material in their department
      if (material.department_id !== req.user.department_id) {
        return res.status(403).json({ error: 'You can only delete materials within your department.' });
      }
    } else {
      // Should be caught by roleMiddleware but defence-in-depth
      return res.status(403).json({ error: 'Insufficient permissions to delete materials.' });
    }

    // Delete from Cloudinary if a public_id is stored
    if (material.cloudinary_public_id) {
      try {
        const { getCloudinaryType } = require('../utils/textExtractor');
        const resourceType = 'raw'; // all academic materials are raw
        const cloudinaryType = getCloudinaryType(material.file_url);
        await cloudinary.uploader.destroy(material.cloudinary_public_id, {
          resource_type: resourceType,
          type: cloudinaryType, // 'upload' or 'authenticated'
        });
        console.log(`[DELETE] Cloudinary asset removed: ${material.cloudinary_public_id}`);
      } catch (cloudErr) {
        // Log but do not block DB deletion if Cloudinary cleanup fails
        console.error(`[DELETE] Cloudinary deletion failed for ${material.cloudinary_public_id}:`, cloudErr.message);
      }
    }

    // Delete the database record
    await db.query('DELETE FROM materials WHERE id = $1', [materialId]);
    console.log(`[DELETE] Material ${materialId} deleted by user ${userId} (${userRole})`);

    res.json({ message: 'Material deleted successfully.' });
  } catch (err) {
    console.error('[DELETE] Error:', err.message, err.stack);
    res.status(500).json({ error: err.message });
  }
};

async function handleMaterialStream(req, res, disposition) {
  const materialId = req.params.materialId;
  console.log(`[MATERIAL] ${disposition.toUpperCase()} request. ID: ${materialId}`);

  try {
    const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [materialId]);
    if (matRes.rowCount === 0) return res.status(404).json({ error: 'Material not found' });
    const material = matRes.rows[0];

    console.log(`[MATERIAL] Filename     : ${material.file_name}`);
    console.log(`[MATERIAL] MIME type    : ${material.file_type}`);
    console.log(`[MATERIAL] Public ID    : ${material.cloudinary_public_id}`);
    console.log(`[MATERIAL] Stored URL   : ${material.file_url?.substring(0, 80)}`);

    // Determine the Cloudinary delivery type from the stored URL
    const cloudinaryType = getCloudinaryType(material.file_url);
    console.log(`[MATERIAL] Cloudinary type: ${cloudinaryType}`);

    let fetchUrl;
    if (cloudinaryType === 'authenticated') {
      if (!material.cloudinary_public_id) {
        return res.status(502).json({ error: 'Material has no stored Cloudinary reference.' });
      }
      fetchUrl = cloudinary.utils.private_download_url(material.cloudinary_public_id, '', {
        resource_type: 'raw',
        type: 'authenticated',
      });
      console.log(`[MATERIAL] Signed URL   : ${fetchUrl.substring(0, 80)}...`);
    } else {
      // Public upload type — use the stored URL directly
      fetchUrl = material.file_url;
      console.log(`[MATERIAL] Public URL   : ${fetchUrl.substring(0, 80)}...`);
    }

    // Use axios to download (handles redirects correctly)
    let axiosRes;
    try {
      axiosRes = await axios.get(fetchUrl, {
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 30000,
      });
    } catch (err) {
      console.error(`[MATERIAL] Download failed. Status: ${err.response?.status}`, err.message);
      if (!res.headersSent) {
        return res.status(502).json({ error: 'Failed to fetch material from Cloudinary.' });
      }
      return;
    }

    console.log(`[MATERIAL] Cloudinary HTTP ${axiosRes.status}. Streaming to client...`);

    res.setHeader('Content-Type', material.file_type || 'application/octet-stream');
    const filename = encodeURIComponent(material.file_name);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    if (axiosRes.headers['content-length']) {
      res.setHeader('Content-Length', axiosRes.headers['content-length']);
    }

    axiosRes.data.pipe(res);
    axiosRes.data.on('error', (err) => {
      console.error(`[MATERIAL] Stream error:`, err.message);
      if (!res.headersSent) res.status(500).json({ error: 'Stream error' });
    });

  } catch (err) {
    console.error(`[MATERIAL] Unexpected error:`, err.message, err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
}

exports.viewMaterial = (req, res) => handleMaterialStream(req, res, 'inline');
exports.downloadMaterial = (req, res) => handleMaterialStream(req, res, 'attachment');

exports.getSignedUrl = async (req, res) => {
  try {
    const matRes = await db.query('SELECT * FROM materials WHERE id = $1', [req.params.materialId]);
    if (matRes.rowCount === 0) return res.status(404).json({ error: 'Material not found' });
    const material = matRes.rows[0];

    let url = material.file_url;
    if (url.includes('/authenticated/')) {
       const options = { 
         resource_type: 'raw', 
         type: 'authenticated',
         expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour expiry
       };
       if (req.query.download === 'true') {
         options.attachment = true;
       }
       url = cloudinary.utils.private_download_url(material.cloudinary_public_id, '', options);
    } else {
       if (req.query.download === 'true') {
         const filename = encodeURIComponent(material.file_name);
         url = url.replace('/upload/', `/upload/fl_attachment:${filename}/`);
       }
    }

    res.json({ url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.toggleMaterialProgress = async (req, res) => {
  const { materialId } = req.params;
  const studentId = req.user.id;
  try {
    const existing = await db.query(
      'SELECT id FROM student_material_progress WHERE student_id = $1 AND material_id = $2',
      [studentId, materialId]
    );

    if (existing.rows.length > 0) {
      await db.query('DELETE FROM student_material_progress WHERE id = $1', [existing.rows[0].id]);
      res.json({ status: 'uncompleted' });
    } else {
      await db.query(
        'INSERT INTO student_material_progress (student_id, material_id) VALUES ($1, $2)',
        [studentId, materialId]
      );
      res.json({ status: 'completed' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMaterialProgress = async (req, res) => {
  const { topicId } = req.params;
  const studentId = req.user.id;
  try {
    const result = await db.query(
      `SELECT p.material_id 
       FROM student_material_progress p
       JOIN materials m ON p.material_id = m.id
       WHERE p.student_id = $1 AND m.topic_id = $2`,
      [studentId, topicId]
    );
    res.json(result.rows.map(r => r.material_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
