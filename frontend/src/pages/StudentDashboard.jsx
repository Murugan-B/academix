import React, { useState, useEffect } from 'react';
import { User, BookOpen, Clock, Activity } from 'lucide-react';
import api from '../api/axios';
import NotificationPanel from '../components/NotificationPanel';

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user) return;

      const profileRes = await api.get(`/users/student/${user.id}`);
      setProfile(profileRes.data);
    } catch (err) {
      console.error(err);
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

  if (!profile) return <div>Failed to load profile.</div>;

  // Calculate current year
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  let academicYear = '1st Year';
  if (profile.batch_start_year) {
    let yearDiff = currentYear - profile.batch_start_year;
    if (currentMonth >= 7) yearDiff += 1; // Assuming academic year starts in August
    if (yearDiff === 1) academicYear = '1st Year';
    else if (yearDiff === 2) academicYear = '2nd Year';
    else if (yearDiff === 3) academicYear = '3rd Year';
    else if (yearDiff === 4) academicYear = '4th Year';
    else if (yearDiff > 4) academicYear = 'Alumni';
    else academicYear = 'Incoming';
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Welcome, {profile.name}</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Student Dashboard
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Profile Card */}
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-500" />
            Student Profile
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-slate-500 font-medium">Roll Number</p>
              <p className="text-lg font-bold text-slate-800">{profile.roll_number || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Department</p>
              <p className="text-lg font-bold text-slate-800">{profile.department_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Current Year</p>
              <p className="text-lg font-bold text-slate-800">{academicYear}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Batch</p>
              <p className="text-lg font-bold text-slate-800">
                {profile.batch_start_year} - {profile.batch_end_year}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Mentor</p>
              <p className="text-lg font-bold text-slate-800">{profile.mentor_name || 'Not Assigned'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Email</p>
              <p className="text-sm font-bold text-slate-800 truncate">{profile.email}</p>
            </div>
          </div>
        </div>

        {/* Notifications Panel */}
        <NotificationPanel />
      </div>
    </div>
  );
}
