'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === 'loading') return;

        // Strict redirect for non-admins
        if (!session || session.user.role !== 'admin') {
            // Ideally redirect or show access denied. 
            // For now, let's just redirect to home or signin
            if (!session) router.push('/auth/signin');
            // If logged in but not admin, maybe redirect to user dashboard?
            // router.push('/dashboard'); 
        }
    }, [session, status, router]);

    if (status === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    // Double check roughly for rendering
    if (!session || session.user.role !== 'admin') {
        // You might want to render a forbidden page here instead
        return null;
    }

    return (
        <div className="h-screen flex overflow-hidden bg-gray-50 dark:bg-gray-900 font-sans">
            <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                <AdminHeader onMenuClick={() => setSidebarOpen(true)} />

                <main className="flex-1 relative overflow-y-auto focus:outline-none scrollbar-thin scrollbar-thumb-gray-300">
                    <div className="py-8">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
                            {children}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
