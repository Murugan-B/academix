const db = require('../db');
const cloudinary = require('../utils/cloudinary');

exports.createNotification = async (req, res) => {
  const { title, message, targetType, targetId, departmentId: explicitDeptId } = req.body;
  const { id: sender_id, role: sender_role, institute_id, department_id } = req.user;

  if (!title || !message || !targetType) {
    return res.status(400).json({ error: 'Title, message, and targetType are required.' });
  }

  // 1. Role-based Security Validation
  let isAuthorized = false;

  if (sender_role === 'SUPER_ADMIN') {
    isAuthorized = ['ALL_INSTITUTE_ADMINS', 'SPECIFIC_INSTITUTE_ADMIN'].includes(targetType);
  } else if (sender_role === 'INSTITUTE_ADMIN') {
    isAuthorized = [
      'ALL_DEPARTMENTS', 'SPECIFIC_DEPARTMENT', 'ALL_FACULTY',
      'SPECIFIC_DEPARTMENT_FACULTY', 'ALL_USERS'
    ].includes(targetType);
  } else if (sender_role === 'HOD') {
    isAuthorized = [
      'MY_DEPARTMENT_STUDENTS', 'MY_DEPARTMENT_FACULTY', 'OTHER_DEPARTMENT', 
      'ALL_FACULTY', 'SPECIFIC_DEPARTMENT_FACULTY'
    ].includes(targetType);
  } else if (sender_role === 'MENTOR' || sender_role === 'FACULTY') {
    isAuthorized = ['ALL_MY_MENTEES', 'SPECIFIC_MENTEE'].includes(targetType);
  }

  if (!isAuthorized) {
    return res.status(403).json({ error: 'Unauthorized to send this type of notification.' });
  }

  try {
    const handleInsert = async (imageUrl = null) => {
      let finalRecipientId = targetId || null;
      let finalTargetDepartmentId = explicitDeptId || null;

      if (['SPECIFIC_DEPARTMENT', 'OTHER_DEPARTMENT'].includes(targetType)) {
        finalTargetDepartmentId = targetId;
      }
      if (['MY_DEPARTMENT_STUDENTS', 'MY_DEPARTMENT_FACULTY'].includes(targetType)) {
        finalTargetDepartmentId = department_id;
      }

      // Determine recipient count for the frontend alert
      let recipientCount = 1; // Default for specific users
      if (targetType === 'MY_DEPARTMENT_STUDENTS') {
        const res = await db.query(`SELECT COUNT(*) FROM users WHERE department_id = $1 AND role = 'STUDENT'`, [department_id]);
        recipientCount = parseInt(res.rows[0].count);
      } else if (targetType === 'MY_DEPARTMENT_FACULTY') {
        const res = await db.query(`SELECT COUNT(*) FROM users WHERE department_id = $1 AND role = 'FACULTY'`, [department_id]);
        recipientCount = parseInt(res.rows[0].count);
      } else if (targetType === 'ALL_MY_MENTEES') {
        const res = await db.query(`SELECT COUNT(*) FROM mentor_students WHERE mentor_id = $1`, [sender_id]);
        recipientCount = parseInt(res.rows[0].count);
      } else if (['ALL_DEPARTMENTS', 'ALL_USERS', 'ALL_FACULTY', 'ALL_INSTITUTE_ADMINS', 'SPECIFIC_DEPARTMENT', 'OTHER_DEPARTMENT'].includes(targetType)) {
        // Just return a dummy count > 1 for generic broadcasts, or leave as 1.
        recipientCount = 1;
      }

      const result = await db.query(
        `INSERT INTO notifications 
         (title, message, sender_id, sender_role, recipient_type, recipient_id, institute_id, image_url, target_department_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [title, message, sender_id, sender_role, targetType, finalRecipientId, institute_id, imageUrl, finalTargetDepartmentId]
      );
      
      const createdNotification = result.rows[0];
      createdNotification.recipientCount = recipientCount; // Attach for frontend alert
      
      return res.status(201).json(createdNotification);
    };

    if (req.file) {
      if (req.file.size > 5 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image size must be less than 5 MB.' });
      }
      const allowed = ['jpg', 'jpeg', 'png', 'webp'];
      const fileExt = req.file.originalname.split('.').pop().toLowerCase();
      if (!allowed.includes(fileExt)) {
        return res.status(400).json({ error: 'Unsupported image type.' });
      }

      const uniqueFilename = `notif_${Date.now()}_${Math.round(Math.random()*1000)}`;
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'notifications', public_id: uniqueFilename },
        async (error, result) => {
          if (error) return res.status(500).json({ error: 'Image upload failed' });
          await handleInsert(result.secure_url);
        }
      );
      uploadStream.end(req.file.buffer);
    } else {
      await handleInsert(null);
    }
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

    // Global
    conditions.push(`n.recipient_type = 'ALL_USERS'`);

    if (role === 'INSTITUTE_ADMIN') {
      conditions.push(`n.recipient_type = 'ALL_INSTITUTE_ADMINS'`);
      conditions.push(`(n.recipient_type = 'SPECIFIC_INSTITUTE_ADMIN' AND n.recipient_id = $1)`);
    }

    if (department_id) {
      conditions.push(`n.recipient_type = 'ALL_DEPARTMENTS'`);
      conditions.push(`(n.recipient_type IN ('SPECIFIC_DEPARTMENT', 'OTHER_DEPARTMENT') AND n.target_department_id = $3)`);
      if (role === 'STUDENT') {
        conditions.push(`(n.recipient_type = 'MY_DEPARTMENT_STUDENTS' AND n.target_department_id = $3)`);
      }
      if (role === 'FACULTY' || role === 'HOD') {
        conditions.push(`(n.recipient_type = 'MY_DEPARTMENT_FACULTY' AND n.target_department_id = $3)`);
      }
      params.push(department_id);
    }

    if (role === 'FACULTY' || role === 'HOD') {
      conditions.push(`n.recipient_type = 'ALL_FACULTY'`);
      // SPECIFIC_DEPARTMENT_FACULTY is caught by n.recipient_id = $1 because it's a specific user
    }

    if (role === 'STUDENT') {
      conditions.push(`(n.recipient_type = 'SPECIFIC_MENTEE' AND n.recipient_id = $1)`);
      // ALL_MY_MENTEES check
      // For ALL_MY_MENTEES, n.sender_id must be the student's mentor
      conditions.push(`(n.recipient_type = 'ALL_MY_MENTEES' AND n.sender_id = (SELECT mentor_id FROM mentor_students WHERE student_id = $1))`);
    }

    // Catch-all specific user
    conditions.push(`n.recipient_id = $1`);

    if (conditions.length === 0) conditions.push('FALSE'); // Fallback

    // SENDER MUST NEVER RECEIVE THEIR OWN NOTIFICATION
    query += conditions.join(' OR ') + `) AND n.sender_id != $1 ORDER BY n.created_at DESC`;

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

exports.getSentNotifications = async (req, res) => {
  const user_id = req.user.id;

  try {
    const result = await db.query(
      `SELECT * FROM notifications 
       WHERE sender_id = $1 
       ORDER BY created_at DESC`,
      [user_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
