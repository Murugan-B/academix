const db = require('./db');

async function migratePublicAccessAndOtp() {
  console.log('Starting Public Access & OTP database migration...');

  try {
    // 1. Update role check constraint on users table
    await db.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      
      ALTER TABLE users ADD CONSTRAINT users_role_check 
        CHECK (role IN ('SUPER_ADMIN', 'INSTITUTE_ADMIN', 'HOD', 'FACULTY', 'STUDENT', 'MENTOR', 'PUBLIC_USER'));
    `);
    console.log('✓ Updated users_role_check constraint to include PUBLIC_USER & MENTOR.');

    // 2. Add is_verified column to users table
    await db.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;

      -- Backfill existing users as verified
      UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;
    `);
    console.log('✓ Added is_verified column to users table.');

    // 3. Create user_otps table for secure OTP password reset & verification
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_otps (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) NOT NULL,
        otp_hash VARCHAR(255) NOT NULL,
        purpose VARCHAR(50) NOT NULL,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 5,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        consumed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE INDEX IF NOT EXISTS idx_user_otps_email_purpose ON user_otps(email, purpose);
      CREATE INDEX IF NOT EXISTS idx_user_otps_expires_at ON user_otps(expires_at);
      CREATE INDEX IF NOT EXISTS idx_user_otps_consumed ON user_otps(consumed_at);
    `);
    console.log('✓ Created user_otps table and associated performance indexes.');

    console.log('Public Access & OTP migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message, err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migratePublicAccessAndOtp();
