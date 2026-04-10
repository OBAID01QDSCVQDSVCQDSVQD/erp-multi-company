'use client';

import { useEffect, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

export default function InstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallButton, setShowInstallButton] = useState(false);
    const [isClosed, setIsClosed] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            
            // Ne l'afficher que si l'utilisateur ne l'a pas déjà fermé
            const hasClosed = localStorage.getItem('pwa_prompt_closed');
            if (!hasClosed) {
                setShowInstallButton(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowInstallButton(false);
        }
    };

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowInstallButton(false);
        setIsClosed(true);
        // Optionnel : ne plus l'afficher pendant 24h
        localStorage.setItem('pwa_prompt_closed', 'true');
    };

    if (!showInstallButton || isClosed) return null;

    return (
        <div className="fixed bottom-6 left-0 right-0 px-4 z-[9999] flex justify-center pointer-events-none">
            <div className="relative pointer-events-auto group">
                {/* Close Button UI */}
                <button
                    onClick={handleClose}
                    className="absolute -top-2 -right-2 bg-white text-gray-800 rounded-full p-1 shadow-md border border-gray-200 hover:bg-gray-100 transition-all z-10"
                    title="Fermer"
                >
                    <XMarkIcon className="h-4 w-4" />
                </button>

                {/* Main Install Button */}
                <button
                    onClick={handleInstallClick}
                    className="bg-blue-600 text-white px-8 py-3.5 rounded-full shadow-2xl font-bold flex items-center gap-2 hover:bg-blue-700 active:scale-95 transition-all animate-bounce"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Installer l'application</span>
                </button>
            </div>
        </div>
    );
}

