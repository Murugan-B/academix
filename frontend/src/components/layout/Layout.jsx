import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LogOut, BookOpen, Users, Settings, LayoutDashboard, BookText, Bot, Sparkles,
  PanelLeftClose, PanelLeftOpen, Menu, X, FolderHeart, CheckSquare, Search, AlertTriangle
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
    if (role === 'PUBLIC_USER') return '/my-hub';
    return '/student';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const isFullScreen = currentPath === '/ai-assistant';

  const [searchNavQuery, setSearchNavQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);

  // Grouped Navigation Items with metadata for fast search
  const navLinks = [
    {
      to: '/my-hub',
      label: 'My Hub',
      description: 'Personal study space, recent activity & bookmarks',
      category: 'PAGES',
      icon: LayoutDashboard,
      show: role === 'PUBLIC_USER',
      active: currentPath === '/my-hub' || currentPath === '/public-hub'
    },
    {
      to: getDashboardRoute(),
      label: 'Dashboard',
      description: 'Overview, departmental metrics & approvals',
      category: 'PAGES',
      icon: LayoutDashboard,
      show: role !== 'PUBLIC_USER',
      active: currentPath === getDashboardRoute()
    },
    {
      to: '/public-search',
      label: 'Global Search & AI',
      description: 'Search approved open notes, web & multimodal AI',
      category: 'SEARCH',
      icon: Search,
      show: true,
      active: currentPath === '/public-search'
    },
    {
      to: '/public-library',
      label: 'Public Academic Notes',
      description: 'Structured community course folders, videos & notes',
      category: 'ACADEMIC',
      icon: BookOpen,
      show: true,
      active: currentPath === '/public-library'
    },
    {
      to: '/ai-test-generator',
      label: 'AI Test Generator',
      description: 'Generate adaptive practice tests with automatic grading',
      category: 'ACADEMIC',
      icon: Sparkles,
      show: true,
      active: currentPath === '/ai-test-generator'
    },
    {
      to: '/my-notes',
      label: 'My Notes',
      description: 'Personal study notes, revision guides & AI notes',
      category: 'ACADEMIC',
      icon: BookText,
      show: true,
      active: currentPath === '/my-notes'
    },
    {
      to: '/saved-materials',
      label: 'Saved Materials',
      description: 'Bookmarked peer resources and video lectures',
      category: 'ACADEMIC',
      icon: FolderHeart,
      show: true,
      active: currentPath === '/saved-materials'
    },
    {
      to: '/my-contributions',
      label: 'My Contributions',
      description: 'Track review status of your public submissions',
      category: 'ACADEMIC',
      icon: CheckSquare,
      show: true,
      active: currentPath === '/my-contributions'
    },
    {
      to: '/subjects',
      label: 'Subjects',
      description: 'Curriculum structure, units, lessons & materials',
      category: 'ACADEMIC',
      icon: BookText,
      show: ['HOD', 'FACULTY', 'STUDENT'].includes(role),
      active: currentPath === '/subjects'
    },
    {
      to: '/student-resources',
      label: 'Student Resources',
      description: 'Shared peer notes & community study materials',
      category: 'ACADEMIC',
      icon: FolderHeart,
      show: ['HOD', 'FACULTY', 'STUDENT'].includes(role),
      active: currentPath === '/student-resources'
    },
    {
      to: '/ai-assistant',
      label: 'AI Assistant',
      description: 'Ask questions and analyze academic materials with citations',
      category: 'ACADEMIC',
      icon: Bot,
      show: ['HOD', 'FACULTY', 'STUDENT', 'SUPER_ADMIN', 'INSTITUTE_ADMIN'].includes(role),
      active: currentPath === '/ai-assistant'
    },
    {
      to: '/ai-learning',
      label: 'AI Learning',
      description: 'Personalized practice & prerequisite diagnosis',
      category: 'ACADEMIC',
      icon: Sparkles,
      show: role === 'STUDENT',
      active: currentPath === '/ai-learning'
    },
    {
      to: '/cohort-learning-gaps',
      label: 'Cohort Learning Gaps',
      description: 'Departmental gap diagnosis, topic weaknesses & remedial plans',
      category: 'ACADEMIC',
      icon: AlertTriangle,
      show: ['HOD', 'FACULTY', 'INSTITUTE_ADMIN'].includes(role),
      active: currentPath === '/cohort-learning-gaps'
    },
    {
      to: '/resource-approvals',
      label: 'Resource Approvals',
      description: 'Review and approve peer-submitted student notes',
      category: 'ADMINISTRATION',
      icon: CheckSquare,
      show: ['FACULTY', 'HOD', 'INSTITUTE_ADMIN'].includes(role),
      active: currentPath === '/resource-approvals'
    },
    {
      to: '/users',
      label: 'Users & Roles',
      description: 'Manage faculty, mentors and student accounts',
      category: 'ADMINISTRATION',
      icon: Users,
      show: !['STUDENT', 'PUBLIC_USER'].includes(role),
      active: currentPath === '/users'
    },
    {
      to: '/settings',
      label: 'Settings & Quotas',
      description: 'Profile settings & AI Quota management',
      category: 'PAGES',
      icon: Settings,
      show: true,
      active: currentPath === '/settings'
    }
  ];

  // Filtered Navigation based on Role and Search Query
  const authorizedNavLinks = navLinks.filter(n => n.show);
  const searchResults = searchNavQuery.trim()
    ? authorizedNavLinks.filter(n =>
        n.label.toLowerCase().includes(searchNavQuery.toLowerCase()) ||
        n.description.toLowerCase().includes(searchNavQuery.toLowerCase()) ||
        n.category.toLowerCase().includes(searchNavQuery.toLowerCase())
      )
    : authorizedNavLinks;

  // Global Keyboard Shortcut: Ctrl+K or / to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        searchInputRef.current?.focus();
      } else if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (isSidebarCollapsed) setIsSidebarCollapsed(false);
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchNavQuery('');
        searchInputRef.current?.blur();
        setIsSearchFocused(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarCollapsed]);

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

        {/* Mobile Navigation Search */}
        <div className="p-4 border-b border-indigo-50/80">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchNavQuery}
              onChange={(e) => setSearchNavQuery(e.target.value)}
              placeholder="Search pages..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchNavQuery && (
              <button
                onClick={() => setSearchNavQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto custom-scrollbar">
          {searchResults.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No matching pages found.</p>
          ) : (
            searchResults.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link
                  key={idx}
                  to={item.to}
                  onClick={() => {
                    setIsMobileNavOpen(false);
                    setSearchNavQuery('');
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm border ${
                    item.active
                      ? 'text-indigo-700 bg-indigo-50/90 font-bold border-indigo-100'
                      : 'text-slate-600 hover:text-indigo-700 hover:bg-slate-50 border-transparent'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${item.active ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <div className="min-w-0">
                    <p className="truncate">{item.label}</p>
                    {searchNavQuery && (
                      <p className="text-[10px] text-slate-400 font-normal truncate">{item.description}</p>
                    )}
                  </div>
                </Link>
              );
            })
          )}
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

        {/* Global Navigation Search Bar */}
        {!isSidebarCollapsed ? (
          <div className="px-5 pt-4 pb-1">
            <div className="relative group">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-600 transition-colors" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchNavQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                onChange={(e) => setSearchNavQuery(e.target.value)}
                placeholder="Search pages..."
                className="w-full bg-slate-50/80 hover:bg-slate-100/80 focus:bg-white border border-slate-200/80 focus:border-indigo-300 rounded-xl pl-8 pr-12 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {searchNavQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchNavQuery('')}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-bold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2 flex justify-center">
            <button
              onClick={() => {
                setIsSidebarCollapsed(false);
                setTimeout(() => searchInputRef.current?.focus(), 100);
              }}
              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-xl transition-all"
              title="Search pages (Ctrl+K)"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Nav Links */}
        <nav className={`flex-1 overflow-y-auto space-y-1.5 custom-scrollbar transition-all ${
          isSidebarCollapsed ? 'p-3 flex flex-col items-center' : 'p-5'
        }`}>
          {!isSidebarCollapsed && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 ml-2 flex items-center justify-between">
              <span>{searchNavQuery ? `Search Results (${searchResults.length})` : 'Menu'}</span>
              {searchNavQuery && (
                <button
                  type="button"
                  onClick={() => setSearchNavQuery('')}
                  className="text-indigo-600 hover:underline normal-case text-[10px]"
                >
                  Clear
                </button>
              )}
            </div>
          )}

          {searchResults.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No accessible pages match "{searchNavQuery}".
            </div>
          ) : (
            searchResults.map((item, idx) => {
              const Icon = item.icon;
              return (
                <Link 
                  key={idx}
                  to={item.to}
                  onClick={() => setSearchNavQuery('')}
                  className={`flex items-center rounded-xl transition-all group border ${
                    isSidebarCollapsed 
                      ? 'justify-center p-3 w-12 h-12' 
                      : 'gap-3 px-3.5 py-2.5 w-full'
                  } ${
                    item.active 
                      ? 'text-indigo-700 bg-indigo-50/90 font-semibold shadow-xs border-indigo-150/70' 
                      : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-xs border-transparent hover:border-slate-100'
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-300 shrink-0 ${
                    item.active 
                      ? 'text-indigo-600 scale-110' 
                      : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'
                  }`} />
                  {!isSidebarCollapsed && (
                    <div className="min-w-0">
                      <span className="truncate text-xs font-bold block">{item.label}</span>
                      {searchNavQuery && (
                        <span className="text-[10px] text-slate-400 font-normal truncate block leading-tight">
                          {item.description}
                        </span>
                      )}
                    </div>
                  )}
                </Link>
              );
            })
          )}
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
