import { useState, useEffect } from 'react';
import {
  CheckSquare, Clock, CheckCircle2, AlertCircle, Eye, Download,
  User, BookOpen, Layers, FileText, Tag, MessageSquare, ShieldCheck,
  Search, X, Loader2, Sparkles, Filter, Globe, Video, ExternalLink
} from 'lucide-react';
import api from '../api/axios';
import ResourcePreviewModal from '../components/ResourcePreviewModal';

export default function ResourceApprovals() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'
  const [search, setSearch] = useState('');

  // Modals
  const [previewResource, setPreviewResource] = useState(null);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchApprovals();
  }, [statusFilter]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/student-resources/approvals?status=${statusFilter}`);
      setApprovals(res.data || []);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve and publish this resource?')) return;
    setActionLoading(true);
    try {
      await api.put(`/student-resources/${id}/approve`);
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to approve resource');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectingItem) return;

    setActionLoading(true);
    try {
      await api.put(`/student-resources/${rejectingItem.id}/reject`, {
        reason: rejectionReason.trim()
      });
      setRejectingItem(null);
      setRejectionReason('');
      fetchApprovals();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reject resource');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredApprovals = approvals.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.uploader_name?.toLowerCase().includes(q) ||
      item.uploader_roll_number?.toLowerCase().includes(q) ||
      item.subject_name?.toLowerCase().includes(q) ||
      item.public_course_name?.toLowerCase().includes(q) ||
      item.topic_title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q)
    );
  });

  const getFormatBadge = (item) => {
    if (item.external_provider === 'YOUTUBE') {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <Video className="w-3 h-3 text-rose-600" /> YouTube
        </span>
      );
    }
    if (item.external_provider === 'GOOGLE_DRIVE') {
      return (
        <span className="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
          <ExternalLink className="w-3 h-3 text-emerald-600" /> Drive Link
        </span>
      );
    }
    const ext = item.file_name?.split('.').pop().toLowerCase();
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
        {ext || item.external_provider || 'FILE'}
      </span>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-16">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-700 text-xs font-extrabold mb-3 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Academic Quality Control</span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">
          Resource Review & Approvals
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-1">
          Review, validate, and approve student-shared notes, community submissions, and public course materials.
        </p>
      </div>

      {/* ── STATUS TABS & SEARCH BAR ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('PENDING')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Review</span>
          </button>

          <button
            onClick={() => setStatusFilter('APPROVED')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'APPROVED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Approved History</span>
          </button>

          <button
            onClick={() => setStatusFilter('REJECTED')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'REJECTED'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Rejected</span>
          </button>

          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>All Submissions</span>
          </button>
        </div>

        {/* Quick Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search pending reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          />
        </div>
      </div>

      {/* ── APPROVALS LIST ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          <p className="text-xs font-bold">Loading resource submissions...</p>
        </div>
      ) : filteredApprovals.length === 0 ? (
        <div className="bg-white/95 rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3 max-w-md mx-auto">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-base font-black text-slate-800">Queue is Clear</h3>
          <p className="text-xs text-slate-500">
            {statusFilter === 'PENDING'
              ? 'There are no pending resource submissions awaiting your review right now.'
              : 'No resource submissions match this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredApprovals.map((item) => (
            <div
              key={item.id}
              className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:border-indigo-200 transition-all space-y-4"
            >
              
              {/* Header: Student Profile & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm">
                    {item.uploader_name ? item.uploader_name[0] : 'S'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900">{item.uploader_name}</h4>
                      {item.is_my_mentee && (
                        <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-extrabold border border-violet-200">
                          ★ Assigned Mentee
                        </span>
                      )}
                      {item.is_public && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-150">
                          Public Contribution
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {item.uploader_roll_number ? `Roll No: ${item.uploader_roll_number} • ` : ''}{item.department_name || 'Community Contributor'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-medium">
                    Submitted {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  
                  {item.status === 'PENDING' && (
                    <span className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <span>Pending Review</span>
                    </span>
                  )}
                  {item.status === 'APPROVED' && (
                    <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-extrabold flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approved</span>
                    </span>
                  )}
                  {item.status === 'REJECTED' && (
                    <span className="px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-extrabold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Rejected</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Resource Content Info */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                <div className="lg:col-span-8 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getFormatBadge(item)}
                    {item.public_course_name ? (
                      <span className="text-xs font-black text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> Course: {item.public_course_name}
                      </span>
                    ) : (
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                        {item.subject_name} {item.subject_code ? `(${item.subject_code})` : ''} {item.semester ? `• Sem ${item.semester}` : ''}
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-black text-slate-900">{item.title}</h3>

                  {item.description && (
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {item.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500 font-bold">
                    {item.public_course_name ? (
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md">
                        Folder: {item.public_course_name}
                      </span>
                    ) : (
                      <>
                        {item.unit_number && <span className="px-2 py-0.5 bg-slate-100 rounded-md">Unit {item.unit_number}: {item.unit_title}</span>}
                        {item.topic_number && <span className="px-2 py-0.5 bg-slate-100 rounded-md">Topic {item.topic_number}: {item.topic_title}</span>}
                      </>
                    )}
                    {item.file_size && (
                      <span className="text-[11px] text-slate-400 font-medium">
                        • {(item.file_size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    )}
                  </div>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {item.tags.map((t, idx) => (
                        <span key={idx} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Rejection Notice if rejected */}
                  {item.status === 'REJECTED' && item.rejection_reason && (
                    <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-800 border border-rose-200">
                      <strong>Rejection Feedback:</strong> "{item.rejection_reason}"
                    </div>
                  )}
                </div>

                {/* Actions Toolbar */}
                <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-2 justify-center lg:border-l lg:border-slate-150 lg:pl-6">
                  {item.external_url ? (
                    <a
                      href={item.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open External Link</span>
                    </a>
                  ) : (
                    <button
                      onClick={() => setPreviewResource(item)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>Preview Document</span>
                    </button>
                  )}

                  {item.status === 'PENDING' && (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => handleApprove(item.id)}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Approve</span>
                      </button>

                      <button
                        onClick={() => { setRejectingItem(item); setRejectionReason(''); }}
                        disabled={actionLoading}
                        className="flex-1 py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

      {/* ── REJECTION REASON MODAL ───────────────────────────────────────────── */}
      {rejectingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-rose-50/50">
              <div className="flex items-center gap-2 text-rose-700 font-black text-sm">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span>Reject Resource Submission</span>
              </div>
              <button
                onClick={() => setRejectingItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-600 mb-2 font-medium">
                  Provide constructive feedback for <strong className="text-slate-800">{rejectingItem.uploader_name}</strong> regarding why "<em>{rejectingItem.title}</em>" cannot be approved.
                </p>
                <textarea
                  required
                  rows={4}
                  placeholder="e.g. Incomplete notes, missing topic derivations, or low formatting quality..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PREVIEW MODAL ────────────────────────────────────────────────────── */}
      {previewResource && (
        <ResourcePreviewModal
          resource={previewResource}
          onClose={() => setPreviewResource(null)}
        />
      )}

    </div>
  );
}
