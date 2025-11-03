'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bars3Icon, BellIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <div className="relative z-10 flex-shrink-0 flex h-16 bg-white shadow">
      <button
        type="button"
        className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 lg:hidden"
        onClick={onMenuClick}
      >
        <Bars3Icon className="h-6 w-6" />
      </button>
      <div className="flex-1 px-4 flex justify-between">
        <div className="flex-1 flex">
          <div className="w-full flex md:ml-0">
            <div className="relative w-full text-gray-400 focus-within:text-gray-600">
              <div className="absolute inset-y-0 left-0 flex items-center pointer-events-none">
                <span className="text-sm text-gray-500">Rechercher...</span>
              </div>
            </div>
          </div>
        </div>
        <div className="ml-4 flex items-center md:ml-6">
          <button
            type="button"
            className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <BellIcon className="h-6 w-6" />
          </button>

          <div className="ml-3 relative">
            <div className="flex items-center">
              <div className="text-sm">
                <p className="text-gray-700 font-medium">{session?.user?.name}</p>
                <p className="text-gray-500 text-xs">{session?.user?.companyName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
