import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Search, Bot, Sparkles, BookOpen, FileText, ExternalLink,
  ShieldCheck, Globe, CheckCircle2, ArrowRight, BookMarked,
  Layers, Filter, Copy, Check, Info, AlertTriangle, ArrowLeft,
  GraduationCap, Download, Eye, RefreshCw
} from 'lucide-react';

export default function PublicSearch() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('normal'); // 'normal' | 'ai'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Normal Search State
  const [internalResults, setInternalResults] = useState([]);
  const [externalResults, setExternalResults] = useState([]);
  const [featuredResources, setFeaturedResources] = useState([]);
  const [normalFilter, setNormalFilter] = useState('all'); // 'all' | 'internal' | 'external'

  // AI Search State
  const [aiProvider, setAiProvider] = useState('gemini');
  const [aiResponse, setAiResponse] = useState(null);
  const [copied, setCopied] = useState(false);

  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;

  // Load featured resources on initial mount
  useEffect(() => {
    fetchFeaturedResources();
  }, []);

  const fetchFeaturedResources = async () => {
    try {
      const res = await api.get('/public/featured-resources');
      setFeaturedResources(res.data || []);
    } catch (err) {
      console.warn('Failed to load featured resources:', err.message);
    }
  };

  // Perform Normal Search
  const handleNormalSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.get(`/public/search?query=${encodeURIComponent(searchQuery.trim())}`);
      setInternalResults(res.data.internalResults || []);
      setExternalResults(res.data.externalResults || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Perform AI Search
  const handleAiSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setAiResponse(null);

    try {
      const res = await api.post('/public/ai-search', {
        query: searchQuery.trim(),
        provider: aiProvider
      });
      setAiResponse(res.data);
    } catch (err) {
      setAiResponse({
        error: err.response?.data?.message || err.message || 'AI Search encountered an error.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exampleQuestions = [
    'Explain backpropagation algorithm and gradient descent',
    'What is the difference between TCP and UDP protocols?',
    'What is the time complexity of QuickSort vs MergeSort?',
    'How does relational database ACID transaction model work?'
  ];

  const getDashboardRoute = () => {
    if (!user) return '/login';
    const role = user.role;
    if (role === 'SUPER_ADMIN') return '/super-admin';
    if (role === 'INSTITUTE_ADMIN') return '/institute-admin';
    if (role === 'HOD') return '/hod';
    if (role === 'FACULTY') return '/faculty';
    if (role === 'PUBLIC_USER') return '/public-search';
    return '/student';
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-800 tracking-tight">
              Academix <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full ml-1 uppercase">Search</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 hidden sm:inline">
                  Signed in as <strong className="text-slate-800">{user.name}</strong> ({user.role})
                </span>
                <button
                  onClick={() => navigate(getDashboardRoute())}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <span>{user.role === 'PUBLIC_USER' ? 'My Hub' : 'Dashboard'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
                >
                  Create Public Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN SEARCH CONTAINER ────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Search Hero Box */}
        <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
          {/* Ambient Glows */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-3xl mx-auto text-center space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs font-bold text-indigo-200">
              <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
              <span>Public Educational Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
              Search Open Academic Resources & AI Knowledge
            </h1>

            <p className="text-sm text-indigo-200/90 max-w-xl mx-auto">
              Find verified study notes, approved curriculum materials, external references, and get grounded AI answers.
            </p>

            {/* Mode Switcher Tabs */}
            <div className="pt-3 flex justify-center">
              <div className="inline-flex p-1 bg-white/10 backdrop-blur-lg border border-white/10 rounded-2xl">
                <button
                  type="button"
                  onClick={() => { setActiveTab('normal'); setHasSearched(false); }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'normal'
                      ? 'bg-white text-indigo-950 shadow-md'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Normal Search</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setActiveTab('ai'); setHasSearched(false); }}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                    activeTab === 'ai'
                      ? 'bg-white text-indigo-950 shadow-md'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  <span>AI Search</span>
                </button>
              </div>
            </div>

            {/* Main Search Input Form */}
            <form
              onSubmit={activeTab === 'normal' ? handleNormalSearch : handleAiSearch}
              className="pt-2 max-w-2xl mx-auto"
            >
              <div className="relative flex items-center">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    activeTab === 'normal'
                      ? 'Search open notes, topics, formulas, or subjects...'
                      : 'Ask any academic concept, formula, or topic for AI explanation...'
                  }
                  className="w-full bg-white text-slate-900 placeholder-slate-400 rounded-2xl pl-12 pr-32 py-3.5 text-sm font-medium shadow-lg focus:outline-none focus:ring-4 focus:ring-indigo-400/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={loading || !searchQuery.trim()}
                  className="absolute right-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <span>Search</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* AI Options Toolbar (if in AI Search mode) */}
              {activeTab === 'ai' && (
                <div className="flex items-center justify-between mt-3 px-1 text-xs text-indigo-200">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Grounded answering with genuine source citations
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-indigo-300">AI Model:</span>
                    <select
                      value={aiProvider}
                      onChange={(e) => setAiProvider(e.target.value)}
                      className="bg-white/15 border border-white/20 rounded-lg px-2 py-1 text-[11px] font-bold text-white outline-none cursor-pointer"
                    >
                      <option value="gemini" className="text-slate-900">Gemini 2.5 Flash</option>
                      <option value="openrouter" className="text-slate-900">OpenRouter</option>
                    </select>
                  </div>
                </div>
              )}
            </form>

            {/* Quick Example Chips */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[11px] text-indigo-300 font-semibold">Try asking:</span>
              {exampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSearchQuery(q);
                    if (activeTab === 'normal') {
                      setTimeout(() => handleNormalSearch(), 50);
                    } else {
                      setTimeout(() => handleAiSearch(), 50);
                    }
                  }}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 border border-white/10 rounded-lg text-[11px] text-indigo-100 font-medium transition-all"
                >
                  {q.length > 35 ? q.substring(0, 35) + '...' : q}
                </button>
              ))}
            </div>

          </div>
        </div>

        {/* ── SEARCH RESULTS / FEATURED CONTENT ────────────────────────────────── */}

        {/* 1. NORMAL SEARCH RESULTS */}
        {activeTab === 'normal' && hasSearched && (
          <div className="space-y-6 animate-in fade-in duration-300">
            
            {/* Filter Pills & Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Search Results for "{searchQuery}"
                </h2>
                <p className="text-xs text-slate-500">
                  Found {internalResults.length} approved academic materials and {externalResults.length} verified external references
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setNormalFilter('all')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    normalFilter === 'all'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All ({internalResults.length + externalResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNormalFilter('internal')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    normalFilter === 'internal'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Approved Notes ({internalResults.length})
                </button>
                <button
                  type="button"
                  onClick={() => setNormalFilter('external')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    normalFilter === 'external'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  External References ({externalResults.length})
                </button>
              </div>
            </div>

            {/* Zero Results State */}
            {internalResults.length === 0 && externalResults.length === 0 && !loading && (
              <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                  <Search className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-800">No matching public resources found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try searching with broader educational terms or switch to AI Search to generate an in-depth pedagogical explanation.
                </p>
                <button
                  type="button"
                  onClick={() => { setActiveTab('ai'); handleAiSearch(); }}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-xs"
                >
                  Ask Academix AI instead
                </button>
              </div>
            )}

            {/* Section 1: Internal Approved Academic Notes */}
            {(normalFilter === 'all' || normalFilter === 'internal') && internalResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <BookMarked className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Approved Academic Materials ({internalResults.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {internalResults.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Approved Note
                          </span>
                          {item.fileType && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                              {item.fileType}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {item.title}
                        </h4>

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>

                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.tags.map((t, idx) => (
                              <span key={idx} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md border border-slate-150">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-400 text-[11px]">
                          {item.subject || item.department || 'Academic Resource'}
                        </span>
                        {item.fileUrl && (
                          <a
                            href={item.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>View Resource</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: External Verified References (Wikipedia / DDG) */}
            {(normalFilter === 'all' || normalFilter === 'external') && externalResults.length > 0 && (
              <div className="space-y-3 pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                    <Globe className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Verified External Educational References ({externalResults.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {externalResults.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-sky-200 transition-all space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            <Globe className="w-3 h-3 text-sky-600" />
                            External Reference
                          </span>
                          <span className="text-[10px] font-semibold text-slate-400">
                            {item.source}
                          </span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 leading-snug">
                          {item.title}
                        </h4>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {item.snippet}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 flex items-center justify-end text-xs">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-sky-600 hover:text-sky-800"
                        >
                          <span>Open Full Reference</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* 2. AI SEARCH RESULTS */}
        {activeTab === 'ai' && hasSearched && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {loading ? (
              <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto animate-pulse">
                  <Bot className="w-6 h-6 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Synthesizing Grounded Explanation...</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Querying educational intelligence and verifying sources with {aiProvider === 'gemini' ? 'Gemini 2.5 Flash' : 'OpenRouter'}.
                </p>
              </div>
            ) : aiResponse?.error ? (
              <div className="p-5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl">
                {aiResponse.error}
              </div>
            ) : aiResponse ? (
              <div className="space-y-4">
                
                {/* Source Grounding Banner */}
                <div className={`p-4 rounded-2xl border flex items-start justify-between gap-4 ${
                  aiResponse.sourceClassification === 'APPROVED_ACADEMIC_RESOURCE'
                    ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                    : aiResponse.sourceClassification === 'EXTERNAL_VERIFIED_REFERENCE'
                    ? 'bg-sky-50/90 border-sky-200 text-sky-900'
                    : 'bg-indigo-50/90 border-indigo-200 text-indigo-900'
                }`}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        {aiResponse.sourceClassification === 'APPROVED_ACADEMIC_RESOURCE'
                          ? 'Grounded in Approved Academic Resources'
                          : aiResponse.sourceClassification === 'EXTERNAL_VERIFIED_REFERENCE'
                          ? 'Grounded in Live External References'
                          : 'General AI Knowledge Base'}
                      </span>
                    </div>
                    <p className="text-xs font-medium opacity-90">
                      {aiResponse.citationDisclaimer}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(aiResponse.answer)}
                    className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center gap-1 shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* AI Explanation Card */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs text-slate-500">
                    <span className="font-bold text-slate-800">Topic: "{aiResponse.query}"</span>
                    <span>Provider: {aiResponse.providerUsed}</span>
                  </div>

                  {/* Render Answer Text */}
                  <div className="prose prose-slate max-w-none text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                    {aiResponse.answer}
                  </div>

                  {/* Cited Sources List (if any) */}
                  {aiResponse.sources && aiResponse.sources.length > 0 && (
                    <div className="pt-4 border-t border-slate-100 space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Referenced Sources & Citations
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {aiResponse.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between"
                          >
                            <div className="truncate pr-2">
                              <span className="font-bold text-slate-800 block truncate">{src.title}</span>
                              <span className="text-[10px] text-slate-400">{src.sourceName}</span>
                            </div>
                            {src.url && (
                              <a
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:text-indigo-800 p-1 shrink-0"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        )}

        {/* 3. FEATURED PUBLIC MATERIALS (When not searching yet) */}
        {!hasSearched && (
          <div className="space-y-6 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Featured Open Academic Resources
                </h2>
                <p className="text-xs text-slate-500">
                  Approved study notes and reference materials shared by the academic community
                </p>
              </div>

              {!user && (
                <Link
                  to="/register"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <span>Sign up for full access</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>

            {featuredResources.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 p-6 text-xs text-slate-400">
                Loading community resources...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {featuredResources.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-150">
                          {item.subject_name || 'Academic Note'}
                        </span>
                        {item.file_type && (
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            {item.file_type}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                        {item.title}
                      </h3>

                      <p className="text-[11px] text-slate-500 line-clamp-2">
                        {item.description || 'Public study notes and learning guide.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">{item.department_name || 'General'}</span>
                      {item.file_url ? (
                        <a
                          href={item.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setSearchQuery(item.title); handleNormalSearch(); }}
                          className="font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Search
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="mt-12 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Academix Academic Platform. Open Educational Knowledge & AI Grounding.
      </footer>

    </div>
  );
}
