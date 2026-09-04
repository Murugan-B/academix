import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

let toastCount = 0;

export const toast = {
  success: (title, message) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { id: ++toastCount, type: 'success', title, message } })),
  error: (title, message) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { id: ++toastCount, type: 'error', title, message } })),
  warning: (title, message) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { id: ++toastCount, type: 'warning', title, message } })),
  info: (title, message) => window.dispatchEvent(new CustomEvent('add-toast', { detail: { id: ++toastCount, type: 'info', title, message } })),
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleAdd = (e) => {
      setToasts(prev => [...prev, e.detail]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== e.detail.id));
      }, 4000);
    };
    window.addEventListener('add-toast', handleAdd);
    return () => window.removeEventListener('add-toast', handleAdd);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto animate-in fade-in slide-in-from-top-5 duration-300 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 p-4 min-w-[300px] max-w-sm flex items-start gap-3 relative overflow-hidden group">
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${t.type === 'success' ? 'bg-emerald-500' : t.type === 'error' ? 'bg-rose-500' : t.type === 'warning' ? 'bg-amber-500' : 'bg-indigo-500'}`} />
          
          <div className="shrink-0 mt-0.5">
            {t.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
            {t.type === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
            {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
            {t.type === 'info' && <Info className="w-5 h-5 text-indigo-500" />}
          </div>
          <div className="flex-1 pr-6">
            <h4 className="text-sm font-bold text-slate-800">{t.title}</h4>
            {t.message && <p className="text-xs text-slate-500 font-medium mt-1">{t.message}</p>}
          </div>
          <button onClick={() => removeToast(t.id)} className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
