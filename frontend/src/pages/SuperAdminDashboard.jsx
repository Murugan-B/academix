import { useState, useEffect } from 'react';
import { Building2, Users, FileCheck, ArrowUpRight, Activity, X } from 'lucide-react';
import api from '../api/axios';
import CreateNotification from '../components/CreateNotification';
import NotificationPanel from '../components/NotificationPanel';

export default function SuperAdminDashboard() {
  const [showModal, setShowModal] = useState(false);
  const [showCreateNotification, setShowCreateNotification] = useState(false);
  
  // Form State
  const [instituteName, setInstituteName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  const [institutesCount, setInstitutesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      const res = await api.get('/institutes');
      setInstitutesCount(res.data.length);
    } catch (err) {
      console.error('Failed to fetch institutes', err);
    }
  };

  const handleAddInstitute = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/institutes', { 
        name: instituteName,
        adminName,
        adminEmail,
        adminPassword
      });
      setShowModal(false);
      setInstituteName('');
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
      fetchInstitutes();
      alert('Institute and Institute Admin created successfully! They can now log in.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add institute');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Overview</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            System is running smoothly
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
            onClick={() => alert('Report exporting is under development.')}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold shadow-sm hover:bg-slate-50 hover:shadow transition-all"
          >
            Export Report
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-xl font-semibold shadow-md shadow-indigo-200 hover:shadow-lg hover:opacity-90 hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            Add Institute
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {/* Stat Card 1 */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(99,102,241,0.12)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 ease-out" />
          <div className="relative flex justify-between items-start mb-6">
            <div className="p-3.5 bg-indigo-100 text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300 shadow-inner">
              <Building2 className="w-7 h-7" />
            </div>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <ArrowUpRight className="w-3 h-3" /> Live
            </span>
          </div>
          <div className="relative">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Total Institutes</h3>
            <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">
              {institutesCount}
            </p>
          </div>
        </div>

        {/* Stat Card 2 */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(16,185,129,0.12)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 ease-out" />
          <div className="relative flex justify-between items-start mb-6">
            <div className="p-3.5 bg-emerald-100 text-emerald-600 rounded-2xl group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 shadow-inner">
              <Users className="w-7 h-7" />
            </div>
          </div>
          <div className="relative">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Active Users</h3>
            <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">1</p>
          </div>
        </div>

        {/* Stat Card 3 */}
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white hover:-translate-y-1 hover:shadow-[0_8px_40px_rgb(245,158,11,0.12)] transition-all duration-300 group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110 duration-500 ease-out" />
          <div className="relative flex justify-between items-start mb-6">
            <div className="p-3.5 bg-amber-100 text-amber-600 rounded-2xl group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300 shadow-inner">
              <FileCheck className="w-7 h-7" />
            </div>
          </div>
          <div className="relative">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Pending Approvals</h3>
            <p className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600">0</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <NotificationPanel />
      </div>

      {/* Modal Overlay for Add Institute & Admin */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Add Institute & Administrator</h2>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddInstitute} className="p-6">
              {error && (
                <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm font-medium rounded-lg border border-rose-100">
                  {error}
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="md:col-span-2">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 border-b pb-2">Institute Details</h3>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Institute Name</label>
                  <input
                    type="text"
                    required
                    value={instituteName}
                    onChange={(e) => setInstituteName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="e.g. Stanford University"
                  />
                </div>

                <div className="md:col-span-2 mt-2">
                  <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 border-b pb-2">Admin Account Details</h3>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Admin Full Name</label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="admin@stanford.edu"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-2">Admin Temporary Password</label>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="Enter a strong password"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-sm"
                >
                  {loading ? 'Processing...' : 'Save Institute & Admin'}
                </button>
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
            alert('Notification sent successfully!');
          }}
        />
      )}
    </div>
  );
}
