const bcrypt = require('bcryptjs');
const db = require('./db');

async function seedSuperAdmin() {
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@123', salt);

    const result = await db.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, name, email, role`,
      ['Super Admin', 'admin@academix.com', hashedPassword, 'SUPER_ADMIN']
    );

    if (result.rows.length > 0) {
      console.log('Super Admin created successfully:', result.rows[0]);
      console.log('Login Email: admin@academix.com');
      console.log('Login Password: Admin@123');
    } else {
      console.log('Super Admin already exists.');
    }
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
  } finally {
    process.exit();
  }
}

seedSuperAdmin();
