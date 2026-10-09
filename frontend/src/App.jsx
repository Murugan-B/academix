import { Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import PublicSearch from './pages/PublicSearch';
import UsersAndRoles from './pages/UsersAndRoles';
import Settings from './pages/Settings';
import Subjects from './pages/Subjects';
import SubjectDetails from './pages/SubjectDetails';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import InstituteAdminDashboard from './pages/InstituteAdminDashboard';
import HodDashboard from './pages/HodDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import StudentDashboard from './pages/StudentDashboard';
import StudentDetails from './pages/StudentDetails';
import QuizPage from './pages/QuizPage';
import AttemptReviewPage from './pages/AttemptReviewPage';
import AIAssistant from './pages/AIAssistant';
import AILearning from './pages/AILearning';
import CohortLearningGaps from './pages/CohortLearningGaps';
import StudentResources from './pages/StudentResources';
import ResourceApprovals from './pages/ResourceApprovals';
import Layout from './components/layout/Layout';
import ToastContainer from './components/Toast';

function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
        {/* Public Landing & Authentication Pages */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/public-search" element={<PublicSearch />} />
        
        {/* Protected Dashboard & Application Workspace */}
        <Route element={<Layout />}>
          <Route path="super-admin" element={<SuperAdminDashboard />} />
          <Route path="institute-admin" element={<InstituteAdminDashboard />} />
          <Route path="hod" element={<HodDashboard />} />
          <Route path="faculty" element={<FacultyDashboard />} />
          <Route path="student" element={<StudentDashboard />} />
          <Route path="students/:studentId" element={<StudentDetails />} />
          <Route path="users" element={<UsersAndRoles />} />
          <Route path="settings" element={<Settings />} />
          <Route path="subjects" element={<Subjects />} />
          <Route path="subjects/:subjectId" element={<SubjectDetails />} />
          <Route path="student-resources" element={<StudentResources />} />
          <Route path="resource-approvals" element={<ResourceApprovals />} />
          <Route path="attempt-review/:attemptId" element={<AttemptReviewPage />} />
          <Route path="ai-assistant" element={<AIAssistant />} />
          <Route path="ai-learning" element={<AILearning />} />
          <Route path="cohort-learning-gaps" element={<CohortLearningGaps />} />
        </Route>
        
        {/* Full-screen quiz page — outside Layout */}
        <Route path="/quiz/:materialId" element={<QuizPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
