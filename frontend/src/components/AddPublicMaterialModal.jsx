import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  X, UploadCloud, Link as LinkIcon, Video, FileText, CheckCircle2,
  FolderPlus, Search, Sparkles, AlertCircle, Info, ShieldCheck
} from 'lucide-react';

export default function AddPublicMaterialModal({ isOpen, onClose, onSuccess }) {
  const [courseCategoryType, setCourseCategoryType] = useState('COMMUNITY_COURSE'); // 'COMMUNITY_COURSE' | 'INSTITUTE_SEMESTER'
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [materialSourceType, setMaterialSourceType] = useState('FILE'); // 'FILE' | 'GOOGLE_DRIVE' | 'YOUTUBE' | 'LINK'
  const [file, setFile] = useState(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [agreedToPublicTerms, setAgreedToPublicTerms] = useState(false);

  // Community Course Selector State
  const [courses, setCourses] = useState([]);
  const [courseSearchQuery, setCourseSearchQuery] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isCreatingNewCourse, setIsCreatingNewCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseCategory, setNewCourseCategory] = useState('COMMUNITY');

  // Institute Hierarchy Selector State
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('1');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [urlPreviewInfo, setUrlPreviewInfo] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchPublicCourses();
      fetchHierarchyData();
    }
  }, [isOpen]);

  const fetchPublicCourses = async () => {
    try {
      const res = await api.get('/public/courses');
      setCourses(res.data || []);
    } catch (err) {
      console.warn('Failed to load public courses', err);
    }
  };

  const fetchHierarchyData = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data || []);
      if (res.data?.length > 0) {
        setSelectedDept(res.data[0].id);
      }
    } catch (err) {
      console.warn('Failed to load departments', err);
    }
  };

  // Load subjects when department / semester changes
  useEffect(() => {
    if (courseCategoryType === 'INSTITUTE_SEMESTER' && selectedDept && selectedSemester) {
      api.get(`/subjects?department_id=${selectedDept}&semester=${selectedSemester}`)
        .then(res => {
          setSubjects(res.data || []);
          if (res.data?.length > 0) setSelectedSubject(res.data[0].id);
          else setSelectedSubject('');
        })
        .catch(() => setSubjects([]));
    }
  }, [selectedDept, selectedSemester, courseCategoryType]);

  // Handle URL Preview parsing
  useEffect(() => {
    if (!externalUrl || !externalUrl.trim()) {
      setUrlPreviewInfo(null);
      return;
    }

    const trimmed = externalUrl.trim();
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      let videoId = null;
      if (trimmed.includes('youtu.be/')) {
        videoId = trimmed.split('youtu.be/')[1]?.split(/[?#&]/)[0];
      } else {
        const match = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (match) videoId = match[1];
      }

      if (videoId && videoId.length === 11) {
        setUrlPreviewInfo({
          type: 'YOUTUBE',
          videoId,
          thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`
        });
      } else {
        setUrlPreviewInfo({ type: 'INVALID', message: 'Invalid YouTube video URL format.' });
      }
    } else if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) {
      setUrlPreviewInfo({
        type: 'GOOGLE_DRIVE',
        message: 'Google Drive file detected. Please ensure link permissions are set to "Anyone with the link can view".'
      });
    } else if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      setUrlPreviewInfo({
        type: 'LINK',
        message: 'Valid educational resource web link.'
      });
    } else {
      setUrlPreviewInfo(null);
    }
  }, [externalUrl]);

  if (!isOpen) return null;

  const filteredCourses = courses.filter(c =>
    c.name.toLowerCase().includes(courseSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Please provide a resource title.');
      return;
    }

    if (!agreedToPublicTerms) {
      setError('Please confirm that you have permission to publicly share this academic material.');
      return;
    }

    if (materialSourceType === 'FILE' && !file) {
      setError('Please select a file to upload.');
      return;
    }

    if (['GOOGLE_DRIVE', 'YOUTUBE', 'LINK'].includes(materialSourceType) && !externalUrl.trim()) {
      setError('Please enter a valid resource URL.');
      return;
    }

    if (courseCategoryType === 'COMMUNITY_COURSE' && !selectedCourseId && !newCourseName.trim()) {
      setError('Please select an existing course folder or specify a new course folder name.');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('tags', tags);
      formData.append('courseCategoryType', courseCategoryType);

      if (courseCategoryType === 'COMMUNITY_COURSE') {
        if (selectedCourseId) {
          formData.append('publicCourseId', selectedCourseId);
        } else if (newCourseName.trim()) {
          formData.append('newCourseName', newCourseName.trim());
        }
      } else {
        if (selectedDept) formData.append('departmentId', selectedDept);
        if (selectedSemester) formData.append('semester', selectedSemester);
        if (selectedSubject) formData.append('subjectId', selectedSubject);
        if (selectedUnit) formData.append('unitId', selectedUnit);
        if (selectedLesson) formData.append('lessonId', selectedLesson);
        if (selectedTopic) formData.append('topicId', selectedTopic);
      }

      if (materialSourceType === 'FILE' && file) {
        formData.append('file', file);
      } else {
        formData.append('externalUrl', externalUrl.trim());
      }

      const res = await api.post('/public/contribute', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (onSuccess) onSuccess(res.data);
      onClose();
    } catch (err) {
      console.error('Submission failed:', err);
      setError(err.response?.data?.message || 'Failed to submit contribution. Please verify input fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-150 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-indigo-50/80 via-white to-violet-50/80 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-2xl shadow-xs">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">Add Public Academic Material</h2>
              <p className="text-xs text-slate-500 font-medium">Contribute open educational notes, videos, or Drive resources</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5">
          
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Resource Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Resource Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Complete Dynamic Programming Lecture Notes & Problem Sets"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
              required
            />
          </div>

          {/* 2. Course Category Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              Course Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCourseCategoryType('COMMUNITY_COURSE')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                  courseCategoryType === 'COMMUNITY_COURSE'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FolderPlus className="w-4 h-4 shrink-0 text-indigo-600" />
                <div>
                  <span className="block">Public Community Course</span>
                  <span className="text-[10px] text-slate-400 font-normal">Any course, university or topic folder</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCourseCategoryType('INSTITUTE_SEMESTER')}
                className={`p-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                  courseCategoryType === 'INSTITUTE_SEMESTER'
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-200'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0 text-indigo-600" />
                <div>
                  <span className="block">Institute / Semester</span>
                  <span className="text-[10px] text-slate-400 font-normal">Mapped to departmental curriculum</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2A. Community Course Selector */}
          {courseCategoryType === 'COMMUNITY_COURSE' && (
            <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/80 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Select Public Course Folder
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNewCourse(!isCreatingNewCourse);
                    if (!isCreatingNewCourse) setSelectedCourseId('');
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  {isCreatingNewCourse ? '← Choose Existing Course' : '+ Create New Course Folder'}
                </button>
              </div>

              {!isCreatingNewCourse ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={courseSearchQuery}
                      onChange={(e) => setCourseSearchQuery(e.target.value)}
                      placeholder="Search community course folders..."
                      className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="max-h-36 overflow-y-auto custom-scrollbar border border-slate-200 rounded-xl bg-white p-1 space-y-1">
                    {filteredCourses.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No matching course folder. Click "+ Create New Course Folder" above.
                      </div>
                    ) : (
                      filteredCourses.map(c => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCourseId(c.id)}
                          className={`p-2 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-between transition-colors ${
                            selectedCourseId === c.id
                              ? 'bg-indigo-600 text-white font-bold'
                              : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            selectedCourseId === c.id ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {c.resource_count || 0} materials
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 animate-in fade-in">
                  <div>
                    <input
                      type="text"
                      value={newCourseName}
                      onChange={(e) => setNewCourseName(e.target.value)}
                      placeholder="New Course Folder Name (e.g. Distributed Cloud Computing)"
                      className="w-full bg-white border border-indigo-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 font-bold placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2B. Institute Semester Selector */}
          {courseCategoryType === 'INSTITUTE_SEMESTER' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Department</label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none"
                >
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Semester</label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none"
                >
                  {subjects.length === 0 ? (
                    <option value="">No subjects found for this semester</option>
                  ) : (
                    subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))
                  )}
                </select>
              </div>
            </div>
          )}

          {/* 3. Resource Source Type Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 block">
              Material Source Format <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'FILE', label: 'Document File', icon: FileText },
                { id: 'GOOGLE_DRIVE', label: 'Google Drive', icon: UploadCloud },
                { id: 'YOUTUBE', label: 'YouTube Video', icon: Video },
                { id: 'LINK', label: 'Web Link', icon: LinkIcon }
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMaterialSourceType(item.id);
                      setFile(null);
                      setExternalUrl('');
                      setUrlPreviewInfo(null);
                    }}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                      materialSourceType === item.id
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${materialSourceType === item.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3A. File Upload Area */}
          {materialSourceType === 'FILE' && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Attach Document (PDF, DOCX, TXT - max 10MB)
              </label>
              <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center bg-slate-50/50 transition-colors">
                <input
                  type="file"
                  id="material-file-upload"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                <label htmlFor="material-file-upload" className="cursor-pointer space-y-2 block">
                  <UploadCloud className="w-8 h-8 text-indigo-600 mx-auto" />
                  <div className="text-xs font-bold text-slate-800">
                    {file ? file.name : 'Click to select or drag & drop document'}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Supported: PDF, Microsoft Word (.docx), Plain Text'}
                  </p>
                </label>
              </div>
            </div>
          )}

          {/* 3B. External Link Area (Google Drive, YouTube, Web Link) */}
          {materialSourceType !== 'FILE' && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                {materialSourceType === 'GOOGLE_DRIVE' ? 'Google Drive Share URL' : materialSourceType === 'YOUTUBE' ? 'YouTube Video URL' : 'Educational Link URL'} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder={
                    materialSourceType === 'GOOGLE_DRIVE'
                      ? 'https://drive.google.com/file/d/.../view?usp=sharing'
                      : materialSourceType === 'YOUTUBE'
                      ? 'https://www.youtube.com/watch?v=... or https://youtu.be/...'
                      : 'https://ocw.mit.edu/courses/...'
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-slate-800 font-medium outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  required
                />
              </div>

              {/* URL Preview State */}
              {urlPreviewInfo && (
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-2 animate-in fade-in">
                  {urlPreviewInfo.type === 'YOUTUBE' && urlPreviewInfo.thumbnail && (
                    <div className="flex items-center gap-3">
                      <img
                        src={urlPreviewInfo.thumbnail}
                        alt="Video Preview"
                        className="w-20 h-12 object-cover rounded-lg border border-indigo-200"
                      />
                      <div className="text-xs text-indigo-900 font-bold">
                        <span>Valid YouTube video detected</span>
                        <p className="text-[10px] text-slate-500 font-normal">Embedded playback will be enabled in the public course library.</p>
                      </div>
                    </div>
                  )}

                  {urlPreviewInfo.type === 'GOOGLE_DRIVE' && (
                    <div className="flex items-center gap-2 text-indigo-900 font-medium">
                      <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{urlPreviewInfo.message}</span>
                    </div>
                  )}

                  {urlPreviewInfo.type === 'LINK' && (
                    <div className="flex items-center gap-2 text-indigo-900 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{urlPreviewInfo.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 4. Description & Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">Description & Summary</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide a helpful overview of what this material covers for fellow scholars..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">Tags (Comma-separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. algorithms, graph-theory, final-exam-prep"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* 5. Public Sharing Declaration */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToPublicTerms}
                onChange={(e) => setAgreedToPublicTerms(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                required
              />
              <span className="text-[11px] text-slate-600 font-medium leading-relaxed">
                I declare that this academic material is suitable for open educational sharing, contains no prohibited institutional copyright violations, and I agree to have it reviewed by academic faculty before publication.
              </span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-150 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <span>Submitting for Review...</span>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Submit Contribution</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
