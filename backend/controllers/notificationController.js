const db = require('../db');

exports.createNotification = async (req, res) => {
  const { title, message, recipient_type, recipient_id } = req.body;
  const { id: sender_id, role: sender_role, institute_id, department_id } = req.user;

  try {
    // Validate authorization
    if (sender_role === 'HOD') {
      if (recipient_type !== 'DEPARTMENT' && recipient_type !== 'SPECIFIC_STUDENT' && recipient_type !== 'SPECIFIC_FACULTY') {
        return res.status(403).json({ error: 'HOD can only send department-level notifications' });
      }
      if (recipient_type === 'DEPARTMENT' && recipient_id !== department_id) {
        return res.status(403).json({ error: 'Cannot send notification to other departments' });
      }
    }

    const result = await db.query(
      `INSERT INTO notifications (title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  const { id: user_id, role, department_id, institute_id } = req.user;

  try {
    let query = `
      SELECT n.*, r.read_at IS NOT NULL as is_read, u.name as sender_name 
      FROM notifications n
      LEFT JOIN notification_reads r ON n.id = r.notification_id AND r.user_id = $1
      LEFT JOIN users u ON n.sender_id = u.id
      WHERE n.institute_id = $2 AND (
    `;
    const params = [user_id, institute_id];
    let conditions = [];

    // Everyone gets INSTITUTE notifications
    conditions.push(`n.recipient_type = 'INSTITUTE'`);

    if (role === 'STUDENT') {
      conditions.push(`n.recipient_type = 'ALL_STUDENTS'`);
      conditions.push(`(n.recipient_type = 'DEPARTMENT' AND n.recipient_id = $3)`);
      conditions.push(`(n.recipient_type = 'SPECIFIC_STUDENT' AND n.recipient_id = $1)`);
      params.push(department_id);
    } else if (role === 'FACULTY' || role === 'HOD') {
      conditions.push(`n.recipient_type = 'ALL_FACULTY'`);
      conditions.push(`(n.recipient_type = 'DEPARTMENT' AND n.recipient_id = $3)`);
      conditions.push(`(n.recipient_type = 'SPECIFIC_FACULTY' AND n.recipient_id = $1)`);
      params.push(department_id);
    }

    query += conditions.join(' OR ') + `) ORDER BY n.created_at DESC`;

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  const { id: notification_id } = req.params;
  const user_id = req.user.id;

  try {
    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id) 
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [notification_id, user_id]
    );
    res.json({ message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
