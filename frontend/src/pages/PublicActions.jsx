import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, BookOpen, BookText, FolderHeart, Sparkles, CheckSquare,
  ChevronRight, UploadCloud, Globe, X, Compass, ExternalLink,
  Layers, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import api from '../api/axios';
import AddPublicMaterialModal from '../components/AddPublicMaterialModal';

export default function PublicActions() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [stats, setStats] = useState({
    notesCount: null,
    savedCount: null,
    contributionsCount: null
  });

  useEffect(() => {
    document.title = 'Public Actions | Academix';
    fetchQuickStats();
  }, []);

  const fetchQuickStats = async () => {
    try {
      const [notesRes, savedRes, contribRes] = await Promise.allSettled([
        api.get('/public/notes'),
        api.get('/public/saved-resources'),
        api.get('/public/my-contributions')
      ]);

      setStats({
        notesCount: notesRes.status === 'fulfilled' && Array.isArray(notesRes.value?.data) ? notesRes.value.data.length : null,
        savedCount: savedRes.status === 'fulfilled' && Array.isArray(savedRes.value?.data) ? savedRes.value.data.length : null,
        contributionsCount: contribRes.status === 'fulfilled' && Array.isArray(contribRes.value?.data) ? contribRes.value.data.length : null
      });
    } catch {
      // Non-blocking background fetch
    }
  };

  // Structured action cards grouped by category, matching the reference layout
  const categories = [
    {
      id: 'academics',
      title: 'Academics',
      items: [
        {
          id: 'global-search',
          title: 'Global Search & AI',
          subtitle: 'Click to access',
          description: 'Search approved open notes, web & multimodal AI assistant',
          icon: Search,
          badge: 'AI Search',
          to: '/public-search'
        },
        {
          id: 'public-library',
          title: 'Public Academic Notes',
          subtitle: 'Click to access',
          description: 'Structured community course folders, notes & video lectures',
          icon: BookOpen,
          badge: 'Open Library',
          to: '/public-library'
        }
      ]
    },
    {
      id: 'workspace',
      title: 'Personal Workspace',
      items: [
        {
          id: 'my-notes',
          title: 'My Notes',
          subtitle: 'Click to access',
          description: 'Personal study notes, revision guides & AI-synthesized summaries',
          icon: BookText,
          badge: stats.notesCount !== null ? `${stats.notesCount} Saved` : 'Notes',
          to: '/my-notes'
        },
        {
          id: 'saved-materials',
          title: 'Saved Materials',
          subtitle: 'Click to access',
          description: 'Bookmarked peer resources and curated lecture collections',
          icon: FolderHeart,
          badge: stats.savedCount !== null ? `${stats.savedCount} Saved` : 'Bookmarks',
          to: '/saved-materials'
        }
      ]
    },
    {
      id: 'practice',
      title: 'Practice & Testing',
      items: [
        {
          id: 'ai-test-generator',
          title: 'AI Test Generator',
          subtitle: 'Click to access',
          description: 'Generate adaptive practice tests with automatic grading',
          icon: Sparkles,
          badge: 'Adaptive Tests',
          to: '/ai-test-generator'
        }
      ]
    },
    {
      id: 'contributions',
      title: 'Contributions',
      items: [
        {
          id: 'my-contributions',
          title: 'My Contributions',
          subtitle: 'Click to access',
          description: 'Track review and approval status of your public submissions',
          icon: CheckSquare,
          badge: stats.contributionsCount !== null ? `${stats.contributionsCount} Submissions` : 'Submissions',
          to: '/my-contributions'
        },
        {
          id: 'upload-material',
          title: 'Contribute New Material',
          subtitle: 'Click to access',
          description: 'Upload notes, PDFs or share YouTube/Drive lecture links',
          icon: UploadCloud,
          badge: 'Upload & Share',
          onClick: () => setIsAddModalOpen(true)
        }
      ]
    }
  ];

  // Search filter
  const query = searchQuery.trim().toLowerCase();
  const filteredCategories = categories.map(cat => {
    const matchingItems = cat.items.filter(item => {
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        cat.title.toLowerCase().includes(query) ||
        (item.badge && item.badge.toLowerCase().includes(query))
      );
    });
    return { ...cat, items: matchingItems };
  }).filter(cat => cat.items.length > 0);

  const totalMatchingItems = filteredCategories.reduce((acc, cat) => acc + cat.items.length, 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── HEADER (Layout reference matches Image 2) ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Public Actions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Explore and access various activities and tools available in the platform
          </p>
        </div>

        {/* Top Right Instant Search Filter */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-white/90 hover:bg-white focus:bg-white border border-slate-200/80 focus:border-indigo-400 rounded-xl pl-9 pr-9 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/10 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── MAIN ACTIVITY SECTIONS ────────────────────────────────────────── */}
      {filteredCategories.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/70 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No activities found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            No public actions matched &ldquo;{searchQuery}&rdquo;. Try another term or clear the filter.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
          >
            Clear Search
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {filteredCategories.map((category) => (
            <section key={category.id} className="space-y-3">
              {/* Category Section Header (matching Image 2) */}
              <div className="flex items-center justify-between">
                <h2 className="text-xs sm:text-sm font-semibold text-slate-600 tracking-normal">
                  {category.title}
                </h2>
                {searchQuery && (
                  <span className="text-[11px] font-medium text-slate-400">
                    {category.items.length} {category.items.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>

              {/* Responsive Cards Grid (consistent 1-to-3 column card format) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.onClick ? item.onClick() : navigate(item.to)}
                      className="group relative flex items-center justify-between p-3.5 sm:p-4 bg-white/95 hover:bg-white rounded-xl sm:rounded-2xl border border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                    >
                      {/* Left: Icon + Text */}
                      <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 pr-2">
                        {/* Purple rounded square icon container matching Image 2 */}
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#6366f1] group-hover:bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-all duration-200">
                          <Icon className="w-5 h-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">
                              {item.title}
                            </h3>
                          </div>
                          <p className="text-xs text-slate-400 font-medium">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Right: Chevron Arrow */}
                      <div className="text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all pl-2 shrink-0">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ── MODAL FOR CONTRIBUTING MATERIAL ───────────────────────────────── */}
      {isAddModalOpen && (
        <AddPublicMaterialModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            fetchQuickStats();
          }}
        />
      )}
    </div>
  );
}
