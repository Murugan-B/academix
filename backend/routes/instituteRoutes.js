const express = require('express');
const router = express.Router();
const { createInstitute, getInstitutes, transferAdmin } = require('../controllers/instituteController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), createInstitute);
router.get('/', authMiddleware, roleMiddleware(['SUPER_ADMIN']), getInstitutes);
router.post('/transfer-admin', authMiddleware, roleMiddleware(['SUPER_ADMIN']), transferAdmin);

module.exports = router;
