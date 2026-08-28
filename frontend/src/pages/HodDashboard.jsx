import { useState, useEffect } from 'react';
import { Users, FileCheck, ArrowUpRight, Activity, X, UserPlus } from 'lucide-react';
import api from '../api/axios';

export default function HodDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [facultyName, setFacultyName] = useState('');
  const [facultyEmail, setFacultyEmail] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');
  const [designation, setDesignation] = useState('ASSISTANT_PROFESSOR');
  const [isMentor, setIsMentor] = useState(false);
  
  const [faculties, setFaculties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFaculties();
  }, []);

  const fetchFaculties = async () => {
    try {
      const res = await api.get('/users/faculty');
      setFaculties(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/users/faculty', {
        name: facultyName,
        email: facultyEmail,
        password: facultyPassword,
        designation,
        is_mentor: isMentor
      });
      setShowModal(false);
      setFacultyName('');
      setFacultyEmail('');
      setFacultyPassword('');
      setDesignation('ASSISTANT_PROFESSOR');
      setIsMentor(false);
      fetchFaculties();
      alert('Faculty created successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add faculty');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">HOD Dashboard</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Manage Faculty & Approvals
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:opacity-90 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Add Faculty
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(99,102,241,0.12)] transition-all duration-300 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 ease-out" />
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Faculty</h3>
          <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 relative z-10">{faculties.length}</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Department Faculty</h2>
        {faculties.length === 0 ? (
          <p className="text-slate-500">No faculty members found. Create one above!</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {faculties.map((fac) => (
              <div key={fac.id} className="py-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">{fac.name}</h4>
                  <p className="text-sm text-slate-500">{fac.designation} • {fac.email}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Faculty Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Add Faculty Member</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddFaculty} className="p-6">
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg border border-rose-100">{error}</div>}
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Full Name</label>
                  <input type="text" required value={facultyName} onChange={(e) => setFacultyName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Jane Doe" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Email</label>
                  <input type="email" required value={facultyEmail} onChange={(e) => setFacultyEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="jane@institute.edu" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Designation</label>
                  <select 
                    value={designation} 
                    onChange={(e) => setDesignation(e.target.value)} 
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="ASSISTANT_PROFESSOR">Assistant Professor</option>
                    <option value="PROFESSOR">Professor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Temporary Password</label>
                  <input type="password" required value={facultyPassword} onChange={(e) => setFacultyPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter password" />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <input 
                    type="checkbox" 
                    id="isMentor" 
                    checked={isMentor} 
                    onChange={(e) => setIsMentor(e.target.checked)} 
                    className="w-5 h-5 text-indigo-600 rounded-md border-slate-300 focus:ring-indigo-500" 
                  />
                  <label htmlFor="isMentor" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Assign as Mentor (Can add students)
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Creating...' : 'Create Faculty'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
