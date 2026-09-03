import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { LogOut, BookOpen, Users, Settings, LayoutDashboard, BookText } from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role || 'STUDENT';

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

  return (
    <div className="flex h-screen bg-[#f8fafc] selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar with Glassmorphism */}
      <aside className="w-72 bg-white/60 backdrop-blur-2xl border-r border-indigo-50/50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] hidden md:flex md:flex-col relative z-20">
        <div className="p-8 border-b border-indigo-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl shadow-lg shadow-indigo-200">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-800 tracking-tight">
              Academix
            </h2>
          </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-3 overflow-y-auto">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 ml-2">Menu</div>
          
          <Link 
            to={getDashboardRoute()} 
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border ${currentPath === getDashboardRoute() ? 'text-indigo-700 bg-indigo-50/80 font-semibold shadow-sm border-indigo-100/50 hover:shadow-md hover:bg-indigo-50' : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-sm border-transparent hover:border-slate-100'}`}
          >
            <LayoutDashboard className={`w-5 h-5 transition-transform duration-300 ${currentPath === getDashboardRoute() ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'}`} />
            Dashboard
          </Link>
          
          {role !== 'STUDENT' && (
            <Link 
              to="/users" 
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border ${currentPath === '/users' ? 'text-indigo-700 bg-indigo-50/80 font-semibold shadow-sm border-indigo-100/50 hover:shadow-md hover:bg-indigo-50' : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-sm border-transparent hover:border-slate-100'}`}
            >
              <Users className={`w-5 h-5 transition-transform duration-300 ${currentPath === '/users' ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'}`} />
              Users & Roles
            </Link>
          )}

          {['HOD', 'FACULTY', 'STUDENT'].includes(role) && (
            <Link 
              to="/subjects" 
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border ${currentPath === '/subjects' ? 'text-indigo-700 bg-indigo-50/80 font-semibold shadow-sm border-indigo-100/50 hover:shadow-md hover:bg-indigo-50' : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-sm border-transparent hover:border-slate-100'}`}
            >
              <BookText className={`w-5 h-5 transition-transform duration-300 ${currentPath === '/subjects' ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'}`} />
              Subjects
            </Link>
          )}
          
          <Link 
            to="/settings" 
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all group border ${currentPath === '/settings' ? 'text-indigo-700 bg-indigo-50/80 font-semibold shadow-sm border-indigo-100/50 hover:shadow-md hover:bg-indigo-50' : 'text-slate-600 hover:text-indigo-700 hover:bg-white/80 font-medium hover:shadow-sm border-transparent hover:border-slate-100'}`}
          >
            <Settings className={`w-5 h-5 transition-transform duration-300 ${currentPath === '/settings' ? 'text-indigo-600 scale-110' : 'text-slate-400 group-hover:text-indigo-500 group-hover:scale-110'}`} />
            Settings
          </Link>
        </nav>

        <div className="p-6 border-t border-indigo-50/50 bg-white/30">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full text-slate-600 hover:text-rose-600 hover:bg-rose-50/80 rounded-xl font-medium transition-all group border border-transparent hover:border-rose-100"
          >
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-rose-500 group-hover:-translate-x-1 transition-all duration-300" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative">
        {/* Subtle animated background blobs */}
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-50/50 to-transparent -z-10" />
        <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-violet-200/30 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[20%] left-[-5%] w-72 h-72 bg-indigo-200/30 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '10s' }} />

        <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-30 p-4 flex justify-between items-center md:hidden border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-lg">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-violet-800">
              Academix
            </h2>
          </div>
        </header>
        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
