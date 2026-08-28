const db = require('../db');
const bcrypt = require('bcryptjs');

// HOD adds Faculty
exports.addFaculty = async (req, res) => {
  const { name, email, password, designation, is_mentor } = req.body;
  const { department_id, institute_id } = req.user;
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await db.query(
      `INSERT INTO users (name, email, password, role, designation, department_id, institute_id, is_mentor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, email, role, is_mentor`,
      [name, email, hashedPassword, 'FACULTY', designation || 'ASSISTANT_PROFESSOR', department_id, institute_id, is_mentor || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// HOD gets Faculty
exports.getFaculty = async (req, res) => {
  const { department_id } = req.user;
  try {
    const result = await db.query(
      `SELECT id, name, email, role, designation, is_mentor FROM users WHERE department_id = $1 AND role = 'FACULTY'`,
      [department_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// HOD assigns Mentor role to Faculty
exports.assignMentor = async (req, res) => {
  const { faculty_id } = req.body;
  try {
    await db.query('UPDATE users SET is_mentor = TRUE WHERE id = $1 AND role = $2', [faculty_id, 'FACULTY']);
    res.json({ message: 'Faculty is now a mentor' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Faculty creates student and adds to mentees
exports.addStudent = async (req, res) => {
  const { name, email, password } = req.body;
  const mentor_id = req.user.id;
  const { department_id, institute_id } = req.user;
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 1. Create Student
    const userResult = await db.query(
      `INSERT INTO users (name, email, password, role, department_id, institute_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role`,
      [name, email, hashedPassword, 'STUDENT', department_id, institute_id]
    );
    
    const student_id = userResult.rows[0].id;

    // 2. Map to Mentor
    await db.query('INSERT INTO mentor_students (mentor_id, student_id) VALUES ($1, $2)', [mentor_id, student_id]);
    
    res.status(201).json(userResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Mentor gets mentees
exports.getMentees = async (req, res) => {
  const mentor_id = req.user.id;
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.email FROM users u 
       JOIN mentor_students ms ON u.id = ms.student_id 
       WHERE ms.mentor_id = $1`, [mentor_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get Users & Roles Hierarchy based on role
exports.getHierarchy = async (req, res) => {
  const { role, id: user_id, institute_id, department_id } = req.user;
  
  try {
    let data = { role };
    
    if (role === 'SUPER_ADMIN') {
      const institutes = await db.query('SELECT id, name, created_at FROM institutes');
      const admins = await db.query(`
        SELECT u.id, u.name, u.email, i.name as institute_name, u.institute_id
        FROM users u 
        JOIN institutes i ON u.institute_id = i.id 
        WHERE u.role = 'INSTITUTE_ADMIN'
      `);
      const allUsers = await db.query(`
        SELECT id, name, email, role, institute_id 
        FROM users 
        WHERE role != 'SUPER_ADMIN' AND role != 'INSTITUTE_ADMIN'
      `);
      data.institutes = institutes.rows;
      data.admins = admins.rows;
      data.allUsers = allUsers.rows;
    } 
    else if (role === 'INSTITUTE_ADMIN') {
      const departments = await db.query('SELECT id, name FROM departments WHERE institute_id = $1', [institute_id]);
      const users = await db.query(`
        SELECT u.id, u.name, u.email, u.role, u.designation, d.name as department_name 
        FROM users u 
        LEFT JOIN departments d ON u.department_id = d.id 
        WHERE u.institute_id = $1 AND u.role != 'SUPER_ADMIN' AND u.role != 'INSTITUTE_ADMIN'
      `, [institute_id]);
      data.departments = departments.rows;
      data.users = users.rows;
    }
    else if (role === 'HOD') {
      const users = await db.query(`
        SELECT id, name, email, role, designation, is_mentor 
        FROM users 
        WHERE department_id = $1 AND role IN ('FACULTY', 'STUDENT')
      `, [department_id]);
      data.users = users.rows;
    }
    else if (role === 'FACULTY') {
      const mentees = await db.query(`
        SELECT u.id, u.name, u.email 
        FROM users u 
        JOIN mentor_students ms ON u.id = ms.student_id 
        WHERE ms.mentor_id = $1
      `, [user_id]);
      data.users = mentees.rows;
    }
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
