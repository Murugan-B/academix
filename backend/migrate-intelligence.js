require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function runIntelligenceMigration() {
  const client = await pool.connect();
  try {
    console.log('=== Starting Academix Intelligent Academic Layer Migration ===');
    await client.query('BEGIN');

    // 1. Ensure uuid-ossp extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    // 2. Concepts Table
    console.log('Creating concepts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concepts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'REVIEWED', 'CONFIRMED')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT unique_subject_concept_name UNIQUE (subject_id, name)
      );

      ALTER TABLE concepts ADD COLUMN IF NOT EXISTS provenance VARCHAR(100) DEFAULT 'MANUAL';
    `);

    // 3. Concept Relationships Table
    console.log('Creating concept_relationships table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concept_relationships (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
        target_concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
        relationship_type VARCHAR(50) NOT NULL CHECK (relationship_type IN (
          'PREREQUISITE_OF',
          'DEPENDS_ON',
          'RELATED_TO',
          'PART_OF',
          'EXPLAINS',
          'EXAMPLE_OF'
        )),
        status VARCHAR(50) DEFAULT 'DETECTED' CHECK (status IN ('DETECTED', 'REVIEWED', 'CONFIRMED')),
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_no_self_relationship CHECK (source_concept_id != target_concept_id),
        CONSTRAINT unique_concept_relationship UNIQUE (source_concept_id, target_concept_id, relationship_type)
      );
    `);

    // 4. Performance Indexes
    console.log('Creating indexes for concepts and relationships...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_concepts_subject_id ON concepts(subject_id);
      CREATE INDEX IF NOT EXISTS idx_concepts_topic_id ON concepts(topic_id);
      CREATE INDEX IF NOT EXISTS idx_concepts_status ON concepts(status);
      CREATE INDEX IF NOT EXISTS idx_concept_rel_source ON concept_relationships(source_concept_id);
      CREATE INDEX IF NOT EXISTS idx_concept_rel_target ON concept_relationships(target_concept_id);
      CREATE INDEX IF NOT EXISTS idx_concept_rel_type ON concept_relationships(relationship_type);
    `);

    // 5. Add citations and grounding metadata column to ai_messages if not exists
    console.log('Updating ai_messages with citations and grounding fields...');
    await client.query(`
      ALTER TABLE ai_messages 
      ADD COLUMN IF NOT EXISTS citations JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE ai_messages 
      ADD COLUMN IF NOT EXISTS grounding VARCHAR(50) DEFAULT 'GENERAL';
    `);

    // 6. Remedial plans table for saving faculty-generated remedial learning plans
    console.log('Creating cohort_remedial_plans table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS cohort_remedial_plans (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        topic_id UUID REFERENCES topics(id) ON DELETE SET NULL,
        topic_tag VARCHAR(255) NOT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_content JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_remedial_plans_subject ON cohort_remedial_plans(subject_id);
    `);

    await client.query('COMMIT');
    console.log('=== Intelligent Academic Layer Migration Succeeded! ===');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

runIntelligenceMigration();
