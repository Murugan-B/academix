import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Activity, ArrowLeft, BookOpen, Clock } from 'lucide-react';
import api from '../api/axios';

export default function StudentDetails() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    fetchStudentProfile();
  }, [studentId]);

  const fetchStudentProfile = async () => {
    try {
      const res = await api.get(`/users/student/${studentId}`);
      setProfile(res.data);
      
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (user && (user.role === 'FACULTY' || user.role === 'HOD')) {
         const analyticsRes = await api.get(`/analytics/mentor/student/${studentId}`);
         setAnalytics(analyticsRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch student details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-2xl">
        <h2 className="text-lg font-bold mb-2">Error</h2>
        <p>{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-indigo-600 font-bold hover:underline mt-4 inline-block"
        >
          ← Back
        </button>
      </div>
    );
  }

  // Calculate current year
  const currentYear = new Date().getFullYear();
  let academicYear = 'N/A';
  if (profile.batch_start_year) {
    let diff = currentYear - profile.batch_start_year;
    if (new Date().getMonth() >= 7) diff += 1;
    academicYear = diff === 1 ? '1st Year' : diff === 2 ? '2nd Year' : diff === 3 ? '3rd Year' : diff >= 4 ? '4th Year' : 'Incoming';
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-semibold mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Student Details</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Profile & Progress
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 mb-8">
        {/* Profile Card */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            Basic Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-8 gap-x-6">
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Name</p>
              <p className="text-xl font-bold text-slate-800">{profile.name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Roll Number</p>
              <p className="text-xl font-bold text-slate-800">{profile.roll_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Department</p>
              <p className="text-xl font-bold text-slate-800">{profile.department_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Year</p>
              <p className="text-xl font-bold text-slate-800">{academicYear}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Batch</p>
              <p className="text-xl font-bold text-slate-800">
                {profile.batch_start_year} - {profile.batch_end_year}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Mentor</p>
              <p className="text-xl font-bold text-slate-800">{profile.mentor_name || 'Not Assigned'}</p>
            </div>
            <div className="lg:col-span-3">
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Email address</p>
              <p className="text-lg font-bold text-slate-800">{profile.email}</p>
            </div>
          </div>
        </div>

        {/* Future expansion for academic analytics */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" />
            Academic Progress
          </h2>
          <p className="text-slate-500">More insights and analytics will be available soon.</p>
        </div>
      </div>
      
      {analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out delay-100">
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col items-center text-center">
            <h3 className="font-bold text-slate-500 mb-2">Quiz Performance</h3>
            <p className="text-4xl font-extrabold text-indigo-600 mb-4">{analytics.averageScore}%</p>
            <div className="flex gap-4 text-sm font-semibold">
              <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full">{analytics.passed} Passed</span>
              <span className="bg-rose-50 text-rose-600 px-3 py-1 rounded-full">{analytics.notPassed} Failed</span>
            </div>
            <div className="w-full h-px bg-slate-100 my-6" />
            <div className="grid grid-cols-2 gap-4 w-full">
               <div>
                  <p className="text-xs font-bold text-slate-400">Total Attempts</p>
                  <p className="text-xl font-bold text-slate-700">{analytics.totalAttempts}</p>
               </div>
               <div>
                  <p className="text-xs font-bold text-slate-400">Best Score</p>
                  <p className="text-xl font-bold text-slate-700">{analytics.bestScore}%</p>
               </div>
            </div>
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
            <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Topics to Focus On</h3>
            {analytics.weakTopics?.length > 0 ? (
              <div className="flex flex-col gap-3">
                {analytics.weakTopics.map((wt, i) => (
                  <div key={i} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="font-semibold text-slate-700">{wt.topic}</span>
                    <span className="text-sm font-bold text-rose-500">{wt.percentage}%</span>
                  </div>
                ))}
              </div>
            ) : (
               <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400">
                 <p className="font-medium">No weak topics identified yet.</p>
               </div>
            )}
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
            <h3 className="font-bold text-slate-500 mb-4 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Attempts</h3>
            {analytics.recentAttempts?.length > 0 ? (
               <div className="flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-2">
                 {analytics.recentAttempts.map(att => (
                   <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="truncate pr-4 flex-1">
                        <p className="text-sm font-bold text-slate-700 truncate">{att.material_title}</p>
                        <p className="text-xs text-slate-500 font-medium">{new Date(att.completed_at).toLocaleDateString()} - Attempt {att.attempt_number}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                         <span className={`text-sm font-bold ${att.status === 'PASSED' ? 'text-emerald-500' : 'text-rose-500'}`}>{att.percentage}%</span>
                      </div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-center text-slate-400">
                <p className="font-medium">No recent attempts.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
