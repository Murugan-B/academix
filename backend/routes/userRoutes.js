const express = require('express');
const router = express.Router();
const { addFaculty, getFaculty, assignMentor, addStudent, getMentees, getHierarchy } = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/faculty', authMiddleware, roleMiddleware(['HOD']), addFaculty);
router.get('/faculty', authMiddleware, roleMiddleware(['HOD']), getFaculty);
router.post('/assign-mentor', authMiddleware, roleMiddleware(['HOD']), assignMentor);

router.post('/student', authMiddleware, roleMiddleware(['FACULTY']), addStudent);
router.get('/mentees', authMiddleware, roleMiddleware(['FACULTY']), getMentees);

router.get('/hierarchy', authMiddleware, getHierarchy);

module.exports = router;
