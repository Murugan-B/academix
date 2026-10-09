const { pool } = require('./db');
const jwt = require('jsonwebtoken');
const searchService = require('./services/search/searchService');
const conversationalService = require('./services/ai/conversationalService');
const publicController = require('./controllers/publicController');
const studentResourceController = require('./controllers/studentResourceController');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// Mock Express req, res helpers
function createMockReqRes({ user = null, query = {}, params = {}, body = {}, headers = {} } = {}) {
    const req = {
        user,
        query,
        params,
        body,
        headers,
        get: (header) => headers[header.toLowerCase()] || headers[header]
    };
    const res = {
        statusCode: 200,
        responseData: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.responseData = data;
            return this;
        },
        send(data) {
            this.responseData = data;
            return this;
        },
        redirect(url) {
            this.responseData = { redirectUrl: url };
            return this;
        }
    };
    return { req, res };
}

async function runTests() {
    console.log('========================================================================');
    console.log('🧪 ACADEMIX AUTOMATED SECURITY, SEARCH & AI VERIFICATION SUITE');
    console.log('========================================================================\n');

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failedTests++;
        }
    }

    try {
        // 1. Setup Test Users
        console.log('1. Setting up test users and resources in test database...');
        
        const ts = Date.now();
        const publicEmail = `test_public_${ts}@test.academix.com`;
        const attackerEmail = `test_attacker_${ts}@test.academix.com`;
        const instEmail = `test_inst_${ts}@test.academix.com`;

        // Create Public User
        const publicUserRes = await pool.query(`
            INSERT INTO users (name, email, password, role)
            VALUES ('Test Public User', $1, 'dummy_hash', 'PUBLIC_USER')
            RETURNING id, name, email, role
        `, [publicEmail]);
        const publicUser = publicUserRes.rows[0];

        // Create Attacker Public User
        const attackerUserRes = await pool.query(`
            INSERT INTO users (name, email, password, role)
            VALUES ('Test Attacker', $1, 'dummy_hash', 'PUBLIC_USER')
            RETURNING id, name, email, role
        `, [attackerEmail]);
        const attackerUser = attackerUserRes.rows[0];

        // Get a valid topic hierarchy row
        const hierRes = await pool.query(`
            SELECT t.id as topic_id, l.id as lesson_id, u.id as unit_id, s.id as subject_id, s.semester, s.department_id 
            FROM topics t 
            JOIN lessons l ON t.lesson_id = l.id 
            JOIN units u ON l.unit_id = u.id 
            JOIN subjects s ON u.subject_id = s.id 
            LIMIT 1
        `);
        const hier = hierRes.rows[0];
        const deptId = hier?.department_id;
        const subjId = hier?.subject_id;
        const unitId = hier?.unit_id;
        const lessonId = hier?.lesson_id;
        const topicId = hier?.topic_id;
        const sem = hier?.semester || 1;

        // Create Institutional Student User
        const instUserRes = await pool.query(`
            INSERT INTO users (name, email, password, role, department_id)
            VALUES ('Test Student', $1, 'dummy_hash', 'STUDENT', $2)
            RETURNING id, name, email, role, department_id
        `, [instEmail, deptId]);
        const instUser = instUserRes.rows[0];

        // Create 3 Test Resources:
        // A) is_public = TRUE, status = 'APPROVED' (Public Note)
        const pubNoteRes = await pool.query(`
            INSERT INTO student_resources (
                title, description, file_url, file_name, file_type, status, is_public, 
                uploaded_by, department_id, subject_id, unit_id, lesson_id, topic_id, semester, source_type, created_at
            )
            VALUES ('TEST_PUBLIC_OPEN_NOTE', 'Verified Public Python Handbook', 'https://example.com/pub.pdf', 'pub.pdf', 'application/pdf', 'APPROVED', TRUE, $1, $2, $3, $4, $5, $6, $7, 'STUDENT', NOW())
            RETURNING id, title, is_public, status
        `, [instUser.id, deptId, subjId, unitId, lessonId, topicId, sem]);
        const publicResource = pubNoteRes.rows[0];

        // B) is_public = FALSE, status = 'APPROVED' (Private Institute Note)
        const privNoteRes = await pool.query(`
            INSERT INTO student_resources (
                title, description, file_url, file_name, file_type, status, is_public, 
                uploaded_by, department_id, subject_id, unit_id, lesson_id, topic_id, semester, source_type, created_at
            )
            VALUES ('TEST_PRIVATE_INSTITUTE_EXAM_PAPER', 'Confidential Midterm Solutions for CSE', 'https://example.com/confidential.pdf', 'confidential.pdf', 'application/pdf', 'APPROVED', FALSE, $1, $2, $3, $4, $5, $6, $7, 'STUDENT', NOW())
            RETURNING id, title, is_public, status
        `, [instUser.id, deptId, subjId, unitId, lessonId, topicId, sem]);
        const privateResource = privNoteRes.rows[0];

        // C) is_public = TRUE, status = 'PENDING' (Pending note - must not be shown)
        const pendingNoteRes = await pool.query(`
            INSERT INTO student_resources (
                title, description, file_url, file_name, file_type, status, is_public, 
                uploaded_by, department_id, subject_id, unit_id, lesson_id, topic_id, semester, source_type, created_at
            )
            VALUES ('TEST_PENDING_OPEN_NOTE', 'Unapproved Community Note', 'https://example.com/pending.pdf', 'pending.pdf', 'application/pdf', 'PENDING', TRUE, $1, $2, $3, $4, $5, $6, $7, 'STUDENT', NOW())
            RETURNING id, title, is_public, status
        `, [instUser.id, deptId, subjId, unitId, lessonId, topicId, sem]);
        const pendingResource = pendingNoteRes.rows[0];

        console.log('✅ Test fixtures initialized.\n');

        // =====================================================================
        // TEST SUITE 1: PUBLIC RESOURCE SECURITY & DATA ISOLATION
        // =====================================================================
        console.log('--- TEST SUITE 1: PUBLIC RESOURCE SECURITY & DATA ISOLATION ---');

        // 1.1 Featured Open Resources should only return is_public = TRUE AND status = 'APPROVED'
        {
            const { req, res } = createMockReqRes({ user: publicUser });
            await publicController.getFeaturedResources(req, res);
            assert(res.statusCode === 200, 'getFeaturedResources returns 200');
            const data = Array.isArray(res.responseData) ? res.responseData : (res.responseData?.data || []);
            const hasPublic = data.some(r => r.id === publicResource.id);
            const hasPrivate = data.some(r => r.id === privateResource.id);
            const hasPending = data.some(r => r.id === pendingResource.id);

            assert(hasPublic === true, 'Public user receives explicitly public & approved resources');
            assert(hasPrivate === false, 'CRITICAL: Public user CANNOT see private institute materials even if approved');
            assert(hasPending === false, 'Public user CANNOT see pending public resources');
        }

        // 1.2 Normal Search Endpoint (Academix resource bucket filtering)
        {
            const { req, res } = createMockReqRes({ 
                user: publicUser, 
                query: { query: 'TEST_', search_type: 'academix' } 
            });
            await publicController.normalSearch(req, res);
            assert(res.statusCode === 200, 'publicController.normalSearch returns 200');
            const data = res.responseData?.publicResources || [];
            const foundPrivate = data.some(r => r.id === privateResource.id);
            const foundPublic = data.some(r => r.id === publicResource.id);

            assert(foundPublic === true, 'Public search returns public open resources');
            assert(foundPrivate === false, 'Public search excludes private institutional resources');
        }

        // 1.3 Direct Resource Detail Access (Bypass attempt by ID)
        {
            // Public user attempting to fetch private resource details
            const { req, res } = createMockReqRes({ user: publicUser, params: { id: privateResource.id } });
            await studentResourceController.viewResource(req, res);
            assert(res.statusCode === 403, `Direct resource detail access for private note rejected with 403 (Got ${res.statusCode})`);
        }

        // 1.4 Direct Download URL / Signed URL Access (Bypass attempt by ID)
        {
            const { req, res } = createMockReqRes({ user: publicUser, params: { id: privateResource.id } });
            await studentResourceController.getSignedUrl(req, res);
            assert(res.statusCode === 403, `Direct signed URL generation for private note rejected with 403 (Got ${res.statusCode})`);
        }

        // 1.5 Direct Download Redirect Access (Bypass attempt by ID)
        {
            const { req, res } = createMockReqRes({ user: publicUser, params: { id: privateResource.id } });
            await studentResourceController.downloadResource(req, res);
            assert(res.statusCode === 403, `Direct download redirect for private note rejected with 403 (Got ${res.statusCode})`);
        }

        // 1.6 Authorized Institutional User access to private resource is preserved
        {
            const { req, res } = createMockReqRes({ user: instUser, params: { id: privateResource.id } });
            await studentResourceController.getSignedUrl(req, res);
            assert(res.statusCode === 200, 'Authorized CSE student can access CSE institute resource');
        }

        console.log('');

        // =====================================================================
        // TEST SUITE 2: REAL GLOBAL SEARCH (WEB & IMAGES)
        // =====================================================================
        console.log('--- TEST SUITE 2: REAL GLOBAL WEB & IMAGE SEARCH ---');

        // 2.1 Web Search Service
        {
            const webResult = await searchService.searchWeb({ query: 'Python programming basics tutorial', searchType: 'web', page: 1, limit: 5 });
            assert(webResult && Array.isArray(webResult.results), 'searchWeb returns structured result object with results array');
            assert(webResult.results.length > 0, `searchWeb returned ${webResult.results.length} genuine web results`);
            const first = webResult.results[0];
            assert(Boolean(first.title && first.snippet && first.url && first.domain), 'Web result contains title, snippet, URL, and domain metadata');
            console.log(`    ℹ️ Provider used: [${webResult.provider}] - Top URL: ${first.url}`);
        }

        // 2.2 Image Search Service
        {
            const imgResult = await searchService.searchWeb({ query: 'Artificial Intelligence neural network diagram', searchType: 'images', page: 1, limit: 6 });
            assert(imgResult && Array.isArray(imgResult.images), 'searchWeb for images returns images array');
            assert(imgResult.images.length > 0, `searchWeb returned ${imgResult.images.length} images`);
            const firstImg = imgResult.images[0];
            assert(Boolean(firstImg.imageUrl && firstImg.title), 'Image result contains valid imageUrl and title');
            console.log(`    ℹ️ Image provider: [${imgResult.provider}] - Top Image: ${firstImg.imageUrl.slice(0, 60)}...`);
        }

        // 2.3 Global Search Controller Integration with Pagination & Academix public resources
        {
            const { req, res } = createMockReqRes({ 
                user: publicUser, 
                query: { query: 'TEST_PUBLIC_OPEN_NOTE', search_type: 'all' } 
            });
            await publicController.normalSearch(req, res);
            assert(res.statusCode === 200, 'normalSearch returns 200 OK');
            const webList = res.responseData?.webResults || [];
            const academixList = res.responseData?.publicResources || [];
            const foundPublicAcademix = academixList.some(r => r.id === publicResource.id);
            const foundPrivateAcademix = academixList.some(r => r.id === privateResource.id);
            assert(foundPublicAcademix === true, 'Public Academix resources included in normal search');
            assert(foundPrivateAcademix === false, 'Private institutional resources NEVER included in public normal search');
        }

        console.log('');

        // =====================================================================
        // TEST SUITE 3: CONVERSATIONAL AI SEARCH (GENERAL & WEB-GROUNDED)
        // =====================================================================
        console.log('--- TEST SUITE 3: CONVERSATIONAL AI & WEB GROUNDING ---');

        // 3.1 General Academic / Technical Question (No "selected material" bug)
        {
            console.log('  🧠 Testing AI conversational assistant on general programming question...');
            const aiRes = await conversationalService.processConversationalQuery({
                query: 'Explain the difference between mutable and immutable data types in JavaScript with code examples.',
                conversationHistory: [],
                includeWebSearch: false
            });
            
            assert(Boolean(aiRes && aiRes.answer), 'AI returns answer object');
            assert(!aiRes.answer.includes("I couldn't find this information in the selected material"), 'BUG FIX VERIFIED: AI answers general questions directly without canned error message');
            assert(aiRes.answer.toLowerCase().includes('mutable') || aiRes.answer.toLowerCase().includes('array'), 'AI response contains accurate academic explanation');
            console.log(`    ℹ️ AI Model used: [${aiRes.providerUsed}] - Answer length: ${aiRes.answer.length} chars`);
        }

        // 3.2 Time-sensitive Web-Grounded Query
        {
            console.log('  🌐 Testing AI live web grounding & citations on current question...');
            const groundedRes = await conversationalService.processConversationalQuery({
                query: 'What are the main features of Next.js 14 App Router and server actions?',
                conversationHistory: [],
                includeWebSearch: true
            });

            assert(Boolean(groundedRes && groundedRes.answer), 'Web-grounded AI returns answer');
            assert(Array.isArray(groundedRes.sources), 'Web-grounded AI provides citations array');
            console.log(`    ℹ️ Grounded sources returned: ${groundedRes.sources.length}`);
            if (groundedRes.sources.length > 0) {
                console.log(`    ℹ️ Citation 1: ${groundedRes.sources[0].title} (${groundedRes.sources[0].url})`);
            }
        }

        // 3.3 Multi-turn Conversation Context Retention
        {
            console.log('  💬 Testing Multi-turn conversation context flow...');
            const history = [
                { role: 'user', content: 'My favorite programming language is Rust.' },
                { role: 'assistant', content: 'Rust is a great systems programming language focused on safety and concurrency!' }
            ];
            const followUpRes = await conversationalService.processConversationalQuery({
                query: 'What was the language I just said I like, and why is it memory safe without a garbage collector?',
                conversationHistory: history,
                includeWebSearch: false
            });

            assert(followUpRes.answer.toLowerCase().includes('rust'), 'AI remembers previous conversation turn context');
            assert(followUpRes.answer.toLowerCase().includes('ownership') || followUpRes.answer.toLowerCase().includes('borrow'), 'AI answers follow-up technical details accurately');
        }

        console.log('');

        // =====================================================================
        // TEST SUITE 4: PERSISTENT SEARCH & CHAT HISTORY CRUD AND SECURITY
        // =====================================================================
        console.log('--- TEST SUITE 4: PERSISTENT HISTORY SECURITY & OWNERSHIP ---');

        let createdSearchHistoryId = null;
        let createdConversationId = null;

        // 4.1 Normal Search History Persistence via normalSearch
        {
            const { req, res } = createMockReqRes({
                user: publicUser,
                query: {
                    query: 'TEST_SEARCH_QUERY_QUANTUM_COMPUTING',
                    search_type: 'web'
                }
            });
            await publicController.normalSearch(req, res);
            assert(res.statusCode === 200, 'normalSearch saves history and returns 200');
            
            // Query DB for created history item
            const histRes = await pool.query(
                "SELECT id FROM search_history WHERE user_id = $1 AND query = 'TEST_SEARCH_QUERY_QUANTUM_COMPUTING' LIMIT 1",
                [publicUser.id]
            );
            createdSearchHistoryId = histRes.rows[0]?.id;
            assert(Boolean(createdSearchHistoryId), `Search history record created with ID: ${createdSearchHistoryId}`);
        }

        // 4.2 List Search History (Scoped to Authenticated User)
        {
            const { req, res } = createMockReqRes({ user: publicUser });
            await publicController.getNormalSearchHistory(req, res);
            assert(res.statusCode === 200, 'getNormalSearchHistory returns 200');
            const items = res.responseData || [];
            const found = items.some(i => i.id === createdSearchHistoryId);
            assert(found === true, 'Public user can view their persistent search history');
        }

        // 4.3 Search History Ownership Isolation (Attacker cannot delete another user\'s history)
        {
            const { req, res } = createMockReqRes({
                user: attackerUser, // Different user
                params: { id: createdSearchHistoryId }
            });
            await publicController.deleteNormalSearchHistoryItem(req, res);
            assert(res.statusCode === 404, `Attacker deletion of foreign search history record rejected with 404 (Got ${res.statusCode})`);
        }

        // 4.4 AI Conversation Chat Endpoint & Persistent Storage
        {
            const { req, res } = createMockReqRes({
                user: publicUser,
                body: {
                    query: 'TEST_CONVERSATION: What is Euler’s formula in complex analysis?',
                    includeWebSearch: false
                }
            });
            await publicController.aiChat(req, res);
            assert(res.statusCode === 200, 'aiChat returns 200');
            createdConversationId = res.responseData?.conversationId;
            assert(Boolean(createdConversationId), `AI Conversation created with ID: ${createdConversationId}`);
            assert(Boolean(res.responseData?.answer), 'AI response answer returned');
        }

        // 4.5 AI Conversation History Access Control (Attacker cannot read another user\'s conversation)
        {
            const { req, res } = createMockReqRes({
                user: attackerUser, // Different user
                params: { id: createdConversationId }
            });
            await publicController.getAiConversationDetails(req, res);
            assert(res.statusCode === 404, `Attacker reading another user's AI conversation rejected with 404 (Got ${res.statusCode})`);
        }

        // 4.6 Authorized Owner Reading Their Own AI Conversation
        {
            const { req, res } = createMockReqRes({
                user: publicUser,
                params: { id: createdConversationId }
            });
            await publicController.getAiConversationDetails(req, res);
            assert(res.statusCode === 200, 'Owner can retrieve their full AI conversation');
            const messages = res.responseData?.messages || [];
            assert(messages.length >= 2, `Conversation retrieved with ${messages.length} messages`);
        }

        // 4.7 Delete Search History Item by Owner
        {
            const { req, res } = createMockReqRes({
                user: publicUser,
                params: { id: createdSearchHistoryId }
            });
            await publicController.deleteNormalSearchHistoryItem(req, res);
            assert(res.statusCode === 200, 'Owner can successfully delete their search history item');
        }

        // 4.8 Delete AI Conversation by Owner
        {
            const { req, res } = createMockReqRes({
                user: publicUser,
                params: { id: createdConversationId }
            });
            await publicController.deleteAiConversation(req, res);
            assert(res.statusCode === 200, 'Owner can successfully delete their AI conversation');
        }

        console.log('');

        // Cleanup test data
        await pool.query("DELETE FROM search_history WHERE user_id IN ($1, $2, $3)", [publicUser.id, attackerUser.id, instUser.id]);
        await pool.query("DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id IN ($1, $2, $3))", [publicUser.id, attackerUser.id, instUser.id]);
        await pool.query("DELETE FROM ai_conversations WHERE user_id IN ($1, $2, $3)", [publicUser.id, attackerUser.id, instUser.id]);
        await pool.query("DELETE FROM student_resources WHERE uploaded_by IN ($1, $2, $3)", [publicUser.id, attackerUser.id, instUser.id]);
        await pool.query("DELETE FROM users WHERE id IN ($1, $2, $3)", [publicUser.id, attackerUser.id, instUser.id]);

        console.log('========================================================================');
        console.log(`📊 TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
        console.log('========================================================================\n');

        if (failedTests > 0) {
            process.exit(1);
        } else {
            console.log('🎉 ALL SECURITY, SEARCH, AI, AND HISTORY VERIFICATIONS PASSED SUCCESSFULLY!');
            process.exit(0);
        }

    } catch (err) {
        console.error('💥 Test suite encountered unhandled error:', err);
        process.exit(1);
    }
}

runTests();
