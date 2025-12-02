'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  status: 'unread' | 'read' | 'archived';
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread'>('all');

  const extractInvoiceNumero = (title: string): string | null => {
    // Exemple de titre: "Facture en attente - FAC-2025-00020"
    const match = title.match(/(FAC-\d{4}-\d+)/);
    return match ? match[1] : null;
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/notifications?status=${statusFilter}&limit=100`,
        { cache: 'no-store' }
      );
      if (res.ok) {
        const data = await res.json();
        const items: NotificationItem[] = data.notifications || [];

        // Trier: فواتير en attente حسب رقم الفاتورة من الأحدث إلى الأقدم
        const sorted = [...items].sort((a, b) => {
          const isInvA = a.type === 'invoice_overdue';
          const isInvB = b.type === 'invoice_overdue';

          if (isInvA && isInvB) {
            const numA = extractInvoiceNumero(a.title);
            const numB = extractInvoiceNumero(b.title);

            if (numA && numB && numA !== numB) {
              // مقارنة رقمية داخل النص (00020 > 00012)
              return numB.localeCompare(numA, 'fr-FR', { numeric: true });
            }
          }

          // fallback: أحدث إنشاء أولاً
          const dateA = new Date(a.createdAt).getTime();
          const dateB = new Date(b.createdAt).getTime();
          return dateB - dateA;
        });

        setNotifications(sorted);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [statusFilter]);

  const markAllRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (res.ok) {
        fetchNotifications();
      }
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            Notifications
          </h1>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'all' | 'unread')
              }
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="all">Toutes</option>
              <option value="unread">Non lues</option>
            </select>
            <button
              onClick={markAllRead}
              className="px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700"
            >
              Tout marquer comme lu
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {loading ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              Chargement...
            </div>
          ) : notifications.length === 0 ? (
            <div className="py-10 text-center text-gray-500 text-sm">
              Aucune notification à afficher.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {notifications.map((notif) => (
                <li
                  key={notif._id}
                  className={`px-4 py-3 text-sm ${
                    notif.status === 'unread' ? 'bg-indigo-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="font-semibold text-gray-900">
                        {notif.title}
                      </p>
                      <p className="text-gray-700 mt-1">{notif.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {formatDate(notif.createdAt)}
                      </p>
                      {notif.link && (
                        <a
                          href={notif.link}
                          className="inline-block mt-1 text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Voir les détails
                        </a>
                      )}
                    </div>
                    {notif.status === 'unread' && (
                      <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}


