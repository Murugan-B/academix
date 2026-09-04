const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Adding new columns to notifications table...');
    await client.query(`
      ALTER TABLE notifications 
      ADD COLUMN IF NOT EXISTS image_url VARCHAR(1000),
      ADD COLUMN IF NOT EXISTS target_department_id UUID REFERENCES departments(id) ON DELETE CASCADE;
    `);

    console.log('Dropping recipient_type check constraint...');
    // Finding and dropping the check constraint on recipient_type
    const checkConstraintRes = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'notifications'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%recipient_type%';
    `);

    for (let row of checkConstraintRes.rows) {
      console.log(`Dropping constraint: ${row.conname}`);
      await client.query(`ALTER TABLE notifications DROP CONSTRAINT ${row.conname};`);
    }

    console.log('Updating recipient_type length (if needed)...');
    await client.query(`
      ALTER TABLE notifications
      ALTER COLUMN recipient_type TYPE VARCHAR(100);
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
