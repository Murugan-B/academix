const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const emailService = require('../services/emailService');

/**
 * Standard Register for Institute Users
 */
const register = async (req, res) => {
  const { name, email, password, role, designation, institute_id, department_id } = req.body;

  try {
    const userRole = role || 'STUDENT';

    // Disallow public users from creating institute admin/super admin via standard open register
    if (['SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(userRole) && !req.user) {
      return res.status(403).json({ message: 'Administrative roles can only be created by an authorized administrator.' });
    }

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'A user with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const newUser = await db.query(
      `INSERT INTO users (name, email, password, role, designation, institute_id, department_id, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE) RETURNING id, name, email, role, is_mentor, institute_id, department_id`,
      [name, email, hashedPassword, userRole, designation, institute_id, department_id]
    );

    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

/**
 * Public User Registration (PUBLIC_USER role, no institute membership)
 */
const registerPublic = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists
    const userCheck = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert public user — strictly no institute or department affiliation
    const newUser = await db.query(
      `INSERT INTO users (name, email, password, role, designation, institute_id, department_id, is_mentor, is_verified)
       VALUES ($1, $2, $3, 'PUBLIC_USER', NULL, NULL, NULL, FALSE, TRUE)
       RETURNING id, name, email, role, is_mentor, institute_id, department_id`,
      [name.trim(), cleanEmail, hashedPassword]
    );

    const createdUser = newUser.rows[0];

    // Issue JWT Token for seamless session start
    const payload = {
      id: createdUser.id,
      name: createdUser.name,
      role: createdUser.role,
      is_mentor: false,
      institute_id: null,
      department_id: null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Public account created successfully.',
      token,
      user: payload
    });
  } catch (error) {
    console.error('Public register error:', error);
    res.status(500).json({ message: 'Server error during public user registration.' });
  }
};

/**
 * Login for all users (Institute & Public)
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const userResult = await db.query('SELECT * FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    
    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    const user = userResult.rows[0];

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Generate JWT
    const payload = {
      id: user.id,
      name: user.name,
      role: user.role,
      is_mentor: user.is_mentor || false,
      institute_id: user.institute_id || null,
      department_id: user.department_id || null,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, user: payload });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

/**
 * Request Password Reset OTP
 * Generates 6-digit cryptographically secure OTP, hashes it, saves to user_otps, sends email.
 * Always returns a generic success response to prevent email enumeration.
 */
