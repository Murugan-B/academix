import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, AlertTriangle, HelpCircle, FileText, Layers, RefreshCw,
  Sparkles, Award, ArrowRight, ShieldCheck, XCircle, Info
} from 'lucide-react';
import api from '../api/axios';

export default function SyllabusCoveragePanel({ subjectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCoverage = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/academic/subjects/${subjectId}/syllabus-coverage`);
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch syllabus coverage:', err);
      setError('Unable to load syllabus coverage data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (subjectId) fetchCoverage();
  }, [subjectId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-500 h-full">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold">Calculating syllabus intelligence...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl inline-block">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <p className="text-sm font-bold text-slate-700">{error || 'No coverage data available.'}</p>
        <button
          onClick={fetchCoverage}
          className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const { overallCoverageScore, summary, units = [], actionableGaps = [], formulaDescription } = data;

  if (units.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-3xl">
          <Layers className="w-12 h-12" />
        </div>
        <h3 className="text-lg font-black text-slate-900">No Syllabus Units Created Yet</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Syllabus coverage intelligence calculates material availability and assessment readiness across units and topics. Create units and attach official materials to view coverage scores.
        </p>
        <button
          onClick={fetchCoverage}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-xl text-xs hover:bg-indigo-100 transition-colors"
        >
          Refresh Coverage
        </button>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  const getScoreBarColor = (score) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 space-y-6">
      {/* Top Metrics Banner */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/70 border border-indigo-100 rounded-3xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-100/70 px-2.5 py-1 rounded-lg">
              Syllabus Coverage Intelligence
            </span>
            <h2 className="text-2xl font-black text-slate-900 pt-1">
              Curriculum Completeness: {overallCoverageScore}%
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Deterministic calculation across materials, structured chunks, and assessment questions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className={`p-4 rounded-2xl border text-center min-w-[100px] ${getScoreColor(overallCoverageScore)}`}>
              <p className="text-3xl font-black">{overallCoverageScore}%</p>
              <p className="text-[10px] font-black uppercase tracking-wider mt-0.5">Overall</p>
            </div>
            <button
              onClick={fetchCoverage}
              className="p-3 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 rounded-2xl transition-all shadow-2xs"
              title="Refresh Coverage"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-100 h-3 rounded-full mt-5 overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${getScoreBarColor(overallCoverageScore)}`}
            style={{ width: `${overallCoverageScore}%` }}
          />
        </div>

        {/* Summary Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Units</p>
            <p className="text-lg font-black text-slate-800">{summary?.totalUnits || 0}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Topics</p>
            <p className="text-lg font-black text-slate-800">{summary?.totalTopics || 0}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
            <p className="text-[10px] font-bold uppercase text-slate-400">Covered Topics</p>
            <p className="text-lg font-black text-emerald-600">{summary?.coveredTopics || 0}</p>
          </div>
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-2xs">
            <p className="text-[10px] font-bold uppercase text-slate-400">Actionable Gaps</p>
            <p className="text-lg font-black text-rose-600">{actionableGaps.length}</p>
          </div>
        </div>
      </div>

      {/* Actionable Gaps List */}
      {actionableGaps.length > 0 && (
        <div className="bg-white border border-rose-100 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <h3 className="text-sm font-black uppercase tracking-wider">
              Attention Required: {actionableGaps.length} Curriculum Gaps
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {actionableGaps.map((gap, gIdx) => (
              <div
                key={gIdx}
                className="p-3.5 rounded-2xl border bg-rose-50/40 border-rose-200/80 flex items-start gap-3"
              >
                <div className="p-1.5 bg-rose-100 text-rose-700 rounded-xl shrink-0 mt-0.5">
                  <XCircle className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {gap.unit_title} → Topic: {gap.topic_title}
                  </p>
                  <p className="text-[11px] font-medium text-rose-700 mt-0.5">
                    {gap.issue}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unit by Unit Breakdown */}
      <div className="space-y-3">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>Unit Coverage Breakdown</span>
        </h3>

        <div className="space-y-3">
          {units.map((unit) => (
            <div
              key={unit.unit_id}
              className="bg-white border border-slate-200/80 rounded-2xl p-4.5 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    Unit {unit.unit_number}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 mt-1">{unit.unit_title}</h4>
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-base font-black px-2.5 py-1 rounded-xl border ${getScoreColor(unit.unitCoverageScore)}`}>
                    {unit.unitCoverageScore}%
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBarColor(unit.unitCoverageScore)}`}
                  style={{ width: `${unit.unitCoverageScore}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium pt-1">
                <span>{unit.coveredTopicsCount} / {unit.totalTopicsCount} Topics covered</span>
                <span>{unit.materialsCount} Materials • {unit.assessmentsCount} Assessments</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deterministic Formula Citation */}
      {formulaDescription && (
        <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex items-start gap-2.5 text-xs text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed font-medium">{formulaDescription}</p>
        </div>
      )}
    </div>
  );
}
