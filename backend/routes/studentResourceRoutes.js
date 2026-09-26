const express = require('express');
const router = express.Router();
const upload = require('../middlewares/uploadMiddleware');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const {
  checkDuplicate,
  uploadResource,
  getApprovedResources,
  getMyUploads,
  getPendingApprovals,
  approveResource,
  rejectResource,
  getSignedUrl,
  viewResource,
  downloadResource,
  deleteResource
} = require('../controllers/studentResourceController');

const anyAuthenticated = authMiddleware;
const facultyOrAbove = roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN']);
const studentOnly = roleMiddleware(['STUDENT']);

// Pre-upload duplicate check
router.post('/check-duplicate', anyAuthenticated, checkDuplicate);

// Upload resource (Students & Faculty)
router.post('/upload', anyAuthenticated, upload.single('file'), uploadResource);

// Get approved resources (Students, Faculty, HOD)
router.get('/', anyAuthenticated, getApprovedResources);

// Get user's own submissions/uploads (Students & Faculty)
router.get('/my-uploads', anyAuthenticated, getMyUploads);

// Approvals queue (Faculty, Mentors, HOD, Admins)
router.get('/approvals', anyAuthenticated, facultyOrAbove, getPendingApprovals);

// Approve / Reject actions
router.put('/:id/approve', anyAuthenticated, facultyOrAbove, approveResource);
router.put('/:id/reject', anyAuthenticated, facultyOrAbove, rejectResource);

// Preview & Download
router.get('/:id/signed-url', anyAuthenticated, getSignedUrl);
router.get('/:id/view', anyAuthenticated, viewResource);
router.get('/:id/download', anyAuthenticated, downloadResource);

// Delete resource
router.delete('/:id', anyAuthenticated, deleteResource);

module.exports = router;
