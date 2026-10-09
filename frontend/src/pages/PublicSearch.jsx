import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  Search, Bot, Sparkles, BookOpen, FileText, ExternalLink,
  ShieldCheck, Globe, CheckCircle2, ArrowRight, BookMarked,
  Layers, Filter, Copy, Check, Info, AlertTriangle, ArrowLeft,
  GraduationCap, Download, Eye, RefreshCw, Image as ImageIcon,
  MessageSquare, Trash2, History, Plus, Send, CornerDownLeft,
  ChevronRight, X, Clock, ExternalLink as OutLink, User
} from 'lucide-react';

export default function PublicSearch() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('normal'); // 'normal' | 'ai'
  const [normalSubFilter, setNormalSubFilter] = useState('all'); // 'all' | 'web' | 'images' | 'public_resources'
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Normal Search State
  const [webResults, setWebResults] = useState([]);
  const [imageResults, setImageResults] = useState([]);
  const [publicResources, setPublicResources] = useState([]);
  const [featuredResources, setFeaturedResources] = useState([]);
  const [searchProvider, setSearchProvider] = useState('');
  const [selectedImageModal, setSelectedImageModal] = useState(null);

  // Conversational AI State
  const [aiProvider, setAiProvider] = useState('gemini');
  const [includeWebSearch, setIncludeWebSearch] = useState(true);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]); // [{ role: 'user'|'assistant', content, citations, grounding, timestamp }]
  const [aiInputText, setAiInputText] = useState('');
  const [copiedIdx, setCopiedIdx] = useState(null);
  const chatBottomRef = useRef(null);

  // Search History Drawer State
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyTab, setHistoryTab] = useState('normal'); // 'normal' | 'ai'
  const [normalHistoryList, setNormalHistoryList] = useState([]);
  const [aiHistoryList, setAiHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, loading]);

  // Load featured public resources on mount
  useEffect(() => {
    fetchFeaturedResources();
  }, []);

  const fetchFeaturedResources = async () => {
    try {
      const res = await api.get('/public/featured-resources');
      setFeaturedResources(res.data || []);
    } catch (err) {
      console.warn('Failed to load featured public resources:', err.message);
    }
  };

  // Load Search History if authenticated
  const fetchSearchHistory = async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const [normRes, aiRes] = await Promise.all([
        api.get('/public/history/normal').catch(() => ({ data: [] })),
        api.get('/public/history/ai-conversations').catch(() => ({ data: [] }))
      ]);
      setNormalHistoryList(normRes.data || []);
      setAiHistoryList(aiRes.data || []);
    } catch (err) {
      console.warn('Failed to fetch history:', err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Perform Normal Search (Web + Images + Public Resources)
  const handleNormalSearch = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    const queryToUse = customQuery !== null ? customQuery : searchQuery;
    if (!queryToUse.trim()) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const searchMode = normalSubFilter === 'images' ? 'images' : 'web';
      const res = await api.get(
        `/public/search?query=${encodeURIComponent(queryToUse.trim())}&search_type=${searchMode}`
      );
      setWebResults(res.data.webResults || []);
      setImageResults(res.data.images || []);
      setPublicResources(res.data.publicResources || []);
      setSearchProvider(res.data.provider || 'Global Web Index');

      if (user) {
        fetchSearchHistory();
      }
    } catch (err) {
      console.error('Normal search error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle Sending a Conversational AI Message
  const handleSendAiMessage = async (e) => {
    if (e) e.preventDefault();
    if (!aiInputText.trim() || loading) return;

    const userMsgText = aiInputText.trim();
    setAiInputText('');

    // Append User Message Immediately to UI
    const newUserMsg = {
      role: 'user',
      content: userMsgText,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, newUserMsg]);
    setLoading(true);

    try {
      const res = await api.post('/public/ai-search', {
        query: userMsgText,
        conversationId: activeConversationId,
        provider: aiProvider,
        includeWebSearch
      });

      if (res.data.conversationId && !activeConversationId) {
        setActiveConversationId(res.data.conversationId);
      }

      // Append Assistant Response
      const newAssistantMsg = {
        role: 'assistant',
        content: res.data.answer,
        sourceClassification: res.data.sourceClassification,
        citationDisclaimer: res.data.citationDisclaimer,
        sources: res.data.sources || [],
        providerUsed: res.data.providerUsed,
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, newAssistantMsg]);

      if (user) {
        fetchSearchHistory();
      }
    } catch (err) {
      const errorMsg = {
        role: 'assistant',
        content: `Error: ${err.response?.data?.message || err.message || 'Failed to process question. Please try again.'}`,
        isError: true,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Start a brand new AI Chat
  const handleStartNewChat = () => {
    setActiveConversationId(null);
    setChatMessages([]);
    setAiInputText('');
  };

  // Load past AI conversation
  const handleLoadAiConversation = async (convId) => {
    setActiveConversationId(convId);
    setActiveTab('ai');
    setShowHistoryDrawer(false);
    setLoading(true);

    try {
      const res = await api.get(`/public/history/ai-conversations/${convId}`);
      const rawMessages = res.data.messages || [];
      const formatted = rawMessages.map(m => ({
        role: m.sender,
        content: m.content,
        citations: typeof m.citations === 'string' ? JSON.parse(m.citations || '[]') : m.citations,
        sourceClassification: m.grounding,
        timestamp: m.created_at
      }));
      setChatMessages(formatted);
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    } finally {
      setLoading(false);
    }
  };

  // Delete Normal Search History Item
  const handleDeleteNormalHistoryItem = async (e, id) => {
    e.stopPropagation();
    try {
      await api.delete(`/public/history/normal/${id}`);
      setNormalHistoryList(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Failed to delete history item:', err);
    }
  };

  // Clear Normal History
  const handleClearNormalHistory = async () => {
    try {
      await api.delete('/public/history/normal');
      setNormalHistoryList([]);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  };

  // Delete AI Conversation
  const handleDeleteAiConversation = async (e, convId) => {
    e.stopPropagation();
    try {
      await api.delete(`/public/history/ai-conversations/${convId}`);
      setAiHistoryList(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) {
        handleStartNewChat();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  // Clear AI Conversations
  const handleClearAiConversations = async () => {
    try {
      await api.delete('/public/history/ai-conversations');
      setAiHistoryList([]);
      handleStartNewChat();
    } catch (err) {
      console.error('Failed to clear conversations:', err);
    }
  };

  const handleCopyText = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const exampleQuestions = [
    'How does the Dijkstra shortest path algorithm work?',
    'Explain difference between process and thread in operating systems',
    'Write a quick Python implementation for Binary Search',
    'What are the core differences between SQL and NoSQL databases?'
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
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans relative">
      
      {/* ── TOP HEADER ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-800 tracking-tight">
              Academix <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full ml-1 uppercase">Global</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {/* History Toggle Button (if logged in) */}
            {user && (
              <button
                type="button"
                onClick={() => {
                  fetchSearchHistory();
                  setShowHistoryDrawer(true);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
                title="Search & Chat History"
              >
                <History className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Search History</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 hidden md:inline">
                  {user.name} <span className="text-[10px] bg-slate-200/70 px-1.5 py-0.5 rounded font-bold uppercase">{user.role}</span>
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
                  Join as Public Scholar
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN VIEWPORT ────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Search Mode Switcher Bar */}
        <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-slate-200">
          <div className="inline-flex p-1 bg-slate-200/70 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('normal')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'normal'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Global Normal Search</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>AI Chat Assistant</span>
              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full uppercase">Grounded</span>
            </button>
          </div>

          {/* Sub-toolbar */}
          {activeTab === 'normal' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
              {[
                { id: 'all', label: 'All' },
                { id: 'web', label: 'Web' },
                { id: 'images', label: 'Images' },
                { id: 'public_resources', label: 'Public Academix Notes' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setNormalSubFilter(tab.id);
                    if (hasSearched && searchQuery.trim()) {
                      handleNormalSearch(null, searchQuery);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    normalSubFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleStartNewChat}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>New Chat</span>
              </button>

              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWebSearch}
                  onChange={(e) => setIncludeWebSearch(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Live Web Grounding</span>
              </label>

              <select
                value={aiProvider}
                onChange={(e) => setAiProvider(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 outline-none cursor-pointer shadow-2xs"
              >
                <option value="gemini">Gemini 2.5 Flash</option>
                <option value="openrouter">OpenRouter</option>
              </select>
            </div>
          )}
        </div>

        {/* ── TAB 1: NORMAL SEARCH ────────────────────────────────────────────── */}
        {activeTab === 'normal' && (
          <div className="space-y-6">
            
            {/* Search Input Bar */}
            <form onSubmit={handleNormalSearch} className="relative flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-4 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search the global web, academic topics, programming, people, news..."
                className="w-full bg-white text-slate-900 placeholder-slate-400 rounded-2xl pl-12 pr-32 py-4 text-sm font-medium shadow-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              />
              <button
                type="submit"
                disabled={loading || !searchQuery.trim()}
                className="absolute right-2.5 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
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
            </form>

            {/* Quick Suggestions Chips (if no search yet) */}
            {!hasSearched && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-bold">Trending Topics:</span>
                {exampleQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSearchQuery(q);
                      handleNormalSearch(null, q);
                    }}
                    className="px-3 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 rounded-lg text-xs text-slate-600 hover:text-indigo-700 font-medium transition-all cursor-pointer shadow-2xs"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Results Content Area */}
            {loading ? (
              <div className="py-16 text-center space-y-3 bg-white rounded-3xl border border-slate-200">
                <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">Searching global web index & verified sources...</h3>
                <p className="text-xs text-slate-400">Retrieving ranked pages, images, and verified knowledge</p>
              </div>
            ) : hasSearched ? (
              <div className="space-y-6 animate-in fade-in duration-200">
                
                {/* Result count & provider summary */}
                <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-150">
                  <span>
                    Found <strong>{webResults.length}</strong> web results, <strong>{imageResults.length}</strong> images, and <strong>{publicResources.length}</strong> public notes for "{searchQuery}"
                  </span>
                  <span className="font-semibold text-slate-400">
                    Engine: {searchProvider}
                  </span>
                </div>

                {/* 1. PUBLIC ACADEMIX NOTES (Strictly is_public = TRUE) */}
                {(normalSubFilter === 'all' || normalSubFilter === 'public_resources') && publicResources.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                        <BookMarked className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Public Academix Community Notes ({publicResources.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {publicResources.map((res) => (
                        <div
                          key={res.id}
                          className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-emerald-200 transition-all flex flex-col justify-between space-y-3"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Public Community Note
                              </span>
                              {res.fileType && (
                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-0.5 rounded">
                                  {res.fileType}
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-slate-900">{res.title}</h4>
                            <p className="text-xs text-slate-600 line-clamp-2">{res.description}</p>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-400">{res.subject || res.department || 'Open Resource'}</span>
                            {res.fileUrl && (
                              <a
                                href={res.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
                              >
                                <span>Open Resource</span>
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. IMAGE RESULTS (If Images or All) */}
                {(normalSubFilter === 'all' || normalSubFilter === 'images') && imageResults.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-violet-100 text-violet-700 rounded-lg">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Image Results ({imageResults.length})
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {imageResults.map((img) => (
                        <div
                          key={img.id}
                          onClick={() => setSelectedImageModal(img)}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md group cursor-pointer transition-all"
                        >
                          <div className="h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                            <img
                              src={img.imageUrl}
                              alt={img.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          </div>
                          <div className="p-2.5 space-y-1">
                            <h4 className="text-[11px] font-bold text-slate-800 truncate" title={img.title}>
                              {img.title}
                            </h4>
                            <span className="text-[10px] text-slate-400 block truncate">{img.domain}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. GLOBAL WEB RESULTS */}
                {(normalSubFilter === 'all' || normalSubFilter === 'web') && (
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                        <Globe className="w-4 h-4" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        Global Web Results ({webResults.length})
                      </h3>
                    </div>

                    {webResults.length === 0 ? (
                      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-400">
                        No web results returned for this query.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {webResults.map((web) => (
                          <div
                            key={web.id}
                            className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all space-y-2"
                          >
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {web.favicon && (
                                <img
                                  src={web.favicon}
                                  alt=""
                                  className="w-4 h-4 rounded-sm"
                                  onError={(e) => { e.target.style.display = 'none'; }}
                                />
                              )}
                              <span className="font-semibold text-slate-600">{web.domain}</span>
                              {web.publishedDate && (
                                <>
                                  <span>•</span>
                                  <span className="text-[11px] text-slate-400">{web.publishedDate}</span>
                                </>
                              )}
                            </div>

                            <h4 className="text-base font-bold text-indigo-900 hover:text-indigo-600 transition-colors">
                              <a href={web.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                                <span>{web.title}</span>
                                <OutLink className="w-3.5 h-3.5 opacity-60 shrink-0" />
                              </a>
                            </h4>

                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                              {web.snippet}
                            </p>

                            <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                              <span className="truncate max-w-md">{web.url}</span>
                              <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-150">{web.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              /* FEATURED PUBLIC COMMUNITY RESOURCES (Empty Search State) */
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Featured Open Community Notes</h3>
                    <p className="text-xs text-slate-500">Verified educational resources explicitly shared for open public study</p>
                  </div>
                </div>

                {featuredResources.length === 0 ? (
                  <div className="text-center py-10 bg-white rounded-3xl border border-slate-200 p-6 space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-700">No public community notes published yet.</p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Institute student and faculty notes remain strictly private to their enrolled departments unless explicitly published for open access.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {featuredResources.map((item) => (
                      <div
                        key={item.id}
                        className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-3"
                      >
                        <div className="space-y-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-150">
                            {item.subject_name || 'Open Resource'}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{item.title}</h4>
                          <p className="text-[11px] text-slate-500 line-clamp-2">{item.description}</p>
                        </div>
                        {item.file_url && (
                          <a
                            href={item.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <span>Download</span>
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ── TAB 2: CONVERSATIONAL AI ASSISTANT ───────────────────────────────── */}
        {activeTab === 'ai' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[720px] max-h-[82vh]">
            
            {/* AI Chat Header */}
            <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Academix Conversational AI</h3>
                  <p className="text-[11px] text-slate-500">General educational reasoning, code synthesis, & web grounding</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="px-3 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-indigo-600" />
                  <span>New Chat</span>
                </button>
              </div>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-[#fafafa]">
              
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 max-w-md mx-auto py-12">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-slate-800">How can I assist your learning today?</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Ask any math, engineering, programming, science, or general concept question. I will provide a clear pedagogical explanation backed by verified sources.
                    </p>
                  </div>

                  <div className="w-full space-y-2 pt-2">
                    {exampleQuestions.slice(0, 3).map((q, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAiInputText(q);
                        }}
                        className="w-full p-2.5 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-200 rounded-xl text-xs text-slate-700 text-left font-medium transition-all flex items-center justify-between group shadow-2xs"
                      >
                        <span className="truncate pr-2">{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-200`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-2xl rounded-2xl p-4.5 space-y-3 ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white shadow-md rounded-br-xs'
                        : 'bg-white text-slate-800 border border-slate-200/90 shadow-2xs rounded-bl-xs'
                    }`}>
                      
                      {/* Classification Badge for Assistant Messages */}
                      {msg.role === 'assistant' && msg.sourceClassification && (
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          msg.sourceClassification === 'WEB_GROUNDED'
                            ? 'bg-sky-50 text-sky-700 border-sky-200'
                            : msg.sourceClassification === 'PUBLIC_ACADEMIC_RESOURCE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          <ShieldCheck className="w-3 h-3" />
                          <span>
                            {msg.sourceClassification === 'WEB_GROUNDED'
                              ? 'Grounded in Live Web Sources'
                              : msg.sourceClassification === 'PUBLIC_ACADEMIC_RESOURCE'
                              ? 'Grounded in Public Community Notes'
                              : 'General AI Knowledge Base'}
                          </span>
                        </div>
                      )}

                      {/* Message Content */}
                      <div className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
                        msg.role === 'user' ? 'font-medium text-white' : 'font-normal text-slate-700'
                      }`}>
                        {msg.content}
                      </div>

                      {/* Citations Card (if any) */}
                      {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                        <div className="pt-3 border-t border-slate-100 space-y-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            Sources & Citations:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {msg.sources.map((s, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] flex items-center justify-between gap-1"
                              >
                                <span className="font-semibold text-slate-700 truncate">{s.title}</span>
                                {s.url && (
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-800 shrink-0 p-0.5"
                                  >
                                    <OutLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Assistant Actions Bar */}
                      {msg.role === 'assistant' && (
                        <div className="pt-2 flex items-center justify-between text-[10px] text-slate-400">
                          <span>{msg.providerUsed ? `Model: ${msg.providerUsed}` : ''}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.content, idx)}
                            className="hover:text-indigo-600 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                      )}

                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-2xs mt-1">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {/* Loading Bubble */}
              {loading && (
                <div className="flex gap-3.5 justify-start animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-1">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-bl-xs shadow-2xs space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Thinking & verifying knowledge sources...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* AI Chat Input Box */}
            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendAiMessage} className="relative">
                <textarea
                  rows={2}
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAiMessage();
                    }
                  }}
                  placeholder="Ask a question or follow-up... (Enter to send, Shift+Enter for new line)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-14 py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white resize-none transition-all"
                />

                <button
                  type="submit"
                  disabled={loading || !aiInputText.trim()}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-xl shadow-xs transition-all cursor-pointer"
                  title="Send Message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

          </div>
        )}

      </main>

      {/* ── IMAGE PREVIEW MODAL ──────────────────────────────────────────────── */}
      {selectedImageModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-4">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 truncate pr-2">{selectedImageModal.title}</h4>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-hidden flex items-center justify-center p-4 bg-slate-50">
              <img
                src={selectedImageModal.imageUrl}
                alt={selectedImageModal.title}
                className="max-h-[55vh] object-contain rounded-xl"
              />
            </div>

            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">{selectedImageModal.domain}</span>
              {selectedImageModal.sourceUrl && (
                <a
                  href={selectedImageModal.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-xl flex items-center gap-1"
                >
                  <span>Open Source Page</span>
                  <OutLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SEARCH & CHAT HISTORY DRAWER ─────────────────────────────────────── */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Your Search History</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* History Tabs */}
            <div className="px-5 pt-3 flex items-center gap-2 border-b border-slate-150">
              <button
                type="button"
                onClick={() => setHistoryTab('normal')}
                className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  historyTab === 'normal'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Normal Searches ({normalHistoryList.length})
              </button>

              <button
                type="button"
                onClick={() => setHistoryTab('ai')}
                className={`pb-2 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                  historyTab === 'ai'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                AI Conversations ({aiHistoryList.length})
              </button>
            </div>

            {/* History List */}
            <div className="flex-1 p-5 overflow-y-auto space-y-2.5 custom-scrollbar">
              {historyLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading history...</div>
              ) : historyTab === 'normal' ? (
                normalHistoryList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">No normal searches recorded yet.</p>
                ) : (
                  normalHistoryList.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSearchQuery(item.query);
                        setActiveTab('normal');
                        setShowHistoryDrawer(false);
                        handleNormalSearch(null, item.query);
                      }}
                      className="p-3 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/80 hover:border-indigo-200 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
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
                        onClick={(e) => handleDeleteNormalHistoryItem(e, item.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete query"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )
              ) : (
                aiHistoryList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-12">No AI conversations recorded yet.</p>
                ) : (
                  aiHistoryList.map(c => (
                    <div
                      key={c.id}
                      onClick={() => handleLoadAiConversation(c.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                        activeConversationId === c.id
                          ? 'bg-indigo-50 border-indigo-200'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200/80'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-xs font-bold text-slate-800 block truncate group-hover:text-indigo-700">
                          {c.title || 'Untitled Conversation'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(c.updated_at || c.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteAiConversation(e, c.id)}
                        className="p-1 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={historyTab === 'normal' ? handleClearNormalHistory : handleClearAiConversations}
                className="text-xs font-bold text-rose-600 hover:text-rose-800"
              >
                Clear All {historyTab === 'normal' ? 'Search History' : 'Conversations'}
              </button>

              <button
                type="button"
                onClick={() => setShowHistoryDrawer(false)}
                className="px-3 py-1 bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg hover:bg-slate-100"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="mt-8 bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Academix Global Educational Engine. Non-fabricated, grounded search and intelligence.
      </footer>

    </div>
  );
}
