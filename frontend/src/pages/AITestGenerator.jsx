import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Sparkles, CheckCircle2, XCircle, RefreshCw, Award, ArrowRight,
  ArrowLeft, BrainCircuit, Play, History, Check, X, AlertCircle,
  HelpCircle, BookOpen, Layers, ShieldCheck, ChevronRight
} from 'lucide-react';

export default function AITestGenerator() {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'runner' | 'result' | 'history'
  
  // Test Creation Form State
  const [topic, setTopic] = useState('');
  const [courseName, setCourseName] = useState('');
  const [difficulty, setDifficulty] = useState('MEDIUM');
  const [questionCount, setQuestionCount] = useState(5);
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);

  // Active Test Runner State
  const [currentTest, setCurrentTest] = useState(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({}); // { [questionIdx]: "Selected Option" }
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
  const [attemptResult, setAttemptResult] = useState(null);

  // Test History State
  const [savedTests, setSavedTests] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchSavedTests();
  }, []);

  const fetchSavedTests = async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/public/tests');
      setSavedTests(res.data || []);
    } catch (err) {
      console.error('Failed to load saved tests:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateTest = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setGenerating(true);
    setGenerateError(null);

    try {
      const res = await api.post('/public/tests/generate', {
        topic: topic.trim(),
        courseName: courseName.trim(),
        difficulty,
        questionCount: parseInt(questionCount, 10) || 5,
        customInstructions: customInstructions.trim()
      });

      const newTest = res.data;
      startTestRunner(newTest);
      fetchSavedTests();
    } catch (err) {
      console.error('Test generation error:', err);
      setGenerateError(err.response?.data?.message || 'Failed to generate practice test. Please verify quota or try again in a few moments.');
    } finally {
      setGenerating(false);
    }
  };

  const startTestRunner = (test) => {
    setCurrentTest(test);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setAttemptResult(null);
    setActiveTab('runner');
  };

  const handleSelectOption = (option) => {
    setUserAnswers(prev => ({
      ...prev,
      [currentQuestionIdx]: option
    }));
  };

  const handleSubmitAttempt = async () => {
    if (!currentTest) return;
    setSubmittingAttempt(true);

    try {
      const res = await api.post(`/public/tests/${currentTest.id}/attempt`, {
        userAnswers
      });
      setAttemptResult(res.data);
      setActiveTab('result');
      fetchSavedTests();
    } catch (err) {
      console.error('Attempt submission failed:', err);
    } finally {
      setSubmittingAttempt(false);
    }
  };

  const handleRetakeTest = () => {
    if (!currentTest) return;
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    setAttemptResult(null);
    setActiveTab('runner');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-1.5">
            <BrainCircuit className="w-3.5 h-3.5" />
            <span>Adaptive AI Practice Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            AI Test Generator & Practice Assessments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Generate customized practice tests on any topic, test your knowledge interactively, and receive deep explanations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-200/70 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'create' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Test
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              fetchSavedTests();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'history' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Saved Tests ({savedTests.length})
          </button>
        </div>
      </div>

      {/* ── TAB 1: CREATE TEST FORM ──────────────────────────────────────────── */}
      {activeTab === 'create' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6 animate-in fade-in">
          
          <div className="border-b border-slate-150 pb-4">
            <h2 className="text-lg font-black text-slate-900">Configure Practice Assessment</h2>
            <p className="text-xs text-slate-500 font-medium">Customize the topic, question count, and difficulty level.</p>
          </div>

          {generateError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{generateError}</span>
            </div>
          )}

          <form onSubmit={handleGenerateTest} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 block">
                  Topic or Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g. Graph Traversal Algorithms (BFS & DFS), Database Normalization"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs text-slate-800 font-medium placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Course Name (Optional)</label>
                <input
                  type="text"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 font-medium placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 block">Question Count</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                >
                  <option value={3}>3 Questions (Quick Drill)</option>
                  <option value={5}>5 Questions (Standard Practice)</option>
                  <option value={8}>8 Questions (In-depth Assessment)</option>
                  <option value={10}>10 Questions (Mock Exam)</option>
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 block">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'EASY', label: 'Beginner / Fundamental', color: 'emerald' },
                    { id: 'MEDIUM', label: 'Intermediate / University', color: 'indigo' },
                    { id: 'HARD', label: 'Advanced / Competitive', color: 'rose' }
                  ].map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDifficulty(d.id)}
                      className={`p-3 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                        difficulty === d.id
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-700 ring-2 ring-indigo-200 shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-bold text-slate-800 block">Custom Focus Instructions (Optional)</label>
                <textarea
                  rows={2}
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="e.g. Focus on time and space complexities, edge cases, and code snippet debugging..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-800 font-medium placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-150 flex items-center justify-end">
              <button
                type="submit"
                disabled={generating}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Practice Test with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Practice Assessment</span>
                  </>
                )}
              </button>
            </div>
          </form>

        </div>
      )}

      {/* ── TAB 2: INTERACTIVE TEST RUNNER ───────────────────────────────────── */}
      {activeTab === 'runner' && currentTest && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6 animate-in fade-in">
          
          {/* Runner Header Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-4 border-b border-slate-150">
            <div>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                {currentTest.difficulty} Difficulty
              </span>
              <h2 className="text-lg font-black text-slate-900 mt-1">{currentTest.title}</h2>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span>Question {currentQuestionIdx + 1} of {currentTest.questions.length}</span>
            </div>
          </div>

          {/* Question Index Progress Dots */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {currentTest.questions.map((q, idx) => {
              const isAnswered = userAnswers[idx] !== undefined;
              const isCurrent = currentQuestionIdx === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentQuestionIdx(idx)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white shadow-xs scale-105'
                      : isAnswered
                      ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          {/* Active Question Card */}
          {currentTest.questions[currentQuestionIdx] && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Topic: {currentTest.questions[currentQuestionIdx].topicTag || currentTest.topic}
                </span>
                <h3 className="text-base font-bold text-slate-900 leading-relaxed">
                  {currentTest.questions[currentQuestionIdx].question}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2.5 pt-2">
                {currentTest.questions[currentQuestionIdx].options.map((opt, optIdx) => {
                  const isSelected = userAnswers[currentQuestionIdx] === opt;
                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSelectOption(opt)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold ring-2 ring-indigo-200 shadow-2xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 font-medium'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border border-slate-200'
                        }`}>
                          {String.fromCharCode(65 + optIdx)}
                        </div>
                        <span className="text-xs sm:text-sm">{opt}</span>
                      </div>

                      {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Runner Navigation Footer */}
          <div className="pt-4 border-t border-slate-150 flex items-center justify-between">
            <button
              type="button"
              disabled={currentQuestionIdx === 0}
              onClick={() => setCurrentQuestionIdx(prev => Math.max(0, prev - 1))}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            {currentQuestionIdx < currentTest.questions.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentQuestionIdx(prev => prev + 1)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submittingAttempt}
                onClick={handleSubmitAttempt}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submittingAttempt ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Grading Assessment...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Submit & View Results</span>
                  </>
                )}
              </button>
            )}
          </div>

        </div>
      )}

      {/* ── TAB 3: ASSESSMENT RESULTS & EXPLANATIONS ─────────────────────────── */}
      {activeTab === 'result' && attemptResult && currentTest && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Score Header Card */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-violet-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="px-3 py-1 bg-white/10 rounded-full text-indigo-200 text-xs font-bold border border-white/15 inline-flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-300" />
                Assessment Results
              </span>
              <h2 className="text-2xl font-black">{currentTest.title}</h2>
              <p className="text-xs text-indigo-100/80">
                Detailed pedagogical analysis and explanations for each objective question.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex items-center gap-6 shrink-0">
              <div className="text-center">
                <span className="text-3xl font-black block">{attemptResult.score}%</span>
                <span className="text-[10px] text-indigo-200 uppercase font-bold">Accuracy Score</span>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div className="text-center">
                <span className="text-2xl font-black block text-emerald-300">{attemptResult.correctCount} / {attemptResult.totalQuestions}</span>
                <span className="text-[10px] text-indigo-200 uppercase font-bold">Correct Answers</span>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Question-by-Question Review</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetakeTest}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Assessment</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                New Assessment
              </button>
            </div>
          </div>

          {/* Detailed Question Review Cards */}
          <div className="space-y-4">
            {attemptResult.gradedAnswers.map((q, idx) => (
              <div
                key={idx}
                className={`p-6 rounded-3xl border transition-all space-y-3 bg-white shadow-2xs ${
                  q.isCorrect ? 'border-emerald-200 ring-1 ring-emerald-100' : 'border-rose-200 ring-1 ring-rose-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Question {idx + 1} • {q.topicTag || 'Concept'}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{q.question}</h4>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-black inline-flex items-center gap-1 shrink-0 ${
                    q.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {q.isCorrect ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    <span>{q.isCorrect ? 'Correct' : 'Incorrect'}</span>
                  </span>
                </div>

                {/* Answers Diff */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Your Selection:</span>
                    <span className={`font-bold ${q.isCorrect ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {q.selectedAnswer || 'None Selected'}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">Correct Answer:</span>
                    <span className="font-bold text-emerald-900">{q.correctAnswer}</span>
                  </div>
                </div>

                {/* Pedagogical Explanation */}
                {q.explanation && (
                  <div className="p-3.5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-slate-700 space-y-1">
                    <span className="font-bold text-indigo-900 block">Explanation & Conceptual Insight:</span>
                    <p className="leading-relaxed">{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      )}

      {/* ── TAB 4: SAVED PRACTICE TESTS HISTORY ──────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6 animate-in fade-in">
          
          <div className="flex items-center justify-between pb-3 border-b border-slate-150">
            <div>
              <h2 className="text-lg font-black text-slate-900">Your Saved Practice Tests</h2>
              <p className="text-xs text-slate-500 font-medium">Revisit generated tests, retake assessments, and track score progression.</p>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
            >
              + Create New Test
            </button>
          </div>

          {historyLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading saved assessments...</div>
          ) : savedTests.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 space-y-3">
              <BrainCircuit className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">No practice tests generated yet</p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl"
              >
                Generate First Test
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {savedTests.map(test => (
                <div
                  key={test.id}
                  className="bg-slate-50/70 p-5 rounded-3xl border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {test.difficulty} • {test.question_count} Questions
                      </span>
                      {test.best_score !== null && (
                        <span className="text-xs font-bold text-emerald-600">
                          Best: {parseFloat(test.best_score).toFixed(0)}%
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">{test.title}</h4>
                    <p className="text-xs text-slate-500">Course: {test.course_name || 'General Academic'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[10px] text-slate-400">
                      {test.attempt_count > 0 ? `${test.attempt_count} attempts` : 'Not attempted yet'}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        api.get(`/public/tests/${test.id}`).then(res => startTestRunner(res.data));
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Take Test</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
}
