import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
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
import Layout from './components/layout/Layout';
import ToastContainer from './components/Toast';

function App() {
  return (
    <>
      <ToastContainer />
      <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={<Layout />}>
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
        <Route path="attempt-review/:attemptId" element={<AttemptReviewPage />} />
        <Route index element={<Navigate to="/login" replace />} />
      </Route>
      
      {/* Full-screen quiz page — outside Layout so no sidebar/header renders */}
      <Route path="/quiz/:materialId" element={<QuizPage />} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </>
  );
}

export default App;
