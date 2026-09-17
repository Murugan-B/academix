import { useState, useEffect } from 'react';
import { BookText, Plus, Trash2, X, FolderOpen, BookOpen } from 'lucide-react';
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
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Subject Curriculum</h1>
          <p className="text-xs md:text-sm text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
            <BookText className="w-4 h-4 text-indigo-600" />
            Manage semester curriculum, units, lessons, and learning materials.
          </p>
        </div>
        {isHod && (
          <button 
            onClick={() => {
              setFormData(f => ({ ...f, semester: activeSemester }));
              setShowModal(true);
            }}
            className="self-start md:self-auto flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" /> Add Subject
          </button>
        )}
      </header>

      {/* Semester Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-slate-200/80">
        {semesters.map(sem => (
          <button
            key={sem}
            onClick={() => setActiveSemester(sem)}
            className={`px-4 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
              activeSemester === sem 
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' 
                : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200'
            }`}
          >
            Semester {sem}
          </button>
        ))}
      </div>

      {/* Subjects Grid */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white p-6 md:p-8">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-12 gap-3">
             <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
             <p className="text-xs font-semibold text-slate-400">Loading semester subjects...</p>
          </div>
        ) : error ? (
          <p className="text-xs text-rose-600 font-bold">{error}</p>
        ) : subjects.length === 0 ? (
          <div className="text-center py-12 px-6 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-lg mx-auto space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">No subjects found for Semester {activeSemester}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHod 
                  ? 'Get started by adding subjects and organizing units and lessons.' 
                  : 'Curriculum subjects for this semester have not been registered yet.'}
              </p>
            </div>
            {isHod && (
              <button
                onClick={() => {
                  setFormData(f => ({ ...f, semester: activeSemester }));
                  setShowModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add First Subject
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map(subject => (
              <div 
                key={subject.id} 
                onClick={() => navigate(`/subjects/${subject.id}`)}
                className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/70 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all group cursor-pointer flex justify-between items-start"
              >
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {subject.code}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-indigo-600 transition-colors pt-1">
                    {subject.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">Semester {subject.semester || activeSemester}</p>
                </div>
                {isHod && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(subject.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Subject"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <h2 className="text-base font-black text-slate-900">Add New Subject</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddSubject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Subject Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Artificial Intelligence"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-xs font-medium"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Subject Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. CS301"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none uppercase text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">Semester</label>
                  <select 
                    required
                    value={formData.semester}
                    onChange={(e) => setFormData({...formData, semester: parseInt(e.target.value)})}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none bg-white text-xs font-medium"
                  >
                    {semesters.map(s => <option key={s} value={s}>Semester {s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-6 pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-xs text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={adding} className="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors">
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
