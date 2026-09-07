import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Server, Database, Bot, BrainCircuit, Activity, Globe } from 'lucide-react';

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
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
      <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">Settings</h1>
      <p className="text-slate-500 font-medium mb-10">Configure your application preferences.</p>
      
      {['SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(user?.role) && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-indigo-500" /> Academix AI Status
          </h2>
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-6">
            {loading ? (
              <p className="text-slate-400">Pinging AI Service...</p>
            ) : health ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  
                  {/* Status */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className={`p-3 rounded-xl ${health.status === 'ok' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</p>
                      <p className={`text-lg font-bold ${health.status === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {health.status === 'ok' ? 'Online' : 'Offline'}
                      </p>
                    </div>
                  </div>

                  {/* Provider */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
                      <Server className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Default Provider</p>
                      <p className="text-lg font-bold text-slate-700 capitalize">{health.provider}</p>
                    </div>
                  </div>

                  {/* Model */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
                      <Bot className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Inference Model</p>
                      <p className="text-lg font-bold text-slate-700">{health.model}</p>
                    </div>
                  </div>

                  {/* Vector DB */}
                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
                      <Database className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Knowledge Base</p>
                      <p className="text-lg font-bold text-slate-700">
                        {health.indexedMaterials} <span className="text-sm font-normal text-slate-500">materials</span>
                      </p>
                      <p className="text-xs text-slate-400">{health.vectorChunks} vector chunks indexed</p>
                    </div>
                  </div>

                </div>

                {/* Provider availability grid */}
                {providers && (
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Provider Availability</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {Object.entries(providers).map(([key, info]) => (
                        <div key={key} className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            {key === 'openrouter' ? <Globe className="w-4 h-4 text-violet-500" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                            <span className="text-xs font-bold text-slate-600">{info.label || key}</span>
                          </div>
                          <div className="flex items-center">
                            <StatusDot status={info.status} />
                            <span className={`text-xs font-bold ${info.status === 'available' ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {info.status === 'available' ? 'Available' : 'Not configured'}
                            </span>
                          </div>
                          {key === 'openrouter' && info.model && (
                            <p className="text-xs text-slate-400 mt-1 truncate">{info.model}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-rose-500 font-medium">Unable to connect to the AI service layer.</p>
            )}
          </div>
        </div>
      )}

      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8">
        <p className="text-slate-500">Other global settings will be displayed here.</p>
      </div>
    </div>
  );
}


