import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen, Sparkles, BrainCircuit, Target, CheckCircle2, ArrowRight,
  Bot, Layers, BarChart3, Users, ShieldCheck, GraduationCap, Clock,
  Flame, Award, Check, Menu, X, ChevronRight, FileText
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;

  const getDashboardRoute = () => {
    if (!user) return '/login';
    const role = user.role;
    if (role === 'SUPER_ADMIN') return '/super-admin';
    if (role === 'INSTITUTE_ADMIN') return '/institute-admin';
    if (role === 'HOD') return '/hod';
    if (role === 'FACULTY') return '/faculty';
    return '/student';
  };

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 flex flex-col font-sans">
      
      {/* ── HEADER ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-150/80 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="p-2 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-xl text-white shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-950 via-indigo-800 to-violet-800 tracking-tight">
              Academix
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-600">
            <button
              onClick={() => scrollToSection('features')}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              How it Works
            </button>
            <button
              onClick={() => scrollToSection('ai-engine')}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              AI Learning
            </button>
            <button
              onClick={() => scrollToSection('roles')}
              className="hover:text-indigo-600 transition-colors cursor-pointer"
            >
              Platform
            </button>
          </nav>

          {/* Right Action */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate(getDashboardRoute())}
                className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <Link
                to="/login"
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-1.5 active:scale-95"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Nav */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => scrollToSection('features')}
              className="block w-full text-left py-2 text-sm font-bold text-slate-700 hover:text-indigo-600"
            >
              Features
            </button>
            <button
              onClick={() => scrollToSection('how-it-works')}
              className="block w-full text-left py-2 text-sm font-bold text-slate-700 hover:text-indigo-600"
            >
              How it Works
            </button>
            <button
              onClick={() => scrollToSection('ai-engine')}
              className="block w-full text-left py-2 text-sm font-bold text-slate-700 hover:text-indigo-600"
            >
              AI Learning
            </button>
            <button
              onClick={() => scrollToSection('roles')}
              className="block w-full text-left py-2 text-sm font-bold text-slate-700 hover:text-indigo-600"
            >
              Platform
            </button>
            <div className="pt-2 border-t border-slate-100">
              <Link
                to={user ? getDashboardRoute() : '/login'}
                className="w-full flex items-center justify-center py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm"
              >
                {user ? 'Go to Dashboard' : 'Sign In to Academix'}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28 border-b border-slate-150/60 bg-gradient-to-b from-white via-indigo-50/20 to-[#fafafa]">
        {/* Subtle Decorative Background Glows */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-300/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-violet-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Copy & CTAs */}
            <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-150 text-indigo-700 text-xs font-extrabold shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Next-Gen Academic Learning & Assessment AI</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                Learn Smarter. <br />
                Assess Better. <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-700 to-violet-700">
                  Grow with AI.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Academix is an AI-powered academic platform that connects learning resources, intelligent assessments, personalized learning, and academic insights in one place.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-2">
                <Link
                  to={user ? getDashboardRoute() : '/login'}
                  className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <span>{user ? 'Go to Workspace' : 'Get Started'}</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <button
                  onClick={() => scrollToSection('features')}
                  className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm rounded-2xl border border-slate-200 shadow-2xs transition-all flex items-center justify-center gap-2 hover:border-slate-300 cursor-pointer"
                >
                  <span>Explore Platform</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 flex items-center justify-center lg:justify-start gap-6 text-xs text-slate-500 font-semibold">
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" /> Grounded Syllabus RAG
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" /> Real Multi-Attempt Tracking
                </span>
              </div>
            </div>

            {/* Right Column: Product Illustration Mockup */}
            <div className="lg:col-span-6 relative">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                {/* Background Card Shadow / Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 rounded-3xl blur-2xl -z-10" />

                {/* Main Product Illustration Container */}
                <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
                  
                  {/* Mockup Header Bar */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-150">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-rose-400" />
                      <div className="w-3 h-3 rounded-full bg-amber-400" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400" />
                      <span className="text-[11px] font-bold text-slate-400 ml-2">Academix Workspace Preview</span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md">
                      Live AI Grounding
                    </span>
                  </div>

                  {/* Grid of Micro-Widgets */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    
                    {/* 1. Assessment Metric Card */}
                    <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-150 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assessment Score</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                          ✓ Cleared
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-black text-indigo-600">82%</p>
                        <p className="text-xs font-bold text-slate-500">Attempt #3</p>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Artificial Intelligence • 17 Sep 2026
                      </p>
                    </div>

                    {/* 2. Topic Diagnostic Widget */}
                    <div className="p-4 rounded-2xl bg-slate-50/90 border border-slate-150 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Topic Diagnostic</span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full inline-flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-600" /> Weakness
                        </span>
                      </div>
                      <p className="text-sm font-black text-slate-800">#Neural Networks</p>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        AI: Focus on Backpropagation and activation function derivations.
                      </p>
                    </div>
                  </div>

                  {/* 3. AI Assistant Preview Chat Snippet */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white space-y-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-200">
                      <Bot className="w-4 h-4 text-indigo-400" />
                      <span>AI Assistant & Material Context</span>
                    </div>

                    <div className="bg-white/10 backdrop-blur-xs p-2.5 rounded-xl text-xs space-y-1 text-slate-100">
                      <p className="font-semibold text-indigo-200">Q: "Explain Neural NetworksSimply"</p>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        "Neural networks learn patterns by passing inputs through weighted layers and adjusting them using gradient descent."
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-indigo-300 pt-1">
                      <span>Source: Unit 3 Deep Learning Lecture.pdf</span>
                      <span className="bg-indigo-500/30 px-2 py-0.5 rounded text-indigo-200">RAG Grounded</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CORE FEATURES ────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 bg-white border-b border-slate-150/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything You Need to Learn Better
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              A complete ecosystem connecting coursework, intelligent testing, and personalized remedial learning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Feature 1: AI Assistant */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">AI Assistant</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Ask questions, analyze uploaded study materials, generate structured explanations, voice transcriptions, and practice questions.
              </p>
            </div>

            {/* Feature 2: AI Personalized Learning */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-violet-100/80 text-violet-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">AI Personalized Learning</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Get topic-level recommendations, worked examples, and targeted concept reviews based on your actual quiz mistakes.
              </p>
            </div>

            {/* Feature 3: Smart Assessments */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Target className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Smart Assessments</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Take quizzes, review chronological attempts, calculate "Cleared on Attempt #", and inspect question-level explanations.
              </p>
            </div>

            {/* Feature 4: Academic Resources */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-sky-100/80 text-sky-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Structured Academic Resources</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Access your complete curriculum organized cleanly from Subjects → Units → Lessons → Topics → Course Materials.
              </p>
            </div>

            {/* Feature 5: Mentor Insights */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-amber-100/80 text-amber-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Mentor Student Insights</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Mentors can view year-wise mentees, inspect academic performance dashboards, and track mistake patterns across subjects.
              </p>
            </div>

            {/* Feature 6: Academic Intelligence */}
            <div className="p-7 rounded-3xl bg-[#fafafa] border border-slate-200/80 hover:border-indigo-300 hover:shadow-md transition-all space-y-3.5 group">
              <div className="w-12 h-12 rounded-2xl bg-rose-100/80 text-rose-600 flex items-center justify-center font-bold shadow-2xs group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <BrainCircuit className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900">Closed-Loop Learning</h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Connect assessment answers directly with AI diagnostic notes and syllabus materials without synthetic or disconnected advice.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW ACADEMIX WORKS (4-STEP PROCESS) ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 bg-slate-50/60 border-b border-slate-150/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              The Learning Loop
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              How Academix Works
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              A closed-loop academic system designed to guide students from first study to verified mastery.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative">
              <span className="text-3xl font-black text-indigo-200 block">01</span>
              <h3 className="text-lg font-black text-slate-900">LEARN</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Access structured syllabus course materials, lectures, notes, and topic guides.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative">
              <span className="text-3xl font-black text-indigo-200 block">02</span>
              <h3 className="text-lg font-black text-slate-900">PRACTICE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Interact with the AI Assistant, generate practice questions, and study worked examples.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative">
              <span className="text-3xl font-black text-indigo-200 block">03</span>
              <h3 className="text-lg font-black text-slate-900">ASSESS</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Take chapter and unit quiz assessments. Track scores and attempt counts chronologically.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3 relative">
              <span className="text-3xl font-black text-indigo-200 block">04</span>
              <h3 className="text-lg font-black text-slate-900">IMPROVE</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                AI detects weak topics from actual missed questions and produces personalized remedial modules.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* ── AI ENGINE SECTION ────────────────────────────────────────────────── */}
      <section id="ai-engine" className="py-20 bg-white border-b border-slate-150/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 rounded-3xl p-8 md:p-12 text-white shadow-xl relative overflow-hidden space-y-8">
            
            {/* Decorative Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-2xl space-y-3">
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-indigo-500/30 text-indigo-200 rounded-full border border-indigo-400/30">
                Grounded Intelligence
              </span>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
                AI That Understands Your Academic Curriculum
              </h2>
              <p className="text-sm text-indigo-200 leading-relaxed">
                Academix combines syllabus materials, assessment answers, and topic performance to generate recommendations grounded in real coursework.
              </p>
            </div>

            {/* Pipeline Visual Flow */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4 text-center">
              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <FileText className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">Course Material</p>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <Target className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">Assessment</p>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <CheckCircle2 className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">Answer Data</p>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <Flame className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">Weak Topic Detection</p>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <Sparkles className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">AI Diagnosis</p>
              </div>

              <div className="p-3.5 bg-white/10 backdrop-blur-xs rounded-2xl border border-white/10 space-y-1">
                <Award className="w-5 h-5 mx-auto text-indigo-300" />
                <p className="text-xs font-bold">Verified Mastery</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── ROLE-BASED WORKSPACES ────────────────────────────────────────────── */}
      <section id="roles" className="py-20 bg-slate-50/60 border-b border-slate-150/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <span className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Role-Based Experience
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Designed for the Entire Institution
            </h2>
            <p className="text-sm sm:text-base text-slate-500">
              Dedicated, secure dashboards tailored for each academic stakeholder.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Student */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">Students</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li>• Access subject curriculum</li>
                <li>• Take quizzes & track attempts</li>
                <li>• Personalized AI Learning Hub</li>
                <li>• Interactive AI Chat Assistant</li>
              </ul>
            </div>

            {/* Faculty / Mentor */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">Faculty & Mentors</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li>• Upload study materials</li>
                <li>• Generate & manage quizzes</li>
                <li>• Year-wise mentee monitoring</li>
                <li>• Student attempt breakdown</li>
              </ul>
            </div>

            {/* HOD */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <BarChart3 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">Department HODs</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li>• Department academic visibility</li>
                <li>• Subject & curriculum creation</li>
                <li>• Faculty-student assignments</li>
                <li>• Performance aggregation</li>
              </ul>
            </div>

            {/* Admin */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-black text-slate-900">Administrators</h3>
              <ul className="text-xs text-slate-600 space-y-1.5 font-medium">
                <li>• Institutional user management</li>
                <li>• Role-based access control</li>
                <li>• AI provider configuration</li>
                <li>• Global system monitoring</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────────── */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl text-white">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base font-black text-slate-900">Academix</span>
              <p className="text-xs text-slate-400">AI-powered academic learning platform</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-bold text-slate-600">
            <button onClick={() => scrollToSection('features')} className="hover:text-indigo-600 cursor-pointer">
              Features
            </button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-indigo-600 cursor-pointer">
              How it Works
            </button>
            <button onClick={() => scrollToSection('ai-engine')} className="hover:text-indigo-600 cursor-pointer">
              AI Learning
            </button>
            <Link to="/login" className="hover:text-indigo-600">
              Sign In
            </Link>
          </div>

          <p className="text-xs text-slate-400 font-medium">
            © {new Date().getFullYear()} Academix. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
