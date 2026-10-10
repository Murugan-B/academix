const db = require('./db');

async function migratePublicEcosystem() {
  console.log('Starting Academix Public User Ecosystem migration...');

  try {
    // 1. Create public_courses table for community course folders
    await db.query(`
      CREATE TABLE IF NOT EXISTS public_courses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        normalized_name VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        category VARCHAR(100) DEFAULT 'COMMUNITY',
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        is_verified BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_public_courses_norm_name ON public_courses(normalized_name);
      CREATE INDEX IF NOT EXISTS idx_public_courses_created ON public_courses(created_at DESC);
    `);
    console.log('✓ Created public_courses table with normalized deduplication index.');

    // 2. Extend student_resources to support external links, YouTube, Google Drive, and community courses
    await db.query(`
      ALTER TABLE student_resources 
      ADD COLUMN IF NOT EXISTS external_url TEXT,
      ADD COLUMN IF NOT EXISTS external_provider VARCHAR(50) DEFAULT 'LOCAL_UPLOAD',
      ADD COLUMN IF NOT EXISTS external_metadata JSONB,
      ADD COLUMN IF NOT EXISTS public_course_id UUID REFERENCES public_courses(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS course_category_type VARCHAR(50) DEFAULT 'INSTITUTE_SEMESTER';

      -- Allow null columns for community external resources
      ALTER TABLE student_resources ALTER COLUMN department_id DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN semester DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN subject_id DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN unit_id DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN lesson_id DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN topic_id DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN file_name DROP NOT NULL;
      ALTER TABLE student_resources ALTER COLUMN file_url DROP NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_student_resources_public_course ON student_resources(public_course_id);
      CREATE INDEX IF NOT EXISTS idx_student_resources_provider ON student_resources(external_provider);
    `);
    console.log('✓ Extended student_resources table for external media and public course folders.');

    // 3. Create saved_resources table for bookmarking public study materials
    await db.query(`
      CREATE TABLE IF NOT EXISTS saved_resources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_id UUID NOT NULL REFERENCES student_resources(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, resource_id)
      );

      CREATE INDEX IF NOT EXISTS idx_saved_resources_user ON saved_resources(user_id, created_at DESC);
    `);
    console.log('✓ Created saved_resources table.');

    // 4. Create personal_notes table for user study notes
    await db.query(`
      CREATE TABLE IF NOT EXISTS personal_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        course_name VARCHAR(255),
        topic_tag VARCHAR(255),
        tags TEXT[],
        is_ai_generated BOOLEAN DEFAULT FALSE,
        source_resource_id UUID REFERENCES student_resources(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_personal_notes_user ON personal_notes(user_id, updated_at DESC);
    `);
    console.log('✓ Created personal_notes table.');

    // 5. Create ai_generated_tests and ai_test_attempts
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_generated_tests (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(255) NOT NULL,
        course_name VARCHAR(255),
        difficulty VARCHAR(50) DEFAULT 'MEDIUM',
        question_count INTEGER DEFAULT 5,
        questions JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ai_tests_user ON ai_generated_tests(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS ai_test_attempts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        test_id UUID NOT NULL REFERENCES ai_generated_tests(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        score NUMERIC(5,2) NOT NULL,
        total_questions INTEGER NOT NULL,
        correct_count INTEGER NOT NULL,
        user_answers JSONB,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ai_test_attempts_user ON ai_test_attempts(user_id, completed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_test_attempts_test ON ai_test_attempts(test_id);
    `);
    console.log('✓ Created ai_generated_tests and ai_test_attempts tables.');

    // 6. Create ai_usage_ledger and ai_quota_configs
    await db.query(`
      CREATE TABLE IF NOT EXISTS ai_usage_ledger (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        feature_category VARCHAR(100) NOT NULL,
        provider VARCHAR(50) NOT NULL,
        model VARCHAR(100),
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        estimated_cost NUMERIC(10,6) DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'SUCCESS',
        error_category VARCHAR(100),
        ip_address VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_user_cat ON ai_usage_ledger(user_id, feature_category, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_ledger(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_status ON ai_usage_ledger(feature_category, status);

      CREATE TABLE IF NOT EXISTS ai_quota_configs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        feature_category VARCHAR(100) NOT NULL UNIQUE,
        feature_name VARCHAR(255) NOT NULL,
        daily_limit_per_user INTEGER DEFAULT 50,
        monthly_limit_per_user INTEGER DEFAULT 1000,
        global_daily_limit INTEGER DEFAULT 5000,
        is_enabled BOOLEAN DEFAULT TRUE,
        warning_threshold_pct INTEGER DEFAULT 80,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Seed Default Quota Configs
      INSERT INTO ai_quota_configs (feature_category, feature_name, daily_limit_per_user, monthly_limit_per_user, global_daily_limit)
      VALUES 
        ('CONVERSATIONAL_CHAT', 'Conversational AI Chat', 100, 2000, 10000),
        ('DOCUMENT_ANALYSIS', 'Document Analysis & RAG', 40, 800, 4000),
        ('VISION_IMAGE_ANALYSIS', 'Multimodal Vision & Diagram Understanding', 30, 600, 3000),
        ('TEST_GENERATION', 'AI Practice Test Generator', 25, 500, 2500),
        ('NOTES_GENERATION', 'AI Notes & Smart Revision Generator', 40, 800, 4000),
        ('DOCUMENT_SUMMARIZATION', 'Document Summarization', 40, 800, 4000),
        ('QUIZ_GENERATION', 'Quiz & Question Generator', 30, 600, 3000),
        ('STUDY_PLAN_GENERATION', 'Personalized AI Study Plan', 20, 400, 2000)
      ON CONFLICT (feature_category) DO NOTHING;
    `);
    console.log('✓ Created ai_usage_ledger & ai_quota_configs tables with default presets.');

    console.log('🎉 Public User Ecosystem migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message, err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

migratePublicEcosystem();
