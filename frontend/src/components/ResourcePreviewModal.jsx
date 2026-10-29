import { useState, useEffect } from 'react';
import { X, Download, ExternalLink, FileText, AlertCircle, Loader2, Eye, Play } from 'lucide-react';
import api from '../api/axios';

export default function ResourcePreviewModal({ resource, onClose }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [officeUrl, setOfficeUrl] = useState(null);
  const [externalEmbed, setExternalEmbed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!resource) return;

    const ext = (resource.file_name || resource.fileName || '').split('.').pop().toLowerCase();
    setLoading(true);
    setError(false);
    setErrorMessage('');
    setBlobUrl(null);
    setOfficeUrl(null);
    setExternalEmbed(null);

    // If resource is external link (YouTube or Google Drive)
    const extUrl = resource.external_url || resource.externalUrl;
    const provider = resource.external_provider || resource.externalProvider;

    if (extUrl && !resource.cloudinary_public_id && !resource.cloudinaryPublicId) {
      if (provider === 'YOUTUBE' || extUrl.includes('youtube.com') || extUrl.includes('youtu.be')) {
        let embed = extUrl;
        if (extUrl.includes('watch?v=')) {
          const vId = extUrl.split('watch?v=')[1]?.split('&')[0];
          embed = `https://www.youtube.com/embed/${vId}`;
        } else if (extUrl.includes('youtu.be/')) {
          const vId = extUrl.split('youtu.be/')[1]?.split('?')[0];
          embed = `https://www.youtube.com/embed/${vId}`;
        }
        setExternalEmbed({ type: 'YOUTUBE', url: embed, rawUrl: extUrl });
        setLoading(false);
        return;
      }

      if (provider === 'GOOGLE_DRIVE' || extUrl.includes('drive.google.com')) {
        let preview = extUrl;
        if (extUrl.includes('/view')) {
          preview = extUrl.replace(/\/view(\?.*)?$/, '/preview');
        } else if (!extUrl.includes('/preview')) {
          preview = `${extUrl}/preview`;
        }
        setExternalEmbed({ type: 'GOOGLE_DRIVE', url: preview, rawUrl: extUrl });
        setLoading(false);
        return;
      }
    }

    // Fetch secure signed URL
    api.get(`/student-resources/${resource.id}/signed-url`)
      .then(res => {
        const signedUrl = res.data.url;
        if (res.data.is_external && res.data.url) {
          window.open(res.data.url, '_blank', 'noopener,noreferrer');
          onClose();
          return;
        }

        if (ext === 'pdf' || ext === 'txt' || !ext) {
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
        console.warn('Signed URL fetch error, falling back to direct stream view:', err);
        // Fallback to view stream endpoint for approved public resource or authenticated session
        const fallbackViewUrl = `/api/student-resources/${resource.id}/view`;
        if (ext === 'pdf' || ext === 'txt') {
          setBlobUrl(fallbackViewUrl);
          setLoading(false);
        } else {
          setError(true);
          setErrorMessage(err.response?.data?.error || 'Document preview is unavailable.');
          setLoading(false);
        }
      });
  }, [resource]);

  const handleDownload = async () => {
    try {
      const res = await api.get(`/student-resources/${resource.id}/signed-url?download=true`);
      if (res.data?.url) {
        const a = document.createElement('a');
        a.href = res.data.url;
        a.download = res.data.file_name || resource.file_name || resource.fileName || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        // Direct stream download
        window.open(`/api/student-resources/${resource.id}/download`, '_blank');
      }
    } catch (err) {
      console.warn('Signed-url download fallback:', err);
      window.open(`/api/student-resources/${resource.id}/download`, '_blank');
    }
  };

  const handleOpenInNewTab = () => {
    if (externalEmbed?.rawUrl) {
      window.open(externalEmbed.rawUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (blobUrl) {
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    window.open(`/api/student-resources/${resource.id}/view`, '_blank', 'noopener,noreferrer');
  };

  if (!resource) return null;

  const fileName = resource.file_name || resource.fileName || resource.title;
  const ext = fileName?.split('.').pop().toUpperCase() || 'FILE';

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
                {resource.subject_name || resource.subject || 'Academic Resource'} • {fileName} ({ext})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenInNewTab}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Open in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden sm:inline">Open in Tab</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download Document"
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
                {errorMessage || 'This file cannot be previewed directly in the browser. You can open it in a new window or download the file to your device.'}
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  onClick={handleOpenInNewTab}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Open in Tab</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Document</span>
                </button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {externalEmbed?.type === 'YOUTUBE' ? (
                <div className="w-full h-full p-4 flex items-center justify-center bg-black">
                  <iframe
                    src={externalEmbed.url}
                    title={resource.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full max-w-4xl aspect-video rounded-2xl shadow-2xl border-0"
                  />
                </div>
              ) : externalEmbed?.type === 'GOOGLE_DRIVE' ? (
                <div className="w-full h-full flex flex-col">
                  <iframe
                    src={externalEmbed.url}
                    title={resource.title}
                    className="w-full flex-1 border-0"
                  />
                </div>
              ) : officeUrl ? (
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
                  <p className="text-sm font-bold text-slate-700 mb-3">Resource Ready</p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleOpenInNewTab}
                      className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Open File</span>
                    </button>
                    <button
                      onClick={handleDownload}
                      className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download File</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
