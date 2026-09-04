import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle, XCircle, BrainCircuit,
  Trophy, AlertTriangle, Clock, Hash
} from 'lucide-react';
import api from '../api/axios';

const PASS_MARK = 60;

// ── Option label → letter display ─────────────────────────────────────────────
const OPTION_LABELS = { A: 'A', B: 'B', C: 'C', D: 'D' };

function OptionDisplay({ label, text, isCorrect, isStudentAnswer, showResult }) {
  let ring = 'border-slate-200 bg-white text-slate-700';

  if (showResult) {
    if (isCorrect && isStudentAnswer) {
      ring = 'border-emerald-400 bg-emerald-50 text-emerald-900'; // right answer, student got it right
    } else if (isCorrect) {
      ring = 'border-emerald-400 bg-emerald-50 text-emerald-900'; // correct answer highlight
    } else if (isStudentAnswer && !isCorrect) {
      ring = 'border-rose-400 bg-rose-50 text-rose-900'; // student's wrong pick
    }
  }

  return (
    <div className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-colors ${ring}`}>
      <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center text-xs font-extrabold border ${
        showResult && isCorrect
          ? 'bg-emerald-500 border-emerald-500 text-white'
          : showResult && isStudentAnswer && !isCorrect
            ? 'bg-rose-500 border-rose-500 text-white'
            : 'border-slate-300 bg-slate-50 text-slate-500'
      }`}>
        {label}
      </span>
      <span className="text-sm leading-relaxed pt-0.5 font-medium">{text}</span>
      {showResult && isCorrect && (
        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5 ml-auto" />
      )}
      {showResult && isStudentAnswer && !isCorrect && (
        <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5 ml-auto" />
      )}
    </div>
  );
}

