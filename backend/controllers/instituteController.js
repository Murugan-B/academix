const db = require('../db');
const bcrypt = require('bcryptjs');

exports.createInstitute = async (req, res) => {
  const { name, adminName, adminEmail, adminPassword } = req.body;
  
  try {
    // Basic validation
    if (!name || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // 1. Create Institute
    const instituteResult = await db.query(
      'INSERT INTO institutes (name) VALUES ($1) RETURNING *', 
      [name]
    );
    const instituteId = instituteResult.rows[0].id;

    // 2. Create Institute Admin
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const userResult = await db.query(
      `INSERT INTO users (name, email, password, role, institute_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, institute_id`,
      [adminName, adminEmail, hashedPassword, 'INSTITUTE_ADMIN', instituteId]
    );

    res.status(201).json({
      institute: instituteResult.rows[0],
      admin: userResult.rows[0]
    });
  } catch (err) {
    console.error("Error creating institute:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getInstitutes = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM institutes');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.transferAdmin = async (req, res) => {
  const { institute_id, new_admin_id } = req.body;
  
  try {
    if (!institute_id || !new_admin_id) {
      return res.status(400).json({ error: "institute_id and new_admin_id are required" });
    }

    // Demote current admin(s) to FACULTY
    await db.query(
      "UPDATE users SET role = 'FACULTY' WHERE institute_id = $1 AND role = 'INSTITUTE_ADMIN'", 
      [institute_id]
    );
    
    // Promote new user to INSTITUTE_ADMIN
    await db.query(
      "UPDATE users SET role = 'INSTITUTE_ADMIN' WHERE id = $1 AND institute_id = $2", 
      [new_admin_id, institute_id]
    );
    
    res.json({ message: 'Admin transferred successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
