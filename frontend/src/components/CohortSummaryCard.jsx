import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, Sparkles, ArrowRight, Layers, CheckCircle2, Loader2 } from 'lucide-react';
import api from '../api/axios';

/**
 * CohortSummaryCard
 * Compact summary widget displayed on HOD and Faculty dashboards.
 * Directs faculty/HOD to the full dedicated /cohort-learning-gaps workspace.
 */
export default function CohortSummaryCard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/cohort/learning-gaps')
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Cohort summary widget error:', err);
        setLoading(false);
      });
  }, []);

  const summary = data?.summary || {
    totalTopics: 0,
    learningGaps: 0,
    needsAttention: 0,
    strongTopics: 0,
    cohortAccuracy: 0
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-indigo-50/80 hover:shadow-[0_8px_30px_rgb(99,102,241,0.08)] transition-all relative overflow-hidden">
      
      {/* Ambient background glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 relative z-10">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-rose-500 to-indigo-600 rounded-2xl text-white shadow-md shadow-rose-200/50">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Cohort Learning Gaps</h3>
              <span className="px-2 py-0.5 bg-rose-50 border border-rose-200/60 text-rose-700 text-[10px] font-black uppercase rounded-full">
                Intelligence
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Identifies struggling curriculum concepts & synthesized remedial packages
            </p>
          </div>
        </div>

        <Link
          to="/cohort-learning-gaps"
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-100 inline-flex items-center justify-center gap-2 transition-all group shrink-0"
        >
          <span>View Cohort Learning Gaps</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-slate-400 gap-2 text-xs font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          <span>Analyzing departmental cohort performance...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
          
          {/* Learning Gaps */}
          <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-100/80">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 block mb-1">
              Learning Gaps
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-rose-900">{summary.learningGaps}</span>
              <span className="text-[10px] text-rose-600 font-bold">Topics (&lt;50%)</span>
            </div>
          </div>

          {/* Needs Attention */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-100/80">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 block mb-1">
              Needs Attention
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-900">{summary.needsAttention}</span>
              <span className="text-[10px] text-amber-600 font-bold">Topics (50-70%)</span>
            </div>
          </div>

          {/* Strong Topics */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100/80">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block mb-1">
              Strong Topics
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-900">{summary.strongTopics}</span>
              <span className="text-[10px] text-emerald-600 font-bold">Topics (≥70%)</span>
            </div>
          </div>

          {/* Cohort Average */}
          <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100/80">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 block mb-1">
              Cohort Average
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-indigo-900">{summary.cohortAccuracy}%</span>
              <span className="text-[10px] text-indigo-600 font-bold">Accuracy</span>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
