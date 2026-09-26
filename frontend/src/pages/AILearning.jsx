import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, BookOpen, BrainCircuit, AlertTriangle, TrendingUp, CheckCircle2,
  ArrowLeft, RefreshCw, FileText, ChevronRight, ChevronDown, HelpCircle, Layers,
  Lightbulb, AlertCircle, Award, Target, BookCheck, ExternalLink, Calendar, Clock,
  Check, X, FolderOpen, Flame, ChevronUp, XCircle, ChevronLeft, GitFork, CornerDownRight, Network, ArrowRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../api/axios';
import { toast } from '../components/Toast';

const showToast = (msg, type = 'info') => {
  if (type === 'success') toast.success(msg);
  else if (type === 'error') toast.error(msg);
  else toast.info(msg);
};

export default function AILearning() {
  const location = useLocation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    subjects: [],
    recentAssessments: [],
    summary: {
      totalSubjectsWithAssessments: 0,
      totalAssessments: 0,
      totalAttempts: 0,
      topicsNeedingAttention: 0,
      repeatedWeakCount: 0,
      improvingCount: 0,
      strongCount: 0,
      overallMastery: 0
    }
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // PROGRESSIVE HIERARCHICAL NAVIGATION STATE
  // Level 1: 'subjects' (default)
  // Level 2: 'subject-history'
  // Level 3: 'attempt-details'
  // Level 4: 'personalized-practice'
  // ══════════════════════════════════════════════════════════════════════════════
  const [currentLevel, setCurrentLevel] = useState('subjects');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedAssessment, setSelectedAssessment] = useState(null);
  const [selectedAttempt, setSelectedAttempt] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);

  // Accordion state for question review
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // Active Personalized Learning Practice State
  const [learningContent, setLearningContent] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [prereqAnalysis, setPrereqAnalysis] = useState(null);
  const [loadingPrereqs, setLoadingPrereqs] = useState(false);
  const [attemptPrereqDiagnosis, setAttemptPrereqDiagnosis] = useState(null);
  const [loadingAttemptPrereqs, setLoadingAttemptPrereqs] = useState(false);
  const [activeLearningTab, setActiveLearningTab] = useState('overview'); // 'overview' | 'examples' | 'practice' | 'revision'
  const [selectedProvider, setSelectedProvider] = useState('gemini');

  // Interactive Practice State
  const [userPracticeAnswers, setUserPracticeAnswers] = useState({});
  const [revealedExplanations, setRevealedExplanations] = useState({});
  const [activeFlashcardIndex, setActiveFlashcardIndex] = useState(0);
  const [isFlashcardFlipped, setIsFlashcardFlipped] = useState(false);

  useEffect(() => {
    fetchLearningData();
  }, []);

  const fetchLearningData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/learning/topics');
      const fetched = res.data || {};
      setData(fetched);
    } catch (err) {
      console.error('Failed to fetch learning hub data:', err);
      showToast('Failed to load personalized learning topics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ── Navigation Transitions ───────────────────────────────────────────────────
  const goToSubjects = () => {
    setCurrentLevel('subjects');
    setSelectedSubject(null);
    setSelectedAssessment(null);
    setSelectedAttempt(null);
    setSelectedTopic(null);
    setLearningContent(null);
  };

  const goToSubjectHistory = (subject) => {
    setSelectedSubject(subject);
    setSelectedAssessment(null);
    setSelectedAttempt(null);
    setSelectedTopic(null);
    setLearningContent(null);
    setCurrentLevel('subject-history');
  };

  const goToAttemptDetails = (subject, assessment, attempt) => {
    setSelectedSubject(subject);
    setSelectedAssessment(assessment);
    setSelectedAttempt(attempt);
    setSelectedTopic(null);
    setLearningContent(null);
    setAttemptPrereqDiagnosis(null);
    setLoadingAttemptPrereqs(true);
    setCurrentLevel('attempt-details');

    const attemptId = attempt?.attemptId || attempt?.id;
    if (attemptId) {
      api.get(`/knowledge-graph/prerequisites/attempt-diagnose/${attemptId}`)
        .then(res => {
          setAttemptPrereqDiagnosis(res.data);
        })
        .catch(err => {
          console.log('Attempt prerequisite diagnosis fetch:', err.message);
        })
        .finally(() => {
          setLoadingAttemptPrereqs(false);
        });
    } else {
      setLoadingAttemptPrereqs(false);
    }
  };

  const handleStartPersonalizedPractice = async (topic, forceRefresh = false) => {
    setSelectedTopic(topic);
    setGeneratingContent(true);
    setLoadingPrereqs(true);
    setPrereqAnalysis(null);
    setCurrentLevel('personalized-practice');
    setActiveLearningTab('overview');
    setUserPracticeAnswers({});
    setRevealedExplanations({});
    setActiveFlashcardIndex(0);
    setIsFlashcardFlipped(false);

    // Concurrently fetch prerequisite diagnosis
    api.get(`/knowledge-graph/prerequisites/diagnose`, {
      params: {
        topicTag: topic.topicTag || topic.topic_tag,
        subjectId: selectedSubject?.subjectId || topic.subject_id
      }
    }).then(res => {
      if (res.data?.analysis) {
        setPrereqAnalysis(res.data.analysis);
      }
    }).catch(err => {
      console.log('No knowledge graph prerequisite data found for this topic.');
    }).finally(() => {
      setLoadingPrereqs(false);
    });

    try {
      const res = await api.post('/learning/generate', {
        topicTag: topic.topicTag,
        materialId: topic.materialId,
        attemptId: topic.attemptId || selectedAttempt?.attemptId,
        provider: selectedProvider,
        forceRefresh
      });
      setLearningContent(res.data.content);
      if (res.data.cached) {
        showToast('Loaded saved learning notes.', 'info');
      } else {
        showToast('Personalized learning plan ready!', 'success');
      }
    } catch (err) {
      console.error('Failed to generate learning content:', err);
      showToast(err.response?.data?.error || 'Failed to generate learning content.', 'error');
      setLearningContent(null);
    } finally {
      setGeneratingContent(false);
    }
  };

  const toggleQuestionExpanded = (qId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [qId]: !prev[qId]
    }));
  };

  const handleAnswerPractice = (questionId, optionIdx) => {
    setUserPracticeAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }));
    setRevealedExplanations(prev => ({
      ...prev,
      [questionId]: true
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        <p className="text-slate-500 font-semibold text-sm animate-pulse">
          Loading your personalized AI Learning Hub...
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LEVEL 4 — TOPIC-SPECIFIC PERSONALIZED LEARNING PRACTICE
  // ══════════════════════════════════════════════════════════════════════════════
  if (currentLevel === 'personalized-practice' && selectedTopic) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16">
        {/* Navigation & Header Banner */}
        <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <button
              onClick={() => {
                if (selectedAttempt) {
                  setCurrentLevel('attempt-details');
                } else if (selectedSubject) {
                  setCurrentLevel('subject-history');
                } else {
                  goToSubjects();
                }
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 px-3.5 py-2 rounded-xl transition-all w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Attempt Topic Analysis
            </button>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <span className="text-xs text-slate-400 font-medium">Model:</span>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  disabled={generatingContent}
                  className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
                >
                  <option value="gemini">Gemini</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>

              <button
                onClick={() => handleStartPersonalizedPractice(selectedTopic, true)}
                disabled={generatingContent}
                className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all disabled:opacity-50"
                title="Regenerate learning content"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${generatingContent ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                  {selectedSubject?.subjectName || selectedTopic.subjectName}
                </span>
                {selectedAssessment?.quizTitle && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    {selectedAssessment.quizTitle}
                  </span>
                )}
                {selectedAttempt?.attemptNumber && (
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-md">
                    Attempt #{selectedAttempt.attemptNumber}
                  </span>
                )}
                <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200">
                  Targeted Practice
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {selectedTopic.topicTitle || selectedTopic.topicTag}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Personalized study notes, worked solutions, and practice questions generated specifically for your identified gaps.
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 shrink-0">
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Attempt Accuracy</p>
                <p className={`text-xl font-black ${selectedTopic.accuracy <= 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {selectedTopic.accuracy}%
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Missed Qs</p>
                <p className="text-xl font-black text-rose-600">{selectedTopic.wrongAnswers || selectedTopic.wrongQuestions?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State during AI Generation */}
        {generatingContent && (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-sm animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Generating Personalized Practice & Concept Breakdown...</h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Synthesizing course materials and analyzing your missed questions to create targeted learning content...
            </p>
          </div>
        )}

        {/* Generated Personalized Learning Content */}
        {!generatingContent && learningContent && (
          <div className="space-y-6">
            {/* Tab Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200/80">
              {[
                { id: 'overview', label: 'Concept Overview', icon: BookOpen },
                { id: 'examples', label: 'Examples & Solutions', icon: Lightbulb },
                { id: 'practice', label: 'Practice Questions', icon: Target },
                { id: 'revision', label: 'Flashcards & Cheat Sheet', icon: BookCheck },
              ].map(tab => {
                const Icon = tab.icon;
                const active = activeLearningTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLearningTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
                      active
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                        : 'bg-white/80 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: CONCEPT OVERVIEW */}
            {activeLearningTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  {/* Prerequisite Root Gap & Knowledge Chain Alert */}
                  {prereqAnalysis && prereqAnalysis.hasPrerequisites && (
                    <div className="bg-gradient-to-br from-indigo-50/90 via-violet-50/60 to-purple-50/90 border border-indigo-200/80 p-5 rounded-3xl space-y-4 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-indigo-950 font-black text-sm">
                          <GitFork className="w-4 h-4 text-indigo-600" />
                          <span>Prerequisite Knowledge Chain</span>
                        </div>
                        {prereqAnalysis.rootGap && (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[10px] font-black tracking-wide uppercase">
                            Root Gap: {prereqAnalysis.rootGap.conceptName || prereqAnalysis.rootGap.name}
                          </span>
                        )}
                      </div>

                      {/* Prerequisite Path Visual */}
                      <div className="flex items-center gap-2 overflow-x-auto py-2">
                        {prereqAnalysis.prerequisites?.map((prereq, pIdx) => {
                          const isWeak = prereq.isWeak;
                          const isStrong = prereq.status === 'STRONG';
                          const isUntested = prereq.isUnattempted || prereq.status === 'UNTESTED';

                          return (
                            <React.Fragment key={prereq.conceptId || prereq.id || pIdx}>
                              <div className={`p-3 rounded-2xl border shrink-0 text-xs ${
                                isWeak
                                  ? 'bg-rose-50 border-rose-300 text-rose-950'
                                  : isStrong
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                                  : 'bg-white border-slate-200 text-slate-800'
                              }`}>
                                <p className="font-black truncate max-w-[140px]">{prereq.conceptName || prereq.name}</p>
                                <div className="flex items-center gap-1.5 mt-1 text-[10px]">
                                  {isWeak && <span className="text-rose-600 font-bold">{prereq.accuracy}% • Weak</span>}
                                  {isStrong && <span className="text-emerald-600 font-bold">{prereq.accuracy}% • Strong</span>}
                                  {isUntested && <span className="text-slate-400 font-medium">Untested</span>}
                                </div>
                              </div>
                              <ArrowRight className="w-4 h-4 text-indigo-300 shrink-0" />
                            </React.Fragment>
                          );
                        })}
                        <div className="p-3 rounded-2xl border-2 border-indigo-500 bg-indigo-600 text-white shrink-0 text-xs">
                          <p className="font-black truncate max-w-[140px]">{selectedTopic.topicTag}</p>
                          <p className="text-[10px] text-indigo-200 font-bold mt-1">Target Concept ({selectedTopic.accuracy}%)</p>
                        </div>
                      </div>

                      {/* Recommendations Step List */}
                      {prereqAnalysis.recommendations && prereqAnalysis.recommendations.length > 0 && (
                        <div className="pt-2 border-t border-indigo-100/80 space-y-1.5">
                          <p className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">Recommended Remedial Pathway:</p>
                          <div className="space-y-1">
                            {prereqAnalysis.recommendations.map((rec, rIdx) => (
                              <div key={rIdx} className="text-xs text-indigo-950 font-medium flex items-center gap-2">
                                <span className="w-4 h-4 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-black flex items-center justify-center shrink-0">
                                  {rIdx + 1}
                                </span>
                                <span>{rec}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Why Weak / Key Misconception */}
                  {learningContent.whyWeak && (
                    <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-3xl flex items-start gap-3.5">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 mb-1">
                          Why This Topic Needs Attention
                        </h4>
                        <p className="text-xs text-amber-800 leading-relaxed font-medium">
                          {learningContent.whyWeak}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Simple Explanation */}
                  <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-black text-slate-900">Simple Conceptual Explanation</h3>
                    </div>
                    <div className="prose prose-sm text-slate-700 leading-relaxed max-w-none">
                      <ReactMarkdown>{learningContent.simpleExplanation}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Important Subtopics & Key Points */}
                  {learningContent.importantSubtopics && learningContent.importantSubtopics.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                        <Layers className="w-5 h-5 text-purple-600" />
                        <h3 className="text-base font-black text-slate-900">Core Subtopics & Takeaways</h3>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {learningContent.importantSubtopics.map((sub, idx) => (
                          <div key={idx} className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1.5">
                            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                              {sub.title}
                            </h4>
                            <p className="text-xs text-slate-600 leading-relaxed">{sub.keyPoint}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Sidebar: Key Points & Important Concepts */}
                <div className="space-y-6">
                  {/* Why It Matters */}
                  {learningContent.whyItMatters && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 space-y-2">
                      <div className="flex items-center gap-2 text-indigo-600">
                        <Sparkles className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">Why It Matters</h4>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-medium">
                        {learningContent.whyItMatters}
                      </p>
                    </div>
                  )}

                  {/* Important Concepts */}
                  {learningContent.importantConcepts && learningContent.importantConcepts.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Essential Concepts
                      </h4>
                      <div className="space-y-3">
                        {learningContent.importantConcepts.map((item, idx) => (
                          <div key={idx} className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/60">
                            <p className="text-xs font-bold text-indigo-950">{item.concept}</p>
                            <p className="text-xs text-slate-600 mt-0.5">{item.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exam Points */}
                  {learningContent.importantPoints && learningContent.importantPoints.length > 0 && (
                    <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        High-Yield Exam Points
                      </h4>
                      <ul className="space-y-2">
                        {learningContent.importantPoints.map((pt, idx) => (
                          <li key={idx} className="text-xs text-slate-700 flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: EXAMPLES & STEP-BY-STEP */}
            {activeLearningTab === 'examples' && (
              <div className="space-y-6">
                {/* Worked Examples */}
                {learningContent.examples && learningContent.examples.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      <h3 className="text-base font-black text-slate-900">Worked Practical Examples</h3>
                    </div>
                    <div className="space-y-4">
                      {learningContent.examples.map((ex, idx) => (
                        <div key={idx} className="p-5 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-3">
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-bold rounded-md">
                              Example {idx + 1}
                            </span>
                            {ex.title}
                          </h4>
                          <div className="p-3.5 bg-white rounded-xl border border-slate-200/60">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Problem / Scenario:</p>
                            <p className="text-xs text-slate-800 font-medium">{ex.problem}</p>
                          </div>
                          <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200/60">
                            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Solution:</p>
                            <p className="text-xs text-emerald-900 font-semibold">{ex.solution}</p>
                          </div>
                          {ex.explanation && (
                            <p className="text-xs text-slate-600 italic">
                              <strong>Why:</strong> {ex.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Pitfalls & Mistakes to Avoid */}
                {learningContent.commonMistakes && learningContent.commonMistakes.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <AlertTriangle className="w-5 h-5 text-rose-500" />
                      <h3 className="text-base font-black text-slate-900">Common Misconceptions & Mistakes to Avoid</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningContent.commonMistakes.map((m, idx) => (
                        <div key={idx} className="p-4 bg-rose-50/40 rounded-2xl border border-rose-100 space-y-2">
                          <div className="flex items-start gap-2">
                            <X className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-rose-950">{m.mistake}</p>
                          </div>
                          <p className="text-xs text-slate-600 pl-6"><strong className="text-slate-700">Why it happens:</strong> {m.whyWrong}</p>
                          <div className="pl-6 pt-1">
                            <p className="text-xs text-emerald-800 bg-emerald-50 p-2 rounded-lg border border-emerald-100 font-medium">
                              <strong>How to get it right:</strong> {m.howToFix}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TARGETED PRACTICE QUESTIONS */}
            {activeLearningTab === 'practice' && (
              <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="text-base font-black text-slate-900">Targeted Interactive Practice</h3>
                      <p className="text-xs text-slate-500">Test your understanding of the concepts covered in this topic.</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full w-fit">
                    {learningContent.practiceQuestions?.length || 0} Questions
                  </span>
                </div>

                <div className="space-y-6">
                  {learningContent.practiceQuestions?.map((q, idx) => {
                    const selectedOpt = userPracticeAnswers[q.id];
                    const isAnswered = selectedOpt !== undefined;
                    const isCorrect = selectedOpt === q.correctAnswerIndex;

                    return (
                      <div key={q.id || idx} className="p-5 md:p-6 bg-slate-50/80 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">{q.question}</h4>
                        </div>

                        {/* Options */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-2">
                          {q.options?.map((opt, optIdx) => {
                            const isSelected = selectedOpt === optIdx;
                            const isCorrectOpt = q.correctAnswerIndex === optIdx;

                            let btnStyle = 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300';
                            if (isAnswered) {
                              if (isCorrectOpt) {
                                btnStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                              } else if (isSelected && !isCorrect) {
                                btnStyle = 'bg-rose-50 border-rose-400 text-rose-900 font-bold';
                              } else {
                                btnStyle = 'bg-white/60 border-slate-200 text-slate-400 opacity-60';
                              }
                            }

                            return (
                              <button
                                key={optIdx}
                                onClick={() => handleAnswerPractice(q.id, optIdx)}
                                disabled={isAnswered}
                                className={`p-3.5 rounded-2xl border text-xs text-left transition-all flex items-center justify-between gap-2 ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {isAnswered && isCorrectOpt && <Check className="w-4 h-4 text-emerald-600 shrink-0" />}
                                {isAnswered && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-600 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>

                        {/* Explanation Callout */}
                        {isAnswered && (
                          <div className={`p-4 rounded-2xl text-xs space-y-1 animate-in fade-in duration-200 ${
                            isCorrect ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}>
                            <p className="font-black flex items-center gap-1.5">
                              {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                              {isCorrect ? 'Correct Answer!' : `Incorrect — Correct is Option ${String.fromCharCode(65 + q.correctAnswerIndex)}`}
                            </p>
                            <p className="leading-relaxed font-medium">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 4: FLASHCARDS & SMART REVISION */}
            {activeLearningTab === 'revision' && (
              <div className="space-y-6">
                {/* Quick Revision Bullets */}
                {learningContent.quickRevision && learningContent.quickRevision.length > 0 && (
                  <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                      <BookCheck className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-black text-slate-900">2-Minute Smart Revision Summary</h3>
                    </div>
                    <ul className="space-y-2.5">
                      {learningContent.quickRevision.map((bullet, idx) => (
                        <li key={idx} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100 text-xs text-slate-800 flex items-start gap-2.5">
                          <Check className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                          <span className="font-medium">{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LEVEL 3 — SPECIFIC ASSESSMENT ATTEMPT TOPIC PERFORMANCE
  // ══════════════════════════════════════════════════════════════════════════════
  if (currentLevel === 'attempt-details' && selectedAttempt) {
    const isPassed = selectedAttempt.status === 'PASSED' || selectedAttempt.percentage >= 60;
    const attemptTopics = selectedAttempt.topics || [];
    const formattedDate = new Date(selectedAttempt.completedAt).toLocaleString([], {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => goToSubjectHistory(selectedSubject)}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white shadow-sm border border-slate-200 px-4 py-2.5 rounded-2xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Assessment History
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <span>{selectedSubject?.subjectName}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-slate-700">{selectedAssessment?.quizTitle}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-indigo-600 font-bold">Attempt #{selectedAttempt.attemptNumber}</span>
          </div>
        </div>

        {/* Attempt Overview Banner */}
        <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-black rounded-lg border border-indigo-100">
                  {selectedSubject?.subjectCode || 'SUBJECT'}
                </span>
                <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2.5 py-0.5 rounded-lg">
                  Attempt #{selectedAttempt.attemptNumber}
                </span>
                {isPassed ? (
                  <span className="px-3 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                  </span>
                ) : (
                  <span className="px-3 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Not Cleared
                  </span>
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {selectedAssessment?.quizTitle || 'Quiz Assessment Attempt'}
              </h1>

              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Submitted on: <strong className="text-slate-700">{formattedDate}</strong>
              </p>
            </div>

            {/* Score Stats */}
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shrink-0">
              <div className="text-center px-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Score</p>
                <p className={`text-2xl font-black ${isPassed ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {selectedAttempt.percentage}%
                </p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center px-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Correct</p>
                <p className="text-xl font-black text-emerald-600">{selectedAttempt.correctAnswers}</p>
              </div>
              <div className="w-px h-10 bg-slate-200" />
              <div className="text-center px-3">
                <p className="text-[10px] uppercase font-bold text-slate-400">Wrong</p>
                <p className="text-xl font-black text-rose-600">{selectedAttempt.wrongAnswers}</p>
              </div>
            </div>
          </div>
        </div>

        {/* PREREQUISITE LEARNING GAP DIAGNOSIS */}
        {loadingAttemptPrereqs ? (
          <div className="bg-white/80 p-6 rounded-3xl border border-slate-100 flex items-center justify-center gap-3 text-xs text-slate-500 font-semibold shadow-sm">
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span>Diagnosing prerequisite knowledge graph dependencies...</span>
          </div>
        ) : attemptPrereqDiagnosis?.diagnosedTopics?.filter(d => d.hasPrerequisites && d.prerequisites && d.prerequisites.length > 0).length > 0 ? (
          <div className="bg-gradient-to-br from-indigo-50/70 via-purple-50/40 to-slate-50 border border-indigo-100 rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                  Intelligent Academic Diagnosis
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <GitFork className="w-5 h-5 text-indigo-600" />
                Prerequisite Learning Gap Diagnosis
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Identified foundational knowledge gaps behind missed assessment questions based on the course knowledge graph.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {attemptPrereqDiagnosis.diagnosedTopics
                .filter(diag => diag.hasPrerequisites && diag.prerequisites && diag.prerequisites.length > 0)
                .map((diag, dIdx) => (
                <div key={dIdx} className="bg-white rounded-2xl border border-indigo-100/80 p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                        Learning Gap Detected
                      </span>
                      <h3 className="text-base font-black text-slate-900 mt-1">
                        Target Topic: {diag.topicTag}
                      </h3>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-black text-rose-600">{diag.accuracy}% Accuracy</span>
                      <p className="text-[10px] text-slate-400">{diag.wrongAnswers} missed question(s)</p>
                    </div>
                  </div>

                  {/* Root Learning Gap Badge */}
                  {diag.rootGap && (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-black">Root Learning Gap: {diag.rootGap.conceptName || diag.rootGap.name}</span>
                        <p className="text-[11px] text-amber-800 mt-0.5">
                          Why this was detected: {diag.rootGap.reason || 'Detected based on prerequisite dependency paths in the curriculum and quiz performance.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Prerequisite Chain */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Prerequisite Chain:
                    </p>
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {diag.prerequisites.map((p, pIdx) => (
                        <React.Fragment key={p.conceptId || p.id || pIdx}>
                          <div className={`p-2.5 rounded-xl border text-xs shrink-0 ${
                            p.isWeak
                              ? 'bg-rose-50 border-rose-200 text-rose-900'
                              : p.status === 'STRONG'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                            <p className="font-bold truncate max-w-[130px]">{p.conceptName || p.name}</p>
                            <p className="text-[10px] font-medium mt-0.5">
                              {p.isWeak ? `${p.accuracy}% • Weak` : p.status === 'STRONG' ? `${p.accuracy}% • Strong` : 'Untested'}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
                        </React.Fragment>
                      ))}
                      <div className="p-2.5 rounded-xl border-2 border-indigo-500 bg-indigo-600 text-white text-xs shrink-0 font-bold truncate max-w-[130px]">
                        {diag.topicTag} (Target)
                      </div>
                    </div>

                    {diag.recommendations && diag.recommendations.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                          Recommended Learning Sequence:
                        </p>
                        <div className="space-y-1">
                          {diag.recommendations.map((rec, rIdx) => (
                            <div key={rIdx} className="text-xs text-slate-700 font-medium flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center shrink-0">
                                {rIdx + 1}
                              </span>
                              <span>{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleStartPersonalizedPractice({ topicTag: diag.topicTag, attemptId: selectedAttempt.attemptId || selectedAttempt.id })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Start Remedial Practice</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 border border-slate-200/80 rounded-3xl p-6 md:p-7 space-y-2 shadow-2xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-200/70 px-2.5 py-0.5 rounded-full border border-slate-200">
                Academic Prerequisite Architecture
              </span>
            </div>
            <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
              <GitFork className="w-4 h-4 text-indigo-500" />
              Prerequisite Diagnosis Unavailable
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
              Academic prerequisite relationships have not been generated for this subject yet. Ask your faculty or HOD to generate the Knowledge Graph.
            </p>
          </div>
        )}

        {/* TOPICS COVERED IN THIS ATTEMPT */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Target className="w-5 h-5 text-indigo-600" /> Topics Covered in this Attempt
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Topic accuracy derived from your answers in this attempt. Mistaken topics offer targeted personalized practice.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {attemptTopics.length} Topics
            </span>
          </div>

          {attemptTopics.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-2">
              <p className="text-sm font-bold text-slate-700">No topic breakdown available for this attempt.</p>
              <p className="text-xs text-slate-400">Question tags were not assigned in this quiz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attemptTopics.map((topic, idx) => {
                const needsPractice = topic.needsPractice;
                const wrongCount = topic.wrongAnswers || (topic.totalQuestions - topic.correctAnswers);

                return (
                  <div
                    key={topic.topicTag || idx}
                    className={`bg-white/95 backdrop-blur-sm p-5 md:p-6 rounded-3xl border shadow-sm transition-all flex flex-col justify-between gap-4 ${
                      needsPractice
                        ? 'border-rose-100 hover:border-rose-200 hover:shadow-md'
                        : 'border-emerald-100/70 hover:border-emerald-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <h3 className="text-base font-black text-slate-900 leading-snug">
                          {topic.topicTitle || topic.topicTag}
                        </h3>

                        {needsPractice ? (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full border border-rose-200 shrink-0 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Needs Practice
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200 shrink-0 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Strong Mastery
                          </span>
                        )}
                      </div>

                      {/* Performance Stats */}
                      <div className="flex items-center gap-3 text-xs text-slate-600 mb-3 flex-wrap">
                        <span className="font-semibold text-slate-700">
                          {topic.totalQuestions} {topic.totalQuestions === 1 ? 'Question' : 'Questions'} • {topic.correctAnswers} Correct
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={`font-black ${needsPractice ? 'text-rose-600' : 'text-emerald-600'}`}>
                          Topic Accuracy: {topic.accuracy}%
                        </span>
                      </div>

                      {/* Missed Questions Accordion */}
                      {topic.wrongQuestions && topic.wrongQuestions.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <button
                            onClick={() => toggleQuestionExpanded(`att_${selectedAttempt.attemptId}_${topic.topicTag}`)}
                            className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                          >
                            <span>{expandedQuestions[`att_${selectedAttempt.attemptId}_${topic.topicTag}`] ? 'Hide' : 'Review'} Missed Question ({topic.wrongQuestions.length})</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expandedQuestions[`att_${selectedAttempt.attemptId}_${topic.topicTag}`] ? 'rotate-180' : ''}`} />
                          </button>

                          {expandedQuestions[`att_${selectedAttempt.attemptId}_${topic.topicTag}`] && (
                            <div className="mt-2 space-y-2">
                              {topic.wrongQuestions.map((wq, qIdx) => (
                                <div key={qIdx} className="p-3 bg-rose-50/50 rounded-xl border border-rose-100 text-xs space-y-1">
                                  <p className="font-semibold text-slate-800">{wq.question}</p>
                                  <div className="flex flex-wrap gap-2 text-[11px] pt-1">
                                    <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded">
                                      Your Answer: {wq.selected_answer_text || wq.selected_answer || 'None'}
                                    </span>
                                    <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded">
                                      Correct: {wq.correct_answer_text || wq.correct_answer}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      {needsPractice ? (
                        <button
                          onClick={() => handleStartPersonalizedPractice(topic)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-800 text-white text-xs font-bold rounded-2xl shadow-md shadow-indigo-100 hover:shadow-lg transition-all"
                        >
                          <Sparkles className="w-4 h-4" />
                          <span>Practice Personalized Learning</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartPersonalizedPractice(topic)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                          <span>Review Concepts</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LEVEL 2 — SUBJECT ASSESSMENT HISTORY
  // ══════════════════════════════════════════════════════════════════════════════
  if (currentLevel === 'subject-history' && selectedSubject) {
    const assessments = selectedSubject.assessments || [];
    
    // Flatten all attempts across all assessments for chronological ordering
    const allChronologicalAttempts = [];
    assessments.forEach(quiz => {
      (quiz.attempts || []).forEach(att => {
        allChronologicalAttempts.push({
          ...att,
          quizId: quiz.quizId,
          quizTitle: quiz.quizTitle,
          materialId: quiz.materialId,
          materialTitle: quiz.materialTitle,
          unitTitle: quiz.unitTitle,
          unitNumber: quiz.unitNumber,
          lessonTitle: quiz.lessonTitle,
          assessmentRef: quiz
        });
      });
    });

    // Sort strictly chronological: newest completed_at first
    allChronologicalAttempts.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={goToSubjects}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-white shadow-sm border border-slate-200 px-4 py-2.5 rounded-2xl transition-all"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Assessment Subjects
          </button>

          <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold">
            <span>AI Learning Hub</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="text-indigo-600 font-bold">{selectedSubject.subjectName}</span>
          </div>
        </div>

        {/* Subject Header Banner */}
        <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-black rounded-lg border border-indigo-100">
                  {selectedSubject.subjectCode || 'SUBJECT'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedSubject.totalAssessments} {selectedSubject.totalAssessments === 1 ? 'Assessment' : 'Assessments'}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-500">
                  {selectedSubject.totalAttempts} {selectedSubject.totalAttempts === 1 ? 'Attempt' : 'Attempts'}
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                {selectedSubject.subjectName}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl">
                Assessment History & Attempts. Click any attempt to view question-level topic analysis and personalized practice.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-3xl border border-slate-100">
              <Calendar className="w-5 h-5 text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400">Latest Submission</p>
                <p className="text-xs font-black text-slate-800">
                  {new Date(selectedSubject.latestAttemptDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Chronological Assessment Attempts List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Chronological Assessment History
            </h2>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              {allChronologicalAttempts.length} Submissions
            </span>
          </div>

          {allChronologicalAttempts.length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-800">No Assessment History Found</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No quiz submissions recorded for this subject yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {allChronologicalAttempts.map((attempt) => {
                const isPassed = attempt.status === 'PASSED' || attempt.percentage >= 60;
                const formattedDate = new Date(attempt.completedAt).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short'
                });

                return (
                  <div
                    key={attempt.attemptId}
                    className="bg-white/95 backdrop-blur-sm p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-0.5 bg-purple-50 text-purple-700 text-xs font-black rounded-lg border border-purple-100">
                          Attempt #{attempt.attemptNumber}
                        </span>

                        {isPassed ? (
                          <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200 flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Not Cleared
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-400">
                          Score: <strong className={isPassed ? 'text-emerald-700' : 'text-rose-700'}>{attempt.percentage}%</strong>
                        </span>
                      </div>

                      <h3 className="text-base font-black text-slate-900">
                        {attempt.quizTitle}
                      </h3>

                      <p className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
                        {attempt.unitTitle && <span>Unit: {attempt.unitTitle}</span>}
                        {attempt.unitTitle && <span className="text-slate-300">•</span>}
                        <span>{formattedDate}</span>
                      </p>
                    </div>

                    <button
                      onClick={() => goToAttemptDetails(selectedSubject, attempt.assessmentRef, attempt)}
                      className="flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-bold rounded-2xl transition-all shrink-0"
                    >
                      <span>View Attempt</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // LEVEL 1 — INITIAL VIEW: YOUR ASSESSMENT SUBJECTS
  // ══════════════════════════════════════════════════════════════════════════════
  const subjectsList = data.subjects || [];

  return (
    <div className="space-y-8 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16">
      {/* Header Banner */}
      <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider mb-2">
              <Sparkles className="w-4 h-4" /> Academix AI Learning Hub
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              Your Assessment Subjects
            </h1>
            <p className="text-xs md:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Explore your quiz attempts by subject to inspect topic mastery and start AI-powered personalized practice.
            </p>
          </div>

          <button
            onClick={fetchLearningData}
            className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 border border-slate-200 px-4 py-2.5 rounded-2xl transition-all w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        {/* Compact Summary Metrics Bar (Non-Dominating) */}
        {subjectsList.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Subjects</span>
              <span className="text-xl font-black text-slate-800">{data.summary?.totalSubjectsWithAssessments || subjectsList.length}</span>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assessments</span>
              <span className="text-xl font-black text-slate-800">{data.summary?.totalAssessments || 0}</span>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Attempts</span>
              <span className="text-xl font-black text-slate-800">{data.summary?.totalAttempts || 0}</span>
            </div>
            <div className="bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Mastery</span>
              <span className="text-xl font-black text-emerald-600">{data.summary?.overallMastery || 0}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Subjects Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" /> Active Subjects
          </h2>
          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {subjectsList.length} {subjectsList.length === 1 ? 'Subject' : 'Subjects'}
          </span>
        </div>

        {subjectsList.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-3xl border border-white shadow-sm text-center space-y-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">No Assessment History Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Take quizzes and assessments in your course subjects to unlock hierarchical topic diagnosis and personalized learning practice.
              </p>
            </div>
            <button
              onClick={() => navigate('/subjects')}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all inline-flex items-center gap-2"
            >
              <span>Explore Course Subjects</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {subjectsList.map((subject) => {
              const latestDate = subject.latestAttemptDate
                ? new Date(subject.latestAttemptDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
                : null;

              return (
                <div
                  key={subject.subjectId}
                  onClick={() => goToSubjectHistory(subject)}
                  className="group bg-white/95 backdrop-blur-xl p-6 rounded-3xl border border-white shadow-[0_4px_20px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_30px_rgb(99,102,241,0.08)] hover:border-indigo-100 transition-all cursor-pointer flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-xl border border-indigo-100">
                        {subject.subjectCode || 'ACADEMIX'}
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    <div>
                      <h3 className="text-lg font-black text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
                        {subject.subjectName}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        {subject.totalAssessments} {subject.totalAssessments === 1 ? 'Assessment' : 'Assessments'} • {subject.totalAttempts} {subject.totalAttempts === 1 ? 'Attempt' : 'Attempts'}
                      </p>
                    </div>

                    {latestDate && (
                      <div className="pt-2 flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                        <span>Last Active: <strong className="text-slate-600">{latestDate}</strong></span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goToSubjectHistory(subject);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 group-hover:bg-indigo-600 text-slate-700 group-hover:text-white text-xs font-bold rounded-2xl transition-all"
                  >
                    <span>View Assessment History</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
