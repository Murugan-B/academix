import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, User, Send, Plus, Trash2, Search, Paperclip, X, FileText,
  Sparkles, AlertCircle, RefreshCw, CheckCircle2, HelpCircle, BookOpen,
  Layers, StopCircle, Image as ImageIcon, ZoomIn
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import api from '../api/axios';
import { toast } from '../components/Toast';

const showToast = (msg, type = 'info') => {
  if (type === 'success') toast.success(msg);
  else if (type === 'error') toast.error(msg);
  else toast.info(msg);
};

// ─── Helpers ────────────────────────────────────────────────────────────────
const formatFileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileExt = (filename, mimetype) => {
  const ext = (filename || '').split('.').pop().toUpperCase();
  if (ext && ext.length <= 5) return ext;
  if (mimetype) {
    const parts = mimetype.split('/');
    return parts[parts.length - 1]?.toUpperCase() || 'FILE';
  }
  return 'FILE';
};

const isImage = (mimetype = '', filename = '') => {
  return (
    mimetype.startsWith('image/') ||
    /\.(png|jpg|jpeg|webp|gif)$/i.test(filename)
  );
};

// ─── Attachment Card Component ───────────────────────────────────────────────
function AttachmentCard({ attachment, compact = false, onClick }) {
  const img = isImage(attachment.file_type, attachment.file_name);
  const ext = getFileExt(attachment.file_name, attachment.file_type);
  const size = formatFileSize(attachment.file_size);

  if (img && attachment.file_url) {
    return (
      <div
        className={`rounded-2xl overflow-hidden border border-white/20 shadow-sm ${compact ? 'w-40' : 'w-48'} bg-black/10 cursor-pointer group`}
        onClick={onClick}
        title={attachment.file_name}
      >
        <img
          src={attachment.file_url}
          alt={attachment.file_name}
          className="w-full object-cover max-h-32 group-hover:opacity-90 transition-opacity"
        />
        <div className="px-2 py-1.5">
          <p className="text-[10px] font-bold truncate">{attachment.file_name}</p>
          <p className="text-[10px] opacity-70">{ext} {size && `• ${size}`}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl border border-white/20 px-3 py-2.5 bg-black/10 shadow-sm max-w-[220px]"
      title={attachment.file_name}
    >
      <div className="p-2 rounded-xl bg-white/20 shrink-0">
        <FileText className="w-4 h-4" />
      </div>
      <div className="truncate">
        <p className="text-[11px] font-bold truncate">{attachment.file_name}</p>
        <p className="text-[10px] opacity-70">{ext}{size ? ` • ${size}` : ''}</p>
      </div>
    </div>
  );
}

// ─── Image Preview Modal ─────────────────────────────────────────────────────
function ImagePreviewModal({ url, name, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-3xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 p-1.5 bg-white rounded-full text-slate-700 hover:text-rose-600 shadow"
        >
          <X className="w-4 h-4" />
        </button>
        <img src={url} alt={name} className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl" />
        {name && <p className="text-center text-white/70 text-xs mt-2 truncate">{name}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AIAssistant() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  // attachmentsByMessageId: { [messageId]: attachment }
  const [attachmentsByMsgId, setAttachmentsByMsgId] = useState({});
  // attachments without message_id (uploaded but no message yet matched)
  const [orphanAttachments, setOrphanAttachments] = useState([]);

  const [inputMessage, setInputMessage] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('local');
  const [providersStatus, setProvidersStatus] = useState({
    local: { status: 'available', label: 'Ollama (Local)' },
    gemini: { status: 'unavailable', label: 'Gemini' },
    openrouter: { status: 'unavailable', label: 'OpenRouter', model: 'meta-llama/llama-3.1-8b-instruct:free' },
    deepseek: { status: 'unavailable', label: 'DeepSeek' }
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [deleteModalConv, setDeleteModalConv] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  // AbortController ref for cancellation
  const abortControllerRef = useRef(null);
  const isCancelledRef = useRef(false);

  const userStr = localStorage.getItem('user');
  const currentUser = userStr ? JSON.parse(userStr) : null;
  const userRole = currentUser?.role || 'STUDENT';

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProvidersStatus();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConvId) {
      fetchConversationDetails(activeConvId);
    } else {
      setMessages([]);
      setAttachmentsByMsgId({});
      setOrphanAttachments([]);
    }
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Attachment association helpers ──────────────────────────────────────────
  const buildAttachmentMaps = (attachments) => {
    const byMsgId = {};
    const orphans = [];
    (attachments || []).forEach(att => {
      if (att.message_id) {
        byMsgId[att.message_id] = att;
      } else {
        orphans.push(att);
      }
    });
    return { byMsgId, orphans };
  };

  // ── API Calls ───────────────────────────────────────────────────────────────
  const fetchProvidersStatus = async () => {
    try {
      const res = await api.get('/ai/assistant/providers-status');
      setProvidersStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch AI providers status:', err);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await api.get('/ai/assistant/conversations');
      setConversations(res.data);
      if (res.data.length > 0 && !activeConvId) {
        setActiveConvId(res.data[0].id);
        if (res.data[0].selected_provider) {
          setSelectedProvider(res.data[0].selected_provider);
        }
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
      showToast('Failed to load chat history', 'error');
    }
  };

  const fetchConversationDetails = async (convId) => {
    try {
      const res = await api.get(`/ai/assistant/conversations/${convId}`);
      setMessages(res.data.messages || []);
      const { byMsgId, orphans } = buildAttachmentMaps(res.data.attachments || []);
      setAttachmentsByMsgId(byMsgId);
      setOrphanAttachments(orphans);
      if (res.data.conversation?.selected_provider) {
        setSelectedProvider(res.data.conversation.selected_provider);
      }
    } catch (err) {
      console.error('Failed to fetch conversation details:', err);
      showToast('Unable to access this conversation.', 'error');
    }
  };

  const createNewChat = async () => {
    try {
      const res = await api.post('/ai/assistant/conversations', {
        title: 'New Conversation',
        provider: selectedProvider
      });
      setConversations(prev => [res.data, ...prev]);
      setActiveConvId(res.data.id);
      setMessages([]);
      setAttachmentsByMsgId({});
      setOrphanAttachments([]);
      setPendingAttachment(null);
    } catch (err) {
      console.error('Failed to create new chat:', err);
      showToast('Failed to start a new chat.', 'error');
    }
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await api.delete(`/ai/assistant/conversations/${convId}`);
      const updated = conversations.filter(c => c.id !== convId);
      setConversations(updated);
      showToast('Conversation deleted.', 'info');
      setDeleteModalConv(null);
      if (activeConvId === convId) {
        if (updated.length > 0) {
          setActiveConvId(updated[0].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      showToast('Failed to delete conversation.', 'error');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      showToast('File size exceeds the 25MB limit.', 'error');
      return;
    }

    let targetConvId = activeConvId;
    if (!targetConvId) {
      try {
        const res = await api.post('/ai/assistant/conversations', {
          title: 'New Conversation',
          provider: selectedProvider
        });
        setConversations(prev => [res.data, ...prev]);
        setActiveConvId(res.data.id);
        targetConvId = res.data.id;
      } catch (err) {
        showToast('Failed to create chat for upload.', 'error');
        return;
      }
    }

    await uploadFileToConv(targetConvId, file);
  };

  const uploadFileToConv = async (convId, file) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/ai/assistant/conversations/${convId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPendingAttachment(res.data);
      showToast(`Attached ${file.name} successfully.`, 'success');
    } catch (err) {
      console.error('Upload error:', err);
      showToast(err.response?.data?.message || 'Failed to upload attachment.', 'error');
      setPendingAttachment(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Stop generation ─────────────────────────────────────────────────────────
  const stopGeneration = useCallback(() => {
    isCancelledRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  }, []);

  // ── Send Message ────────────────────────────────────────────────────────────
  const sendMessage = async (customText = null) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    let targetConvId = activeConvId;
    if (!targetConvId) {
      try {
        const res = await api.post('/ai/assistant/conversations', {
          title: 'New Conversation',
          provider: selectedProvider
        });
        setConversations(prev => [res.data, ...prev]);
        setActiveConvId(res.data.id);
        targetConvId = res.data.id;
      } catch (err) {
        showToast('Failed to start chat session.', 'error');
        return;
      }
    }

    const userMessageContent = textToSend.trim();
    if (!customText) setInputMessage('');

    // Check provider status
    const currentStatus = providersStatus[selectedProvider]?.status;
    if (currentStatus === 'unavailable') {
      showToast(`${providersStatus[selectedProvider]?.label || selectedProvider} is currently unavailable. Please select another provider.`, 'error');
      return;
    }

    // Capture pending attachment before clearing it
    const attachmentIdToSend = pendingAttachment ? pendingAttachment.id : null;
    const attachmentSnapshot = pendingAttachment ? { ...pendingAttachment } : null;
    setPendingAttachment(null);

    // Optimistic user message with a temp id
    const tempId = 'temp-' + Date.now();
    const tempUserMsg = {
      id: tempId,
      sender: 'user',
      content: userMessageContent,
      provider: selectedProvider,
      created_at: new Date().toISOString(),
      _tempAttachment: attachmentSnapshot // for rendering before server confirms
    };

    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);
    isCancelledRef.current = false;

    // Create abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await api.post(
        `/ai/assistant/conversations/${targetConvId}/messages`,
        {
          message: userMessageContent,
          provider: selectedProvider,
          attachmentId: attachmentIdToSend
        },
        { signal: controller.signal }
      );

      if (isCancelledRef.current) return; // user cancelled after response started arriving

      const { userMessage, assistantMessage, conversationTitle } = res.data;

      // Associate attachment with the confirmed user message id
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== tempId);
        return [...filtered, userMessage, assistantMessage];
      });

      // Update attachment map: if we sent an attachment, associate it with the real message id
      if (attachmentSnapshot && attachmentIdToSend && userMessage?.id) {
        setAttachmentsByMsgId(prev => ({
          ...prev,
          [userMessage.id]: { ...attachmentSnapshot, message_id: userMessage.id }
        }));
      }

      if (conversationTitle) {
        setConversations(prev =>
          prev.map(c =>
            c.id === targetConvId
              ? { ...c, title: conversationTitle, selected_provider: selectedProvider, updated_at: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (err) {
      if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || isCancelledRef.current) {
        // Intentional cancellation — remove the optimistic user message
        setMessages(prev => prev.filter(m => m.id !== tempId));
        return; // no error toast for intentional stop
      }
      console.error('Send message error:', err);
      showToast(err.response?.data?.message || 'Failed to generate AI response.', 'error');
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      if (!isCancelledRef.current) {
        setLoading(false);
      }
      abortControllerRef.current = null;
    }
  };

  // ── Quick Actions ───────────────────────────────────────────────────────────
  const getQuickActions = () => {
    if (userRole === 'STUDENT') {
      return [
        { label: 'Explain Simply', icon: Sparkles, text: 'Can you explain this concept in simple, easy-to-understand terms with clear examples?' },
        { label: 'Summarize', icon: BookOpen, text: 'Please provide a structured, bulleted summary of this topic/material.' },
        { label: 'Create MCQs', icon: HelpCircle, text: 'Generate 5 practice multiple-choice questions (with options A, B, C, D and explanations) based on this material.' },
        { label: 'Important Points', icon: CheckCircle2, text: 'What are the top 5 key takeaways and important exam points from this material?' },
        { label: 'Step by Step', icon: Layers, text: 'Explain the step-by-step process or method for solving/understanding this topic.' }
      ];
    } else if (userRole === 'FACULTY' || userRole === 'MENTOR') {
      return [
        { label: 'Teaching Notes', icon: Sparkles, text: 'Create structured lecture notes and key teaching points for explaining this topic to students.' },
        { label: 'Generate Questions', icon: HelpCircle, text: 'Generate a set of short-answer and long-answer exam questions with sample solutions.' },
        { label: 'Create MCQs', icon: CheckCircle2, text: 'Create 5 high-quality multiple choice questions with detailed rationale for each option.' },
        { label: 'Analyse Document', icon: BookOpen, text: 'Analyze this uploaded academic document and summarize its primary learning objectives and concepts.' }
      ];
    } else {
      return [
        { label: 'Report Insights', icon: Sparkles, text: 'Extract key strategic insights, metrics, and actionable recommendations from this document.' },
        { label: 'Analyse Document', icon: BookOpen, text: 'Analyze this academic/administrative document and summarize key findings.' },
        { label: 'Extract Key Points', icon: CheckCircle2, text: 'Summarize the critical action items, policy points, and highlights from this text.' }
      ];
    }
  };

  const filteredConversations = conversations.filter(c =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="h-[calc(100vh-7rem)] flex bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-100 overflow-hidden animate-in fade-in duration-500">

      {/* LEFT SIDEBAR */}
      <aside className="w-80 bg-slate-50/70 border-r border-slate-200/80 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200/60 flex flex-col gap-3 shrink-0">
          <button
            onClick={createNewChat}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold py-3 px-4 rounded-2xl shadow-md shadow-indigo-100 transition-all active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>New Chat</span>
          </button>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium">No chats found.</p>
            </div>
          ) : (
            filteredConversations.map(conv => {
              const isActive = conv.id === activeConvId;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConvId(conv.id)}
                  className={`group relative flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isActive
                      ? 'bg-indigo-50 border border-indigo-200/80 shadow-sm text-indigo-900 font-semibold'
                      : 'hover:bg-white text-slate-700 border border-transparent hover:border-slate-200/60 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate pr-6">
                    <Bot className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="text-xs truncate">{conv.title}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteModalConv(conv);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all absolute right-2"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-slate-200/60 bg-white/50 text-xs text-slate-500 flex items-center justify-between shrink-0">
          <span className="font-semibold truncate">{currentUser?.name || 'User'}</span>
          <span className="bg-indigo-100 text-indigo-700 font-extrabold px-2 py-0.5 rounded-md text-[10px] uppercase">{userRole}</span>
        </div>
      </aside>

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden relative">

        {/* Chat Header */}
        <header className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-base leading-tight">
                {conversations.find(c => c.id === activeConvId)?.title || 'Academix AI Assistant'}
              </h2>
              <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 mt-0.5">
                <span>Model:</span>
                <span className="font-bold text-slate-600 capitalize">{selectedProvider}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${providersStatus[selectedProvider]?.status === 'available' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="local">Ollama (Local)</option>
                <option value="gemini">Gemini</option>
                <option value="openrouter">
                  OpenRouter {providersStatus.openrouter?.model ? `(${providersStatus.openrouter.model.split('/').pop()})` : ''}
                </option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>
          </div>
        </header>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 bg-slate-50/30">
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto text-center">
              <div className="p-4 bg-indigo-50 rounded-3xl text-indigo-600 mb-4 shadow-sm">
                <Sparkles className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-extrabold text-slate-800 mb-2">Welcome to Academix AI Assistant</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Ask questions, analyze uploaded study materials, summarize lecture notes, or generate practice questions tailored to your coursework.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                {getQuickActions().map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => sendMessage(action.text)}
                      className="flex items-center gap-2.5 p-3 text-left bg-white border border-slate-200/80 hover:border-indigo-300 hover:shadow-md rounded-2xl transition-all group"
                    >
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-900">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.sender === 'user';
            // Find attachment for this message — use temp attachment while optimistic, then db version
            const attachment =
              msg._tempAttachment ||
              attachmentsByMsgId[msg.id] ||
              null;

            return (
              <div key={msg.id || i} className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                <div className={`shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center shadow-sm ${
                  isUser ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white' : 'bg-white border border-slate-200 text-indigo-600'
                }`}>
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>

                  {/* Attachment card inside user bubble */}
                  {isUser && attachment && (
                    <div className={`text-white ${isImage(attachment.file_type, attachment.file_name) ? '' : ''}`}>
                      <div className="text-white">
                        <AttachmentCard
                          attachment={attachment}
                          onClick={() => {
                            if (isImage(attachment.file_type, attachment.file_name) && attachment.file_url) {
                              setPreviewImage({ url: attachment.file_url, name: attachment.file_name });
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className={`p-4 rounded-3xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100'
                      : 'bg-white border border-slate-200/80 text-slate-800 rounded-tl-none shadow-sm'
                  }`}>
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose-markdown">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 font-medium px-1">
                    {new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Loading indicator with Stop button */}
          {loading && (
            <div className="flex gap-3 max-w-3xl mr-auto">
              <div className="shrink-0 w-8 h-8 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-indigo-600 shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-2 items-start">
                <div className="p-4 bg-white border border-slate-200/80 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 animate-pulse">Academix AI is thinking...</span>
                </div>
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors"
                >
                  <StopCircle className="w-3.5 h-3.5" />
                  Stop generating
                </button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions Bar */}
        {messages.length > 0 && !loading && (
          <div className="px-6 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">Quick Actions:</span>
            {getQuickActions().map((action, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(action.text)}
                className="shrink-0 text-xs font-semibold text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 rounded-xl px-3 py-1.5 transition-colors flex items-center gap-1.5"
              >
                <action.icon className="w-3.5 h-3.5 text-indigo-500" />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Pending Attachment Preview — shown before send */}
        {(uploading || pendingAttachment) && (
          <div className="mx-4 mt-2 shrink-0">
            {uploading ? (
              <div className="flex items-center gap-2.5 bg-indigo-50 border border-indigo-200/80 rounded-2xl px-4 py-3">
                <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
                <div>
                  <p className="text-xs font-bold text-indigo-700">Uploading & analyzing...</p>
                  <p className="text-[10px] text-indigo-500">Extracting text from your file</p>
                </div>
              </div>
            ) : pendingAttachment && (
              <div className="flex items-center justify-between bg-indigo-50/80 border border-indigo-200/70 rounded-2xl px-3 py-2.5">
                <div className="flex items-center gap-2.5 truncate pr-2 min-w-0">
                  {isImage(pendingAttachment.file_type, pendingAttachment.file_name) && pendingAttachment.file_url ? (
                    <img
                      src={pendingAttachment.file_url}
                      alt="thumbnail"
                      className="w-10 h-10 rounded-xl object-cover border border-indigo-200 shrink-0"
                    />
                  ) : (
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                  <div className="truncate min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate" title={pendingAttachment.file_name}>
                      {pendingAttachment.file_name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">
                      {getFileExt(pendingAttachment.file_name, pendingAttachment.file_type)}
                      {pendingAttachment.file_size ? ` • ${formatFileSize(pendingAttachment.file_size)}` : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPendingAttachment(null)}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                  title="Remove attachment"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Input Area */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-end gap-3"
          >
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg,.webp"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || loading}
              className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-2xl transition-all disabled:opacity-50 shrink-0"
              title="Upload Document or Image (.pdf, .docx, .pptx, .txt, .png, .jpg)"
            >
              {uploading
                ? <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                : <Paperclip className="w-5 h-5" />
              }
            </button>

            {/* Input Textarea */}
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl p-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
              <textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything or analyze material... (Press Shift+Enter for new line)"
                rows={1}
                disabled={loading}
                className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none resize-none max-h-32 custom-scrollbar"
              />
            </div>

            {/* Send / Stop Button */}
            {loading ? (
              <button
                type="button"
                onClick={stopGeneration}
                className="p-3 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl transition-all shadow-md shadow-rose-100 shrink-0"
                title="Stop generating"
              >
                <StopCircle className="w-5 h-5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!inputMessage.trim() || loading}
                className="p-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-100 shrink-0"
              >
                <Send className="w-5 h-5" />
              </button>
            )}
          </form>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteModalConv && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Conversation?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Are you sure you want to delete <span className="font-semibold text-slate-700">"{deleteModalConv.title}"</span>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalConv(null)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteConversation(deleteModalConv.id)}
                className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-sm"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreviewModal
          url={previewImage.url}
          name={previewImage.name}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}
