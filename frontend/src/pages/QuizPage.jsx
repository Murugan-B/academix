import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen, BrainCircuit, ChevronLeft, ChevronRight,
  CheckCircle, XCircle, RotateCcw, AlertTriangle,
  ArrowLeft, Trophy, Clock
} from 'lucide-react';
import api from '../api/axios';

const PASS_MARK = 60;

// ─── Option button ─────────────────────────────────────────────────────────────
function OptionButton({ label, text, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-150 active:scale-[0.99] ${
        selected
          ? 'border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-100/60'
          : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50/80 bg-white'
      }`}
    >
      <span className={`w-8 h-8 shrink-0 rounded-xl flex items-center justify-center text-sm font-extrabold border-2 transition-colors ${
        selected
          ? 'bg-indigo-600 border-indigo-600 text-white'
          : 'border-slate-300 text-slate-500 bg-white'
      }`}>
        {label}
      </span>
      <span className={`text-base leading-relaxed pt-0.5 ${selected ? 'text-indigo-900 font-semibold' : 'text-slate-700'}`}>
        {text}
      </span>
    </button>
  );
}

// ─── Full-screen loading ────────────────────────────────────────────────────────
function FullLoader({ message = 'Loading Quiz…' }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <span className="text-2xl font-extrabold text-white tracking-tight">Academix</span>
      </div>
      <div className="w-14 h-14 border-4 border-white/20 border-t-indigo-400 rounded-full animate-spin" />
      <p className="text-white/60 text-base font-medium">{message}</p>
    </div>
  );
}

// ─── Full-screen error ──────────────────────────────────────────────────────────
function FullError({ message, onBack, onRetry }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-rose-400" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Unable to load quiz</h2>
        <p className="text-white/50 max-w-sm">{message}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-500 transition-all"
          >
            Try Again
          </button>
        )}
        <button
          onClick={onBack}
          className="px-6 py-3 bg-white/10 text-white font-bold rounded-xl hover:bg-white/20 transition-all flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Study Material
        </button>
      </div>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function QuizPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Context passed via navigate state
  const { subjectId, subjectName, materialTitle } = location.state || {};

  // ── State machine ──────────────────────────────────────────────────────────
  // 'loading' | 'error' | 'ready' | 'inAttempt' | 'submitting' | 'result'
  const [phase, setPhase] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [sessionQuestions, setSessionQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [result, setResult] = useState(null);

  // ── Back-navigation guard ──────────────────────────────────────────────────
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (phase === 'inAttempt') {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase]);

  // Intercept browser Back button while in quiz
  useEffect(() => {
    if (phase !== 'inAttempt') return;

    // Push a dummy entry so the back button triggers popstate before leaving
    window.history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      const confirmed = window.confirm(
        'Quiz in progress. Are you sure you want to leave?\n\nYour progress will NOT be saved.'
      );
      if (confirmed) {
        goBackToMaterial();
      } else {
        // Push again so the guard stays active
        window.history.pushState(null, '', window.location.href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [phase]);

  // ── Fetch quiz ─────────────────────────────────────────────────────────────
  const fetchQuiz = useCallback(async () => {
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await api.get(`/quizzes/material/${materialId}`);
      const data = res.data;
      if (!data.id) {
        setPhase('error');
        setErrorMsg('This quiz could not be loaded. Please regenerate the quiz from the material page.');
        return;
      }
      setQuiz(data);
      setPhase('ready');
    } catch (err) {
      setPhase('error');
      if (err.response?.status === 404) {
        setErrorMsg('Quiz not found for this material. Please generate a quiz first.');
      } else {
        setErrorMsg(err.message || 'Failed to load quiz data. Please try again.');
      }
    }
  }, [materialId]);

  useEffect(() => {
    fetchQuiz();
  }, [fetchQuiz]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const goBackToMaterial = () => {
    if (subjectId) {
      navigate(`/subjects/${subjectId}`, { replace: true });
    } else {
      navigate(-1);
    }
  };

  // ── Start attempt ──────────────────────────────────────────────────────────
  const startQuiz = async () => {
    if (!quiz?.id) return;
    setPhase('loading');
    try {
      const res = await api.post(`/quizzes/${quiz.id}/attempt`);
      setAttempt(res.data);
      setSessionQuestions(res.data.questions);
      setAnswers({});
      setCurrentIdx(0);
      setResult(null);
      setPhase('inAttempt');
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Could not start quiz. Please try again.');
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const submitQuiz = async () => {
    if (!window.confirm('Submit your quiz? This action cannot be undone.')) return;
    setPhase('submitting');
    try {
      const res = await api.post(`/quizzes/attempt/${attempt.attemptId}/submit`, { answers });
      setResult(res.data);
      setPhase('result');
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.message || 'Could not submit quiz. Please try again.');
    }
  };

  // ─── Derived ───────────────────────────────────────────────────────────────
  const questions = sessionQuestions || [];
  const totalQ = 10; // Every attempt is 10 questions
  const currentQ = questions[currentIdx] || null;
  const answeredCount = Object.keys(answers).length;
  const passed = result ? result.percentage >= PASS_MARK : false;

  // ─── Shared top-bar ────────────────────────────────────────────────────────
  const TopBar = ({ showProgress = false }) => (
    <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 px-6 py-4 flex items-center justify-between shrink-0">
      {/* Brand + breadcrumb */}
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <span className="text-white font-extrabold text-lg tracking-tight">Academix</span>
        </div>
        <div className="hidden md:flex items-center gap-2 text-white/40 text-sm font-medium min-w-0">
          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
          {subjectName && <span className="text-white/60 truncate max-w-[120px]">{subjectName}</span>}
          {materialTitle && (
            <>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/30" />
              <span className="text-white/60 truncate max-w-[120px]">{materialTitle}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5 shrink-0 text-white/30" />
          <span className="text-indigo-300 font-bold truncate max-w-[120px]">
            {quiz?.title || 'Quiz'}
          </span>
        </div>
      </div>

      {/* Progress */}
      {showProgress && (
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-white/60 text-sm font-medium hidden sm:block">
            <span className="text-white font-bold">{currentIdx + 1}</span> of {totalQ}
          </span>
          <div className="w-32 h-2 bg-white/10 rounded-full hidden sm:block">
            <div
              className="h-2 bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / totalQ) * 100}%` }}
            />
          </div>
          <span className="text-white/40 text-xs font-medium">
            {answeredCount}/{totalQ} answered
          </span>
        </div>
      )}
    </header>
  );

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: loading / submitting
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'loading') return <FullLoader message="Loading Quiz…" />;
  if (phase === 'submitting') return <FullLoader message="Grading your answers…" />;

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: error
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'error') {
    return (
      <FullError
        message={errorMsg}
        onBack={goBackToMaterial}
        onRetry={fetchQuiz}
      />
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: result
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'result' && result) {
    const pct = parseFloat(result.percentage).toFixed(1);
    const wrong = totalQ - result.score;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
        <TopBar />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            {/* Card */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
              {/* Icon */}
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 ${
                passed ? 'bg-emerald-500/20' : 'bg-rose-500/20'
              }`}>
                {passed
                  ? <Trophy className="w-12 h-12 text-emerald-400" />
                  : <XCircle className="w-12 h-12 text-rose-400" />
                }
              </div>

              <p className="text-white/50 text-sm font-semibold uppercase tracking-widest mb-3">
                Quiz Completed
              </p>

              {/* Score */}
              <div className="mb-2">
                <span className="text-7xl font-extrabold text-white tracking-tight">
                  {result.score}
                </span>
                <span className="text-4xl font-bold text-white/30"> / {totalQ}</span>
              </div>
              <p className="text-3xl font-bold text-white/60 mb-5">{pct}%</p>

              {/* Badge */}
              <span className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-full font-extrabold text-lg tracking-wide mb-8 ${
                passed
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}>
                {passed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {passed ? 'PASSED' : 'FAILED'}
              </span>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <p className="text-3xl font-extrabold text-emerald-400">{result.score}</p>
                  <p className="text-emerald-300/60 text-xs font-semibold mt-0.5 uppercase tracking-wider">
                    Correct Answers
                  </p>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
                  <p className="text-3xl font-extrabold text-rose-400">{wrong}</p>
                  <p className="text-rose-300/60 text-xs font-semibold mt-0.5 uppercase tracking-wider">
                    Wrong Answers
                  </p>
                </div>
              </div>

              {/* Attempt number */}
              <p className="text-white/30 text-xs font-medium mb-6">
                Attempt #{attempt?.attemptNumber ?? 1} · Pass mark: {PASS_MARK}%
              </p>

              {/* AI Recommendation */}
              {result.recommendation && (
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 mb-6 text-left">
                  <p className="text-indigo-300 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <BrainCircuit className="w-3.5 h-3.5" /> AI Recommendation
                  </p>
                  <p className="text-indigo-200/70 text-sm leading-relaxed">{result.recommendation}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  onClick={startQuiz}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-900/40"
                >
                  <RotateCcw className="w-4 h-4" /> Reattempt Quiz
                </button>
                <button
                  onClick={goBackToMaterial}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-all active:scale-95 border border-white/10"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to Study Material
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: ready
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'ready' && quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
        <TopBar />

        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-lg text-center">
            {/* Icon */}
            <div className="w-24 h-24 mx-auto bg-indigo-500/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30 shadow-2xl shadow-indigo-900/50">
              <BrainCircuit className="w-12 h-12 text-indigo-400" />
            </div>

            <h1 className="text-3xl font-extrabold text-white mb-3 tracking-tight">
              {quiz.title}
            </h1>
            <p className="text-white/50 text-base mb-8 max-w-xs mx-auto leading-relaxed">
              10 questions · Pass with{' '}
              <span className="text-indigo-300 font-bold">{PASS_MARK}%</span> or above
            </p>

            {/* Question number pills */}
            <div className="flex flex-wrap gap-2 justify-center mb-10 max-w-xs mx-auto">
              {Array.from({ length: 10 }).map((_, i) => (
                <span
                  key={i}
                  className="w-8 h-8 rounded-full bg-white/10 text-white/60 text-xs font-bold flex items-center justify-center border border-white/10"
                >
                  {i + 1}
                </span>
              ))}
            </div>

            <button
              onClick={startQuiz}
              className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-2xl transition-all active:scale-95 shadow-2xl shadow-indigo-900/50 text-lg flex items-center gap-3 mx-auto"
            >
              Start Quiz <ChevronRight className="w-5 h-5" />
            </button>

            <button
              onClick={goBackToMaterial}
              className="mt-4 text-white/30 hover:text-white/60 text-sm font-medium transition-colors flex items-center gap-1.5 mx-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to material
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PHASE: inAttempt
  // ════════════════════════════════════════════════════════════════════════════
  if (phase === 'inAttempt' && currentQ) {
    const isFirst = currentIdx === 0;
    const isLast  = currentIdx === totalQ - 1;
    const selectedAns = answers[currentQ.id];

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex flex-col">
        <TopBar showProgress />

        {/* Main content — centered, scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

            {/* Question nav dots */}
            <div className="flex flex-wrap gap-2 justify-center">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  title={`Question ${i + 1}`}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-150 ${
                    i === currentIdx
                      ? 'bg-indigo-500 text-white ring-2 ring-indigo-300 ring-offset-2 ring-offset-transparent scale-110'
                      : answers[q.id]
                        ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 text-white/40 hover:bg-white/20 border border-white/10'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Question card */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
              {/* Topic badge */}
              {currentQ.topic_tag && (
                <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold rounded-full border border-indigo-500/30 mb-5">
                  {currentQ.topic_tag}
                </span>
              )}

              {/* Question number + text */}
              <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">
                Question {currentIdx + 1} of {totalQ}
              </p>
              <h2 className="text-white text-xl font-bold leading-relaxed mb-8">
                {currentQ.question}
              </h2>

              {/* Options */}
              <div className="flex flex-col gap-3">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const text = currentQ[`option_${opt.toLowerCase()}`];
                  if (!text) return null;
                  return (
                    <OptionButton
                      key={opt}
                      label={opt}
                      text={text}
                      selected={selectedAns === opt}
                      onClick={() => setAnswers(prev => ({ ...prev, [currentQ.id]: opt }))}
                    />
                  );
                })}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2 pb-6">
              <button
                disabled={isFirst}
                onClick={() => setCurrentIdx(i => i - 1)}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-20 transition-all text-sm border border-white/10 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              {/* Unanswered warning on last question */}
              {isLast && answeredCount < totalQ && (
                <span className="text-amber-400/80 text-xs font-semibold bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg">
                  {totalQ - answeredCount} unanswered
                </span>
              )}

              {!isLast ? (
                <button
                  onClick={() => setCurrentIdx(i => i + 1)}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold bg-white/10 hover:bg-white/20 text-white transition-all text-sm border border-white/10"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={submitQuiz}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition-all active:scale-95 shadow-lg shadow-emerald-900/40 text-sm"
                >
                  <CheckCircle className="w-4 h-4" /> Submit Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
