import React, { useState, useEffect } from 'react';
import {
  Network, GitFork, ArrowRight, Plus, CheckCircle2, Sparkles, AlertCircle,
  RefreshCw, ShieldCheck, Layers, BookOpen, ChevronRight, Check, Trash2, Edit3,
  HelpCircle, AlertTriangle, FileText
} from 'lucide-react';
import api from '../api/axios';
import { toast } from './Toast';

const showToast = (msg, type = 'info') => {
  if (type === 'success') toast.success(msg);
  else if (type === 'error') toast.error(msg);
  else toast.info(msg);
};

export default function KnowledgeGraphPanel({ subjectId, isHod, isFaculty }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [provider, setProvider] = useState('gemini');

  // Role detection
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const userRole = user?.role;
  const isAuthoringAllowed = ['HOD', 'FACULTY', 'INSTITUTE_ADMIN', 'SUPER_ADMIN'].includes(userRole);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/knowledge-graph/subjects/${subjectId}`);
      setData(res.data);
      if (res.data.concepts?.length > 0) {
        // Keep currently selected concept if it still exists, otherwise select first
        setSelectedConcept(prev => {
          if (prev) {
            const match = res.data.concepts.find(c => c.id === prev.id);
            if (match) return match;
          }
          return res.data.concepts[0];
        });
      } else {
        setSelectedConcept(null);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge graph:', err);
      showToast('Unable to load academic knowledge graph.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId) fetchGraph();
  }, [subjectId]);

  const handleAutoGenerate = async () => {
    if (!isAuthoringAllowed) return;
    setGenerating(true);
    try {
      const res = await api.post(`/knowledge-graph/subjects/${subjectId}/auto-generate`, { provider });
      showToast(res.data.message || 'Academic knowledge graph extracted successfully!', 'success');
      await fetchGraph();
    } catch (err) {
      console.error('Failed to auto-generate graph:', err);
      const errMsg = err.response?.data?.error || err.message || 'Failed to extract concepts via AI.';
      showToast(errMsg, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateStatus = async (conceptId, newStatus) => {
    if (!isAuthoringAllowed) return;
    try {
      const res = await api.patch(`/knowledge-graph/concepts/${conceptId}/status`, { status: newStatus });
      const toastMsg = newStatus === 'REVIEWED'
        ? 'Concept marked as reviewed.'
        : newStatus === 'CONFIRMED'
        ? 'Concept confirmed.'
        : (res.data?.message || `Concept status updated to ${newStatus}`);
      showToast(toastMsg, 'success');
      setData(prev => ({
        ...prev,
        concepts: prev.concepts.map(c => c.id === conceptId ? { ...c, status: newStatus } : c)
      }));
      if (selectedConcept?.id === conceptId) {
        setSelectedConcept(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to update status.';
      showToast(errMsg, 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 h-full">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Loading academic knowledge graph...</p>
      </div>
    );
  }

  const concepts = data?.concepts || [];
  const relationships = data?.relationships || [];
  const filteredConcepts = concepts.filter(c => {
    if (statusFilter === 'ALL') return true;
    return c.status === statusFilter;
  });

  const outgoingRelationships = relationships.filter(r => r.source_concept_id === selectedConcept?.id);
  const incomingRelationships = relationships.filter(r => r.target_concept_id === selectedConcept?.id);

  const getStatusBadge = (status) => {
    if (status === 'CONFIRMED') {
      return (
        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Confirmed
        </span>
      );
    }
    if (status === 'REVIEWED') {
      return (
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-indigo-600" /> Reviewed
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-extrabold uppercase flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-600" /> Detected
      </span>
    );
  };

  const getRelationshipBadge = (type) => {
    const map = {
      PREREQUISITE_OF: 'bg-rose-50 text-rose-700 border-rose-200',
      DEPENDS_ON: 'bg-amber-50 text-amber-700 border-amber-200',
      RELATED_TO: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      PART_OF: 'bg-purple-50 text-purple-700 border-purple-200',
      EXPLAINS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      EXAMPLE_OF: 'bg-slate-50 text-slate-700 border-slate-200'
    };
    return (
      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${map[type] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        {type?.replace(/_/g, ' ')}
      </span>
    );
  };

  // ════════════════════════════════════════════════════════════════════════════
  // EMPTY STATE
  // ════════════════════════════════════════════════════════════════════════════
  if (concepts.length === 0) {
    if (!isAuthoringAllowed) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-5 animate-in fade-in duration-300">
          <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl text-indigo-600 border border-indigo-100 shadow-sm">
            <Network className="w-16 h-16" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Knowledge Graph Not Available Yet
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              Your faculty or HOD must generate the academic knowledge graph from approved course materials.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
        <div className="p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-3xl text-indigo-600 border border-indigo-100 shadow-sm">
          <Network className="w-16 h-16" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Build Academic Knowledge Graph
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
            Analyze approved course materials to identify academic concepts and their relationships, including prerequisites, dependencies, related concepts, and structural relationships.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="pt-2 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={handleAutoGenerate}
            disabled={generating}
            className="flex items-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl font-black text-sm shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>Analyzing course materials...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Extract Concepts</span>
              </>
            )}
          </button>

          <p className="text-xs text-slate-400 font-medium max-w-md">
            Concepts are generated from authorized academic materials and can be reviewed before being treated as confirmed knowledge.
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // POPULATED GRAPH STATE
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Top Controls Header */}
      <div className="p-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Network className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 leading-tight">Academic Knowledge Graph</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {concepts.length} Concept Nodes • {relationships.length} Relationships
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
            {['ALL', 'CONFIRMED', 'REVIEWED', 'DETECTED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === st ? 'bg-white text-indigo-600 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {isAuthoringAllowed && (
            <button
              type="button"
              onClick={handleAutoGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-50"
              title="Re-run AI extraction from syllabus materials"
            >
              {generating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Re-Extract Concepts</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={fetchGraph}
            className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors"
            title="Refresh Knowledge Graph"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Two-Column Graph Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Concept Master List */}
        <div className="w-72 border-r border-slate-200 bg-slate-50/50 flex flex-col overflow-hidden shrink-0">
          <div className="p-3 border-b border-slate-200/60 text-xs font-bold text-slate-500 uppercase tracking-wider">
            Concepts ({filteredConcepts.length})
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {filteredConcepts.map((concept) => {
              const isSelected = selectedConcept?.id === concept.id;
              return (
                <button
                  key={concept.id}
                  onClick={() => setSelectedConcept(concept)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-white border-indigo-400 shadow-sm shadow-indigo-50 ring-2 ring-indigo-500/10'
                      : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-xs font-extrabold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                      {concept.name}
                    </span>
                    {getStatusBadge(concept.status)}
                  </div>
                  {concept.topic_title && (
                    <p className="text-[10px] text-slate-400 truncate font-medium">
                      Topic: {concept.topic_title}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail & Relationship Graph Explorer */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-white space-y-6">
          {selectedConcept ? (
            <div className="space-y-6">
              {/* Concept Hero Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-50/60 via-slate-50 to-purple-50/60 border border-indigo-100/80 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusBadge(selectedConcept.status)}
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Concept Node
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900">{selectedConcept.name}</h2>
                  </div>

                  {isAuthoringAllowed && (
                    <div className="flex items-center gap-2">
                      {selectedConcept.status !== 'CONFIRMED' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedConcept.id, 'CONFIRMED')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" /> Confirm Concept
                        </button>
                      )}
                      {selectedConcept.status === 'DETECTED' && (
                        <button
                          onClick={() => handleUpdateStatus(selectedConcept.id, 'REVIEWED')}
                          className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors"
                        >
                          Mark Reviewed
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {selectedConcept.description && (
                  <p className="text-xs text-slate-700 leading-relaxed font-medium bg-white/80 p-3.5 rounded-2xl border border-slate-200/60">
                    {selectedConcept.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-slate-500 font-medium pt-1">
                  {selectedConcept.unit_title && (
                    <span>Unit: <strong className="text-slate-800">{selectedConcept.unit_title}</strong></span>
                  )}
                  {selectedConcept.topic_title && (
                    <span>Topic: <strong className="text-slate-800">{selectedConcept.topic_title}</strong></span>
                  )}
                </div>
              </div>

              {/* Relationship Trees */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Outgoing Relationships */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50/40 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <GitFork className="w-4 h-4 text-indigo-600" />
                    <span>Outgoing Relationships ({outgoingRelationships.length})</span>
                  </h4>

                  {outgoingRelationships.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">No outgoing relationships defined.</p>
                  ) : (
                    <div className="space-y-2">
                      {outgoingRelationships.map((rel) => (
                        <div
                          key={rel.id}
                          className="p-3 bg-white border border-slate-200 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {getRelationshipBadge(rel.relationship_type)}
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-extrabold text-slate-800 truncate">{rel.target_name}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Incoming Prerequisites / Dependencies */}
                <div className="p-5 rounded-3xl border border-slate-200 bg-slate-50/40 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span>Prerequisites & Incoming Links ({incomingRelationships.length})</span>
                  </h4>

                  {incomingRelationships.length === 0 ? (
                    <p className="text-xs text-slate-400 italic py-3">No incoming prerequisite links.</p>
                  ) : (
                    <div className="space-y-2">
                      {incomingRelationships.map((rel) => (
                        <div
                          key={rel.id}
                          className="p-3 bg-white border border-slate-200 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-extrabold text-slate-800 truncate">{rel.source_name}</span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {getRelationshipBadge(rel.relationship_type)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <Network className="w-12 h-12 text-slate-200 mb-3" />
              <p className="text-sm font-bold text-slate-600">Select a concept to explore relationships</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Explore prerequisites, dependencies, and structural relationships between syllabus concepts.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
