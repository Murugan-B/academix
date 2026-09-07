import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, BookOpen, BrainCircuit, AlertTriangle, TrendingUp, CheckCircle2,
  ArrowLeft, RefreshCw, FileText, ChevronRight, HelpCircle, Layers,
  Lightbulb, AlertCircle, Award, Target, BookCheck, ExternalLink
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
  const [weakData, setWeakData] = useState({
    topicsToFocusOn: [],
    recentWeakTopics: [],
    improvingTopics: [],
    strongTopics: [],
    summary: {
      totalWeakTopics: 0,
      repeatedWeakCount: 0,
      improvingCount: 0,
      strongCount: 0,
      overallMastery: 0,
      totalAttempts: 0
    }
  });

  const [activeFilterTab, setActiveFilterTab] = useState('focus'); // 'focus' | 'repeated' | 'recent' | 'improving' | 'all'
  const [selectedTopic, setSelectedTopic] = useState(null); // The topic object being actively learned

  // Learning View States
  const [learningContent, setLearningContent] = useState(null);
  const [generatingContent, setGeneratingContent] = useState(false);
  const [activeLearningTab, setActiveLearningTab] = useState('overview'); // 'overview' | 'concepts' | 'examples' | 'material' | 'practice'
  const [selectedProvider, setSelectedProvider] = useState('gemini');

  // Practice Interactive State: { [questionId]: selectedOptionIndex }
  const [userPracticeAnswers, setUserPracticeAnswers] = useState({});
  const [revealedExplanations, setRevealedExplanations] = useState({});

  useEffect(() => {
    fetchWeakTopics();
  }, []);

  // Handle URL state / query params if navigated from dashboard
  useEffect(() => {
    if (location.state?.topicTag && weakData.topicsToFocusOn.length > 0) {
      const match = weakData.topicsToFocusOn.find(t => t.topicTag === location.state.topicTag);
      if (match) {
        handleStartLearning(match);
      }
    }
  }, [weakData, location.state]);

  const fetchWeakTopics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/learning/topics');
      setWeakData(res.data);
    } catch (err) {
      console.error('Failed to fetch weak topics:', err);
      showToast('Failed to load personalized learning topics.', 'error');
    } finally {
      setLoading(false);
    }
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

  const getFilteredTopics = () => {
    if (activeFilterTab === 'focus') return weakData.topicsToFocusOn;
    if (activeFilterTab === 'repeated') return weakData.topicsToFocusOn.filter(t => t.category === 'REPEATED_WEAKNESS');
    if (activeFilterTab === 'recent') return weakData.recentWeakTopics;
    if (activeFilterTab === 'improving') return weakData.improvingTopics;
    if (activeFilterTab === 'all') {
      return [...weakData.topicsToFocusOn, ...weakData.improvingTopics, ...weakData.strongTopics];
    }
    return weakData.topicsToFocusOn;
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
        <p className="text-slate-500 font-semibold text-sm animate-pulse">Analyzing quiz analytics and topics...</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════════
  // VIEW: DETAILED PERSONALIZED LEARNING VIEW (When topic is selected)
  // ══════════════════════════════════════════════════════════════════════════════
  if (selectedTopic) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Top Navigation & Topic Banner */}
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <button
              onClick={() => {
                setSelectedTopic(null);
                setLearningContent(null);
              }}
              className="flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-indigo-600 bg-slate-100/80 hover:bg-indigo-50 px-3.5 py-2 rounded-xl transition-all w-fit"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Weak Topics
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
                  <option value="local">Ollama (Local)</option>
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
                {selectedTopic.unitTitle && (
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                    Unit {selectedTopic.unitNumber || ''}: {selectedTopic.unitTitle}
                  </span>
                )}
                {selectedTopic.priority === 'High' && (
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> High Priority
                  </span>
                )}
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
                {selectedTopic.topicTitle || selectedTopic.topicTag}
              </h1>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {selectedTopic.recommendationReason}
              </p>
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 shrink-0">
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Accuracy</p>
                <p className={`text-xl font-extrabold ${selectedTopic.overallAccuracy <= 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {selectedTopic.overallAccuracy}%
                </p>
              </div>
              <div className="w-px h-8 bg-slate-200" />
              <div className="text-center px-2">
                <p className="text-[10px] uppercase font-bold text-slate-400">Attempts</p>
                <p className="text-xl font-extrabold text-slate-700">{selectedTopic.totalAttempts}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Loading Spinner during Generation */}
        {generatingContent && (
          <div className="bg-white/80 backdrop-blur-xl p-12 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col items-center justify-center text-center gap-4">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl shadow-sm animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Generating Personalized Learning Material...</h3>
            <p className="text-xs text-slate-500 max-w-md">
              Extracting key concepts from your course material <span className="font-semibold text-slate-700">"{selectedTopic.materialTitle}"</span> and tailoring explanations to target your past mistakes.
            </p>
          </div>
        )}

        {/* Content Container */}
        {!generatingContent && learningContent && (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white overflow-hidden">
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-100 bg-slate-50/60 overflow-x-auto p-2 gap-1 custom-scrollbar">
              {[
                { id: 'overview', label: 'Overview & Simply Explained', icon: Lightbulb },
                { id: 'concepts', label: 'Important Concepts & Points', icon: Layers },
                { id: 'examples', label: 'Examples & Step-by-Step', icon: BookOpen },
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
                  <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-5 flex items-start gap-3.5">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0 mt-0.5">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-amber-900 mb-1">Why You Found This Topic Difficult</h4>
                      <p className="text-xs md:text-sm text-amber-800 leading-relaxed">{learningContent.whyWeak}</p>
                    </div>
                  </div>
                )}

                {/* Simple Conceptual Explanation */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-2xl p-6">
                  <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
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
                    <h3 className="text-base font-extrabold text-indigo-950 mb-2 flex items-center gap-2">
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
                    <h3 className="text-base font-extrabold text-emerald-950 mb-3 flex items-center gap-2">
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
                {/* Important Concepts Cards */}
                {learningContent.importantConcepts?.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      Core Concepts You Must Understand
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {learningContent.importantConcepts.map((item, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 hover:border-indigo-200 transition-colors">
                          <h4 className="text-sm font-extrabold text-indigo-900 mb-1.5 flex items-center gap-2">
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

                {/* Important Points (Exam Focused) */}
                {learningContent.importantPoints?.length > 0 && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6">
                    <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
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

                {/* Important Subtopics */}
                {learningContent.importantSubtopics?.length > 0 && (
                  <div className="bg-indigo-50/40 border border-indigo-100/80 rounded-2xl p-6">
                    <h3 className="text-base font-extrabold text-indigo-950 mb-3 flex items-center gap-2">
                      <BookCheck className="w-5 h-5 text-indigo-600" />
                      Key Subtopics in Material
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {learningContent.importantSubtopics.map((st, idx) => (
                        <div key={idx} className="bg-white p-3.5 rounded-xl border border-indigo-100 shadow-xs">
                          <h5 className="font-bold text-xs text-indigo-900 mb-1">{st.title || st.name}</h5>
                          <p className="text-[11px] text-slate-600">{st.keyPoint || st.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EXAMPLES & STEP-BY-STEP */}
            {activeLearningTab === 'examples' && (
              <div className="p-6 md:p-8 space-y-6">
                {/* Solved Examples */}
                {learningContent.examples?.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Worked Examples
                    </h3>
                    <div className="space-y-4">
                      {learningContent.examples.map((ex, idx) => (
                        <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-3">
                          <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                            <span className="p-1 bg-amber-100 text-amber-700 rounded-lg text-xs">Ex {idx + 1}</span>
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
                          {ex.explanation && (
                            <p className="text-xs text-slate-600 italic">
                              <span className="font-bold text-slate-700 not-italic">Explanation: </span>
                              {ex.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step-by-Step Method */}
                {learningContent.stepByStep?.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-600" />
                      Step-by-Step Process / Methodology
                    </h3>
                    <div className="space-y-3">
                      {learningContent.stepByStep.map((st, idx) => (
                        <div key={idx} className="flex items-start gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                          <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-xs shrink-0">
                            {st.step || idx + 1}
                          </div>
                          <div>
                            <h5 className="font-bold text-sm text-slate-900 mb-1">{st.title}</h5>
                            <p className="text-xs md:text-sm text-slate-600 leading-relaxed">{st.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Common Mistakes */}
                {learningContent.commonMistakes?.length > 0 && (
                  <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-6">
                    <h3 className="text-base font-extrabold text-rose-950 mb-3 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-600" />
                      Common Mistakes to Avoid
                    </h3>
                    <div className="space-y-3">
                      {learningContent.commonMistakes.map((cm, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-rose-100 shadow-xs space-y-1.5">
                          <p className="text-xs font-bold text-rose-700">✕ {cm.mistake}</p>
                          <p className="text-xs text-slate-600"><span className="font-semibold text-slate-700">Why it's wrong:</span> {cm.whyWrong}</p>
                          {cm.howToFix && (
                            <p className="text-xs text-emerald-700 font-medium">✓ <span className="font-bold">Correct Approach:</span> {cm.howToFix}</p>
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
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-sm">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {selectedTopic.materialFileType || 'Academic Document'}
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{selectedTopic.materialTitle}</h4>
                      <p className="text-xs text-slate-500">{selectedTopic.subjectName} • Unit {selectedTopic.unitNumber || 1}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/quiz/${selectedTopic.materialId}`)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm w-fit"
                  >
                    <span>Take Quiz for this Material</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {learningContent.materialBasedLearning?.slidesOrSections?.length > 0 && (
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-indigo-600" />
                      Important Sections / Slides in this Material
                    </h3>
                    <div className="space-y-3">
                      {learningContent.materialBasedLearning.slidesOrSections.map((sec, idx) => (
                        <div key={idx} className="p-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                                {sec.reference || `Section ${idx + 1}`}
                              </span>
                              <h5 className="font-bold text-sm text-slate-900">{sec.title}</h5>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">{sec.keyTakeaway || sec.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: PRACTICE & MINI QUIZ */}
            {activeLearningTab === 'practice' && (
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl">
                  <div>
                    <h3 className="font-extrabold text-base text-indigo-950">Targeted Topic Practice</h3>
                    <p className="text-xs text-indigo-900/70 mt-0.5">
                      Answer these practice questions designed specifically to address your previous weaknesses.
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/quiz/${selectedTopic.materialId}`)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all shrink-0 w-fit"
                  >
                    <span>Take Full Quiz ({selectedTopic.materialTitle})</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

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
                              <span className="text-indigo-600 mr-2 font-extrabold">Q{qIdx + 1}.</span>
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

                          {/* Options */}
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

                          {/* Instant Explanation */}
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
  // VIEW: MAIN WEAK TOPICS DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════════
  const filteredList = getFilteredTopics();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white shadow-md shadow-indigo-100">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md">
              AI Personalized Learning
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            AI Learning Hub
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Personalized learning paths generated from your quiz attempt analytics and academic materials.
          </p>
        </div>
      </header>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topics to Focus</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900">{weakData.summary.totalWeakTopics}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Need review or practice</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Repeated Weakness</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-amber-600">{weakData.summary.repeatedWeakCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Struggled in 2+ attempts</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Improving Topics</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-emerald-600">{weakData.summary.improvingCount}</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Gaining mastery</p>
        </div>

        <div className="bg-white/80 backdrop-blur-xl p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Overall Mastery</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-indigo-600">{weakData.summary.overallMastery}%</p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">Across all quiz questions</p>
        </div>
      </div>

      {/* Topics Section */}
      <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white space-y-6">
        {/* Tabs Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1">
            {[
              { id: 'focus', label: `Needs Attention (${weakData.summary.totalWeakTopics})` },
              { id: 'repeated', label: `Repeated Weakness (${weakData.summary.repeatedWeakCount})` },
              { id: 'recent', label: `Recent Failures (${weakData.recentWeakTopics.length})` },
              { id: 'improving', label: `Improving (${weakData.summary.improvingCount})` },
              { id: 'all', label: 'All Topics' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilterTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeFilterTab === tab.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100/80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic Cards Grid */}
        {filteredList.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full w-fit mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              {activeFilterTab === 'focus'
                ? 'No Weak Topics Detected!'
                : 'No topics in this category'}
            </h3>
            <p className="text-xs md:text-sm text-slate-500 max-w-md mx-auto">
              {weakData.summary.totalAttempts === 0
                ? 'Take quizzes on your subject materials to automatically detect topics and generate personalized learning paths.'
                : 'You are performing well across your tested topics! Continue practicing to maintain your scores.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredList.map((topic, idx) => {
              const isRepeated = topic.category === 'REPEATED_WEAKNESS';
              const isRecent = topic.category === 'RECENT_FAILURE';
              const isImproving = topic.category === 'IMPROVING';

              return (
                <div
                  key={idx}
                  className="bg-white border border-slate-200/80 hover:border-indigo-300 rounded-3xl p-6 transition-all hover:shadow-md flex flex-col justify-between group space-y-4"
                >
                  <div className="space-y-3">
                    {/* Tags */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100/70 px-2.5 py-0.5 rounded-md">
                        {topic.subjectName}
                      </span>
                      {isRepeated && (
                        <span className="text-[10px] font-extrabold uppercase text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-md">
                          Repeated Weakness
                        </span>
                      )}
                      {isRecent && (
                        <span className="text-[10px] font-extrabold uppercase text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                          Recent Attempt Failure
                        </span>
                      )}
                      {isImproving && (
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                          Improving Performance
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {topic.topicTitle || topic.topicTag}
                      </h3>
                      {topic.unitTitle && (
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Unit {topic.unitNumber || 1}: {topic.unitTitle}
                        </p>
                      )}
                    </div>

                    {/* Stats & Recommendation */}
                    <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-400 font-medium">Accuracy: </span>
                        <span className={`font-extrabold ${topic.overallAccuracy <= 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {topic.overallAccuracy}%
                        </span>
                      </div>
                      <div className="w-px h-4 bg-slate-200" />
                      <div>
                        <span className="text-slate-400 font-medium">Attempts: </span>
                        <span className="font-bold text-slate-700">{topic.totalAttempts}</span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">
                      <span className="font-bold text-indigo-900">AI Note: </span>
                      {topic.recommendationReason}
                    </p>
                  </div>

                  <button
                    onClick={() => handleStartLearning(topic)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-2xl shadow-sm shadow-indigo-100 transition-all active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Start Personalized Learning</span>
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
