const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  validateHierarchy,
  getUnits, createUnit, updateUnit, deleteUnit,
  getLessons, createLesson, updateLesson, deleteLesson,
  getTopics, createTopic, updateTopic, deleteTopic,
  getMaterials, uploadMaterial, deleteMaterial,
  viewMaterial, downloadMaterial, getSignedUrl
} = require('../controllers/academicController');

const facultyOrHod = roleMiddleware(['HOD', 'FACULTY']);
const hodOnly = roleMiddleware(['HOD']);
const anyRole = roleMiddleware(['HOD', 'FACULTY', 'STUDENT']);

// -- UNITS --
// GET /api/academic/subjects/:subjectId/units
router.get('/subjects/:subjectId/units', authMiddleware, anyRole, getUnits);

// POST /api/academic/subjects/:subjectId/units (HOD & FACULTY)
router.post('/subjects/:subjectId/units', authMiddleware, facultyOrHod, validateHierarchy, createUnit);

// PUT /api/academic/units/:id
router.put('/units/:unitId', authMiddleware, hodOnly, validateHierarchy, updateUnit);

// DELETE /api/academic/units/:id
router.delete('/units/:unitId', authMiddleware, hodOnly, validateHierarchy, deleteUnit);

// -- LESSONS --
// GET /api/academic/units/:unitId/lessons
router.get('/units/:unitId/lessons', authMiddleware, anyRole, getLessons);

// POST /api/academic/units/:unitId/lessons (HOD & FACULTY)
router.post('/units/:unitId/lessons', authMiddleware, facultyOrHod, validateHierarchy, createLesson);

// PUT /api/academic/lessons/:id
router.put('/lessons/:lessonId', authMiddleware, hodOnly, validateHierarchy, updateLesson);

// DELETE /api/academic/lessons/:id
router.delete('/lessons/:lessonId', authMiddleware, hodOnly, validateHierarchy, deleteLesson);

// -- TOPICS --
// GET /api/academic/lessons/:lessonId/topics
router.get('/lessons/:lessonId/topics', authMiddleware, anyRole, getTopics);

// POST /api/academic/lessons/:lessonId/topics (HOD & FACULTY)
router.post('/lessons/:lessonId/topics', authMiddleware, facultyOrHod, validateHierarchy, createTopic);

// PUT /api/academic/topics/:id
router.put('/topics/:topicId', authMiddleware, hodOnly, validateHierarchy, updateTopic);

// DELETE /api/academic/topics/:id
router.delete('/topics/:topicId', authMiddleware, hodOnly, validateHierarchy, deleteTopic);

// -- MATERIALS --
// GET /api/academic/topics/:topicId/materials
router.get('/topics/:topicId/materials', authMiddleware, anyRole, getMaterials);

// POST /api/academic/topics/:topicId/materials (HOD & FACULTY)
router.post('/topics/:topicId/materials', authMiddleware, facultyOrHod, validateHierarchy, upload.single('file'), uploadMaterial);

// GET /api/academic/materials/:materialId/view
router.get('/materials/:materialId/view', authMiddleware, anyRole, validateHierarchy, viewMaterial);

// GET /api/academic/materials/:materialId/download
router.get('/materials/:materialId/download', authMiddleware, anyRole, validateHierarchy, downloadMaterial);

// GET /api/academic/materials/:materialId/signed-url
router.get('/materials/:materialId/signed-url', authMiddleware, anyRole, validateHierarchy, getSignedUrl);

// DELETE /api/academic/materials/:materialId
router.delete('/materials/:materialId', authMiddleware, facultyOrHod, validateHierarchy, deleteMaterial);

module.exports = router;
