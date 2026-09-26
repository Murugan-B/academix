import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle, Loader2 } from 'lucide-react';
import api from '../api/axios';

export default function ResourcePreviewModal({ resource, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [officeUrl, setOfficeUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!resource) return;

    const ext = resource.file_name?.split('.').pop().toLowerCase();
    setLoading(true);
    setError(false);
    setBlobUrl(null);
    setOfficeUrl(null);

    // Fetch secure signed URL
    api.get(`/student-resources/${resource.id}/signed-url`)
      .then(res => {
        const signedUrl = res.data.url;
        if (ext === 'pdf' || ext === 'txt') {
          setBlobUrl(signedUrl);
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
        console.error('Resource preview error:', err);
        setError(true);
        setLoading(false);
      });
  }, [resource]);

  const handleDownload = async () => {
    try {
      const res = await api.get(`/student-resources/${resource.id}/signed-url?download=true`);
      if (res.data?.url) {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = resource.file_name || 'download';
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

  if (!resource) return null;

  const ext = resource.file_name?.split('.').pop().toUpperCase() || 'FILE';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-200/80 animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-150 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h2 className="text-base font-black text-slate-800 truncate">{resource.title}</h2>
              <p className="text-xs text-slate-500 font-medium truncate">
                {resource.subject_name || 'Academic Resource'} • {resource.file_name} ({ext})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download</span>
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

        {/* Modal Content */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs font-bold">Loading document preview...</p>
            </div>
          )}

          {error && !loading && (
            <div className="max-w-md p-8 bg-white rounded-3xl text-center space-y-4 shadow-sm border border-slate-200 mx-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-800">Preview Unavailable</h3>
              <p className="text-xs text-slate-500">
                This file cannot be previewed directly in the browser. You can download the file to view it on your device.
              </p>
              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-md cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
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
                    <span>Download File</span>
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
