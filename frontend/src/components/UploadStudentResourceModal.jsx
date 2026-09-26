import { useState, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, Sparkles, CheckCircle2, Info, Loader2, Tag } from 'lucide-react';
import api from '../api/axios';

export default function UploadStudentResourceModal({ onClose, onSuccess }) {
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const isFaculty = ['FACULTY', 'HOD', 'INSTITUTE_ADMIN', 'SUPER_ADMIN'].includes(user?.role);

  const [semester, setSemester] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState('');
  const [lessons, setLessons] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState('');
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: ''
  });

  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateWarnings, setDuplicateWarnings] = useState([]);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  // Load subjects when semester changes
  useEffect(() => {
    if (!semester) {
      setSubjects([]);
      setSelectedSubject('');
      return;
    }
    api.get(`/subjects?semester=${semester}`)
      .then(res => {
        setSubjects(res.data);
        setSelectedSubject('');
        setUnits([]);
        setSelectedUnit('');
        setLessons([]);
        setSelectedLesson('');
        setTopics([]);
        setSelectedTopic('');
      })
      .catch(console.error);
  }, [semester]);

  // Load units when subject changes
  useEffect(() => {
    if (!selectedSubject) {
      setUnits([]);
      setSelectedUnit('');
      return;
    }
    api.get(`/academic/subjects/${selectedSubject}/units`)
      .then(res => {
        setUnits(res.data);
        setSelectedUnit('');
        setLessons([]);
        setSelectedLesson('');
        setTopics([]);
        setSelectedTopic('');
      })
      .catch(console.error);
  }, [selectedSubject]);

  // Load lessons when unit changes
  useEffect(() => {
    if (!selectedUnit) {
      setLessons([]);
      setSelectedLesson('');
      return;
    }
    api.get(`/academic/units/${selectedUnit}/lessons`)
      .then(res => {
        setLessons(res.data);
        setSelectedLesson('');
        setTopics([]);
        setSelectedTopic('');
      })
      .catch(console.error);
  }, [selectedUnit]);

  // Load topics when lesson changes
  useEffect(() => {
    if (!selectedLesson) {
      setTopics([]);
      setSelectedTopic('');
      return;
    }
    api.get(`/academic/lessons/${selectedLesson}/topics`)
      .then(res => {
        setTopics(res.data);
        setSelectedTopic('');
      })
      .catch(console.error);
  }, [selectedLesson]);

  // Check duplicate when title, topic, or file changes
  useEffect(() => {
    if (!formData.title.trim() && !file) {
      setDuplicateWarnings([]);
      return;
    }

    const timer = setTimeout(() => {
      setCheckingDuplicate(true);
      api.post('/student-resources/check-duplicate', {
        title: formData.title.trim(),
        topic_id: selectedTopic || null,
        file_name: file ? file.name : null
      })
        .then(res => {
          setDuplicateWarnings(res.data?.warnings || []);
        })
        .catch(console.error)
        .finally(() => setCheckingDuplicate(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [formData.title, selectedTopic, file]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File size must be less than 15 MB.');
      return;
    }

    const allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx'];
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError('Unsupported file format. Please upload PDF, PPTX, or DOCX.');
      return;
    }

    setError('');
    setFile(selectedFile);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a document to upload.');
      return;
    }

    if (!selectedSubject || !selectedUnit || !selectedLesson || !selectedTopic) {
      setError('Please select the complete academic hierarchy (Semester, Subject, Unit, Lesson, Topic).');
      return;
    }

    setLoading(true);
    setError('');

    const data = new FormData();
    data.append('title', formData.title.trim());
    data.append('description', formData.description.trim());
    data.append('tags', formData.tags.trim());
    data.append('semester', semester);
    data.append('subject_id', selectedSubject);
    data.append('unit_id', selectedUnit);
    data.append('lesson_id', selectedLesson);
    data.append('topic_id', selectedTopic);
    data.append('file', file);

    try {
      await api.post('/student-resources/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload resource. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl shadow-xs">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">Share Academic Resource</h2>
              <p className="text-xs text-slate-500 font-medium">
                {isFaculty ? 'Upload study notes, slides, or revision materials for your students' : 'Upload study notes or presentations for other students'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          
          {/* Moderation Workflow Banner */}
          {isFaculty ? (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-150 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 leading-relaxed font-medium">
                <span className="font-bold block text-emerald-950 mb-0.5">Direct Publication Policy</span>
                As a Faculty member, your uploaded resource will be <strong className="text-emerald-700">automatically verified and published</strong> immediately for authorized students.
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-150 flex items-start gap-3">
              <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-xs text-indigo-900 leading-relaxed font-medium">
                <span className="font-bold block text-indigo-950 mb-0.5">Moderation & Approval Policy</span>
                Your upload will start with status <strong className="text-indigo-700">PENDING</strong>. Once reviewed and approved by your assigned faculty or mentor, it will be published and indexed for students.
              </div>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Duplicate Warnings Callout */}
          {duplicateWarnings.length > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>Potential Duplicate Warning</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px] font-medium text-amber-700">
                {duplicateWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Academic Hierarchy Selection */}
          <div className="space-y-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Academic Hierarchy
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Semester */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Semester *</label>
                <select
                  required
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50"
                >
                  <option value="">Select Semester</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                    <option key={s} value={s}>Semester {s}</option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Subject *</label>
                <select
                  required
                  disabled={!semester || subjects.length === 0}
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 disabled:opacity-50"
                >
                  <option value="">Select Subject</option>
                  {subjects.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>
                  ))}
                </select>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Unit *</label>
                <select
                  required
                  disabled={!selectedSubject || units.length === 0}
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 disabled:opacity-50"
                >
                  <option value="">Select Unit</option>
                  {units.map(u => (
                    <option key={u.id} value={u.id}>Unit {u.unit_number}: {u.title}</option>
                  ))}
                </select>
              </div>

              {/* Lesson */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Lesson *</label>
                <select
                  required
                  disabled={!selectedUnit || lessons.length === 0}
                  value={selectedLesson}
                  onChange={(e) => setSelectedLesson(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 disabled:opacity-50"
                >
                  <option value="">Select Lesson</option>
                  {lessons.map(l => (
                    <option key={l.id} value={l.id}>Lesson {l.lesson_number}: {l.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Topic (Full width) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Topic *</label>
              <select
                required
                disabled={!selectedLesson || topics.length === 0}
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50/50 disabled:opacity-50"
              >
                <option value="">Select Topic</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>Topic {t.topic_number}: {t.title}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Resource Details */}
          <div className="space-y-3.5 pt-2 border-t border-slate-150">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Resource Details
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Resource Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Unit 3 Backpropagation Worked Examples & Summary"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Description (Optional)</label>
              <textarea
                rows={2}
                placeholder="Briefly explain what is included in this document..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                <span>Tags (Optional, comma separated)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. exam-prep, derivations, formulas, notes"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* File Upload Drag & Drop */}
          <div className="space-y-2 pt-2 border-t border-slate-150">
            <label className="block text-xs font-bold text-slate-700">Document File (PDF, PPTX, DOCX - max 15MB) *</label>
            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-colors relative group bg-slate-50/50 hover:bg-indigo-50/20 cursor-pointer">
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                required={!file}
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="p-3 bg-white text-indigo-600 rounded-2xl shadow-xs group-hover:scale-110 transition-transform mb-2">
                <Upload className="w-6 h-6" />
              </div>
              {file ? (
                <div className="space-y-1">
                  <p className="text-xs font-black text-indigo-700 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {file.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • Click or drag to change
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-700">
                    Click to browse or drag and drop your document
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Supported: PDF, PPTX, DOCX, DOC, PPT (Max 15MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-150 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !file}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{loading ? 'Uploading...' : (isFaculty ? 'Publish Resource' : 'Submit for Approval')}</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
