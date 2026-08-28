const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const { uploadResource, getResources, approveResource, rejectResource } = require('../controllers/resourceController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

router.post('/upload', authMiddleware, upload.single('file'), uploadResource);
router.get('/', authMiddleware, getResources);
router.put('/approve', authMiddleware, roleMiddleware(['HOD', 'FACULTY']), approveResource);
router.put('/reject', authMiddleware, roleMiddleware(['HOD', 'FACULTY']), rejectResource);

module.exports = router;
