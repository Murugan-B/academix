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
          <h2 className="text-xl font-bold text-slate-800 mb-6">Your Assigned Mentees</h2>
          {mentees.length === 0 ? (
            <p className="text-slate-500">You have no mentees assigned yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {mentees.map((mentee) => {
                const currentYear = new Date().getFullYear();
                let year = 'N/A';
                if (mentee.batch_start_year) {
                  let diff = currentYear - mentee.batch_start_year;
                  if (new Date().getMonth() >= 7) diff += 1;
                  year = diff === 1 ? '1st Year' : diff === 2 ? '2nd Year' : diff === 3 ? '3rd Year' : diff >= 4 ? '4th Year' : 'Incoming';
                }

                return (
                  <Link 
                    to={`/students/${mentee.id}`} 
                    key={mentee.id} 
                    className="py-4 flex justify-between items-center hover:bg-slate-50 transition-colors -mx-4 px-4 rounded-xl"
                  >
                    <div>
                      <h4 className="font-bold text-indigo-600 hover:text-indigo-800">{mentee.name}</h4>
                      <p className="text-sm text-slate-500">{mentee.roll_number} • {year}</p>
                    </div>
                    <ArrowUpRight className="w-5 h-5 text-slate-400" />
                  </Link>
                );
              })}
            </div>
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
