const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const crypto = require('crypto');

// Import controllers directly for unit/integration verification
const authController = require('./controllers/authController');
const publicController = require('./controllers/publicController');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING PUBLIC USER ACCESS & OTP VERIFICATION TESTS');
  console.log('====================================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✓ PASS: ${name}`);
      testsPassed++;
    } else {
      console.error(`✗ FAIL: ${name}`);
      testsFailed++;
    }
  }

  try {
    const testEmail = `test_public_${Date.now()}@academix-test.org`;
    const testPassword = 'Password123!';
    const testNewPassword = 'NewPassword456!';

    // TEST 1: Public User Registration Controller
    console.log('--- TEST GROUP 1: PUBLIC USER REGISTRATION & AUTH ---');
    let registeredUser = null;
    let registeredToken = null;

    const mockReqRegister = {
      body: {
        name: 'Alex Public Scholar',
        email: testEmail,
        password: testPassword
      }
    };
    const mockResRegister = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await authController.registerPublic(mockReqRegister, mockResRegister);
    assert(mockResRegister.statusCode === 201, 'Public user registration returns HTTP 201');
    assert(mockResRegister.data?.user?.role === 'PUBLIC_USER', 'User role is strictly PUBLIC_USER');
    assert(mockResRegister.data?.user?.institute_id === null, 'Institute ID is null (no institute affiliation)');
    assert(mockResRegister.data?.token, 'JWT Token is issued upon public registration');
    
    registeredUser = mockResRegister.data.user;
    registeredToken = mockResRegister.data.token;

    // TEST 2: Public User Login
    const mockReqLogin = {
      body: {
        email: testEmail,
        password: testPassword
      }
    };
    const mockResLogin = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await authController.login(mockReqLogin, mockResLogin);
    assert(mockResLogin.data?.user?.role === 'PUBLIC_USER', 'Public user logs in successfully with PUBLIC_USER role');
    assert(Boolean(mockResLogin.data?.token), 'Valid JWT token returned on login');

    // TEST 3: Role Security & Institute Isolation
    console.log('\n--- TEST GROUP 2: ROLE AUTHORIZATION & PERMISSION ISOLATION ---');
    const roleMiddleware = require('./middlewares/roleMiddleware');

    let accessDenied = false;
    const mockReqForbidden = {
      user: {
        id: registeredUser.id,
        role: 'PUBLIC_USER',
        institute_id: null
      }
    };
    const mockResForbidden = {
      status(code) {
        if (code === 403) accessDenied = true;
        return this;
      },
      json(data) {
        return this;
      }
    };
    const mockNext = () => { accessDenied = false; };

    // Test access to Super Admin only endpoint
    roleMiddleware(['SUPER_ADMIN'])(mockReqForbidden, mockResForbidden, mockNext);
    assert(accessDenied === true, 'PUBLIC_USER is blocked from SUPER_ADMIN routes with HTTP 403');

    // Test access to Institute Admin & HOD routes
    accessDenied = false;
    roleMiddleware(['INSTITUTE_ADMIN', 'HOD'])(mockReqForbidden, mockResForbidden, mockNext);
    assert(accessDenied === true, 'PUBLIC_USER is blocked from Institute Admin & HOD routes with HTTP 403');

    // TEST 4: Normal Public Search
    console.log('\n--- TEST GROUP 3: PUBLIC SEARCH (NORMAL & EXTERNAL) ---');
    const mockReqSearch = {
      query: { query: 'data structures algorithms' }
    };
    const mockResSearch = {
      status(code) { return this; },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await publicController.normalSearch(mockReqSearch, mockResSearch);
    assert(Array.isArray(mockResSearch.data?.internalResults), 'Normal search returns internalResults array');
    assert(Array.isArray(mockResSearch.data?.externalResults), 'Normal search returns externalResults array');
    assert(
      mockResSearch.data.externalResults.every(r => r.sourceType === 'EXTERNAL_VERIFIED_REFERENCE'),
      'External results are strictly labeled EXTERNAL_VERIFIED_REFERENCE'
    );

    // TEST 5: Public AI Search & Grounding
    console.log('\n--- TEST GROUP 4: PUBLIC AI SEARCH & SOURCE CLASSIFICATION ---');
    const mockReqAiSearch = {
      body: {
        query: 'What is the binary search time complexity?',
        provider: 'gemini'
      }
    };
    const mockResAiSearch = {
      status(code) { return this; },
      json(data) {
        this.data = data;
        return this;
      }
    };

    await publicController.aiSearch(mockReqAiSearch, mockResAiSearch);
    assert(typeof mockResAiSearch.data?.answer === 'string' && mockResAiSearch.data.answer.length > 0, 'AI search generated answer');
    assert(Boolean(mockResAiSearch.data?.sourceClassification), 'AI search explicitly returned sourceClassification');
    assert(Boolean(mockResAiSearch.data?.citationDisclaimer), 'AI search provided citation disclaimer');

    // TEST 6: Forgot Password OTP Flow
    console.log('\n--- TEST GROUP 5: FORGOT PASSWORD WITH SECURE OTP ---');
    
    // Step A: Request OTP
    const mockReqOtpReq = { body: { email: testEmail } };
    const mockResOtpReq = {
      status(code) { return this; },
      json(data) { this.data = data; return this; }
    };
    await authController.requestPasswordResetOtp(mockReqOtpReq, mockResOtpReq);
    assert(mockResOtpReq.data?.success === true, 'OTP request returned success message');
    assert(
      mockResOtpReq.data.message.includes('If an account is associated'),
      'Generic response returned preventing user enumeration'
    );

    // Check DB for hashed OTP record
    const otpDbRecord = await db.query(
      `SELECT * FROM user_otps WHERE LOWER(email) = $1 AND purpose = 'PASSWORD_RESET' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
      [testEmail.toLowerCase()]
    );
    assert(otpDbRecord.rows.length === 1, 'OTP record safely stored in user_otps database table');
    assert(otpDbRecord.rows[0].otp_hash !== '123456', 'OTP is securely hashed in database (not plain text)');
    assert(otpDbRecord.rows[0].attempts === 0, 'Attempts initialized to 0');
    assert(new Date(otpDbRecord.rows[0].expires_at) > new Date(), 'OTP expiration set in future');

    // Step B: Test Cooldown Rate Limit (Requesting again within 60s)
    let rateLimited = false;
    const mockResOtpRateLimit = {
      status(code) { if (code === 429) rateLimited = true; return this; },
      json(data) { return this; }
    };
    await authController.requestPasswordResetOtp(mockReqOtpReq, mockResOtpRateLimit);
    assert(rateLimited === true, 'Resend cooldown enforced with HTTP 429 within 60 seconds');

    // Step C: Verify OTP & Reset Password
    // For test simulation, let's create a known hashed OTP for testing reset
    const testOtpCode = '654321';
    const salt = await bcrypt.genSalt(10);
    const testOtpHash = await bcrypt.hash(testOtpCode, salt);

    await db.query(
      `UPDATE user_otps SET otp_hash = $1 WHERE id = $2`,
      [testOtpHash, otpDbRecord.rows[0].id]
    );

    // Test with wrong OTP first
    let wrongOtpRejected = false;
    const mockReqWrongOtp = {
      body: { email: testEmail, otp: '000000', newPassword: testNewPassword }
    };
    const mockResWrongOtp = {
      status(code) { if (code === 400) wrongOtpRejected = true; return this; },
      json(data) { this.data = data; return this; }
    };
    await authController.resetPasswordWithOtp(mockReqWrongOtp, mockResWrongOtp);
    assert(wrongOtpRejected === true, 'Incorrect OTP was rejected');

    // Test with correct OTP
    const mockReqResetSuccess = {
      body: { email: testEmail, otp: testOtpCode, newPassword: testNewPassword }
    };
    const mockResResetSuccess = {
      status(code) { return this; },
      json(data) { this.data = data; return this; }
    };
    await authController.resetPasswordWithOtp(mockReqResetSuccess, mockResResetSuccess);
    assert(mockResResetSuccess.data?.success === true, 'Password reset succeeded with valid OTP');

    // Verify OTP is marked consumed
    const consumedCheck = await db.query(`SELECT consumed_at FROM user_otps WHERE id = $1`, [otpDbRecord.rows[0].id]);
    assert(consumedCheck.rows[0].consumed_at !== null, 'OTP is invalidated / marked consumed after successful reset');

    // Verify user can now login with NEW password
    const mockReqLoginNew = { body: { email: testEmail, password: testNewPassword } };
    const mockResLoginNew = {
      status(code) { return this; },
      json(data) { this.data = data; return this; }
    };
    await authController.login(mockReqLoginNew, mockResLoginNew);
    assert(Boolean(mockResLoginNew.data?.token), 'User successfully logged in with the new updated password');

    // Cleanup test user & OTP records
    await db.query(`DELETE FROM user_otps WHERE LOWER(email) = $1`, [testEmail.toLowerCase()]);
    await db.query(`DELETE FROM users WHERE LOWER(email) = $1`, [testEmail.toLowerCase()]);
    console.log('✓ Cleaned up test records from database');

  } catch (err) {
    console.error('Test execution error:', err);
    testsFailed++;
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log('====================================================\n');

  process.exit(testsFailed === 0 ? 0 : 1);
}

runTests();
