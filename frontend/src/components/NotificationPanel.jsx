import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import api from '../api/axios';

export default function NotificationPanel() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const notifRes = await api.get('/notifications');
      setNotifications(notifRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking as read', err);
    }
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
        {notifications.filter(n => !n.is_read).length > 0 && (
          <span className="bg-rose-100 text-rose-600 text-xs font-bold px-2 py-1 rounded-full">
            {notifications.filter(n => !n.is_read).length} New
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {notifications.length === 0 ? (
          <p className="text-slate-500 text-sm p-4 text-center">No notifications yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 transition-colors ${!notif.is_read ? 'bg-indigo-50/50' : ''}`}
              >
                <div className="flex justify-between items-start mb-1">
                  <h4 className={`text-sm ${!notif.is_read ? 'font-bold text-slate-900' : 'font-semibold text-slate-700'}`}>
                    {!notif.is_read && <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-2" />}
                    {notif.title}
                  </h4>
                  <span className="text-xs text-slate-400 shrink-0 ml-2">
                    {new Date(notif.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{notif.message}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    From: {notif.sender_name} ({notif.sender_role.replace('_', ' ')})
                  </span>
                  {!notif.is_read && (
                    <button 
                      onClick={() => markAsRead(notif.id)}
                      className="text-xs text-indigo-600 font-bold hover:text-indigo-800"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
