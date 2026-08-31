import React, { useState, useEffect } from 'react';
import { X, Download, AlertCircle } from 'lucide-react';
import api from '../api/axios';

export default function MaterialPreviewModal({ material, isOpen, onClose, onDownload }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOpen || !material) return;
    
    const ext = material.file_name.split('.').pop().toLowerCase();
    let currentUrl = null;

    if (ext === 'pdf' || ext === 'txt') {
      setLoading(true);
      setError(false);
      setBlobUrl(null);

      api.get(`/academic/materials/${material.id}/view`, { responseType: 'blob' })
        .then(res => {
          currentUrl = window.URL.createObjectURL(res.data);
          setBlobUrl(currentUrl);
          setLoading(false);
        })
        .catch(err => {
          console.error('Preview error:', err);
          setError(true);
          setLoading(false);
        });
    }

    return () => {
      if (currentUrl) {
        window.URL.revokeObjectURL(currentUrl);
      }
    };
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  const ext = material.file_name.split('.').pop().toLowerCase();
  
  let previewContent = null;

  if (ext === 'pdf') {
    if (import.meta.env.DEV) {
      console.log('--- PREVIEW DEBUGGING ---');
      console.log('Original URL:', material.file_url);
      console.log('MIME type:', material.file_type);
      console.log('Original filename:', material.file_name);
      console.log('Preview URL (Blob):', blobUrl);
      console.log('Preview type:', 'Browser PDF Native Viewer (Blob API)');
      console.log('-------------------------');
    }
    
    if (loading) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p>Loading secure preview...</p>
        </div>
      );
    } else if (error || !blobUrl) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-4" />
          <p>Unable to retrieve preview. You can download the material instead.</p>
        </div>
      );
    } else {
      previewContent = (
        <iframe
          src={`${blobUrl}#toolbar=0`}
          className="w-full h-full border-0 rounded-b-xl"
          title={material.title}
        />
      );
    }
  } else if (['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)) {
    const previewFileUrl = material.file_url;
    const encodedUrl = encodeURIComponent(previewFileUrl);
    const officeUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodedUrl}`;

    if (import.meta.env.DEV) {
      console.log('--- PREVIEW DEBUGGING ---');
      console.log('Original URL:', material.file_url);
      console.log('MIME type:', material.file_type);
      console.log('Original filename:', material.file_name);
      console.log('Preview URL:', officeUrl);
      console.log('Preview type:', 'Microsoft Office Online Viewer');
      console.log('-------------------------');
    }

    const isPublic = previewFileUrl.startsWith('https://') && !previewFileUrl.includes('localhost');
    const hasCorrectExtension = previewFileUrl.toLowerCase().split('?')[0].endsWith(`.${ext}`);

    if (!isPublic || !hasCorrectExtension) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full bg-slate-50 rounded-b-xl text-slate-600 p-8 text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 mb-5" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Preview unavailable</h2>
          <p className="max-w-md mb-8">This file cannot be previewed in the browser. You can download the file instead.</p>
          <button
            onClick={() => {
              onClose();
              onDownload(material);
            }}
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-5 h-5" /> Download Material
          </button>
        </div>
      );
    } else {
      previewContent = (
        <div className="relative w-full h-full bg-slate-50 rounded-b-xl">
          {/* Fallback behind iframe just in case iframe is transparent or fails visibly */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
            <p>Loading Office Viewer...</p>
          </div>
          <iframe
            src={officeUrl}
            className="relative w-full h-full border-0 rounded-b-xl z-10 bg-white"
            title={material.title}
          />
        </div>
      );
    }
  } else if (ext === 'txt') {
    if (import.meta.env.DEV) {
      console.log('--- PREVIEW DEBUGGING ---');
      console.log('Original URL:', material.file_url);
      console.log('MIME type:', material.file_type);
      console.log('Original filename:', material.file_name);
      console.log('Preview URL (Blob):', blobUrl);
      console.log('Preview type:', 'Browser Fetch Text Preview (Blob API)');
      console.log('-------------------------');
    }
    if (loading) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p>Loading text preview...</p>
        </div>
      );
    } else if (error || !blobUrl) {
      previewContent = (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <AlertCircle className="w-12 h-12 text-rose-400 mb-4" />
          <p>Unable to preview this material.</p>
        </div>
      );
    } else {
      previewContent = (
        <iframe
          src={blobUrl}
          className="w-full h-full border-0 rounded-b-xl bg-white"
          title={material.title}
        />
      );
    }
  } else {
    previewContent = (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <AlertCircle className="w-12 h-12 text-slate-400 mb-4" />
        <p>Preview is not available for this file type.</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800">{material.title}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="font-semibold text-slate-700">{material.file_name}</span>
              <span>•</span>
              <span>{(material.file_size / 1024 / 1024).toFixed(2)} MB</span>
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden relative bg-slate-100">
          {previewContent}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onDownload(material);
            }}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-4 h-4" /> Download Material
          </button>
        </div>
      </div>
    </div>
  );
}
