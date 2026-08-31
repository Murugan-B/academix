import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit2, FileText, Download, UploadCloud, ArrowLeft, BookOpen } from 'lucide-react';
import api from '../api/axios';
import UploadMaterialModal from '../components/UploadMaterialModal';
import AddHierarchyModal from '../components/AddHierarchyModal';
import MaterialPreviewModal from '../components/MaterialPreviewModal';

function MaterialList({ topicId, role, isHod, isFaculty, showToastMessage }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [previewMaterial, setPreviewMaterial] = useState(null);

  useEffect(() => {
    fetchMaterials();
  }, [topicId]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/academic/topics/${topicId}/materials`);
      setMaterials(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    try {
      await api.delete(`/academic/materials/${id}`);
      fetchMaterials();
    } catch (err) {
      showToastMessage(err.isCustom ? err.message : (err.response?.data?.error || 'Failed to delete'));
    }
  };

  const handleDownload = async (mat) => {
    try {
      setDownloadingId(mat.id);
      const response = await api.get(`/academic/materials/${mat.id}/download`, {
        responseType: 'blob'
      });
      
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = mat.file_name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      showToastMessage('Material file is currently unavailable.');
    } finally {
      setDownloadingId(null);
    }
  };

  const isPreviewable = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    return ['pdf', 'txt', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext);
  };

  if (loading) return <div className="p-4 text-sm text-slate-500">Loading materials...</div>;
  if (materials.length === 0) return <div className="p-4 text-sm text-slate-400 italic">No materials uploaded yet.</div>;

  return (
    <div className="grid gap-3 mt-3">
      {materials.map(mat => (
        <div key={mat.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between shadow-sm hover:shadow-md transition-shadow gap-4">
          <div className="flex items-start sm:items-center gap-4 flex-1">
            <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 break-all">{mat.title}</h4>
              <p className="text-xs text-slate-500 flex flex-wrap gap-3 mt-1">
                <span className="font-medium text-slate-700">{mat.file_name}</span>
                <span>•</span>
                <span>Size: {(mat.file_size / 1024 / 1024).toFixed(2)} MB</span>
                <span>•</span>
                <span>Uploaded: {new Date(mat.created_at).toLocaleDateString()}</span>
              </p>
              {mat.description && <p className="text-sm text-slate-600 mt-2">{mat.description}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isPreviewable(mat.file_name) && (
              <button 
                onClick={() => setPreviewMaterial(mat)}
                className="px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold border border-indigo-100"
              >
                <BookOpen className="w-4 h-4" /> View
              </button>
            )}
            <button 
              onClick={() => handleDownload(mat)}
              disabled={downloadingId === mat.id}
              className="px-3 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors flex items-center gap-2 text-sm font-semibold disabled:opacity-60"
            >
              {downloadingId === mat.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-700/30 border-t-indigo-700 rounded-full animate-spin" />
                  Preparing download...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" /> Download
                </>
              )}
            </button>
            {(isHod || isFaculty) && (
              <button 
                onClick={() => handleDelete(mat.id)}
                className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                title="Delete Material"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ))}

      {previewMaterial && (
        <MaterialPreviewModal
          material={previewMaterial}
          isOpen={!!previewMaterial}
          onClose={() => setPreviewMaterial(null)}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}

function TopicItem({ topic, role, isHod, isFaculty, fetchTopics, showToastMessage }) {
  const [expanded, setExpanded] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete topic?')) return;
    try {
      await api.delete(`/academic/topics/${topic.id}`);
      fetchTopics();
    } catch (err) {
      showToastMessage(err.isCustom ? err.message : (err.response?.data?.error || 'Failed to delete'));
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 bg-slate-50">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-sm">
            {topic.topic_number}
          </div>
          <span className="font-semibold text-slate-700">{topic.title}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {(isHod || isFaculty) && expanded && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowUpload(true); }}
              className="text-xs bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-200 flex items-center gap-1"
            >
              <UploadCloud className="w-3 h-3" /> Upload
            </button>
          )}
          {isHod && (
            <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 pt-0 pl-14">
          {topic.description && <p className="text-sm text-slate-500 mb-3">{topic.description}</p>}
          <MaterialList topicId={topic.id} role={role} isHod={isHod} isFaculty={isFaculty} showToastMessage={showToastMessage} />
        </div>
      )}

      {showUpload && (
        <UploadMaterialModal 
          topicId={topic.id} 
          onClose={() => setShowUpload(false)} 
          onUploadSuccess={() => {
            setExpanded(false); setTimeout(() => setExpanded(true), 50);
            showToastMessage('Material uploaded successfully.');
          }} 
        />
      )}
    </div>
  );
}

function LessonItem({ lesson, role, isHod, isFaculty, fetchLessons, showToastMessage }) {
  const [expanded, setExpanded] = useState(false);
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/academic/lessons/${lesson.id}/topics`);
      setTopics(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) fetchTopics();
  }, [expanded]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete lesson?')) return;
    try {
      await api.delete(`/academic/lessons/${lesson.id}`);
      fetchLessons();
    } catch (err) {
      showToastMessage(err.isCustom ? err.message : (err.response?.data?.error || 'Failed to delete'));
    }
  };

  const [showAddTopic, setShowAddTopic] = useState(false);

  const handleAddTopicClick = (e) => {
    e.stopPropagation();
    setShowAddTopic(true);
  };

  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden mb-3 bg-white shadow-sm">
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-indigo-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-5 h-5 text-indigo-400" /> : <ChevronRight className="w-5 h-5 text-indigo-400" />}
          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
            L{lesson.lesson_number}
          </div>
          <span className="font-bold text-slate-800">{lesson.title}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {isHod && (
              <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-500 rounded transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
        </div>
      </div>
      
      {expanded && (
        <div className="p-4 pt-3 pl-14">
          {(isHod || isFaculty) && (
            <button 
              onClick={handleAddTopicClick} 
              className="mb-4 text-sm bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Topic
            </button>
          )}
          {loading ? (
            <div className="text-sm text-slate-400">Loading topics...</div>
          ) : topics.length === 0 ? (
            <div className="text-sm text-slate-400 italic">No topics found.</div>
          ) : (
            topics.map(topic => (
              <TopicItem key={topic.id} topic={topic} role={role} isHod={isHod} isFaculty={isFaculty} fetchTopics={fetchTopics} showToastMessage={showToastMessage} />
            ))
          )}
        </div>
      )}

      {showAddTopic && (
        <AddHierarchyModal
          type="Topic"
          parentId={lesson.id}
          defaultNumber={topics.length > 0 ? Math.max(...topics.map(t => t.topic_number)) + 1 : 1}
          onClose={() => setShowAddTopic(false)}
          onSuccess={() => {
            setShowAddTopic(false);
            fetchTopics();
            if (!expanded) setExpanded(true);
            showToastMessage('Topic created successfully.');
          }}
        />
      )}
    </div>
  );
}

