import { useState, useEffect } from 'react';
import { Users, FileUp, Activity, ArrowUpRight, X, UserPlus, Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import NotificationPanel from '../components/NotificationPanel';
import CreateNotification from '../components/CreateNotification';

export default function FacultyDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [showCreateNotification, setShowCreateNotification] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  const [batchStart, setBatchStart] = useState('');
  const [batchEnd, setBatchEnd] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState([]);
  
  const [mentees, setMentees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Get current user details from local storage to check if mentor
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isMentor = user?.is_mentor === true;

  useEffect(() => {
    fetchMentees();
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      if (user?.institute_id) {
        // Since faculty doesn't have an API to fetch all departments globally, 
        // they can just implicitly use their own department if we don't have the API.
        // Wait, for faculty, they only add to their department, so let's default to their department ID.
        setDepartmentId(user.department_id);
      }
    } catch (err) {}
  };

  const fetchMentees = async () => {
    try {
      const res = await api.get('/users/mentees');
      setMentees(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/users/student', {
        name: studentName,
        email: studentEmail,
        password: studentPassword,
        batch_start_year: batchStart,
        batch_end_year: batchEnd,
        roll_number: rollNumber,
        department_id: departmentId
      });
      setShowModal(false);
      setStudentName('');
      setStudentEmail('');
      setStudentPassword('');
      setBatchStart('');
      setBatchEnd('');
      setRollNumber('');
      fetchMentees();
      alert('Student created and added to your mentees successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add student');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Faculty / Mentor</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Track Mentees & Resources
          </p>
        </div>
        <div className="flex gap-3">
          {isMentor && (
            <>
              <button 
                onClick={() => setShowCreateNotification(true)}
                className="px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-semibold shadow-sm hover:shadow border border-indigo-100 hover:bg-indigo-50 transition-all flex items-center gap-2"
              >
                Create Notification
              </button>
              <button 
                onClick={() => setShowModal(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5" />
                Add Student Mentee
              </button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(99,102,241,0.12)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 ease-out" />
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Mentees</h3>
          <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 relative z-10">{mentees.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="lg:col-span-2 bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Your Assigned Mentees</h2>
              <p className="text-xs text-slate-500 mt-0.5">Organized dynamically by academic year</p>
            </div>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100">
              {mentees.length} Total {mentees.length === 1 ? 'Mentee' : 'Mentees'}
            </span>
          </div>

          {mentees.length === 0 ? (
            <p className="text-slate-500 text-sm py-4">You have no mentees assigned yet.</p>
          ) : (
            (() => {
              const getAcademicYearLabel = (batchStartYear) => {
                if (!batchStartYear) return 'Year not available';
                const currentYear = new Date().getFullYear();
                let diff = currentYear - parseInt(batchStartYear);
                if (new Date().getMonth() >= 7) diff += 1;
                if (diff === 1) return '1st Year';
                if (diff === 2) return '2nd Year';
                if (diff === 3) return '3rd Year';
                if (diff >= 4) return '4th Year';
                return 'Incoming';
              };

              const groupedMentees = mentees.reduce((acc, mentee) => {
                const yearLabel = getAcademicYearLabel(mentee.batch_start_year);
                if (!acc[yearLabel]) acc[yearLabel] = [];
                acc[yearLabel].push(mentee);
                return acc;
              }, {});

              const yearSortOrder = ['4th Year', '3rd Year', '2nd Year', '1st Year', 'Incoming', 'Year not available'];
              const sortedYears = Object.keys(groupedMentees).sort((a, b) => {
                const idxA = yearSortOrder.indexOf(a);
                const idxB = yearSortOrder.indexOf(b);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return a.localeCompare(b);
              });

              return (
                <div className="space-y-6">
                  {sortedYears.map((yearKey) => {
                    const studentsInYear = groupedMentees[yearKey] || [];
                    return (
                      <div key={yearKey} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <h3 className="text-sm font-extrabold text-slate-700 tracking-wide uppercase flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            {yearKey}
                          </h3>
                          <span className="text-xs font-semibold text-slate-400">
                            {studentsInYear.length} {studentsInYear.length === 1 ? 'student' : 'students'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {studentsInYear.map((mentee) => (
                            <Link 
                              to={`/students/${mentee.id}`} 
                              key={mentee.id} 
                              className="p-4 bg-slate-50/70 hover:bg-indigo-50/50 border border-slate-100 hover:border-indigo-200 rounded-2xl transition-all group flex items-center justify-between gap-3 shadow-xs"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white flex items-center justify-center font-bold text-sm border border-slate-200/60 group-hover:border-transparent transition-colors shrink-0 shadow-xs">
                                  {mentee.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">{mentee.name}</h4>
                                  <p className="text-xs text-slate-500 font-medium truncate">
                                    Reg No: <span className="text-slate-700">{mentee.roll_number || 'N/A'}</span>
                                  </p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    Dept: {mentee.department_name || user?.department_name || 'Department'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs font-bold text-indigo-600 bg-white group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl border border-indigo-100 group-hover:border-transparent transition-all shadow-xs flex items-center gap-1 shrink-0">
                                View Student
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
        <div>
          <NotificationPanel />
        </div>
      </div>

      {/* Add Student Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Add Student Mentee</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddStudent} className="p-6">
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg border border-rose-100">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Student Name</label>
                  <input type="text" required value={studentName} onChange={(e) => setStudentName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Alex" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Student Email</label>
                  <input type="email" required value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="alex@institute.edu" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Roll Number</label>
                  <input type="text" required value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 7376242AD225" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input type="password" required value={studentPassword} onChange={(e) => setStudentPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter password" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Batch Start Year</label>
                  <input type="number" required value={batchStart} onChange={(e) => setBatchStart(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 2025" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Batch End Year</label>
                  <input type="number" required value={batchEnd} onChange={(e) => setBatchEnd(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. 2029" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Creating...' : 'Create Student'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Notification Modal */}
      {showCreateNotification && (
        <CreateNotification 
          onClose={() => setShowCreateNotification(false)}
          onSuccess={() => {
            setShowCreateNotification(false);
          }}
        />
      )}
    </div>
  );
}
