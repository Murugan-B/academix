import React, { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X, History, ChevronRight, Download } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import pdfMake from "pdfmake/build/pdfmake";
import * as pdfFonts from "pdfmake/build/vfs_fonts";
import htmlToPdfmake from "html-to-pdfmake";
import api from '../api/axios';

// Initialize pdfMake fonts
pdfMake.vfs = pdfFonts.default?.pdfMake?.vfs || pdfFonts.pdfMake?.vfs || pdfFonts.default || pdfFonts;

export default function AISummaryPanel({ material, subject, onClose }) {
  const [provider, setProvider] = useState('Gemini');
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('Preparing material for AI...');
  const [error, setError] = useState('');
  const [view, setView] = useState('summary'); // 'summary' or 'history'
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [material]);

  useEffect(() => {
    let timer;
    if (loading) {
      setLoadingText('Preparing material for AI...');
      timer = setTimeout(() => {
        setLoadingText('Generating summary...');
      }, 2500);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  const fetchHistory = async () => {
    try {
      const res = await api.get(`/ai/summaries/${material.id}`);
      setHistory(res.data);
      if (res.data.length > 0 && !summary) {
        setSummary(res.data[0]); // Show latest by default
      }
    } catch (err) {
      console.error('Failed to fetch summary history:', err);
    }
  };

  const generateSummary = async (e, isRegenerating = false) => {
    if (e && e.preventDefault) e.preventDefault();
    if (loading) return; // Prevent duplicate requests
    
    setLoading(true);
    setError('');
    
    if (isRegenerating) {
      console.log('[REGENERATE] request started');
      console.log(`[REGENERATE] materialId: ${material.id}`);
      console.log(`[REGENERATE] filename: ${material.title}`);
      console.log(`[REGENERATE] model: ${provider}`);
    }

    try {
      const res = await api.post('/ai/summarize', {
        materialId: material.id,
        provider: provider.toLowerCase(),
        forceRegenerate: isRegenerating
      });
      
      if (isRegenerating) {
        console.log('[REGENERATE] API response received');
        console.log(`[REGENERATE] summary length: ${res.data.summary_content?.length}`);
      }
      
      setSummary(res.data);
      fetchHistory(); // Refresh history
      
      if (isRegenerating) {
        console.log('[REGENERATE] history saved');
      }
    } catch (err) {
      if (isRegenerating) {
        console.error('[REGENERATE] Error:', err);
      }
      setError('Unable to regenerate summary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (downloadingPdf || !summary) return;
    
    setDownloadingPdf(true);
    setError('');
    
    try {
      const summaryElement = document.getElementById('ai-summary-content');
      if (!summaryElement) throw new Error('Summary content not found');
      
      const htmlContent = summaryElement.innerHTML;
      const parsedHtml = htmlToPdfmake(htmlContent, {
        defaultStyles: {
          p: { margin: [0, 5, 0, 10] },
          h1: { fontSize: 18, bold: true, margin: [0, 15, 0, 10] },
          h2: { fontSize: 16, bold: true, margin: [0, 12, 0, 8] },
          h3: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
          ul: { margin: [0, 0, 0, 10] },
          ol: { margin: [0, 0, 0, 10] },
          strong: { bold: true }
        }
      });
      
      const docDefinition = {
        pageSize: 'A4',
        pageMargins: [40, 60, 40, 60],
        header: function(currentPage, pageCount) {
          if (currentPage === 1) return null; // Don't show header on first page
          return {
            text: `Academix • ${material.title} • AI Summary`,
            alignment: 'right',
            margin: [40, 20, 40, 0],
            fontSize: 8,
            color: '#64748b'
          };
        },
        footer: function(currentPage, pageCount) {
          return {
            text: `Academix • AI Generated Summary • Page ${currentPage}`,
            alignment: 'center',
            margin: [0, 20, 0, 0],
            fontSize: 9,
            color: '#64748b'
          };
        },
        content: [
          // Title Page / Header
          { text: 'Academix', fontSize: 18, bold: true, color: '#4f46e5', margin: [0, 0, 0, 5] },
          { text: 'AI Generated Summary', fontSize: 13, color: '#64748b', margin: [0, 0, 0, 15] },
          {
            table: {
              widths: ['auto', '*'],
              body: [
                [{ text: 'Subject:', bold: true, color: '#334155', border: [false, false, false, false] }, { text: subject?.name || 'Unknown', color: '#334155', border: [false, false, false, false] }],
                [{ text: 'Material:', bold: true, color: '#334155', border: [false, false, false, false] }, { text: material.title, color: '#334155', border: [false, false, false, false] }],
                [{ text: 'AI Model:', bold: true, color: '#334155', border: [false, false, false, false] }, { text: summary.provider, color: '#334155', border: [false, false, false, false] }],
                [{ text: 'Generated Date:', bold: true, color: '#334155', border: [false, false, false, false] }, { text: new Date(summary.created_at).toLocaleString(), color: '#334155', border: [false, false, false, false] }]
              ]
            },
            layout: 'noBorders',
            margin: [0, 0, 0, 20]
          },
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e2e8f0' }], margin: [0, 0, 0, 20] },
          // Parsed Markdown
          ...parsedHtml
        ],
        defaultStyle: {
          fontSize: 11,
          color: '#334155',
          lineHeight: 1.4
        }
      };
      
      const safeTitle = material.title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
      const safeSubject = (subject?.name || 'Subject').replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
      const filename = `Academix_${safeSubject}_${safeTitle}_AI_Summary.pdf`;
      
      pdfMake.createPdf(docDefinition).download(filename);
      
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setError('Unable to download summary PDF. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-slate-200 animate-in slide-in-from-right-8 duration-300">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800">AI Summary</h2>
            <p className="text-xs text-slate-500 truncate max-w-[200px]">{material.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {view === 'summary' ? (
            <button 
              onClick={() => setView('history')}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <History className="w-3.5 h-3.5" /> History
            </button>
          ) : (
            <button 
              onClick={() => setView('summary')}
              className="text-xs font-bold text-slate-500 hover:text-indigo-600 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" /> Current
            </button>
          )}
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {view === 'summary' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Model:</span>
              <select 
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-sm font-bold text-slate-700 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Gemini">Gemini</option>
                <option value="DeepSeek">DeepSeek</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {summary && (
                <button
                  onClick={downloadPDF}
                  disabled={loading || downloadingPdf}
                  className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 disabled:opacity-50 transition-colors"
                >
                  {downloadingPdf ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download PDF
                </button>
              )}
              <button
                onClick={(e) => generateSummary(e, !!summary)}
                disabled={loading}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? (summary ? 'Regenerating Summary...' : 'Generating...') : (summary ? 'Regenerate' : 'Generate Summary')}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50/50">
            {error && (
              <div className="mb-4 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="font-medium animate-pulse">{loadingText}</p>
              </div>
            ) : summary ? (
              <div className="prose prose-sm prose-slate max-w-none">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
                   <span className="text-xs font-bold bg-slate-200 text-slate-600 px-2 py-1 rounded-full uppercase tracking-wider">
                     {summary.provider}
                   </span>
                   <span className="text-xs text-slate-400 font-medium">
                     {new Date(summary.created_at).toLocaleString()}
                   </span>
                </div>
                <div id="ai-summary-content" className="prose-markdown leading-relaxed text-slate-700">
                  <ReactMarkdown>{summary.summary_content}</ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
                <Sparkles className="w-12 h-12 text-slate-300 mb-4" />
                <p className="font-medium mb-2">No summary generated yet.</p>
                <p className="text-sm">Select an AI model and click Generate to start.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* History View */
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
          <h3 className="font-bold text-slate-700 mb-4 px-2">Summary History</h3>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10">No history found.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => {
                    setSummary(item);
                    setView('summary');
                  }}
                  className="p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-300 cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase">
                      {item.provider}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 line-clamp-2">
                    {item.summary_content}
                  </p>
                  <div className="mt-2 text-right">
                    <span className="text-xs font-bold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                      View <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