function QuestionCard({ answer, index }) {
  const correctAnswer = answer.correct_answer?.toUpperCase();
  const studentAnswer = answer.selected_answer?.toUpperCase();
  const isCorrect = answer.is_correct;
  const unanswered = !studentAnswer;

  const options = [
    { label: 'A', text: answer.option_a },
    { label: 'B', text: answer.option_b },
    { label: 'C', text: answer.option_c },
    { label: 'D', text: answer.option_d },
  ].filter(o => o.text);

  return (
    <div className={`bg-white rounded-2xl border-2 shadow-sm overflow-hidden transition-all ${
      isCorrect ? 'border-emerald-100' : unanswered ? 'border-slate-200' : 'border-rose-100'
    }`}>
      {/* Question header strip */}
      <div className={`px-6 py-3 flex items-center justify-between ${
        isCorrect ? 'bg-emerald-50/70' : unanswered ? 'bg-slate-50' : 'bg-rose-50/70'
      }`}>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Q{index + 1}
          </span>
          {answer.topic_tag && (
            <span className="px-2.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {answer.topic_tag}
            </span>
          )}
        </div>
        <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${
          isCorrect
            ? 'bg-emerald-100 text-emerald-700'
            : unanswered
              ? 'bg-slate-200 text-slate-500'
              : 'bg-rose-100 text-rose-700'
        }`}>
          {isCorrect
            ? <><CheckCircle className="w-3.5 h-3.5" /> Correct</>
            : unanswered
              ? 'Unanswered'
              : <><XCircle className="w-3.5 h-3.5" /> Incorrect</>
          }
        </span>
      </div>

      {/* Question body */}
      <div className="p-6">
        <p className="text-slate-800 font-semibold text-base leading-relaxed mb-5">
          {answer.question}
        </p>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {options.map(opt => (
            <OptionDisplay
              key={opt.label}
              label={opt.label}
              text={opt.text}
              isCorrect={opt.label === correctAnswer}
              isStudentAnswer={opt.label === studentAnswer}
              showResult
            />
          ))}
        </div>

        {/* Summary row */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-slate-400 font-medium">Your Answer: </span>
            {unanswered ? (
              <span className="font-bold text-slate-400 italic">Not answered</span>
            ) : (
              <span className={`font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                {studentAnswer}. {options.find(o => o.label === studentAnswer)?.text}
              </span>
            )}
          </div>
          {!isCorrect && (
            <div>
              <span className="text-slate-400 font-medium">Correct Answer: </span>
              <span className="font-bold text-emerald-600">
                {correctAnswer}. {options.find(o => o.label === correctAnswer)?.text}
              </span>
            </div>
          )}
        </div>

        {/* Explanation */}
        {answer.explanation && (
          <div className="mt-4 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
            <p className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <BrainCircuit className="w-3.5 h-3.5" /> Explanation
            </p>
            <p className="text-indigo-800 text-sm leading-relaxed">{answer.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AttemptReviewPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // 'loading' | 'error' | 'loaded' | 'empty'
  const [attempt, setAttempt] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchAttempt();
  }, [attemptId]);

  const fetchAttempt = async () => {
    setPhase('loading');
    try {
      const res = await api.get(`/quizzes/attempt/${attemptId}`);
      const data = res.data;

      if (!data.answers || data.answers.length === 0) {
        setPhase('empty');
        return;
      }

      setAttempt(data);
      setPhase('loaded');
    } catch (err) {
      setPhase('error');
      setErrorMsg(
        err.response?.status === 404
          ? 'This attempt was not found.'
          : err.message || 'Failed to load attempt details.'
      );
    }
  };

  const goBack = () => navigate('/student');

  const passed = attempt ? parseFloat(attempt.percentage) >= PASS_MARK : false;
  const pct = attempt ? parseFloat(attempt.percentage).toFixed(1) : '0';
  const correct = attempt?.correct_answers ?? 0;
  const wrong = attempt?.wrong_answers ?? 0;
  const total = attempt?.answers?.length ?? 0;

  const completedAt = attempt?.completed_at
    ? new Date(attempt.completed_at).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Could not load attempt</h2>
        <p className="text-slate-500 mb-6 text-sm">{errorMsg}</p>
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Empty (no answer records stored) ──────────────────────────────────────
  if (phase === 'empty') {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <BrainCircuit className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Review Not Available</h2>
        <p className="text-slate-500 mb-6 text-sm max-w-sm mx-auto">
          Detailed review is not available for this attempt. Answer data was not stored.
        </p>
        <button
          onClick={goBack}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
      </div>
    );
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out max-w-3xl mx-auto">

      {/* ── Back button ───────────────────────────────────────────────────── */}
      <button
        onClick={goBack}
        className="mb-6 flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-sm transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Dashboard
      </button>

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">
          Attempt Review
        </p>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
          {attempt.quiz_title || 'Quiz'}
        </h1>
        <div className="flex items-center gap-3 mt-2 text-sm text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5" />
            Attempt {attempt.attempt_number}
          </span>
          {completedAt && (
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {completedAt}
            </span>
          )}
        </div>
      </div>

      {/* ── Score card ────────────────────────────────────────────────────── */}
      <div className={`rounded-3xl p-8 mb-8 border-2 ${
        passed
          ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-200'
          : 'bg-gradient-to-br from-rose-50 to-white border-rose-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 ${
            passed ? 'bg-emerald-100' : 'bg-rose-100'
          }`}>
            {passed
              ? <Trophy className="w-10 h-10 text-emerald-500" />
              : <XCircle className="w-10 h-10 text-rose-500" />
            }
          </div>

          {/* Score */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-5xl font-extrabold text-slate-900 tracking-tight">
                {pct}%
              </span>
              <span className={`px-4 py-1.5 rounded-full font-extrabold text-sm tracking-wide ${
                passed
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-rose-100 text-rose-700'
              }`}>
                {passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Pass mark: {PASS_MARK}%
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-emerald-100/70 rounded-xl p-3.5 text-center min-w-[90px]">
              <p className="text-2xl font-extrabold text-emerald-700">{correct}</p>
              <p className="text-xs font-semibold text-emerald-600/70 mt-0.5">Correct</p>
            </div>
            <div className="bg-rose-100/70 rounded-xl p-3.5 text-center min-w-[90px]">
              <p className="text-2xl font-extrabold text-rose-700">{wrong}</p>
              <p className="text-xs font-semibold text-rose-600/70 mt-0.5">Wrong</p>
            </div>
          </div>
        </div>

        {/* Score fraction */}
        <div className="mt-5 pt-5 border-t border-black/5 flex items-center gap-2 text-sm text-slate-500 font-medium">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          Score: <span className="font-extrabold text-slate-700">{correct} / {total}</span> questions correct
        </div>
      </div>

      {/* ── Question-by-question review ───────────────────────────────────── */}
      <h2 className="text-lg font-bold text-slate-700 mb-4">
        Question-by-Question Review
      </h2>

      <div className="flex flex-col gap-5 pb-10">
        {attempt.answers.map((answer, i) => (
          <QuestionCard key={answer.question_id || i} answer={answer} index={i} />
        ))}
      </div>

    </div>
  );
}
