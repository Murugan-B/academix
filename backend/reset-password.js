require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function resetPassword() {
  const email = 'faculty1.cse@bit.com';
  const newPassword = 'password123';
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    const result = await pool.query('UPDATE users SET password = $1 WHERE email = $2 RETURNING *', [hashedPassword, email]);
    
    if (result.rowCount === 0) {
      console.log('User not found in database');
    } else {
      console.log('Password reset successfully to: ' + newPassword);
    }
  } catch(err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

resetPassword();
