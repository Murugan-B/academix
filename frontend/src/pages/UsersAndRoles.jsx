import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Building, GraduationCap, Activity, RefreshCw, X, ChevronRight } from 'lucide-react';
import api from '../api/axios';

export default function UsersAndRoles() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Transfer Admin State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedInstitute, setSelectedInstitute] = useState(null);
  const [newAdminId, setNewAdminId] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);

  // Navigation State
  const [activeDeptTab, setActiveDeptTab] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('HOD'); // HOD, FACULTY, STUDENTS
  const [activeHodTab, setActiveHodTab] = useState('FACULTY'); // FACULTY, STUDENTS

  useEffect(() => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    if (user?.role === 'STUDENT') {
      navigate('/student', { replace: true });
      return;
    }
    fetchHierarchy();
  }, [navigate]);

  const fetchHierarchy = async () => {
    try {
      const res = await api.get('/users/hierarchy');
      setData(res.data);
      if (res.data.role === 'INSTITUTE_ADMIN' && res.data.departments?.length > 0) {
        setActiveDeptTab(res.data.departments[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load hierarchy');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminId) return alert('Please select a new admin from the list.');
    setTransferLoading(true);
    try {
      await api.post('/institutes/transfer-admin', {
        institute_id: selectedInstitute.id,
        new_admin_id: newAdminId
      });
      setShowTransferModal(false);
      setNewAdminId('');
      alert('Admin transferred successfully!');
      fetchHierarchy();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to transfer admin');
    } finally {
      setTransferLoading(false);
    }
  };

  const openTransferModal = (institute) => {
    setSelectedInstitute(institute);
    setShowTransferModal(true);
  };

  if (loading) return <div className="p-8 text-slate-500 font-medium">Loading hierarchical data...</div>;
  if (error) return <div className="p-8 text-rose-500 font-medium">{error}</div>;
  if (!data) return null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Users & Roles</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            Hierarchical View
          </p>
        </div>
      </header>

      {/* SUPER ADMIN VIEW */}
      {data.role === 'SUPER_ADMIN' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-500" /> Managed Institutes
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.institutes?.map(inst => {
              const admin = data.admins?.find(a => a.institute_id === inst.id);
              return (
                <div key={inst.id} className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex flex-col justify-between hover:shadow-md transition-all group">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{inst.name}</h3>
                    {admin ? (
                      <div className="mb-4">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mb-2">Current Admin</span>
                        <p className="text-sm font-semibold text-slate-700">{admin.name}</p>
                        <p className="text-xs text-slate-500">{admin.email}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-rose-500 italic mb-4">No Admin Assigned</p>
                    )}
                  </div>
                  <button 
                    onClick={() => openTransferModal(inst)}
                    className="w-full py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Transfer Admin
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* INSTITUTE ADMIN VIEW */}
      {data.role === 'INSTITUTE_ADMIN' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
          {/* Department Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-50/50 p-4 gap-2 scrollbar-hide">
            {data.departments?.map(dept => (
              <button
                key={dept.id}
                onClick={() => setActiveDeptTab(dept.id)}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
                  activeDeptTab === dept.id 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-600 hover:bg-slate-200/50'
                }`}
              >
                {dept.name}
              </button>
            ))}
            {data.departments?.length === 0 && <span className="text-sm text-slate-500 p-2">No departments created yet.</span>}
          </div>

          {activeDeptTab && (
            <div className="p-8">
              {/* Sub Tabs */}
              <div className="flex gap-6 border-b border-slate-100 mb-6">
                {['HOD', 'FACULTY', 'STUDENTS'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveSubTab(tab)}
                    className={`pb-3 text-sm font-bold transition-all relative ${
                      activeSubTab === tab ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                    {activeSubTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full" />}
                  </button>
                ))}
              </div>

              {/* Sub Tab Content */}
              <div className="grid gap-3">
                {(() => {
                  const activeDeptName = data.departments.find(d => d.id === activeDeptTab)?.name;
                  const filteredUsers = data.users?.filter(u => u.department_name === activeDeptName);
                  
                  let displayUsers = [];
                  if (activeSubTab === 'HOD') displayUsers = filteredUsers.filter(u => u.role === 'HOD');
                  if (activeSubTab === 'FACULTY') displayUsers = filteredUsers.filter(u => u.role === 'FACULTY');
                  if (activeSubTab === 'STUDENTS') displayUsers = filteredUsers.filter(u => u.role === 'STUDENT');

                  if (displayUsers.length === 0) return <p className="text-slate-400 italic text-sm py-4">No {activeSubTab.toLowerCase()} found.</p>;

                  return displayUsers.map(user => (
                    <div key={user.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center hover:bg-white transition-colors">
                      <div>
                        <p className="font-bold text-slate-800">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{user.designation || user.role}</span>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HOD VIEW */}
      {data.role === 'HOD' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50 p-4 gap-2">
            <button
              onClick={() => setActiveHodTab('FACULTY')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeHodTab === 'FACULTY' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              Faculty List
            </button>
            <button
              onClick={() => setActiveHodTab('STUDENTS')}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeHodTab === 'STUDENTS' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200/50'
              }`}
            >
              All Students
            </button>
          </div>
          
          <div className="p-8">
            <div className="grid gap-3">
              {data.users?.filter(u => u.role === activeHodTab).length === 0 ? (
                <p className="text-slate-400 italic text-sm py-4">No {activeHodTab.toLowerCase()} found.</p>
              ) : (
                data.users?.filter(u => u.role === activeHodTab).map(user => (
                  <div key={user.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex justify-between items-center hover:bg-white transition-colors">
                    <div>
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        {user.name} 
                        {user.is_mentor && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded-full uppercase tracking-wider">Mentor</span>}
                      </p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{user.designation || 'Student'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* FACULTY VIEW */}
      {data.role === 'FACULTY' && (
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> My Assigned Mentees
          </h2>
          {data.users?.length === 0 ? (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <p className="text-slate-500 font-medium">You have no mentees assigned.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.users?.map(mentee => (
                <div key={mentee.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:shadow-md transition-shadow flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600 flex items-center justify-center font-bold text-lg shadow-inner border border-white">
                    {mentee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{mentee.name}</p>
                    <p className="text-xs font-medium text-slate-500">{mentee.email}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transfer Admin Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Transfer Ownership</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleTransferAdmin} className="p-6">
              <p className="text-sm text-slate-600 mb-6">
                Select a user to transfer Institute Admin rights to for <strong className="text-indigo-600">{selectedInstitute?.name}</strong>. The current admin will be demoted to Faculty.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">Select New Admin</label>
                <select 
                  required
                  value={newAdminId}
                  onChange={(e) => setNewAdminId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="" disabled>-- Choose a user --</option>
                  {data.allUsers?.filter(u => u.institute_id === selectedInstitute?.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role}</option>
                  ))}
                  {data.allUsers?.filter(u => u.institute_id === selectedInstitute?.id).length === 0 && (
                    <option disabled>No eligible users found in this institute.</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowTransferModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={transferLoading || !newAdminId} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                  {transferLoading ? 'Transferring...' : 'Confirm Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
