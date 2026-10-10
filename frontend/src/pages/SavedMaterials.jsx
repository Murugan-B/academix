import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  FolderHeart, Search, BookmarkCheck, Trash2, Download, Eye,
  Globe, FileText, Play, ExternalLink, X, BookOpen, Video
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function SavedMaterials() {
  const [savedMaterials, setSavedMaterials] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [activePreviewResource, setActivePreviewResource] = useState(null);

  useEffect(() => {
    fetchSavedMaterials();
  }, []);

  const fetchSavedMaterials = async () => {
    setLoading(true);
    try {
      const res = await api.get('/public/saved-resources');
      setSavedMaterials(res.data || []);
    } catch (err) {
      console.error('Failed to load saved materials:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (resourceId) => {
    try {
      await api.delete(`/public/saved-resources/${resourceId}`);
      setSavedMaterials(prev => prev.filter(item => item.id !== resourceId));
    } catch (err) {
      console.error('Failed to remove bookmark:', err);
    }
  };

  const filteredMaterials = savedMaterials.filter(m => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = m.title.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q)) ||
      (m.public_course_name && m.public_course_name.toLowerCase().includes(q));
    const matchesType = filterType === 'ALL' || m.external_provider === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-1.5">
            <FolderHeart className="w-3.5 h-3.5" />
            <span>Personal Bookmarks</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Saved Academic Materials
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Quickly access your bookmarked lectures, video masterclasses, and public study guides.
          </p>
        </div>

        <Link
          to="/public-library"
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-2 shrink-0"
        >
          <BookOpen className="w-4 h-4" />
          <span>Browse Public Library</span>
        </Link>
      </div>

      {/* ── SEARCH & FILTER TOOLBAR ─────────────────────────────────────────── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved materials..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Saved' },
            { id: 'LOCAL_UPLOAD', label: 'Documents' },
            { id: 'YOUTUBE', label: 'Videos' },
            { id: 'GOOGLE_DRIVE', label: 'Google Drive' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterType === f.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SAVED MATERIALS GRID ────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading your saved materials...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <FolderHeart className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No saved materials found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Bookmark peer notes and video lectures across the platform to access them anytime.
          </p>
          <Link
            to="/public-library"
            className="inline-block px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
          >
            Explore Public Library
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMaterials.map(m => (
            <div
              key={m.id}
              className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    m.external_provider === 'YOUTUBE'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : m.external_provider === 'GOOGLE_DRIVE'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  }`}>
                    {m.external_provider === 'YOUTUBE' ? <Video className="w-3 h-3 text-rose-600" /> : m.external_provider === 'GOOGLE_DRIVE' ? <Globe className="w-3 h-3 text-amber-600" /> : <FileText className="w-3 h-3 text-indigo-600" />}
                    <span>{m.external_provider === 'YOUTUBE' ? 'YouTube Video' : m.external_provider === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Document'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleUnsave(m.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                    title="Remove from saved"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {m.external_provider === 'YOUTUBE' && m.external_metadata?.thumbnailUrl && (
                  <div
                    onClick={() => setActivePreviewResource(m)}
                    className="relative rounded-2xl overflow-hidden group cursor-pointer aspect-video bg-slate-900 flex items-center justify-center shadow-xs"
                  >
                    <img
                      src={m.external_metadata.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-4 h-4 ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{m.title}</h4>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{m.description || 'Public academic resource.'}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">
                  {m.public_course_name || m.subject_name || 'Academic Commons'}
                </span>

                <div className="flex items-center gap-2">
                  {m.external_provider === 'YOUTUBE' ? (
                    <button
                      type="button"
                      onClick={() => setActivePreviewResource(m)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Watch</span>
                    </button>
                  ) : m.external_provider === 'GOOGLE_DRIVE' ? (
                    <button
                      type="button"
                      onClick={() => setActivePreviewResource(m)}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open</span>
                    </button>
                  ) : (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RESOURCE PREVIEW / EMBED MODAL ───────────────────────────────────── */}
      {activePreviewResource && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 truncate pr-4">{activePreviewResource.title}</span>
              <button
                type="button"
                onClick={() => setActivePreviewResource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {activePreviewResource.external_provider === 'YOUTUBE' && activePreviewResource.external_metadata?.embedUrl && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={activePreviewResource.external_metadata.embedUrl}
                    title={activePreviewResource.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {activePreviewResource.external_provider === 'GOOGLE_DRIVE' && (
                <div className="space-y-3">
                  {activePreviewResource.external_metadata?.previewUrl && (
                    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                      <iframe
                        src={activePreviewResource.external_metadata.previewUrl}
                        title={activePreviewResource.title}
                        className="w-full h-full border-0"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500">{activePreviewResource.description}</p>
                {activePreviewResource.external_url && (
                  <a
                    href={activePreviewResource.external_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shrink-0"
                  >
                    <span>Open in New Tab</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
