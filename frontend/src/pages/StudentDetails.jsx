import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Activity,
  ArrowLeft,
  BookOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  FileText,
  ChevronRight,
  ChevronDown,
  Sparkles,
  RefreshCw,
  Layers,
  Eye,
  BarChart3,
  Target,
  GraduationCap,
  Check,
  X,
  ShieldAlert,
  Flame,
  HelpCircle,
  Filter,
  Search,
  FolderOpen
} from 'lucide-react';
import api from '../api/axios';

export default function StudentDetails() {
  const { studentId } = useParams();
  const navigate = useNavigate();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState('subjects'); // 'subjects' | 'summary' | 'history' | 'topics' | 'mistakes' | 'insights'

  // Data states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [subjectsData, setSubjectsData] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [history, setHistory] = useState([]);
  const [topics, setTopics] = useState([]);
  const [mistakes, setMistakes] = useState({ topics: [], totalMistakes: 0 });

  // Accordion state for Subjects view
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedAssessments, setExpandedAssessments] = useState({});

  // Filters for Chronological History tab
  const [historyFilterSubject, setHistoryFilterSubject] = useState('ALL');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('ALL');
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Modal for Attempt Detail Review
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [attemptDetail, setAttemptDetail] = useState(null);
  const [attemptDetailLoading, setAttemptDetailLoading] = useState(false);
  const [attemptDetailError, setAttemptDetailError] = useState('');

  // Mistake filter
  const [selectedMistakeTopic, setSelectedMistakeTopic] = useState('ALL');

  useEffect(() => {
    fetchAllData();
  }, [studentId]);

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      // Parallel fetch of all student assessment datasets from mentor endpoints
      const [overviewRes, subjectsRes, summaryRes, historyRes, topicsRes, mistakesRes] = await Promise.all([
        api.get(`/mentor/mentees/${studentId}/overview`),
        api.get(`/mentor/mentees/${studentId}/subjects`),
        api.get(`/mentor/mentees/${studentId}/assessment-summary`),
        api.get(`/mentor/mentees/${studentId}/assessment-history`),
        api.get(`/mentor/mentees/${studentId}/topic-performance`),
        api.get(`/mentor/mentees/${studentId}/mistake-analysis`)
      ]);

      setOverview(overviewRes.data || {});
      const subjectsList = subjectsRes.data?.subjects || [];
      setSubjectsData(subjectsList);
      
      // Auto-expand the first subject by default if available
      if (subjectsList.length > 0) {
        const initialSubMap = {};
        initialSubMap[subjectsList[0].subjectId] = true;
        setExpandedSubjects(initialSubMap);
      }

      setAssessments(summaryRes.data?.assessments || []);
      setHistory(historyRes.data?.history || historyRes.data?.attempts || []);
      setTopics(topicsRes.data?.topics || []);
      
      const rawMistakes = mistakesRes.data || {};
      const topicList = rawMistakes.topics || rawMistakes.topicMistakes || [];
      setMistakes({
        topics: topicList,
        topicMistakes: topicList,
        totalMistakes: rawMistakes.totalMistakes || 0
      });
    } catch (err) {
      console.error('Failed to load student assessment data:', err);
      const status = err.response?.status;
      if (status === 403) {
        setError('Unauthorized: You do not have permission to view this student’s assessment records. Mentors can only view assigned mentees, and HODs can only view students in their department.');
      } else if (status === 404) {
        setError('Student not found or has been removed.');
      } else {
        setError(err.response?.data?.error || 'Failed to fetch student details and assessment history.');
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subjectId) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subjectId]: !prev[subjectId]
    }));
  };

  const toggleAssessment = (quizId) => {
    setExpandedAssessments(prev => ({
      ...prev,
      [quizId]: !prev[quizId]
    }));
  };

  const handleOpenAttemptDetail = async (attemptId) => {
    setSelectedAttemptId(attemptId);
    setAttemptDetail(null);
    setAttemptDetailLoading(true);
    setAttemptDetailError('');
    try {
      const res = await api.get(`/mentor/mentees/${studentId}/attempts/${attemptId}`);
      setAttemptDetail(res.data);
    } catch (err) {
      console.error('Failed to fetch attempt details:', err);
      setAttemptDetailError(err.response?.data?.error || 'Failed to load attempt question analysis.');
    } finally {
      setAttemptDetailLoading(false);
    }
  };

  const handleCloseAttemptDetail = () => {
    setSelectedAttemptId(null);
    setAttemptDetail(null);
    setAttemptDetailError('');
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-14 h-14 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
          <Sparkles className="w-5 h-5 text-indigo-500 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="text-sm font-semibold text-slate-500">Loading student assessment performance...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-rose-50/90 backdrop-blur-xl border border-rose-200/80 rounded-3xl shadow-lg shadow-rose-100/50 text-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-rose-900 mb-2">Access Restricted</h2>
        <p className="text-sm text-rose-700 leading-relaxed mb-6">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-200 inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  const { student, stats, recentAssessments = [] } = overview || {};
  const hasAttempts = (stats?.totalAssessmentAttempts || 0) > 0;

  // Category badge helper for topic cards
  const getCategoryBadge = (category) => {
    switch (category) {
      case 'REPEATED_WEAKNESS':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full inline-flex items-center gap-1"><Flame className="w-3 h-3" /> Repeated Weakness</span>;
      case 'RECENT_FAILURE':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Recent Failure</span>;
      case 'NEEDS_PRACTICE':
        return <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Needs Practice</span>;
      case 'IMPROVING':
        return <span className="px-2.5 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Improving</span>;
      case 'STRONG':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Strong Mastery</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">{category}</span>;
    }
  };

  const getFilteredMistakes = () => {
    const list = mistakes?.topics || mistakes?.topicMistakes || [];
    if (selectedMistakeTopic === 'ALL') {
      return list;
    }
    return list.filter(t => t.topicTag === selectedMistakeTopic);
  };

  const getFilteredHistory = () => {
    return history.filter(item => {
      const matchSubject = historyFilterSubject === 'ALL' || item.subjectName === historyFilterSubject || item.subjectCode === historyFilterSubject;
      const isPassed = item.status === 'PASSED' || item.percentage >= 60;
      const matchStatus = historyFilterStatus === 'ALL' || (historyFilterStatus === 'PASSED' ? isPassed : !isPassed);
      const search = historySearchQuery.toLowerCase();
      const matchSearch = !search || 
        (item.quizTitle && item.quizTitle.toLowerCase().includes(search)) ||
        (item.materialTitle && item.materialTitle.toLowerCase().includes(search)) ||
        (item.subjectName && item.subjectName.toLowerCase().includes(search)) ||
        (item.topicTag && item.topicTag.toLowerCase().includes(search));
      
      return matchSubject && matchStatus && matchSearch;
    });
  };

  const distinctSubjectsInHistory = Array.from(new Set(history.map(h => h.subjectName).filter(Boolean)));

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out space-y-8 max-w-7xl mx-auto pb-16">
      {/* PART 2: HEADER */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 text-sm font-bold mb-3 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Mentees
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-indigo-200">
              {student?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {student?.name}
                </h1>
                <span className="text-xs font-extrabold px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 shadow-sm">
                  {student?.year || 'Year not available'}
                </span>
              </div>
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-2 flex-wrap mt-1">
                <span>Roll No: <strong className="text-slate-800">{student?.rollNumber || 'N/A'}</strong></span>
                <span>•</span>
                <span>Dept: <strong className="text-slate-800">{student?.department}</strong></span>
                <span>•</span>
                <span>Batch: <strong className="text-slate-800">{student?.batch}</strong></span>
                <span>•</span>
                <span>Mentor: <strong className="text-slate-800">{student?.mentor}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Refresh */}
        <button
          onClick={fetchAllData}
          className="self-start md:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-sm transition-all flex items-center gap-2 shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Refresh Assessment Data
        </button>
      </header>

      {/* PART 3: COMPACT OVERVIEW CARDS */}
      <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
        {!hasAttempts ? (
          <div className="p-8 text-center bg-slate-50/60 rounded-2xl border border-dashed border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-base font-bold text-slate-700">No assessment attempts yet.</p>
            <p className="text-xs text-slate-400 mt-0.5">This student has not submitted any quiz assessments yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Total Assessments */}
            <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Assessments</span>
              <p className="text-2xl font-black text-slate-800">{stats?.totalAssessmentsAttempted}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Unique Quizzes</p>
            </div>

            {/* Total Attempts */}
            <div className="p-4 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Total Attempts</span>
              <p className="text-2xl font-black text-slate-800">{stats?.totalAssessmentAttempts}</p>
              <p className="text-[11px] font-semibold text-slate-400 mt-1">Total Submissions</p>
            </div>

            {/* Cleared Assessments */}
            <div className="p-4 bg-emerald-50/70 hover:bg-emerald-50 rounded-2xl border border-emerald-100 transition-all">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block mb-1">Cleared</span>
              <p className="text-2xl font-black text-emerald-700">{stats?.totalAssessmentsCleared}</p>
              <p className="text-[11px] font-semibold text-emerald-600/80 mt-1">Passed (≥60%)</p>
            </div>

            {/* Failed Assessments */}
            <div className="p-4 bg-rose-50/70 hover:bg-rose-50 rounded-2xl border border-rose-100 transition-all">
              <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block mb-1">Failed</span>
              <p className="text-2xl font-black text-rose-700">{stats?.totalFailedAssessments}</p>
              <p className="text-[11px] font-semibold text-rose-600/80 mt-1">Not Cleared</p>
            </div>

            {/* Average Score */}
            <div className="p-4 bg-violet-50/70 hover:bg-violet-50 rounded-2xl border border-violet-100 transition-all">
              <span className="text-[11px] font-bold text-violet-600 uppercase tracking-wider block mb-1">Average Score</span>
              <p className="text-2xl font-black text-violet-700">{stats?.averageScore}%</p>
              <p className="text-[11px] font-semibold text-violet-600/80 mt-1">Mean Score</p>
            </div>

            {/* Overall Accuracy */}
            <div className="p-4 bg-indigo-50/70 hover:bg-indigo-50 rounded-2xl border border-indigo-100 transition-all">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block mb-1">Overall Accuracy</span>
              <p className="text-2xl font-black text-indigo-700">{stats?.overallAccuracy}%</p>
              <p className="text-[11px] font-semibold text-indigo-600/80 mt-1">Question Accuracy</p>
            </div>
          </div>
        )}
      </div>

      {/* PART 4: RECENT ASSESSMENTS */}
      {hasAttempts && recentAssessments.length > 0 && (
        <section className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Recent Assessments
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Most recent assessment attempts by this student.</p>
            </div>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors group"
            >
              View All Assessment History <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentAssessments.slice(0, 2).map((item) => {
              const isCleared = item.status === 'Cleared' || item.percentage >= 60;
              return (
                <div
                  key={item.attemptId}
                  onClick={() => handleOpenAttemptDetail(item.attemptId)}
                  className="p-5 rounded-2xl border border-slate-150/80 bg-gradient-to-br from-white to-slate-50/60 hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors text-base leading-snug">
                        {item.quizTitle}
                      </h3>
                      <span className={`px-2.5 py-0.5 text-[11px] font-extrabold rounded-full shrink-0 ${
                        isCleared ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isCleared ? 'Cleared' : 'Failed'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>Subject: <strong className="text-slate-700">{item.subjectName} {item.subjectCode && `(${item.subjectCode})`}</strong></p>
                      <p>Topic: <strong className="text-indigo-600">#{item.topicTitle}</strong></p>
                      <p className="text-[11px] text-slate-400">
                        Date: {new Date(item.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                        Attempt #{item.attemptNumber}
                      </span>
                      <span className="text-sm font-black text-slate-800">
                        Score: <span className={isCleared ? 'text-emerald-600' : 'text-rose-600'}>{item.percentage}%</span>
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 group-hover:underline flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" /> View Attempt Details
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION TABS */}
      <div className="flex border-b border-slate-200/80 space-x-2 md:space-x-4 overflow-x-auto pb-px">
        {[
          { id: 'subjects', label: 'Subjects & Attempts', icon: FolderOpen, count: subjectsData.length },
          { id: 'summary', label: 'Assessment Summary', icon: Layers, count: assessments.length },
          { id: 'history', label: 'Assessment History', icon: Clock, count: history.length },
          { id: 'topics', label: 'Topic Performance', icon: BarChart3, count: topics.length },
          { id: 'mistakes', label: 'Mistake Analysis', icon: AlertTriangle, count: mistakes.totalMistakes },
          { id: 'insights', label: 'AI Learning Insights', icon: Sparkles, count: topics.filter(t => t.category === 'REPEATED_WEAKNESS' || t.category === 'RECENT_FAILURE').length }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3.5 px-4 font-bold text-sm flex items-center gap-2 whitespace-nowrap transition-all border-b-2 ${
                isActive
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                  isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* PART 5 & 6: SUBJECT-WISE ASSESSMENT HISTORY TAB */}
      {activeTab === 'subjects' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {subjectsData.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Subject Assessment Activity</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                No assessments have been recorded under any subjects for this student yet.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Enrolled Subjects with Assessment Activity</h3>
                  <p className="text-xs text-slate-500">Click any subject to inspect all quizzes and separate individual attempts.</p>
                </div>
                <span className="text-xs font-bold text-slate-400">{subjectsData.length} Subjects Active</span>
              </div>

              <div className="space-y-4">
                {subjectsData.map((sub) => {
                  const isExpanded = !!expandedSubjects[sub.subjectId];
                  return (
                    <div
                      key={sub.subjectId}
                      className="bg-white/90 backdrop-blur-xl rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden transition-all"
                    >
                      {/* Subject Accordion Header */}
                      <button
                        onClick={() => toggleSubject(sub.subjectId)}
                        className="w-full p-6 text-left flex items-center justify-between hover:bg-slate-50/70 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                              {sub.subjectName}
                              {sub.subjectCode && <span className="text-xs font-semibold text-slate-400">({sub.subjectCode})</span>}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Assessment Attempts: <strong className="text-slate-800">{sub.totalAttempts}</strong> • Assessments: <strong className="text-slate-800">{sub.totalAssessments}</strong>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full hidden sm:inline-block">
                            {sub.totalAttempts} {sub.totalAttempts === 1 ? 'Attempt' : 'Attempts'}
                          </span>
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </div>
                      </button>

                      {/* Subject Content: List of Quizzes and Attempts */}
                      {isExpanded && (
                        <div className="p-6 pt-0 border-t border-slate-100 space-y-4 bg-slate-50/30">
                          {sub.assessments?.map((quiz) => {
                            const isQuizOpen = expandedAssessments[quiz.quizId] !== false; // open by default
                            const isCleared = quiz.status === 'Cleared';
                            return (
                              <div
                                key={quiz.quizId}
                                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-4"
                              >
                                {/* Quiz Summary Header */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h5 className="text-sm font-black text-slate-900">
                                        Assessment: {quiz.quizTitle || quiz.materialTitle}
                                      </h5>
                                      {isCleared ? (
                                        <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" /> Cleared (Attempt #{quiz.clearedOnAttempt})
                                        </span>
                                      ) : (
                                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[11px] font-bold rounded-full border border-rose-200 flex items-center gap-1">
                                          <XCircle className="w-3 h-3" /> Not Cleared
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500">
                                      Topic: <span className="font-semibold text-indigo-600">#{quiz.topicTitle}</span>
                                      {quiz.unitTitle && <span> • {quiz.unitTitle}</span>}
                                    </p>
                                  </div>

                                  {/* Stats pills */}
                                  <div className="flex items-center gap-3 text-xs flex-wrap">
                                    <div className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                      <span className="text-[10px] text-slate-400 font-bold block">First Score</span>
                                      <strong className="text-slate-700">{quiz.firstScore}%</strong>
                                    </div>
                                    <div className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-100 text-center">
                                      <span className="text-[10px] text-slate-400 font-bold block">Latest Score</span>
                                      <strong className="text-slate-800">{quiz.latestScore}%</strong>
                                    </div>
                                    <div className="px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100 text-center">
                                      <span className="text-[10px] text-indigo-600 font-bold block">Best Score</span>
                                      <strong className="text-indigo-700">{quiz.bestScore}%</strong>
                                    </div>
                                  </div>
                                </div>

                                {/* List of Attempts under this Assessment */}
                                <div className="space-y-2 pt-2 border-t border-slate-100">
                                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Attempt History ({quiz.attempts?.length || 0})
                                  </span>
                                  <div className="grid grid-cols-1 gap-2">
                                    {quiz.attempts?.map((att) => {
                                      const isPassed = att.status === 'PASSED' || att.percentage >= 60;
                                      return (
                                        <div
                                          key={att.attemptId}
                                          className="p-3 bg-slate-50/70 hover:bg-indigo-50/50 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                                        >
                                          <div className="flex items-center gap-3">
                                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                                              isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              #{att.attemptNumber}
                                            </span>
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-800">
                                                  Attempt #{att.attemptNumber}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                  isPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                  {isPassed ? 'Passed' : 'Failed'}
                                                </span>
                                              </div>
                                              <p className="text-[11px] text-slate-400 mt-0.5">
                                                {att.correctAnswers} / {att.totalQuestions} Correct • Accuracy: {att.accuracy}% • {new Date(att.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                              </p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-3 self-end sm:self-center">
                                            <span className={`text-base font-black ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {att.percentage}%
                                            </span>
                                            <button
                                              onClick={() => handleOpenAttemptDetail(att.attemptId)}
                                              className="px-3 py-1 bg-white hover:bg-indigo-600 text-indigo-600 hover:text-white rounded-lg text-xs font-bold border border-indigo-200 transition-all flex items-center gap-1 shadow-sm"
                                            >
                                              <Eye className="w-3 h-3" /> Review Attempt
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: ASSESSMENT SUMMARY */}
      {activeTab === 'summary' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {assessments.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm">
              <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Assessment Attempts Yet</h3>
              <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">
                This student has not submitted any quiz assessments yet. Once they complete assessments, summaries and performance metrics will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {assessments.map(quiz => {
                const isCleared = quiz.status === 'Cleared';
                return (
                  <div
                    key={quiz.quizId}
                    className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-lg font-bold text-slate-900">{quiz.quizTitle || quiz.materialTitle}</h3>
                        {isCleared ? (
                          <span className="px-3 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared (Attempt #{quiz.clearedOnAttempt})
                          </span>
                        ) : (
                          <span className="px-3 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200 inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Not Cleared
                          </span>
                        )}
                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">
                          {quiz.attemptsCount} {quiz.attemptsCount === 1 ? 'Attempt' : 'Attempts'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-700">{quiz.subjectName} ({quiz.subjectCode})</span>
                        {quiz.unitTitle && <span>• {quiz.unitTitle}</span>}
                        {quiz.topicTag && <span className="text-indigo-600 font-semibold">• #{quiz.topicTag}</span>}
                      </p>

                      <p className="text-xs text-slate-400">
                        Latest Attempt: {new Date(quiz.latestAttemptDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>

                    {/* Performance numbers */}
                    <div className="flex items-center gap-4 sm:gap-6 flex-wrap lg:flex-nowrap border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100">
                      <div className="text-center min-w-[70px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">First Score</p>
                        <p className="text-base font-bold text-slate-700">{quiz.firstScore}%</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Latest Score</p>
                        <p className="text-base font-bold text-slate-800">{quiz.latestScore}%</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Best Score</p>
                        <p className="text-lg font-black text-indigo-600">{quiz.bestScore}%</p>
                      </div>
                      <div className="text-center min-w-[70px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Accuracy</p>
                        <p className="text-base font-bold text-emerald-600">{quiz.accuracy}%</p>
                      </div>
                      <div className="text-center min-w-[80px]">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Questions</p>
                        <p className="text-xs font-semibold text-slate-600">{quiz.correctAnswers} / {quiz.totalQuestions} Correct</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PART 12: CHRONOLOGICAL ASSESSMENT HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {history.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm">
              <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No History Recorded</h3>
              <p className="text-sm text-slate-400 mt-1">No assessment attempts have been logged yet.</p>
            </div>
          ) : (
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-5">
              {/* Header & Filter Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Chronological Attempt Records</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Every attempt is preserved immutably. Click any attempt to inspect question-level answers.</p>
                </div>
                <span className="text-xs font-bold text-slate-400">{history.length} Total Attempts</span>
              </div>

              {/* Filter Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-100">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filter Subject</label>
                  <select
                    value={historyFilterSubject}
                    onChange={(e) => setHistoryFilterSubject(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Subjects</option>
                    {distinctSubjectsInHistory.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Filter Status</label>
                  <select
                    value={historyFilterStatus}
                    onChange={(e) => setHistoryFilterStatus(e.target.value)}
                    className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Results</option>
                    <option value="PASSED">Passed (≥60%)</option>
                    <option value="FAILED">Failed (&lt;60%)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Search Assessment / Topic</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      className="w-full text-xs font-semibold bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Attempt list */}
              <div className="divide-y divide-slate-100">
                {getFilteredHistory().length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-8">No assessment attempts matched the filter criteria.</p>
                ) : (
                  getFilteredHistory().map((attempt) => {
                    const isPassed = attempt.status === 'PASSED' || attempt.percentage >= 60;
                    return (
                      <div
                        key={attempt.attemptId}
                        className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-indigo-50/40 px-4 -mx-4 rounded-2xl transition-colors cursor-pointer group"
                        onClick={() => handleOpenAttemptDetail(attempt.attemptId)}
                      >
                        <div className="flex items-start gap-3.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 mt-0.5 ${
                            isPassed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                          }`}>
                            #{attempt.attemptNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                {attempt.quizTitle || attempt.materialTitle}
                              </h4>
                              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                                isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {isPassed ? 'PASSED' : 'FAILED'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {attempt.subjectName} ({attempt.subjectCode}) {attempt.topicTag && `• #${attempt.topicTag}`}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span><Calendar className="w-3 h-3 inline mr-1" />{new Date(attempt.completedAt).toLocaleString()}</span>
                              <span>•</span>
                              <span>{attempt.correctAnswers} of {attempt.totalQuestions} correct ({attempt.accuracy}%)</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 self-end sm:self-center">
                          <div className="text-right">
                            <p className={`text-xl font-black ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {attempt.percentage}%
                            </p>
                            <p className="text-[10px] font-bold text-slate-400">Score: {attempt.score} pts</p>
                          </div>
                          <button
                            className="px-3.5 py-1.5 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAttemptDetail(attempt.attemptId);
                            }}
                          >
                            <Eye className="w-3.5 h-3.5" /> Review
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PART 11: TOPIC-WISE PERFORMANCE & PROGRESSION */}
      {activeTab === 'topics' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {topics.length === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm">
              <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">No Topic Data</h3>
              <p className="text-sm text-slate-400 mt-1">Topic performance is computed from completed quiz questions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {topics.map((topic, index) => {
                const hasMultiple = topic.totalAttempts > 1;
                return (
                  <div
                    key={index}
                    className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">{topic.topicTag}</h4>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {topic.subjectName} ({topic.subjectCode}) {topic.unitTitle && `• ${topic.unitTitle}`}
                        </p>
                      </div>
                      {getCategoryBadge(topic.category)}
                    </div>

                    {/* Accuracy Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-500">Topic Accuracy</span>
                        <span className={topic.accuracy >= 70 ? 'text-emerald-600' : topic.accuracy >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                          {topic.accuracy}% ({topic.correctAnswers}/{topic.totalQuestions} Qs)
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            topic.accuracy >= 70 ? 'bg-emerald-500' : topic.accuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${topic.accuracy}%` }}
                        />
                      </div>
                    </div>

                    {/* Attempts & Improvement Metrics */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-100 text-center">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Attempts</p>
                        <p className="text-xs font-bold text-slate-800">{topic.totalAttempts} ({topic.failedAttemptsCount} Fail)</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Progression</p>
                        <p className="text-xs font-bold text-slate-800">{topic.firstPerformance}% → {topic.latestPerformance}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Improvement</p>
                        {hasMultiple && topic.improvement !== null ? (
                          <p className={`text-xs font-bold flex items-center justify-center gap-0.5 ${
                            topic.improvement > 0 ? 'text-emerald-600' : topic.improvement < 0 ? 'text-rose-600' : 'text-slate-600'
                          }`}>
                            {topic.improvement > 0 ? <TrendingUp className="w-3 h-3" /> : topic.improvement < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                            {topic.improvement > 0 ? `+${topic.improvement}%` : `${topic.improvement}%`}
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-slate-400">1st attempt</p>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 italic bg-slate-50/40 p-2.5 rounded-xl border border-slate-100">
                      💡 {topic.recommendationReason}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PART 9: MISTAKE ANALYSIS */}
      {activeTab === 'mistakes' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {(mistakes?.totalMistakes || 0) === 0 ? (
            <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-700">Zero Mistakes Recorded!</h3>
              <p className="text-sm text-slate-400 mt-1">This student has answered all attempted questions correctly or has not taken any quizzes yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Filter by Topic Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Filter Topic:</span>
                <button
                  onClick={() => setSelectedMistakeTopic('ALL')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    selectedMistakeTopic === 'ALL'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  All Mistakes ({mistakes?.totalMistakes || 0})
                </button>
                {(mistakes?.topics || mistakes?.topicMistakes || []).map(t => (
                  <button
                    key={t.topicTag}
                    onClick={() => setSelectedMistakeTopic(t.topicTag)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      selectedMistakeTopic === t.topicTag
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    #{t.topicTag} ({t.mistakesCount})
                  </button>
                ))}
              </div>

              {/* Grouped Incorrect Questions */}
              <div className="space-y-6">
                {getFilteredMistakes().map(topicGroup => (
                  <div
                    key={topicGroup.topicTag}
                    className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 border border-white shadow-[0_8px_30px_rgb(0,0,0,0.03)] space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500" />
                          Topic: #{topicGroup.topicTag}
                        </h4>
                        <p className="text-xs text-slate-500">{topicGroup.subjectName} ({topicGroup.subjectCode})</p>
                      </div>
                      <span className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full">
                        {topicGroup.mistakesCount} Incorrect {topicGroup.mistakesCount === 1 ? 'Answer' : 'Answers'}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {(topicGroup.questions || topicGroup.mistakes || []).map((q, qIndex) => {
                        const selectedAnswerLabel = q.selectedAnswer || q.selectedAnswerLabel;
                        const correctAnswerLabel = q.correctAnswer || q.correctAnswerLabel;
                        return (
                          <div
                            key={qIndex}
                            className="bg-rose-50/30 border border-rose-100/80 p-4.5 rounded-2xl space-y-3"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <p className="text-sm font-bold text-slate-800">
                                <span className="text-rose-600 mr-2">Q.</span>
                                {q.questionText}
                              </p>
                              <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                                Attempt #{q.attemptNumber}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              <div className="p-2.5 bg-rose-100/60 rounded-xl border border-rose-200 text-rose-900">
                                <span className="font-bold block text-[10px] uppercase text-rose-600 mb-0.5">Student's Answer:</span>
                                <span className="font-semibold">{selectedAnswerLabel ? `(${selectedAnswerLabel}) ` : ''}{q.selectedAnswerText || 'No answer selected'}</span>
                              </div>
                              <div className="p-2.5 bg-emerald-100/60 rounded-xl border border-emerald-200 text-emerald-900">
                                <span className="font-bold block text-[10px] uppercase text-emerald-600 mb-0.5">Correct Answer:</span>
                                <span className="font-semibold">{correctAnswerLabel ? `(${correctAnswerLabel}) ` : ''}{q.correctAnswerText || 'Not specified'}</span>
                              </div>
                            </div>

                            {q.explanation && (
                              <div className="text-xs text-slate-600 bg-white/80 p-3 rounded-xl border border-slate-200/80 space-y-1">
                                <span className="font-bold text-indigo-600 block text-[10px] uppercase">Explanation / Key Concept:</span>
                                <p className="leading-relaxed">{q.explanation}</p>
                              </div>
                            )}

                            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                              <span>Assessment: {q.quizTitle || q.materialTitle}</span>
                              <span>{q.attemptDate || q.completedAt ? new Date(q.attemptDate || q.completedAt).toLocaleDateString() : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: AI LEARNING INSIGHTS */}
      {activeTab === 'insights' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl space-y-3">
              <span className="px-3 py-1 bg-indigo-500/30 text-indigo-200 text-xs font-bold rounded-full border border-indigo-400/30 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-300" /> AI Grounded Assessment Diagnostics
              </span>
              <h3 className="text-2xl font-black tracking-tight">Personalized Academic Action Plan</h3>
              <p className="text-sm text-indigo-200 leading-relaxed">
                Insights are synthesized directly from actual quiz attempt answers and syllabus topic mapping. No synthetic data is generated.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-rose-500" /> Priority Topics Requiring Mentor Guidance
            </h4>

            {topics.filter(t => t.priority === 'High' || t.priority === 'Medium').length === 0 ? (
              <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl border border-white text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-slate-700">No Critical Weaknesses Detected</p>
                <p className="text-xs text-slate-400 mt-1">Student has demonstrated satisfactory mastery across all evaluated topics.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {topics.filter(t => t.priority === 'High' || t.priority === 'Medium').map((t, idx) => (
                  <div
                    key={idx}
                    className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] space-y-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-bold text-slate-900 text-base">#{t.topicTag}</h5>
                        <p className="text-xs text-slate-500">{t.subjectName} • {t.unitTitle || 'Unit Core'}</p>
                      </div>
                      {getCategoryBadge(t.category)}
                    </div>

                    <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-2xl text-xs space-y-1">
                      <p className="font-bold text-amber-900">Why this topic needs attention:</p>
                      <p className="text-amber-800">{t.recommendationReason}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-700">{t.incorrectAnswers} Incorrect</span> Answers
                      </div>
                      <div>
                        Accuracy: <strong className="text-rose-600">{t.accuracy}%</strong>
                      </div>
                      <div>
                        Failed Attempts: <strong className="text-slate-800">{t.failedAttemptsCount}</strong>
                      </div>
                    </div>

                    {t.materialTitle && (
                      <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
                        <span className="truncate">Resource: <strong className="text-indigo-600">{t.materialTitle}</strong></span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">Syllabus Match</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PART 7 & 8: MODAL ATTEMPT QUESTION-BY-QUESTION & TOPICS REVIEW */}
      {selectedAttemptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900">
                    {attemptDetail?.attempt?.quizTitle || attemptDetail?.attempt?.materialTitle}
                  </h3>
                  <span className="text-xs font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">
                    Attempt #{attemptDetail?.attempt?.attemptNumber}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Subject: <strong className="text-slate-700">{attemptDetail?.attempt?.subjectName}</strong>
                  {attemptDetail?.attempt?.unitTitle && <span> • Unit: {attemptDetail.attempt.unitTitle}</span>}
                  {attemptDetail?.attempt?.lessonTitle && <span> • Lesson: {attemptDetail.attempt.lessonTitle}</span>}
                </p>
              </div>
              <button
                onClick={handleCloseAttemptDetail}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {attemptDetailLoading ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-semibold text-slate-500">Loading attempt breakdown and question analysis...</p>
                </div>
              ) : attemptDetailError ? (
                <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl text-xs font-bold">
                  {attemptDetailError}
                </div>
              ) : attemptDetail ? (
                <>
                  {/* Summary Bar inside Modal */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Score</p>
                      <p className="text-xl font-black text-indigo-600">{attemptDetail.attempt.percentage}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Status</p>
                      <p className={`text-sm font-bold mt-1 ${attemptDetail.attempt.status === 'PASSED' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {attemptDetail.attempt.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Correct / Wrong</p>
                      <p className="text-sm font-bold text-slate-700 mt-1">
                        {attemptDetail.attempt.correctAnswers} / {attemptDetail.attempt.wrongAnswers}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Accuracy</p>
                      <p className="text-sm font-bold text-emerald-600 mt-1">{attemptDetail.attempt.accuracy}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Date</p>
                      <p className="text-xs font-semibold text-slate-600 mt-1">
                        {new Date(attemptDetail.attempt.completedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* PART 7: TOPICS COVERED BREAKDOWN */}
                  {attemptDetail.topicsCovered && attemptDetail.topicsCovered.length > 0 && (
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Topics Covered in This Attempt
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {attemptDetail.topicsCovered.map((t, idx) => (
                          <div key={idx} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-bold text-slate-800">#{t.topicTag}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {t.totalQuestions} {t.totalQuestions === 1 ? 'question' : 'questions'} • {t.correctCount} correct
                              </p>
                            </div>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${
                              t.accuracy >= 70 ? 'bg-emerald-100 text-emerald-800' : t.accuracy >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {t.accuracy}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PART 8: QUESTION-BY-QUESTION ANALYSIS */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-black text-slate-900 border-b border-slate-100 pb-2">
                      Question-by-Question Analysis ({attemptDetail.questions?.length || 0} Questions)
                    </h4>

                    {attemptDetail.questions?.map((q, idx) => {
                      const isCorrect = q.isCorrect;
                      return (
                        <div
                          key={q.questionId || idx}
                          className={`p-5 rounded-2xl border transition-all ${
                            isCorrect
                              ? 'bg-emerald-50/20 border-emerald-150'
                              : 'bg-rose-50/20 border-rose-150'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-3 mb-2.5">
                            <span className="text-xs font-black text-slate-500">
                              Question {q.questionNumber || idx + 1}
                            </span>
                            <div className="flex items-center gap-2 flex-wrap">
                              {q.topicTag && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md">
                                  #{q.topicTag}
                                </span>
                              )}
                              <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full flex items-center gap-1 ${
                                isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                {isCorrect ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm font-bold text-slate-900 mb-3 leading-relaxed">
                            {q.questionText}
                          </p>

                          {/* Options List */}
                          {q.options && (
                            <div className="space-y-1.5 mb-3">
                              {Object.entries(q.options).map(([optKey, optVal]) => {
                                if (!optVal) return null;
                                const isSelected = optKey === q.selectedAnswer;
                                const isRight = optKey === q.correctAnswer;

                                let optClass = 'bg-white border-slate-200 text-slate-700';
                                if (isRight) {
                                  optClass = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold';
                                } else if (isSelected && !isCorrect) {
                                  optClass = 'bg-rose-50 border-rose-300 text-rose-900 font-bold';
                                }

                                return (
                                  <div
                                    key={optKey}
                                    className={`px-3 py-2 rounded-xl text-xs border flex items-center justify-between ${optClass}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold opacity-75">{optKey}.</span>
                                      <span>{optVal}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] font-extrabold">
                                      {isSelected && (
                                        <span className={`px-2 py-0.5 rounded ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white'}`}>
                                          Student's Answer
                                        </span>
                                      )}
                                      {isRight && !isSelected && (
                                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white flex items-center gap-0.5">
                                          <Check className="w-3 h-3" /> Correct Answer
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Explanation (shown only if available) */}
                          {q.explanation && (
                            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-slate-700">
                              <span className="font-bold text-indigo-700 block text-[10px] uppercase mb-0.5">Explanation</span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-slate-100 flex justify-end bg-slate-50/60">
              <button
                onClick={handleCloseAttemptDetail}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
