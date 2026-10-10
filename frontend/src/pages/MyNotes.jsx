import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import ReactMarkdown from 'react-markdown';
import {
  BookText, Plus, Search, Trash2, Edit3, Save, Sparkles,
  Layers, Tag, Calendar, Eye, FileText, Check, AlertCircle,
  RefreshCw, X, Folder
} from 'lucide-react';

export default function MyNotes() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Active Editor State
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCourse, setEditCourse] = useState('');
  const [editTopic, setEditTopic] = useState('');
  const [editTags, setEditTags] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // AI Generator Modal
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCourse, setAiCourse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/public/notes');
      setNotes(res.data || []);
      if (res.data?.length > 0 && !selectedNote) {
        selectNote(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load personal notes:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectNote = (note) => {
    setSelectedNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditCourse(note.course_name || '');
    setEditTopic(note.topic_tag || '');
    setEditTags(Array.isArray(note.tags) ? note.tags.join(', ') : '');
    setIsEditing(false);
  };

  const handleStartNewNote = () => {
    const newDraft = {
      id: 'new',
      title: 'Untitled Academic Note',
      content: '## Overview\n\nEnter your personal study notes, lecture takeaways, or formulas here...',
      course_name: '',
      topic_tag: '',
      tags: [],
      created_at: new Date().toISOString()
    };
    setSelectedNote(newDraft);
    setEditTitle(newDraft.title);
    setEditContent(newDraft.content);
    setEditCourse('');
    setEditTopic('');
    setEditTags('');
    setIsEditing(true);
  };

  const handleSaveNote = async () => {
    if (!editTitle.trim()) return;
    setSaving(true);
    setSaveSuccess(false);

    try {
      const parsedTags = editTags.split(',').map(t => t.trim()).filter(Boolean);
      const payload = {
        title: editTitle.trim(),
        content: editContent.trim(),
        courseName: editCourse.trim(),
        topicTag: editTopic.trim(),
        tags: parsedTags
      };

      let savedNote;
      if (selectedNote?.id === 'new') {
        const res = await api.post('/public/notes', payload);
        savedNote = res.data;
        setNotes(prev => [savedNote, ...prev]);
      } else {
        const res = await api.put(`/public/notes/${selectedNote.id}`, payload);
        savedNote = res.data;
        setNotes(prev => prev.map(n => n.id === savedNote.id ? savedNote : n));
      }

      setSelectedNote(savedNote);
      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save note:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (e, noteId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this study note?')) return;

    try {
      await api.delete(`/public/notes/${noteId}`);
      const remaining = notes.filter(n => n.id !== noteId);
      setNotes(remaining);
      if (selectedNote?.id === noteId) {
        if (remaining.length > 0) selectNote(remaining[0]);
        else setSelectedNote(null);
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  const handleAiGenerateNote = async (e) => {
    e.preventDefault();
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setAiError(null);

    try {
      const res = await api.post('/public/notes/ai-generate', {
        topic: aiTopic.trim(),
        courseName: aiCourse.trim()
      });

      const generated = res.data;
      const newDraft = {
        id: 'new',
        title: generated.title || `${aiTopic} - Study Notes`,
        content: generated.content || '',
        course_name: aiCourse.trim(),
        topic_tag: aiTopic.trim(),
        tags: ['ai-generated', aiTopic.toLowerCase().replace(/\s+/g, '-')],
        is_ai_generated: true,
        created_at: new Date().toISOString()
      };

      setSelectedNote(newDraft);
      setEditTitle(newDraft.title);
      setEditContent(newDraft.content);
      setEditCourse(newDraft.course_name);
      setEditTopic(newDraft.topic_tag);
      setEditTags(newDraft.tags.join(', '));
      setIsEditing(false);
      setIsAiModalOpen(false);
      setAiTopic('');
      setAiCourse('');
    } catch (err) {
      console.error('AI note generation error:', err);
      setAiError(err.response?.data?.message || 'Failed to generate AI notes. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredNotes = notes.filter(n => {
    const q = searchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      (n.content && n.content.toLowerCase().includes(q)) ||
      (n.course_name && n.course_name.toLowerCase().includes(q)) ||
      (n.topic_tag && n.topic_tag.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-700 text-xs font-bold mb-1.5">
            <BookText className="w-3.5 h-3.5" />
            <span>Personal Study Space</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            My Academic Notes
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Draft personal lecture notes, format with Markdown, or auto-synthesize study guides with AI.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>AI Generate Notes</span>
          </button>

          <button
            type="button"
            onClick={handleStartNewNote}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* ── MAIN SPLIT VIEW (Sidebar List + Active Editor/Viewer) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
        
        {/* Left Notes List Column */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200 shadow-2xs p-4 flex flex-col space-y-3">
          
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your notes..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[520px]">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading notes...</div>
            ) : filteredNotes.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                <BookText className="w-8 h-8 text-slate-300 mx-auto" />
                <p>No notes found. Create or generate one above!</p>
              </div>
            ) : (
              filteredNotes.map(n => {
                const isSelected = selectedNote?.id === n.id;
                return (
                  <div
                    key={n.id}
                    onClick={() => selectNote(n)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer group flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'bg-indigo-50/90 border-indigo-200 text-indigo-900 shadow-2xs'
                        : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-150 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-bold line-clamp-1 group-hover:text-indigo-700">
                        {n.title}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteNote(e, n.id)}
                        className="text-slate-300 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-normal">
                      {n.content.replace(/[#*`_]/g, '')}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>{n.course_name || 'General'}</span>
                      <span>{new Date(n.updated_at || n.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Active Note Editor / Viewer Column */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-2xs p-6 flex flex-col space-y-4">
          
          {selectedNote ? (
            <>
              {/* Header Controls */}
              <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-150">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    {selectedNote.id === 'new' ? 'Drafting New Note' : 'Personal Note'}
                  </span>
                  {selectedNote.is_ai_generated && (
                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                      AI Generated
                    </span>
                  )}
                  {saveSuccess && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-in fade-in">
                      <Check className="w-3 h-3" /> Saved!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                      isEditing
                        ? 'bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-white border-slate-200 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                    <span>{isEditing ? 'Preview Markdown' : 'Edit Note'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveNote}
                    disabled={saving}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Note</span>
                  </button>
                </div>
              </div>

              {/* Title & Metadata Inputs */}
              {isEditing ? (
                <div className="space-y-3 animate-in fade-in">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Note Title"
                    className="w-full text-lg font-black text-slate-900 border-b border-slate-200 pb-1 outline-none focus:border-indigo-500"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editCourse}
                      onChange={(e) => setEditCourse(e.target.value)}
                      placeholder="Course Name (e.g. Operating Systems)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white"
                    />
                    <input
                      type="text"
                      value={editTopic}
                      onChange={(e) => setEditTopic(e.target.value)}
                      placeholder="Topic Tag (e.g. Memory Paging)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white"
                    />
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="Tags (comma separated)"
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 outline-none focus:bg-white"
                    />
                  </div>

                  <textarea
                    rows={16}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Write markdown content here..."
                    className="w-full font-mono text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white leading-relaxed"
                  />
                </div>
              ) : (
                /* Markdown Preview Mode */
                <div className="space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">{editTitle}</h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                      {editCourse && <span>Course: <strong className="text-slate-700">{editCourse}</strong></span>}
                      {editTopic && <span>• Topic: <strong className="text-slate-700">{editTopic}</strong></span>}
                    </div>
                  </div>

                  <div className="prose-markdown text-xs sm:text-sm text-slate-700 leading-relaxed pt-2 border-t border-slate-100">
                    <ReactMarkdown>{editContent}</ReactMarkdown>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
              <BookText className="w-12 h-12 text-slate-300" />
              <h3 className="text-base font-bold text-slate-800">Select or Create a Note</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Choose a note from the left sidebar or launch our AI assistant to synthesize structured notes from scratch.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* ── AI NOTE GENERATION MODAL ────────────────────────────────────────── */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-base font-black text-slate-900">AI Note Generator</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Enter any academic topic or curriculum subject. Academix AI will synthesize a complete, Markdown-formatted study note with theoretical breakdowns and code/math formulas.
            </p>

            {aiError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            <form onSubmit={handleAiGenerateNote} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Academic Topic *</label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="e.g. Backpropagation in Deep Neural Networks"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Course Name (Optional)</label>
                <input
                  type="text"
                  value={aiCourse}
                  onChange={(e) => setAiCourse(e.target.value)}
                  placeholder="e.g. Machine Learning (CS480)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={aiLoading}
                  className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Notes...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Generate Note</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
