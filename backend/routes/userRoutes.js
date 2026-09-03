const express = require('express');
const router = express.Router();
const { addFaculty, getFaculty, assignMentor, addStudent, getMentees, getHierarchy, getStudent, getMentors } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/faculty', authMiddleware, roleMiddleware(['HOD']), addFaculty);
router.get('/faculty', authMiddleware, roleMiddleware(['HOD']), getFaculty);
router.post('/assign-mentor', authMiddleware, roleMiddleware(['HOD']), assignMentor);

router.post('/student', authMiddleware, roleMiddleware(['HOD', 'FACULTY']), addStudent);
router.get('/mentees', authMiddleware, roleMiddleware(['FACULTY']), getMentees);
router.get('/student/:id', authMiddleware, getStudent);
router.get('/mentors', authMiddleware, getMentors);

router.get('/hierarchy', authMiddleware, getHierarchy);

module.exports = router;
