const express = require('express');
const router = express.Router();
const { createSubject, getSubjects, deleteSubject } = require('../controllers/subjectController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', authMiddleware, roleMiddleware(['HOD']), createSubject);
router.get('/', authMiddleware, roleMiddleware(['HOD', 'FACULTY', 'STUDENT']), getSubjects);
router.delete('/:id', authMiddleware, roleMiddleware(['HOD']), deleteSubject);

module.exports = router;
