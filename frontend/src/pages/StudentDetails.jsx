import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Activity, ArrowLeft } from 'lucide-react';
import api from '../api/axios';

export default function StudentDetails() {
  const { studentId } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStudentProfile();
  }, [studentId]);

  const fetchStudentProfile = async () => {
    try {
      const res = await api.get(`/users/student/${studentId}`);
      setProfile(res.data);
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
        <Link to="/faculty" className="text-indigo-600 font-bold hover:underline mt-4 inline-block">← Back to Dashboard</Link>
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
          <Link to={-1} className="text-slate-400 hover:text-indigo-600 flex items-center gap-1 font-semibold mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
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
          <p className="text-slate-500">More insights and analytics will be available here soon.</p>
        </div>
      </div>
    </div>
  );
}
