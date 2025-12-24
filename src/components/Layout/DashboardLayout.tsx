'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [announcement, setAnnouncement] = useState('');
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;
        if (!session) {
            router.push('/auth/signin');
        } else {
            // Fetch settings when authenticated
            fetch('/api/system-settings')
                .then(res => res.json())
                .then(data => {
                    if (data?.announcementMessage) setAnnouncement(data.announcementMessage);
                })
                .catch(console.error);
        }
    }, [session, status, router]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!session) {
        return null;
    }

    return (
        <div className="h-screen flex overflow-hidden bg-gray-100 dark:bg-gray-900">
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                <Header onMenuClick={() => setSidebarOpen(true)} />
                {announcement && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700/50 px-4 py-2 relative z-30">
                        <div className="max-w-7xl mx-auto flex items-center justify-center">
                            <span className="text-amber-800 dark:text-amber-200 text-sm font-medium text-center flex items-center gap-2">
                                <span className="text-lg">📢</span> {announcement}
                            </span>
                        </div>
                    </div>
                )}
                <main className="flex-1 relative overflow-y-auto focus:outline-none">
                    <div className="py-6">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
