const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const mentorAssessmentController = require('../controllers/mentorAssessmentController');

// All mentor endpoints require authentication and mentor/faculty/HOD/Admin role
const allowedRoles = ['FACULTY', 'MENTOR', 'HOD', 'INSTITUTE_ADMIN', 'SUPER_ADMIN'];

// Student Overview & Stats
router.get(
  '/mentees/:studentId/overview',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getStudentOverview
);

// Assessment Summary (Grouped by quiz with cleared status)
router.get(
  '/mentees/:studentId/assessment-summary',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getAssessmentSummary
);

// Complete Assessment History (Chronological attempts)
router.get(
  '/mentees/:studentId/assessment-history',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getAssessmentHistory
);

// Subject-wise Assessments & History
router.get(
  '/mentees/:studentId/subjects',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getStudentSubjects
);

// Recent completed assessments
router.get(
  '/mentees/:studentId/recent-assessments',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getRecentAssessments
);

// Specific Attempt Detailed Breakdown with Question Review
router.get(
  '/mentees/:studentId/attempts/:attemptId',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getAttemptDetail
);

// Mistake Analysis (Incorrect answers grouped by topic)
router.get(
  '/mentees/:studentId/mistake-analysis',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getMistakeAnalysis
);

// Topic-wise Performance & Classification
router.get(
  '/mentees/:studentId/topic-performance',
  authMiddleware,
  roleMiddleware(allowedRoles),
  mentorAssessmentController.getTopicPerformance
);

module.exports = router;
