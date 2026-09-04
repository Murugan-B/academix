import { useState, useEffect } from 'react';
import { Building, Users, FileCheck, ArrowUpRight, Activity, X } from 'lucide-react';
import api from '../api/axios';
import CreateNotification from '../components/CreateNotification';
import NotificationPanel from '../components/NotificationPanel';

export default function InstituteAdminDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [showCreateNotification, setShowCreateNotification] = useState(false);
  const [deptName, setDeptName] = useState('');
  const [hodName, setHodName] = useState('');
  const [hodEmail, setHodEmail] = useState('');
  const [hodPassword, setHodPassword] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDepartment = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/departments', {
        name: deptName,
        hodName,
        hodEmail,
        hodPassword
      });
      setShowModal(false);
      setDeptName('');
      setHodName('');
      setHodEmail('');
      setHodPassword('');
      fetchDepartments();
      alert('Department and HOD created successfully!');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Institute Admin</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Manage Departments & HODs
          </p>
        </div>
        <div className="flex gap-3">
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
            Add Department
          </button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-8">
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(99,102,241,0.12)] transition-all duration-300">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Departments</h3>
          <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">{departments.length}</p>
        </div>
      </div>

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
        <h2 className="text-xl font-bold text-slate-800 mb-6">Active Departments</h2>
        {departments.length === 0 ? (
          <p className="text-slate-500">No departments found. Create one above!</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {departments.map((dept) => (
              <div key={dept.id} className="py-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-800">{dept.name}</h4>
                  <p className="text-sm text-slate-500">HOD: {dept.hod_name || 'Unassigned'} ({dept.hod_email})</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8">
        <NotificationPanel />
      </div>

      {/* Modal Overlay */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Add Department & HOD</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddDepartment} className="p-6">
              {error && <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg border border-rose-100">{error}</div>}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="md:col-span-2">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 border-b pb-2">Department Details</h3>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Department Name</label>
                  <input type="text" required value={deptName} onChange={(e) => setDeptName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Computer Science" />
                </div>
                <div className="md:col-span-2 mt-2">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 border-b pb-2">HOD Account Details</h3>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">HOD Full Name</label>
                  <input type="text" required value={hodName} onChange={(e) => setHodName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Dr. Smith" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">HOD Email</label>
                  <input type="email" required value={hodEmail} onChange={(e) => setHodEmail(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="smith@cs.edu" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">HOD Temporary Password</label>
                  <input type="password" required value={hodPassword} onChange={(e) => setHodPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Enter password" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">{loading ? 'Processing...' : 'Save Department & HOD'}</button>
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
