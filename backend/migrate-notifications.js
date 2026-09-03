const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding new columns to users table...');
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS batch_start_year INTEGER,
      ADD COLUMN IF NOT EXISTS batch_end_year INTEGER,
      ADD COLUMN IF NOT EXISTS roll_number VARCHAR(50) UNIQUE;
    `);

    console.log('Creating notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
          sender_role VARCHAR(50),
          recipient_type VARCHAR(50) NOT NULL CHECK (recipient_type IN ('ALL_STUDENTS', 'ALL_FACULTY', 'DEPARTMENT', 'SPECIFIC_STUDENT', 'SPECIFIC_FACULTY', 'INSTITUTE')),
          recipient_id UUID, 
          institute_id UUID REFERENCES institutes(id) ON DELETE CASCADE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Creating notification_reads table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_reads (
          notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY(notification_id, user_id)
      );
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
