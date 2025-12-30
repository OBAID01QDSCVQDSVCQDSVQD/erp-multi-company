'use client';

import { Fragment, useEffect, useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { useSession } from 'next-auth/react';
import { useTenantId } from '@/hooks/useTenantId';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Notification {
    _id: string;
    title: string;
    message: string;
    type: string;
    link?: string;
    createdAt: string;
    status: 'read' | 'unread';
}

export default function NotificationDropdown() {
    const { data: session } = useSession();
    const { tenantId } = useTenantId();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (tenantId && session) {
            fetchNotifications();
            // Optional: Polling every 60s
            const interval = setInterval(fetchNotifications, 60000);
            return () => clearInterval(interval);
        }
    }, [tenantId, session]);

    const fetchNotifications = async () => {
        if (!tenantId) return;
        try {
            const res = await fetch('/api/notifications', {
                headers: { 'X-Tenant-Id': tenantId }
            });
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
            }
        } catch (err) {
            console.error('Failed to fetch notifications', err);
        }
    };

    const markAsRead = async (id: string, link?: string) => {
        try {
            await fetch(`/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'X-Tenant-Id': tenantId || '' }
            });

            // Optimistic update: Mark as read without removing
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: 'read' as const } : n));
            // Unread count is handled globally now on open

            if (link) {
                router.push(link);
            }
        } catch (err) {
            console.error('Failed to mark as read', err);
        }
    };

    const handleOpen = async () => {
        if (unreadCount > 0) {
            setUnreadCount(0); // Optimistic
            try {
                await fetch('/api/notifications/mark-all-read', {
                    method: 'PUT',
                    headers: { 'X-Tenant-Id': tenantId || '' }
                });
            } catch (err) {
                console.error('Failed to mark all as read', err);
            }
        }
    };

    return (
        <Menu as="div" className="relative ml-3">
            <div>
                <Menu.Button
                    onClick={handleOpen}
                    className="relative rounded-full bg-white dark:bg-gray-800 p-1 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                    <span className="sr-only">Voir les notifications</span>
                    <BellIcon className="h-6 w-6" aria-hidden="true" />
                    {unreadCount > 0 && (
                        <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[16px] transform -translate-y-1/4 translate-x-1/4">
                            {unreadCount}
                        </span>
                    )}
                </Menu.Button>
            </div>
            <Transition
                as={Fragment}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-80 origin-top-right rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-sm text-gray-500">
                                Aucune nouvelle notification
                            </div>
                        ) : (
                            notifications.map((notification) => (
                                <Menu.Item key={notification._id}>
                                    {({ active }) => (
                                        <div
                                            onClick={() => markAsRead(notification._id, notification.link)}
                                            className={`${active ? 'bg-gray-50 dark:bg-gray-700' : ''
                                                } block px-4 py-3 cursor-pointer border-b border-gray-50 dark:border-gray-750 last:border-0`}
                                        >
                                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {notification.title}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                                            </p>
                                        </div>
                                    )}
                                </Menu.Item>
                            ))
                        )}
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
