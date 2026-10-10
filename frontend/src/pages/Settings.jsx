import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Server, Database, Bot, BrainCircuit, Activity, Globe, User, Mail, Shield,
  Building, CheckCircle2, Sparkles, Sliders, DollarSign, Zap, AlertTriangle,
  History, Check, X, RefreshCw, Layers, Lock, Edit3, Save, Eye, ChevronLeft, ChevronRight
} from 'lucide-react';

export default function Settings() {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isAdmin = user && ['SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(user.role);

  const [activeTab, setActiveTab] = useState('quota'); // 'quota' | 'ledger' | 'system'
  
  // System Health
  const [health, setHealth] = useState(null);
  const [providers, setProviders] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Quota Dashboard State (Admin / User)
  const [quotaDashboard, setQuotaDashboard] = useState(null);
  const [userUsage, setUserUsage] = useState(null);
  const [quotaLoading, setQuotaLoading] = useState(true);

  // Admin Editing Quota Limits Modal/State
  const [editingCategory, setEditingCategory] = useState(null);
  const [editDailyLimit, setEditDailyLimit] = useState(50);
  const [editGlobalLimit, setEditGlobalLimit] = useState(5000);
  const [editMonthlyLimit, setEditMonthlyLimit] = useState(1000);
  const [editIsEnabled, setEditIsEnabled] = useState(true);
  const [editWarningPct, setEditWarningPct] = useState(80);
  const [updatingQuota, setUpdatingQuota] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(null);

  // Admin Ledger State
  const [ledgerRecords, setLedgerRecords] = useState([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerCategoryFilter, setLedgerCategoryFilter] = useState('');
  const [ledgerProviderFilter, setLedgerProviderFilter] = useState('');
  const [ledgerStatusFilter, setLedgerStatusFilter] = useState('');
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Multi-Key Routing Diagnostic State
  const [routingData, setRoutingData] = useState(null);
  const [healthCheckResult, setHealthCheckResult] = useState(null);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);

  useEffect(() => {
    fetchHealthData();
    fetchQuotaData();
    if (isAdmin) {
      fetchRoutingData();
    }
  }, []);

  const fetchRoutingData = async () => {
    try {
      const res = await api.get('/ai/quota/routing-config');
      setRoutingData(res.data);
    } catch (e) {
      console.warn('Failed to load routing config:', e.message);
    }
  };

  const handleRunHealthCheck = async () => {
    setRunningHealthCheck(true);
    setHealthCheckResult(null);
    try {
      const res = await api.post('/ai/quota/health-check', { model: 'auto' });
      setHealthCheckResult(res.data);
      fetchRoutingData(); // Refresh slots status after ping
    } catch (err) {
      setHealthCheckResult({
        success: false,
        healthStatus: 'FAILED',
        error: err.response?.data?.error || err.message || 'Health check ping failed'
      });
    } finally {
      setRunningHealthCheck(false);
    }
  };

  useEffect(() => {
    if (isAdmin && activeTab === 'ledger') {
      fetchLedgerData();
    }
  }, [activeTab, ledgerPage, ledgerCategoryFilter, ledgerProviderFilter, ledgerStatusFilter]);

  const fetchHealthData = async () => {
    setHealthLoading(true);
    try {
      const [healthRes, providersRes] = await Promise.all([
        api.get('/ai/health').catch(() => ({ data: null })),
        api.get('/ai/assistant/providers-status').catch(() => ({ data: null }))
      ]);
      setHealth(healthRes.data);
      setProviders(providersRes.data);
    } catch (err) {
      console.error('Failed to fetch AI health:', err);
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchQuotaData = async () => {
    setQuotaLoading(true);
    try {
      if (isAdmin) {
        const res = await api.get('/ai/quota/dashboard');
        setQuotaDashboard(res.data);
      } else {
        const res = await api.get('/ai/quota/my-usage');
        setUserUsage(res.data);
      }
    } catch (err) {
      console.error('Failed to load quota metrics:', err);
    } finally {
      setQuotaLoading(false);
    }
  };

  const fetchLedgerData = async () => {
    setLedgerLoading(true);
    try {
      const params = new URLSearchParams({
        page: ledgerPage,
        limit: 15
      });
      if (ledgerCategoryFilter) params.append('featureCategory', ledgerCategoryFilter);
      if (ledgerProviderFilter) params.append('provider', ledgerProviderFilter);
      if (ledgerStatusFilter) params.append('status', ledgerStatusFilter);

      const res = await api.get(`/ai/quota/ledger?${params.toString()}`);
      setLedgerRecords(res.data?.records || []);
      setLedgerTotal(res.data?.total || 0);
    } catch (err) {
      console.error('Failed to load usage ledger:', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const handleOpenEditQuota = (cat) => {
    setEditingCategory(cat);
    setEditDailyLimit(cat.dailyLimitPerUser || 50);
    setEditGlobalLimit(cat.globalDailyLimit || 5000);
    setEditMonthlyLimit(cat.monthlyLimitPerUser || 1000);
    setEditIsEnabled(cat.isEnabled ?? true);
    setEditWarningPct(cat.warningThresholdPct || 80);
    setUpdateSuccess(null);
  };

  const handleSaveQuotaConfig = async (e) => {
    e.preventDefault();
    if (!editingCategory) return;
    setUpdatingQuota(true);

    try {
      await api.put(`/ai/quota/configs/${editingCategory.featureCategory}`, {
        dailyLimitPerUser: parseInt(editDailyLimit, 10),
        globalDailyLimit: parseInt(editGlobalLimit, 10),
        monthlyLimitPerUser: parseInt(editMonthlyLimit, 10),
        isEnabled: Boolean(editIsEnabled),
        warningThresholdPct: parseInt(editWarningPct, 10)
      });

      setUpdateSuccess('Limits successfully updated.');
      fetchQuotaData();
      setTimeout(() => {
        setEditingCategory(null);
        setUpdateSuccess(null);
      }, 1000);
    } catch (err) {
      console.error('Failed to update quota limits:', err);
    } finally {
      setUpdatingQuota(false);
    }
  };

  const StatusDot = ({ status }) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${status === 'available' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Settings & AI Quota Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Monitor real-time AI API usage, configure independent feature limits, and inspect service telemetry.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex p-1 bg-slate-200/70 rounded-2xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('quota')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'quota' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            AI Quota & Usage
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'ledger' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Usage Ledger Log
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveTab('system')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'system' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            System Diagnostics
          </button>
        </div>
      </div>

      {/* ── USER PROFILE SUMMARY CARD ────────────────────────────────────────── */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xs border border-white p-6 space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" /> Account Profile
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</span>
            <p className="text-sm font-bold text-slate-800">{user?.name || 'Academic User'}</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
            <p className="text-sm font-bold text-slate-800 truncate" title={user?.email}>{user?.email || 'N/A'}</p>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Workspace Role</span>
            <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-black rounded-md border border-indigo-100">
              {user?.role || 'PUBLIC_USER'}
            </span>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department / Status</span>
            <p className="text-sm font-bold text-slate-800">{user?.department_name || user?.role === 'PUBLIC_USER' ? 'Public Academic Scholar' : 'Institutional Unit'}</p>
          </div>
        </div>
      </div>

      {/* ── TAB 1: AI QUOTA & USAGE DASHBOARD ─────────────────────────────────── */}
      {activeTab === 'quota' && (
        <div className="space-y-6">
          
          {/* Admin Overview Cards */}
          {isAdmin && quotaDashboard && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total AI Invocations</span>
                <span className="text-2xl font-black text-slate-900 block">{quotaDashboard.overview?.totalRequests || 0}</span>
                <span className="text-[11px] text-emerald-600 font-semibold">{quotaDashboard.overview?.requestsToday || 0} today</span>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tokens Processed</span>
                <span className="text-2xl font-black text-indigo-600 block">
                  {((quotaDashboard.overview?.totalTokens || 0) / 1000).toFixed(1)}k
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Prompt & output tokens</span>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated API Cost</span>
                <span className="text-2xl font-black text-slate-900 block">
                  ${quotaDashboard.overview?.totalCost || '0.0000'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Standard rate estimates</span>
              </div>

              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-2xs space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Success Rate</span>
                <span className="text-2xl font-black text-emerald-600 block">
                  {quotaDashboard.overview?.totalRequests > 0
                    ? `${Math.round((quotaDashboard.overview.totalSuccess / quotaDashboard.overview.totalRequests) * 100)}%`
                    : '100%'}
                </span>
                <span className="text-[11px] text-slate-400 font-medium">{quotaDashboard.overview?.totalFailures || 0} failed calls</span>
              </div>
            </div>
          )}

          {/* Feature Categories Quota Table / Grid */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xs border border-white p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-150">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <span>{isAdmin ? 'AI Feature Quotas & Configuration' : 'Your AI Usage Allowances'}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {isAdmin
                    ? 'Each AI capability maintains separate rate limits and cost controls to prevent resource exhaustion.'
                    : 'Personal daily limits reset every 24 hours at midnight UTC.'}
                </p>
              </div>

              <button
                type="button"
                onClick={fetchQuotaData}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Metrics</span>
              </button>
            </div>

            {quotaLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading quota metrics...</div>
            ) : isAdmin && quotaDashboard ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quotaDashboard.categories.map(cat => {
                  const pctUsed = cat.globalDailyLimit > 0 ? Math.min(100, Math.round((cat.todayRequests / cat.globalDailyLimit) * 100)) : 0;
                  return (
                    <div
                      key={cat.featureCategory}
                      className={`p-5 rounded-3xl border transition-all space-y-3 bg-slate-50/60 ${
                        !cat.isEnabled ? 'opacity-60 border-slate-200' : 'border-slate-200/90 hover:border-indigo-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${cat.isEnabled ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                            <h4 className="text-sm font-bold text-slate-900">{cat.featureName}</h4>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 block">{cat.featureCategory}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenEditQuota(cat)}
                          className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-indigo-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Configure</span>
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                          <span>Today: {cat.todayRequests} / {cat.globalDailyLimit} global requests</span>
                          <span>{pctUsed}%</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pctUsed >= 90 ? 'bg-rose-500' : pctUsed >= 75 ? 'bg-amber-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${pctUsed}%` }}
                          />
                        </div>
                      </div>

                      {/* Stats grid */}
                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-[10px]">
                        <div>
                          <span className="text-slate-400 block">User Limit:</span>
                          <span className="font-bold text-slate-700">{cat.dailyLimitPerUser}/day</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Tokens:</span>
                          <span className="font-bold text-slate-700">{cat.totalTokens}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Cost Est:</span>
                          <span className="font-bold text-slate-700">${cat.estimatedCost}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : userUsage ? (
              /* User View */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {userUsage.categories.map(cat => {
                  const pct = cat.dailyLimit > 0 ? Math.min(100, Math.round((cat.todayCount / cat.dailyLimit) * 100)) : 0;
                  return (
                    <div
                      key={cat.featureCategory}
                      className="p-5 rounded-3xl border border-slate-200 bg-slate-50/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900">{cat.featureName}</h4>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                          {cat.remainingToday} remaining today
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                          <span>{cat.todayCount} used</span>
                          <span>Daily limit: {cat.dailyLimit}</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Provider Breakdown Table (Admin Only) */}
          {isAdmin && quotaDashboard?.providers?.length > 0 && (
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xs border border-white p-6 space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-violet-600" />
                <span>Underlying AI Providers & Model Telemetry</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Provider</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Invocations</th>
                      <th className="p-3">Successful</th>
                      <th className="p-3">Tokens</th>
                      <th className="p-3">Estimated Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {quotaDashboard.providers.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800 capitalize">{p.provider}</td>
                        <td className="p-3 font-mono text-[11px] text-slate-700">{p.model}</td>
                        <td className="p-3">{p.requestCount}</td>
                        <td className="p-3 text-emerald-600 font-bold">{p.successCount}</td>
                        <td className="p-3">{p.tokens}</td>
                        <td className="p-3 font-mono text-slate-800">${p.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB 2: USAGE LEDGER LOG (Admin Only) ───────────────────────────────── */}
      {isAdmin && activeTab === 'ledger' && (
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xs border border-white p-6 space-y-5 animate-in fade-in">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-150">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-indigo-600" />
                <span>AI Usage Ledger (Audit Log)</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Every AI call is atomically logged without storing sensitive user prompts or document payloads.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={ledgerCategoryFilter}
                onChange={(e) => {
                  setLedgerCategoryFilter(e.target.value);
                  setLedgerPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none"
              >
                <option value="">All Categories</option>
                <option value="CONVERSATIONAL_CHAT">Conversational Chat</option>
                <option value="DOCUMENT_ANALYSIS">Document Analysis</option>
                <option value="VISION_IMAGE_ANALYSIS">Vision & Images</option>
                <option value="TEST_GENERATION">Test Generation</option>
                <option value="NOTES_GENERATION">Notes Generation</option>
              </select>

              <select
                value={ledgerStatusFilter}
                onChange={(e) => {
                  setLedgerStatusFilter(e.target.value);
                  setLedgerPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium outline-none"
              >
                <option value="">All Statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILURE">Failure</option>
              </select>
            </div>
          </div>

          {ledgerLoading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading ledger records...</div>
          ) : ledgerRecords.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400">No ledger entries match this filter.</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Feature Category</th>
                      <th className="p-3">Provider / Model</th>
                      <th className="p-3">Tokens</th>
                      <th className="p-3">Est. Cost</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {ledgerRecords.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-50/50">
                        <td className="p-3 text-[11px] text-slate-400 whitespace-nowrap">
                          {new Date(rec.created_at).toLocaleString()}
                        </td>
                        <td className="p-3 font-semibold text-slate-800">
                          {rec.user_name || rec.user_email || 'Public/Guest'}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-indigo-700">
                          {rec.feature_name || rec.feature_category}
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-slate-700 capitalize">{rec.provider}</span>
                          <span className="text-[10px] text-slate-400 block">{rec.model}</span>
                        </td>
                        <td className="p-3 font-mono">{rec.total_tokens || 0}</td>
                        <td className="p-3 font-mono text-slate-800">${rec.estimated_cost || '0.0000'}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            rec.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">Total: {ledgerTotal} log entries</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={ledgerPage === 1}
                    onClick={() => setLedgerPage(prev => Math.max(1, prev - 1))}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-700">Page {ledgerPage}</span>
                  <button
                    type="button"
                    disabled={ledgerRecords.length < 15}
                    onClick={() => setLedgerPage(prev => prev + 1)}
                    className="p-1.5 border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── TAB 3: SYSTEM & MULTI-KEY AI ROUTING DIAGNOSTICS ───────────────── */}
      {activeTab === 'system' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Main Infrastructure Status */}
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xs border border-white p-6 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-600" /> Academix AI Multi-Provider Infrastructure
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunHealthCheck}
                  disabled={runningHealthCheck}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {runningHealthCheck ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Run Live Health Ping</span>
                </button>
              </div>
            </div>

            {healthCheckResult && (
              <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
                healthCheckResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {healthCheckResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-rose-600" />}
                    Diagnostics Status: {healthCheckResult.healthStatus} ({healthCheckResult.durationMs}ms)
                  </span>
                  <span className="font-mono text-[11px]">Provider: {healthCheckResult.providerUsed} | Model: {healthCheckResult.modelUsed}</span>
                </div>
                {healthCheckResult.slotUsed && (
                  <p className="text-[11px] text-slate-600">Key Slot: <strong className="font-mono">{healthCheckResult.slotUsed}</strong></p>
                )}
                {healthCheckResult.fallbackOccurred && (
                  <p className="text-[11px] text-amber-700 font-semibold">⚡ Note: Fallback was engaged ({healthCheckResult.fallbackReason})</p>
                )}
                {healthCheckResult.error && (
                  <p className="text-[11px] text-rose-700 font-mono">{healthCheckResult.error}</p>
                )}
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-600">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Multi-Key Slots</p>
                  <p className="text-base font-black text-slate-900">
                    {routingData?.systemStatus?.gemini?.availableSlots || 0} / {routingData?.systemStatus?.gemini?.totalSlots || 0} Active
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preferred Gemini</p>
                  <p className="text-sm font-black text-slate-800 truncate" title={routingData?.systemStatus?.gemini?.preferredModel}>
                    {routingData?.systemStatus?.gemini?.preferredModel || 'gemini-2.5-flash'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-violet-100 text-violet-600">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OpenRouter Fallback</p>
                  <p className="text-sm font-black text-slate-800">
                    {routingData?.systemStatus?.openrouter?.configured ? 'Online & Configured' : 'Not Configured'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Security</p>
                  <p className="text-sm font-black text-emerald-700">Encrypted / Server-only</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gemini Key Slots Diagnostic Card Grid */}
          <div className="bg-white rounded-3xl shadow-2xs border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" /> Gemini API Key Slots & Cooldown Monitors
                </h3>
                <p className="text-xs text-slate-500">
                  Supports GEMINI_API_KEY_1, GEMINI_API_KEY_2, etc. Automatic key rotation on 429 quota exhaustion.
                </p>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">
                Concurrency Safe
              </span>
            </div>

            {(!routingData?.systemStatus?.gemini?.slots || routingData.systemStatus.gemini.slots.length === 0) ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-800">
                No Gemini API keys detected. Configure GEMINI_API_KEY_1 or GEMINI_API_KEY in backend environment.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {routingData.systemStatus.gemini.slots.map((slot) => (
                  <div
                    key={slot.slotId}
                    className={`p-4 rounded-2xl border transition-all space-y-2.5 ${
                      slot.status === 'COOLDOWN'
                        ? 'bg-amber-50/50 border-amber-200'
                        : slot.status === 'INVALID'
                        ? 'bg-rose-50/50 border-rose-200'
                        : 'bg-slate-50/60 border-slate-200 hover:border-indigo-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          slot.status === 'COOLDOWN' ? 'bg-amber-500 animate-ping' : (slot.status === 'INVALID' ? 'bg-rose-500' : 'bg-emerald-500')
                        }`} />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{slot.slotId}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        slot.status === 'COOLDOWN'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : slot.status === 'INVALID'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {slot.status === 'COOLDOWN' ? `Cooling (${slot.cooldownRemainingSeconds}s)` : slot.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-500">
                        <span>Config Slot:</span>
                        <strong className="font-mono text-slate-700">{slot.envName}</strong>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Success Count:</span>
                        <span className="font-bold text-emerald-700">{slot.successCount || 0}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Quota Exhaustions:</span>
                        <span className="font-bold text-amber-700">{slot.exhaustedCount || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fallback Hierarchy Diagram */}
          <div className="bg-white rounded-3xl shadow-2xs border border-slate-200 p-6 space-y-3">
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" /> Smart Model Routing & Fallback Order
            </h3>
            <p className="text-xs text-slate-500">
              When a user submits a request, Academix attempts the preferred model across available key slots before cascading to fallback models and providers.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="w-full sm:w-auto flex-1 p-3.5 bg-indigo-50 rounded-2xl border border-indigo-200 text-center">
                <span className="text-[10px] font-bold text-indigo-600 uppercase block">Stage 1: Primary</span>
                <span className="text-xs font-black text-indigo-900">Gemini 2.5 Flash</span>
                <span className="text-[10px] text-indigo-500 block">Round-robin across active key slots</span>
              </div>

              <span className="text-slate-300 font-black text-sm">➔</span>

              <div className="w-full sm:w-auto flex-1 p-3.5 bg-blue-50 rounded-2xl border border-blue-200 text-center">
                <span className="text-[10px] font-bold text-blue-600 uppercase block">Stage 2: Gemini Fallback</span>
                <span className="text-xs font-black text-blue-900">Gemini 2.0 / 1.5 Flash</span>
                <span className="text-[10px] text-blue-500 block">Candidate model rotation</span>
              </div>

              <span className="text-slate-300 font-black text-sm">➔</span>

              <div className="w-full sm:w-auto flex-1 p-3.5 bg-violet-50 rounded-2xl border border-violet-200 text-center">
                <span className="text-[10px] font-bold text-violet-600 uppercase block">Stage 3: Provider Failover</span>
                <span className="text-xs font-black text-violet-900">OpenRouter AI</span>
                <span className="text-[10px] text-violet-500 block">Llama 3.3 / Qwen / Claude / Vision</span>
              </div>

              <span className="text-slate-300 font-black text-sm">➔</span>

              <div className="w-full sm:w-auto flex-1 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Stage 4: Graceful</span>
                <span className="text-xs font-black text-slate-800">Friendly Retry Notice</span>
                <span className="text-[10px] text-slate-400 block">Grounded Search fallback</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ── ADMIN CONFIGURE QUOTA LIMITS MODAL ─────────────────────────────────── */}
      {editingCategory && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Configure Limits: {editingCategory.featureName}</h3>
                <span className="text-[10px] font-mono text-slate-400">{editingCategory.featureCategory}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {updateSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>{updateSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveQuotaConfig} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Daily Limit Per User</label>
                <input
                  type="number"
                  min={1}
                  value={editDailyLimit}
                  onChange={(e) => setEditDailyLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Global Daily Request Cap</label>
                <input
                  type="number"
                  min={10}
                  value={editGlobalLimit}
                  onChange={(e) => setEditGlobalLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Monthly Limit Per User</label>
                <input
                  type="number"
                  min={10}
                  value={editMonthlyLimit}
                  onChange={(e) => setEditMonthlyLimit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Feature Enabled</span>
                  <span className="text-[10px] text-slate-400">Allow users to invoke this AI capability</span>
                </div>
                <input
                  type="checkbox"
                  checked={editIsEnabled}
                  onChange={(e) => setEditIsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCategory(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={updatingQuota}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {updatingQuota ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Configuration</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
