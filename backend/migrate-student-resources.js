const db = require('./db');

async function migrateStudentResources() {
  console.log('Starting Student Resources migration...');

  try {
    // 1. Ensure source_type on materials table is defaulted to 'OFFICIAL'
    await db.query(`
      ALTER TABLE materials 
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'OFFICIAL';

      ALTER TABLE materials 
      ALTER COLUMN source_type SET DEFAULT 'OFFICIAL';

      UPDATE materials SET source_type = 'OFFICIAL' WHERE source_type IS NULL OR source_type = 'FACULTY';
    `);
    console.log('Verified materials.source_type column with OFFICIAL default.');

    // 2. Create student_resources table
    await db.query(`
      CREATE TABLE IF NOT EXISTS student_resources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        tags TEXT[],
        department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
        semester INTEGER NOT NULL CHECK (semester BETWEEN 1 AND 8),
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
        lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
        topic_id UUID NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
        file_name VARCHAR(255) NOT NULL,
        file_url TEXT NOT NULL,
        cloudinary_public_id VARCHAR(255),
        file_type VARCHAR(255),
        file_size INTEGER,
        file_hash VARCHAR(64),
        source_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT' CHECK (source_type IN ('STUDENT', 'FACULTY')),
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
        uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP WITH TIME ZONE,
        rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
        rejected_at TIMESTAMP WITH TIME ZONE,
        rejection_reason TEXT,
        material_id UUID REFERENCES materials(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE student_resources 
      ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'STUDENT';
    `);
    console.log('Created/updated student_resources table.');

    // 3. Create Performance Indexes
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_status ON student_resources(status);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_source_type ON student_resources(source_type);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_subject ON student_resources(subject_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_topic ON student_resources(topic_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_dept ON student_resources(department_id);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_uploaded_by ON student_resources(uploaded_by);`);
    await db.query(`CREATE INDEX IF NOT EXISTS idx_student_resources_created_at ON student_resources(created_at);`);
    console.log('Created student_resources indexes.');

    console.log('Student Resources migration completed successfully.');
  } catch (err) {
    console.error('Migration error:', err.message, err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migrateStudentResources();
