import { useState } from 'react';
import { Outlet, useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LogOut, BookOpen, Users, Settings, LayoutDashboard, BookText, Bot, Sparkles,
  PanelLeftClose, PanelLeftOpen, Menu, X
} from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  const userStr = localStorage.getItem('user');
  const token = localStorage.getItem('token');
  const user = (userStr && token) ? JSON.parse(userStr) : null;
  const role = user?.role || 'STUDENT';

  // Persistent main application sidebar state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('academix_sidebar_collapsed') === 'true';
  });
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Authentication guard
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('academix_sidebar_collapsed', String(next));
      return next;
    });
  };

  const getDashboardRoute = () => {
    if (role === 'SUPER_ADMIN') return '/super-admin';
    if (role === 'INSTITUTE_ADMIN') return '/institute-admin';
    if (role === 'HOD') return '/hod';
    if (role === 'FACULTY') return '/faculty';
    return '/student';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const isFullScreen = currentPath === '/ai-assistant';

  const navLinks = [
    {
      to: getDashboardRoute(),
      label: 'Dashboard',
      icon: LayoutDashboard,
      show: true,
      active: currentPath === getDashboardRoute()
    },
    {
      to: '/ai-assistant',
      label: 'AI Assistant',
      icon: Bot,
      show: true,
      active: currentPath === '/ai-assistant'
    },
    {
      to: '/ai-learning',
      label: 'AI Learning',
      icon: Sparkles,
      show: role === 'STUDENT',
      active: currentPath === '/ai-learning'
    },
    {
      to: '/users',
      label: 'Users & Roles',
      icon: Users,
      show: role !== 'STUDENT',
      active: currentPath === '/users'
    },
    {
      to: '/subjects',
      label: 'Subjects',
      icon: BookText,
      show: ['HOD', 'FACULTY', 'STUDENT'].includes(role),
      active: currentPath === '/subjects'
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: Settings,
      show: true,
      active: currentPath === '/settings'
    }
  ];

  return (
    <div className="flex h-screen bg-[#f4f6fc] selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative font-sans">
      
      {/* GLOBAL VISIBLE AMBIENT BACKGROUND SYSTEM */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden academix-ambient-bg">
        {/* Soft diffused Top-Left Purple Glow */}
        <div className="absolute -top-28 -left-28 w-[680px] h-[680px] bg-purple-500/14 rounded-full blur-[130px] pointer-events-none" />
        
        {/* Soft diffused Top-Right Lavender / Indigo Glow */}
        <div className="absolute -top-20 -right-20 w-[720px] h-[720px] bg-indigo-500/12 rounded-full blur-[140px] pointer-events-none" />
        
        {/* Soft diffused Bottom-Right Cool Sky / Blue Glow */}
        <div className="absolute -bottom-28 -right-24 w-[760px] h-[760px] bg-sky-400/12 rounded-full blur-[140px] pointer-events-none" />

        {/* Soft diffused Bottom-Left Lavender Glow */}
        <div className="absolute -bottom-28 -left-24 w-[620px] h-[620px] bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Ultra-subtle Micro Dot Grid for SaaS Texture */}
        <div className="absolute inset-0 academix-dot-pattern opacity-35 pointer-events-none" />
      </div>

      {/* MOBILE BACKDROP */}
      {isMobileNavOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsMobileNavOpen(false)}
        />
      )}

      {/* MOBILE DRAWER SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 backdrop-blur-xl border-r border-indigo-100/60 shadow-2xl flex flex-col transition-transform duration-300 md:hidden ${
        isMobileNavOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="p-6 border-b border-indigo-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-md text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-800">
              Academix
            </h2>
          </div>
          <button 
            onClick={() => setIsMobileNavOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navLinks.filter(n => n.show).map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={idx}
                to={item.to}
                onClick={() => setIsMobileNavOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border ${
                  item.active
                    ? 'text-indigo-700 bg-indigo-50/90 font-bold border-indigo-100'
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-slate-50 border-transparent'
                }`}
              >
                <Icon className={`w-5 h-5 ${item.active ? 'text-indigo-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-indigo-50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl font-medium transition-all"
          >
            <LogOut className="w-5 h-5 text-slate-400" />
            Logout
          </button>
        </div>
      </aside>

      {/* DESKTOP MAIN APPLICATION SIDEBAR */}
      <aside className={`bg-white/80 backdrop-blur-2xl border-r border-indigo-100/60 shadow-[4px_0_24px_rgba(0,0,0,0.02)] hidden md:flex md:flex-col relative z-20 shrink-0 transition-all duration-300 ${
        isSidebarCollapsed ? 'w-20' : 'w-72'
      }`}>
        {/* Header with Logo + Collapse Toggle */}
        <div className={`border-b border-indigo-100/60 transition-all ${
          isSidebarCollapsed ? 'p-4 flex flex-col items-center gap-3' : 'p-6 flex items-center justify-between'
        }`}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-200 shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            {!isSidebarCollapsed && (
              <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-800 tracking-tight whitespace-nowrap">
                Academix
              </h2>
            )}
          </div>

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all"
            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {/* Nav Links */}
        <nav className={`flex-1 overflow-y-auto space-y-2 custom-scrollbar transition-all ${
          isSidebarCollapsed ? 'p-3 flex flex-col items-center' : 'p-6'
        }`}>
          {!isSidebarCollapsed && (
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-2">Menu</div>
          )}
          
          {navLinks.filter(n => n.show).map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link 
                key={idx}
                to={item.to}
                className={`flex items-center rounded-xl transition-all group border ${
                  isSidebarCollapsed 
                    ? 'justify-center p-3 w-12 h-12' 
                    : 'gap-3 px-4 py-3.5 w-full'
                } ${
                  item.active 
                    ? 'text-indigo-700 bg-indigo-50/90 font-semibold shadow-xs border-indigo-150/70' 
                    : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-xs border-transparent hover:border-slate-100'
                }`}
                title={isSidebarCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 transition-transform duration-300 shrink-0 ${
                  item.active 
                    ? 'text-indigo-600 scale-110' 
                    : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'
                }`} />
                {!isSidebarCollapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer Logout */}
        <div className={`border-t border-indigo-100/60 bg-white/40 transition-all ${
          isSidebarCollapsed ? 'p-3 flex justify-center' : 'p-6'
        }`}>
          <button 
            onClick={handleLogout}
            className={`flex items-center text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl font-medium transition-all group border border-transparent hover:border-rose-100 ${
              isSidebarCollapsed ? 'justify-center p-3 w-12 h-12' : 'gap-3 px-4 py-3 w-full'
            }`}
            title={isSidebarCollapsed ? "Logout" : undefined}
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-500 group-hover:-translate-x-1 transition-all duration-300 shrink-0" />
            {!isSidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 flex flex-col relative h-full ${isFullScreen ? 'overflow-hidden' : 'overflow-auto'}`}>
        {/* Mobile Top Header */}
        <header className="bg-white/90 backdrop-blur-md shadow-xs sticky top-0 z-30 p-4 flex justify-between items-center md:hidden border-b border-slate-150 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileNavOpen(true)}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-800">
                Academix
              </h2>
            </div>
          </div>
        </header>

        {isFullScreen ? (
          <div className="flex-1 w-full h-full overflow-hidden">
            <Outlet />
          </div>
        ) : (
          <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-h-full w-full">
            <Outlet />
          </div>
        )}
      </main>
    </div>
  );
}
