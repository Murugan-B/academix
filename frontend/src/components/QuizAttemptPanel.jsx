import React, { useState, useEffect } from 'react';
import {
  X, CheckCircle, XCircle, BrainCircuit, RotateCcw,
  ChevronRight, ChevronLeft, ArrowRight, AlertTriangle,
  Trophy, BookOpen
} from 'lucide-react';
import api from '../api/axios';

// ── helper ────────────────────────────────────────────────────────────────────
const PASS_MARK = 60; // percent

export default function QuizAttemptPanel({ quizInfo, material, onClose }) {
  // ── state machine ──────────────────────────────────────────────────────────
  // 'loading' | 'fetchError' | 'ready' | 'inAttempt' | 'submitting' | 'result'
  const [phase, setPhase]     = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // quiz data (full object with .questions array)
  const [quiz, setQuiz]       = useState(null);

  // attempt data
  const [attempt, setAttempt] = useState(null);   // { attemptId, attemptNumber }
  const [answers, setAnswers] = useState({});      // { questionId: 'A'|'B'|'C'|'D' }
  const [currentIdx, setCurrentIdx] = useState(0);

  // result data
  const [result, setResult]   = useState(null);   // server response

  // ── fetch quiz on mount ────────────────────────────────────────────────────
  useEffect(() => {
    fetchQuiz();
  }, [quizInfo, material]);

  const fetchQuiz = async () => {
    setPhase('loading');
    setErrorMsg('');
    try {
      const res = await api.get(`/quizzes/material/${material.id}`);
      const data = res.data;

      if (!data.questions || data.questions.length === 0) {
        setPhase('fetchError');
        setErrorMsg('This quiz has no questions. Please regenerate the quiz.');
        return;
      }

      setQuiz(data);
      setPhase('ready');
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        setPhase('fetchError');
        setErrorMsg('Quiz not found for this material. Please generate a quiz first.');
      } else {
        setPhase('fetchError');
        setErrorMsg(err.message || 'Failed to load quiz. Please try again.');
      }
    }
  };

  // ── start / reattempt ──────────────────────────────────────────────────────
  const startQuiz = async () => {
    if (!quiz || !quiz.id) return;
    setPhase('loading');
    try {
      const res = await api.post(`/quizzes/${quiz.id}/attempt`);
      setAttempt(res.data);
      setAnswers({});
      setCurrentIdx(0);
      setResult(null);
      setPhase('inAttempt');
    } catch (err) {
      setPhase('fetchError');
      setErrorMsg(err.message || 'Could not start quiz. Please try again.');
    }
  };

  // ── submit ─────────────────────────────────────────────────────────────────
  const submitQuiz = async () => {
    if (!window.confirm('Are you sure you want to submit your answers?')) return;
    setPhase('submitting');
    try {
      const res = await api.post(`/quizzes/attempt/${attempt.attemptId}/submit`, { answers });
      setResult(res.data);
      setPhase('result');
    } catch (err) {
      setPhase('fetchError');
      setErrorMsg(err.message || 'Could not submit quiz. Please try again.');
    }
  };

  // ── answer selection ───────────────────────────────────────────────────────
  const selectAnswer = (questionId, option) => {
    setAnswers(prev => ({ ...prev, [questionId]: option }));
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const questions     = quiz?.questions || [];
  const totalQ        = questions.length;
  const currentQ      = questions[currentIdx] || null;
  const answeredCount = Object.keys(answers).length;
  const passed        = result ? result.percentage >= PASS_MARK : false;

  // ── shared header ──────────────────────────────────────────────────────────
  const Header = ({ title, subtitle }) => (
    <div className="p-4 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-10 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <BrainCircuit className="w-5 h-5 text-purple-600 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-bold text-base text-slate-800 truncate">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
        </div>
      </div>
      <button
        onClick={onClose}
        className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0 ml-2"
        aria-label="Close quiz panel"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );

  // ── PHASE: loading ─────────────────────────────────────────────────────────
  if (phase === 'loading' || phase === 'submitting') {
    return (
      <div className="w-[600px] border-l border-slate-200 bg-white flex flex-col h-full z-20">
        <Header
          title={phase === 'submitting' ? 'Submitting Quiz…' : 'Loading Quiz…'}
          subtitle={material?.title}
        />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm font-medium">
            {phase === 'submitting' ? 'Grading your answers…' : 'Fetching quiz questions…'}
          </p>
        </div>
      </div>
    );
  }

  // ── PHASE: fetchError ──────────────────────────────────────────────────────
  if (phase === 'fetchError') {
    return (
      <div className="w-[600px] border-l border-slate-200 bg-white flex flex-col h-full z-20">
        <Header title="Quiz Unavailable" subtitle={material?.title} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Could not load quiz</h3>
            <p className="text-sm text-slate-500 max-w-xs">{errorMsg}</p>
          </div>
          <div className="flex gap-3 mt-2">
            <button
              onClick={fetchQuiz}
              className="px-5 py-2 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all text-sm"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE: result ──────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const pct = parseFloat(result.percentage).toFixed(1);
    return (
      <div className="w-[600px] border-l border-slate-200 bg-white flex flex-col h-full z-20 overflow-y-auto">
        <Header title="Quiz Result" subtitle={quiz?.title} />

        <div className="flex-1 p-6 flex flex-col items-center gap-5">
          {/* Pass / Fail icon */}
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mt-4 ${
            passed ? 'bg-emerald-100' : 'bg-rose-100'
          }`}>
            {passed
              ? <Trophy className="w-12 h-12 text-emerald-500" />
              : <XCircle className="w-12 h-12 text-rose-500" />
            }
          </div>

          {/* Score */}
          <div className="text-center">
            <p className="text-5xl font-extrabold text-slate-800 tracking-tight">
              {result.score} <span className="text-slate-300">/</span> {totalQ}
            </p>
            <p className="text-xl font-semibold text-slate-500 mt-1">{pct}%</p>
          </div>

          {/* Pass/Fail badge */}
          <span className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-full font-extrabold text-base tracking-wide ${
            passed
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700'
          }`}>
            {passed ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {passed ? 'PASSED' : 'NOT PASSED'}
          </span>

          {/* Stats row */}
          <div className="w-full grid grid-cols-3 gap-3 mt-1">
            {[
              { label: 'Correct',   value: result.score,               color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Incorrect', value: totalQ - result.score,      color: 'text-rose-600 bg-rose-50' },
              { label: 'Pass Mark', value: `${PASS_MARK}%`,            color: 'text-indigo-600 bg-indigo-50' },
            ].map(s => (
              <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
                <p className="text-2xl font-extrabold">{s.value}</p>
                <p className="text-xs font-semibold mt-0.5 opacity-70">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Attempt info */}
          <p className="text-xs text-slate-400 font-medium">
            Attempt #{attempt?.attemptNumber ?? 1} · {passed ? 'Great work!' : 'Keep practising — you\'ll get there!'}
          </p>

          {/* AI Recommendation */}
          {result.recommendation && (
            <div className="w-full bg-indigo-50 border border-indigo-100 p-5 rounded-2xl">
              <h3 className="font-bold text-indigo-800 mb-2 flex items-center gap-2 text-sm">
                <BrainCircuit className="w-4 h-4" /> AI Recommendation
              </h3>
              <p className="text-indigo-700 text-sm leading-relaxed">{result.recommendation}</p>
            </div>
          )}

          {/* Reattempt */}
          <button
            onClick={startQuiz}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all active:scale-95 mt-1"
          >
            <RotateCcw className="w-5 h-5" /> Reattempt Quiz
          </button>
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // ── PHASE: ready ───────────────────────────────────────────────────────────
  if (phase === 'ready' && quiz) {
    return (
      <div className="w-[600px] border-l border-slate-200 bg-white flex flex-col h-full z-20">
        <Header title="Quiz Ready" subtitle={material?.title} />
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-50 to-white text-center gap-5">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
            <BrainCircuit className="w-10 h-10 text-purple-600" />
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800 mb-1">{quiz.title}</h3>
            <p className="text-slate-500 text-sm max-w-xs">
              Test your knowledge. This quiz contains{' '}
              <span className="font-bold text-slate-700">{totalQ} questions</span>.
              A score of <span className="font-bold text-purple-600">{PASS_MARK}%</span> or
              above is needed to pass.
            </p>
          </div>

          {/* Question count chips */}
          <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
            {questions.slice(0, 10).map((_, i) => (
              <span
                key={i}
                className="w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center"
              >
                {i + 1}
              </span>
            ))}
          </div>

          <button
            onClick={startQuiz}
            className="mt-2 px-10 py-3.5 bg-purple-600 text-white font-extrabold rounded-2xl hover:bg-purple-700 flex items-center gap-2 shadow-lg shadow-purple-200 transition-all active:scale-95 text-base"
          >
            Start Quiz <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── PHASE: inAttempt ───────────────────────────────────────────────────────
  if (phase === 'inAttempt' && currentQ) {
    const progressPct = Math.round(((currentIdx + 1) / totalQ) * 100);
    const isLast      = currentIdx === totalQ - 1;
    const selectedAns = answers[currentQ.id];

    return (
      <div className="w-[600px] border-l border-slate-200 bg-white flex flex-col h-full z-20">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-purple-600" />
              <h2 className="font-bold text-base text-slate-800">
                Question {currentIdx + 1} <span className="text-slate-400 font-medium">of {totalQ}</span>
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400 font-medium">
                {answeredCount}/{totalQ} answered
              </span>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-purple-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question body */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
          {/* Question navigation dots */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {questions.map((q, i) => (
              <button
                key={q.id}
                onClick={() => setCurrentIdx(i)}
                title={`Question ${i + 1}`}
                className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                  i === currentIdx
                    ? 'bg-purple-600 text-white ring-2 ring-purple-300 ring-offset-1'
                    : answers[q.id]
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {/* Question card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mb-4">
            {/* Topic tag */}
            {currentQ.topic_tag && (
              <span className="inline-block px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-lg mb-4">
                {currentQ.topic_tag}
              </span>
            )}
            <h3 className="text-base font-semibold text-slate-800 leading-relaxed mb-6">
              {currentQ.question}
            </h3>

            {/* Options */}
            <div className="flex flex-col gap-2.5">
              {['A', 'B', 'C', 'D'].map(opt => {
                const optText   = currentQ[`option_${opt.toLowerCase()}`];
                const isSelected = selectedAns === opt;
                if (!optText) return null;
                return (
                  <button
                    key={opt}
                    onClick={() => selectAnswer(currentQ.id, opt)}
                    className={`text-left p-4 rounded-xl border-2 transition-all active:scale-[0.99] ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50 text-purple-900 shadow-sm shadow-purple-100'
                        : 'border-slate-100 hover:border-purple-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <span className={`font-extrabold mr-3 text-sm ${isSelected ? 'text-purple-600' : 'text-slate-400'}`}>
                      {opt}.
                    </span>
                    <span className="text-sm">{optText}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between shrink-0">
          <button
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(i => i - 1)}
            className="px-4 py-2.5 flex items-center gap-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl disabled:opacity-30 transition-all text-sm"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>

          {/* Center: unanswered warning on last q */}
          {isLast && answeredCount < totalQ && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-1.5 rounded-lg">
              {totalQ - answeredCount} unanswered
            </span>
          )}

          {!isLast ? (
            <button
              onClick={() => setCurrentIdx(i => i + 1)}
              className="px-4 py-2.5 flex items-center gap-2 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submitQuiz}
              className="px-5 py-2.5 flex items-center gap-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all active:scale-95 text-sm shadow-sm shadow-emerald-200"
            >
              <CheckCircle className="w-4 h-4" /> Submit Quiz
            </button>
          )}
        </div>
      </div>
    );
  }

  // Fallback — should never reach here
  return null;
}
