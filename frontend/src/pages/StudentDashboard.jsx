import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, BookOpen, Clock, Activity, ChevronRight, BrainCircuit } from 'lucide-react';
import api from '../api/axios';
import NotificationPanel from '../components/NotificationPanel';

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
      
      const analyticsRes = await api.get(`/analytics/student`);
      setAnalytics(analyticsRes.data);
      if (analyticsRes.data.recentAttempts?.length > 0) {
        setSelectedAttempt(analyticsRes.data.recentAttempts[0]);
      }
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

  const getTopicAnalysis = () => {
    if (!selectedAttempt || !selectedAttempt.answers || selectedAttempt.answers.length === 0) return null;
    
    const topics = {};
    selectedAttempt.answers.forEach(ans => {
      if (!topics[ans.topic_tag]) {
        topics[ans.topic_tag] = { total: 0, correct: 0 };
      }
      topics[ans.topic_tag].total += 1;
      if (ans.is_correct) topics[ans.topic_tag].correct += 1;
    });

    const analyzed = Object.keys(topics).map(topic => {
      return {
        topic,
        percentage: Math.round((topics[topic].correct / topics[topic].total) * 100)
      };
    });

    const goodAt = analyzed.filter(t => t.percentage > 50).sort((a, b) => b.percentage - a.percentage);
    const needToFocus = analyzed.filter(t => t.percentage <= 50).sort((a, b) => a.percentage - b.percentage);
    
    return { goodAt, needToFocus };
  };

  const topicAnalysis = getTopicAnalysis();

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
          
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col">
            <h3 className="font-bold text-slate-500 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2"><BookOpen className="w-4 h-4" /> Topics to Focus On</span>
            </h3>
            {selectedAttempt && (
              <p className="text-xs text-slate-400 font-medium mb-4 pb-4 border-b border-slate-100">
                Analyzing: {selectedAttempt.material_title || selectedAttempt.quiz_title} — Attempt {selectedAttempt.attempt_number} — {parseFloat(selectedAttempt.percentage).toFixed(1)}%
              </p>
            )}

            {!selectedAttempt ? (
               <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400">
                 <p className="font-medium">No quiz attempts yet.</p>
               </div>
            ) : !topicAnalysis ? (
               <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400">
                 <p className="font-medium">Topic-wise analysis is not available for this attempt.</p>
               </div>
            ) : (
              <div className="flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar pr-1">
                {/* Good At Section */}
                <div>
                  <h4 className="text-xs font-bold text-emerald-500 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                    ✓ Good At
                  </h4>
                  {topicAnalysis.goodAt.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {topicAnalysis.goodAt.map((t, i) => (
                        <div key={i} className="flex justify-between items-center bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100/50">
                          <span className="font-semibold text-sm text-slate-700">{t.topic}</span>
                          <span className="text-sm font-bold text-emerald-600">{t.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">None identified in this attempt.</p>
                  )}
                </div>

                {/* Need to Focus On Section */}
                <div>
                  <h4 className="text-xs font-bold text-rose-500 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                    ⚠ Need to Focus On
                  </h4>
                  {topicAnalysis.needToFocus.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {topicAnalysis.needToFocus.map((t, i) => (
                        <div key={i} className="flex justify-between items-center bg-rose-50/50 p-2.5 rounded-xl border border-rose-100/50">
                          <span className="font-semibold text-sm text-slate-700">{t.topic}</span>
                          <span className="text-sm font-bold text-rose-600">{t.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">None! Great job on this attempt.</p>
                  )}
                </div>

                {/* AI Recommendation Section */}
                {selectedAttempt.ai_recommendation && (
                  <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mt-2">
                    <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BrainCircuit className="w-3.5 h-3.5" /> AI Recommendation
                    </p>
                    <p className="text-slate-600 text-sm leading-relaxed">{selectedAttempt.ai_recommendation}</p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-500 flex items-center gap-2"><Clock className="w-4 h-4" /> Recent Attempts</h3>
              {selectedAttempt && (
                <button 
                  onClick={() => navigate(`/attempt-review/${selectedAttempt.id}`)}
                  className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  View Full Details <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
            {analytics.recentAttempts?.length > 0 ? (
               <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar pr-1">
                 {analytics.recentAttempts.map(att => {
                   const isSelected = selectedAttempt?.id === att.id;
                   return (
                     <button
                       key={att.id}
                       onClick={() => setSelectedAttempt(att)}
                       className={`w-full text-left flex items-center justify-between p-3 rounded-xl border transition-all group active:scale-[0.99] ${
                         isSelected 
                           ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' 
                           : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                       }`}
                     >
                        <div className="truncate pr-3 flex-1">
                          <p className={`text-sm font-bold truncate transition-colors ${isSelected ? 'text-indigo-700' : 'text-slate-700 group-hover:text-slate-900'}`}>
                            {att.material_title || att.quiz_title}
                          </p>
                          <p className={`text-xs font-medium ${isSelected ? 'text-indigo-500' : 'text-slate-500'}`}>
                            Attempt {att.attempt_number}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                           <div className="flex flex-col items-end">
                             <span className={`text-sm font-bold ${att.status === 'PASSED' ? 'text-emerald-500' : 'text-rose-500'}`}>
                               {parseFloat(att.percentage).toFixed(1)}%
                             </span>
                             <span className={`text-[10px] font-bold ${att.status === 'PASSED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                               {att.status === 'PASSED' ? 'PASSED' : 'FAILED'}
                             </span>
                           </div>
                           <ChevronRight className={`w-4 h-4 transition-all ${isSelected ? 'text-indigo-500 translate-x-0.5' : 'text-slate-300 group-hover:text-slate-400'}`} />
                        </div>
                     </button>
                   );
                 })}
               </div>
            ) : (
              <div className="flex flex-col items-center justify-center flex-1 text-center text-slate-400">
                <p className="font-medium">No recent attempts.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
