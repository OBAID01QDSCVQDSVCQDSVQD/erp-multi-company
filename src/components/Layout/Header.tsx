'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useTenantId } from '@/hooks/useTenantId';
import { Bars3Icon, BellIcon, HomeIcon, UserCircleIcon, ChartBarIcon, ArrowRightOnRectangleIcon, CogIcon, BuildingOfficeIcon, ChevronDownIcon, CreditCardIcon, SunIcon, MoonIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface NotificationItem {
    _id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    status: 'unread' | 'read' | 'archived';
    createdAt: string;
}

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const { data: session } = useSession();
    const router = useRouter();
    const { tenantId } = useTenantId();
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [adminMenuOpen, setAdminMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [companySettings, setCompanySettings] = useState<any>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const adminTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const adminContainerRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);
    const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(false);

    // Search State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const [isFocused, setIsFocused] = useState(false); // State for full-width search mode
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Initialize dark mode
        if (
            localStorage.theme === 'dark' ||
            (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
        ) {
            setDarkMode(true);
            document.documentElement.classList.add('dark');
        } else {
            setDarkMode(false);
            document.documentElement.classList.remove('dark');
        }

        // Command + K Shortcut
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                if (searchContainerRef.current) {
                    const input = searchContainerRef.current.querySelector('input');
                    if (input) {
                        input.focus();
                        setIsFocused(true);
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const toggleTheme = () => {
        if (darkMode) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
            setDarkMode(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
            setDarkMode(true);
        }
    };

    // Check if user is the specific admin
    const isSystemAdmin = session?.user?.email === 'admin@entreprise-demo.com';

    // Check if user is admin (role or permissions) - use useMemo to recalculate when session changes
    const isAdmin = useMemo(() => {
        if (!session?.user) return false;
        const userRole = session.user.role;
        const userPermissions = session.user.permissions || [];
        const isAdminRole = userRole === 'admin';
        const hasAllPermissions = Array.isArray(userPermissions) && userPermissions.includes('all');
        return isAdminRole || hasAllPermissions;
    }, [session?.user]);

    // Clear timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (adminTimeoutRef.current) {
                clearTimeout(adminTimeoutRef.current);
            }
        };
    }, []);

    // Close notifications dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (notifRef.current && !notifRef.current.contains(target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const isDesktopSearch = searchContainerRef.current && searchContainerRef.current.contains(target);
            const isMobileSearch = mobileSearchContainerRef.current && mobileSearchContainerRef.current.contains(target);

            if (!isDesktopSearch && !isMobileSearch) {
                setShowSearchResults(false);
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const q = e.target.value;
        setSearchQuery(q);

        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

        if (q.length < 2) {
            setSearchResults([]);
            setShowSearchResults(false);
            return;
        }

        setIsSearching(true);
        // Keep showing previous results while loading new ones to avoid flicker, or clear?
        // Let's show loading state.
        setShowSearchResults(true);

        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=5`, {
                    headers: { 'X-Tenant-Id': tenantId || '' }
                });
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 300);
    };

    // Enter key navigation
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery) {
            setShowSearchResults(false);
            router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
        }
    };

    const extractInvoiceNumero = (title: string): string | null => {
        // Exemple: "Facture en attente - FAC-2025-00020"
        const match = title.match(/(FAC-\d{4}-\d+)/);
        return match ? match[1] : null;
    };

    // Fetch notifications on mount - Only for admin
    useEffect(() => {
        const userRole = session?.user?.role;
        const hasAllPermissions = session?.user?.permissions?.includes('all');
        const isUserAdmin = userRole === 'admin' || hasAllPermissions;

        if (session?.user && isUserAdmin) {
            fetchNotifications();
        }
    }, [session]);

    // Fetch company settings for logo
    useEffect(() => {
        if (tenantId) {
            fetch('/api/settings', {
                headers: { 'X-Tenant-Id': tenantId },
            })
                .then((res) => res.json())
                .then((data) => setCompanySettings(data))
                .catch((err) => console.error('Error fetching company settings:', err));
        }
    }, [tenantId]);

    const fetchNotifications = async () => {
        try {
            setLoadingNotifs(true);
            const res = await fetch('/api/notifications?status=all&limit=10', {
                cache: 'no-store',
            });
            if (res.ok) {
                const data = await res.json();
                const items = data.notifications || [];

                const sorted = [...items].sort((a: any, b: any) => {
                    const isInvA = a.type === 'invoice_overdue';
                    const isInvB = b.type === 'invoice_overdue';

                    if (isInvA && isInvB) {
                        const numA = extractInvoiceNumero(a.title);
                        const numB = extractInvoiceNumero(b.title);

                        if (numA && numB && numA !== numB) {
                            return numB.localeCompare(numA, 'fr-FR', { numeric: true });
                        }
                    }

                    const dateA = new Date(a.createdAt).getTime();
                    const dateB = new Date(b.createdAt).getTime();
                    return dateB - dateA;
                });

                setNotifications(sorted);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoadingNotifs(false);
        }
    };

    const markAsRead = async (id?: string, navigateTo?: string) => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(id ? { id } : { markAllRead: true }),
            });
            if (res.ok) {
                const data = await res.json();
                setUnreadCount(data.unreadCount || 0);
                // Update local state
                setNotifications((prev) =>
                    prev.map((n) =>
                        !id || n._id === id ? { ...n, status: 'read' } : n
                    )
                );
            }
        } catch (err) {
            console.error('Error updating notifications:', err);
        } finally {
            if (navigateTo) {
                router.push(navigateTo);
                setNotifOpen(false);
            }
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

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setUserMenuOpen(false);
        }, 300);
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setUserMenuOpen(true);
    };

    const handleAdminMenuLeave = () => {
        adminTimeoutRef.current = setTimeout(() => {
            setAdminMenuOpen(false);
        }, 300);
    };

    const handleAdminMenuEnter = () => {
        if (adminTimeoutRef.current) {
            clearTimeout(adminTimeoutRef.current);
            adminTimeoutRef.current = null;
        }
        setAdminMenuOpen(true);
    };

    return (
        <div className="relative z-40 flex-shrink-0 flex h-16 bg-white dark:bg-gray-800 shadow dark:border-b dark:border-gray-700" style={{ overflow: 'visible' }}>
            {!isFocused && (
                <button
                    type="button"
                    className="px-4 border-r border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden relative z-50"
                    onClick={onMenuClick}
                >
                    <Bars3Icon className="h-6 w-6" />
                </button>
            )}

            <div className="flex-1 px-4 flex justify-between items-center" style={{ overflow: 'visible' }}>
                <div className={`flex flex-1 ${isFocused ? '' : 'max-w-xl mr-4'} transition-all duration-300 ease-in-out`}>
                    <div className="w-full flex md:ml-0" ref={searchContainerRef}>
                        <div className="relative w-full text-gray-400 focus-within:text-gray-600">
                            <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none pl-2">
                                <MagnifyingGlassIcon className="h-5 w-5" />
                            </div>
                            <div className="absolute inset-y-0 right-14 flex items-center pointer-events-none">

                            </div>
                            <input
                                name="search"
                                id="search"
                                className="block w-full h-full pl-10 pr-3 py-2 border-transparent text-gray-900 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-0 focus:border-transparent sm:text-sm dark:bg-gray-800 dark:text-white"
                                placeholder="Rechercher..."
                                type="search"
                                autoComplete="off"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => {
                                    setIsFocused(true);
                                    if (searchQuery.length >= 2) setShowSearchResults(true);
                                }}
                            />
                            {isFocused && (
                                <button
                                    onClick={() => {
                                        setIsFocused(false);
                                        setSearchQuery('');
                                        setSearchResults([]);
                                        setShowSearchResults(false);
                                    }}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    <span className="text-sm font-medium">Annuler</span>
                                </button>
                            )}
                            {/* Search Results Dropdown */}
                            {showSearchResults && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-h-96 overflow-y-auto z-50">
                                    {isSearching ? (
                                        <div className="p-4 flex justify-center items-center text-gray-500 dark:text-gray-400 text-sm">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400 mr-2"></div>
                                            Recherche en cours...
                                        </div>
                                    ) : searchResults.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                                            Aucun résultat trouvé
                                        </div>
                                    ) : (
                                        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {searchResults.map((result) => (
                                                <li key={`${result.type}-${result._id}`}>
                                                    <Link
                                                        href={result.url}
                                                        onClick={() => setShowSearchResults(false)}
                                                        className="block px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                                    >
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase
                                                        ${result.type === 'Client' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                                            result.type === 'Fournisseur' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'}
                                                    `}>{result.type}</span>
                                                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                                                        {result.title}
                                                                    </span>
                                                                </div>
                                                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-1">
                                                                    {result.subtitle}
                                                                </div>
                                                            </div>
                                                            {result.meta && (
                                                                <span className="text-xs font-mono text-gray-600 dark:text-gray-400">
                                                                    {result.meta}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {!isFocused && (
                <div className="flex items-center gap-2 md:gap-4 ml-auto" style={{ overflow: 'visible', position: 'relative', zIndex: 1000 }}>

                    {/* Administration Dropdown - Only for admin@entreprise-demo.com */}
                    {isSystemAdmin && (
                        <div
                            ref={adminContainerRef}
                            className="relative flex-shrink-0"
                            style={{ zIndex: 1000, overflow: 'visible' }}
                            onMouseEnter={handleAdminMenuEnter}
                            onMouseLeave={handleAdminMenuLeave}
                        >
                            <button
                                type="button"
                                className="flex items-center space-x-1 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-3 py-2 text-sm font-medium transition-colors"
                            >
                                <span className="hidden sm:inline">Admin</span>
                                <span className="sm:hidden"><CogIcon className="h-5 w-5" /></span>
                                <ChevronDownIcon className="h-4 w-4" />
                            </button>
                            {adminMenuOpen && (
                                <div
                                    className="absolute right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-2 border border-gray-200 dark:border-gray-700"
                                    style={{
                                        top: 'calc(100% + 4px)',
                                        width: '240px',
                                        zIndex: 1001
                                    }}
                                    onMouseEnter={handleAdminMenuEnter}
                                    onMouseLeave={handleAdminMenuLeave}
                                >
                                    <Link
                                        href="/companies"
                                        className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        <div className="flex items-center">
                                            <BuildingOfficeIcon className="h-5 w-5 mr-3 text-indigo-600" />
                                            <div>
                                                <div className="font-medium">Gérer les entreprises</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Contrôler les inscriptions</div>
                                            </div>
                                        </div>
                                    </Link>
                                    <Link
                                        href="/subscriptions/manage"
                                        className="block px-4 py-3 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                        onClick={() => setAdminMenuOpen(false)}
                                    >
                                        <div className="flex items-center">
                                            <CreditCardIcon className="h-5 w-5 mr-3 text-indigo-600" />
                                            <div>
                                                <div className="font-medium">Gérer les abonnements</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">Approuver les demandes</div>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Back to Admin Button (Impersonation Mode) */}
                    {(session?.user as any)?.isImpersonating && (
                        <button
                            onClick={async () => {
                                try {
                                    const res = await fetch('/api/admin/unimpersonate', { method: 'POST' });
                                    if (res.ok) {
                                        const { impersonationToken } = await res.json();
                                        const { signIn } = await import('next-auth/react');
                                        await signIn('credentials', {
                                            impersonationToken,
                                            redirect: false
                                        });
                                        window.location.href = '/admin';
                                    }
                                } catch (e) {
                                    console.error(e);
                                }
                            }}
                            className="hidden md:flex items-center px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors border border-amber-300 shadow-sm animate-pulse flex-shrink-0"
                        >
                            <span className="mr-1">⚠️</span>
                            <span className="whitespace-nowrap">Retour Admin</span>
                        </button>
                    )}

                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="bg-white dark:bg-gray-700 p-1.5 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex-shrink-0"
                    >
                        {darkMode ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
                    </button>

                    {/* Home Icon - Only for admin */}
                    {isAdmin && (
                        <Link
                            href="/"
                            className="bg-white dark:bg-gray-700 p-1.5 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 flex-shrink-0"
                            title="Retour à la page d'accueil"
                        >
                            <HomeIcon className="h-5 w-5" />
                        </Link>
                    )}

                    {/* Notifications - Only for admin */}
                    {isAdmin && (
                        <div className="relative flex-shrink-0" ref={notifRef}>
                            <button
                                type="button"
                                onClick={() =>
                                    setNotifOpen((open) => {
                                        const next = !open;
                                        // When opening the panel, mark all as read so the red badge disappears
                                        if (!open && next && unreadCount > 0) {
                                            markAsRead();
                                        }
                                        return next;
                                    })
                                }
                                className="bg-white dark:bg-gray-700 p-1.5 rounded-full text-gray-400 hover:text-gray-500 dark:text-gray-300 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 relative"
                            >
                                <BellIcon className="h-5 w-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[18px]">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            {notifOpen && (
                                <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-lg shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
                                    <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                        <span className="text-sm font-semibold text-gray-800 dark:text-white">
                                            Notifications
                                        </span>
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={() => markAsRead()}
                                                className="text-xs text-indigo-600 hover:text-indigo-800"
                                            >
                                                Tout marquer comme lu
                                            </button>
                                        )}
                                    </div>
                                    <div className="max-h-80 overflow-y-auto">
                                        {loadingNotifs ? (
                                            <div className="py-6 text-center text-gray-500 text-sm">
                                                Chargement...
                                            </div>
                                        ) : notifications.length === 0 ? (
                                            <div className="py-6 text-center text-gray-500 text-sm">
                                                Aucune notification
                                            </div>
                                        ) : (
                                            <ul className="divide-y divide-gray-100">
                                                {notifications.map((notif) => (
                                                    <li
                                                        key={notif._id}
                                                        className={`px-4 py-3 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${notif.status === 'unread' ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                                                            }`}
                                                        onClick={() =>
                                                            markAsRead(notif._id, notif.link || undefined)
                                                        }
                                                    >
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex-1 pr-2">
                                                                <p className="font-medium text-gray-900 dark:text-white">
                                                                    {notif.title}
                                                                </p>
                                                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                                                                    {notif.message}
                                                                </p>
                                                                <p className="text-[11px] text-gray-400 mt-1">
                                                                    {formatDate(notif.createdAt)}
                                                                </p>
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
                                    <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 text-xs text-right">
                                        <Link
                                            href="/notifications"
                                            className="text-indigo-600 hover:text-indigo-800"
                                            onClick={() => setNotifOpen(false)}
                                        >
                                            Voir toutes les notifications
                                        </Link>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    <div
                        ref={containerRef}
                        className="relative flex-shrink-0"
                        style={{ zIndex: 1000 }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <button
                            type="button"
                            className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 px-1 py-1 text-sm font-medium transition-colors"
                        >
                            {companySettings?.societe?.logoUrl ? (
                                <div className="relative w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-300 dark:border-gray-600">
                                    <Image
                                        src={companySettings.societe.logoUrl}
                                        alt="Company Logo"
                                        width={32}
                                        height={32}
                                        className="object-cover w-full h-full"
                                        priority
                                    />
                                </div>
                            ) : (
                                <UserCircleIcon className="h-8 w-8 text-gray-400" />
                            )}
                            <div className="hidden md:block text-left">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-[100px] truncate">{session?.user?.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{session?.user?.role === 'admin' ? 'Admin' : (session?.user?.role || 'User')}</p>
                            </div>
                        </button>
                        {userMenuOpen && (
                            <div
                                className="absolute right-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl py-2 border border-gray-200 dark:border-gray-700"
                                style={{
                                    top: 'calc(100% + 4px)',
                                    width: '224px',
                                    zIndex: 1001
                                }}
                                onMouseEnter={handleMouseEnter}
                                onMouseLeave={handleMouseLeave}
                            >
                                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">{session?.user?.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{session?.user?.email}</p>

                                    {session?.user?.role === 'admin' && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                                            Admin Système
                                        </span>
                                    )}
                                </div>
                                <Link
                                    href="/profile"
                                    className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    onClick={() => setUserMenuOpen(false)}
                                >
                                    <div className="flex items-center">
                                        <UserCircleIcon className="h-5 w-5 mr-2" />
                                        Mon Profil
                                    </div>
                                </Link>
                                {isAdmin && (
                                    <>
                                        <Link
                                            href="/settings"
                                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <div className="flex items-center">
                                                <CogIcon className="h-5 w-5 mr-2" />
                                                Paramètres
                                            </div>
                                        </Link>
                                    </>
                                )}
                                <button
                                    onClick={async () => {
                                        await signOut({ redirect: false });
                                        router.push('/auth/signin');
                                        setUserMenuOpen(false);
                                    }}
                                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                >
                                    <div className="flex items-center">
                                        <ArrowRightOnRectangleIcon className="h-5 w-5 mr-2" />
                                        Déconnexion
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
