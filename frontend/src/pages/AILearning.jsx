import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, BookOpen, BrainCircuit, AlertTriangle, TrendingUp, CheckCircle2,
  ArrowLeft, RefreshCw, FileText, ChevronRight, ChevronDown, HelpCircle, Layers,
  Lightbulb, AlertCircle, Award, Target, BookCheck, ExternalLink, Calendar, Clock,
  Check, X, FolderOpen, Flame, ChevronUp
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

  // Accordion state
  const [expandedSubjects, setExpandedSubjects] = useState({});
  const [expandedAssessments, setExpandedAssessments] = useState({});
  const [expandedTopicHistory, setExpandedTopicHistory] = useState({});
  const [expandedTopicMistakes, setExpandedTopicMistakes] = useState({});

  // Active Deep Learning View State
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [learningContent, setLearningContent] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [activeLearningTab, setActiveLearningTab] = useState('overview'); // 'overview' | 'concepts' | 'examples' | 'material' | 'practice'
  const [selectedProvider, setSelectedProvider] = useState('gemini');

  // Practice Interactive State
  const [userPracticeAnswers, setUserPracticeAnswers] = useState({});
  const [revealedExplanations, setRevealedExplanations] = useState({});

  useEffect(() => {
    fetchLearningData();
  }, []);

  const fetchLearningData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/learning/topics');
      const fetched = res.data || {};
      setData(fetched);

      // Auto-expand all subjects and quizzes by default for easy discovery
      const subMap = {};
      const quizMap = {};
      (fetched.subjects || []).forEach(sub => {
        subMap[sub.subjectId] = true;
        (sub.assessments || []).forEach(q => {
          quizMap[q.quizId] = true;
        });
      });
      setExpandedSubjects(subMap);
      setExpandedAssessments(quizMap);
    } catch (err) {
      console.error('Failed to fetch learning hub data:', err);
      showToast('Failed to load personalized learning topics.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (subId) => {
    setExpandedSubjects(prev => ({
      ...prev,
      [subId]: !prev[subId]
    }));
  };

  const toggleAssessment = (quizId) => {
    setExpandedAssessments(prev => ({
      ...prev,
      [quizId]: !prev[quizId]
    }));
  };

  const toggleTopicHistory = (topicKey) => {
    setExpandedTopicHistory(prev => ({
      ...prev,
      [topicKey]: !prev[topicKey]
    }));
  };

  const toggleTopicMistakes = (topicKey) => {
    setExpandedTopicMistakes(prev => ({
      ...prev,
      [topicKey]: !prev[topicKey]
    }));
  };

  const handleStartLearning = async (topic, forceRefresh = false) => {
    setSelectedTopic(topic);
    setGeneratingContent(true);
    setActiveLearningTab('overview');
    setUserPracticeAnswers({});
    setRevealedExplanations({});

    try {
      const res = await api.post('/learning/generate', {
        topicTag: topic.topicTag,
        materialId: topic.materialId,
        provider: selectedProvider,
        forceRefresh
      });
      setLearningContent(res.data.content);
      if (res.data.cached) {
        showToast('Loaded saved learning notes.', 'info');
      } else {
        showToast('Personalized learning generated!', 'success');
      }
    } catch (err) {
      console.error('Failed to generate learning content:', err);
      showToast(err.response?.data?.error || 'Failed to generate learning content.', 'error');
      setLearningContent(null);
    } finally {
      setGeneratingContent(false);
    }
  };

  const handleAnswerPractice = (questionId, optionIdx, correctIdx) => {
    setUserPracticeAnswers(prev => ({
      ...prev,
      [questionId]: optionIdx
    }));
    setRevealedExplanations(prev => ({
      ...prev,
      [questionId]: true
    }));
  };

  const getCategoryBadge = (category) => {
    switch (category) {
      case 'REPEATED_WEAKNESS':
        return (
          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-rose-200">
            <Flame className="w-3 h-3 text-rose-600" /> Repeated Weakness
          </span>
        );
      case 'RECENT_FAILURE':
        return (
          <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" /> Recent Failure
          </span>
        );
      case 'NEEDS_PRACTICE':
        return (
          <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-yellow-200">
            <Clock className="w-3 h-3 text-yellow-600" /> Needs Practice
          </span>
        );
      case 'IMPROVING':
        return (
          <span className="px-2.5 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-sky-200">
            <TrendingUp className="w-3 h-3 text-sky-600" /> Improving
          </span>
        );
      case 'STRONG':
        return (
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full inline-flex items-center gap-1 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Strong Mastery
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full">
            {category}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        <p className="text-slate-500 font-semibold text-sm animate-pulse">
          Loading your assessment-based AI Learning Hub...
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW: DETAILED PERSONALIZED LEARNING VIEW (When topic is selected)
  // ══════════════════════════════════════════════════════════════════════════════
  if (selectedTopic) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-7xl mx-auto pb-16">
        {/* Top Navigation & Topic Banner */}
        <div className="bg-white/90 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <button
              onClick={() => {
                setSelectedTopic(null);
                setLearningContent(null);
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 px-3.5 py-2 rounded-xl transition-all w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Assessment Learning Hub
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
                onClick={() => handleStartLearning(selectedTopic, true)}
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
                  {selectedTopic.subjectName}
                </span>
                {selectedTopic.quizTitle && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Quiz: {selectedTopic.quizTitle}
                  </span>
                )}
                {selectedTopic.unitTitle && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Unit: {selectedTopic.unitTitle}
                  </span>
                )}
                {getCategoryBadge(selectedTopic.category)}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                #{selectedTopic.topicTitle || selectedTopic.topicTag}
              </h1>
              <p className="text-xs md:text-sm text-slate-600 mt-1 max-w-3xl leading-relaxed">
                {selectedTopic.aiRecommendation || selectedTopic.recommendationReason}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 shrink-0">
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Accuracy</p>
                <p className={`text-xl font-black ${selectedTopic.overallAccuracy <= 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {selectedTopic.overallAccuracy}%
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Attempts</p>
                <p className="text-xl font-black text-slate-700">{selectedTopic.totalAttempts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Spinner during Generation */}
        {generatingContent && (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-sm animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Generating Personalized Learning Material...</h3>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              Synthesizing tailored explanations from your course material <span className="font-semibold text-slate-700">"{selectedTopic.materialTitle}"</span> and targeting your specific assessment mistakes.
            </p>
          </div>
        )}

        {/* Content Container */}
        {!generatingContent && learningContent && (
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white overflow-hidden">
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/60 overflow-x-auto p-2 gap-1 custom-scrollbar">
              {[
                { id: 'overview', label: 'Overview & Simply Explained', icon: Lightbulb },
                { id: 'concepts', label: 'Important Concepts & Points', icon: Layers },
                { id: 'examples', label: 'Worked Examples & Steps', icon: BookOpen },
                { id: 'material', label: 'Course Material References', icon: FileText },
                { id: 'practice', label: 'Practice & Mini Quiz', icon: Target }
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeLearningTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveLearningTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/80'
                        : 'text-slate-600 hover:text-indigo-600 hover:bg-white/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: OVERVIEW & SIMPLY EXPLAINED */}
            {activeLearningTab === 'overview' && (
              <div className="p-6 md:p-8 space-y-6">
                {/* Diagnostic Analysis Card */}
                {learningContent.whyWeak && (
                  <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-3.5">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-900 mb-1">Diagnostic Performance Insight</h4>
                      <p className="text-xs md:text-sm text-amber-800 leading-relaxed">{learningContent.whyWeak}</p>
                    </div>
                  </div>
                )}

                {/* Simple Conceptual Explanation */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                  <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-5 h-5 text-indigo-600" />
                    Simplified Explanation
                  </h3>
                  <div className="prose prose-sm max-w-none text-slate-700 leading-relaxed space-y-3">
                    {typeof learningContent.simpleExplanation === 'string' ? (
                      <ReactMarkdown>{learningContent.simpleExplanation}</ReactMarkdown>
                    ) : (
                      <p>{JSON.stringify(learningContent.simpleExplanation)}</p>
                    )}
                  </div>
                </div>

                {/* Why This Topic Matters */}
                {learningContent.whyItMatters && (
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-6">
                    <h3 className="text-base font-black text-indigo-950 mb-2 flex items-center gap-2">
                      <Award className="w-5 h-5 text-indigo-600" />
                      Why This Topic Matters
                    </h3>
                    <p className="text-xs md:text-sm text-indigo-900/80 leading-relaxed">
                      {learningContent.whyItMatters}
                    </p>
                  </div>
                )}

                {/* Quick Revision Bullets */}
                {learningContent.quickRevision?.length > 0 && (
                  <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-6">
                    <h3 className="text-base font-black text-emerald-950 mb-3 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      Quick Revision Points
                    </h3>
                    <ul className="space-y-2">
                      {learningContent.quickRevision.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 text-xs md:text-sm text-emerald-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: IMPORTANT CONCEPTS & POINTS */}
            {activeLearningTab === 'concepts' && (
              <div className="p-6 md:p-8 space-y-6">
                {learningContent.importantConcepts?.length > 0 && (
                  <div>
                    <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      Core Concepts You Must Understand
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningContent.importantConcepts.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 hover:border-indigo-200 transition-colors">
                          <h4 className="text-sm font-black text-indigo-900 mb-1.5 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600" />
                            {item.concept || item.title || `Concept ${idx + 1}`}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {item.description || item.keyPoint || JSON.stringify(item)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learningContent.importantPoints?.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                    <h3 className="text-base font-black text-slate-900 mb-3 flex items-center gap-2">
                      <Target className="w-5 h-5 text-rose-500" />
                      Exam-Focused Key Points
                    </h3>
                    <div className="space-y-2.5">
                      {learningContent.importantPoints.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-slate-200/60">
                          <span className="font-extrabold text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md shrink-0">
                            #{idx + 1}
                          </span>
                          <p className="text-xs md:text-sm text-slate-700 leading-relaxed">{pt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: WORKED EXAMPLES & STEPS */}
            {activeLearningTab === 'examples' && (
              <div className="p-6 md:p-8 space-y-6">
                {learningContent.examples?.length > 0 && (
                  <div>
                    <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Worked Examples
                    </h3>
                    <div className="space-y-4">
                      {learningContent.examples.map((ex, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold">Ex {idx + 1}</span>
                            {ex.title || `Example ${idx + 1}`}
                          </h4>
                          {ex.problem && (
                            <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Problem</p>
                              <p className="text-xs md:text-sm text-slate-800 font-medium">{ex.problem}</p>
                            </div>
                          )}
                          {ex.solution && (
                            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-200/70">
                              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Solution</p>
                              <p className="text-xs md:text-sm text-emerald-950 font-semibold">{ex.solution}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: COURSE MATERIAL REFERENCES */}
            {activeLearningTab === 'material' && (
              <div className="p-6 md:p-8 space-y-6">
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    Source Syllabus & Material
                  </h3>
                  <div className="text-xs text-slate-600 space-y-1">
                    <p>Subject: <strong className="text-slate-800">{selectedTopic.subjectName}</strong></p>
                    <p>Unit: <strong className="text-slate-800">{selectedTopic.unitTitle || 'Unit Core'}</strong></p>
                    <p>Topic: <strong className="text-indigo-600">#{selectedTopic.topicTag}</strong></p>
                    <p>Resource: <strong className="text-slate-800">{selectedTopic.materialTitle}</strong></p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PRACTICE & MINI QUIZ */}
            {activeLearningTab === 'practice' && (
              <div className="p-6 md:p-8 space-y-6">
                {learningContent.practiceQuestions?.length > 0 ? (
                  <div className="space-y-6">
                    {learningContent.practiceQuestions.map((q, qIdx) => {
                      const userChoice = userPracticeAnswers[q.id || qIdx];
                      const isAnswered = userChoice !== undefined;
                      const isCorrect = userChoice === q.correctAnswerIndex;

                      return (
                        <div key={q.id || qIdx} className="p-6 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <h4 className="font-bold text-sm md:text-base text-slate-900">
                              <span className="text-indigo-600 mr-2 font-black">Q{qIdx + 1}.</span>
                              {q.question}
                            </h4>
                            {isAnswered && (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1 ${
                                isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {isCorrect ? '✓ Correct' : '✕ Incorrect'}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {q.options.map((opt, optIdx) => {
                              const isSelected = userChoice === optIdx;
                              const isThisCorrect = optIdx === q.correctAnswerIndex;

                              let btnStyle = 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700';
                              if (isAnswered) {
                                if (isThisCorrect) {
                                  btnStyle = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-bold';
                                } else if (isSelected && !isCorrect) {
                                  btnStyle = 'bg-rose-50 border-rose-400 text-rose-900 font-bold';
                                } else {
                                  btnStyle = 'bg-white/60 border-slate-200 text-slate-400';
                                }
                              }

                              return (
                                <button
                                  key={optIdx}
                                  onClick={() => handleAnswerPractice(q.id || qIdx, optIdx, q.correctAnswerIndex)}
                                  disabled={isAnswered}
                                  className={`p-3.5 rounded-xl border text-left text-xs md:text-sm font-medium transition-all flex items-start gap-2.5 ${btnStyle}`}
                                >
                                  <span className="font-bold uppercase text-[11px] opacity-70">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                </button>
                              );
                            })}
                          </div>

                          {isAnswered && q.explanation && (
                            <div className="p-4 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 leading-relaxed animate-in fade-in">
                              <span className="font-bold text-indigo-700">Explanation: </span>
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 text-center py-8">No practice questions generated yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW: MAIN STRUCTURED AI LEARNING HUB
  // ══════════════════════════════════════════════════════════════════════════════
  const { subjects = [], recentAssessments = [], summary = {} } = data;
  const hasAssessments = (summary.totalAttempts || 0) > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              AI Personalized Learning Hub
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
            Assessment-Based Learning Hub
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Personalized learning paths and topic diagnostics organized around your actual subjects and completed quiz assessments.
          </p>
        </div>

        <button
          onClick={fetchLearningData}
          className="self-start md:self-auto px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200/80 shadow-sm transition-all flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5 text-indigo-600" /> Refresh Learning Data
        </button>
      </header>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topics to Focus</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900">{summary.topicsNeedingAttention || 0}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Require review or practice</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repeated Weakness</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-amber-600">{summary.repeatedWeakCount || 0}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Struggled in 2+ attempts</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Improving Topics</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-sky-600">{summary.improvingCount || 0}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Positive score trends</p>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Mastery</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-black text-indigo-600">{summary.overallMastery || 0}%</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Across all assessment questions</p>
        </div>
      </div>

      {/* RECENT ASSESSMENTS SECTION */}
      {hasAssessments && recentAssessments.length > 0 && (
        <section className="bg-white/90 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-600" /> Recent Assessment Activity
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">Your latest quiz submissions and status.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentAssessments.slice(0, 2).map((item) => {
              const isCleared = item.status === 'Cleared' || item.percentage >= 60;
              return (
                <div
                  key={item.attemptId}
                  className="p-5 rounded-2xl border border-slate-150/80 bg-gradient-to-br from-white to-slate-50/60 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-slate-900 text-base leading-snug">
                        {item.quizTitle}
                      </h3>
                      <span className={`px-2.5 py-0.5 text-[11px] font-black rounded-full shrink-0 ${
                        isCleared ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {isCleared ? 'CLEARED' : 'NOT CLEARED'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>Subject: <strong className="text-slate-700">{item.subjectName} {item.subjectCode && `(${item.subjectCode})`}</strong></p>
                      <p>Topic: <strong className="text-indigo-600">#{item.topicTitle}</strong></p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-1">
                        <Calendar className="w-3 h-3" />
                        <span>Submitted on {new Date(item.completedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                      Attempt #{item.attemptNumber}
                    </span>
                    <span className="text-sm font-black text-slate-800">
                      Score: <span className={isCleared ? 'text-emerald-600' : 'text-rose-600'}>{item.percentage}%</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* YOUR ASSESSMENT SUBJECTS HIERARCHY */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-indigo-600" /> Your Assessment Subjects
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Explore subject-wise quizzes and topic-specific AI recommendations based on your question performance.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-400">{subjects.length} Subjects Active</span>
        </div>

        {subjects.length === 0 ? (
          <div className="bg-white/90 backdrop-blur-xl p-12 rounded-3xl text-center border border-white shadow-sm space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">No Assessment Activity Yet</h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              Take quizzes on your enrolled subject materials. As you submit assessments, your structured learning hub will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {subjects.map((sub) => {
              const isSubExpanded = expandedSubjects[sub.subjectId] !== false;

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
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-lg shadow-xs">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                          {sub.subjectName}
                          {sub.subjectCode && <span className="text-xs font-semibold text-slate-400">({sub.subjectCode})</span>}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          <strong className="text-slate-800">{sub.totalAssessments}</strong> {sub.totalAssessments === 1 ? 'Assessment' : 'Assessments'} • <strong className="text-slate-800">{sub.totalAttempts}</strong> {sub.totalAttempts === 1 ? 'Attempt' : 'Attempts'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-full hidden sm:inline-block">
                        {sub.totalAttempts} Attempts Total
                      </span>
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                        {isSubExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Subject Assessments List */}
                  {isSubExpanded && (
                    <div className="p-6 pt-0 border-t border-slate-100 space-y-6 bg-slate-50/40">
                      {sub.assessments?.map((quiz) => {
                        const isQuizOpen = expandedAssessments[quiz.quizId] !== false;
                        const isCleared = quiz.status === 'Cleared';

                        return (
                          <div
                            key={quiz.quizId}
                            className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6"
                          >
                            {/* Assessment Summary Header */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <h4 className="text-base font-black text-slate-900">
                                    {quiz.quizTitle}
                                  </h4>
                                  {isCleared ? (
                                    <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Cleared (Attempt #{quiz.clearedOnAttempt})
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200 flex items-center gap-1">
                                      <XCircle className="w-3.5 h-3.5" /> Not Cleared
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">
                                  {quiz.unitTitle && <span>Unit: {quiz.unitTitle} • </span>}
                                  Latest submission: <strong className="text-slate-700">{new Date(quiz.latestAttemptDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                                </p>
                              </div>

                              {/* Performance summary pills */}
                              <div className="flex items-center gap-3 text-xs flex-wrap">
                                <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                  <span className="text-[10px] text-slate-400 font-bold block">Attempts</span>
                                  <strong className="text-slate-800">{quiz.attemptsCount}</strong>
                                </div>
                                <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                  <span className="text-[10px] text-slate-400 font-bold block">First Score</span>
                                  <strong className="text-slate-700">{quiz.firstScore}%</strong>
                                </div>
                                <div className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                                  <span className="text-[10px] text-slate-400 font-bold block">Latest Score</span>
                                  <strong className="text-slate-800">{quiz.latestScore}%</strong>
                                </div>
                                <div className="px-3 py-1.5 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                  <span className="text-[10px] text-indigo-600 font-bold block">Best Score</span>
                                  <strong className="text-indigo-700">{quiz.bestScore}%</strong>
                                </div>
                              </div>
                            </div>

                            {/* ASSESSMENT TOPICS LIST */}
                            <div className="space-y-4">
                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                Topics Covered in This Assessment ({quiz.topics?.length || 0})
                              </h5>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {quiz.topics?.map((topic, tIdx) => {
                                  const topicKey = `${quiz.quizId}_${topic.topicTag}`;
                                  const isHistoryOpen = !!expandedTopicHistory[topicKey];
                                  const isMistakesOpen = !!expandedTopicMistakes[topicKey];

                                  return (
                                    <div
                                      key={tIdx}
                                      className="p-5 rounded-2xl border border-slate-200/90 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all space-y-4 shadow-xs"
                                    >
                                      {/* Topic Card Header */}
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <h6 className="font-black text-slate-900 text-base">
                                            #{topic.topicTag}
                                          </h6>
                                          <p className="text-xs text-slate-500 mt-0.5">
                                            {topic.totalQuestions} Questions • {topic.correctAnswers} Correct
                                          </p>
                                        </div>
                                        {getCategoryBadge(topic.category)}
                                      </div>

                                      {/* Accuracy Progress */}
                                      <div className="space-y-1.5">
                                        <div className="flex justify-between text-xs font-bold">
                                          <span className="text-slate-500">Topic Accuracy</span>
                                          <span className={topic.overallAccuracy >= 70 ? 'text-emerald-600' : topic.overallAccuracy >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                                            {topic.overallAccuracy}%
                                          </span>
                                        </div>
                                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                                          <div
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              topic.overallAccuracy >= 70 ? 'bg-emerald-500' : topic.overallAccuracy >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                            }`}
                                            style={{ width: `${topic.overallAccuracy}%` }}
                                          />
                                        </div>
                                      </div>

                                      {/* Topic-Specific AI Recommendation Box */}
                                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                          <span>AI Recommendation</span>
                                        </div>
                                        <p className="text-xs text-indigo-950/80 leading-relaxed">
                                          {topic.aiRecommendation}
                                        </p>
                                      </div>

                                      {/* Collapsible Attempt History */}
                                      {topic.attemptsHistory?.length > 0 && (
                                        <div className="border-t border-slate-100 pt-3">
                                          <button
                                            onClick={() => toggleTopicHistory(topicKey)}
                                            className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors py-1"
                                          >
                                            <span className="flex items-center gap-1.5">
                                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                                              <span>Attempt History ({topic.attemptsHistory.length} Attempts)</span>
                                            </span>
                                            {isHistoryOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                          </button>

                                          {isHistoryOpen && (
                                            <div className="space-y-1.5 mt-2.5 animate-in fade-in duration-200">
                                              {topic.attemptsHistory.map((att, aIdx) => (
                                                <div
                                                  key={aIdx}
                                                  className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs"
                                                >
                                                  <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                                                      att.status === 'Passed' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                      #{att.attemptNumber}
                                                    </span>
                                                    <span className="text-slate-700 font-semibold">
                                                      Score: <strong>{att.score}%</strong> ({att.correct}/{att.total})
                                                    </span>
                                                  </div>
                                                  <span className="text-[11px] text-slate-400">
                                                    {new Date(att.completedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Collapsible Missed Questions Evidence */}
                                      {topic.wrongQuestions?.length > 0 && (
                                        <div className="border-t border-slate-100 pt-3">
                                          <button
                                            onClick={() => toggleTopicMistakes(topicKey)}
                                            className="w-full flex items-center justify-between text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors py-1"
                                          >
                                            <span className="flex items-center gap-1.5">
                                              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                                              <span>Inspect Question Mistakes ({topic.wrongQuestions.length})</span>
                                            </span>
                                            {isMistakesOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                          </button>

                                          {isMistakesOpen && (
                                            <div className="space-y-2.5 mt-2.5 animate-in fade-in duration-200">
                                              {topic.wrongQuestions.map((wq, wqIdx) => (
                                                <div key={wqIdx} className="p-3 bg-rose-50/40 border border-rose-100 rounded-xl space-y-2 text-xs">
                                                  <p className="font-bold text-slate-800">
                                                    <span className="text-rose-600 mr-1.5">Q.</span>
                                                    {wq.question}
                                                  </p>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                    <div className="p-2 bg-rose-100/60 rounded-lg text-rose-900">
                                                      <span className="font-bold block text-[10px] uppercase text-rose-600">Your Answer:</span>
                                                      <span>{wq.selected_answer_text || 'Not answered'}</span>
                                                    </div>
                                                    <div className="p-2 bg-emerald-100/60 rounded-lg text-emerald-900">
                                                      <span className="font-bold block text-[10px] uppercase text-emerald-600">Correct Answer:</span>
                                                      <span>{wq.correct_answer_text || 'Correct option'}</span>
                                                    </div>
                                                  </div>
                                                  {wq.explanation && (
                                                    <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-150">
                                                      💡 {wq.explanation}
                                                    </p>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Action Button: Start Personalized Learning */}
                                      <button
                                        onClick={() => handleStartLearning(topic)}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-[0.98]"
                                      >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Start Deep AI Learning</span>
                                      </button>
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
        )}
      </section>
    </div>
  );
}
