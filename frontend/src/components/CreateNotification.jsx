import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Send, XCircle } from 'lucide-react';
import api from '../api/axios';

export default function CreateNotification({ onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState('');
  
  // IDs
  const [departmentId, setDepartmentId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [menteeId, setMenteeId] = useState('');
  const [instituteAdminId, setInstituteAdminId] = useState('');

  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Dropdown lists
  const [departments, setDepartments] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [mentees, setMentees] = useState([]);
  const [instituteAdmins, setInstituteAdmins] = useState([]);

  // Loading states for dropdowns
  const [loadingDeps, setLoadingDeps] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [loadingMentees, setLoadingMentees] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Role detection
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role;

  // Reset dependent fields when target type changes
  useEffect(() => {
    setDepartmentId('');
    setFacultyId('');
    setMenteeId('');
    setInstituteAdminId('');
    setError('');
  }, [targetType]);

  // Reset faculty when department changes
  useEffect(() => {
    setFacultyId('');
    if (departmentId && targetType === 'SPECIFIC_DEPARTMENT_FACULTY') {
      fetchFacultyForDepartment(departmentId);
    }
  }, [departmentId, targetType]);

  // Fetch departments if needed
  useEffect(() => {
    if (['SPECIFIC_DEPARTMENT', 'SPECIFIC_DEPARTMENT_FACULTY', 'OTHER_DEPARTMENT'].includes(targetType)) {
      fetchDepartments();
    }
    if (targetType === 'SPECIFIC_MENTEE') {
      fetchMentees();
    }
    if (targetType === 'SPECIFIC_INSTITUTE_ADMIN') {
      fetchInstituteAdmins();
    }
  }, [targetType]);

  const fetchDepartments = async () => {
    if (departments.length > 0) return;
    setLoadingDeps(true);
    try {
      const res = await api.get('/departments');
      let deps = res.data;
      if (targetType === 'OTHER_DEPARTMENT' && user?.department_id) {
        deps = deps.filter(d => d.id !== user.department_id);
      }
      setDepartments(deps);
    } catch (err) {
      console.error(err);
      setError('Failed to load departments.');
    } finally {
      setLoadingDeps(false);
    }
  };

  const fetchFacultyForDepartment = async (deptId) => {
    setLoadingFaculty(true);
    try {
      const res = await api.get(`/departments/${deptId}/faculty`);
      setFacultyList(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load faculty for this department.');
    } finally {
      setLoadingFaculty(false);
    }
  };

  const fetchMentees = async () => {
    if (mentees.length > 0) return;
    setLoadingMentees(true);
    try {
      const res = await api.get('/users/mentees');
      setMentees(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load mentees.');
    } finally {
      setLoadingMentees(false);
    }
  };

  const fetchInstituteAdmins = async () => {
    if (instituteAdmins.length > 0) return;
    setLoadingAdmins(true);
    try {
      const res = await api.get('/users/institute-admins');
      setInstituteAdmins(res.data);
    } catch (err) {
      console.error(err);
      setError('Failed to load institute admins.');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image must be less than 5MB');
        return;
      }
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setError('');
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
          { value: 'MY_DEPARTMENT_STUDENTS', label: 'My Department - All Students' },
          { value: 'MY_DEPARTMENT_FACULTY', label: 'My Department - All Faculty' },
          { value: 'OTHER_DEPARTMENT', label: 'Other Department' },
          { value: 'ALL_FACULTY', label: 'All Faculty' },
          { value: 'SPECIFIC_DEPARTMENT_FACULTY', label: 'Faculty of Specific Department' }
        ];
      case 'FACULTY':
      case 'MENTOR':
        return [
          { value: 'ALL_MY_MENTEES', label: 'All My Mentees' },
          { value: 'SPECIFIC_MENTEE', label: 'Specific Student' }
        ];
      default:
        return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!targetType) {
      setError('Please select at least one recipient.');
      return;
    }

    let finalTargetId = null;

    if (['SPECIFIC_DEPARTMENT', 'OTHER_DEPARTMENT'].includes(targetType)) {
      if (!departmentId) return setError('Please select a department.');
      finalTargetId = departmentId;
    } else if (targetType === 'SPECIFIC_DEPARTMENT_FACULTY') {
      if (!departmentId) return setError('Please select a department.');
      if (!facultyId) return setError('Please select a faculty member.');
      finalTargetId = facultyId;
    } else if (targetType === 'SPECIFIC_MENTEE') {
      if (!menteeId) return setError('Please select a mentee.');
      finalTargetId = menteeId;
      finalTargetId = menteeId;
    } else if (targetType === 'SPECIFIC_INSTITUTE_ADMIN') {
      if (!instituteAdminId) return setError('Please select an institute admin.');
      finalTargetId = instituteAdminId;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('message', message);
    formData.append('targetType', targetType);
    if (finalTargetId) {
      formData.append('targetId', finalTargetId);
    }
    
    if (image) {
      formData.append('image', image);
    }

    try {
      if (departmentId) {
        formData.append('departmentId', departmentId);
      }

      const response = await api.post('/notifications', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.recipientCount !== undefined) {
        alert(`Notification sent to ${response.data.recipientCount} recipients successfully!`);
      }
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Notification could not be sent. Please try again.');
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
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium flex items-start gap-2">
              <XCircle className="w-5 h-5 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Send To</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                required
              >
                <option value="" disabled>Select recipient type...</option>
                {getTargetOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Department Selection (For SPECIFIC_DEPARTMENT, OTHER_DEPARTMENT, SPECIFIC_DEPARTMENT_FACULTY) */}
            {['SPECIFIC_DEPARTMENT', 'OTHER_DEPARTMENT', 'SPECIFIC_DEPARTMENT_FACULTY'].includes(targetType) && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Department</label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  required
                >
                  <option value="" disabled>
                    {loadingDeps ? 'Loading departments...' : 'Select Department ▼'}
                  </option>
                  {!loadingDeps && departments.length === 0 && (
                    <option value="" disabled>No departments available</option>
                  )}
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Faculty Selection (For SPECIFIC_DEPARTMENT_FACULTY) */}
            {targetType === 'SPECIFIC_DEPARTMENT_FACULTY' && departmentId && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Faculty</label>
                <select
                  value={facultyId}
                  onChange={(e) => setFacultyId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  required
                >
                  <option value="" disabled>
                    {loadingFaculty ? 'Loading faculty...' : 'Select Faculty ▼'}
                  </option>
                  {!loadingFaculty && facultyList.length === 0 && (
                    <option value="" disabled>No faculty found in this department</option>
                  )}
                  {facultyList.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.designation.replace('_', ' ')})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Mentee Selection */}
            {targetType === 'SPECIFIC_MENTEE' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Specific Mentee</label>
                <select
                  value={menteeId}
                  onChange={(e) => setMenteeId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  required
                >
                  <option value="" disabled>
                    {loadingMentees ? 'Loading mentees...' : 'Select Mentee ▼'}
                  </option>
                  {!loadingMentees && mentees.length === 0 && (
                    <option value="" disabled>No mentees assigned to you</option>
                  )}
                  {mentees.map(m => (
                    <option key={m.id} value={m.id}>{m.name} - {m.roll_number}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Institute Admin Selection */}
            {targetType === 'SPECIFIC_INSTITUTE_ADMIN' && (
              <div className="animate-in fade-in slide-in-from-top-2">
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Specific Institute Admin</label>
                <select
                  value={instituteAdminId}
                  onChange={(e) => setInstituteAdminId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
                  required
                >
                  <option value="" disabled>
                    {loadingAdmins ? 'Loading institute admins...' : 'Select Institute Admin ▼'}
                  </option>
                  {!loadingAdmins && instituteAdmins.length === 0 && (
                    <option value="" disabled>No institute admins available</option>
                  )}
                  {instituteAdmins.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
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
