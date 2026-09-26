require('dotenv').config();
const db = require('./db');
(async () => {
  const constraints = await db.query("SELECT conname, pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class cl ON c.conrelid = cl.oid WHERE cl.relname = 'cohort_remedial_plans'");
  console.log('Constraints on cohort_remedial_plans:', constraints.rows);
  process.exit(0);
})();
