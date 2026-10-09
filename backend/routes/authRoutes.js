const express = require('express');
const {
  register,
  registerPublic,
  login,
  requestPasswordResetOtp,
  verifyResetOtp,
  resetPasswordWithOtp,
  getMe
} = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

// Public User & Institute Registration
router.post('/register', register);
router.post('/register-public', registerPublic);

// Authentication
router.post('/login', login);
router.get('/me', authMiddleware, getMe);

// Forgot Password with OTP Verification Flow
router.post('/forgot-password/request-otp', requestPasswordResetOtp);
router.post('/forgot-password/verify-otp', verifyResetOtp);
router.post('/forgot-password/reset', resetPasswordWithOtp);

module.exports = router;
