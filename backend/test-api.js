require('dotenv').config({ path: 'e:/academic-hub/backend/.env' });
const axios = require('axios');
const db = require('./db');
const jwt = require('jsonwebtoken');

async function testApi() {
  try {
    const userRes = await db.query("SELECT * FROM users WHERE role = 'STUDENT' LIMIT 1");
    if (!userRes.rows.length) throw new Error("No student found");
    const user = userRes.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

    console.log("Simulating API request to generate summary for material: 9e135392-dc0d-4410-9824-49565fdf813c");
    const response = await axios.post('http://localhost:5000/api/ai/summarize', {
      materialId: '9e135392-dc0d-4410-9824-49565fdf813c',
      provider: 'local',
      forceRegenerate: true
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log("SUCCESS:", response.data);
  } catch (error) {
    if (error.response) {
      console.error("API ERROR:", error.response.status, error.response.data);
    } else {
      console.error("NETWORK/OTHER ERROR:", error.message);
    }
  }
  process.exit(0);
}

testApi();
