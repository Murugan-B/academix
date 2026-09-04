const db = require('../db');
const bcrypt = require('bcryptjs');

exports.createDepartment = async (req, res) => {
  const { name, hodName, hodEmail, hodPassword } = req.body;
  // Institute admin creates it for their own institute
  const institute_id = req.user.institute_id;

  try {
    if (!name || !hodName || !hodEmail || !hodPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // 1. Create Department
    const deptResult = await db.query(
      'INSERT INTO departments (name, institute_id) VALUES ($1, $2) RETURNING *',
      [name, institute_id]
    );
    const departmentId = deptResult.rows[0].id;

    // 2. Create HOD User
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(hodPassword, salt);

    const userResult = await db.query(
      `INSERT INTO users (name, email, password, role, department_id, institute_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role`,
      [hodName, hodEmail, hashedPassword, 'HOD', departmentId, institute_id]
    );
    const hodId = userResult.rows[0].id;

    // 3. Link HOD to Department
    await db.query('UPDATE departments SET hod_id = $1 WHERE id = $2', [hodId, departmentId]);

    res.status(201).json({
      department: deptResult.rows[0],
      hod: userResult.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getDepartments = async (req, res) => {
  const institute_id = req.user.institute_id;
  try {
    const result = await db.query(`
      SELECT d.*, u.name as hod_name, u.email as hod_email 
      FROM departments d
      LEFT JOIN users u ON d.hod_id = u.id
      WHERE d.institute_id = $1
    `, [institute_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.assignHod = async (req, res) => {
  const { department_id, hod_id } = req.body;
  try {
    await db.query('UPDATE departments SET hod_id = $1 WHERE id = $2', [hod_id, department_id]);
    await db.query('UPDATE users SET role = $1, department_id = $2 WHERE id = $3', ['HOD', department_id, hod_id]);
    res.json({ message: 'HOD assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
