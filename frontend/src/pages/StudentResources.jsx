import { useState, useEffect } from 'react';
import {
  FolderHeart, Search, Filter, Upload, Download, Eye, CheckCircle2,
  Clock, AlertCircle, Sparkles, BookOpen, Layers, FileText, FileSpreadsheet,
  Tag, ShieldCheck, UserCheck, Trash2, ChevronRight, X, ArrowUpDown, Loader2
} from 'lucide-react';
import api from '../api/axios';
import ResourcePreviewModal from '../components/ResourcePreviewModal';
import UploadStudentResourceModal from '../components/UploadStudentResourceModal';

export default function StudentResources() {
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'my-uploads'
  const [resources, setResources] = useState([]);
  const [myUploads, setMyUploads] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState(''); // '' | 'FACULTY' | 'STUDENT'
  const [semesterFilter, setSemesterFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('newest');

  // Subjects for filter dropdown
  const [subjectsList, setSubjectsList] = useState([]);

  // Modals & Actions
  const [previewResource, setPreviewResource] = useState(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    fetchSubjects();
    if (activeTab === 'explore') {
      fetchApprovedResources();
    } else {
      fetchMyUploads();
    }
  }, [activeTab, sourceFilter, semesterFilter, subjectFilter, fileTypeFilter, sortOrder]);

  const fetchSubjects = async () => {
    try {
      const url = semesterFilter ? `/subjects?semester=${semesterFilter}` : '/subjects';
      const res = await api.get(url);
      setSubjectsList(res.data || []);
    } catch (err) {
      console.error('Failed to load subjects:', err);
    }
  };

  const fetchApprovedResources = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (sourceFilter) params.append('source_type', sourceFilter);
      if (semesterFilter) params.append('semester', semesterFilter);
      if (subjectFilter) params.append('subject_id', subjectFilter);
      if (fileTypeFilter) params.append('file_type', fileTypeFilter);
      if (sortOrder) params.append('sort', sortOrder);

      const res = await api.get(`/student-resources?${params.toString()}`);
      setResources(res.data || []);
    } catch (err) {
      console.error('Failed to fetch student resources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyUploads = async () => {
    setLoading(true);
    try {
      const res = await api.get('/student-resources/my-uploads');
      setMyUploads(res.data || []);
    } catch (err) {
      console.error('Failed to fetch my uploads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchApprovedResources();
  };

  const handleDownload = async (item, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!item || !item.id || downloadingId === item.id) return;

    setDownloadingId(item.id);
    showToast('Preparing download...');
    try {
      const res = await api.get(`/student-resources/${item.id}/signed-url?download=true`);
      if (res.data?.url) {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = item.file_name || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Download started.');
      } else {
        showToast('Resource file URL is currently unavailable.');
      }
    } catch (err) {
      console.error('Download error:', err);
      showToast(err.response?.data?.error || 'Failed to download resource.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDeleteSubmission = async (id) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    try {
      await api.delete(`/student-resources/${id}`);
      fetchMyUploads();
      fetchApprovedResources();
      showToast('Resource deleted successfully.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to delete resource');
    }
  };

  const getFormatBadge = (fileName) => {
    const ext = fileName?.split('.').pop().toLowerCase();
    if (ext === 'pdf') {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-3 h-3 text-rose-500" /> PDF
        </span>
      );
    }
    if (ext === 'ppt' || ext === 'pptx') {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <Layers className="w-3 h-3 text-amber-500" /> PPTX
        </span>
      );
    }
    if (ext === 'doc' || ext === 'docx') {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <FileText className="w-3 h-3 text-blue-500" /> DOCX
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
        {ext || 'FILE'}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16 relative">
      
      {/* ── TOAST NOTIFICATION ──────────────────────────────────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-700 text-xs font-extrabold mb-3 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Academic Knowledge Sharing</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Student Resources
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Access verified academic notes and revision materials shared by faculty and students.
          </p>
        </div>

        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 active:scale-95 cursor-pointer shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span>Share Resource</span>
        </button>
      </div>

      {/* ── TABS ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200/80 pb-px">
        <button
          onClick={() => setActiveTab('explore')}
          className={`px-5 py-2.5 text-xs font-extrabold rounded-t-2xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'explore'
              ? 'border-indigo-600 text-indigo-700 bg-white/80 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Explore Verified Resources</span>
          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded-full text-[10px]">
            {resources.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('my-uploads')}
          className={`px-5 py-2.5 text-xs font-extrabold rounded-t-2xl transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'my-uploads'
              ? 'border-indigo-600 text-indigo-700 bg-white/80 shadow-2xs'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <FolderHeart className="w-4 h-4" />
          <span>My Shared Resources</span>
          {myUploads.length > 0 && (
            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded-full text-[10px]">
              {myUploads.length}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: EXPLORE RESOURCES ─────────────────────────────────────────── */}
      {activeTab === 'explore' && (
        <div className="space-y-6">
          
          {/* Search & Filter Bar */}
          <div className="bg-white/95 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by title, topic, subject, tag, or author..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); fetchApprovedResources(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>Filter</span>
              </button>
            </form>

            {/* Filter Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100">
              {/* Source (All, Faculty, Students) */}
              <div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50/50"
                >
                  <option value="">All Sources</option>
                  <option value="FACULTY">Faculty Resources</option>
                  <option value="STUDENT">Student Resources</option>
                </select>
              </div>

              {/* Semester */}
              <div>
                <select
                  value={semesterFilter}
                  onChange={(e) => setSemesterFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50/50"
                >
                  <option value="">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50/50"
                >
                  <option value="">All Subjects</option>
                  {subjectsList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* File Type */}
              <div>
                <select
                  value={fileTypeFilter}
                  onChange={(e) => setFileTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50/50"
                >
                  <option value="">All File Types</option>
                  <option value="pdf">PDF Documents</option>
                  <option value="ppt">PPTX Presentations</option>
                  <option value="doc">Word DOCX</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none bg-slate-50/50"
                >
                  <option value="newest">Recently Added</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">Alphabetical (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Resources Grid */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
              <p className="text-xs font-bold">Loading resources...</p>
            </div>
          ) : resources.length === 0 ? (
            <div className="bg-white/95 rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-lg mx-auto">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">No Resources Found</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {search || sourceFilter || semesterFilter || subjectFilter || fileTypeFilter
                    ? 'No verified resources match your filter criteria. Try broadening your search.'
                    : 'Be the first to share helpful study notes with your peers!'}
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Resource</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((item) => {
                const isFacultyItem = item.source_type === 'FACULTY';

                return (
                  <div
                    key={item.id}
                    className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div className="space-y-3.5">
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                          isFacultyItem 
                            ? 'bg-purple-50 text-purple-700 border border-purple-100' 
                            : 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        }`}>
                          {item.subject_code} • Sem {item.semester}
                        </span>
                        {getFormatBadge(item.file_name)}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2">
                          {item.title}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Academic Mapping Tags */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-slate-600">
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md">Unit {item.unit_number}</span>
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md truncate max-w-[180px]">
                          Topic {item.topic_number}: {item.topic_title}
                        </span>
                      </div>

                      {/* Custom Tags */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map((t, idx) => (
                            <span key={idx} className="text-[10px] font-bold text-indigo-600 bg-indigo-50/60 px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Card Footer: Metadata & Actions */}
                    <div className="pt-4 mt-4 border-t border-slate-150/80 space-y-3">
                      
                      {/* Approver & Uploader Info */}
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="text-slate-500 truncate mr-2">
                          {isFacultyItem ? (
                            <span>
                              Uploaded by <span className="font-bold text-slate-700">{item.uploader_name}</span>
                              {item.uploader_designation ? ` (${item.uploader_designation})` : ''}
                            </span>
                          ) : (
                            <span>
                              Shared by <span className="font-bold text-slate-700">{item.uploader_name}</span>
                              {item.uploader_roll_number ? ` (${item.uploader_roll_number})` : ''}
                            </span>
                          )}
                        </div>

                        {isFacultyItem ? (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[10px] font-extrabold border border-purple-200/80 shrink-0" title="Published by Faculty">
                            <ShieldCheck className="w-3 h-3 text-purple-600" />
                            <span>Published</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200/80 shrink-0" title={`Approved by ${item.approver_name || 'Faculty'}`}>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Faculty Approved</span>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewResource(item)}
                          className="flex-1 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownload(item, e)}
                          disabled={downloadingId === item.id}
                          className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          title="Download Document"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ── TAB 2: MY SHARED RESOURCES ───────────────────────────────────────── */}
      {activeTab === 'my-uploads' && (
        <div className="space-y-6">
          
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/95 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <FolderHeart className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Uploads</p>
                <p className="text-2xl font-black text-slate-800">{myUploads.length}</p>
              </div>
            </div>

            <div className="bg-white/95 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Approved & Published</p>
                <p className="text-2xl font-black text-emerald-600">
                  {myUploads.filter(u => u.status === 'APPROVED').length}
                </p>
              </div>
            </div>

            <div className="bg-white/95 rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Review</p>
                <p className="text-2xl font-black text-amber-600">
                  {myUploads.filter(u => u.status === 'PENDING').length}
                </p>
              </div>
            </div>
          </div>

          {/* Submissions List */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
              <p className="text-xs font-bold">Loading your submissions...</p>
            </div>
          ) : myUploads.length === 0 ? (
            <div className="bg-white/95 rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-4 max-w-lg mx-auto">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto">
                <Upload className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-slate-800">No Submissions Yet</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  You haven't uploaded any study materials yet. Upload chapter notes, summaries, or past questions to share with peers.
                </p>
              </div>
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>Upload First Resource</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myUploads.map((item) => {
                const isFacultyUpload = item.source_type === 'FACULTY';

                return (
                  <div
                    key={item.id}
                    className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {getFormatBadge(item.file_name)}
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-black text-slate-900">{item.title}</h3>
                            {isFacultyUpload && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200 text-purple-700 text-[10px] font-extrabold">
                                Faculty Resource
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 font-medium">
                            {item.subject_name} • Unit {item.unit_number} • Topic {item.topic_number}: {item.topic_title}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="shrink-0">
                        {item.status === 'APPROVED' && (
                          <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isFacultyUpload ? 'Published & Active' : 'Approved & Published'}</span>
                          </span>
                        )}

                        {item.status === 'PENDING' && (
                          <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Pending Faculty Review</span>
                          </span>
                        )}

                        {item.status === 'REJECTED' && (
                          <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                            <span>Needs Revisions</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rejection Reason Notice */}
                    {item.status === 'REJECTED' && item.rejection_reason && (
                      <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-xs text-rose-900 space-y-1">
                        <span className="font-extrabold flex items-center gap-1.5 text-rose-800">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Feedback from {item.rejector_name || 'Reviewer'}:
                        </span>
                        <p className="pl-5 text-slate-700 leading-relaxed font-medium">
                          "{item.rejection_reason}"
                        </p>
                      </div>
                    )}

                    {/* Details & Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs text-slate-500 font-medium">
                      <div>
                        Submitted on {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        {!isFacultyUpload && item.approved_at && ` • Approved by ${item.approver_name || 'Faculty'}`}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewResource(item)}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => handleDownload(item, e)}
                          disabled={downloadingId === item.id}
                          className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                          <span>Download</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteSubmission(item.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Resource"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ── MODALS ───────────────────────────────────────────────────────────── */}
      {previewResource && (
        <ResourcePreviewModal
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}

      {isUploadModalOpen && (
        <UploadStudentResourceModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => {
            fetchMyUploads();
            fetchApprovedResources();
            setActiveTab('my-uploads');
            showToast('Resource uploaded successfully!');
          }}
        />
      )}

    </div>
  );
}
