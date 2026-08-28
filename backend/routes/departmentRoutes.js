const express = require('express');
const router = express.Router();
const { createDepartment, assignHod, getDepartments } = require('../controllers/departmentController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', authMiddleware, roleMiddleware(['INSTITUTE_ADMIN', 'SUPER_ADMIN']), createDepartment);
router.get('/', authMiddleware, roleMiddleware(['INSTITUTE_ADMIN', 'SUPER_ADMIN']), getDepartments);
router.post('/assign-hod', authMiddleware, roleMiddleware(['INSTITUTE_ADMIN']), assignHod);

module.exports = router;
