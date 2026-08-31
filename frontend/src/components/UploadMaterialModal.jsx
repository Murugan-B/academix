import { useState } from 'react';
import { X, Upload, File as FileIcon } from 'lucide-react';
import api from '../api/axios';

export default function UploadMaterialModal({ topicId, onClose, onUploadSuccess }) {
  const [formData, setFormData] = useState({ title: '', description: '' });
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10 MB.');
      return;
    }

    const allowedExtensions = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
    const fileExt = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      setError('Unsupported file type.');
      return;
    }

    setLoading(true);
    setError('');
    
    const data = new FormData();
    data.append('title', formData.title);
    data.append('description', formData.description);
    data.append('file', file);

    try {
      await api.post(`/academic/topics/${topicId}/materials`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload material');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Upload Material</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-50 text-rose-500 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Title</label>
            <input 
              type="text" 
              required
              placeholder="e.g. Chapter 1 Notes"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
            <textarea 
              rows="3"
              placeholder="Optional description..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">File</label>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors relative cursor-pointer group">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => setFile(e.target.files[0])}
                required
              />
              <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 mb-2" />
              <div className="text-sm font-medium text-slate-600">
                {file ? file.name : 'Click or drag file to upload'}
              </div>
              <div className="text-xs text-slate-400 mt-1">PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT up to 10MB</div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
