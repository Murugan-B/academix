import { useState, useEffect } from 'react';
import { BookText, Plus, Trash2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Subjects() {
  const [subjects, setSubjects] = useState([]);
  const [activeSemester, setActiveSemester] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Role detection
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role;
  const isHod = role === 'HOD';

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', code: '', semester: 1 });
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchSubjects();
  }, [activeSemester]);

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/subjects?semester=${activeSemester}`);
      setSubjects(res.data);
    } catch (err) {
      setError('Failed to fetch subjects');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubject = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await api.post('/subjects', formData);
      setShowModal(false);
      setFormData({ name: '', code: '', semester: activeSemester });
      fetchSubjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to add subject');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      fetchSubjects();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete');
    }
  };

  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Subject Management</h1>
          <p className="text-slate-500 font-medium flex items-center gap-2">
            <BookText className="w-4 h-4 text-emerald-500" />
            Manage academic curriculum
          </p>
        </div>
        {isHod && (
          <button 
            onClick={() => {
              setFormData(f => ({ ...f, semester: activeSemester }));
              setShowModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> Add Subject
          </button>
        )}
      </header>

      {/* Semester Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-4 mb-6 scrollbar-hide">
        {semesters.map(sem => (
          <button
            key={sem}
            onClick={() => setActiveSemester(sem)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
              activeSemester === sem 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            Semester {sem}
          </button>
        ))}
      </div>

      {/* Subjects Grid */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
        {loading ? (
          <div className="flex justify-center p-8">
             <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          </div>
        ) : error ? (
          <p className="text-rose-500">{error}</p>
        ) : subjects.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <BookText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No subjects found for Semester {activeSemester}.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {subjects.map(subject => (
              <div 
                key={subject.id} 
                onClick={() => navigate(`/subjects/${subject.id}`)}
                className="p-5 rounded-2xl border border-slate-100 bg-slate-50 flex justify-between items-start hover:shadow-md transition-all group cursor-pointer"
              >
                <div>
                  <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{subject.name}</h3>
                  <p className="text-sm font-semibold text-indigo-600 uppercase tracking-wider">{subject.code}</p>
                </div>
                {isHod && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(subject.id);
                    }}
                    className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-800">Add New Subject</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubject} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Subject Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Data Structures"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Subject Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. CS201"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Semester</label>
                  <select 
                    required
                    value={formData.semester}
                    onChange={(e) => setFormData({...formData, semester: parseInt(e.target.value)})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {semesters.map(s => <option key={s} value={s}>Sem {s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" disabled={adding} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
                  {adding ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
