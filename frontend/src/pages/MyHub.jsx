import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  BookOpen, Search, Bot, History, Sparkles, ShieldCheck,
  LogOut, ArrowRight, ExternalLink, Download, FileText,
  User, CheckCircle2, Trash2, Layers, RefreshCw, Eye,
  Compass, Plus, MessageSquare, Clock, AlertCircle,
  FolderHeart, BookText, CheckSquare, BrainCircuit, Play
} from 'lucide-react';
import AddPublicMaterialModal from '../components/AddPublicMaterialModal';

export default function MyHub() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;

  const [hubOverview, setHubOverview] = useState(null);
  const [normalHistory, setNormalHistory] = useState([]);
  const [aiHistory, setAiHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    fetchHubData();
  }, []);

  const fetchHubData = async () => {
    setLoading(true);
    try {
      const [overviewRes, normRes, aiRes] = await Promise.all([
        api.get('/public/hub-overview').catch(() => ({ data: null })),
        api.get('/public/history/normal').catch(() => ({ data: [] })),
        api.get('/public/history/ai-conversations').catch(() => ({ data: [] }))
      ]);

      setHubOverview(overviewRes.data);
      setNormalHistory(Array.isArray(normRes.data) ? normRes.data : []);
      setAiHistory(Array.isArray(aiRes.data) ? aiRes.data : []);
    } catch (err) {
      console.warn('Hub data fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleDeleteNormalItem = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/public/history/normal/${id}`);
      setNormalHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  const handleDeleteAiItem = async (e, convId) => {
    e.stopPropagation();
    try {
      await api.delete(`/public/history/ai-conversations/${convId}`);
      setAiHistory(prev => prev.filter(item => item.id !== convId));
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const stats = hubOverview?.stats || {
    savedResourcesCount: 0,
    personalNotesCount: 0,
    contributionsCount: 0,
    practiceTestsCount: 0,
    aiRequestsToday: 0
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans">
      
      {/* ── TOP NAVIGATION ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-800 tracking-tight">
              Academix <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full ml-1 uppercase">Scholar Hub</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">+ Add Public Material</span>
            </button>

            <Link
              to="/public-search"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>Search & AI</span>
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-bold text-slate-800">{user?.name || 'Public Scholar'}</span>
                <span className="text-[10px] text-indigo-600 font-semibold uppercase">{user?.role || 'PUBLIC_USER'}</span>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/60 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN HUB WORKSPACE ──────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

        {/* Welcome Banner */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
          <div className="relative z-10 max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-indigo-200 text-xs font-semibold border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Personal Knowledge & Practice Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome back, {user?.name || 'Scholar'}!
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
              Explore verified open course folders, launch AI practice assessments, manage personal study notes, and query our multimodal AI assistant.
            </p>
          </div>

          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ── METRICS SUMMARY CARDS ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div 
            onClick={() => navigate('/saved-materials')}
            className="p-5 bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-3.5 group"
          >
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-105 transition-transform">
              <FolderHeart className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{stats.savedResourcesCount}</span>
              <span className="text-[11px] font-semibold text-slate-500">Saved Materials</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/my-notes')}
            className="p-5 bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-3.5 group"
          >
            <div className="p-3 bg-violet-50 text-violet-600 rounded-2xl group-hover:scale-105 transition-transform">
              <BookText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{stats.personalNotesCount}</span>
              <span className="text-[11px] font-semibold text-slate-500">Study Notes</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/ai-test-generator')}
            className="p-5 bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-3.5 group"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-105 transition-transform">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{stats.practiceTestsCount}</span>
              <span className="text-[11px] font-semibold text-slate-500">Practice Tests</span>
            </div>
          </div>

          <div 
            onClick={() => navigate('/my-contributions')}
            className="p-5 bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl shadow-2xs hover:shadow-sm transition-all cursor-pointer flex items-center gap-3.5 group"
          >
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-105 transition-transform">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{stats.contributionsCount}</span>
              <span className="text-[11px] font-semibold text-slate-500">Contributions</span>
            </div>
          </div>
        </div>

        {/* ── FEATURE GATEWAYS ────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => navigate('/public-library')}
            className="p-5 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-2xs space-y-3"
          >
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl w-fit group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-indigo-700">Public Academic Library</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Explore community course folders, videos & Drive links</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/ai-test-generator')}
            className="p-5 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-2xs space-y-3"
          >
            <div className="p-2.5 bg-violet-50 text-violet-600 rounded-2xl w-fit group-hover:scale-105 transition-transform">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-violet-700">AI Test Generator</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Take adaptive practice tests with automatic grading</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/my-notes')}
            className="p-5 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-2xs space-y-3"
          >
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl w-fit group-hover:scale-105 transition-transform">
              <BookText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700">My Study Notes</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Create Markdown notes or generate revision points with AI</p>
            </div>
          </div>

          <div
            onClick={() => navigate('/public-search')}
            className="p-5 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-2xs space-y-3"
          >
            <div className="p-2.5 bg-sky-50 text-sky-600 rounded-2xl w-fit group-hover:scale-105 transition-transform">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 group-hover:text-sky-700">AI Assistant & Search</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Multimodal diagram understanding & live web grounding</p>
            </div>
          </div>
        </div>

        {/* ── DUAL RECENT ACTIVITY SECTIONS ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Recent Practice Tests */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Recent Practice Assessments</h3>
              </div>
              <Link to="/ai-test-generator" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading tests...</div>
              ) : (hubOverview?.recentTests?.length || 0) === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <BrainCircuit className="w-6 h-6 text-slate-300 mx-auto" />
                  <p>No practice tests generated yet.</p>
                </div>
              ) : (
                hubOverview.recentTests.map(test => (
                  <div
                    key={test.id}
                    onClick={() => navigate('/ai-test-generator')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-150 hover:border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-indigo-700">
                        {test.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {test.topic} • {test.difficulty}
                      </span>
                    </div>
                    {test.best_score !== null ? (
                      <span className="text-xs font-bold text-emerald-600 shrink-0">
                        {parseFloat(test.best_score).toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">Unattempted</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Personal Notes */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookText className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Recent Personal Notes</h3>
              </div>
              <Link to="/my-notes" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                Open Notes
              </Link>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading notes...</div>
              ) : (hubOverview?.recentNotes?.length || 0) === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 space-y-2">
                  <BookText className="w-6 h-6 text-slate-300 mx-auto" />
                  <p>No study notes created yet.</p>
                </div>
              ) : (
                hubOverview.recentNotes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => navigate('/my-notes')}
                    className="p-3 bg-slate-50 hover:bg-emerald-50/40 border border-slate-150 hover:border-emerald-200 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-emerald-800">
                        {note.title}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {note.course_name || 'Personal Note'} • {new Date(note.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Academix Scholar Hub. Grounded academic research and privacy-first student materials.
      </footer>

      {/* ── ADD PUBLIC MATERIAL MODAL ────────────────────────────────────────── */}
      <AddPublicMaterialModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchHubData()}
      />

    </div>
  );
}
