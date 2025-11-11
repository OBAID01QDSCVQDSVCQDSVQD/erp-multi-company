'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bars3Icon, BellIcon, HomeIcon, UserCircleIcon, ChartBarIcon, ArrowRightOnRectangleIcon, CogIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setUserMenuOpen(false);
    }, 150);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setUserMenuOpen(true);
  };

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow" style={{ overflow: 'visible' }}>
      <button
        type="button"
        className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden relative z-50"
        onClick={onMenuClick}
      >
        <Bars3Icon className="h-6 w-6" />
      </button>
      <div className="flex-1 px-4 flex justify-between" style={{ overflow: 'visible' }}>
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full text-gray-400 focus-within:text-gray-600">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <span className="text-sm text-gray-500">Rechercher...</span>
              </div>
            </div>
          </div>
        </div>
        <div className="ml-4 flex items-center md:ml-6" style={{ overflow: 'visible', position: 'relative', zIndex: 1000 }}>
          <Link
            href="/"
            className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 mr-2"
            title="Retour à la page d'accueil"
          >
            <HomeIcon className="h-6 w-6" />
          </Link>

          <button
            type="button"
            className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <BellIcon className="h-6 w-6" />
          </button>

          <div 
            ref={containerRef}
            className="ml-3 relative"
            style={{ zIndex: 1000 }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              type="button"
              className="flex items-center space-x-2 text-gray-700 hover:text-indigo-600 px-2 py-1 text-sm font-medium transition-colors"
            >
              <UserCircleIcon className="h-6 w-6" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-700">{session?.user?.name}</p>
                <p className="text-xs text-gray-500">{session?.user?.companyName}</p>
              </div>
            </button>
            {userMenuOpen && (
              <div 
                className="absolute right-0 bg-white rounded-lg shadow-xl py-2 border border-gray-200"
                style={{ 
                  top: 'calc(100% + 4px)',
                  width: '224px',
                  zIndex: 1001
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
              >
                  <div className="px-4 py-2 border-b border-gray-200">
                    <p className="text-sm font-medium text-gray-900">{session?.user?.name}</p>
                    <p className="text-xs text-gray-500">{session?.user?.email}</p>
                    <p className="text-xs text-gray-500">{session?.user?.companyName}</p>
                    {session?.user?.role === 'admin' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mt-1">
                        Admin Système
                      </span>
                    )}
                  </div>
                  <Link
                    href="/settings"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <CogIcon className="h-5 w-5 mr-2" />
                      Paramètres
                    </div>
                  </Link>
                  <button
                    onClick={async () => {
                      await signOut({ redirect: false });
                      router.push('/auth/signin');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors"
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
      </div>
    </div>
  );
}
