import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  BookOpen, Search, Bot, History, Sparkles, ShieldCheck,
  LogOut, ArrowRight, ExternalLink, Download, FileText,
  User, CheckCircle2, Trash2, Layers, RefreshCw, Eye,
  Compass, Plus, MessageSquare, Clock, AlertCircle
} from 'lucide-react';

export default function MyHub() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;

  const [normalHistory, setNormalHistory] = useState([]);
  const [aiHistory, setAiHistory] = useState([]);
  const [featuredNotes, setFeaturedNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Authentication guard: if no token, redirect to login
  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    fetchHubData();
  }, []);

  const fetchHubData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [normRes, aiRes, featRes] = await Promise.all([
        api.get('/public/history/normal').catch(() => ({ data: [] })),
        api.get('/public/history/ai-conversations').catch(() => ({ data: [] })),
        api.get('/public/featured-resources').catch(() => ({ data: [] }))
      ]);

      setNormalHistory(Array.isArray(normRes.data) ? normRes.data : []);
      setAiHistory(Array.isArray(aiRes.data) ? aiRes.data : []);
      setFeaturedNotes(Array.isArray(featRes.data) ? featRes.data : []);
    } catch (err) {
      console.warn('Hub data fetch warning:', err.message);
      setError('Unable to load some hub activity metrics.');
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
            <Link
              to="/public-search"
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5 text-indigo-600" />
              <span>Global Search & AI</span>
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
              <span>Personal Knowledge & Research Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Welcome to Your Hub, {user?.name || 'Scholar'}!
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
              Explore live global web knowledge, interact with our grounded Multimodal AI Assistant (with visual diagram & document understanding), and access approved peer academic resources.
            </p>
          </div>

          <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Quick Activity Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{normalHistory.length}</span>
              <span className="text-xs font-semibold text-slate-500">Web Searches Logged</span>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{aiHistory.length}</span>
              <span className="text-xs font-semibold text-slate-500">AI Conversations</span>
            </div>
          </div>

          <div className="p-5 bg-white border border-slate-200/80 rounded-2xl shadow-2xs flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="text-2xl font-black text-slate-900 block">{featuredNotes.length}</span>
              <span className="text-xs font-semibold text-slate-500">Open Community Notes</span>
            </div>
          </div>
        </div>

        {/* Action Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div
            onClick={() => navigate('/public-search')}
            className="p-6 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-indigo-100/70 text-indigo-700 rounded-2xl group-hover:scale-105 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700">Global Normal Search</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Query verified encyclopedic references, documentation indices, and topic-tailored image visualizations with zero fabrications.
              </p>
            </div>
          </div>

          <div
            onClick={() => navigate('/public-search')}
            className="p-6 bg-white hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-3xl transition-all cursor-pointer group shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="p-3 bg-violet-100/70 text-violet-700 rounded-2xl group-hover:scale-105 transition-transform">
                <Bot className="w-6 h-6" />
              </div>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 group-hover:text-violet-700">Multimodal AI Chat Assistant</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ask deep technical questions, upload diagrams or handwritten problems for visual reasoning, and analyze research documents.
              </p>
            </div>
          </div>
        </div>

        {/* Dual Recent History & Featured Notes Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Recent Normal Searches */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">Recent Web Searches</h3>
              </div>
              <Link to="/public-search" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                New Search
              </Link>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading searches...</div>
              ) : normalHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No searches logged yet. Launch a search above!</div>
              ) : (
                normalHistory.slice(0, 5).map(item => (
                  <div
                    key={item.id}
                    onClick={() => navigate('/public-search')}
                    className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-150 hover:border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-indigo-700">
                        {item.query}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {item.search_mode} • {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteNormalItem(e, item.id)}
                      className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Featured Community Notes */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Featured Open Academic Resources</h3>
              </div>
              <Link to="/public-search" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="py-8 text-center text-xs text-slate-400">Loading open resources...</div>
              ) : featuredNotes.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">No open public resources available yet.</div>
              ) : (
                featuredNotes.slice(0, 5).map(doc => (
                  <div
                    key={doc.id}
                    className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-slate-800 block truncate">{doc.title}</span>
                      <span className="text-[10px] text-slate-400">
                        {doc.subject_name || doc.department_name || 'Academic Community'} • {doc.contributor_name ? `Contributed by ${doc.contributor_name}` : 'Verified Open Note'}
                      </span>
                    </div>

                    {doc.file_url && (
                      <a
                        href={doc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    )}
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

    </div>
  );
}
