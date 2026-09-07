import React, { useState, useEffect } from 'react';
import { Bell, X, ImageIcon } from 'lucide-react';
import api from '../api/axios';

export default function NotificationPanel() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [notifications, setNotifications] = useState([]);
  const [sentNotifications, setSentNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);

  // Check if current user is authorized to send notifications (not a student)
  const userStr = localStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  const canSend = user && user.role !== 'STUDENT';

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      if (activeTab === 'inbox') {
        const notifRes = await api.get('/notifications');
        setNotifications(notifRes.data);
      } else {
        const sentRes = await api.get('/notifications/sent');
        setSentNotifications(sentRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeTab]);

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read', err);
    }
  };

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    setSelectedNotification(notif);
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-500">Loading notifications...</div>;
  }

  return (
    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white flex flex-col h-[400px]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-5 h-5 text-rose-500" />
          Notifications
        </h2>
        {activeTab === 'inbox' && notifications.filter(n => !n.is_read).length > 0 && (
          <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-full">
            {notifications.filter(n => !n.is_read).length} New
          </span>
        )}
      </div>

      {canSend && (
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-2 pt-2">
          <button 
            onClick={() => setActiveTab('inbox')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'inbox' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Inbox
          </button>
          <button 
            onClick={() => setActiveTab('sent')}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${activeTab === 'sent' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            Sent
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-4">
        {loading ? (
          <p className="text-slate-500 text-sm p-4 text-center">Loading...</p>
        ) : activeTab === 'inbox' ? (
          notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="text-sm font-medium">No notifications yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* UNREAD SECTION */}
              <div>
                <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-indigo-100/60">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    Unread ({notifications.filter(n => !n.is_read).length})
                  </span>
                </div>
                {notifications.filter(n => !n.is_read).length === 0 ? (
                  <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl text-center">
                    <p className="text-xs font-semibold text-slate-400">No unread notifications</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.filter(n => !n.is_read).map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className="p-3.5 bg-indigo-50/70 hover:bg-indigo-50 border border-indigo-100/80 rounded-2xl transition-all cursor-pointer shadow-sm hover:shadow-md group"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-900 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                            <span className="truncate">{notif.title}</span>
                          </h4>
                          <span className="text-[11px] font-semibold text-indigo-600/80 shrink-0 ml-2 bg-indigo-100/60 px-2 py-0.5 rounded-full">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-2 line-clamp-2 pl-4">{notif.message}</p>
                        {notif.image_url && (
                          <div className="ml-4 mb-2 flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-white/80 border border-indigo-100 px-2 py-1 rounded-md w-fit shadow-xs">
                            <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Image Attached
                          </div>
                        )}
                        <div className="flex justify-between items-center pl-4 mt-1">
                          <span className="text-[11px] font-semibold text-slate-500 bg-white/80 border border-slate-200/60 px-2 py-0.5 rounded-md">
                            From: {notif.sender_name || 'Academic Office'} ({notif.sender_role ? notif.sender_role.replace('_', ' ') : 'System'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* READ SECTION */}
              <div>
                <div className="flex items-center justify-between px-2 pb-2 mb-1 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    Read ({notifications.filter(n => n.is_read).length})
                  </span>
                </div>
                {notifications.filter(n => n.is_read).length === 0 ? (
                  <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl text-center">
                    <p className="text-xs font-semibold text-slate-400">No read notifications</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.filter(n => n.is_read).map((notif) => (
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className="p-3 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all cursor-pointer opacity-90 hover:opacity-100"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-sm font-semibold text-slate-700 truncate">
                            {notif.title}
                          </h4>
                          <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                            {new Date(notif.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{notif.message}</p>
                        {notif.image_url && (
                          <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md w-fit">
                            <ImageIcon className="w-3.5 h-3.5" /> Image Attached
                          </div>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                            From: {notif.sender_name || 'Academic Office'} ({notif.sender_role ? notif.sender_role.replace('_', ' ') : 'System'})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        ) : (
          /* SENT TAB (for staff) */
          sentNotifications.length === 0 ? (
            <p className="text-slate-500 text-sm p-4 text-center">No sent notifications.</p>
          ) : (
            <div className="space-y-2">
              {sentNotifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => handleNotificationClick(notif)}
                  className="p-3.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-sm font-semibold text-slate-700 truncate">
                      {notif.title}
                    </h4>
                    <span className="text-[11px] text-slate-400 shrink-0 ml-2">
                      {new Date(notif.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2 line-clamp-2">{notif.message}</p>
                  {notif.image_url && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
                      <ImageIcon className="w-3.5 h-3.5" /> Image Attached
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Target: {notif.target_name ? notif.target_name : notif.recipient_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {selectedNotification && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">Notification Detail</h3>
              <button 
                onClick={() => setSelectedNotification(null)}
                className="p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar">
              <h2 className="text-xl font-bold text-slate-800 mb-2">{selectedNotification.title}</h2>
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                  {selectedNotification.sender_role.replace('_', ' ')}
                </span>
                <span className="text-sm font-medium text-slate-500">{selectedNotification.sender_name}</span>
                <span className="text-sm text-slate-400">•</span>
                <span className="text-sm text-slate-500">{new Date(selectedNotification.created_at).toLocaleString()}</span>
              </div>
              
              {selectedNotification.image_url && (
                <div className="mb-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex justify-center">
                  <a href={selectedNotification.image_url} target="_blank" rel="noreferrer" title="Click to view full image">
                    <img 
                      src={selectedNotification.image_url} 
                      alt="Notification Attachment" 
                      className="max-w-full h-auto max-h-[300px] object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                    />
                  </a>
                </div>
              )}
              
              <div className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedNotification(null)}
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
