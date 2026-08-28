const db = require('../db');
const cloudinary = require('../utils/cloudinary');
const { generateAiSummary } = require('../utils/aiHelpers'); 

exports.uploadResource = async (req, res) => {
  try {
    const { title, description } = req.body;
    const department_id = req.user.department_id;
    const uploaded_by = req.user.id;
    const userRole = req.user.role;
    
    // Auto-approve if Faculty/HOD, else Pending for students
    const status = (userRole === 'FACULTY' || userRole === 'HOD') ? 'APPROVED' : 'PENDING';

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to Cloudinary using stream
    const uploadStream = cloudinary.uploader.upload_stream(
      { resource_type: 'auto', folder: 'academic_resources' },
      async (error, result) => {
        if (error) return res.status(500).json({ error: error.message });
        
        // Insert into DB
        const dbResult = await db.query(
          `INSERT INTO resources (title, description, file_url, status, uploaded_by, department_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [title, description, result.secure_url, status, uploaded_by, department_id]
        );
        
        const resourceId = dbResult.rows[0].id;
        
        // Async background AI processing if it's a PDF
        if (req.file.mimetype === 'application/pdf') {
          // Fire and forget
          generateAiSummary(resourceId, result.secure_url).catch(console.error);
        }

        return res.status(201).json(dbResult.rows[0]);
      }
    );

    uploadStream.end(req.file.buffer);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.approveResource = async (req, res) => {
  const { resource_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE resources SET status = 'APPROVED' WHERE id = $1 RETURNING *`,
      [resource_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.rejectResource = async (req, res) => {
  const { resource_id } = req.body;
  try {
    const result = await db.query(
      `UPDATE resources SET status = 'REJECTED' WHERE id = $1 RETURNING *`,
      [resource_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getResources = async (req, res) => {
  const { department_id } = req.user; // filter by user's department
  const role = req.user.role;
  
  try {
    let query = 'SELECT * FROM resources WHERE department_id = $1';
    let params = [department_id];
    
    // Students only see APPROVED resources
    if (role === 'STUDENT') {
      query += " AND status = 'APPROVED'";
    }

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
