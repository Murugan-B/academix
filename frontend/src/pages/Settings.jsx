import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Server, Database, Bot, BrainCircuit, Activity, Globe, User, Mail, Shield,
  Building, CheckCircle2, Sparkles
} from 'lucide-react';

export default function Settings() {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const [health, setHealth] = useState(null);
  const [providers, setProviders] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const [healthRes, providersRes] = await Promise.all([
          api.get('/ai/health'),
          api.get('/ai/assistant/providers-status').catch(() => ({ data: null }))
        ]);
        setHealth(healthRes.data);
        setProviders(providersRes.data);
      } catch (err) {
        console.error('Failed to fetch AI health', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchHealth();
  }, []);

  const StatusDot = ({ status }) => (
    <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${status === 'available' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
  );

  return (
    <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Settings & Workspace</h1>
        <p className="text-xs md:text-sm text-slate-500 font-medium mt-0.5">
          View your active session credentials, institutional profile, and AI layer diagnostics.
        </p>
      </div>

      {/* Account & Profile Summary Card */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white p-6 space-y-4">
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
              {user?.role || 'STUDENT'}
            </span>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department / Status</span>
            <p className="text-sm font-bold text-slate-800">{user?.department_name || user?.department_id || 'Academic Unit'}</p>
          </div>
        </div>
      </div>

      {/* AI Service Layer & Diagnostics */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-white p-6 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-indigo-600" /> Academix AI Intelligence Engine
          </h2>
          <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
            RAG & Inference Pipeline
          </span>
        </div>

        {loading ? (
          <div className="py-8 text-center text-xs font-semibold text-slate-400">
            Pinging AI Service Layer...
          </div>
        ) : health ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Status */}
              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className={`p-2.5 rounded-xl ${health.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Status</p>
                  <p className={`text-base font-black ${health.status === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {health.status === 'ok' ? 'Online & Operational' : 'Offline'}
                  </p>
                </div>
              </div>

              {/* Provider */}
              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Provider</p>
                  <p className="text-base font-black text-slate-800 capitalize">{health.provider}</p>
                </div>
              </div>

              {/* Model */}
              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Inference</p>
                  <p className="text-base font-black text-slate-800 truncate" title={health.model}>{health.model}</p>
                </div>
              </div>

              {/* Vector DB */}
              <div className="flex items-center gap-3.5 bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                <div className="p-2.5 rounded-xl bg-purple-100 text-purple-600">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Knowledge Base</p>
                  <p className="text-base font-black text-slate-800">
                    {health.indexedMaterials} <span className="text-xs font-normal text-slate-500">Materials Indexed</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Provider availability grid */}
            {providers && (
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available AI Models & Endpoints</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 max-w-2xl">
                  {Object.entries(providers).map(([key, info]) => (
                    <div key={key} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {key === 'openrouter' ? <Globe className="w-4 h-4 text-violet-500" /> : <Bot className="w-4 h-4 text-indigo-500" />}
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">{info.label || key}</span>
                          {key === 'openrouter' && info.model && (
                            <span className="text-[10px] text-slate-400 font-medium block truncate max-w-[200px]">{info.model}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center text-xs font-bold">
                        <StatusDot status={info.status} />
                        <span className={info.status === 'available' ? 'text-emerald-700' : 'text-slate-400'}>
                          {info.status === 'available' ? 'Active' : 'Unavailable'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-rose-600 font-bold">Unable to connect to the AI service layer.</p>
        )}
      </div>
    </div>
  );
}
