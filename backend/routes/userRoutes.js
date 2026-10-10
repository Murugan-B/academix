const express = require('express');
const router = express.Router();
const {
  addFaculty,
  getFaculty,
  assignMentor,
  addStudent,
  getStudents,
  getMentees,
  getHierarchy,
  getStudent,
  getMentors,
  getInstituteAdmins
} = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/faculty', authMiddleware, roleMiddleware(['HOD']), addFaculty);
router.get('/faculty', authMiddleware, roleMiddleware(['HOD']), getFaculty);
router.post('/assign-mentor', authMiddleware, roleMiddleware(['HOD']), assignMentor);

router.post('/student', authMiddleware, roleMiddleware(['HOD', 'FACULTY']), addStudent);
router.get('/mentees', authMiddleware, roleMiddleware(['FACULTY']), getMentees);
router.get('/student', authMiddleware, roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN']), getStudents);
router.get('/student/:id', authMiddleware, roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN', 'STUDENT']), getStudent);
router.get('/mentors', authMiddleware, roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN', 'STUDENT']), getMentors);
router.get('/institute-admins', authMiddleware, roleMiddleware(['SUPER_ADMIN']), getInstituteAdmins);

router.get('/hierarchy', authMiddleware, roleMiddleware(['SUPER_ADMIN', 'INSTITUTE_ADMIN', 'HOD', 'FACULTY']), getHierarchy);

module.exports = router;
