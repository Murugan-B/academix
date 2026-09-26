import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, TrendingUp, Sparkles, BookOpen, Users,
  Layers, RefreshCw, ChevronRight, ChevronDown, X, Check, Target, Lightbulb,
  FileText, ArrowRight, Search, Bookmark, ChevronLeft, Calendar, ShieldCheck,
  RotateCcw, Save, Loader2, ArrowUpRight, Folder, FolderOpen
} from 'lucide-react';
import api from '../api/axios';
import { toast } from './Toast';

const showToast = (msg, type = 'info') => {
  if (type === 'success') toast.success(msg);
  else if (type === 'error') toast.error(msg);
  else toast.info(msg);
};

export default function CohortLearningGapsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hierarchy Navigation State:
  // selectedSubject: null (Level 1: Semester/Subject overview) or subject object (Level 2: Unit/Topic hierarchy)
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [selectedTopicTag, setSelectedTopicTag] = useState(null);

  // Filter & Search States
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedPlansSearchQuery, setSavedPlansSearchQuery] = useState('');

  // Expanded Sections in Main View
  const [expandedSemesters, setExpandedSemesters] = useState({});
  const [expandedUnits, setExpandedUnits] = useState({});

  // Expanded Sections in Hierarchical Saved Plans
  const [expandedSavedSemesters, setExpandedSavedSemesters] = useState({});
  const [expandedSavedSubjects, setExpandedSavedSubjects] = useState({});
  const [expandedSavedUnits, setExpandedSavedUnits] = useState({});
  const [expandedSavedTopics, setExpandedSavedTopics] = useState({});
  const [expandedLegacyPlans, setExpandedLegacyPlans] = useState(true);

  // Remedial Plan Generation Modal State
  const [showRemedialModal, setShowRemedialModal] = useState(false);
  const [generatingRemedial, setGeneratingRemedial] = useState(false);
  const [remedialPlan, setRemedialPlan] = useState(null);
  const [targetTopicForRemedial, setTargetTopicForRemedial] = useState(null);
  const [remedialError, setRemedialError] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSavedSuccessfully, setPlanSavedSuccessfully] = useState(false);

  // Saved Remedial Plans in Database
  const [savedPlans, setSavedPlans] = useState([]);
  const [loadingSavedPlans, setLoadingSavedPlans] = useState(false);
  const [viewingSavedPlan, setViewingSavedPlan] = useState(null);

  const topicRefs = useRef({});

  // Lock background scroll when any modal is open
  useEffect(() => {
    if (showRemedialModal || viewingSavedPlan) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showRemedialModal, viewingSavedPlan]);

  const fetchCohortGaps = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/cohort/learning-gaps');
      setData(res.data);
      
      // Auto-expand available semesters by default
      const topics = res.data?.topics || [];
      const sems = {};
      topics.forEach(t => {
        const s = t.semester || 1;
        sems[s] = true;
      });
      setExpandedSemesters(sems);
    } catch (err) {
      console.error('Failed to fetch cohort gaps:', err);
      showToast('Unable to load cohort learning gap analytics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedPlans = async (subjectId = null) => {
    setLoadingSavedPlans(true);
    try {
      const endpoint = subjectId
        ? `/analytics/cohort/subject/${subjectId}/remedial-plans`
        : `/analytics/cohort/remedial-plans`;
      const res = await api.get(endpoint);
      setSavedPlans(res.data || []);
    } catch (err) {
      console.error('Failed to fetch saved remedial plans:', err);
    } finally {
      setLoadingSavedPlans(false);
    }
  };

  useEffect(() => {
    fetchCohortGaps();
    fetchSavedPlans(); // Initial load for all department saved plans
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      fetchSavedPlans(selectedSubject.id);
      // Auto expand all units for this subject by default
      const unitMap = {};
      (data?.topics || []).filter(t => t.subject_id === selectedSubject.id).forEach(t => {
        const uNum = t.unit_number || 1;
        unitMap[uNum] = true;
      });
      setExpandedUnits(unitMap);
    } else {
      fetchSavedPlans(); // Reload all department plans when on overview
      setSelectedUnit(null);
      setSelectedTopicTag(null);
    }
  }, [selectedSubject]);

  // Group topics by Semester and Subject
  const hierarchicalData = useMemo(() => {
    if (!data || !data.topics) return { semesters: [], semesterList: [] };

    const semMap = {};
    const semesterSet = new Set();

    data.topics.forEach(topic => {
      const semNum = topic.semester || 1;
      semesterSet.add(semNum);

      if (!semMap[semNum]) {
        semMap[semNum] = {
          semester: semNum,
          subjects: {}
        };
      }

      const subId = topic.subject_id;
      if (!semMap[semNum].subjects[subId]) {
        semMap[semNum].subjects[subId] = {
          id: subId,
          name: topic.subject_name,
          code: topic.subject_code,
          semester: semNum,
          topics: [],
          units: {}
        };
      }

      semMap[semNum].subjects[subId].topics.push(topic);

      const uNum = topic.unit_number || 1;
      const uId = topic.unit_id || `unit-${uNum}`;
      if (!semMap[semNum].subjects[subId].units[uId]) {
        semMap[semNum].subjects[subId].units[uId] = {
          unitId: uId,
          unitNumber: uNum,
          unitTitle: topic.unit_title || `Unit ${uNum}`,
          topics: []
        };
      }

      semMap[semNum].subjects[subId].units[uId].topics.push(topic);
    });

    // Convert to structured sorted arrays
    const semesters = Object.values(semMap).map(sem => {
      const subjects = Object.values(sem.subjects).map(sub => {
        const units = Object.values(sub.units).sort((a, b) => a.unitNumber - b.unitNumber);
        
        // Metrics
        const totalTopics = sub.topics.length;
        const learningGaps = sub.topics.filter(t => t.classification === 'LEARNING_GAP').length;
        const needsAttention = sub.topics.filter(t => t.classification === 'NEEDS_ATTENTION').length;
        const strongTopics = sub.topics.filter(t => t.classification === 'STRONG').length;
        const avgAccuracy = totalTopics > 0 
          ? Math.round(sub.topics.reduce((acc, t) => acc + t.accuracy, 0) / totalTopics)
          : 0;

        return {
          ...sub,
          units,
          totalTopics,
          learningGaps,
          needsAttention,
          strongTopics,
          avgAccuracy
        };
      });

      return {
        ...sem,
        subjects
      };
    }).sort((a, b) => a.semester - b.semester);

    return {
      semesters,
      semesterList: Array.from(semesterSet).sort((a, b) => a - b)
    };
  }, [data]);

  // Global Topic Search across subjects, codes, units, topics
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !data?.topics) return [];

    const query = searchQuery.toLowerCase().trim();
    return data.topics.filter(t =>
      (t.topicTag && t.topicTag.toLowerCase().includes(query)) ||
      (t.subject_name && t.subject_name.toLowerCase().includes(query)) ||
      (t.subject_code && t.subject_code.toLowerCase().includes(query)) ||
      (t.unit_title && t.unit_title.toLowerCase().includes(query)) ||
      (t.lesson_title && t.lesson_title.toLowerCase().includes(query))
    );
  }, [searchQuery, data]);

  // ════════════════════════════════════════════════════════════════════════════
  // HIERARCHICAL SAVED REMEDIAL PLANS BUILDER (Semester -> Subject -> Unit -> Topic)
  // ════════════════════════════════════════════════════════════════════════════
  const hierarchicalSavedPlans = useMemo(() => {
    const root = {
      semesters: {},
      legacy: []
    };

    const query = savedPlansSearchQuery.toLowerCase().trim();

    savedPlans.forEach(plan => {
      // Search matching across all branches
      if (query) {
        const match = (
          (plan.topic_tag || '').toLowerCase().includes(query) ||
          (plan.subject_name || '').toLowerCase().includes(query) ||
          (plan.subject_code || '').toLowerCase().includes(query) ||
          (plan.unit_title || '').toLowerCase().includes(query) ||
          (plan.author_name || '').toLowerCase().includes(query) ||
          (String(plan.semester || '')).includes(query)
        );
        if (!match) return;
      }

      const semNum = plan.semester;
      const subName = plan.subject_name;
      const unitTitle = plan.unit_title;
      const topicTag = plan.topic_tag || 'Untitled Topic';

      if (!semNum && !subName && !unitTitle) {
        root.legacy.push(plan);
        return;
      }

      const semKey = semNum || 1;
      if (!root.semesters[semKey]) {
        root.semesters[semKey] = {
          semester: semKey,
          subjects: {}
        };
      }

      const subKey = plan.subject_id || subName || 'General Subject';
      if (!root.semesters[semKey].subjects[subKey]) {
        root.semesters[semKey].subjects[subKey] = {
          id: plan.subject_id,
          name: subName || 'Subject',
          code: plan.subject_code || '',
          units: {}
        };
      }

      const unitKey = plan.unit_id || unitTitle || 'General Unit';
      if (!root.semesters[semKey].subjects[subKey].units[unitKey]) {
        root.semesters[semKey].subjects[subKey].units[unitKey] = {
          unitNumber: plan.unit_number || 1,
          unitTitle: unitTitle || 'Course Unit',
          topics: {}
        };
      }

      if (!root.semesters[semKey].subjects[subKey].units[unitKey].topics[topicTag]) {
        root.semesters[semKey].subjects[subKey].units[unitKey].topics[topicTag] = [];
      }

      root.semesters[semKey].subjects[subKey].units[unitKey].topics[topicTag].push(plan);
    });

    return root;
  }, [savedPlans, savedPlansSearchQuery]);

  // Auto expand matching branches when searching saved plans
  useEffect(() => {
    if (savedPlansSearchQuery.trim()) {
      const semMap = {};
      const subMap = {};
      const unitMap = {};
      const topicMap = {};

      Object.keys(hierarchicalSavedPlans.semesters).forEach(s => {
        semMap[s] = true;
        Object.keys(hierarchicalSavedPlans.semesters[s].subjects).forEach(sub => {
          subMap[sub] = true;
          Object.keys(hierarchicalSavedPlans.semesters[s].subjects[sub].units).forEach(u => {
            unitMap[u] = true;
            Object.keys(hierarchicalSavedPlans.semesters[s].subjects[sub].units[u].topics).forEach(t => {
              topicMap[t] = true;
            });
          });
        });
      });

      setExpandedSavedSemesters(semMap);
      setExpandedSavedSubjects(subMap);
      setExpandedSavedUnits(unitMap);
      setExpandedSavedTopics(topicMap);
    }
  }, [savedPlansSearchQuery, hierarchicalSavedPlans]);

  // Handle clicking a search result topic -> auto open semester, subject, unit, and focus topic
  const handleSearchResultClick = (topic) => {
    setSearchQuery('');
    
    // 1. Expand semester
    const semNum = topic.semester || 1;
    setExpandedSemesters(prev => ({ ...prev, [semNum]: true }));
    setSelectedSemesterFilter('ALL');

    // 2. Select subject
    const semObj = hierarchicalData.semesters.find(s => s.semester === semNum);
    const subObj = semObj?.subjects.find(s => s.id === topic.subject_id);
    if (subObj) {
      setSelectedSubject(subObj);
    }

    // 3. Expand unit
    const uNum = topic.unit_number || 1;
    setExpandedUnits(prev => ({ ...prev, [uNum]: true }));
    setSelectedUnit(topic.unit_title);
    setSelectedTopicTag(topic.topicTag);

    // 4. Scroll to topic card
    setTimeout(() => {
      if (topicRefs.current[topic.topicTag]) {
        topicRefs.current[topic.topicTag].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 150);
  };

  // ════════════════════════════════════════════════════════════════════════════
  // REMEDIAL PLAN GENERATION & PERSISTENCE
  // ════════════════════════════════════════════════════════════════════════════
  const handleOpenRemedialPlan = async (topic) => {
    // Step 1: Open modal IMMEDIATELY (Zero blank wait time)
    setTargetTopicForRemedial(topic);
    setRemedialPlan(null);
    setRemedialError(null);
    setPlanSavedSuccessfully(false);
    setShowRemedialModal(true);
    setGeneratingRemedial(true);

    try {
      // Step 2: Trigger AI generation with full academic context
      const res = await api.post('/analytics/cohort/remedial-plan', {
        topicTag: topic.topicTag,
        subjectId: topic.subject_id || selectedSubject?.id
      });

      setRemedialPlan(res.data.plan);
    } catch (err) {
      console.error('Failed to generate remedial plan:', err);
      setRemedialError(err.response?.data?.error || 'Unable to generate remedial intervention.');
    } finally {
      setGeneratingRemedial(false);
    }
  };

  const handleSaveRemedialPlan = async () => {
    if (!targetTopicForRemedial || !remedialPlan) return;

    setSavingPlan(true);
    try {
      await api.post('/analytics/cohort/save-remedial-plan', {
        subject_id: targetTopicForRemedial.subject_id || selectedSubject?.id,
        topic_id: targetTopicForRemedial.topic_id,
        topic_tag: targetTopicForRemedial.topicTag,
        plan_content: remedialPlan,
        status: 'PUBLISHED'
      });

      setPlanSavedSuccessfully(true);
      showToast('✓ Remedial plan saved successfully in database.', 'success');
      
      // Refresh saved plans
      fetchSavedPlans(selectedSubject?.id || null);
    } catch (err) {
      console.error('Failed to save remedial plan:', err);
      showToast(err.response?.data?.error || 'Failed to save remedial plan.', 'error');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleViewSavedPlanDetails = (savedPlan) => {
    setViewingSavedPlan(savedPlan);
  };

  const getScoreBarColor = (acc) => {
    if (acc < 50) return 'bg-rose-500';
    if (acc < 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getClassificationBadge = (cls) => {
    if (cls === 'LEARNING_GAP') {
      return (
        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200/80 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          <span>Learning Gap</span>
        </span>
      );
    }
    if (cls === 'NEEDS_ATTENTION') {
      return (
        <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200/80 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs">
          <AlertTriangle className="w-3 h-3 text-amber-600" />
          <span>Needs Attention</span>
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-2xs">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
        <span>Strong Topic</span>
      </span>
    );
  };

  // Filter semesters based on dropdown
  const filteredSemesters = hierarchicalData.semesters.filter(sem => {
    if (selectedSemesterFilter === 'ALL') return true;
    return sem.semester === parseInt(selectedSemesterFilter, 10);
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* ════════════════════════════════════════════════════════════════════════════
          PAGE HEADER & BREADCRUMBS
          ════════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        
        {/* Academic Breadcrumbs */}
        <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 flex-wrap">
          <Link to="/" className="hover:text-indigo-600 transition-colors">
            Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <button
            type="button"
            onClick={() => setSelectedSubject(null)}
            className={`transition-colors cursor-pointer ${
              !selectedSubject ? 'text-indigo-600 font-bold' : 'hover:text-indigo-600'
            }`}
          >
            Cohort Learning Gaps
          </button>
          {selectedSubject && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500">Semester {selectedSubject.semester}</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="font-bold text-indigo-900">{selectedSubject.name}</span>
            </>
          )}
          {selectedUnit && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-600">{selectedUnit}</span>
            </>
          )}
          {selectedTopicTag && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-indigo-600 font-bold">{selectedTopicTag}</span>
            </>
          )}
        </nav>

        {/* Title & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-rose-500 via-purple-600 to-indigo-600 rounded-2xl text-white shadow-lg shadow-rose-200/50">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                  COHORT LEARNING GAPS
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Identify topics where multiple students are struggling based on question-level assessment performance.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => {
                fetchCohortGaps();
                fetchSavedPlans(selectedSubject?.id || null);
              }}
              disabled={loading}
              className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl shadow-2xs transition-all flex items-center gap-2 text-xs font-bold cursor-pointer"
              title="Refresh Analytics"
            >
              <RefreshCw className={`w-4 h-4 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        {data?.summary && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-rose-100 shadow-2xs">
              <span className="text-xs font-bold text-rose-700 uppercase tracking-wider block mb-1">
                Learning Gaps
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-rose-900">{data.summary.learningGaps}</span>
                <span className="text-xs text-rose-600 font-bold">Topics (&lt;50%)</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-amber-100 shadow-2xs">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block mb-1">
                Needs Attention
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-900">{data.summary.needsAttention}</span>
                <span className="text-xs text-amber-600 font-bold">Topics (50-70%)</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-emerald-100 shadow-2xs">
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block mb-1">
                Strong Topics
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-900">{data.summary.strongTopics}</span>
                <span className="text-xs text-emerald-600 font-bold">Topics (≥70%)</span>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-indigo-100 shadow-2xs">
              <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block mb-1">
                Cohort Average
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-indigo-900">{data.summary.cohortAccuracy}%</span>
                <span className="text-xs text-indigo-600 font-bold">Accuracy</span>
              </div>
            </div>
          </div>
        )}

        {/* Global Filter and Search Bar */}
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <span className="text-xs font-extrabold uppercase text-slate-500 whitespace-nowrap">
              Semester:
            </span>
            <select
              value={selectedSemesterFilter}
              onChange={(e) => setSelectedSemesterFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="ALL">All Semesters</option>
              {hierarchicalData.semesterList.map(sem => (
                <option key={sem} value={sem}>Semester {sem}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subjects or topics..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-1 absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Quick search suggestions popup */}
            {searchQuery.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-indigo-100 p-2 z-40 max-h-72 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] font-black uppercase text-slate-400 px-3 py-1">
                  Matching Curriculum Topics ({searchResults.length})
                </p>
                {searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 p-3 text-center">No topics match your search.</p>
                ) : (
                  searchResults.map((t, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSearchResultClick(t)}
                      className="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50/80 transition-colors flex items-center justify-between group cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-600 truncate">
                          {t.topicTag}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">
                          Sem {t.semester || 1} • {t.subject_name} • {t.unit_title || 'Unit'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          t.accuracy < 50 ? 'bg-rose-50 text-rose-700' : t.accuracy < 70 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {t.accuracy}%
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════════
          LEVEL 1: SEMESTER & SUBJECT CARDS VIEW (When no subject is active)
          ════════════════════════════════════════════════════════════════════════════ */}
      {!selectedSubject && (
        <div className="space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/70 rounded-3xl border border-slate-200/80 space-y-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">Aggregating departmental cohort intelligence...</p>
            </div>
          ) : filteredSemesters.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
              <AlertTriangle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-700">No Assessment Data Available</h3>
              <p className="text-xs text-slate-500 mt-1">No cohort quiz attempts or assessment data found for this semester filter.</p>
            </div>
          ) : (
            filteredSemesters.map((sem) => {
              const isSemOpen = expandedSemesters[sem.semester] ?? true;

              return (
                <div key={sem.semester} className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  
                  {/* Semester Header Accordion */}
                  <button
                    type="button"
                    onClick={() => setExpandedSemesters(prev => ({ ...prev, [sem.semester]: !isSemOpen }))}
                    className="w-full px-6 py-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left border-b border-slate-200/80 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-black text-slate-900">
                          SEMESTER {sem.semester}
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                          {sem.subjects.length} Assessed Subjects in Department
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-indigo-600 mr-1">
                        {isSemOpen ? 'Collapse' : 'Expand'}
                      </span>
                      {isSemOpen ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>

                  {/* Semester Subjects Grid */}
                  {isSemOpen && (
                    <div className="p-6">
                      {sem.subjects.length === 0 ? (
                        <p className="text-xs text-slate-400 italic py-4 text-center">
                          No cohort assessment data available for this semester yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                          {sem.subjects.map((sub) => (
                            <div
                              key={sub.id}
                              className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 group"
                            >
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div>
                                    <h3 className="text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                      {sub.name}
                                    </h3>
                                    <p className="text-xs text-slate-400 font-bold">
                                      {sub.code || 'CS101'} • Semester {sem.semester}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-xl font-black text-slate-900">{sub.avgAccuracy}%</span>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Accuracy</p>
                                  </div>
                                </div>

                                {/* Metric Breakdown */}
                                <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center my-3">
                                  <div className="p-2 rounded-xl bg-rose-50/60 border border-rose-100/60">
                                    <span className="text-sm font-black text-rose-800 block">{sub.learningGaps}</span>
                                    <span className="text-[9px] font-extrabold uppercase text-rose-600">Gaps</span>
                                  </div>
                                  <div className="p-2 rounded-xl bg-amber-50/60 border border-amber-100/60">
                                    <span className="text-sm font-black text-amber-800 block">{sub.needsAttention}</span>
                                    <span className="text-[9px] font-extrabold uppercase text-amber-600">Attention</span>
                                  </div>
                                  <div className="p-2 rounded-xl bg-emerald-50/60 border border-emerald-100/60">
                                    <span className="text-sm font-black text-emerald-800 block">{sub.strongTopics}</span>
                                    <span className="text-[9px] font-extrabold uppercase text-emerald-600">Strong</span>
                                  </div>
                                </div>

                                <p className="text-[11px] text-slate-500 font-medium">
                                  {sub.totalTopics} assessed topics across {sub.units.length} curriculum units
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedSubject(sub)}
                                className="w-full py-2.5 px-4 bg-slate-50 hover:bg-gradient-to-r hover:from-indigo-600 hover:to-violet-600 text-slate-700 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-transparent group-hover:shadow-sm cursor-pointer"
                              >
                                <span>Open Subject Intelligence</span>
                                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════
          LEVEL 2: SUBJECT INTELLIGENCE VIEW (UNITS & TOPICS HIERARCHY)
          ════════════════════════════════════════════════════════════════════════════ */}
      {selectedSubject && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
          
          {/* Active Subject Intelligence Banner */}
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div>
                <button
                  type="button"
                  onClick={() => setSelectedSubject(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-200 hover:text-white mb-3 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to Subjects Overview</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 bg-white/10 rounded-lg text-xs font-mono font-bold text-indigo-200">
                    {selectedSubject.code || 'CS101'}
                  </span>
                  <span className="px-2.5 py-1 bg-indigo-500/30 rounded-lg text-xs font-bold text-indigo-100">
                    Semester {selectedSubject.semester}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-black mt-2 tracking-tight">
                  {selectedSubject.name}
                </h2>
              </div>

              {/* Subject Stats Pill */}
              <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/15">
                <div className="text-center px-3 border-r border-white/10">
                  <span className="text-xl font-black text-rose-300">{selectedSubject.learningGaps}</span>
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">Gaps</span>
                </div>
                <div className="text-center px-3 border-r border-white/10">
                  <span className="text-xl font-black text-amber-300">{selectedSubject.needsAttention}</span>
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">Attention</span>
                </div>
                <div className="text-center px-3">
                  <span className="text-xl font-black text-emerald-300">{selectedSubject.strongTopics}</span>
                  <span className="text-[10px] uppercase font-bold text-indigo-200 block">Strong</span>
                </div>
              </div>
            </div>
          </div>

          {/* Units Hierarchy List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-800 tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                <span>Curriculum Units & Topic Weaknesses</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {selectedSubject.units.length} Units • {selectedSubject.totalTopics} Assessed Topics
              </p>
            </div>

            {selectedSubject.units.map((unit) => {
              const isUnitOpen = expandedUnits[unit.unitNumber] ?? true;
              const unitTopics = unit.topics || [];
              const gapCount = unitTopics.filter(t => t.classification === 'LEARNING_GAP').length;
              const attentionCount = unitTopics.filter(t => t.classification === 'NEEDS_ATTENTION').length;

              return (
                <div key={unit.unitId} className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  
                  {/* Unit Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedUnits(prev => ({ ...prev, [unit.unitNumber]: !isUnitOpen }))}
                    className="w-full px-6 py-4 bg-slate-50/80 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left border-b border-slate-100 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                          Unit {unit.unitNumber}
                        </span>
                        <h3 className="text-sm font-black text-slate-900">{unit.unitTitle}</h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
                        {gapCount > 0 && (
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded-md border border-rose-100 text-[10px]">
                            {gapCount} Gaps
                          </span>
                        )}
                        {attentionCount > 0 && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md border border-amber-100 text-[10px]">
                            {attentionCount} Attention
                          </span>
                        )}
                        <span className="text-slate-400 font-medium text-[11px]">
                          {unitTopics.length} topics
                        </span>
                      </div>
                      {isUnitOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    </div>
                  </button>

                  {/* Unit Topics Breakdown */}
                  {isUnitOpen && (
                    <div className="p-5 divide-y divide-slate-100 space-y-3">
                      {unitTopics.map((topic, tIdx) => (
                        <div
                          key={tIdx}
                          ref={el => topicRefs.current[topic.topicTag] = el}
                          className="pt-3 first:pt-0 rounded-2xl transition-all p-3 hover:bg-slate-50/80 border border-transparent hover:border-slate-200"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                {getClassificationBadge(topic.classification)}
                                {topic.lesson_title && (
                                  <span className="text-[10px] text-slate-400 font-bold truncate">
                                    Lesson {topic.lesson_number}: {topic.lesson_title}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-sm font-black text-slate-900">{topic.topicTag}</h4>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <span className="text-lg font-black text-slate-900">{topic.accuracy}%</span>
                                <p className="text-[10px] text-slate-400 font-medium">
                                  {topic.correctAnswers} / {topic.totalQuestions} correct
                                </p>
                              </div>

                              {(topic.classification === 'LEARNING_GAP' || topic.classification === 'NEEDS_ATTENTION') && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRemedialPlan(topic)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>Remedial Plan</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Accuracy Bar */}
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(topic.accuracy)}`}
                              style={{ width: `${topic.accuracy}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium mt-1.5">
                            <span>{topic.attemptedStudents} students attempted</span>
                            {topic.studentsStruggling > 0 && (
                              <span className="text-rose-600 font-bold">
                                {topic.studentsStruggling} struggling students (&lt; 50%)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════════
          PART 9 & 10: HIERARCHICAL SAVED REMEDIAL PLANS (Semester -> Subject -> Unit -> Topic)
          ════════════════════════════════════════════════════════════════════════════ */}
      <div className="border border-indigo-100 rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/40 space-y-6 shadow-xs">
        
        {/* Header and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-indigo-100/80 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
                <Bookmark className="w-4 h-4" />
              </div>
              <h3 className="text-base font-black uppercase tracking-wider text-indigo-950">
                SAVED REMEDIAL PLANS
              </h3>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
                {savedPlans.length} Total
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Hierarchical repository of faculty-authored remedial learning packages organized by academic structure.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={savedPlansSearchQuery}
              onChange={(e) => setSavedPlansSearchQuery(e.target.value)}
              placeholder="Search saved remedial plans..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-8 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            {savedPlansSearchQuery && (
              <button
                type="button"
                onClick={() => setSavedPlansSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Hierarchical Content Tree */}
        {loadingSavedPlans ? (
          <div className="flex items-center justify-center py-12 gap-2 text-slate-400 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Loading saved remedial packages from database...</span>
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-100">
            <Bookmark className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">No saved remedial plans yet.</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Generate an AI remedial plan on any learning gap topic above and click "Save Remedial Plan" to store it permanently.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            
            {/* Iterating Semesters */}
            {Object.keys(hierarchicalSavedPlans.semesters).map((semKey) => {
              const semData = hierarchicalSavedPlans.semesters[semKey];
              const isSemOpen = expandedSavedSemesters[semKey] ?? true;

              return (
                <div key={semKey} className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs">
                  
                  {/* Semester Level Accordion */}
                  <button
                    type="button"
                    onClick={() => setExpandedSavedSemesters(prev => ({ ...prev, [semKey]: !isSemOpen }))}
                    className="w-full px-5 py-3.5 bg-slate-50/90 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left border-b border-slate-150 cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <FolderOpen className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-black uppercase text-slate-900 tracking-wider">
                        Semester {semData.semester}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400">
                      {isSemOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>

                  {isSemOpen && (
                    <div className="p-4 space-y-3 pl-6">
                      
                      {/* Subject Level */}
                      {Object.keys(semData.subjects).map((subKey) => {
                        const subData = semData.subjects[subKey];
                        const isSubOpen = expandedSavedSubjects[subKey] ?? true;

                        return (
                          <div key={subKey} className="border-l-2 border-indigo-200 pl-4 space-y-2">
                            
                            <button
                              type="button"
                              onClick={() => setExpandedSavedSubjects(prev => ({ ...prev, [subKey]: !isSubOpen }))}
                              className="flex items-center gap-2 text-xs font-black text-indigo-900 hover:text-indigo-600 transition-colors cursor-pointer py-1"
                            >
                              {isSubOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-600" /> : <ChevronRight className="w-3.5 h-3.5 text-indigo-600" />}
                              <span>{subData.name}</span>
                              {subData.code && <span className="text-slate-400 font-normal">({subData.code})</span>}
                            </button>

                            {isSubOpen && (
                              <div className="space-y-3 pl-4">
                                
                                {/* Unit Level */}
                                {Object.keys(subData.units).map((unitKey) => {
                                  const unitData = subData.units[unitKey];
                                  const isUnitOpen = expandedSavedUnits[unitKey] ?? true;

                                  return (
                                    <div key={unitKey} className="border-l-2 border-purple-200 pl-4 space-y-2">
                                      
                                      <button
                                        type="button"
                                        onClick={() => setExpandedSavedUnits(prev => ({ ...prev, [unitKey]: !isUnitOpen }))}
                                        className="flex items-center gap-2 text-xs font-bold text-slate-800 hover:text-purple-700 transition-colors cursor-pointer py-1"
                                      >
                                        {isUnitOpen ? <ChevronDown className="w-3.5 h-3.5 text-purple-600" /> : <ChevronRight className="w-3.5 h-3.5 text-purple-600" />}
                                        <span className="uppercase text-[10px] text-purple-700 font-extrabold">Unit {unitData.unitNumber}</span>
                                        <span>• {unitData.unitTitle}</span>
                                      </button>

                                      {isUnitOpen && (
                                        <div className="space-y-3 pl-4">
                                          
                                          {/* Topic Level */}
                                          {Object.keys(unitData.topics).map((topicTag) => {
                                            const topicPlans = unitData.topics[topicTag];
                                            const isTopicOpen = expandedSavedTopics[topicTag] ?? true;

                                            return (
                                              <div key={topicTag} className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                                                
                                                <div
                                                  onClick={() => setExpandedSavedTopics(prev => ({ ...prev, [topicTag]: !isTopicOpen }))}
                                                  className="flex items-center justify-between cursor-pointer"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                                    <h4 className="text-xs font-black text-slate-900">
                                                      {topicTag}
                                                    </h4>
                                                  </div>
                                                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                                                    {topicPlans.length} {topicPlans.length === 1 ? 'Plan' : 'Plans'}
                                                  </span>
                                                </div>

                                                {/* Saved Plan Cards for this Topic */}
                                                {isTopicOpen && (
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                                                    {topicPlans.map((plan) => (
                                                      <div
                                                        key={plan.id}
                                                        className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs hover:shadow-xs transition-all space-y-2.5 flex flex-col justify-between"
                                                      >
                                                        <div>
                                                          <div className="flex items-center justify-between gap-2">
                                                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[10px] font-black uppercase">
                                                              {plan.status || 'PUBLISHED'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                              {plan.updated_at ? new Date(plan.updated_at).toLocaleDateString() : 'Recent'}
                                                            </span>
                                                          </div>
                                                          <p className="text-xs font-bold text-slate-800 mt-1.5 truncate">
                                                            Faculty Remedial Package
                                                          </p>
                                                          <p className="text-[10px] text-slate-500 font-medium truncate">
                                                            By {plan.author_name || 'Faculty Member'}
                                                          </p>
                                                        </div>

                                                        <button
                                                          type="button"
                                                          onClick={() => handleViewSavedPlanDetails(plan)}
                                                          className="w-full py-1.5 px-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                                        >
                                                          <FileText className="w-3.5 h-3.5" />
                                                          <span>View Plan</span>
                                                        </button>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Legacy / Uncategorized Plans Branch */}
            {hierarchicalSavedPlans.legacy.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setExpandedLegacyPlans(!expandedLegacyPlans)}
                  className="w-full px-5 py-3.5 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-left border-b border-slate-150 cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      Uncategorized / Legacy Plans ({hierarchicalSavedPlans.legacy.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-400">
                    {expandedLegacyPlans ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>

                {expandedLegacyPlans && (
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {hierarchicalSavedPlans.legacy.map((plan) => (
                      <div
                        key={plan.id}
                        className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2 flex flex-col justify-between"
                      >
                        <div>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-black uppercase">
                            {plan.status || 'SAVED'}
                          </span>
                          <h5 className="text-xs font-bold text-slate-800 mt-1 truncate">
                            {plan.topic_tag || 'Legacy Topic'}
                          </h5>
                          <p className="text-[10px] text-slate-400">By {plan.author_name || 'Faculty'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleViewSavedPlanDetails(plan)}
                          className="w-full py-1.5 px-3 bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-700 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>View Plan</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════════════
          PART 12, 13, 14, 15: REMEDIAL PLAN GENERATION MODAL (VIEWPORT CENTERED VIA REACT PORTAL)
          ════════════════════════════════════════════════════════════════════════════ */}
      {showRemedialModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ margin: 0 }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/80">
            
            {/* Fixed Modal Header with Academic Context */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl shadow-xs">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Faculty Remedial Package
                  </h3>
                  <p className="text-xs text-slate-500">
                    AI-Synthesized Intervention for Cohort Learning Gaps
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowRemedialModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Academic Context Bar */}
            <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-3 text-xs font-bold text-slate-600 flex-wrap shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[10px]">
                  Semester {targetTopicForRemedial?.semester || selectedSubject?.semester || 1}
                </span>
                <span className="font-extrabold text-slate-800">
                  {selectedSubject?.name || targetTopicForRemedial?.subject_name || 'MATHS'}
                </span>
                {targetTopicForRemedial?.unit_title && (
                  <span className="text-slate-400">• {targetTopicForRemedial.unit_title}</span>
                )}
                <span className="text-indigo-900 font-black">• Topic: {targetTopicForRemedial?.topicTag}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <span>
                  Affected: <strong className="text-rose-600">{targetTopicForRemedial?.studentsStruggling || 1} / {targetTopicForRemedial?.attemptedStudents || 1} Students</strong>
                </span>
                <span>
                  Accuracy: <strong className="text-amber-600">{targetTopicForRemedial?.accuracy !== undefined ? `${targetTopicForRemedial.accuracy}%` : 'Low'}</strong>
                </span>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-white">
              
              {generatingRemedial ? (
                /* Instant Loading Skeleton UX with Step Indicators */
                <div className="flex flex-col items-center justify-center py-16 text-center space-y-5">
                  <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                    <Sparkles className="w-6 h-6 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
                  </div>

                  <div className="space-y-2 max-w-md mx-auto">
                    <h4 className="text-base font-black text-slate-900">
                      Generating AI-Synthesized Remedial Intervention...
                    </h4>
                    <p className="text-xs text-slate-500">
                      Analyzing question-level performance, prerequisite weaknesses, and pedagogical interventions.
                    </p>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2 text-xs font-semibold text-slate-600 w-full max-w-sm">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Cohort performance analyzed</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Topic weaknesses identified</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Prerequisite knowledge evaluated</span>
                    </div>
                    <div className="flex items-center gap-2 text-indigo-600 animate-pulse font-bold">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating targeted intervention...</span>
                    </div>
                  </div>
                </div>
              ) : remedialError ? (
                /* Error State with Try Again */
                <div className="p-8 text-center bg-rose-50 rounded-2xl border border-rose-100 space-y-3">
                  <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto" />
                  <h4 className="text-sm font-bold text-rose-800">Unable to generate remedial plan</h4>
                  <p className="text-xs text-rose-600 max-w-md mx-auto">{remedialError}</p>
                  <button
                    type="button"
                    onClick={() => handleOpenRemedialPlan(targetTopicForRemedial)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Try Again</span>
                  </button>
                </div>
              ) : remedialPlan ? (
                /* Pedagogical Content Order (Prerequisites, Core, Example, Mistakes, Practice, Reassessment, Followup) */
                <div className="space-y-6">

                  {/* 1. PREREQUISITE KNOWLEDGE TO REVIEW FIRST */}
                  {remedialPlan.prerequisiteRecap && (
                    <div className="p-5 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-2 shadow-2xs">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>1. PREREQUISITE KNOWLEDGE TO REVIEW FIRST</span>
                      </h4>
                      <p className="text-xs text-amber-950 leading-relaxed font-medium whitespace-pre-wrap">
                        {remedialPlan.prerequisiteRecap}
                      </p>
                    </div>
                  )}

                  {/* 2. CORE CONCEPT & LEARNING OBJECTIVE */}
                  {remedialPlan.conceptExplanation && (
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>2. CORE CONCEPT & LEARNING OBJECTIVE</span>
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                        {remedialPlan.conceptExplanation}
                      </p>
                    </div>
                  )}

                  {/* 3. WORKED STEP-BY-STEP EXAMPLE */}
                  {remedialPlan.example && (
                    <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-indigo-600" />
                        <span>3. WORKED EXAMPLE</span>
                      </h4>
                      <div className="p-3.5 bg-white rounded-xl border border-indigo-100 text-xs text-indigo-950 leading-relaxed font-medium whitespace-pre-wrap font-mono">
                        {remedialPlan.example}
                      </div>
                    </div>
                  )}

                  {/* 4. COMMON MISTAKES & MISCONCEPTIONS */}
                  {remedialPlan.commonMistakes && remedialPlan.commonMistakes.length > 0 && (
                    <div className="p-5 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-rose-900 flex items-center gap-2">
                        <Target className="w-4 h-4 text-rose-600" />
                        <span>4. COMMON MISTAKES</span>
                      </h4>
                      <ul className="space-y-2">
                        {remedialPlan.commonMistakes.map((mistake, mIdx) => (
                          <li key={mIdx} className="text-xs text-rose-950 font-medium flex items-start gap-2.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                            <span>{mistake}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 5. TARGETED PRACTICE EXERCISES */}
                  {remedialPlan.practiceExercises && remedialPlan.practiceExercises.length > 0 && (
                    <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-2xs">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>5. TARGETED PRACTICE EXERCISES</span>
                      </h4>
                      <div className="space-y-2.5">
                        {remedialPlan.practiceExercises.map((ex, exIdx) => (
                          <div key={exIdx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 font-medium">
                            <strong>Problem {exIdx + 1}:</strong> {ex}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 6. QUICK ASSESSMENT / REASSESSMENT */}
                  {remedialPlan.quickAssessmentQuestions && remedialPlan.quickAssessmentQuestions.length > 0 && (
                    <div className="p-5 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                        <span>6. QUICK ASSESSMENT / REASSESSMENT</span>
                      </h4>
                      <div className="space-y-3">
                        {remedialPlan.quickAssessmentQuestions.map((q, qIdx) => (
                          <div key={qIdx} className="p-4 bg-white rounded-xl border border-purple-100 text-xs space-y-2.5 shadow-2xs">
                            <p className="font-bold text-slate-900">Q{qIdx + 1}: {q.question}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {q.options?.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`p-2.5 rounded-lg border text-[11px] font-medium ${
                                    oIdx === q.correctIndex
                                      ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                      : 'bg-slate-50 border-slate-200 text-slate-700'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  {oIdx === q.correctIndex && <span className="ml-1 text-emerald-600">✓ (Correct)</span>}
                                </div>
                              ))}
                            </div>
                            {q.explanation && (
                              <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                Rationale: {q.explanation}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 7. RECOMMENDED FOLLOW-UP */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600 space-y-1">
                    <p className="font-bold text-slate-800">7. RECOMMENDED FOLLOW-UP</p>
                    <p>
                      Review prerequisite gaps during tutorial hour, demonstrate worked solution on the whiteboard, and administer a 5-minute micro-quiz within 48 hours.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Fixed Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowRemedialModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>

              {remedialPlan && (
                <button
                  type="button"
                  disabled={savingPlan || planSavedSuccessfully}
                  onClick={handleSaveRemedialPlan}
                  className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer ${
                    planSavedSuccessfully
                      ? 'bg-emerald-600 text-white cursor-default'
                      : savingPlan
                      ? 'bg-indigo-400 text-white cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
                  }`}
                >
                  {savingPlan ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : planSavedSuccessfully ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Saved in Database</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Remedial Plan</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════════════════════════
          PART 18: VIEW SAVED PLAN MODAL (VIEWPORT CENTERED VIA REACT PORTAL)
          ════════════════════════════════════════════════════════════════════════════ */}
      {viewingSavedPlan && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ margin: 0 }}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 via-purple-50 to-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                  <Bookmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Saved Remedial Package
                  </h3>
                  <p className="text-xs text-slate-500">
                    {viewingSavedPlan.subject_name || 'MATHS'} • {viewingSavedPlan.unit_title || 'Unit'} • {viewingSavedPlan.topic_tag}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingSavedPlan(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-white rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Plan Metadata Bar */}
            <div className="px-6 py-2.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600 flex-wrap gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black uppercase">
                  {viewingSavedPlan.status || 'PUBLISHED'}
                </span>
                <span>By: {viewingSavedPlan.author_name || 'Faculty'}</span>
              </div>
              <span className="text-[11px] text-slate-400">
                Saved on {new Date(viewingSavedPlan.updated_at || viewingSavedPlan.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5 bg-white">
              {(() => {
                const plan = viewingSavedPlan.plan_content || {};
                return (
                  <>
                    {plan.prerequisiteRecap && (
                      <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-2xl space-y-1.5">
                        <h4 className="text-xs font-black uppercase text-amber-900">1. Prerequisite Knowledge</h4>
                        <p className="text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">{plan.prerequisiteRecap}</p>
                      </div>
                    )}

                    {plan.conceptExplanation && (
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-1.5 shadow-2xs">
                        <h4 className="text-xs font-black uppercase text-slate-900">2. Core Concept & Objective</h4>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{plan.conceptExplanation}</p>
                      </div>
                    )}

                    {plan.example && (
                      <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1.5">
                        <h4 className="text-xs font-black uppercase text-indigo-900">3. Worked Step-by-Step Example</h4>
                        <div className="p-3 bg-white rounded-xl border border-indigo-100 text-xs font-mono text-indigo-950 whitespace-pre-wrap">
                          {plan.example}
                        </div>
                      </div>
                    )}

                    {plan.commonMistakes && plan.commonMistakes.length > 0 && (
                      <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-2xl space-y-2">
                        <h4 className="text-xs font-black uppercase text-rose-900">4. Common Mistakes</h4>
                        <ul className="space-y-1.5">
                          {plan.commonMistakes.map((m, idx) => (
                            <li key={idx} className="text-xs text-rose-950 flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {plan.practiceExercises && plan.practiceExercises.length > 0 && (
                      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-2xs">
                        <h4 className="text-xs font-black uppercase text-slate-900">5. Practice Exercises</h4>
                        <div className="space-y-2">
                          {plan.practiceExercises.map((ex, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 rounded-xl text-xs text-slate-800">
                              <strong>Problem {idx + 1}:</strong> {ex}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {plan.quickAssessmentQuestions && plan.quickAssessmentQuestions.length > 0 && (
                      <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-2xl space-y-2">
                        <h4 className="text-xs font-black uppercase text-purple-900">6. Assessment Questions</h4>
                        <div className="space-y-2.5">
                          {plan.quickAssessmentQuestions.map((q, idx) => (
                            <div key={idx} className="p-3 bg-white rounded-xl border border-purple-100 text-xs space-y-2 shadow-2xs">
                              <p className="font-bold text-slate-900">Q{idx + 1}: {q.question}</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {q.options?.map((opt, oIdx) => (
                                  <div
                                    key={oIdx}
                                    className={`p-2 rounded text-[11px] font-medium border ${
                                      oIdx === q.correctIndex
                                        ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                        : 'bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Fixed Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewingSavedPlan(null)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
