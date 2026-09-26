import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle, Loader2, Bookmark, Sparkles, BookOpen } from 'lucide-react';
import api from '../api/axios';

/**
 * MaterialPreviewModal
 * Reusable modal for viewing official academic materials and AI citation sources.
 * Supports PDF (with page jump #page=N), PPTX, DOCX, Office Online Viewer, and secure Cloudinary downloads.
 */
export default function MaterialPreviewModal({ material, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [officeUrl, setOfficeUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const materialId = material?.material_id || material?.id;
  const materialTitle = material?.material_title || material?.title || material?.file_name || 'Academic Material';
  const fileName = material?.file_name || materialTitle;
  const pageNumber = material?.page_number;
  const slideNumber = material?.slide_number;
  const sectionTitle = material?.section_title;
  const excerpt = material?.excerpt;

  useEffect(() => {
    if (!materialId) {
      setError(true);
      setErrorMessage('Material identifier not provided.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setOfficeUrl(null);

    // Try official materials signed URL first, then fallback to student resources
    api.get(`/academic/materials/${materialId}/signed-url`)
      .catch(() => api.get(`/student-resources/${materialId}/signed-url`))
      .then(res => {
        const signedUrl = res.data?.url;
        if (!signedUrl) throw new Error('Signed download URL not returned from server.');

        const ext = (fileName.split('.').pop() || material?.file_type || 'pdf').toLowerCase();

        if (ext === 'pdf' || ext === 'txt') {
          // Append page number hash if available for PDF deep-linking
          const pdfTargetUrl = (ext === 'pdf' && pageNumber) ? `${signedUrl}#page=${pageNumber}` : signedUrl;
          setBlobUrl(pdfTargetUrl);
        } else if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
          if (signedUrl.startsWith('https://') && !signedUrl.includes('localhost')) {
            setOfficeUrl(`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(signedUrl)}`);
          } else {
            setBlobUrl(signedUrl);
          }
        } else {
          setBlobUrl(signedUrl);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Material preview fetch error:', err);
        setError(true);
        setErrorMessage(err.response?.data?.error || err.response?.data?.message || 'Unable to load material preview.');
        setLoading(false);
      });
  }, [materialId, fileName, pageNumber]);

  const handleDownload = async () => {
    if (!materialId) return;
    try {
      let res;
      try {
        res = await api.get(`/academic/materials/${materialId}/signed-url?download=true`);
      } catch {
        res = await api.get(`/student-resources/${materialId}/signed-url?download=true`);
      }

      if (res.data?.url) {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = fileName || 'academic_material';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        alert('File download URL is currently unavailable.');
      }
    } catch (err) {
      console.error('Download error:', err);
      alert(err.response?.data?.error || 'Unable to download file.');
    }
  };

  if (!material) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/90 shrink-0">
          <div className="flex items-center gap-3.5 overflow-hidden">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0 shadow-xs border border-indigo-100">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800 truncate">{materialTitle}</h2>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-extrabold uppercase rounded-full shrink-0">
                  Verified Academic Material
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5 flex items-center gap-1.5">
                <span>{material.subject_name || 'Academic Material'}</span>
                {material.unit_name && <span>• {material.unit_name}</span>}
                {material.topic_title && <span>• {material.topic_title}</span>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownload}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Citation Context Bar (if launched from AI citation) */}
        {(pageNumber || slideNumber || sectionTitle || excerpt) && (
          <div className="px-6 py-2.5 bg-amber-50/80 border-b border-amber-100/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="text-[11px] font-black text-amber-900 uppercase tracking-wide">
                Cited Location:
              </span>
              {pageNumber && (
                <span className="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-[11px] font-bold text-amber-800">
                  Page {pageNumber}
                </span>
              )}
              {slideNumber && (
                <span className="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-[11px] font-bold text-violet-800">
                  Slide {slideNumber}
                </span>
              )}
              {sectionTitle && (
                <span className="px-2 py-0.5 bg-white border border-amber-200 rounded-md text-[11px] font-bold text-slate-800">
                  {sectionTitle}
                </span>
              )}
            </div>
            {excerpt && (
              <p className="text-[11px] text-amber-950 font-medium italic truncate max-w-xl">
                "{excerpt}"
              </p>
            )}
          </div>
        )}

        {/* Modal Content / Preview Canvas */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold">Loading verified material preview...</p>
            </div>
          )}

          {error && !loading && (
            <div className="max-w-md p-8 bg-white rounded-3xl text-center space-y-4 shadow-sm border border-slate-200 mx-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Preview Unavailable</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {errorMessage || 'This file cannot be previewed directly in the browser iframe. You can download the verified material to inspect it.'}
              </p>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Material</span>
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              {officeUrl ? (
                <iframe
                  src={officeUrl}
                  className="w-full h-full border-0"
                  title="Document Preview"
                />
              ) : blobUrl ? (
                <iframe
                  src={blobUrl}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              ) : (
                <div className="text-center p-8 bg-white rounded-3xl shadow-sm border border-slate-200 max-w-md">
                  <p className="text-sm font-bold text-slate-700 mb-3">Preview ready</p>
                  <button
                    onClick={handleDownload}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Material</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
