import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  BookOpen, Search, Filter, Folder, ExternalLink, Download,
  Bookmark, BookmarkCheck, Video, FileText, Globe,
  Plus, CheckCircle2, ChevronRight, Eye, Play, ArrowLeft,
  Sparkles, Layers, ShieldCheck, Clock, AlertCircle
} from 'lucide-react';
import AddPublicMaterialModal from '../components/AddPublicMaterialModal';

export default function PublicLibrary() {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseResources, setCourseResources] = useState([]);
  const [savedResourceIds, setSavedResourceIds] = useState(new Set());
  
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('ALL'); // 'ALL' | 'YOUTUBE' | 'GOOGLE_DRIVE' | 'LOCAL_UPLOAD'
  
  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activePreviewResource, setActivePreviewResource] = useState(null);

  const [loading, setLoading] = useState(true);
  const [resourceLoading, setResourceLoading] = useState(false);

  useEffect(() => {
    fetchCourses();
    fetchSavedResourceIds();
  }, []);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/public/courses');
      setCourses(res.data || []);
    } catch (err) {
      console.error('Failed to load public courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedResourceIds = async () => {
    try {
      const res = await api.get('/public/saved-resources');
      const ids = new Set((res.data || []).map(r => r.id));
      setSavedResourceIds(ids);
    } catch {
      // Ignore unauthenticated or failure
    }
  };

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setResourceLoading(true);
    try {
      const res = await api.get(`/public/courses/${course.id}`);
      setCourseResources(res.data?.resources || []);
    } catch (err) {
      console.error('Failed to load course resources:', err);
      setCourseResources([]);
    } finally {
      setResourceLoading(false);
    }
  };

  const handleToggleSave = async (e, resourceId) => {
    e.stopPropagation();
    const isSaved = savedResourceIds.has(resourceId);

    try {
      if (isSaved) {
        await api.delete(`/public/saved-resources/${resourceId}`);
        setSavedResourceIds(prev => {
          const next = new Set(prev);
          next.delete(resourceId);
          return next;
        });
      } else {
        await api.post(`/public/saved-resources/${resourceId}`);
        setSavedResourceIds(prev => new Set([...prev, resourceId]));
      }
    } catch (err) {
      console.error('Bookmark toggle error:', err);
    }
  };

  const filteredCourses = courses.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || c.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredResources = courseResources.filter(r => {
    if (resourceTypeFilter === 'ALL') return true;
    return r.external_provider === resourceTypeFilter;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Open Learning Commons</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Public Academic Notes & Course Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Browse structured community course folders, YouTube masterclasses, and verified peer notes.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add Public Material</span>
        </button>
      </div>

      {/* ── COURSE FOLDERS BROWSER VIEW ─────────────────────────────────────── */}
      {!selectedCourse ? (
        <div className="space-y-5">
          
          {/* Search & Category Filter */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search community course folders..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:inline">Category:</span>
              {['ALL', 'COMMUNITY', 'COMPUTER_SCIENCE', 'ENGINEERING', 'MATHEMATICS', 'SCIENCE'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  {cat.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Courses Grid */}
          {loading ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-400">
              Loading public course folders...
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <Folder className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No course folders found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Be the first scholar to create a community folder for this subject!
              </p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                + Create First Course Folder
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCourses.map(course => (
                <div
                  key={course.id}
                  onClick={() => handleSelectCourse(course)}
                  className="bg-white hover:bg-indigo-50/20 p-6 rounded-3xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-105 transition-transform">
                        <Folder className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {course.resource_count || 0} Approved
                        </span>
                        {Number(course.pending_count) > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {course.pending_count} Under Review
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-1">
                        {course.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {course.description || 'Open community course folder.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
                    <span>Explore Course Library</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      ) : (
        /* ── INSIDE COURSE FOLDER VIEW ────────────────────────────────────────── */
        <div className="space-y-5">
          
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedCourse(null)}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Course Folders</span>
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-bold text-slate-800 truncate">{selectedCourse.name}</span>
          </div>

          {/* Course Details Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 p-6 sm:p-8 rounded-3xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold">
                <Folder className="w-3.5 h-3.5 text-indigo-300" />
                <span>Community Folder</span>
              </div>
              <h2 className="text-2xl font-black">{selectedCourse.name}</h2>
              <p className="text-xs text-indigo-100/80 leading-relaxed">
                {selectedCourse.description || 'Browse curated open resources, educational video lectures, and lecture notes.'}
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 bg-white text-indigo-900 hover:bg-indigo-50 text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Add Material Here</span>
              </button>
            </div>
          </div>

          {/* Sub-Filter Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
            <span className="text-xs font-bold text-slate-500">
              {filteredResources.length} Approved Learning Materials
            </span>

            <div className="flex items-center gap-1.5">
              {[
                { id: 'ALL', label: 'All Formats' },
                { id: 'LOCAL_UPLOAD', label: 'Documents' },
                { id: 'YOUTUBE', label: 'YouTube Videos' },
                { id: 'GOOGLE_DRIVE', label: 'Google Drive' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setResourceTypeFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    resourceTypeFilter === f.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resources List */}
          {resourceLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading resources...</div>
          ) : filteredResources.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">No learning resources in this category yet.</p>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                + Contribute Material
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map(res => {
                const isSaved = savedResourceIds.has(res.id);
                return (
                  <div
                    key={res.id}
                    className="bg-white p-5 rounded-3xl border border-slate-200 shadow-2xs hover:shadow-md hover:border-indigo-200 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Format Badge & Bookmark */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          res.external_provider === 'YOUTUBE'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : res.external_provider === 'GOOGLE_DRIVE'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {res.external_provider === 'YOUTUBE' ? <Video className="w-3 h-3 text-rose-600" /> : res.external_provider === 'GOOGLE_DRIVE' ? <Globe className="w-3 h-3 text-amber-600" /> : <FileText className="w-3 h-3 text-indigo-600" />}
                          <span>{res.external_provider === 'YOUTUBE' ? 'YouTube Video' : res.external_provider === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Document'}</span>
                        </span>

                        <button
                          type="button"
                          onClick={(e) => handleToggleSave(e, res.id)}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
                          title={isSaved ? 'Remove Bookmark' : 'Save Material'}
                        >
                          {isSaved ? <BookmarkCheck className="w-4 h-4 text-indigo-600" /> : <Bookmark className="w-4 h-4" />}
                        </button>
                      </div>

                      {/* YouTube Thumbnail Preview if available */}
                      {res.external_provider === 'YOUTUBE' && res.external_metadata?.thumbnailUrl && (
                        <div
                          onClick={() => setActivePreviewResource(res)}
                          className="relative rounded-2xl overflow-hidden group cursor-pointer aspect-video bg-slate-900 flex items-center justify-center shadow-xs"
                        >
                          <img
                            src={res.external_metadata.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-90"
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                              <Play className="w-5 h-5 ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{res.title}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{res.description || 'Public academic resource.'}</p>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {res.contributor_name ? `By ${res.contributor_name}` : 'Open Scholar'}
                      </span>

                      <div className="flex items-center gap-2">
                        {res.external_provider === 'YOUTUBE' ? (
                          <button
                            type="button"
                            onClick={() => setActivePreviewResource(res)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Play Video</span>
                          </button>
                        ) : res.external_provider === 'GOOGLE_DRIVE' ? (
                          <button
                            type="button"
                            onClick={() => setActivePreviewResource(res)}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Open Drive</span>
                          </button>
                        ) : (
                          <a
                            href={res.file_url}
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
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ── RESOURCE PREVIEW / EMBED MODAL (YouTube & Google Drive) ──────────── */}
      {activePreviewResource && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate pr-4">
                <span className="text-xs font-bold text-slate-800 truncate">{activePreviewResource.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setActivePreviewResource(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* YouTube Responsive Player */}
              {activePreviewResource.external_provider === 'YOUTUBE' && activePreviewResource.external_metadata?.embedUrl && (
                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black shadow-lg">
                  <iframe
                    src={activePreviewResource.external_metadata.embedUrl}
                    title={activePreviewResource.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {/* Google Drive Preview Player */}
              {activePreviewResource.external_provider === 'GOOGLE_DRIVE' && (
                <div className="space-y-3">
                  {activePreviewResource.external_metadata?.previewUrl ? (
                    <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                      <iframe
                        src={activePreviewResource.external_metadata.previewUrl}
                        title={activePreviewResource.title}
                        className="w-full h-full border-0"
                      />
                    </div>
                  ) : null}

                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                    <span className="font-bold block">Google Drive Sharing Notice</span>
                    <p className="leading-relaxed">
                      If the embedded preview displays a permission prompt, please click the button below to view directly in Google Drive.
                    </p>
                  </div>
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

      {/* ── ADD PUBLIC MATERIAL MODAL ────────────────────────────────────────── */}
      <AddPublicMaterialModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          fetchCourses();
          if (selectedCourse) handleSelectCourse(selectedCourse);
        }}
      />

    </div>
  );
}