function UnitItem({ unit, role, isHod, isFaculty, fetchUnits, showToastMessage }) {
  const [expanded, setExpanded] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLessons = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/academic/units/${unit.id}/lessons`);
      setLessons(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) fetchLessons();
  }, [expanded]);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Delete unit?')) return;
    try {
      await api.delete(`/academic/units/${unit.id}`);
      fetchUnits();
    } catch (err) {
      showToastMessage(err.isCustom ? err.message : (err.response?.data?.error || 'Failed to delete'));
    }
  };

  const [showAddLesson, setShowAddLesson] = useState(false);

  const handleAddLessonClick = (e) => {
    e.stopPropagation();
    setShowAddLesson(true);
  };

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden mb-4 bg-white shadow-sm hover:shadow transition-shadow">
      <div 
        className="p-5 flex items-center justify-between cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          {expanded ? <ChevronDown className="w-6 h-6 text-slate-500" /> : <ChevronRight className="w-6 h-6 text-slate-500" />}
          <div>
            <span className="text-sm font-bold text-indigo-500 uppercase tracking-wider block mb-1">Unit {unit.unit_number}</span>
            <h3 className="text-xl font-bold text-slate-800">{unit.title}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isHod && (
              <button onClick={handleDelete} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            )}
        </div>
      </div>
      
      {expanded && (
        <div className="p-6 pt-5 border-t border-slate-100">
          {(isHod || isFaculty) && (
            <button 
              onClick={handleAddLessonClick} 
              className="mb-5 text-sm bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Lesson
            </button>
          )}
          {loading ? (
            <div className="text-sm text-slate-500">Loading lessons...</div>
          ) : lessons.length === 0 ? (
            <div className="text-sm text-slate-400 italic">No lessons found in this unit.</div>
          ) : (
            lessons.map(lesson => (
              <LessonItem key={lesson.id} lesson={lesson} role={role} isHod={isHod} isFaculty={isFaculty} fetchLessons={fetchLessons} showToastMessage={showToastMessage} />
            ))
          )}
        </div>
      )}

      {showAddLesson && (
        <AddHierarchyModal
          type="Lesson"
          parentId={unit.id}
          defaultNumber={lessons.length > 0 ? Math.max(...lessons.map(l => l.lesson_number)) + 1 : 1}
          onClose={() => setShowAddLesson(false)}
          onSuccess={() => {
            setShowAddLesson(false);
            fetchLessons();
            if (!expanded) setExpanded(true);
          }}
        />
      )}
    </div>
  );
}

export default function SubjectDetails() {
  const { subjectId } = useParams();
  const navigate = useNavigate();
  
  const [subject, setSubject] = useState(null);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  // Role detection
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const role = user?.role;
  const isHod = role === 'HOD';
  const isFaculty = role === 'FACULTY';

  const fetchData = async () => {
    setLoading(true);
    try {
      const subRes = await api.get(`/subjects/${subjectId}`);
      setSubject(subRes.data);

      const unitRes = await api.get(`/academic/subjects/${subjectId}/units`);
      setUnits(unitRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [subjectId]);

  const [showAddUnit, setShowAddUnit] = useState(false);
  const [toast, setToast] = useState('');

  const showToastMessage = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
    </div>
  );
  
  if (!subject) return <div className="text-rose-500 text-center mt-10">Subject not found.</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out pb-20">
      {/* Breadcrumb & Header */}
      <div className="mb-8">
        <button 
          onClick={() => navigate('/subjects')}
          className="text-slate-500 hover:text-slate-800 flex items-center gap-2 text-sm font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Subjects
        </button>

        <div className="flex items-center gap-3 text-sm font-medium text-slate-500 mb-4">
          <span className="text-indigo-600 font-bold bg-indigo-50 px-2.5 py-1 rounded-md">Semester {subject.semester}</span>
          <span>•</span>
          <span>{subject.code}</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2 flex items-center gap-3">
              <BookOpen className="w-8 h-8 text-indigo-500" />
              {subject.name}
            </h1>
            <p className="text-slate-500 font-medium">Manage academic content and learning materials</p>
          </div>
          {(isHod || isFaculty) && (
            <button 
              onClick={() => setShowAddUnit(true)}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95"
            >
              <Plus className="w-5 h-5" /> Add Unit
            </button>
          )}
        </div>
      </div>

      {/* Units List */}
      <div className="mt-8">
        {units.length === 0 ? (
          <div className="text-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-white">
            <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 mb-1">No units found</h3>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">This subject is currently empty. Get started by adding the first unit to the curriculum.</p>
            {(isHod || isFaculty) && (
              <button 
                onClick={() => setShowAddUnit(true)}
                className="bg-indigo-50 text-indigo-700 px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
              >
                Add First Unit
              </button>
            )}
          </div>
        ) : (
          units.map(unit => (
            <UnitItem 
              key={unit.id} 
              unit={unit} 
              role={role} 
              isHod={isHod} 
              isFaculty={isFaculty} 
              fetchUnits={fetchData} 
              showToastMessage={showToastMessage}
            />
          ))
        )}
      </div>

      {showAddUnit && (
        <AddHierarchyModal
          type="Unit"
          parentId={subjectId}
          defaultNumber={units.length > 0 ? Math.max(...units.map(u => u.unit_number)) + 1 : 1}
          onClose={() => setShowAddUnit(false)}
          onSuccess={() => {
            setShowAddUnit(false);
            fetchData();
            showToastMessage('Unit created successfully');
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 z-50">
          <div className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="font-medium text-sm">{toast}</span>
        </div>
      )}
    </div>
  );
}