const requestPasswordResetOtp = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check rate limiting / cooldown: max 1 request every 60 seconds per email
    const recentOtpCheck = await db.query(
      `SELECT created_at FROM user_otps 
       WHERE LOWER(email) = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND created_at > NOW() - INTERVAL '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );

    if (recentOtpCheck.rows.length > 0) {
      return res.status(429).json({
        message: 'A verification code was recently sent. Please wait 60 seconds before requesting a new code.'
      });
    }

    // Check if user exists in the database
    const userResult = await db.query('SELECT id, name, email FROM users WHERE LOWER(email) = $1', [cleanEmail]);

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];

      // Generate cryptographically secure 6-digit numeric OTP (100000 - 999999)
      const otpNumber = crypto.randomInt(100000, 1000000).toString();

      // Hash the OTP before storing in database
      const salt = await bcrypt.genSalt(10);
      const otpHash = await bcrypt.hash(otpNumber, salt);

      // Invalidate any previously active unconsumed password reset OTPs for this email
      await db.query(
        `UPDATE user_otps SET consumed_at = NOW() 
         WHERE LOWER(email) = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL`,
        [cleanEmail]
      );

      // Store new OTP record with 10-minute expiry
      await db.query(
        `INSERT INTO user_otps (email, otp_hash, purpose, attempts, max_attempts, expires_at)
         VALUES ($1, $2, 'PASSWORD_RESET', 0, 5, NOW() + INTERVAL '10 minutes')`,
        [cleanEmail, otpHash]
      );

      // Send OTP via configured email service (non-blocking for UI, errors logged safely)
      try {
        await emailService.sendOtpEmail({
          to: cleanEmail,
          otp: otpNumber,
          purpose: 'PASSWORD_RESET',
          userName: user.name
        });
      } catch (mailErr) {
        console.error('[EmailService] Failed to deliver OTP email:', mailErr.message);
      }
    }

    // Generic response preventing email address enumeration
    res.json({
      success: true,
      message: 'If an account is associated with this email address, a 6-digit verification code has been sent.'
    });
  } catch (error) {
    console.error('Password reset OTP request error:', error);
    res.status(500).json({ message: 'Server error processing password reset request.' });
  }
};

/**
 * Verify OTP without consuming (used for multi-step frontend validation)
 */
const verifyResetOtp = async (req, res) => {
  const { email, otp } = req.body;

  try {
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Find active OTP record
    const otpRes = await db.query(
      `SELECT * FROM user_otps 
       WHERE LOWER(email) = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code. Please request a new code.' });
    }

    const otpRecord = otpRes.rows[0];

    // Check attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await db.query(`UPDATE user_otps SET consumed_at = NOW() WHERE id = $1`, [otpRecord.id]);
      return res.status(400).json({ message: 'Too many failed attempts. This code has been invalidated. Please request a new one.' });
    }

    // Compare OTP
    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
    if (!isMatch) {
      await db.query(`UPDATE user_otps SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
      const remainingAttempts = Math.max(0, otpRecord.max_attempts - (otpRecord.attempts + 1));
      return res.status(400).json({
        message: `Incorrect verification code. ${remainingAttempts} attempts remaining.`
      });
    }

    res.json({
      success: true,
      message: 'Verification code confirmed. You may now enter your new password.'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error during OTP verification.' });
  }
};

/**
 * Verify OTP and Reset Password in one secure transaction
 */
const resetPasswordWithOtp = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  try {
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Find active OTP record
    const otpRes = await db.query(
      `SELECT * FROM user_otps 
       WHERE LOWER(email) = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [cleanEmail]
    );

    if (otpRes.rows.length === 0) {
      return res.status(400).json({ message: 'Verification code is invalid or has expired. Please request a new code.' });
    }

    const otpRecord = otpRes.rows[0];

    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await db.query(`UPDATE user_otps SET consumed_at = NOW() WHERE id = $1`, [otpRecord.id]);
      return res.status(400).json({ message: 'Too many failed attempts. Please request a new verification code.' });
    }

    const isMatch = await bcrypt.compare(cleanOtp, otpRecord.otp_hash);
    if (!isMatch) {
      await db.query(`UPDATE user_otps SET attempts = attempts + 1 WHERE id = $1`, [otpRecord.id]);
      const remainingAttempts = Math.max(0, otpRecord.max_attempts - (otpRecord.attempts + 1));
      return res.status(400).json({
        message: `Incorrect verification code. ${remainingAttempts} attempts remaining.`
      });
    }

    // Verify user exists
    const userRes = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [cleanEmail]);
    if (userRes.rows.length === 0) {
      return res.status(400).json({ message: 'Account not found.' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await db.query('UPDATE users SET password = $1 WHERE LOWER(email) = $2', [hashedPassword, cleanEmail]);

    // Invalidate the OTP
    await db.query('UPDATE user_otps SET consumed_at = NOW() WHERE id = $1', [otpRecord.id]);

    res.json({
      success: true,
      message: 'Your password has been successfully updated. You may now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error while resetting password.' });
  }
};

/**
 * Get Current Logged-in User
 */
const getMe = async (req, res) => {
  try {
    const userRes = await db.query(
      `SELECT id, name, email, role, designation, is_mentor, institute_id, department_id, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json(userRes.rows[0]);
  } catch (error) {
    console.error('getMe error:', error);
    res.status(500).json({ message: 'Server error retrieving user profile.' });
  }
};

module.exports = {
  register,
  registerPublic,
  login,
  requestPasswordResetOtp,
  verifyResetOtp,
  resetPasswordWithOtp,
  getMe
};
