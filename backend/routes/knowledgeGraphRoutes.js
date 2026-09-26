const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const knowledgeGraphController = require('../controllers/knowledgeGraphController');
const prerequisiteController = require('../controllers/prerequisiteController');

const facultyOrHod = roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN']);
const anyRole = roleMiddleware(['HOD', 'FACULTY', 'STUDENT', 'INSTITUTE_ADMIN', 'SUPER_ADMIN']);

// Knowledge Graph retrieval
router.get('/subjects/:subjectId', authMiddleware, anyRole, knowledgeGraphController.getSubjectKnowledgeGraph);
router.get('/topics/:topicId', authMiddleware, anyRole, knowledgeGraphController.getTopicKnowledgeGraph);

// Manual Concept & Relationship management (Faculty / HOD)
router.post('/concepts', authMiddleware, facultyOrHod, knowledgeGraphController.createConcept);
router.patch('/concepts/:id/status', authMiddleware, facultyOrHod, knowledgeGraphController.updateConceptStatus);
router.put('/concepts/:id/status', authMiddleware, facultyOrHod, knowledgeGraphController.updateConceptStatus);
router.post('/relationships', authMiddleware, facultyOrHod, knowledgeGraphController.createRelationship);
router.delete('/relationships/:id', authMiddleware, facultyOrHod, knowledgeGraphController.deleteRelationship);
router.put('/relationships/:id/status', authMiddleware, facultyOrHod, knowledgeGraphController.updateRelationshipStatus);

// AI Auto-Generation
router.post('/subjects/:subjectId/auto-generate', authMiddleware, facultyOrHod, knowledgeGraphController.generateSubjectKnowledgeGraph);

// Prerequisite Diagnosis
router.get('/prerequisites/diagnose', authMiddleware, prerequisiteController.diagnosePrerequisites);
router.get('/prerequisites/attempt-diagnose/:attemptId', authMiddleware, prerequisiteController.getAttemptPrerequisites);
router.get('/prerequisites/:topicTag', authMiddleware, prerequisiteController.getTopicPrerequisites);

module.exports = router;
