import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronDown, Plus, Trash2, FileText, Download, UploadCloud, ArrowLeft, BookOpen, AlertCircle, Search, Sparkles, MessageSquare } from 'lucide-react';
import api from '../api/axios';
import UploadMaterialModal from '../components/UploadMaterialModal';
import AddHierarchyModal from '../components/AddHierarchyModal';
import AISummaryPanel from '../components/AISummaryPanel';
import AIChatbotPanel from '../components/AIChatbotPanel';

function MaterialViewer({ material, onDownload, onOpenSummary, onOpenChat }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [officeUrl, setOfficeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  useEffect(() => {
    if (!material) return;
    
    const ext = material.file_name.split('.').pop().toLowerCase();
    let currentUrl = null;
    
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setOfficeUrl(null);
    setIframeLoaded(false);

    if (['pdf', 'txt', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
      api.get(`/academic/materials/${material.id}/signed-url`)
        .then(res => {
          const signedUrl = res.data.url;
          if (ext === 'pdf' || ext === 'txt') {
            setBlobUrl(signedUrl);
          } else {
            const isPublic = signedUrl.startsWith('https://') && !signedUrl.includes('localhost');
            if (isPublic) {
              setOfficeUrl(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`);
            } else {
              setError(true); // Cannot preview local files
            }
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Preview error:', err);
          setError(true);
          setLoading(false);
        });
    } else {
      // Unpreviewable type
      setLoading(false);
    }

    return () => {
      if (currentUrl) {
        window.URL.revokeObjectURL(currentUrl);
      }
    };
  }, [material]);

  if (!material) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center text-slate-500">
        <BookOpen className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">No Material Selected</h2>
        <p className="max-w-md">Choose a material from the course structure panel to view it here.</p>
      </div>
    );
  }

  const ext = material.file_name.split('.').pop().toLowerCase();
  let previewContent = null;

  if (ext === 'pdf' || ext === 'txt') {
    if (loading) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p>Loading material...</p>
        </div>
      );
    } else if (error || !blobUrl) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-4" />
          <p>Unable to load preview. You can download the material instead.</p>
        </div>
      );
    } else {
      previewContent = (
        <div className="relative w-full h-full bg-slate-50">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0 bg-slate-50">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p>Loading material...</p>
            </div>
          )}
          <iframe
            src={ext === 'pdf' ? `${blobUrl}#toolbar=0` : blobUrl}
            className={`relative w-full h-full border-0 z-10 bg-white transition-opacity duration-300 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
            title={material.title}
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      );
    }
  } else if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
    if (loading) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p>Loading material...</p>
        </div>
      );
    } else if (error || !officeUrl) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 text-slate-600 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 mb-5" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Preview unavailable</h2>
          <p className="max-w-md mb-8">Unable to load preview. You can download the material instead.</p>
        </div>
      );
    } else {
      previewContent = (
        <div className="relative w-full h-full bg-slate-50">
          {!iframeLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0 bg-slate-50">
              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p>Loading material...</p>
            </div>
          )}
          <iframe
            src={officeUrl}
            className={`relative w-full h-full border-0 z-10 bg-white transition-opacity duration-300 ${iframeLoaded ? 'opacity-100' : 'opacity-0'}`}
            title={material.title}
            onLoad={() => setIframeLoaded(true)}
          />
        </div>
      );
    }
  } else {
    previewContent = (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 bg-slate-50">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
        <p>Preview is not available for this file type.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
        <div>
          <h3 className="text-lg font-bold text-slate-800">{material.title}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
            <span className="font-semibold text-slate-700">{material.file_name}</span>
            <span>•</span>
            <span>{(material.file_size / 1024 / 1024).toFixed(2)} MB</span>
          </p>
        </div>
        <div className="flex gap-2">
          {['pdf', 'txt', 'ppt', 'pptx', 'doc', 'docx'].includes(ext) && (
            <>
              <button
                onClick={onOpenSummary}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 shadow-sm flex items-center gap-2 transition-all active:scale-95 text-sm"
              >
                <Sparkles className="w-4 h-4" /> AI Summary
              </button>
              <button
                onClick={onOpenChat}
                className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 shadow-sm flex items-center gap-2 transition-all active:scale-95 text-sm"
              >
                <MessageSquare className="w-4 h-4" /> Ask AI
              </button>
            </>
          )}
          <button
            onClick={() => onDownload(material)}
            className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-all active:scale-95 text-sm"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative bg-slate-100">
        {previewContent}
      </div>
    </div>
  );
}


function DeleteConfirmModal({ material, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-rose-100 rounded-xl">
            <Trash2 className="w-5 h-5 text-rose-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">Delete Material?</h2>
        </div>
        <p className="text-sm text-slate-600 mb-1">
          Are you sure you want to delete:
        </p>
        <p className="text-sm font-bold text-slate-800 mb-4 truncate">&ldquo;{material.title}&rdquo;</p>
        <p className="text-xs text-rose-500 bg-rose-50 px-3 py-2 rounded-lg mb-6">
          ⚠️ This action cannot be undone. The file will be permanently removed.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Deleting...</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Delete</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function MaterialList({ topicId, role, isHod, isFaculty, showToastMessage, onMaterialSelect, selectedMaterialId, onMaterialDeleted }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // material object to confirm deletion
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (e, mat) => {
    e.stopPropagation();
    setDeleteTarget(mat);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/academic/materials/${deleteTarget.id}`);
      // Remove from list immediately
      setMaterials(prev => prev.filter(m => m.id !== deleteTarget.id));
      // Notify parent if the deleted material was selected
      if (onMaterialDeleted) onMaterialDeleted(deleteTarget.id);
      showToastMessage('Material deleted successfully.');
      setDeleteTarget(null);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to delete material. Please try again.';
      showToastMessage(msg);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div className="py-2 px-6 text-xs text-slate-400">Loading materials...</div>;
  if (materials.length === 0) return null;

  return (
    <>
      {deleteTarget && (
        <DeleteConfirmModal
          material={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
          isDeleting={isDeleting}
        />
      )}
      <div className="flex flex-col">
        {materials.map(mat => {
          const isSelected = selectedMaterialId === mat.id;
          return (
            <div
              key={mat.id}
              onClick={() => onMaterialSelect(mat)}
              className={`group flex items-center justify-between py-2 px-6 pl-10 cursor-pointer transition-colors border-l-2 ${isSelected ? 'bg-indigo-50 border-indigo-600' : 'hover:bg-slate-100 border-transparent'}`}
            >
              <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0">
                <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className={`text-sm truncate ${isSelected ? 'font-bold text-indigo-700' : 'font-medium text-slate-600'}`}>
                  {mat.title}
                </span>
              </div>
              {(isHod || isFaculty) && (
                <button
                  onClick={(e) => handleDeleteClick(e, mat)}
                  className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-1"
                  title="Delete Material"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TopicItem({ topic, lessonNumber, role, isHod, isFaculty, fetchTopics, showToastMessage, onMaterialSelect, selectedMaterialId, searchQuery, onMaterialDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (searchQuery && topic.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      setExpanded(true);
    }
  }, [searchQuery, topic.title]);

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

  const isMatch = searchQuery && topic.title.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className="border-t border-slate-100/50">
      <div 
        className={`py-2 px-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isMatch ? 'bg-indigo-50/30' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          <span className="text-xs font-bold text-slate-400 w-6 shrink-0">{lessonNumber}.{topic.topic_number}</span>
          <span className="text-sm font-semibold text-slate-700 truncate max-w-[160px]">{topic.title}</span>
        </div>
        
        <div className="flex items-center gap-2 transition-opacity">
          {(isHod || isFaculty) && expanded && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowUpload(true); }}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
              title="Add Material"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Material
            </button>
          )}
          {isHod && (
            <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-rose-500 rounded">
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="bg-slate-50/50 py-1">
          <MaterialList 
             topicId={topic.id} 
             role={role} 
             isHod={isHod} 
             isFaculty={isFaculty} 
             showToastMessage={showToastMessage} 
             onMaterialSelect={onMaterialSelect}
             selectedMaterialId={selectedMaterialId}
             onMaterialDeleted={onMaterialDeleted}
          />
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

function LessonItem({ lesson, role, isHod, isFaculty, fetchLessons, showToastMessage, onMaterialSelect, selectedMaterialId, searchQuery, onMaterialDeleted }) {
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

  useEffect(() => {
    if (searchQuery && lesson.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      setExpanded(true);
    }
  }, [searchQuery, lesson.title]);

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

  const isMatch = searchQuery && lesson.title.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className="border-t border-slate-200">
      <div 
        className={`group py-3 px-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors ${isMatch ? 'bg-indigo-50/50' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-indigo-400" />}
          <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider">L{lesson.lesson_number}</span>
          <span className="text-sm font-bold text-slate-800 truncate max-w-[150px]">{lesson.title}</span>
        </div>
        
        <div className="flex items-center gap-2 transition-opacity">
           {(isHod || isFaculty) && expanded && (
            <button 
              onClick={handleAddTopicClick} 
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
              title="Add Topic"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Topic
            </button>
          )}
          {isHod && (
              <button onClick={handleDelete} className="p-1 text-slate-400 hover:text-rose-500 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
          )}
        </div>
      </div>
      
      {expanded && (
        <div className="bg-white">
          {loading ? (
            <div className="py-2 px-8 text-xs text-slate-400">Loading topics...</div>
          ) : topics.length === 0 ? (
            <div className="py-2 px-8 text-xs text-slate-400 italic">No topics found.</div>
          ) : (
            topics.map(topic => (
              <TopicItem 
                 key={topic.id} 
                 topic={topic} 
                 lessonNumber={lesson.lesson_number}
                 role={role} 
                 isHod={isHod} 
                 isFaculty={isFaculty} 
                 fetchTopics={fetchTopics} 
                 showToastMessage={showToastMessage} 
                 onMaterialSelect={onMaterialSelect}
                 selectedMaterialId={selectedMaterialId}
                 searchQuery={searchQuery}
                 onMaterialDeleted={onMaterialDeleted}
              />
            ))
          )}
        </div>
      )}

      {showAddTopic && (
        <AddHierarchyModal
          type="Topic"
          parentId={lesson.id}
          defaultNumber={topics.length > 0 ? Math.max(...topics.map(t => t.topic_number)) + 1 : 1}
          parentPrefix={`${lesson.lesson_number}.`}
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

function UnitItem({ unit, role, isHod, isFaculty, fetchUnits, showToastMessage, onMaterialSelect, selectedMaterialId, searchQuery, onMaterialDeleted }) {
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

  useEffect(() => {
    if (searchQuery && unit.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      setExpanded(true);
    }
  }, [searchQuery, unit.title]);

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

  const isMatch = searchQuery && unit.title.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div className="mb-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden transition-all">
      <div 
        className={`group p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${isMatch ? 'bg-indigo-50/40' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1 rounded-md ${expanded ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
             {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Unit {unit.unit_number}</span>
            <h3 className="text-sm font-bold text-slate-800 truncate max-w-[160px]">{unit.title}</h3>
          </div>
        </div>
        
        <div className="flex items-center gap-2 transition-opacity">
          {(isHod || isFaculty) && expanded && (
            <button 
              onClick={handleAddLessonClick} 
              className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
              title="Add Lesson"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Lesson
            </button>
          )}
          {isHod && (
              <button onClick={handleDelete} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
        </div>
      </div>
      
      {expanded && (
        <div className="bg-slate-50 border-t border-slate-100">
          {loading ? (
            <div className="p-4 text-xs text-slate-500">Loading lessons...</div>
          ) : lessons.length === 0 ? (
            <div className="p-4 text-xs text-slate-400 italic">No lessons found.</div>
          ) : (
            lessons.map(lesson => (
              <LessonItem 
                key={lesson.id} 
                lesson={lesson} 
                role={role} 
                isHod={isHod} 
                isFaculty={isFaculty} 
                fetchLessons={fetchLessons} 
                showToastMessage={showToastMessage} 
                onMaterialSelect={onMaterialSelect}
                selectedMaterialId={selectedMaterialId}
                searchQuery={searchQuery}
                onMaterialDeleted={onMaterialDeleted}
              />
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
  
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeAIPanel, setActiveAIPanel] = useState(null); // 'summary', 'chat', or null

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

  const handleDownload = async (mat) => {
    try {
      showToastMessage('Preparing download...');
      const response = await api.get(`/academic/materials/${mat.id}/signed-url?download=true`);
      
      const url = response.data.url;
      const a = document.createElement('a');
      a.href = url;
      a.download = mat.file_name;
      // Do not use target='_blank' to avoid opening new tabs for downloads
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      showToastMessage('Material file is currently unavailable.');
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
    </div>
  );
  
  if (!subject) return <div className="text-rose-500 text-center mt-10">Subject not found.</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out h-[calc(100vh-100px)] flex flex-col pb-6">
      {/* Header */}
      <div className="mb-4 shrink-0 flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => navigate('/subjects')}
                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                title="Back to Subjects"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500 mb-0.5">
                    <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-wider">Sem {subject.semester}</span>
                    <span>{subject.code}</span>
                </div>
                <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
                    {subject.name}
                </h1>
            </div>
        </div>
        
        {(isHod || isFaculty) && (
            <button 
                onClick={() => setShowAddUnit(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-indigo-300 transition-all active:scale-95 text-sm"
            >
                <Plus className="w-4 h-4" /> Add Unit
            </button>
        )}
      </div>

      {/* Main Two-Panel Layout */}
      <div className="flex-1 flex gap-4 min-h-0">
        
        {/* Left/Center Panel - Viewer Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col relative">
           <MaterialViewer 
             material={selectedMaterial} 
             onDownload={handleDownload} 
             onOpenSummary={() => setActiveAIPanel('summary')}
             onOpenChat={() => setActiveAIPanel('chat')}
           />
           
           {/* AI Overlays */}
           {activeAIPanel === 'summary' && selectedMaterial && (
             <AISummaryPanel material={selectedMaterial} subject={subject} onClose={() => setActiveAIPanel(null)} />
           )}
           {activeAIPanel === 'chat' && selectedMaterial && (
             <AIChatbotPanel material={selectedMaterial} subject={subject} onClose={() => setActiveAIPanel(null)} />
           )}
        </div>

        {/* Right Sidebar - Course Structure */}
        <div className="w-80 shrink-0 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
             <div className="flex items-center justify-between mb-3">
                 <h2 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Course Structure</h2>
                 <span className="bg-slate-200 text-slate-600 text-xs font-bold px-2 py-0.5 rounded-full">{units.length} Units</span>
             </div>
             
             <div className="relative">
                 <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                 <input 
                    type="text"
                    placeholder="Search topics..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow placeholder:text-slate-400 font-medium"
                 />
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30">
            {units.length === 0 ? (
                <div className="text-center p-6 mt-4">
                    <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm font-medium mb-4">No units found.</p>
                    {(isHod || isFaculty) && (
                        <button 
                            onClick={() => setShowAddUnit(true)}
                            className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-100 transition-colors"
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
                        onMaterialSelect={setSelectedMaterial}
                        selectedMaterialId={selectedMaterial?.id}
                        searchQuery={searchQuery}
                        onMaterialDeleted={(deletedId) => {
                          if (selectedMaterial?.id === deletedId) {
                            setSelectedMaterial(null);
                            setActiveAIPanel(null);
                          }
                        }}
                    />
                ))
            )}
          </div>
        </div>

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
