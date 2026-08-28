const db = require('../db');

exports.createSubject = async (req, res) => {
  const { name, code, semester } = req.body;
  const { id: created_by, department_id } = req.user;

  try {
    const result = await db.query(
      'INSERT INTO subjects (name, code, semester, department_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, code, semester, department_id, created_by]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSubjects = async (req, res) => {
  const { department_id } = req.user;
  const { semester } = req.query;

  try {
    let query = 'SELECT * FROM subjects WHERE department_id = $1';
    let values = [department_id];

    if (semester) {
      query += ' AND semester = $2';
      values.push(semester);
    }
    
    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, values);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteSubject = async (req, res) => {
  const { id } = req.params;
  const { department_id } = req.user;

  try {
    await db.query('DELETE FROM subjects WHERE id = $1 AND department_id = $2', [id, department_id]);
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
