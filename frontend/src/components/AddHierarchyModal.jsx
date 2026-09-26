import { useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';

export default function AddHierarchyModal({ 
  type, // 'Unit', 'Lesson', 'Topic'
  parentId, // subjectId, unitId, lessonId
  defaultNumber,
  parentPrefix, // e.g. "2." for topics under Lesson 2
  onClose,
  onSuccess 
}) {
  const [formData, setFormData] = useState({ 
    number: defaultNumber, 
    title: '', 
    description: '' 
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileError, setFileError] = useState('');
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowed = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (!allowed.includes(ext)) {
        setFileError('Unsupported file format. Please attach PDF, DOC/DOCX, or PPT/PPTX.');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setFileError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError(`${type} title is required.`);
      return;
    }

    // Mandatory Material validation for Topic
    if (type === 'Topic') {
      if (!file) {
        setFileError('Please attach a material before creating the topic.');
        return;
      }
      setFileError('');
    }

    setLoading(true);

    try {
      if (type === 'Topic') {
        const uploadData = new FormData();
        uploadData.append('topic_number', formData.number);
        uploadData.append('title', formData.title.trim());
        uploadData.append('description', formData.description.trim());
        uploadData.append('file', file);

        await api.post(`/academic/lessons/${parentId}/topics`, uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else if (type === 'Unit') {
        await api.post(`/academic/subjects/${parentId}/units`, {
          unit_number: formData.number,
          title: formData.title.trim(),
          description: formData.description.trim()
        });
      } else if (type === 'Lesson') {
        await api.post(`/academic/units/${parentId}/lessons`, {
          lesson_number: formData.number,
          title: formData.title.trim(),
          description: formData.description.trim()
        });
      }

      onSuccess();
    } catch (err) {
      console.error(`Failed to create ${type}:`, err);
      setError(err.response?.data?.error || `Failed to create ${type}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/80">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Add {type}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              {type} {type === 'Topic' ? 'Number / Code' : 'Number'} *
            </label>
            <div className="flex items-center">
              {parentPrefix && (
                <div className="px-4 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 font-bold select-none text-sm">
                  {parentPrefix}
                </div>
              )}
              <input 
                type="number" 
                required
                min="1"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: parseInt(e.target.value) || 1})}
                className={`w-full px-4 py-2.5 border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none ${parentPrefix ? 'rounded-r-xl' : 'rounded-xl'}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{type} Title *</label>
            <input 
              type="text" 
              required
              placeholder={`Enter ${type.toLowerCase()} title`}
              value={formData.title}
              onChange={(e) => { setFormData({...formData, title: e.target.value}); if (error) setError(''); }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
            <textarea 
              rows="3"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          {/* Mandatory Material Attachment for Topic */}
          {type === 'Topic' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Attach Material <span className="text-rose-500 font-bold">*</span>
              </label>
              
              <div className={`border-2 border-dashed rounded-2xl p-5 flex flex-col items-center justify-center text-center transition-colors relative cursor-pointer group ${
                fileError 
                  ? 'border-rose-300 bg-rose-50/40' 
                  : file 
                    ? 'border-emerald-300 bg-emerald-50/20' 
                    : 'border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20'
              }`}>
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
                <Upload className={`w-7 h-7 mb-2 transition-transform group-hover:scale-110 ${file ? 'text-emerald-600' : 'text-slate-400 group-hover:text-indigo-600'}`} />
                
                <div className="text-xs font-bold text-slate-700">
                  {file ? (
                    <span className="text-emerald-700 flex items-center justify-center gap-1.5 font-bold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      {file.name}
                    </span>
                  ) : (
                    'Click or drag material to attach'
                  )}
                </div>
                
                <div className="text-[11px] text-slate-400 font-medium mt-1">
                  {file ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • Click to replace` : 'Supported: PDF, DOC/DOCX, PPT/PPTX (Required)'}
                </div>
              </div>

              {/* Inline Validation Error */}
              {fileError && (
                <p className="text-xs font-bold text-rose-500 mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{fileError}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8 pt-3 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-slate-600 font-bold text-xs hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-200 hover:shadow-indigo-300 transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
            >
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              <span>{loading ? 'Creating...' : `Create ${type}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
