import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Send, XCircle } from 'lucide-react';
import api from '../api/axios';
import { toast } from './Toast';

export default function CreateNotification({ onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [instituteAdmins, setInstituteAdmins] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [students, setStudents] = useState([]);

  // Role detection
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // INSTITUTE_ADMIN and SUPER_ADMIN need departments; HOD needs OTHER departments (excluding own)
        if (['INSTITUTE_ADMIN', 'SUPER_ADMIN'].includes(role)) {
          api.get('/departments').then(res => setDepartments(res.data)).catch(console.error);
        }
        if (role === 'HOD') {
          // HOD needs departments list excluding their own dept (for "Other Department" target)
          api.get('/departments').then(res => {
            // Filter out the HOD's own department
            const filtered = res.data.filter(d => d.id !== user?.department_id);
            setDepartments(filtered);
          }).catch(console.error);
          // HOD needs faculty and students from their own department
          api.get('/users/faculty').then(res => setFaculty(res.data)).catch(console.error);
          api.get('/users/student').then(res => setStudents(res.data)).catch(console.error);
        }
        // Faculty role: only fetch mentees — do NOT call /users/faculty (HOD-only endpoint)
        if (role === 'MENTOR' || role === 'FACULTY') {
          api.get('/users/mentees').then(res => setMentees(res.data)).catch(console.error);
        }
        if (role === 'SUPER_ADMIN') {
          api.get('/users/institute-admins').then(res => setInstituteAdmins(res.data)).catch(console.error);
        }
      } catch (err) {
        console.error('Failed to fetch dependencies', err);
      }
    };
    fetchData();
  }, [role]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.warning('File Too Large', 'Image must be less than 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const getTargetOptions = () => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          { value: 'ALL_INSTITUTE_ADMINS', label: 'All Institute Admins' },
          { value: 'SPECIFIC_INSTITUTE_ADMIN', label: 'Specific Institute Admin' }
        ];
      case 'INSTITUTE_ADMIN':
        return [
          { value: 'ALL_DEPARTMENTS', label: 'All Departments' },
          { value: 'SPECIFIC_DEPARTMENT', label: 'Specific Department' },
          { value: 'ALL_FACULTY', label: 'All Faculty' },
          { value: 'SPECIFIC_DEPARTMENT_FACULTY', label: 'Faculty of Specific Department' },
          { value: 'ALL_USERS', label: 'All Users' }
        ];
      case 'HOD':
        return [
          { value: 'MY_DEPARTMENT_STUDENTS', label: 'All Students of This Department' },
          { value: 'MY_DEPARTMENT_FACULTY', label: 'All Faculty of This Department' },
          { value: 'SPECIFIC_STUDENT', label: 'Specific Student' },
          { value: 'SPECIFIC_FACULTY', label: 'Specific Faculty' },
          { value: 'OTHER_DEPARTMENT', label: 'Other Department' }
        ];
      case 'MENTOR':
      case 'FACULTY':
        return [
          { value: 'ALL_MY_MENTEES', label: 'All My Mentees' },
          { value: 'SPECIFIC_MENTEE', label: 'Specific Student' }
        ];
      default:
        return [];
    }
  };

  const requiresTargetId = ['SPECIFIC_INSTITUTE_ADMIN', 'SPECIFIC_DEPARTMENT', 'SPECIFIC_DEPARTMENT_FACULTY', 'OTHER_DEPARTMENT', 'SPECIFIC_MENTEE', 'SPECIFIC_STUDENT', 'SPECIFIC_FACULTY'].includes(targetType);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!targetType) {
      toast.warning('Missing Recipient', 'Please select at least one recipient.');
      return;
    }
    if (requiresTargetId && !targetId) {
      toast.warning('Missing Target', 'Please select the specific target recipient.');
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('message', message);
    formData.append('targetType', targetType);
    if (requiresTargetId) {
      formData.append('targetId', targetId);
    }
    if (image) {
      formData.append('image', image);
    }

    try {
      await api.post('/notifications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Notification Sent', 'Your notification has been sent successfully.');
      onSuccess?.();
    } catch (err) {
      toast.error('Notification Failed', err.response?.data?.error || 'Unable to send the notification. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-800">Create Notification</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Send To</label>
              <select
                value={targetType}
                onChange={(e) => { setTargetType(e.target.value); setTargetId(''); }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                required
              >
                <option value="" disabled>Select recipient type...</option>
                {getTargetOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {requiresTargetId && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Specific Target</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  required
                >
                  <option value="" disabled>Select from list...</option>

                  {['SPECIFIC_DEPARTMENT', 'SPECIFIC_DEPARTMENT_FACULTY', 'OTHER_DEPARTMENT'].includes(targetType) && (
                    departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  )}

                  {targetType === 'SPECIFIC_MENTEE' && (
                    mentees.length === 0
                      ? <option disabled>No mentees assigned</option>
                      : mentees.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name}{m.roll_number ? ` — ${m.roll_number}` : ''}
                          </option>
                        ))
                  )}

                  {targetType === 'SPECIFIC_STUDENT' && (
                    students.length === 0
                      ? <option disabled>No students found</option>
                      : students.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}{s.roll_number ? ` — ${s.roll_number}` : ''}
                          </option>
                        ))
                  )}

                  {targetType === 'SPECIFIC_FACULTY' && (
                    faculty.map(f => <option key={f.id} value={f.id}>{f.name}</option>)
                  )}

                  {targetType === 'SPECIFIC_INSTITUTE_ADMIN' && (
                    instituteAdmins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Notification Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exam Announcement"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter notification details..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow min-h-[120px] resize-y"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Attach Poster/Image (Optional)</label>

              {!imagePreview ? (
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer relative">
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={handleImageChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <ImageIcon className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-sm font-medium text-slate-600">Click or drag image to upload</p>
                  <p className="text-xs text-slate-400 mt-1">JPG, PNG, WEBP (Max 5MB)</p>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                  <button
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-slate-900/60 text-white rounded-lg hover:bg-slate-900 transition-colors backdrop-blur-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[200px] object-contain" />
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Send Notification
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
