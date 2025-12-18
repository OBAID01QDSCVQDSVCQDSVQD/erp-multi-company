'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    HomeIcon,
    CreditCardIcon,
    BuildingOfficeIcon,
    UserGroupIcon,
    Cog6ToothIcon,
    XMarkIcon,
    ClipboardDocumentListIcon,
    TagIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';

interface AdminSidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
}

export default function AdminSidebar({ sidebarOpen, setSidebarOpen }: AdminSidebarProps) {
    const pathname = usePathname();

    const navigation = [
        { name: 'Vue d\'ensemble', href: '/admin', icon: HomeIcon },
        { name: 'Entreprises', href: '/companies', icon: BuildingOfficeIcon },
        { name: 'Utilisateurs', href: '/admin/users', icon: UserGroupIcon },
        { name: 'Abonnements', href: '/admin/subscriptions', icon: CreditCardIcon },
        { name: 'Plans', href: '/admin/plans', icon: TagIcon },
        { name: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardDocumentListIcon },
        { name: 'Paramètres', href: '/admin/settings', icon: Cog6ToothIcon },
    ];

    return (
        <>
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar container */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                <div className="flex flex-col h-full">
                    {/* Logo area */}
                    <div className="flex items-center justify-between h-16 px-4 bg-slate-950 text-white">
                        <div className="flex items-center space-x-2">
                            <span className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 text-transparent bg-clip-text">
                                SUPER ADMIN
                            </span>
                        </div>
                        <button
                            className="lg:hidden text-gray-400 hover:text-white"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <XMarkIcon className="h-6 w-6" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                        {navigation.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link
                                    key={item.name}
                                    href={item.href}
                                    className={`group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${isActive
                                        ? 'bg-emerald-600 text-white shadow-md'
                                        : 'text-gray-300 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <item.icon
                                        className={`mr-3 flex-shrink-0 h-5 w-5 transition-colors ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                                            }`}
                                        aria-hidden="true"
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>

                    {/* Footer / User Info */}
                    <div className="p-4 border-t border-slate-800 bg-slate-950">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-xs">
                                    SA
                                </div>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm font-medium text-white">Administrateur</p>
                                <p className="text-xs text-gray-400">Système Global</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
