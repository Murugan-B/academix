const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');

const mentorOnly = roleMiddleware(['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN']);
const cohortAnalyticsController = require('../controllers/cohortAnalyticsController');

router.get('/student', authMiddleware, analyticsController.getStudentAnalytics);
router.get('/mentor/student/:studentId', authMiddleware, mentorOnly, analyticsController.getMentorAnalytics);

// -- COHORT LEARNING GAP DETECTION & REMEDIAL PLANS --
router.get('/cohort/learning-gaps', authMiddleware, mentorOnly, cohortAnalyticsController.getDepartmentCohortGaps);
router.get('/cohort/subject/:subjectId/gaps', authMiddleware, mentorOnly, cohortAnalyticsController.getSubjectCohortGaps);
router.post('/cohort/remedial-plan', authMiddleware, mentorOnly, cohortAnalyticsController.generateRemedialPlan);
router.post('/cohort/save-remedial-plan', authMiddleware, mentorOnly, cohortAnalyticsController.saveRemedialPlan);
router.get('/cohort/remedial-plans', authMiddleware, mentorOnly, cohortAnalyticsController.getAllDepartmentRemedialPlans);
router.get('/cohort/subject/:subjectId/remedial-plans', authMiddleware, mentorOnly, cohortAnalyticsController.getSubjectRemedialPlans);

module.exports = router;
