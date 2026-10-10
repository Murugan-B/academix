import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  CheckSquare, Plus, Clock, CheckCircle2, XCircle, Trash2,
  ExternalLink, Download, AlertCircle, FileText, Video, Globe,
  Folder, ShieldCheck
} from 'lucide-react';
import AddPublicMaterialModal from '../components/AddPublicMaterialModal';

export default function MyContributions() {
  const [contributions, setContributions] = useState([]);
  const [activeStatusTab, setActiveStatusTab] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  useEffect(() => {
    fetchContributions();
  }, []);

  const fetchContributions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/public/my-contributions');
      setContributions(res.data || []);
    } catch (err) {
      console.error('Failed to load contributions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to remove this contribution submission?')) return;
    try {
      await api.delete(`/public/my-contributions/${id}`);
      setContributions(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete contribution:', err);
    }
  };

  const filtered = contributions.filter(c => {
    if (activeStatusTab === 'ALL') return true;
    return c.status === activeStatusTab;
  });

  const pendingCount = contributions.filter(c => c.status === 'PENDING').length;
  const approvedCount = contributions.filter(c => c.status === 'APPROVED').length;
  const rejectedCount = contributions.filter(c => c.status === 'REJECTED').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-1.5">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Community Knowledge Sharing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Academic Contributions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Track verification review status, view faculty feedback, and manage your contributed academic resources.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-2 shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span> Add Public Material</span>
        </button>
      </div>

      {/* ── STATUS STATS BAR ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 block">{pendingCount}</span>
            <span className="text-xs font-semibold text-slate-500">Under Review (Pending)</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 block">{approvedCount}</span>
            <span className="text-xs font-semibold text-slate-500">Published & Approved</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex items-center gap-3">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-slate-900 block">{rejectedCount}</span>
            <span className="text-xs font-semibold text-slate-500">Revisions Requested</span>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'ALL', label: `All Submissions (${contributions.length})` },
          { id: 'PENDING', label: `Pending Review (${pendingCount})` },
          { id: 'APPROVED', label: `Approved (${approvedCount})` },
          { id: 'REJECTED', label: `Rejected (${rejectedCount})` }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveStatusTab(t.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeStatusTab === t.id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CONTRIBUTIONS LIST ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-400">Loading your contributions...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
          <CheckSquare className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No submissions in this view</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Share study notes, YouTube video lectures, or research materials to support open academic learning.
          </p>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
          >
            + Add First Material
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(item => (
            <div
              key={item.id}
              className="bg-white p-6 rounded-3xl border border-slate-200 shadow-2xs hover:shadow-sm transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 ${
                      item.status === 'APPROVED'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : item.status === 'REJECTED'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {item.status === 'APPROVED' ? <CheckCircle2 className="w-3 h-3" /> : item.status === 'REJECTED' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{item.status === 'APPROVED' ? 'Approved & Publicly Visible' : item.status === 'REJECTED' ? 'Verification Rejected' : 'Under Review'}</span>
                    </span>

                    <span className="text-[10px] text-slate-400 font-medium">
                      Submitted on {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.description || 'No description provided.'}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.file_url && (
                    <a
                      href={item.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>View / Download</span>
                    </a>
                  )}

                  {item.status !== 'APPROVED' && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                      title="Delete Submission"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Course Context & Metadata */}
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-150 flex items-center justify-between text-xs text-slate-500">
                <span>Course: <strong>{item.public_course_name || item.subject_name || item.department_name || 'Community Library'}</strong></span>
                <span>Format: <strong>{item.external_provider === 'YOUTUBE' ? 'YouTube' : item.external_provider === 'GOOGLE_DRIVE' ? 'Google Drive' : 'Uploaded File'}</strong></span>
              </div>

              {/* Rejection Reason Notice if Rejected */}
              {item.status === 'REJECTED' && item.rejection_reason && (
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1">
                  <span className="font-bold flex items-center gap-1 text-rose-700">
                    <AlertCircle className="w-3.5 h-3.5" /> Faculty Reviewer Feedback:
                  </span>
                  <p className="leading-relaxed">{item.rejection_reason}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── ADD PUBLIC MATERIAL MODAL ────────────────────────────────────────── */}
      <AddPublicMaterialModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => fetchContributions()}
      />

    </div>
  );
}
