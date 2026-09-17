import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import {
  BookOpen, Eye, EyeOff, ArrowLeft, Sparkles, CheckCircle2, Lock, Mail,
  BrainCircuit, Target
} from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      
      const role = res.data.user?.role;
      if (role === 'SUPER_ADMIN') navigate('/super-admin');
      else if (role === 'INSTITUTE_ADMIN') navigate('/institute-admin');
      else if (role === 'HOD') navigate('/hod');
      else if (role === 'FACULTY') navigate('/faculty');
      else if (role === 'STUDENT') navigate('/student');
      else navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Invalid credentials or login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between selection:bg-indigo-100 selection:text-indigo-900 font-sans relative overflow-hidden">
      
      {/* Background Decorative Glows */}
      <div className="absolute top-0 right-1/3 w-96 h-96 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-violet-200/25 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar */}
      <header className="px-6 py-4 max-w-7xl w-full mx-auto flex items-center justify-between relative z-10">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="p-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-xl text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-800 tracking-tight">
            Academix
          </span>
        </Link>

        <Link
          to="/"
          className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* Main Login Viewport */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 relative z-10">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Hero Panel (Desktop) */}
          <div className="hidden lg:block lg:col-span-6 space-y-6 pr-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-700 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Academic Workspace</span>
            </div>

            <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
              Welcome back to <br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                Academix.
              </span>
            </h1>

            <p className="text-sm text-slate-600 leading-relaxed">
              Continue your academic journey with AI-powered personalized learning, smart assessments, and course intelligence.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-150 shadow-2xs">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-800">Personalized Learning Hub</h2>
                  <p className="text-[11px] text-slate-500">Targeted topic guidance from actual quiz mistakes</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-150 shadow-2xs">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-slate-800">Grounded AI Assistant</h2>
                  <p className="text-[11px] text-slate-500">Curriculum context and lecture material analysis</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sign In Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 space-y-6">
              
              {/* Card Header */}
              <div className="space-y-1">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Sign in to Academix</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Enter your credentials to access your academic workspace
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl animate-in fade-in">
                  {error}
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="student@academix.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50/70 border border-slate-200 rounded-xl pl-10 pr-10 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              {/* Disclaimer */}
              <div className="pt-2 border-t border-slate-100 text-center space-y-2">
                <p className="text-[11px] text-slate-400">
                  Your authenticated role automatically determines your Academix workspace.
                </p>
                <div>
                  <Link
                    to="/"
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                  >
                    ← Back to Academix Public Page
                  </Link>
                </div>
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 relative z-10">
        © {new Date().getFullYear()} Academix Academic Platform. All rights reserved.
      </footer>
    </div>
  );
}
