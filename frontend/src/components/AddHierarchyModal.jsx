import { useState } from 'react';
import { X, Upload } from 'lucide-react';
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
  const [file, setFile] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setError(`${type} title is required.`);
      return;
    }

    setLoading(true);
    setError('');

    let endpoint = '';
    let payload = {
      title: formData.title.trim(),
      description: formData.description.trim()
    };

    if (type === 'Unit') {
      endpoint = `/academic/subjects/${parentId}/units`;
      payload.unit_number = formData.number;
    } else if (type === 'Lesson') {
      endpoint = `/academic/units/${parentId}/lessons`;
      payload.lesson_number = formData.number;
    } else if (type === 'Topic') {
      endpoint = `/academic/lessons/${parentId}/topics`;
      payload.topic_number = formData.number;
    }

    try {
      const res = await api.post(endpoint, payload);
      
      // Optional material upload for Topic
      if (type === 'Topic' && file) {
        // Validate file before proceeding? Better to do it early but we already created topic.
        const topicId = res.data.id;
        const uploadData = new FormData();
        uploadData.append('title', formData.title.trim());
        uploadData.append('description', formData.description.trim());
        uploadData.append('file', file);

        await api.post(`/academic/topics/${topicId}/materials`, uploadData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      onSuccess();
    } catch (err) {
      setError(err.isCustom ? err.message : (err.response?.data?.error || `Failed to create ${type}`));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Add {type}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-rose-50 text-rose-500 rounded-lg text-sm">{error}</div>}
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{type} {type === 'Topic' ? 'Number / Code' : 'Number'}</label>
            <div className="flex items-center">
              {parentPrefix && (
                <div className="px-4 py-2.5 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 font-bold select-none">
                  {parentPrefix}
                </div>
              )}
              <input 
                type="number" 
                required
                min="1"
                value={formData.number}
                onChange={(e) => setFormData({...formData, number: parseInt(e.target.value)})}
                className={`w-full px-4 py-2.5 border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none ${parentPrefix ? 'rounded-r-xl' : 'rounded-xl'}`}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">{type} Title</label>
            <input 
              type="text" 
              required
              placeholder={`Enter ${type.toLowerCase()} title`}
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

          {type === 'Topic' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Attach Material <span className="text-slate-400 font-normal">(Optional)</span></label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center hover:bg-slate-50 transition-colors relative cursor-pointer group">
                <input 
                  type="file" 
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => setFile(e.target.files[0])}
                />
                <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2" />
                <div className="text-sm font-medium text-slate-600 text-center">
                  {file ? file.name : 'Click or drag file to attach'}
                </div>
                {!file && <div className="text-xs text-slate-400 mt-1">PDF, DOC, PPT etc.</div>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
              {loading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {loading ? 'Saving...' : `Create ${type}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
