import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, User, Clock, ArrowLeft, Calendar, Sparkles } from 'lucide-react';
import api from '../api/axios';

export default function AIChatbotPanel({ material, onClose }) {
  const [provider, setProvider] = useState('Gemini');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Preparing material for AI...');
  const [error, setError] = useState('');
  
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
  }, [material]);

  useEffect(() => {
    let timer;
    if (loading) {
      setLoadingText('Preparing material for AI...');
      timer = setTimeout(() => {
        setLoadingText('Generating answer...');
      }, 2500);
    }
    if (!showHistory) {
      scrollToBottom();
    }
    return () => clearTimeout(timer);
  }, [messages, loading, showHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/ai/chat/${material.id}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setError('');

    // Optimistically add user message
    const tempUserMsg = {
      id: Date.now(),
      role: 'user',
      message: userMsg,
      provider: provider,
      created_at: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, tempUserMsg]);
    setLoading(true);

    try {
      const res = await api.post('/ai/chat', {
        materialId: material.id,
        provider: provider.toLowerCase(),
        question: userMsg
      });
      
      // We expect the backend to return the assistant message.
      // But we need to ensure the user message is also properly saved/IDed.
      // Wait, aiController returns ONLY the assistant message: res.json(saveResult.rows[0]);
      // The user message is saved but not returned. It's fine for optimistic UI, but on refresh it gets the real ID.
      
      setMessages(prev => {
        // Find the optimistic message and keep it, append the actual response
        return [...prev, res.data];
      });
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to get an answer.');
    } finally {
      setLoading(false);
    }
  };

  // Group messages into Q&A pairs for history view
  const groupedHistory = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'user' && i + 1 < messages.length && messages[i+1].role === 'assistant') {
      groupedHistory.push({
        id: messages[i].id,
        question: messages[i].message,
        answer: messages[i+1].message,
        provider: messages[i+1].provider || messages[i].provider,
        created_at: messages[i].created_at
      });
      i++;
    }
  }
  groupedHistory.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // --- Render Functions ---

  const renderHistoryList = () => (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50">
      {groupedHistory.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
          <Clock className="w-12 h-12 text-slate-300 mb-4" />
          <p className="font-bold text-slate-700 mb-2">No History Yet</p>
          <p className="text-sm">Conversations you have with the AI will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedHistory.map(item => (
            <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => setSelectedHistoryItem(item)}>
              <h3 className="font-bold text-slate-800 text-sm mb-2 line-clamp-2">{item.question}</h3>
              <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-1 rounded-md">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span className="capitalize">{item.provider}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(item.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-slate-600 line-clamp-2 border-t border-slate-100 pt-3">{item.answer}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderHistoryDetail = () => (
    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 flex flex-col gap-4">
      {/* User Question */}
      <div className="flex gap-3 max-w-[85%] self-end flex-row-reverse">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-indigo-600 text-white">
          <User className="w-4 h-4" />
        </div>
        <div className="p-3 rounded-2xl text-sm bg-indigo-600 text-white rounded-tr-sm">
          <p className="whitespace-pre-wrap">{selectedHistoryItem.question}</p>
        </div>
      </div>

      {/* AI Answer */}
      <div className="flex gap-3 max-w-[85%] self-start">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">
          <Bot className="w-4 h-4" />
        </div>
        <div className="p-3 rounded-2xl text-sm bg-white border border-slate-200 text-slate-700 rounded-tl-sm w-full">
          <div className="flex items-center gap-3 text-xs text-slate-500 mb-3 pb-2 border-b border-slate-100">
            <span className="flex items-center gap-1 font-medium text-indigo-600">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="capitalize">{selectedHistoryItem.provider}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(selectedHistoryItem.created_at).toLocaleString()}
            </span>
          </div>
          <p className="whitespace-pre-wrap leading-relaxed">{selectedHistoryItem.answer}</p>
        </div>
      </div>
    </div>
  );

  const renderChat = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/50 flex flex-col gap-4">
        {messages.length === 0 && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <Bot className="w-12 h-12 text-indigo-200 mb-4" />
            <p className="font-bold text-slate-700 mb-2">Hello! Ask me anything about this material.</p>
            <p className="text-sm">I'll do my best to answer based on the provided text.</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}>
            <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>
            <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3 max-w-[85%] self-start">
            <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-slate-200 text-slate-600">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
              <span className="text-[10px] text-slate-400 animate-pulse">{loadingText}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 text-rose-600 text-sm border border-rose-200 rounded-xl self-center max-w-[85%] text-center">
            {error}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white shrink-0">
        <form onSubmit={sendMessage} className="relative">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about this material..."
            disabled={loading}
            className="w-full bg-slate-50 border border-slate-200 rounded-full pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow disabled:opacity-50"
          />
          <button 
            type="submit"
            disabled={!input.trim() || loading}
            className="absolute right-1 top-1 bottom-1 p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors flex items-center justify-center aspect-square"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 animate-in slide-in-from-right-8 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          {showHistory ? (
            <button 
              onClick={() => {
                if (selectedHistoryItem) {
                  setSelectedHistoryItem(null);
                } else {
                  setShowHistory(false);
                }
              }} 
              className="p-1.5 -ml-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
              <MessageSquare className="w-5 h-5" />
            </div>
          )}
          <div>
            <h2 className="font-bold text-slate-800">
              {showHistory ? (selectedHistoryItem ? 'Conversation Details' : 'Ask AI History') : 'Ask AI'}
            </h2>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{material.title}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!showHistory && (
            <>
              <button 
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                History
              </button>
              <div className="w-px h-6 bg-slate-200 mx-1"></div>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Gemini">Gemini</option>
                <option value="DeepSeek">DeepSeek</option>
              </select>
            </>
          )}
          <button onClick={onClose} className="p-2 ml-1 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showHistory 
        ? (selectedHistoryItem ? renderHistoryDetail() : renderHistoryList()) 
        : renderChat()
      }
    </div>
  );
}
